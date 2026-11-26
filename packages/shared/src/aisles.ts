import { containsTerm, normalize } from "./text";

export type AisleKey =
  | "sebze_meyve" | "et_tavuk_balik" | "sut_yumurta" | "kuru_gida" | "baharat_sos"
  | "firin" | "yag" | "dondurulmus" | "diger";

export const AISLE_LABELS: Record<AisleKey, string> = {
  sebze_meyve: "Sebze ve meyve",
  et_tavuk_balik: "Et, tavuk ve balık",
  sut_yumurta: "Süt ürünleri ve yumurta",
  kuru_gida: "Kuru gıda ve bakliyat",
  baharat_sos: "Baharat, salça ve sos",
  firin: "Fırın ve ekmek",
  yag: "Yağlar",
  dondurulmus: "Dondurulmuş",
  diger: "Diğer",
};

export const AISLE_ORDER = Object.keys(AISLE_LABELS) as AisleKey[];

export function isAisle(a: unknown): a is AisleKey {
  return typeof a === "string" && a in AISLE_LABELS;
}

const KW: [AisleKey, string[]][] = [
  ["yag", ["zeytinyagi", "aycicek yagi", "sivi yag", "misir yagi", "yag"]],
  ["sut_yumurta", ["sut", "yogurt", "peynir", "tereyagi", "krema", "kaymak", "ayran", "labne", "lor", "kasar", "yumurta", "suzme", "mozzarella", "parmesan", "feta", "hellim"]],
  ["et_tavuk_balik", ["kiyma", "dana", "kuzu", "tavuk", "hindi", "et", "but", "pirzola", "kofte", "balik", "hamsi", "somon", "levrek", "cipura", "karides", "midye", "sucuk", "pastirma", "kavurma", "ciger"]],
  ["baharat_sos", ["tuz", "karabiber", "pul biber", "kimyon", "nane", "kekik", "sumak", "tarcin", "salca", "sirke", "nar eksisi", "soya sosu", "ketcap", "hardal", "zerdecal", "yenibahar", "kori", "zencefil tozu", "toz biber", "isot", "bulyon", "maya", "kabartma tozu", "karbonat", "vanilin", "seker", "bal", "pekmez"]],
  ["firin", ["ekmek", "lavas", "pide", "yufka", "simit", "bazlama", "tortilla", "galeta"]],
  ["kuru_gida", ["pirinc", "bulgur", "mercimek", "nohut", "fasulye", "barbunya", "makarna", "sehriye", "eriste", "un", "irmik", "yulaf", "kuskus", "ceviz", "findik", "badem", "uzum", "kuru", "tahin", "konserve", "ton baligi", "misir nisastasi", "nisasta"]],
  ["dondurulmus", ["dondurulmus", "bezelye dondurulmus"]],
  ["sebze_meyve", ["domates", "biber", "sogan", "sarimsak", "patates", "havuc", "patlican", "kabak", "ispanak", "marul", "salatalik", "maydanoz", "dereotu", "roka", "limon", "elma", "muz", "portakal", "pirasa", "lahana", "karnabahar", "brokoli", "bezelye", "taze fasulye", "bamya", "enginar", "mantar", "turp", "kereviz", "pancar", "zencefil", "taze sogan", "yesillik", "avokado", "nar", "cilek", "armut", "seftali", "kayisi", "erik", "uzum taze", "misir"]],
];

export function guessAisle(name: string): AisleKey {
  for (const [aisle, words] of KW) {
    if (words.some((w) => containsTerm(name, { term: normalize(w) }))) return aisle;
  }
  return "diger";
}

/** Adımlarda geçip malzeme listesinde olmayan malzemeleri bulmak için sözlük. */
export const INGREDIENT_VOCAB: string[] = [...new Set(KW.flatMap(([, w]) => w))].filter(
  (w) => !["kuru", "yag", "et", "but", "dondurulmus", "konserve", "uzum taze", "bezelye dondurulmus"].includes(w),
);
