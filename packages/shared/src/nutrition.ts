// Diyet programı: vücut bilgisinden günlük enerji, makro ve mikro besin hedefleri.
// Yöntem: bazal metabolizma için Mifflin-St Jeor denklemi, hareket katsayısı, hedefe göre güvenli açık/fazla.
// Mikro hedefler yetişkinler için yaygın kullanılan referans değerlerdir (yaklaşık). Tıbbi tavsiye değildir.

export type Sex = "kadin" | "erkek";
export type Activity = "hareketsiz" | "az" | "orta" | "cok" | "asiri";
export type Goal = "kilo_ver" | "koru" | "kilo_al";

export interface BodyProfile {
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity: Activity;
  goal: Goal;
}

export const ACTIVITY_LABELS: Record<Activity, string> = {
  hareketsiz: "Hareketsiz (masa başı)",
  az: "Az hareketli (haftada 1-3 gün spor)",
  orta: "Orta (haftada 3-5 gün spor)",
  cok: "Çok hareketli (haftada 6-7 gün)",
  asiri: "Çok yoğun (ağır iş / günde 2 antrenman)",
};
const ACTIVITY_FACTOR: Record<Activity, number> = { hareketsiz: 1.2, az: 1.375, orta: 1.55, cok: 1.725, asiri: 1.9 };

export const GOAL_LABELS: Record<Goal, string> = { kilo_ver: "Kilo vermek", koru: "Kilomu korumak", kilo_al: "Kilo almak" };

export type MicroKey = "lif_g" | "sodyum_mg" | "demir_mg" | "kalsiyum_mg" | "potasyum_mg" | "magnezyum_mg" | "c_vit_mg" | "d_vit_ug" | "b12_ug";

export const MICRO_LABELS: Record<MicroKey, { label: string; unit: string; limit?: boolean }> = {
  lif_g: { label: "Lif", unit: "g" },
  sodyum_mg: { label: "Sodyum", unit: "mg", limit: true },
  demir_mg: { label: "Demir", unit: "mg" },
  kalsiyum_mg: { label: "Kalsiyum", unit: "mg" },
  potasyum_mg: { label: "Potasyum", unit: "mg" },
  magnezyum_mg: { label: "Magnezyum", unit: "mg" },
  c_vit_mg: { label: "C vitamini", unit: "mg" },
  d_vit_ug: { label: "D vitamini", unit: "µg" },
  b12_ug: { label: "B12 vitamini", unit: "µg" },
};
export const MICRO_KEYS = Object.keys(MICRO_LABELS) as MicroKey[];

/** Bir porsiyonun (tahmini) besin değeri. */
export interface Nutrition {
  kcal: number;
  protein_g: number;
  karb_g: number;
  yag_g: number;
  micros: Partial<Record<MicroKey, number>>;
}

export interface Targets {
  bmi: number;
  bmi_label: string;
  bmr: number;
  tdee: number;
  kcal: number;
  protein_g: number;
  karb_g: number;
  yag_g: number;
  micros: Record<MicroKey, number>;
  notes: string[];
}

export const BODY_LIMITS = { age: [18, 100], height_cm: [120, 230], weight_kg: [35, 300] } as const;

export function validateBody(b: any): BodyProfile | string {
  const sex = b?.sex === "erkek" ? "erkek" : b?.sex === "kadin" ? "kadin" : null;
  const age = Number(b?.age);
  const h = Number(b?.height_cm);
  const w = Number(b?.weight_kg);
  if (!sex) return "Cinsiyet seçin.";
  if (!(age >= 18 && age <= 100)) return "Diyet programı 18 yaş ve üstü içindir.";
  if (!(h >= 120 && h <= 230)) return "Boy 120-230 cm arasında olmalı.";
  if (!(w >= 35 && w <= 300)) return "Kilo 35-300 kg arasında olmalı.";
  const activity = (Object.keys(ACTIVITY_FACTOR) as Activity[]).includes(b?.activity) ? b.activity : "az";
  const goal = (Object.keys(GOAL_LABELS) as Goal[]).includes(b?.goal) ? b.goal : "koru";
  return { sex, age: Math.round(age), height_cm: Math.round(h), weight_kg: Math.round(w * 10) / 10, activity, goal };
}

