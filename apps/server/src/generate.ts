import {
  ALLERGEN_LABELS, checkAgainstProfile, computeTargets, MEAL_SHARE, containsTerm, detectAllergens, halalStatusFor, HALAL_RULES_PROMPT, MEAL_SLOT_LABELS, normalize,
  SAMPLE_RECIPES, scaleQty, scanRecipe, UNITS, validatePlan, validateRecipe,
  type MealPlan, type MealSlot, type PantryItem, type Profile, type Recipe, type UnitPrice,
} from "@menu/shared";
import { config } from "./config";
import { ApiError } from "./http";
import { callTool, PLAN_SCHEMA, RECIPE_SCHEMA } from "./llm";

export interface GenInput {
  profile: Profile;
  pantry: PantryItem[];
  liked: string[];
  disliked: string[];
  prices: UnitPrice[];
}

export interface SingleRequest {
  slot: MealSlot;
  /** 1-7 (Pazartesi-Pazar). Hafta içi süre sınırı için. */
  day: number;
  /** Kesinlikle tekrar önerilmemesi gereken yemekler (değiştirilen yemek, "başka öner" ile geçilenler). */
  avoid: string[];
  /** Mümkünse farklı olsun (menüdeki diğer yemekler). Zorunlu değil. */
  variety?: string[];
  /** Ana ekrandaki hızlı öneri mi? */
  tonight?: boolean;
}

export interface Provider {
  plan(input: GenInput, previousErrors: string[]): Promise<unknown>;
  single(input: GenInput, req: SingleRequest, previousErrors: string[]): Promise<unknown>;
}

// Profil kontrolü ortak pakette (telefondaki sunucusuz mod da aynısını kullanır).
export { checkAgainstProfile };

// ---------- Üretim döngüleri ----------

const MAX_ATTEMPTS = 3;

export async function generateSingle(input: GenInput, req: SingleRequest, provider: Provider): Promise<Recipe> {
  let errors: string[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const raw = await provider.single(input, req, errors);
    const v = validateRecipe(raw, MEAL_SLOT_LABELS[req.slot]);
    errors = v.errors;
    if (v.recipe) {
      if (req.avoid.some((a) => normalize(a) === normalize(v.recipe!.name_tr))) {
        errors = [`"${v.recipe.name_tr}" zaten önerildi, farklı bir yemek seç`];
        continue;
      }
      const c = checkAgainstProfile(v.recipe, input.profile, req.day, MEAL_SLOT_LABELS[req.slot]);
      if (c.recipe) return c.recipe;
      errors = c.errors;
    }
  }
  console.warn("[generate] tek tarif üretilemedi", errors);
  throw new ApiError(422, "no_recipe", "Tercihlerinize uyan bir tarif bulunamadı. Profil kısıtlarınızı gevşetip tekrar deneyin.");
}

export async function generatePlan(input: GenInput, provider: Provider): Promise<{ plan: MealPlan; warnings: string[] }> {
  let errors: string[] = [];
  let lastPlan: MealPlan | null = null;
  let warnings: string[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const v = validatePlan(await provider.plan(input, errors));
    errors = [...v.errors];
    warnings = v.warnings;
    if (!v.plan) continue;
    lastPlan = v.plan;
    const bad = profileErrors(v.plan, input.profile);
    if (!bad.errors.length) return { plan: bad.plan, warnings };
    errors = bad.errors;
    lastPlan = bad.plan;
    // Az sayıda hatalı öğün varsa tüm menüyü yeniden üretmek yerine onları tek tek değiştir.
    if (bad.failed.length <= 5) return { plan: await repairSlots(input, bad.plan, bad.failed, provider), warnings };
  }
  console.warn("[generate] menü üretilemedi", errors.slice(0, 10));
  if (lastPlan) {
    const bad = profileErrors(lastPlan, input.profile);
    return { plan: await repairSlots(input, bad.plan, bad.failed.slice(0, 21), provider), warnings };
  }
  throw new ApiError(422, "no_plan", "Menü hazırlanamadı. Lütfen tekrar deneyin.");
}

function profileErrors(plan: MealPlan, profile: Profile) {
  const errors: string[] = [];
  const failed: { day: number; slot: MealSlot }[] = [];
  const out: MealPlan = { days: plan.days.map((d) => ({ ...d })) };
  for (const d of out.days) {
    for (const slot of ["kahvalti", "ogle", "aksam"] as MealSlot[]) {
      const c = checkAgainstProfile(d[slot], profile, d.day, `${d.day}. gün ${MEAL_SLOT_LABELS[slot]}`);
      if (c.recipe) d[slot] = c.recipe;
      else { errors.push(...c.errors); failed.push({ day: d.day, slot }); }
    }
  }
  return { plan: out, errors, failed };
}

