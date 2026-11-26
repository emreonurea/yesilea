import { ALLERGEN_KEYS, AISLE_ORDER, MICRO_KEYS, UNIT_KEYS } from "@menu/shared";
import { config } from "./config";
import { ApiError } from "./http";

// Claude API çağrısı. Yapılandırılmış çıktı için zorunlu araç (tool) kullanılır:
// model yanıtını şemaya uygun JSON olarak araç girdisi şeklinde verir.

export const RECIPE_SCHEMA = {
  type: "object",
  required: ["name_tr", "description", "servings", "prep_min", "cook_min", "difficulty", "ingredients", "steps", "allergens", "diet_tags", "halal_status", "nutrition"],
  properties: {
    name_tr: { type: "string" },
    name_local: { type: "string" },
    country: { type: "string" },
    description: { type: "string", description: "En fazla 2 cümle" },
    servings: { type: "integer", minimum: 1, maximum: 20 },
    prep_min: { type: "integer", minimum: 0 },
    cook_min: { type: "integer", minimum: 0 },
    difficulty: { type: "string", enum: ["kolay", "orta", "zor"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "qty", "unit", "aisle"],
        properties: {
          name: { type: "string", description: "Yalın Türkçe malzeme adı, küçük harf (ör. 'kuru soğan')" },
          qty: { type: "number", exclusiveMinimum: 0 },
          unit: { type: "string", enum: UNIT_KEYS },
          aisle: { type: "string", enum: AISLE_ORDER },
          note: { type: "string" },
        },
      },
    },
    steps: { type: "array", items: { type: "string" }, minItems: 1 },
    allergens: { type: "array", items: { type: "string", enum: ALLERGEN_KEYS } },
    diet_tags: { type: "array", items: { type: "string", enum: ["vejetaryen", "vegan"] } },
    halal_status: { type: "string", enum: ["uygun", "uyarlanmış", "kontrol gerekli"] },
    nutrition: {
      type: "object",
      description: "BİR porsiyonun tahmini besin değeri",
      required: ["kcal", "protein_g", "karb_g", "yag_g", "micros"],
      properties: {
        kcal: { type: "number" },
        protein_g: { type: "number" },
        karb_g: { type: "number" },
        yag_g: { type: "number" },
        micros: {
          type: "object",
          properties: Object.fromEntries(MICRO_KEYS.map((k) => [k, { type: "number" }])),
        },
      },
    },
    substitutes: {
      type: "array",
      items: { type: "object", required: ["for", "use"], properties: { for: { type: "string" }, use: { type: "string" } } },
    },
  },
} as const;

export const PLAN_SCHEMA = {
  type: "object",
  required: ["days"],
  properties: {
    days: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        required: ["kahvalti", "ogle", "aksam"],
        properties: { kahvalti: RECIPE_SCHEMA, ogle: RECIPE_SCHEMA, aksam: RECIPE_SCHEMA },
      },
    },
  },
} as const;

export interface ToolCall {
  model: string;
  system: string;
  user: string;
  toolName: string;
  schema: object;
  maxTokens: number;
}

export const LLM_UNAVAILABLE = new ApiError(503, "llm_unavailable",
  "Şu anda öneri hazırlanamıyor. Lütfen birkaç dakika sonra tekrar deneyin.");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callTool(c: ToolCall): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: c.model,
          max_tokens: c.maxTokens,
          system: c.system,
          messages: [{ role: "user", content: c.user }],
          tools: [{ name: c.toolName, description: "Sonucu bu araçla, şemaya tam uyarak ver.", input_schema: c.schema }],
          tool_choice: { type: "tool", name: c.toolName },
        }),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (e) {
      console.error("[llm] ağ hatası", e);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      console.error("[llm] geçici hata", res.status);
      await sleep(1500 * 2 ** attempt);
      continue;
    }
    if (!res.ok) {
      console.error("[llm] hata", res.status, await res.text().catch(() => ""));
      throw LLM_UNAVAILABLE;
    }
    const data = (await res.json()) as { content: { type: string; name?: string; input?: unknown }[]; stop_reason?: string };
    if (data.stop_reason === "max_tokens") console.warn("[llm] çıktı max_tokens sınırında kesildi");
    const block = data.content.find((b) => b.type === "tool_use" && b.name === c.toolName);
    if (!block) throw LLM_UNAVAILABLE;
    return block.input;
  }
  throw LLM_UNAVAILABLE;
}
