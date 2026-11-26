// Geliştirme için örnek tarifler. Sunucu LLM_MOCK=1 ile çalıştığında Claude API yerine bunlar kullanılır,
// böylece uygulama API anahtarı olmadan denenebilir. Yayına girmeden önce incelenmelidir.

import type { MealSlot, Recipe } from "./types";
import type { Nutrition } from "./nutrition";

type R = Recipe & { slots: MealSlot[] };

const base = { country: "Türkiye", halal_status: "uygun" as const, substitutes: [] };

const RAW: R[] = [
  {
    ...base, slots: ["kahvalti"], name_tr: "Menemen", description: "Domates, biber ve yumurtayla klasik kahvaltı.",
    servings: 2, prep_min: 5, cook_min: 12, difficulty: "kolay", allergens: ["yumurta"], diet_tags: ["vejetaryen"],
    ingredients: [
      { name: "domates", qty: 3, unit: "adet" }, { name: "sivri biber", qty: 3, unit: "adet" },
      { name: "yumurta", qty: 4, unit: "adet" }, { name: "zeytinyağı", qty: 2, unit: "yemek_kasigi" },
      { name: "tuz", qty: 1, unit: "cay_kasigi" }, { name: "pul biber", qty: 0.5, unit: "cay_kasigi" },
    ],
    steps: ["Biberleri doğrayıp zeytinyağında 3 dakika kavurun.", "Domatesleri rendeleyip ekleyin, suyunu çekene kadar pişirin.",
      "Yumurtaları kırın, hafifçe karıştırarak 2-3 dakika pişirin.", "Tuz ve pul biber serpip sıcak servis edin."],
  },
  {
    ...base, slots: ["kahvalti"], name_tr: "Muzlu yulaf lapası", description: "Suyla pişen, sütsüz ve yumurtasız hızlı kahvaltı.",
    servings: 2, prep_min: 2, cook_min: 8, difficulty: "kolay", allergens: ["gluten"], diet_tags: ["vejetaryen", "vegan"],
    ingredients: [
      { name: "yulaf ezmesi", qty: 1, unit: "su_bardagi" }, { name: "muz", qty: 1, unit: "adet" },
      { name: "tarçın", qty: 0.5, unit: "cay_kasigi" }, { name: "pekmez", qty: 1, unit: "yemek_kasigi" },
    ],
    steps: ["Yulafı 2 su bardağı suyla tencereye alın.", "Kısık ateşte karıştırarak 6-8 dakika pişirin.",
      "Dilimlenmiş muz, tarçın ve pekmezle servis edin."],
  },
  {
    ...base, slots: ["kahvalti"], name_tr: "Peynirli omlet", description: "Beyaz peynir ve maydanozlu omlet.",
    servings: 2, prep_min: 5, cook_min: 6, difficulty: "kolay", allergens: ["yumurta", "sut"], diet_tags: ["vejetaryen"],
    ingredients: [
      { name: "yumurta", qty: 4, unit: "adet" }, { name: "beyaz peynir", qty: 80, unit: "g" },
      { name: "maydanoz", qty: 0.25, unit: "demet" }, { name: "tereyağı", qty: 1, unit: "yemek_kasigi" },
    ],
    steps: ["Yumurtaları çırpın, ufalanmış peynir ve kıyılmış maydanozu ekleyin.", "Tereyağını tavada eritin.",
      "Karışımı dökün, kısık ateşte iki yüzünü pişirin."],
  },
  {
    ...base, slots: ["kahvalti"], name_tr: "Zeytinli kahvaltı tabağı", description: "Domates, salatalık, zeytin ve ekmekle hafif tabak.",
    servings: 2, prep_min: 10, cook_min: 0, difficulty: "kolay", allergens: ["gluten"], diet_tags: ["vejetaryen", "vegan"],
    ingredients: [
      { name: "domates", qty: 2, unit: "adet" }, { name: "salatalık", qty: 1, unit: "adet" },
      { name: "siyah zeytin", qty: 100, unit: "g" }, { name: "ekmek", qty: 4, unit: "dilim" },
      { name: "zeytinyağı", qty: 1, unit: "yemek_kasigi" }, { name: "kekik", qty: 1, unit: "tutam" },
    ],
    steps: ["Domates ve salatalığı dilimleyin.", "Zeytinlerle tabağa dizin, zeytinyağı ve kekik gezdirin.", "Ekmekle servis edin."],
  },
  {
    ...base, slots: ["ogle", "aksam"], name_tr: "Mercimek çorbası", description: "Kırmızı mercimekle doyurucu çorba.",
    servings: 4, prep_min: 10, cook_min: 30, difficulty: "kolay", allergens: [], diet_tags: ["vejetaryen", "vegan"],
    ingredients: [
      { name: "kırmızı mercimek", qty: 1.5, unit: "su_bardagi" }, { name: "kuru soğan", qty: 1, unit: "adet" },
      { name: "havuç", qty: 1, unit: "adet" }, { name: "patates", qty: 1, unit: "adet" },
      { name: "zeytinyağı", qty: 3, unit: "yemek_kasigi" }, { name: "domates salçası", qty: 1, unit: "yemek_kasigi" },
      { name: "kimyon", qty: 1, unit: "cay_kasigi" }, { name: "tuz", qty: 1, unit: "tatli_kasigi" }, { name: "limon", qty: 1, unit: "adet" },
    ],
    steps: ["Soğan, havuç ve patatesi doğrayıp zeytinyağında kavurun.", "Salçayı ekleyip 1 dakika çevirin.",
      "Yıkanmış mercimeği ve 7 su bardağı sıcak suyu ekleyin, 25 dakika pişirin.",
      "Blenderdan geçirin, tuz ve kimyonu ekleyin.", "Limonla servis edin."],
  },
  {
    ...base, slots: ["ogle", "aksam"], name_tr: "Zeytinyağlı kuru fasulye", description: "Etsiz, zeytinyağlı kuru fasulye.",
    servings: 4, prep_min: 15, cook_min: 60, difficulty: "orta", allergens: [], diet_tags: ["vejetaryen", "vegan"],
    ingredients: [
      { name: "kuru fasulye", qty: 2, unit: "su_bardagi", note: "bir gece önceden ıslatılmış" },
      { name: "kuru soğan", qty: 1, unit: "adet" }, { name: "domates salçası", qty: 1, unit: "yemek_kasigi" },
      { name: "zeytinyağı", qty: 4, unit: "yemek_kasigi" }, { name: "tuz", qty: 1, unit: "tatli_kasigi" }, { name: "pul biber", qty: 1, unit: "cay_kasigi" },
    ],
    steps: ["Islatılmış fasulyeyi haşlayıp süzün.", "Soğanı zeytinyağında kavurun, salçayı ekleyin.",
      "Fasulyeyi ve üzerini geçecek kadar sıcak su ekleyin.", "Kısık ateşte 45-60 dakika, fasulyeler yumuşayana kadar pişirin.", "Tuz ve pul biberle tatlandırın."],
  },
  {
    ...base, slots: ["ogle", "aksam"], name_tr: "Tavuk sote", description: "Biberli, domatesli tavuk sote.",
    servings: 4, prep_min: 15, cook_min: 25, difficulty: "kolay", allergens: [], diet_tags: [],
    ingredients: [
      { name: "tavuk göğsü", qty: 600, unit: "g" }, { name: "kuru soğan", qty: 1, unit: "adet" },
      { name: "yeşil biber", qty: 3, unit: "adet" }, { name: "domates", qty: 2, unit: "adet" },
      { name: "sıvı yağ", qty: 3, unit: "yemek_kasigi" }, { name: "tuz", qty: 1, unit: "tatli_kasigi" }, { name: "karabiber", qty: 0.5, unit: "cay_kasigi" },
    ],
    steps: ["Tavuğu kuşbaşı doğrayın, yağda suyunu salıp çekene kadar pişirin.", "Soğan ve biberi ekleyip 5 dakika kavurun.",
      "Doğranmış domatesi ekleyin, 10 dakika pişirin.", "Tuz ve karabiberle servis edin."],
  },
  {
    ...base, slots: ["aksam"], name_tr: "Karnıyarık", description: "Kıymalı patlıcan yemeği.",
    servings: 4, prep_min: 20, cook_min: 40, difficulty: "orta", allergens: [], diet_tags: [],
    ingredients: [
      { name: "patlıcan", qty: 4, unit: "adet" }, { name: "dana kıyma", qty: 300, unit: "g" },
      { name: "kuru soğan", qty: 1, unit: "adet" }, { name: "domates", qty: 2, unit: "adet" },
      { name: "sivri biber", qty: 4, unit: "adet" }, { name: "domates salçası", qty: 1, unit: "yemek_kasigi" },
      { name: "sıvı yağ", qty: 0.5, unit: "su_bardagi" }, { name: "tuz", qty: 1, unit: "tatli_kasigi" },
    ],
    steps: ["Patlıcanları alacalı soyup yağda kızartın.", "Kıymayı soğanla kavurun, doğranmış domatesi ekleyin.",
      "Patlıcanları ortadan yarıp kıymalı harcı doldurun, üzerine biber koyun.",
      "Salçayı 1 su bardağı suyla açıp tepsiye dökün.", "180°C fırında 25-30 dakika pişirin."],
  },
  {
    ...base, slots: ["ogle", "aksam"], name_tr: "Zeytinyağlı taze fasulye", description: "Soğuk ya da ılık yenen zeytinyağlı.",
    servings: 4, prep_min: 15, cook_min: 40, difficulty: "kolay", allergens: [], diet_tags: ["vejetaryen", "vegan"],
    ingredients: [
      { name: "taze fasulye", qty: 750, unit: "g" }, { name: "kuru soğan", qty: 1, unit: "adet" },
      { name: "domates", qty: 2, unit: "adet" }, { name: "zeytinyağı", qty: 0.5, unit: "cay_bardagi" },
      { name: "şeker", qty: 1, unit: "cay_kasigi" }, { name: "tuz", qty: 1, unit: "tatli_kasigi" },
    ],
    steps: ["Fasulyeleri ayıklayıp doğrayın.", "Soğanı zeytinyağında hafifçe kavurun.",
      "Fasulye, rendelenmiş domates, şeker ve tuzu ekleyin.", "Yarım su bardağı suyla kapağı kapalı, kısık ateşte 35-40 dakika pişirin."],
  },
  {
    ...base, slots: ["ogle", "aksam"], name_tr: "Bulgur pilavı", description: "Domatesli, biberli bulgur pilavı.",
    servings: 4, prep_min: 10, cook_min: 20, difficulty: "kolay", allergens: ["gluten"], diet_tags: ["vejetaryen", "vegan"],
    ingredients: [
      { name: "pilavlık bulgur", qty: 2, unit: "su_bardagi" }, { name: "kuru soğan", qty: 1, unit: "adet" },
      { name: "yeşil biber", qty: 2, unit: "adet" }, { name: "domates salçası", qty: 1, unit: "yemek_kasigi" },
      { name: "zeytinyağı", qty: 3, unit: "yemek_kasigi" }, { name: "tuz", qty: 1, unit: "tatli_kasigi" },
    ],
    steps: ["Soğan ve biberi zeytinyağında kavurun.", "Salçayı ekleyip çevirin, bulguru ekleyin.",
      "3 su bardağı sıcak su ve tuzu ekleyin.", "Suyunu çekene kadar kısık ateşte 15 dakika pişirin, 10 dakika demlendirin."],
  },
  {
    ...base, slots: ["aksam"], name_tr: "Fırında tavuklu patates", description: "Tek tepside tavuk baget ve patates.",
    servings: 4, prep_min: 15, cook_min: 50, difficulty: "kolay", allergens: [], diet_tags: [],
    ingredients: [
      { name: "tavuk baget", qty: 8, unit: "adet" }, { name: "patates", qty: 5, unit: "adet" },
      { name: "kuru soğan", qty: 1, unit: "adet" }, { name: "biber salçası", qty: 1, unit: "yemek_kasigi" },
      { name: "zeytinyağı", qty: 4, unit: "yemek_kasigi" }, { name: "kekik", qty: 1, unit: "cay_kasigi" }, { name: "tuz", qty: 1, unit: "tatli_kasigi" },
    ],
    steps: ["Patates ve soğanı iri doğrayın.", "Salça, zeytinyağı, kekik ve tuzu karıştırıp tavuk ve sebzelere sürün.",
      "Tepsiye yayın, 200°C fırında 45-50 dakika pişirin."],
  },
  {
    ...base, slots: ["ogle", "aksam"], name_tr: "Ispanaklı yumurta", description: "Soğanlı ıspanak üzerinde yumurta.",
    servings: 2, prep_min: 10, cook_min: 12, difficulty: "kolay", allergens: ["yumurta"], diet_tags: ["vejetaryen"],
    ingredients: [
      { name: "ıspanak", qty: 500, unit: "g" }, { name: "kuru soğan", qty: 1, unit: "adet" },
      { name: "yumurta", qty: 3, unit: "adet" }, { name: "zeytinyağı", qty: 2, unit: "yemek_kasigi" }, { name: "tuz", qty: 1, unit: "cay_kasigi" },
    ],
    steps: ["Soğanı zeytinyağında kavurun.", "Doğranmış ıspanağı ekleyip söndürün.", "Yumurtaları üzerine kırın, kapağı kapalı 4-5 dakika pişirin."],
  },
  {
    ...base, slots: ["aksam"], name_tr: "Etli nohut", description: "Kuşbaşı etli nohut yemeği.",
    servings: 4, prep_min: 15, cook_min: 70, difficulty: "orta", allergens: [], diet_tags: [],
    ingredients: [
      { name: "nohut", qty: 2, unit: "su_bardagi", note: "bir gece önceden ıslatılmış" }, { name: "kuşbaşı dana eti", qty: 300, unit: "g" },
      { name: "kuru soğan", qty: 1, unit: "adet" }, { name: "domates salçası", qty: 1, unit: "yemek_kasigi" },
      { name: "sıvı yağ", qty: 3, unit: "yemek_kasigi" }, { name: "tuz", qty: 1, unit: "tatli_kasigi" },
    ],
    steps: ["Eti yağda suyunu çekene kadar kavurun.", "Soğanı ekleyip pembeleştirin, salçayı ekleyin.",
      "Nohutu ve üzerini geçecek kadar sıcak su ekleyin.", "Kısık ateşte 60 dakika pişirin, tuzunu ayarlayın."],
  },
  {
    ...base, slots: ["ogle", "aksam"], name_tr: "Mantar sote", description: "Soğanlı, kekikli mantar sote.",
    servings: 2, prep_min: 10, cook_min: 12, difficulty: "kolay", allergens: [], diet_tags: ["vejetaryen", "vegan"],
    ingredients: [
      { name: "kültür mantarı", qty: 400, unit: "g" }, { name: "kuru soğan", qty: 1, unit: "adet" },
      { name: "sarımsak", qty: 2, unit: "dis" }, { name: "zeytinyağı", qty: 2, unit: "yemek_kasigi" },
      { name: "kekik", qty: 1, unit: "cay_kasigi" }, { name: "tuz", qty: 1, unit: "cay_kasigi" },
    ],
    steps: ["Soğanı zeytinyağında kavurun, sarımsağı ekleyin.", "Dilimlenmiş mantarı ekleyip suyunu çekene kadar pişirin.", "Kekik ve tuzla servis edin."],
  },
  {
    ...base, slots: ["aksam"], name_tr: "Izgara köfte", description: "Tavada pişen dana köfte.",
    servings: 4, prep_min: 20, cook_min: 15, difficulty: "kolay", allergens: ["gluten"], diet_tags: [],
    ingredients: [
      { name: "dana kıyma", qty: 500, unit: "g" }, { name: "kuru soğan", qty: 1, unit: "adet" },
      { name: "galeta unu", qty: 3, unit: "yemek_kasigi" }, { name: "kimyon", qty: 1, unit: "cay_kasigi" },
      { name: "tuz", qty: 1, unit: "tatli_kasigi" }, { name: "karabiber", qty: 0.5, unit: "cay_kasigi" },
    ],
    steps: ["Soğanı rendeleyip suyunu sıkın.", "Tüm malzemeleri 5 dakika yoğurun, 15 dakika dinlendirin.",
      "Şekil verip kızgın tavada her iki yüzünü 5-6 dakika pişirin."],
  },
  {
    ...base, slots: ["ogle", "aksam"], name_tr: "Sebzeli makarna", description: "Kabak ve biberli domates soslu makarna.",
    servings: 4, prep_min: 10, cook_min: 20, difficulty: "kolay", allergens: ["gluten"], diet_tags: ["vejetaryen", "vegan"],
    ingredients: [
      { name: "makarna", qty: 500, unit: "g" }, { name: "kabak", qty: 2, unit: "adet" },
      { name: "kırmızı biber", qty: 1, unit: "adet" }, { name: "domates", qty: 3, unit: "adet" },
      { name: "sarımsak", qty: 2, unit: "dis" }, { name: "zeytinyağı", qty: 3, unit: "yemek_kasigi" }, { name: "tuz", qty: 1, unit: "tatli_kasigi" },
    ],
    steps: ["Makarnayı tuzlu suda haşlayıp süzün.", "Sarımsak, kabak ve biberi zeytinyağında soteleyin.",
      "Rendelenmiş domatesi ekleyip 8 dakika pişirin.", "Makarnayı sosla karıştırın."],
  },
];

