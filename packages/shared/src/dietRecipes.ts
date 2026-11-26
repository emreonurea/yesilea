// Diyet yemekleri kütüphanesi: düşük kalorili / yüksek proteinli ev yemekleri.
// Besin değerleri porsiyon başına yaklaşıktır (elle hesaplandı, doğrulanmadı). Yayından önce incelenmeli.

import type { MealSlot, Recipe } from "./types";

type D = Recipe & { id: string; slots: MealSlot[] };
const base = { country: "Türkiye", halal_status: "uygun" as const, review_status: "taslak" as const };
const m = (lif_g: number, sodyum_mg: number, demir_mg: number, kalsiyum_mg: number, potasyum_mg: number, magnezyum_mg: number, c_vit_mg: number, d_vit_ug: number, b12_ug: number) =>
  ({ lif_g, sodyum_mg, demir_mg, kalsiyum_mg, potasyum_mg, magnezyum_mg, c_vit_mg, d_vit_ug, b12_ug });

export const DIET_RECIPES: D[] = [
  {
    ...base, id: "diyet-tavuk-salata", slots: ["ogle", "aksam"], name_tr: "Izgara tavuk salatası", description: "Bol yeşillikli, yüksek proteinli doyurucu salata.",
    servings: 2, prep_min: 15, cook_min: 15, difficulty: "kolay", allergens: [], diet_tags: [],
    ingredients: [
      { name: "tavuk göğsü", qty: 300, unit: "g" }, { name: "marul", qty: 150, unit: "g" }, { name: "domates", qty: 2, unit: "adet" },
      { name: "salatalık", qty: 1, unit: "adet" }, { name: "zeytinyağı", qty: 1, unit: "yemek_kasigi" }, { name: "limon", qty: 1, unit: "adet" }, { name: "tuz", qty: 1, unit: "cay_kasigi" },
    ],
    steps: ["Tavuğu ızgarada her yüzü 6-7 dakika pişirip dilimleyin.", "Marul, domates ve salatalığı doğrayın.", "Zeytinyağı, limon suyu ve tuzla karıştırıp tavuğu üzerine dizin."],
    nutrition: { kcal: 280, protein_g: 35, karb_g: 9, yag_g: 11, micros: m(3, 650, 1.5, 50, 900, 55, 35, 0.2, 0.4) },
  },
  {
    ...base, id: "diyet-somon-sebze", slots: ["aksam"], name_tr: "Fırında sebzeli somon", description: "Tek tepside somon, brokoli ve kabak.",
    servings: 2, prep_min: 10, cook_min: 20, difficulty: "kolay", allergens: ["balik"], diet_tags: [],
    ingredients: [
      { name: "somon", qty: 300, unit: "g" }, { name: "brokoli", qty: 200, unit: "g" }, { name: "kabak", qty: 1, unit: "adet" },
      { name: "zeytinyağı", qty: 1, unit: "yemek_kasigi" }, { name: "limon", qty: 1, unit: "adet" }, { name: "tuz", qty: 1, unit: "cay_kasigi" }, { name: "karabiber", qty: 1, unit: "tutam" },
    ],
    steps: ["Fırını 200°C'ye ısıtın.", "Brokoli ve kabağı doğrayıp tepsiye yayın, somonu ortalarına koyun.", "Zeytinyağı, tuz ve karabiber gezdirip 20 dakika pişirin.", "Limonla servis edin."],
    nutrition: { kcal: 420, protein_g: 34, karb_g: 10, yag_g: 27, micros: m(4, 650, 1.5, 70, 1100, 65, 110, 14, 4.5) },
  },
  {
    ...base, id: "diyet-yulaf-kase", slots: ["kahvalti"], name_tr: "Çilekli yoğurt ve yulaf kasesi", description: "Süzme yoğurt, yulaf, çilek ve cevizle protein ağırlıklı kahvaltı.",
    servings: 2, prep_min: 5, cook_min: 0, difficulty: "kolay", allergens: ["gluten", "sut", "agac_yemisleri"], diet_tags: ["vejetaryen"],
    ingredients: [
      { name: "süzme yoğurt", qty: 300, unit: "g" }, { name: "yulaf ezmesi", qty: 0.5, unit: "su_bardagi" }, { name: "çilek", qty: 150, unit: "g" },
      { name: "ceviz içi", qty: 20, unit: "g" }, { name: "tarçın", qty: 1, unit: "tutam" },
    ],
    steps: ["Yoğurdu kaselere paylaştırın.", "Yulafı, doğranmış çileği ve ceviz içini üzerine ekleyin.", "Tarçın serpip servis edin."],
    nutrition: { kcal: 310, protein_g: 17, karb_g: 26, yag_g: 15, micros: m(4, 60, 1.3, 180, 400, 70, 45, 0, 0.6) },
  },
  {
    ...base, id: "diyet-sebzeli-omlet", slots: ["kahvalti", "aksam"], name_tr: "Ispanaklı mantarlı omlet", description: "Az yağla, bol sebzeyle omlet.",
    servings: 2, prep_min: 5, cook_min: 8, difficulty: "kolay", allergens: ["yumurta"], diet_tags: ["vejetaryen"],
    ingredients: [
      { name: "yumurta", qty: 4, unit: "adet" }, { name: "ıspanak", qty: 100, unit: "g" }, { name: "kültür mantarı", qty: 100, unit: "g" },
      { name: "domates", qty: 1, unit: "adet" }, { name: "zeytinyağı", qty: 1, unit: "tatli_kasigi" }, { name: "tuz", qty: 1, unit: "tutam" },
    ],
    steps: ["Mantarı ve ıspanağı zeytinyağında 3 dakika soteleyin.", "Çırpılmış yumurtayı ve doğranmış domatesi ekleyin.", "Kapağı kapalı, kısık ateşte 4-5 dakika pişirin."],
    nutrition: { kcal: 210, protein_g: 15, karb_g: 5, yag_g: 14, micros: m(2, 400, 2.8, 90, 600, 50, 20, 2.2, 1.1) },
  },
  {
    ...base, id: "diyet-mercimek-salata", slots: ["ogle"], name_tr: "Yeşil mercimek salatası", description: "Lif ve bitkisel protein açısından zengin salata.",
    servings: 4, prep_min: 15, cook_min: 20, difficulty: "kolay", allergens: [], diet_tags: ["vejetaryen", "vegan"],
    ingredients: [
      { name: "yeşil mercimek", qty: 1, unit: "su_bardagi" }, { name: "domates", qty: 2, unit: "adet" }, { name: "salatalık", qty: 1, unit: "adet" },
      { name: "kırmızı soğan", qty: 1, unit: "adet" }, { name: "maydanoz", qty: 0.5, unit: "demet" }, { name: "zeytinyağı", qty: 2, unit: "yemek_kasigi" },
      { name: "limon", qty: 1, unit: "adet" }, { name: "tuz", qty: 1, unit: "cay_kasigi" },
    ],
    steps: ["Mercimeği 20 dakika haşlayıp süzün ve soğutun.", "Domates, salatalık, soğan ve maydanozu ince doğrayın.", "Hepsini zeytinyağı, limon ve tuzla karıştırın."],
    nutrition: { kcal: 245, protein_g: 11, karb_g: 30, yag_g: 8, micros: m(9, 500, 3.5, 45, 600, 55, 30, 0, 0) },
  },
  {
    ...base, id: "diyet-tavuk-sebze-sote", slots: ["ogle", "aksam"], name_tr: "Tavuklu sebze sote", description: "Az yağlı, yüksek proteinli hızlı akşam yemeği.",
    servings: 4, prep_min: 15, cook_min: 16, difficulty: "kolay", allergens: [], diet_tags: [],
    ingredients: [
      { name: "tavuk göğsü", qty: 500, unit: "g" }, { name: "brokoli", qty: 200, unit: "g" }, { name: "havuç", qty: 2, unit: "adet" },
      { name: "kırmızı biber", qty: 1, unit: "adet" }, { name: "sarımsak", qty: 2, unit: "dis" }, { name: "zeytinyağı", qty: 1, unit: "yemek_kasigi" },
      { name: "tuz", qty: 1, unit: "cay_kasigi" }, { name: "karabiber", qty: 1, unit: "tutam" },
    ],
    steps: ["Tavuğu kuşbaşı doğrayıp zeytinyağında 8 dakika soteleyin.", "Doğranmış havuç, biber, brokoli ve sarımsağı ekleyin.", "Sebzeler diriliğini korurken 7-8 dakika daha pişirin, tuz ve karabiber ekleyin."],
    nutrition: { kcal: 225, protein_g: 30, karb_g: 9, yag_g: 7, micros: m(3, 550, 1.3, 45, 800, 50, 75, 0.1, 0.3) },
  },
  {
    ...base, id: "diyet-firin-kofte", slots: ["aksam"], name_tr: "Fırında sebzeli köfte", description: "Kızartmadan, fırında sebzeyle pişen köfte.",
    servings: 4, prep_min: 20, cook_min: 30, difficulty: "kolay", allergens: ["yumurta"], diet_tags: [],
    ingredients: [
      { name: "az yağlı dana kıyma", qty: 400, unit: "g" }, { name: "kuru soğan", qty: 1, unit: "adet" }, { name: "yumurta", qty: 1, unit: "adet" },
      { name: "kabak", qty: 2, unit: "adet" }, { name: "domates", qty: 2, unit: "adet" }, { name: "kimyon", qty: 1, unit: "cay_kasigi" }, { name: "tuz", qty: 1, unit: "cay_kasigi" },
    ],
    steps: ["Kıymayı rendelenmiş soğan, yumurta, kimyon ve tuzla yoğurup küçük toplar yapın.", "Kabak ve domatesi doğrayıp tepsiye toplarla birlikte dizin.", "200°C fırında 30 dakika pişirin."],
    nutrition: { kcal: 225, protein_g: 23, karb_g: 8, yag_g: 11, micros: m(2.5, 650, 2.8, 40, 750, 40, 25, 0.3, 2.2) },
  },
  {
    ...base, id: "diyet-kinoa-salata", slots: ["ogle"], name_tr: "Nohutlu kinoa salatası", description: "Doyurucu, bitkisel proteinli salata.",
    servings: 4, prep_min: 10, cook_min: 15, difficulty: "kolay", allergens: [], diet_tags: ["vejetaryen", "vegan"],
    ingredients: [
      { name: "kinoa", qty: 1, unit: "su_bardagi" }, { name: "haşlanmış nohut", qty: 1, unit: "su_bardagi" }, { name: "salatalık", qty: 1, unit: "adet" },
      { name: "domates", qty: 2, unit: "adet" }, { name: "maydanoz", qty: 0.5, unit: "demet" }, { name: "zeytinyağı", qty: 2, unit: "yemek_kasigi" },
      { name: "limon", qty: 1, unit: "adet" }, { name: "tuz", qty: 1, unit: "cay_kasigi" },
    ],
    steps: ["Kinoayı iki katı suyla 15 dakika pişirip soğutun.", "Nohut, doğranmış salatalık, domates ve maydanozu ekleyin.", "Zeytinyağı, limon ve tuzla karıştırın."],
    nutrition: { kcal: 300, protein_g: 10, karb_g: 40, yag_g: 11, micros: m(7, 450, 2.8, 50, 500, 95, 25, 0, 0) },
  },
  {
    ...base, id: "diyet-brokoli-corba", slots: ["ogle", "aksam"], name_tr: "Brokoli çorbası", description: "Hafif, C vitamini yüksek çorba.",
    servings: 4, prep_min: 10, cook_min: 25, difficulty: "kolay", allergens: [], diet_tags: ["vejetaryen", "vegan"],
    ingredients: [
      { name: "brokoli", qty: 500, unit: "g" }, { name: "patates", qty: 1, unit: "adet" }, { name: "kuru soğan", qty: 1, unit: "adet" },
      { name: "zeytinyağı", qty: 2, unit: "yemek_kasigi" }, { name: "tuz", qty: 1, unit: "cay_kasigi" },
    ],
    steps: ["Soğanı zeytinyağında kavurun.", "Brokoli, doğranmış patates ve 5 su bardağı sıcak su ekleyip 20 dakika pişirin.", "Blenderdan geçirip tuzunu ayarlayın."],
    nutrition: { kcal: 145, protein_g: 4, karb_g: 14, yag_g: 7.5, micros: m(4, 500, 1, 60, 550, 30, 100, 0, 0) },
  },
  {
    ...base, id: "diyet-ton-salata", slots: ["ogle"], name_tr: "Ton balıklı yumurtalı salata", description: "Pratik ve yüksek proteinli öğle yemeği.",
    servings: 2, prep_min: 10, cook_min: 0, difficulty: "kolay", allergens: ["balik", "yumurta"], diet_tags: [],
    ingredients: [
      { name: "ton balığı (suda)", qty: 160, unit: "g" }, { name: "marul", qty: 150, unit: "g" }, { name: "domates", qty: 1, unit: "adet" },
      { name: "salatalık", qty: 1, unit: "adet" }, { name: "haşlanmış yumurta", qty: 2, unit: "adet" }, { name: "zeytinyağı", qty: 1, unit: "yemek_kasigi" }, { name: "limon", qty: 1, unit: "adet" },
    ],
    steps: ["Marul, domates ve salatalığı doğrayın.", "Ton balığını süzüp ekleyin, yumurtaları dilimleyip üzerine dizin.", "Zeytinyağı ve limon gezdirin."],
    nutrition: { kcal: 260, protein_g: 30, karb_g: 6, yag_g: 13, micros: m(2.5, 600, 2.2, 60, 650, 50, 25, 2.5, 2.5) },
  },
  {
    ...base, id: "diyet-firin-mucver", slots: ["kahvalti", "aksam"], name_tr: "Fırında kabak mücver", description: "Kızartma yerine fırında pişen hafif mücver.",
    servings: 4, prep_min: 15, cook_min: 25, difficulty: "kolay", allergens: ["gluten", "yumurta", "sut"], diet_tags: ["vejetaryen"],
    ingredients: [
      { name: "kabak", qty: 3, unit: "adet" }, { name: "yumurta", qty: 2, unit: "adet" }, { name: "tam buğday unu", qty: 4, unit: "yemek_kasigi" },
      { name: "beyaz peynir", qty: 80, unit: "g" }, { name: "dereotu", qty: 0.5, unit: "demet" }, { name: "tuz", qty: 1, unit: "cay_kasigi" },
    ],
    steps: ["Kabakları rendeleyip suyunu sıkın.", "Yumurta, un, ufalanmış peynir ve dereotuyla karıştırın.", "Yağlı kağıt serili tepsiye kaşıkla döküp 200°C fırında 25 dakika pişirin."],
    nutrition: { kcal: 165, protein_g: 10, karb_g: 13, yag_g: 8, micros: m(2.5, 450, 1.3, 120, 450, 35, 25, 0.5, 0.6) },
  },
  {
    ...base, id: "diyet-muz-smoothie", slots: ["kahvalti"], name_tr: "Muzlu yulaflı smoothie", description: "Spor sonrası ya da hızlı kahvaltı için.",
    servings: 1, prep_min: 5, cook_min: 0, difficulty: "kolay", allergens: ["sut", "gluten", "yer_fistigi"], diet_tags: ["vejetaryen"],
    ingredients: [
      { name: "süt", qty: 1, unit: "su_bardagi" }, { name: "muz", qty: 1, unit: "adet" }, { name: "yulaf ezmesi", qty: 2, unit: "yemek_kasigi" },
      { name: "fıstık ezmesi", qty: 1, unit: "tatli_kasigi" },
    ],
    steps: ["Tüm malzemeleri blenderda 1 dakika çekin.", "Hemen servis edin."],
    nutrition: { kcal: 335, protein_g: 13, karb_g: 52, yag_g: 9, micros: m(4.5, 120, 1.5, 260, 800, 90, 10, 1, 1) },
  },
];
