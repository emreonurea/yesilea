// Türkiye'de kullanılan ölçüler ve dönüşümler.
// Hacim ölçüleri yaklaşık değerlerdir: 1 su bardağı = 200 ml, 1 çay bardağı = 100 ml,
// 1 yemek kaşığı = 15 ml, 1 tatlı kaşığı = 10 ml, 1 çay kaşığı = 5 ml.

export type Dimension = "kutle" | "hacim" | "adet" | "dis" | "demet" | "dilim" | "tutam";

export type UnitKey =
  | "g" | "kg" | "ml" | "l"
  | "su_bardagi" | "cay_bardagi" | "yemek_kasigi" | "tatli_kasigi" | "cay_kasigi"
  | "adet" | "dis" | "demet" | "dilim" | "tutam";

interface UnitDef {
  label: string;
  dim: Dimension;
  /** Temel birim karşılığı: kütle için g, hacim için ml, diğerleri için 1. */
  base: number;
  /** Gösterimde yuvarlama adımı. */
  step: number;
}

export const UNITS: Record<UnitKey, UnitDef> = {
  g: { label: "g", dim: "kutle", base: 1, step: 5 },
  kg: { label: "kg", dim: "kutle", base: 1000, step: 0.05 },
  ml: { label: "ml", dim: "hacim", base: 1, step: 5 },
  l: { label: "litre", dim: "hacim", base: 1000, step: 0.05 },
  su_bardagi: { label: "su bardağı", dim: "hacim", base: 200, step: 0.25 },
  cay_bardagi: { label: "çay bardağı", dim: "hacim", base: 100, step: 0.25 },
  yemek_kasigi: { label: "yemek kaşığı", dim: "hacim", base: 15, step: 0.5 },
  tatli_kasigi: { label: "tatlı kaşığı", dim: "hacim", base: 10, step: 0.5 },
  cay_kasigi: { label: "çay kaşığı", dim: "hacim", base: 5, step: 0.25 },
  adet: { label: "adet", dim: "adet", base: 1, step: 0.5 },
  dis: { label: "diş", dim: "dis", base: 1, step: 1 },
  demet: { label: "demet", dim: "demet", base: 1, step: 0.5 },
  dilim: { label: "dilim", dim: "dilim", base: 1, step: 1 },
  tutam: { label: "tutam", dim: "tutam", base: 1, step: 1 },
};

export const UNIT_KEYS = Object.keys(UNITS) as UnitKey[];

export function isUnit(u: unknown): u is UnitKey {
  return typeof u === "string" && u in UNITS;
}

export function toBase(qty: number, unit: UnitKey): number {
  return qty * UNITS[unit].base;
}

export function convert(qty: number, from: UnitKey, to: UnitKey): number | null {
  if (UNITS[from].dim !== UNITS[to].dim) return null;
  return (qty * UNITS[from].base) / UNITS[to].base;
}

export function roundToStep(qty: number, unit: UnitKey): number {
  const step = UNITS[unit].step;
  const r = Math.round(qty / step) * step;
  // Çok küçük miktarlar sıfıra yuvarlanmasın.
  const v = r > 0 ? r : step;
  return Math.round(v * 1000) / 1000;
}

const FRACTIONS: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };

export function formatQty(qty: number, unit: UnitKey): string {
  const r = roundToStep(qty, unit);
  const whole = Math.floor(r);
  const frac = Math.round((r - whole) * 100) / 100;
  const fracStr = FRACTIONS[String(frac)];
  let num: string;
  if (fracStr && UNITS[unit].dim !== "kutle" && unit !== "ml" && unit !== "l") {
    num = whole > 0 ? `${whole}${fracStr}` : fracStr;
  } else {
    num = String(r).replace(".", ",");
  }
  return `${num} ${UNITS[unit].label}`;
}

/** Tarif miktarını porsiyona göre ölçekler. */
export function scaleQty(qty: number, fromServings: number, toServings: number): number {
  if (fromServings <= 0) return qty;
  return (qty * toServings) / fromServings;
}

/** Büyük miktarları okunaklı birime çevirir (1500 g -> 1,5 kg). */
export function prettyUnit(qty: number, unit: UnitKey): { qty: number; unit: UnitKey } {
  if (unit === "g" && qty >= 1000) return { qty: qty / 1000, unit: "kg" };
  if (unit === "ml" && qty >= 1000) return { qty: qty / 1000, unit: "l" };
  return { qty, unit };
}