// Porsiyon başına yaklaşık besin değerleri (elle tahmin edildi, doğrulanmadı).
const NUTRITION: Record<string, Nutrition> = {
  "Menemen": { kcal: 300, protein_g: 14, karb_g: 10, yag_g: 23, micros: { lif_g: 3, sodyum_mg: 950, demir_mg: 2.2, kalsiyum_mg: 70, potasyum_mg: 650, magnezyum_mg: 35, c_vit_mg: 60, d_vit_ug: 2.0, b12_ug: 1.0 } },
  "Muzlu yulaf lapası": { kcal: 230, protein_g: 6, karb_g: 44, yag_g: 3, micros: { lif_g: 5, sodyum_mg: 5, demir_mg: 2.5, kalsiyum_mg: 40, potasyum_mg: 350, magnezyum_mg: 70, c_vit_mg: 5, d_vit_ug: 0, b12_ug: 0 } },
  "Peynirli omlet": { kcal: 295, protein_g: 20, karb_g: 2, yag_g: 23, micros: { lif_g: 0.5, sodyum_mg: 750, demir_mg: 2, kalsiyum_mg: 250, potasyum_mg: 200, magnezyum_mg: 20, c_vit_mg: 10, d_vit_ug: 2.2, b12_ug: 1.4 } },
  "Zeytinli kahvaltı tabağı": { kcal: 375, protein_g: 9, karb_g: 45, yag_g: 18, micros: { lif_g: 6, sodyum_mg: 1100, demir_mg: 2.5, kalsiyum_mg: 90, potasyum_mg: 450, magnezyum_mg: 50, c_vit_mg: 20, d_vit_ug: 0, b12_ug: 0 } },
  "Mercimek çorbası": { kcal: 375, protein_g: 17, karb_g: 52, yag_g: 11, micros: { lif_g: 9, sodyum_mg: 700, demir_mg: 5, kalsiyum_mg: 55, potasyum_mg: 850, magnezyum_mg: 75, c_vit_mg: 15, d_vit_ug: 0, b12_ug: 0 } },
  "Zeytinyağlı kuru fasulye": { kcal: 445, protein_g: 20, karb_g: 58, yag_g: 15, micros: { lif_g: 14, sodyum_mg: 650, demir_mg: 6, kalsiyum_mg: 130, potasyum_mg: 1250, magnezyum_mg: 140, c_vit_mg: 5, d_vit_ug: 0, b12_ug: 0 } },
  "Tavuk sote": { kcal: 360, protein_g: 47, karb_g: 9, yag_g: 15, micros: { lif_g: 2, sodyum_mg: 650, demir_mg: 1.5, kalsiyum_mg: 30, potasyum_mg: 750, magnezyum_mg: 50, c_vit_mg: 50, d_vit_ug: 0.2, b12_ug: 0.5 } },
  "Karnıyarık": { kcal: 500, protein_g: 19, karb_g: 20, yag_g: 38, micros: { lif_g: 8, sodyum_mg: 750, demir_mg: 2.5, kalsiyum_mg: 50, potasyum_mg: 1000, magnezyum_mg: 50, c_vit_mg: 40, d_vit_ug: 0.1, b12_ug: 1.5 } },
  "Zeytinyağlı taze fasulye": { kcal: 180, protein_g: 4, karb_g: 16, yag_g: 11, micros: { lif_g: 6, sodyum_mg: 600, demir_mg: 1.8, kalsiyum_mg: 75, potasyum_mg: 450, magnezyum_mg: 45, c_vit_mg: 25, d_vit_ug: 0, b12_ug: 0 } },
  "Bulgur pilavı": { kcal: 400, protein_g: 10, karb_g: 66, yag_g: 11, micros: { lif_g: 11, sodyum_mg: 650, demir_mg: 2.2, kalsiyum_mg: 35, potasyum_mg: 350, magnezyum_mg: 120, c_vit_mg: 15, d_vit_ug: 0, b12_ug: 0 } },
  "Fırında tavuklu patates": { kcal: 580, protein_g: 37, karb_g: 36, yag_g: 32, micros: { lif_g: 4, sodyum_mg: 750, demir_mg: 2.5, kalsiyum_mg: 35, potasyum_mg: 1100, magnezyum_mg: 65, c_vit_mg: 25, d_vit_ug: 0.3, b12_ug: 0.6 } },
  "Ispanaklı yumurta": { kcal: 320, protein_g: 15, karb_g: 10, yag_g: 24, micros: { lif_g: 6, sodyum_mg: 600, demir_mg: 7, kalsiyum_mg: 270, potasyum_mg: 1450, magnezyum_mg: 200, c_vit_mg: 70, d_vit_ug: 1.6, b12_ug: 0.7 } },
  "Etli nohut": { kcal: 565, protein_g: 34, karb_g: 55, yag_g: 23, micros: { lif_g: 15, sodyum_mg: 700, demir_mg: 6, kalsiyum_mg: 100, potasyum_mg: 900, magnezyum_mg: 110, c_vit_mg: 5, d_vit_ug: 0.1, b12_ug: 1.6 } },
  "Mantar sote": { kcal: 200, protein_g: 7, karb_g: 9, yag_g: 15, micros: { lif_g: 3, sodyum_mg: 500, demir_mg: 1.2, kalsiyum_mg: 15, potasyum_mg: 750, magnezyum_mg: 25, c_vit_mg: 8, d_vit_ug: 0.4, b12_ug: 0.1 } },
  "Izgara köfte": { kcal: 345, protein_g: 26, karb_g: 7, yag_g: 24, micros: { lif_g: 0.7, sodyum_mg: 850, demir_mg: 3.2, kalsiyum_mg: 30, potasyum_mg: 450, magnezyum_mg: 30, c_vit_mg: 3, d_vit_ug: 0.2, b12_ug: 3 } },
  "Sebzeli makarna": { kcal: 580, protein_g: 17, karb_g: 100, yag_g: 12, micros: { lif_g: 7, sodyum_mg: 600, demir_mg: 2.5, kalsiyum_mg: 50, potasyum_mg: 650, magnezyum_mg: 75, c_vit_mg: 60, d_vit_ug: 0, b12_ug: 0 } },
};

export const SAMPLE_RECIPES: R[] = RAW.map((r) => ({ ...r, nutrition: NUTRITION[r.name_tr] }));