async function repairSlots(input: GenInput, plan: MealPlan, failed: { day: number; slot: MealSlot }[], provider: Provider) {
  for (const f of failed) {
    const day = plan.days.find((d) => d.day === f.day)!;
    const variety = plan.days.flatMap((d) => [d.kahvalti.name_tr, d.ogle.name_tr, d.aksam.name_tr]);
    day[f.slot] = await generateSingle(input, { slot: f.slot, day: f.day, avoid: [day[f.slot].name_tr], variety }, provider);
  }
  return plan;
}

// ---------- Claude ile istek metinleri ----------

const unitList = Object.entries(UNITS).map(([k, u]) => `${k} (${u.label})`).join(", ");

function systemPrompt(p: Profile): string {
  return [
    "Sen Türk ev mutfağını çok iyi bilen bir yemek planlayıcısısın. Türkiye'de kolay bulunan malzemelerle, evde yapılabilir, gerçekçi tarifler önerirsin.",
    "Türk mutfağı ağırlıklı olsun; arada başka mutfaklardan da yemek olabilir.",
    "Tarif metinlerini kendin özgün yaz, başka kaynaklardan kopyalama.",
    `Birimler yalnızca şunlardan biri olabilir: ${unitList}. Miktarlar sayı olmalı (ör. 0.5).`,
    "Malzeme adları yalın, küçük harfli Türkçe olsun (ör. 'kuru soğan', 'domates salçası'). Aynı malzemeyi iki kez yazma. Adımlarda geçen her malzeme listede olsun (su hariç).",
    "Alerjenleri (allergens) malzemelere göre eksiksiz işaretle. Fiyat uydurma, fiyat bilgisi verme.",
    "nutrition alanına BİR porsiyonun gerçekçi tahmini besin değerini yaz (kcal, protein_g, karb_g, yag_g ve mikrolar: lif_g, sodyum_mg, demir_mg, kalsiyum_mg, potasyum_mg, magnezyum_mg, c_vit_mg, d_vit_ug, b12_ug). kcal, makrolarla tutarlı olsun.",
    p.halal_sensitive ? HALAL_RULES_PROMPT : "",
  ].filter(Boolean).join("\n");
}

