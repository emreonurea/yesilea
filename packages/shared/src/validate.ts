// Modelden gelen JSON'un şema doğrulaması ve otomatik kalite kontrolleri.

import { ALLERGEN_KEYS, missingAllergenTags, type AllergenKey } from "./allergens";
import { guessAisle, INGREDIENT_VOCAB, isAisle } from "./aisles";
import { containsTerm, normalize } from "./text";
import { isUnit } from "./units";
import { parseNutrition } from "./nutrition";
import type { DietTag, Difficulty, HalalStatus, IngredientLine, MealPlan, MealSlot, Recipe } from "./types";

export interface RecipeCheck {
  recipe: Recipe | null;
  errors: string[];
  /** Tarifi reddettirmeyen ama "inceleme gerekli" işaretleten bulgular. */
  warnings: string[];
}

const DIFF: Difficulty[] = ["kolay", "orta", "zor"];
const HALAL: HalalStatus[] = ["uygun", "uyarlanmış", "kontrol gerekli"];
const DIET: DietTag[] = ["vejetaryen", "vegan"];

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN);

export function validateRecipe(raw: unknown, ctx = "tarif"): RecipeCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object") return { recipe: null, errors: [`${ctx}: nesne değil`], warnings };
  const o = raw as Record<string, unknown>;

  const name_tr = str(o.name_tr);
  if (!name_tr) errors.push(`${ctx}: name_tr boş`);
  const servings = num(o.servings);
  if (!(servings >= 1 && servings <= 20)) errors.push(`${ctx}: servings 1-20 arasında olmalı`);
  const prep = num(o.prep_min);
  const cook = num(o.cook_min);
  if (!(prep >= 0 && prep <= 240)) errors.push(`${ctx}: prep_min 0-240 dakika olmalı`);
  if (!(cook >= 0 && cook <= 720)) errors.push(`${ctx}: cook_min 0-720 dakika olmalı`);
  if (prep + cook <= 0) errors.push(`${ctx}: toplam süre sıfır olamaz`);

  const ingRaw = Array.isArray(o.ingredients) ? o.ingredients : [];
  if (!ingRaw.length) errors.push(`${ctx}: malzeme listesi boş`);
  const ingredients: IngredientLine[] = [];
  const seen = new Map<string, number>();
  ingRaw.forEach((x, i) => {
    const r = (x ?? {}) as Record<string, unknown>;
    const name = str(r.name);
    const qty = num(r.qty);
    const unit = r.unit;
    if (!name) errors.push(`${ctx}: ${i + 1}. malzemenin adı yok`);
    if (!(qty > 0)) errors.push(`${ctx}: "${name}" miktarı sıfırdan büyük olmalı`);
    if (!isUnit(unit)) errors.push(`${ctx}: "${name}" için geçersiz birim "${String(unit)}"`);
    const key = normalize(name);
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (name && qty > 0 && isUnit(unit)) {
      ingredients.push({
        name, qty, unit,
        aisle: isAisle(r.aisle) ? r.aisle : guessAisle(name),
        ...(str(r.note) ? { note: str(r.note) } : {}),
      });
    }
  });
  for (const [k, n] of seen) if (k && n > 1) warnings.push(`${ctx}: "${k}" malzemesi ${n} kez yazılmış`);

  const steps = (Array.isArray(o.steps) ? o.steps : []).map(str).filter(Boolean);
  if (!steps.length) errors.push(`${ctx}: adım listesi boş`);

  const difficulty = DIFF.includes(o.difficulty as Difficulty) ? (o.difficulty as Difficulty) : "orta";
  const halal_status = HALAL.includes(o.halal_status as HalalStatus) ? (o.halal_status as HalalStatus) : "kontrol gerekli";
  const diet_tags = (Array.isArray(o.diet_tags) ? o.diet_tags : []).filter((d): d is DietTag => DIET.includes(d as DietTag));
  let allergens = (Array.isArray(o.allergens) ? o.allergens : []).filter((a): a is AllergenKey =>
    ALLERGEN_KEYS.includes(a as AllergenKey));

  // Alerjen tutarlılığı: malzemeden çıkan ama beyan edilmeyen alerjeni ekle ve uyar.
  const missing = missingAllergenTags(allergens, ingredients);
  if (missing.length) {
    warnings.push(`${ctx}: beyan edilmemiş alerjen eklendi: ${missing.join(", ")}`);
    allergens = ALLERGEN_KEYS.filter((k) => allergens.includes(k) || missing.includes(k));
  }

  // Adımlarda geçip listede olmayan malzeme.
  const stepText = steps.join(" ");
  for (const w of INGREDIENT_VOCAB) {
    const term = { term: w };
    if (containsTerm(stepText, term) && !ingredients.some((i) => containsTerm(i.name, term) || normalize(i.name).includes(w))) {
      warnings.push(`${ctx}: adımlarda "${w}" geçiyor ama malzeme listesinde yok`);
    }
  }

  // Vegan/vejetaryen etiketi ile malzeme tutarlılığı.
  const meatLike = ingredients.some((i) => /\b(et|kiyma|tavuk|dana|kuzu|hindi|balik|hamsi|somon|karides|midye|sucuk|pastirma|ciger)\b/.test(normalize(i.name)));
  if (meatLike && diet_tags.length) errors.push(`${ctx}: et/balık içeren tarif vejetaryen/vegan etiketlenmiş`);
  if (diet_tags.includes("vegan") && allergens.some((a) => a === "sut" || a === "yumurta")) {
    errors.push(`${ctx}: süt/yumurta içeren tarif vegan etiketlenmiş`);
  }

  const substitutes = (Array.isArray(o.substitutes) ? o.substitutes : [])
    .map((s) => ({ for: str((s as Record<string, unknown>)?.for), use: str((s as Record<string, unknown>)?.use) }))
    .filter((s) => s.for && s.use);

  const nutrition = parseNutrition(o.nutrition);
  if (o.nutrition !== undefined && !nutrition) warnings.push(`${ctx}: besin değeri tutarsız, gösterilmeyecek`);

  if (errors.length) return { recipe: null, errors, warnings };
  return {
    recipe: {
      name_tr,
      ...(str(o.name_local) ? { name_local: str(o.name_local) } : {}),
      country: str(o.country) || "Türkiye",
      description: str(o.description),
      servings, prep_min: prep, cook_min: cook, difficulty,
      ingredients, steps, allergens, diet_tags, halal_status,
      ...(substitutes.length ? { substitutes } : {}),
      ...(nutrition ? { nutrition } : {}),
    },
    errors, warnings,
  };
}

export interface PlanCheck {
  plan: MealPlan | null;
  errors: string[];
  warnings: string[];
}

export function validatePlan(raw: unknown): PlanCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const o = (raw ?? {}) as Record<string, unknown>;
  const days = Array.isArray(o.days) ? o.days : [];
  if (days.length !== 7) errors.push(`days 7 gün olmalı, ${days.length} geldi`);
  const out: MealPlan = { days: [] };
  days.slice(0, 7).forEach((d, i) => {
    const dd = (d ?? {}) as Record<string, unknown>;
    const day: Partial<Record<MealSlot, Recipe>> = {};
    for (const slot of ["kahvalti", "ogle", "aksam"] as MealSlot[]) {
      const c = validateRecipe(dd[slot], `${i + 1}. gün ${slot}`);
      errors.push(...c.errors);
      warnings.push(...c.warnings);
      if (c.recipe) day[slot] = c.recipe;
    }
    if (day.kahvalti && day.ogle && day.aksam) {
      out.days.push({ day: i + 1, kahvalti: day.kahvalti, ogle: day.ogle, aksam: day.aksam });
    }
  });
  return { plan: errors.length ? null : out, errors, warnings };
}
