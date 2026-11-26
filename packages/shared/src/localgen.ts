// Sunucusuz (telefonda) menü üretimi: uygulamanın kendi tarif havuzundan, kullanıcı kısıtlarına uyarak seçer.
// Sunucu da aynı profil kontrolünü kullanır.

import { ALLERGEN_LABELS, detectAllergens } from "./allergens";
import { DIET_RECIPES } from "./dietRecipes";
import { halalStatusFor, scanRecipe } from "./halal";
import { MEAL_SHARE, computeTargets } from "./nutrition";
import { SAMPLE_RECIPES } from "./sampleRecipes";
import { containsTerm, normalize } from "./text";
import { scaleQty } from "./units";
import type { MealPlan, MealSlot, PantryItem, Profile, Recipe } from "./types";

const isWeekday = (day: number) => day >= 1 && day <= 5;

/** Tarifi kullanıcı kısıtlarına göre denetler. Hata yoksa helal durumu güncellenmiş tarifi döner. */
export function checkAgainstProfile(r: Recipe, p: Profile, day: number, ctx: string): { recipe: Recipe | null; errors: string[] } {
  const errors: string[] = [];
  const scan = scanRecipe(r);
  const status = halalStatusFor(scan, r.halal_status);
  if (p.halal_sensitive && status === null) errors.push(`${ctx}: yasaklı malzeme içeriyor (${scan.forbidden.join(", ")})`);
  const allergens = new Set([...r.allergens, ...detectAllergens(r.ingredients)]);
  const hit = p.allergies.filter((a) => allergens.has(a));
  if (hit.length) errors.push(`${ctx}: kullanıcının alerjisi var: ${hit.map((a) => ALLERGEN_LABELS[a]).join(", ")}`);
  for (const d of p.dislikes) {
    if (r.ingredients.some((i) => containsTerm(i.name, { term: normalize(d) })) || normalize(r.name_tr).includes(normalize(d))) {
      errors.push(`${ctx}: kullanıcının sevmediği "${d}" var`);
    }
  }
  if (p.diet === "vejetaryen" && !r.diet_tags.includes("vejetaryen") && !r.diet_tags.includes("vegan")) errors.push(`${ctx}: vejetaryen değil`);
  if (p.diet === "vegan" && !r.diet_tags.includes("vegan")) errors.push(`${ctx}: vegan değil`);
  if (p.max_weekday_minutes && isWeekday(day) && r.prep_min + r.cook_min > p.max_weekday_minutes) {
    errors.push(`${ctx}: toplam süre ${r.prep_min + r.cook_min} dk, hafta içi sınır ${p.max_weekday_minutes} dk`);
  }
  if (errors.length) return { recipe: null, errors };
  return { recipe: { ...r, allergens: [...allergens], halal_status: status ?? "kontrol gerekli" }, errors };
}

export interface LocalGenInput {
  profile: Profile;
  pantry: PantryItem[];
  /** "Bir daha önerme" denen yemek adları */
  disliked: string[];
}

type PoolRecipe = Recipe & { slots: MealSlot[] };

/** Telefonda kullanılan tarif havuzu: örnek tarifler + diyet tarifleri. */
export const LOCAL_POOL: PoolRecipe[] = [
  ...SAMPLE_RECIPES,
  ...DIET_RECIPES.map(({ id: _id, review_status: _r, ...r }) => r as PoolRecipe),
];

function stripSlots(r: PoolRecipe): Recipe {
  const { slots: _s, ...rest } = r;
  return rest;
}

/** Tarifi istenen porsiyona ölçekler (besin değeri porsiyon başına olduğu için değişmez). */
export function scaleRecipe(r: Recipe, servings: number): Recipe {
  return {
    ...r, servings,
    ingredients: r.ingredients.map((i) => ({ ...i, qty: Math.round(scaleQty(i.qty, r.servings, servings) * 100) / 100 })),
  };
}

function candidates(input: LocalGenInput, slot: MealSlot, day: number, avoid: string[]): PoolRecipe[] {
  const avoidN = avoid.map(normalize);
  const disN = input.disliked.map(normalize);
  return LOCAL_POOL.filter((r) => r.slots.includes(slot))
    .filter((r) => !avoidN.includes(normalize(r.name_tr)) && !disN.includes(normalize(r.name_tr)))
    .filter((r) => checkAgainstProfile(r, input.profile, day, "").recipe);
}

/** Puan: evdeki malzemeleri kullanması ve (diyet programı açıksa) öğün kalori payına yakınlığı. */
function score(r: Recipe, input: LocalGenInput, slot: MealSlot): number {
  const pantryHits = r.ingredients.filter((i) => input.pantry.some((p) => containsTerm(i.name, { term: normalize(p.name) }))).length;
  let s = pantryHits * 2 + Math.random() * 3;
  if (input.profile.body && r.nutrition) {
    const target = computeTargets(input.profile.body).kcal * MEAL_SHARE[slot];
    s -= Math.abs(r.nutrition.kcal - target) / 100;
  }
  return s;
}

function pick(pool: PoolRecipe[], input: LocalGenInput, slot: MealSlot): PoolRecipe {
  return [...pool].sort((a, b) => score(b, input, slot) - score(a, input, slot))[0];
}

/** Yedi günlük menü; havuz yetmezse yemekler tekrar edebilir. Hiç uygun tarif yoksa null. */
export function localPlan(input: LocalGenInput): MealPlan | null {
  const used: string[] = [];
  const days: MealPlan["days"] = [];
  for (let day = 1; day <= 7; day++) {
    const d: Partial<Record<MealSlot, Recipe>> = {};
    for (const slot of ["kahvalti", "ogle", "aksam"] as MealSlot[]) {
      let pool = candidates(input, slot, day, used);
      if (!pool.length) pool = candidates(input, slot, day, []);
      if (!pool.length) return null;
      const r = pick(pool, input, slot);
      used.push(r.name_tr);
      d[slot] = checkAgainstProfile(scaleRecipe(stripSlots(r), input.profile.household_size), input.profile, day, "").recipe!;
    }
    days.push({ day, kahvalti: d.kahvalti!, ogle: d.ogle!, aksam: d.aksam! });
  }
  return { days };
}

/** Tek öğün önerisi: önce "avoid" ve "variety" dışındakilerden, yoksa yalnızca "avoid" dışındakilerden. */
export function localSingle(input: LocalGenInput, slot: MealSlot, day: number, avoid: string[], variety: string[] = []): Recipe | null {
  let pool = candidates(input, slot, day, [...avoid, ...variety]);
  if (!pool.length) pool = candidates(input, slot, day, avoid);
  if (!pool.length) return null;
  const r = pick(pool, input, slot);
  return checkAgainstProfile(scaleRecipe(stripSlots(r), input.profile.household_size), input.profile, day, "").recipe;
}