function profileText(input: GenInput): string {
  const p = input.profile;
  const lines = [
    `Hane: ${p.household_size} kişi. Her tarifte servings = ${p.household_size} olsun.`,
    `Diyet: ${p.diet}.`,
    p.allergies.length ? `ALERJİLER (bu alerjenleri içeren hiçbir şey önerme): ${p.allergies.map((a) => ALLERGEN_LABELS[a]).join(", ")}.` : "",
    p.dislikes.length ? `Sevmediği yiyecekler (kullanma): ${p.dislikes.join(", ")}.` : "",
    p.max_weekday_minutes ? `Hafta içi (Pazartesi-Cuma) her öğünün toplam hazırlık+pişirme süresi en fazla ${p.max_weekday_minutes} dakika.` : "",
    input.pantry.length
      ? `Evdeki malzemeler (öncelikle bunları kullan; son kullanma tarihi yakın olanları önce): ${input.pantry
          .map((i) => `${i.name}${i.qty ? ` ${i.qty} ${i.unit ? UNITS[i.unit].label : ""}` : ""}${i.expires_on ? ` (SKT ${i.expires_on})` : ""}`)
          .join("; ")}.`
      : "",
    input.liked.length ? `Beğendiği yemekler (benzerlerini öner): ${input.liked.slice(0, 20).join(", ")}.` : "",
    input.disliked.length ? `Beğenmediği yemekler (önerme): ${input.disliked.slice(0, 30).join(", ")}.` : "",
    dietText(p),
    p.weekly_budget_try ? `Haftalık market bütçesi: ${p.weekly_budget_try} TL. Ekonomik malzemeleri tercih et.` : "",
    input.prices.length ? `Kullanıcının girdiği birim fiyatlar (bilgi için): ${input.prices.map((x) => `${x.name} ${x.price_try} TL/${UNITS[x.unit].label}`).join("; ")}.` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function dietText(p: Profile): string {
  if (!p.body) return "";
  const t = computeTargets(p.body);
  const share = (k: keyof typeof MEAL_SHARE) => Math.round(t.kcal * MEAL_SHARE[k]);
  return `DİYET PROGRAMI: Kişi başı günlük hedef yaklaşık ${t.kcal} kcal, ${t.protein_g} g protein, ${t.karb_g} g karbonhidrat, ${t.yag_g} g yağ, en az ${t.micros.lif_g} g lif, sodyum en fazla ${t.micros.sodyum_mg} mg. ` +
    `Öğün başına yaklaşık: kahvaltı ${share("kahvalti")} kcal, öğle ${share("ogle")} kcal, akşam ${share("aksam")} kcal. Bir porsiyonun değerleri bu hedeflere yakın olsun; sebze, bakliyat ve tam tahılı öne çıkar.`;
}

const retryText = (errors: string[]) =>
  errors.length ? `\n\nÖnceki denemede şu sorunlar vardı, bunları düzelt:\n- ${errors.slice(0, 15).join("\n- ")}` : "";

export const claudeProvider: Provider = {
  plan: (input, errors) => callTool({
    model: config.modelFast,
    system: systemPrompt(input.profile),
    user: `${profileText(input)}\n\n7 günlük (Pazartesi'den Pazar'a) menü hazırla: her gün kahvalti, ogle, aksam. Yemekler hafta boyunca tekrar etmesin, çeşitli olsun. Kahvaltılar pratik olsun.${retryText(errors)}`,
    toolName: "haftalik_menu",
    schema: PLAN_SCHEMA,
    maxTokens: 32000,
  }),
  single: (input, req, errors) => callTool({
    model: config.modelFast,
    system: systemPrompt(input.profile),
    user: `${profileText(input)}\n\n${req.tonight ? "Bu akşam için tek bir akşam yemeği öner. Evdeki malzemeleri olabildiğince kullan, pratik olsun." : `${req.day}. gün ${MEAL_SLOT_LABELS[req.slot]} için tek bir tarif öner.`}${req.avoid.length ? `\nŞunları kesinlikle önerme: ${req.avoid.join(", ")}.` : ""}${req.variety?.length ? `\nMenüde zaten şunlar var, mümkünse farklı bir yemek seç: ${req.variety.join(", ")}.` : ""}${retryText(errors)}`,
    toolName: "tarif",
    schema: RECIPE_SCHEMA,
    maxTokens: 4000,
  }),
};

// ---------- API anahtarı olmadan geliştirme için örnek sağlayıcı ----------

function pantryScore(r: Recipe, pantry: PantryItem[]) {
  return r.ingredients.filter((i) => pantry.some((p) => containsTerm(i.name, { term: normalize(p.name) }))).length;
}

function candidates(input: GenInput, slot: MealSlot, day: number, avoid: string[]) {
  const pool = SAMPLE_RECIPES.filter((r) => r.slots.includes(slot) && !avoid.some((a) => normalize(a) === normalize(r.name_tr)))
    .filter((r) => !input.disliked.some((d) => normalize(d) === normalize(r.name_tr)))
    .filter((r) => checkAgainstProfile(r, input.profile, day, "").recipe);
  return pool;
}

function scaled(r: Recipe, servings: number): Recipe {
  const { slots: _s, ...rest } = r as Recipe & { slots?: unknown };
  return {
    ...rest, servings,
    ingredients: r.ingredients.map((i) => ({ ...i, qty: Math.round(scaleQty(i.qty, r.servings, servings) * 100) / 100 })),
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const mockProvider: Provider = {
  async plan(input) {
    const used: string[] = [];
    const days = [];
    for (let day = 1; day <= 7; day++) {
      const d: Record<string, Recipe> = {};
      for (const slot of ["kahvalti", "ogle", "aksam"] as MealSlot[]) {
        let pool = candidates(input, slot, day, used);
        if (!pool.length) pool = candidates(input, slot, day, []);
        if (!pool.length) return { days: [] };
        const pick = shuffle(pool).sort((a, b) => pantryScore(b, input.pantry) - pantryScore(a, input.pantry))[0];
        used.push(pick.name_tr);
        d[slot] = scaled(pick, input.profile.household_size);
      }
      days.push(d);
    }
    return { days };
  },
  async single(input, req) {
    let pool = candidates(input, req.slot, req.day, [...req.avoid, ...(req.variety ?? [])]);
    if (!pool.length) pool = candidates(input, req.slot, req.day, req.avoid);
    if (!pool.length) return null;
    const pick = req.tonight
      ? shuffle(pool).sort((a, b) => pantryScore(b, input.pantry) - pantryScore(a, input.pantry))[0]
      : shuffle(pool)[0];
    return scaled(pick, input.profile.household_size);
  },
};

export const defaultProvider = (): Provider => (config.llmMock ? mockProvider : claudeProvider);
