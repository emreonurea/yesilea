// Kullanıcının kendi yemeği: malzemeler yerel yiyecek veritabanından gramajla ya da elle girilen değerlerle.
// Porsiyon başına besin değeri buradan hesaplanır (uygulamada önizleme, sunucuda kayıt için aynı kod).

import { detectAllergens } from "./allergens";
import { guessAisle } from "./aisles";
import { FOODS, foodNutrition } from "./foods";
import { halalStatusFor, scanRecipe } from "./halal";
import type { IngredientLine, Recipe } from "./types";

export type CustomItem =
  | { food: string; grams: number }
  | { name: string; kcal: number; protein_g: number; karb_g: number; yag_g: number };

export interface CustomRecipeInput {
  name: string;
  servings: number;
  items: CustomItem[];
  steps?: string[];
  note?: string;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function buildCustomRecipe(input: CustomRecipeInput): Recipe | string {
  const name = String(input?.name ?? "").trim().slice(0, 80);
  const servings = Number(input?.servings);
  if (!name) return "Yemeğe bir ad verin.";
  if (!(Number.isInteger(servings) && servings >= 1 && servings <= 20)) return "Porsiyon sayısı 1-20 arasında olmalı.";
  const items = Array.isArray(input?.items) ? input.items.slice(0, 40) : [];
  if (!items.length) return "En az bir malzeme ekleyin.";

  const ingredients: IngredientLine[] = [];
  let kcal = 0, p = 0, c = 0, f = 0;
  for (const it of items) {
    if ("food" in it) {
      const food = FOODS.find((x) => x.name === it.food);
      const g = Number(it.grams);
      if (!food) return `"${it.food}" veritabanında yok.`;
      if (!(g > 0 && g <= 5000)) return `"${food.name}" için gram 1-5000 arasında olmalı.`;
      const n = foodNutrition(food, g);
      kcal += n.kcal; p += n.protein_g; c += n.karb_g; f += n.yag_g;
      const lname = food.name.toLocaleLowerCase("tr-TR");
      ingredients.push({ name: lname, qty: Math.round(g), unit: "g", aisle: guessAisle(lname) });
    } else {
      const nm = String(it.name ?? "").trim().slice(0, 80);
      const vals = [it.kcal, it.protein_g, it.karb_g, it.yag_g].map(Number);
      if (!nm) return "Elle eklenen malzemenin adı yok.";
      if (!vals.every((v) => Number.isFinite(v) && v >= 0 && v <= 5000)) return `"${nm}" için değerler geçersiz.`;
      kcal += vals[0]; p += vals[1]; c += vals[2]; f += vals[3];
      ingredients.push({ name: nm, qty: 1, unit: "adet", aisle: guessAisle(nm) });
    }
  }
  const steps = (Array.isArray(input?.steps) ? input.steps : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 30);
  const draft = { name_tr: name, ingredients, steps };
  return {
    name_tr: name,
    country: "Kendi tarifim",
    description: String(input?.note ?? "").trim().slice(0, 300) || "Kendi tarifiniz.",
    servings,
    prep_min: 0,
    cook_min: 0,
    difficulty: "kolay",
    ingredients,
    steps,
    allergens: detectAllergens(ingredients),
    diet_tags: [],
    halal_status: halalStatusFor(scanRecipe(draft), "uygun") ?? "kontrol gerekli",
    nutrition: { kcal: Math.round(kcal / servings), protein_g: r1(p / servings), karb_g: r1(c / servings), yag_g: r1(f / servings), micros: {} },
  };
}