export function bmiOf(heightCm: number, weightKg: number) {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiLabel(bmi: number) {
  if (bmi < 18.5) return "Zayıf";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Fazla kilolu";
  return "Obez";
}

const round = (v: number, step = 1) => Math.round(v / step) * step;

export function computeTargets(b: BodyProfile): Targets {
  const notes: string[] = [];
  const bmi = bmiOf(b.height_cm, b.weight_kg);
  const bmr = 10 * b.weight_kg + 6.25 * b.height_cm - 5 * b.age + (b.sex === "erkek" ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTOR[b.activity];

  let goal = b.goal;
  if (goal === "kilo_ver" && bmi < 18.5) {
    goal = "koru";
    notes.push("Vücut kitle indeksiniz zayıf aralıkta olduğu için kilo verme hedefi uygulanmadı. Bir doktora ya da diyetisyene danışmanızı öneririz.");
  }

  let kcal = tdee;
  if (goal === "kilo_ver") kcal = tdee - Math.min(500, tdee * 0.2);
  if (goal === "kilo_al") kcal = tdee + 300;
  // Güvenli alt sınır: bazal metabolizmanın ve genel kabul gören en düşük değerin altına inilmez.
  const floor = Math.max(bmr, b.sex === "kadin" ? 1200 : 1500);
  if (kcal < floor) {
    kcal = floor;
    notes.push("Günlük kalori hedefi güvenli alt sınırın altına düşürülmedi.");
  }
  kcal = round(kcal, 10);

  const proteinPerKg = goal === "koru" ? 1.2 : 1.6;
  // Fazla kilolularda protein ihtiyacı aşırı çıkmasın diye boy için sağlıklı kilo (BKİ 25) üst sınır alınır.
  const refWeight = Math.min(b.weight_kg, 25 * (b.height_cm / 100) ** 2);
  const protein = round(proteinPerKg * refWeight);
  const fat = round((kcal * 0.3) / 9);
  const carb = Math.max(round((kcal - protein * 4 - fat * 9) / 4), 130);

  const f = b.sex === "kadin";
  const micros: Record<MicroKey, number> = {
    lif_g: f ? 25 : 30,
    sodyum_mg: 2000,
    demir_mg: f && b.age < 51 ? 18 : 8,
    kalsiyum_mg: b.age > 70 || (f && b.age > 50) ? 1200 : 1000,
    potasyum_mg: 3500,
    magnezyum_mg: f ? (b.age > 30 ? 320 : 310) : b.age > 30 ? 420 : 400,
    c_vit_mg: f ? 75 : 90,
    d_vit_ug: b.age > 70 ? 20 : 15,
    b12_ug: 2.4,
  };
  notes.push("Hamilelik, emzirme, kronik hastalık ya da düzenli ilaç kullanımı varsa hedefleri bir doktor ya da diyetisyenle belirleyin.");
  return { bmi, bmi_label: bmiLabel(bmi), bmr: round(bmr), tdee: round(tdee), kcal, protein_g: protein, karb_g: carb, yag_g: fat, micros, notes };
}

/** Öğünlere düşen kalori payı. */
export const MEAL_SHARE = { kahvalti: 0.25, ogle: 0.35, aksam: 0.4 } as const;

export function emptyNutrition(): Nutrition {
  return { kcal: 0, protein_g: 0, karb_g: 0, yag_g: 0, micros: {} };
}

export function addNutrition(a: Nutrition, b: Nutrition | undefined): Nutrition {
  if (!b) return a;
  const micros = { ...a.micros };
  for (const k of MICRO_KEYS) {
    if (b.micros?.[k] != null) micros[k] = (micros[k] ?? 0) + (b.micros[k] as number);
  }
  return {
    kcal: a.kcal + b.kcal,
    protein_g: a.protein_g + b.protein_g,
    karb_g: a.karb_g + b.karb_g,
    yag_g: a.yag_g + b.yag_g,
    micros,
  };
}

/** Bir kişinin bir günde aldığı toplam (her tarifin bir porsiyonu). */
export function dayTotal(recipes: { nutrition?: Nutrition }[]): { total: Nutrition; missing: number } {
  let total = emptyNutrition();
  let missing = 0;
  for (const r of recipes) {
    if (r.nutrition) total = addNutrition(total, r.nutrition);
    else missing++;
  }
  return { total, missing };
}

/** Modelden gelen besin değerini doğrular; bozuksa undefined döner (tarif reddedilmez). */
export function parseNutrition(raw: unknown): Nutrition | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, any>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : NaN);
  const kcal = n(o.kcal), p = n(o.protein_g), c = n(o.karb_g), f = n(o.yag_g);
  if ([kcal, p, c, f].some(Number.isNaN) || kcal > 3000 || kcal === 0) return undefined;
  // Makrolardan hesaplanan kalori ile beyan edilen arasında büyük fark varsa güvenilmez say.
  const fromMacros = p * 4 + c * 4 + f * 9;
  if (Math.abs(fromMacros - kcal) > Math.max(120, kcal * 0.35)) return undefined;
  const micros: Partial<Record<MicroKey, number>> = {};
  for (const k of MICRO_KEYS) {
    const v = n(o.micros?.[k]);
    if (!Number.isNaN(v)) micros[k] = Math.round(v * 10) / 10;
  }
  return { kcal: Math.round(kcal), protein_g: Math.round(p), karb_g: Math.round(c), yag_g: Math.round(f), micros };
}

export const DISCLAIMER_DIET =
  "Diyet programı genel bilgi amaçlıdır, tıbbi tavsiye değildir. Besin değerleri tahminidir. Sağlık durumunuza özel bir plan için doktor ya da diyetisyene danışın.";
