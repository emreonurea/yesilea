import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildShoppingList, containsTerm, detectAllergens, estimateCost, formatQty, groupByAisle,
  SAMPLE_RECIPES, scanRecipe, scanText, validatePlan, validateRecipe, halalStatusFor,
} from "../src";

test("Türkçe ekli sözcük eşleşmesi", () => {
  assert.ok(containsTerm("şarabı ekleyin", { term: "sarap", stems: ["sarab"] }));
  assert.ok(!containsTerm("biraz tuz", { term: "bira", suffixes: ["", "si"] }));
});

test("helal: yasaklılar yakalanır, yanlış pozitif yok", () => {
  assert.deepEqual(scanText("200 g pancetta").forbidden, ["pancetta"]);
  assert.ok(scanText("Yarım su bardağı beyaz şarabı ekleyin").forbidden.includes("sarap"));
  assert.ok(scanText("1 yemek kaşığı mirin").forbidden.includes("mirin"));
  assert.ok(scanText("Domuz yağında kızartın").forbidden.length > 0);
  // Yanlış pozitif olmamalı
  for (const ok of ["biraz tuz ekleyin", "Roma domatesi", "Çin lahanası", "ham badem", "Rum usulü", "seri şekilde karıştırın", "Porto usulü"]) {
    assert.deepEqual(scanText(ok).forbidden, [], ok);
  }
  // Şarap sirkesi yasak değil, kontrol gerekli
  const s = scanText("2 yemek kaşığı şarap sirkesi");
  assert.deepEqual(s.forbidden, []);
  assert.ok(s.check.includes("sarap sirkesi"));
  // Agar ile jelatin uyarısı kalkar
  assert.deepEqual(scanText("jelatin yerine agar-agar").check, []);
  assert.ok(scanText("1 paket jelatin").check.includes("jelatin"));
});

test("helal durum: yasaklı varsa reddedilir", () => {
  assert.equal(halalStatusFor({ forbidden: ["bacon"], check: [] }, "uygun"), null);
  assert.equal(halalStatusFor({ forbidden: [], check: ["jelatin"] }, "uygun"), "kontrol gerekli");
  assert.equal(halalStatusFor({ forbidden: [], check: [] }, "uyarlanmış"), "uyarlanmış");
});

test("alerjen çıkarımı", () => {
  const a = detectAllergens([{ name: "un" }, { name: "tahin" }, { name: "yer fıstığı" }, { name: "beyaz peynir" }, { name: "unlu mamul değil: domates" }]);
  assert.deepEqual(a, ["gluten", "sut", "yer_fistigi", "susam"]);
  assert.ok(!detectAllergens([{ name: "yer fıstığı" }]).includes("agac_yemisleri"));
  assert.deepEqual(detectAllergens([{ name: "domates" }, { name: "soğan" }]), []);
});

test("birim gösterimi", () => {
  assert.equal(formatQty(0.5, "su_bardagi"), "½ su bardağı");
  assert.equal(formatQty(1.25, "yemek_kasigi"), "1½ yemek kaşığı");
  assert.equal(formatQty(333, "g"), "335 g");
});

test("örnek tariflerin hepsi doğrulamadan ve helal taramadan geçer", () => {
  for (const r of SAMPLE_RECIPES) {
    const c = validateRecipe(r, r.name_tr);
    assert.deepEqual(c.errors, [], r.name_tr);
    assert.deepEqual(c.warnings, [], r.name_tr);
    assert.deepEqual(scanRecipe(r).forbidden, [], r.name_tr);
  }
});

test("doğrulama hataları", () => {
  const bad = validateRecipe({ name_tr: "X", servings: 2, prep_min: 5, cook_min: 5, ingredients: [{ name: "un", qty: 0, unit: "g" }], steps: [] });
  assert.ok(bad.errors.some((e) => e.includes("miktarı")));
  assert.ok(bad.errors.some((e) => e.includes("adım")));
  const dup = validateRecipe({ name_tr: "Y", servings: 2, prep_min: 5, cook_min: 5,
    ingredients: [{ name: "Soğan", qty: 1, unit: "adet" }, { name: "soğan", qty: 1, unit: "adet" }, { name: "un", qty: 100, unit: "g" }],
    steps: ["Soğanı ve domatesi doğrayın."], allergens: [] });
  assert.ok(dup.warnings.some((w) => w.includes("2 kez")));
  assert.ok(dup.warnings.some((w) => w.includes("domates")));
  assert.ok(dup.warnings.some((w) => w.includes("gluten")));
  assert.deepEqual(dup.recipe?.allergens, ["gluten"]);
  const veg = validateRecipe({ name_tr: "Z", servings: 2, prep_min: 5, cook_min: 5, diet_tags: ["vegan"],
    ingredients: [{ name: "tavuk göğsü", qty: 200, unit: "g" }], steps: ["Pişirin."] });
  assert.ok(veg.errors.some((e) => e.includes("vejetaryen")));
  assert.equal(validatePlan({ days: [] }).plan, null);
});

test("market listesi: toplar, evdekini düşer, reyona göre gruplar", () => {
  const menemen = SAMPLE_RECIPES.find((r) => r.name_tr === "Menemen")!;
  const corba = SAMPLE_RECIPES.find((r) => r.name_tr === "Mercimek çorbası")!;
  const list = buildShoppingList(
    [{ recipe: menemen, servings: 4 }, { recipe: corba, servings: 4 }],
    [{ name: "yumurta", qty: 2, unit: "adet" }, { name: "tuz", qty: null, unit: null }],
  );
  const dom = list.find((i) => i.name === "domates")!;
  assert.equal(dom.qty, 6); // 3 adet x 2 kat
  assert.equal(list.find((i) => i.name === "yumurta")!.qty, 6); // 8 - 2
  assert.equal(list.find((i) => i.name === "tuz"), undefined);
  const zy = list.find((i) => i.name === "zeytinyağı")!;
  assert.equal(zy.unit, "yemek_kasigi");
  assert.equal(zy.qty, 7); // 4 + 3
  const groups = groupByAisle(list);
  assert.equal(groups[0].aisle, "sebze_meyve");
});

test("maliyet: yalnızca kullanıcı fiyatlarıyla", () => {
  const items = [{ name: "domates", qty: 1500, unit: "g" as const }, { name: "yumurta", qty: 6, unit: "adet" as const }];
  const c = estimateCost(items, [{ name: "Domates", unit: "kg", price_try: 40 }]);
  assert.equal(c.total_try, 60);
  assert.equal(c.label, "kısmen tahmini");
  assert.deepEqual(c.unpriced, ["yumurta"]);
  assert.equal(estimateCost(items, []).label, "tahmini");
});
