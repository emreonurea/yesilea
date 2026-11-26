import type { UnitKey } from "./units";
import type { AllergenKey } from "./allergens";
import type { AisleKey } from "./aisles";
import type { BodyProfile, Nutrition } from "./nutrition";

export type Diet = "hepsi" | "vejetaryen" | "vegan";
export type DietTag = "vejetaryen" | "vegan";
export type Difficulty = "kolay" | "orta" | "zor";
export type HalalStatus = "uygun" | "uyarlanmış" | "kontrol gerekli";
export type ReviewStatus = "taslak" | "inceleme gerekli" | "incelendi";
export type MealSlot = "kahvalti" | "ogle" | "aksam";

export const MEAL_SLOTS: MealSlot[] = ["kahvalti", "ogle", "aksam"];
export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  kahvalti: "Kahvaltı",
  ogle: "Öğle",
  aksam: "Akşam",
};
export const DAY_LABELS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

export interface IngredientLine {
  name: string;
  qty: number;
  unit: UnitKey;
  aisle?: AisleKey;
  note?: string;
}

export interface Substitute {
  for: string;
  use: string;
}

export interface Recipe {
  id?: string;
  name_tr: string;
  name_local?: string;
  country: string;
  description: string;
  servings: number;
  prep_min: number;
  cook_min: number;
  difficulty: Difficulty;
  ingredients: IngredientLine[];
  steps: string[];
  allergens: AllergenKey[];
  diet_tags: DietTag[];
  halal_status: HalalStatus;
  substitutes?: Substitute[];
  review_status?: ReviewStatus;
  /** Bir porsiyonun tahmini besin değeri. */
  nutrition?: Nutrition;
}

export interface PlanDay {
  day: number; // 1 = Pazartesi
  kahvalti: Recipe;
  ogle: Recipe;
  aksam: Recipe;
}

export interface MealPlan {
  days: PlanDay[];
}

export interface Profile {
  household_size: number;
  weekly_budget_try: number | null;
  diet: Diet;
  halal_sensitive: boolean;
  allergies: AllergenKey[];
  dislikes: string[];
  max_weekday_minutes: number | null;
  /** Diyet programı için vücut bilgisi; boşsa diyet programı kapalı. */
  body: BodyProfile | null;
  /** Sağlık verilerinin (alerji, boy, kilo, yemek kaydı) işlenmesine verilen açık rızanın zamanı. KVKK md. 6. */
  health_consent_at: string | null;
}

export interface PantryItem {
  id?: string;
  name: string;
  qty: number | null;
  unit: UnitKey | null;
  expires_on?: string | null;
}

export interface UnitPrice {
  name: string;
  unit: UnitKey;
  /** Bu birimin 1'i için TL fiyat (ör. 1 kg domates = 40 TL). */
  price_try: number;
}

export const DEFAULT_PROFILE: Profile = {
  household_size: 2,
  weekly_budget_try: null,
  diet: "hepsi",
  halal_sensitive: true,
  allergies: [],
  dislikes: [],
  max_weekday_minutes: null,
  body: null,
  health_consent_at: null,
};
