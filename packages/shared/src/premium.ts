// Ücretsiz ve Premium sürüm farkları. Fiyatlar örnektir; mağazada ürün tanımlanınca oradan gelecek.

export interface PlanFeature {
  label: string;
  free: string | boolean;
  premium: string | boolean;
}

export const PLAN_FEATURES: PlanFeature[] = [
  { label: "Haftalık menü", free: "Haftada 2", premium: "Sınırsız" },
  { label: "Bu akşam ne pişirsem", free: "Günde 5", premium: "Sınırsız" },
  { label: "Öğün değiştirme", free: "Haftada 10", premium: "Sınırsız" },
  { label: "Market listesi ve paylaşma", free: true, premium: true },
  { label: "Evdeki malzemeler, maliyet hesabı", free: true, premium: true },
  { label: "Diyet programı (boy, kilo, hedef)", free: false, premium: true },
  { label: "Hedefe göre hazırlanan menüler", free: false, premium: true },
  { label: "Makro ve mikro besin takibi", free: false, premium: true },
  { label: "Günlük kalori ve makro takibi (ne yedim)", free: false, premium: true },
  { label: "213 yiyecekli arama (internetsiz)", free: false, premium: true },
  { label: "Su ve kilo takibi", free: false, premium: true },
  { label: "Yemeklerim: kendi tarifin, otomatik kalori", free: false, premium: true },
  { label: "Diyet yemekleri tarifleri", free: true, premium: true },
  { label: "Aile ortak listesi", free: false, premium: "Yakında" },
  { label: "Dünya mutfağı (30 ülke)", free: false, premium: "Yakında" },
];

export interface PricePlan {
  id: "aylik" | "yillik";
  title: string;
  price: string;
  note: string;
}

/** ÖRNEK fiyatlar: yayından önce App Store / Google Play'de belirlenecek. */
export const PRICE_PLANS: PricePlan[] = [
  { id: "aylik", title: "Aylık", price: "79,99 TL / ay", note: "İstediğiniz zaman iptal" },
  { id: "yillik", title: "Yıllık", price: "599,99 TL / yıl", note: "Ayda yaklaşık 50 TL, %37 tasarruf" },
];
