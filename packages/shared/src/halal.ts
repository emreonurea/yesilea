// Helal hassasiyeti kuralları: yasaklı ve "kontrol gerekli" malzemelerin taranması.
// Bu tarama yardımcıdır, dini hüküm vermez. Uyarlanan tarifler insan incelemesinden geçer.

import { containsTerm, normalize, type Term } from "./text";
import type { HalalStatus, Recipe } from "./types";

const T = (s: string, extra: Partial<Term> = {}): Term => ({ term: normalize(s), ...extra });
const EXACT: Partial<Term> = { suffixes: [""] };

/** Yemek kesinlikle içermemeli. Kısa ve başka anlama gelebilen sözcükler (rom, bira) dar eşleşir. */
export const FORBIDDEN: Term[] = [
  // Domuz ve türevleri
  T("domuz"), T("jambon"), T("pancetta"), T("guanciale"), T("bacon"), T("prosciutto"), T("chorizo"),
  T("lard"), T("lardon"), T("pork"), T("speck"), T("kielbasa"), T("jamon"), T("salchichon"),
  T("sobrasada"), T("lechon"), T("chicharron"), T("char siu"), T("domuz yagi"),
  // Alkol
  T("sarap", { stems: ["sarab"] }), T("bira", { suffixes: ["", "si", "nin", "yi", "ya", "da", "dan", "li", "lar"] }),
  T("rom", { suffixes: ["", "u", "lu", "un"] }), T("viski"), T("votka"), T("likor"), T("konyak"), T("brendi"),
  T("raki"), T("marsala"), T("mirin"), T("sake", EXACT), T("soju"), T("shaoxing"), T("kirsch"),
  T("calvados"), T("tekila"), T("tequila"), T("sherry"), T("wine"), T("beer"), T("whisky"), T("whiskey"),
  T("vodka"), T("liqueur"), T("cognac"), T("brandy"), T("gin", EXACT), T("cachaca"), T("pisco"), T("alkol"),
];

/** Kaynağı belirsiz olabilecek malzemeler: tarif reddedilmez, "kontrol gerekli" etiketlenir. */
export const CHECK: Term[] = [
  T("jelatin"), T("peynir mayasi"), T("sarap sirkesi"), T("alkolsuz bira"), T("vanilya ozutu"),
  T("vanilya ekstrakti"), T("marshmallow"), T("jole"), T("mortadella"), T("pepperoni"), T("hazir sos"),
  T("parmesan"), T("gelatin"),
];

/** "Kontrol gerekli" ifadeleri, yasaklı taramadan önce metinden çıkarılır (ör. "şarap sirkesi" yasaklı "şarap" sayılmasın). */
function stripCheckPhrases(text: string): string {
  let t = normalize(text);
  for (const p of ["sarap sirkesi", "alkolsuz bira", "alkolsuz", "alkol buharlas", "alkol icermeyen"]) {
    t = t.split(p).join(" ");
  }
  return t;
}

export interface HalalScan {
  forbidden: string[];
  check: string[];
}

export function scanText(text: string): HalalScan {
  const cleaned = stripCheckPhrases(text);
  const forbidden = FORBIDDEN.filter((t) => containsTerm(cleaned, t)).map((t) => t.term);
  const okGelatin = /agar|helal sertifikali/.test(normalize(text));
  const check = CHECK.filter((t) => containsTerm(text, t))
    .filter((t) => !(okGelatin && (t.term === "jelatin" || t.term === "gelatin")))
    .map((t) => t.term);
  return { forbidden, check };
}

export function scanRecipe(r: Pick<Recipe, "name_tr" | "ingredients" | "steps"> & { name_local?: string }): HalalScan {
  const parts = [r.name_tr, r.name_local ?? "", ...r.ingredients.map((i) => `${i.name} ${i.note ?? ""}`), ...r.steps];
  const all = parts.map(scanText);
  return {
    forbidden: [...new Set(all.flatMap((s) => s.forbidden))],
    check: [...new Set(all.flatMap((s) => s.check))],
  };
}

/** Taramaya göre helal durumunu belirler. Yasaklı varsa null döner (tarif reddedilmeli). */
export function halalStatusFor(scan: HalalScan, declared: HalalStatus): HalalStatus | null {
  if (scan.forbidden.length) return null;
  if (scan.check.length) return "kontrol gerekli";
  return declared === "uyarlanmış" ? "uyarlanmış" : declared === "kontrol gerekli" ? "kontrol gerekli" : "uygun";
}

export const HALAL_RULES_PROMPT = `HELAL KURALLARI (zorunlu):
- Domuz ve türevleri hiçbir tarifte olmaz: domuz eti, jambon, pancetta, guanciale, bacon, prosciutto, chorizo, domuz yağı (lard), domuz kaynaklı jelatin.
- Alkol hiçbir tarifte olmaz, pişirmede buharlaşsa bile: şarap, bira, rom, viski, votka, likör, konyak, Marsala, mirin, sake, alkollü vanilya özütü vb.
- Jelatin gerekiyorsa "agar-agar" ya da "helal sertifikalı jelatin" yaz.
- Geleneksel tarifte domuz ya da alkol varsa ve yemeğin özü bu değilse helal alternatifle uyarla (domuz yerine dana füme, şarap yerine üzüm suyu ve biraz sirke) ve halal_status = "uyarlanmış" yaz.
- Yemeğin özü domuz ya da alkol ise o yemeği hiç önerme, başka yemek seç.
- Kaynağı belirsiz malzeme (jelatin, bazı peynir mayaları, hazır soslar) varsa halal_status = "kontrol gerekli" yaz.`;
