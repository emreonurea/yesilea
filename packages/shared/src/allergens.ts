import { containsTerm, normalize, type Term } from "./text";
import type { IngredientLine } from "./types";

// AB'nin 14 alerjen listesi temel alınmıştır.
export type AllergenKey =
  | "gluten" | "sut" | "yumurta" | "yer_fistigi" | "agac_yemisleri" | "susam"
  | "balik" | "kabuklular" | "yumusakcalar" | "soya" | "kereviz" | "hardal"
  | "sulfit" | "aci_bakla";

export const ALLERGEN_LABELS: Record<AllergenKey, string> = {
  gluten: "Gluten",
  sut: "Süt",
  yumurta: "Yumurta",
  yer_fistigi: "Yer fıstığı",
  agac_yemisleri: "Ağaç yemişleri (fındık, ceviz, badem vb.)",
  susam: "Susam",
  balik: "Balık",
  kabuklular: "Kabuklu deniz ürünleri",
  yumusakcalar: "Yumuşakçalar (midye, kalamar vb.)",
  soya: "Soya",
  kereviz: "Kereviz",
  hardal: "Hardal",
  sulfit: "Sülfit",
  aci_bakla: "Acı bakla (lupin)",
};

export const ALLERGEN_KEYS = Object.keys(ALLERGEN_LABELS) as AllergenKey[];

const W = (s: string): Term => ({ term: normalize(s) });

/** Malzeme adlarından alerjen çıkarımı için anahtar sözcükler. Tam değildir; insan incelemesinin yerini tutmaz. */
const KEYWORDS: Record<AllergenKey, Term[]> = {
  gluten: ["un", "bugday", "bulgur", "irmik", "ekmek", "makarna", "eriste", "yufka", "galeta", "arpa",
    "cavdar", "kuskus", "sehriye", "simit", "lavas", "pide", "spagetti", "noodle", "bazlama", "tarhana",
    "kadayif", "baklava", "manti", "kruton", "soya sosu", "seitan", "panko", "tortilla", "milfoy", "bisküvi"].map(W),
  sut: ["sut", "yogurt", "peynir", "tereyagi", "krema", "kaymak", "ayran", "labne", "lor", "kasar", "suzme",
    "mozzarella", "parmesan", "ricotta", "mascarpone", "feta", "hellim", "ghee", "paneer", "kefir", "beşamel"].map(W),
  yumurta: ["yumurta", "mayonez"].map(W),
  yer_fistigi: ["yer fistigi", "fistik ezmesi", "yerfistigi"].map(W),
  agac_yemisleri: ["findik", "ceviz", "badem", "antep fistigi", "fistik", "kaju", "pekan", "makadamya",
    "kestane", "cam fistigi", "pecan"].map(W),
  susam: ["susam", "tahin", "simit", "tahina"].map(W),
  balik: ["balik", "hamsi", "somon", "ton baligi", "levrek", "cipura", "sardalya", "uskumru", "ancuez",
    "palamut", "lakerda", "morina", "balik sosu", "hamsi", "alabalik", "lufer", "barbunya baligi", "dashi"].map(W),
  kabuklular: ["karides", "yengec", "istakoz", "kerevit", "kabuklu"].map(W),
  yumusakcalar: ["midye", "kalamar", "ahtapot", "istiridye", "salyangoz", "supya", "deniz tarağı"].map(W),
  soya: ["soya", "tofu", "edamame", "miso", "tempeh", "soya sosu"].map(W),
  kereviz: ["kereviz"].map(W),
  hardal: ["hardal"].map(W),
  sulfit: ["sulfit", "kuru kayisi"].map(W),
  aci_bakla: ["aci bakla", "lupin"].map(W),
};

export function detectAllergens(ingredients: Pick<IngredientLine, "name">[]): AllergenKey[] {
  const found = new Set<AllergenKey>();
  for (const ing of ingredients) {
    // "yer fıstığı" hem yer fıstığı hem ağaç yemişi sayılmasın.
    const isPeanut = KEYWORDS.yer_fistigi.some((t) => containsTerm(ing.name, t));
    for (const key of ALLERGEN_KEYS) {
      if (key === "agac_yemisleri" && isPeanut) continue;
      if (KEYWORDS[key].some((t) => containsTerm(ing.name, t))) found.add(key);
    }
  }
  return ALLERGEN_KEYS.filter((k) => found.has(k));
}

/** Malzemelerden çıkan ama tarifte beyan edilmemiş alerjenler. */
export function missingAllergenTags(declared: AllergenKey[], ingredients: Pick<IngredientLine, "name">[]): AllergenKey[] {
  const d = new Set(declared);
  return detectAllergens(ingredients).filter((k) => !d.has(k));
}
