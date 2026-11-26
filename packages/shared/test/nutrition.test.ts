import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTargets, dayTotal, parseNutrition, SAMPLE_RECIPES, validateBody } from "../src";

test("hedef hesabı: 30 yaş, 170 cm, 70 kg kadın, orta hareketli, korumak", () => {
  const t = computeTargets({ sex: "kadin", age: 30, height_cm: 170, weight_kg: 70, activity: "orta", goal: "koru" });
  // BMR = 700 + 1062.5 - 150 - 161 = 1451.5; TDEE = 2249.8
  assert.equal(t.bmr, 1452);
  assert.equal(t.kcal, 2250);
  assert.equal(t.bmi, 24.2);
  assert.equal(t.protein_g, 84);
  assert.equal(t.micros.demir_mg, 18);
});

test("güvenlik: zayıf BKİ'de kilo verme uygulanmaz, alt sınırın altına inilmez", () => {
  const thin = computeTargets({ sex: "kadin", age: 25, height_cm: 170, weight_kg: 50, activity: "hareketsiz", goal: "kilo_ver" });
  assert.ok(thin.notes.some((n) => n.includes("zayıf")));
  assert.ok(thin.kcal >= thin.tdee - 10);
  const small = computeTargets({ sex: "kadin", age: 70, height_cm: 150, weight_kg: 60, activity: "hareketsiz", goal: "kilo_ver" });
  assert.ok(small.kcal >= 1200);
  assert.ok(small.kcal >= small.bmr - 10);
});

test("vücut bilgisi doğrulama", () => {
  assert.equal(typeof validateBody({ sex: "erkek", age: 16, height_cm: 170, weight_kg: 60 }), "string");
  assert.equal(typeof validateBody({ sex: "erkek", age: 30, height_cm: 180, weight_kg: 80 }), "object");
});

test("besin değeri: tutarsız değer reddedilir, günlük toplam hesaplanır", () => {
  assert.equal(parseNutrition({ kcal: 900, protein_g: 5, karb_g: 5, yag_g: 5 }), undefined);
  const day = dayTotal(SAMPLE_RECIPES.slice(0, 3));
  assert.equal(day.missing, 0);
  assert.equal(day.total.kcal, 300 + 230 + 295);
});

import { FOODS, foodNutrition, searchFoods } from "../src";
test("yerel yiyecek veritabanı: arama ve porsiyon hesabı", () => {
  assert.ok(FOODS.length > 200);
  assert.equal(searchFoods("mercimek")[0].name, "Mercimek çorbası");
  assert.ok(searchFoods("cig kofte").some((f) => f.name === "Çiğ köfte dürüm"), "Türkçe karaktersiz arama");
  assert.ok(searchFoods("doner").length >= 3);
  const simit = FOODS.find((f) => f.name === "Simit")!;
  assert.deepEqual(foodNutrition(simit, 110), { kcal: 330, protein_g: 11, karb_g: 60.5, yag_g: 5 });
  assert.ok(FOODS.every((f) => f.portions.some((p) => p.g === 100)));
});
