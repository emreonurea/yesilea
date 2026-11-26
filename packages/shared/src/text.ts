// Türkçe metin normalleştirme: küçük harf, aksan kaldırma, sözcüklere ayırma.

const MAP: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};

export function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (ch) => MAP[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(" ") : [];
}

/** Türkçe çekim ekleri (normalleştirilmiş). Kök + ek eşleşmesi için. */
export const TR_SUFFIXES = [
  "", "i", "si", "yi", "u", "su", "yu", "in", "nin", "yin", "un", "nun",
  "a", "ya", "e", "ye", "da", "de", "ta", "te", "dan", "den", "tan", "ten",
  "li", "lu", "la", "le", "yla", "yle", "lar", "ler", "lari", "leri",
  "ni", "nu", "nda", "nde", "ndan", "nden", "na", "ne",
];

export interface Term {
  /** Normalleştirilmiş ifade; birden fazla sözcük olabilir. */
  term: string;
  /** Son sözcüğe eklenebilecek ekler. Verilmezse TR_SUFFIXES. */
  suffixes?: string[];
  /** Yumuşamış kök (ör. sarap -> sarab). */
  stems?: string[];
}

/** Metinde ifadeyi sözcük sınırına ve Türkçe eklere dikkat ederek arar. */
export function containsTerm(text: string, t: Term): boolean {
  const toks = tokens(text);
  const parts = t.term.split(" ");
  const lastStems = [parts[parts.length - 1], ...(t.stems ?? [])];
  const suffixes = t.suffixes ?? TR_SUFFIXES;
  for (let i = 0; i + parts.length <= toks.length; i++) {
    let ok = true;
    for (let j = 0; j < parts.length - 1; j++) {
      if (toks[i + j] !== parts[j]) { ok = false; break; }
    }
    if (!ok) continue;
    const last = toks[i + parts.length - 1];
    if (lastStems.some((stem) => suffixes.some((suf) => last === stem + suf))) return true;
  }
  return false;
}
