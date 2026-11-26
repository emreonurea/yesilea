import { AISLE_ORDER, guessAisle, type AisleKey } from "./aisles";
import { containsTerm, normalize } from "./text";
import { convert, prettyUnit, scaleQty, toBase, UNITS, type UnitKey } from "./units";
import type { PantryItem, Recipe, UnitPrice } from "./types";

export interface ShoppingItem {
  key: string;
  name: string;
  qty: number;
  unit: UnitKey;
  aisle: AisleKey;
  recipes: string[];
}

/** Market listesine hiç eklenmeyen temel girdiler. */
const SKIP = new Set(["su", "ilik su", "sicak su", "soguk su"]);

function sameIngredient(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || containsTerm(a, { term: nb }) || containsTerm(b, { term: na });
}

export function buildShoppingList(
  entries: { recipe: Recipe; servings: number }[],
  pantry: PantryItem[],
): ShoppingItem[] {
  const acc = new Map<string, ShoppingItem & { base: number }>();
  for (const { recipe, servings } of entries) {
    for (const ing of recipe.ingredients) {
      const n = normalize(ing.name);
      if (SKIP.has(n)) continue;
      const dim = UNITS[ing.unit].dim;
      const key = `${n}|${dim}`;
      const qty = scaleQty(ing.qty, recipe.servings, servings);
      const cur = acc.get(key);
      if (cur) {
        cur.base += toBase(qty, ing.unit);
        if (!cur.recipes.includes(recipe.name_tr)) cur.recipes.push(recipe.name_tr);
      } else {
        acc.set(key, {
          key, name: ing.name, qty: 0, unit: dim === "kutle" ? "g" : dim === "hacim" ? ing.unit : ing.unit,
          aisle: ing.aisle ?? guessAisle(ing.name), recipes: [recipe.name_tr], base: toBase(qty, ing.unit),
        });
      }
    }
  }

  const out: ShoppingItem[] = [];
  for (const item of acc.values()) {
    let base = item.base;
    const inPantry = pantry.filter((p) => sameIngredient(p.name, item.name));
    let covered = false;
    for (const p of inPantry) {
      // Miktarı girilmemiş malzeme "evde var, yeterli" sayılır.
      if (p.qty == null || p.unit == null) { covered = true; break; }
      if (UNITS[p.unit].dim === UNITS[item.unit].dim) base -= toBase(p.qty, p.unit);
    }
    if (covered || base <= 1e-9) continue;
    const q = base / UNITS[item.unit].base;
    const pretty = prettyUnit(q, item.unit);
    out.push({ key: item.key, name: item.name, qty: pretty.qty, unit: pretty.unit, aisle: item.aisle, recipes: item.recipes });
  }
  return out.sort((a, b) => AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle) || a.name.localeCompare(b.name, "tr"));
}

export function groupByAisle<T extends { aisle: AisleKey }>(items: T[]): { aisle: AisleKey; items: T[] }[] {
  return AISLE_ORDER.map((aisle) => ({ aisle, items: items.filter((i) => i.aisle === aisle) })).filter((g) => g.items.length);
}

export type CostLabel = "hesaplandı" | "kısmen tahmini" | "tahmini";

export interface CostEstimate {
  /** Fiyatı bilinen kalemlerin toplamı (TL). */
  total_try: number;
  priced: number;
  unpriced: string[];
  label: CostLabel;
}

/** Fiyatlar kullanıcının girdiği birim fiyatlardır; model fiyat uydurmaz. */
export function estimateCost(items: Pick<ShoppingItem, "name" | "qty" | "unit">[], prices: UnitPrice[]): CostEstimate {
  let total = 0;
  let priced = 0;
  const unpriced: string[] = [];
  for (const it of items) {
    const p = prices.find((pr) => normalize(pr.name) === normalize(it.name)) ?? prices.find((pr) => sameIngredient(pr.name, it.name));
    const q = p ? convert(it.qty, it.unit, p.unit) : null;
    if (p && q != null) {
      total += q * p.price_try;
      priced++;
    } else {
      unpriced.push(it.name);
    }
  }
  const label: CostLabel = unpriced.length === 0 ? "hesaplandı" : priced === 0 ? "tahmini" : "kısmen tahmini";
  return { total_try: Math.round(total * 100) / 100, priced, unpriced, label };
}

export function formatTry(v: number): string {
  return `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}
