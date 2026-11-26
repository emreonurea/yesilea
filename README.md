# Yeşilea — menü, market ve beslenme uygulaması

Bu klasörde üç parça var:

| Klasör | Ne işe yarar |
|---|---|
| `apps/mobile` | Telefon uygulaması (React Native, Expo, TypeScript) |
| `apps/server` | Küçük sunucu (Node.js, TypeScript). Claude API anahtarı yalnızca burada durur. |
| `packages/shared` | Uygulama ve sunucunun ortak kullandığı kurallar: birimler, porsiyon ölçekleme, helal tarama, alerjenler, market listesi, maliyet, tarif doğrulama |

## Uygulamada neler var

**Mutfak**
- **Ana sayfa:** "Bu akşam ne pişirsem?" büyük kutucuğu, bugünün menüsü, son kullanma tarihi yaklaşan malzemeler, kutucuklu menü
- **Haftalık menü:** 7 gün × 3 öğün, tek öğünü diğerlerini bozmadan değiştirme, her günün toplam kalorisi
- **Bu akşam ne pişirsem:** tek tuşla öneri, "Başka öner"
- **Evdekiler:** malzeme, miktar, son kullanma tarihi
- **Market listesi:** reyonlara göre gruplu, işaretleme, paylaşma; maliyet yalnızca kullanıcının girdiği birim fiyatlarla
- **Tarif detayı:** porsiyon ölçekleme, besin değeri, "Yedim" düğmesi, beğen/beğenme
- **Diyet yemekleri:** 12 düşük kalorili/yüksek proteinli tarif, filtreli (taslak, incelenmeli)
- **Yemeklerim:** kullanıcının kendi tarifi; malzeme gramajından porsiyon başı kalori/makro otomatik hesaplanır
- **Notlarım**

**Beslenme (Premium)**
- **Diyet programı:** cinsiyet, yaş, boy, kilo, hareket, hedef → BKİ, günlük kalori, makro ve 9 mikro besin hedefi (Mifflin-St Jeor). Güvenlik: 18 yaş altı kapalı, kadınlarda 1200 / erkeklerde 1500 kcal altına inmez, zayıf BKİ'de kilo verme uygulanmaz
- **Kalori ve makro takibi:** menüden "Yedim", 213 yiyecekli yerel veritabanından arama (internetsiz, telefonda), elle ekleme, son eklenenler, son 7 gün grafiği
- **Su takibi** (hedef kiloya göre), **kilo takibi** (son kilo hedeflere yansır)

**Hesap ve ayarlar**
- E-posta kodu, Apple, Google ile giriş
- Profil: hane, bütçe, diyet, alerjiler (AB 14 alerjen), sevilmeyenler, süre sınırı, helal hassasiyeti (varsayılan açık)
- Renk teması (6 renk, varsayılan yeşil)
- Premium ekranı (ödeme henüz bağlı değil; geliştirme modunda deneme düğmesi)
- KVKK: sağlık verileri için açık rıza, rızayı geri alma (sağlık verileri silinir), verileri indirme, hesabı silme

**Güvenlik ve maliyet**
- Helal kuralları: modele açıkça yazılır + çıkan tarif yasaklı listeye karşı taranır (Türkçe ve yabancı adlar)
- Model çıktısı şema doğrulamasından geçer, hatalıysa yeniden üretilir; tutarsız besin değeri gösterilmez
- Kullanıcı başına istek sınırı, model yanıt önbelleği, ücretsiz sürüm sınırları, anlaşılır hata mesajları

## Windows'ta en kolay yol

1. Bu klasörde **KUR.bat** dosyasına çift tıklayın. Node.js yoksa kurar, sonra paketleri indirir.
2. **BASLAT.bat** dosyasına çift tıklayın. Sunucu açılır ve ekranda bir QR kod çıkar.
3. Telefondaki **Expo Go** ile QR kodu okutun.

## Bilgisayarınızda çalıştırma (elle)

Gerekenler: [Node.js](https://nodejs.org) 22 veya üstü, telefonda **Expo Go** uygulaması.

```bash
# 1) Paketleri kurun (klasörün en üstünde)
npm install

# 2) Mobil paket sürümlerini Expo'nun güncel sürümüne eşitleyin
cd apps/mobile && npx expo install --fix && cd ../..

# 3) Sunucuyu başlatın
cp apps/server/.env.example apps/server/.env
npm run server
```

`ANTHROPIC_API_KEY` boş bırakılırsa sunucu **deneme modunda** çalışır: Claude yerine içindeki 16 örnek Türk yemeğiyle menü hazırlar. Böylece API anahtarı almadan uygulamayı deneyebilirsiniz. Gerçek menü üretimi için [Claude Console](https://console.anthropic.com)'dan anahtar alıp `.env` dosyasına yazın.

```bash
# 4) Başka bir terminalde telefon uygulamasını başlatın
cp apps/mobile/.env.example apps/mobile/.env
#    .env içinde EXPO_PUBLIC_API_URL'yi bilgisayarınızın yerel IP'si yapın, ör. http://192.168.1.20:8787
npm run mobile
```

Ekranda çıkan QR kodu telefondaki Expo Go ile okutun. Telefon ve bilgisayar aynı Wi-Fi ağında olmalı. Deneme modunda e-posta gönderilmez; giriş kodu hem ekranda hem sunucu penceresinde görünür.

Testler ve tip denetimi:

```bash
npm test          # helal tarama, alerjen, birimler, liste, maliyet, beslenme, giriş, menü, takip, KVKK
npm run typecheck
```

## Verdiğim kararlar (değiştirmek isterseniz söyleyin)

| Konu | Karar | Neden |
|---|---|---|
| Veritabanı | İlk sürümde SQLite (Node'un yerleşik modülü) | Ek kurulum yok. Aile ortak listesi ve çok sunucu gerektiğinde PostgreSQL'e geçilir, SQL standart tutuldu. |
| Kimlik doğrulama | Kendi sunucumuzda: e-posta kodu + Apple/Google kimlik belirteci doğrulama | Üçüncü parti hizmete bağımlılık yok |
| Ücretsiz sınır | Haftada 2 menü, günde 5 "bu akşam" önerisi, haftada 10 öğün değiştirme | `.env` içinden değiştirilebilir |
| Model | Menü ve öneriler `claude-haiku-5-5` | Maliyet. `claude-sonnet-5-5`, dünya mutfağı kütüphanesi üretimi için ayrıldı. |
| Ölçüler | 1 su bardağı = 200 ml, çay bardağı = 100 ml, yemek kaşığı = 15 ml, tatlı kaşığı = 10 ml, çay kaşığı = 5 ml | Yaygın kullanılan değerler |

## Henüz yapılmayanlar

1. **Sunucuyu internete taşımak:** Şu an sunucu bilgisayarda çalışıyor; uygulama yalnızca aynı Wi-Fi'da çalışır.
2. **Abonelik ödemesi:** App Store / Google Play geliştirici hesapları ve ürün tanımları gerekiyor (önerim RevenueCat).
3. **E-posta gönderimi:** Giriş kodu için e-posta servisi (`apps/server/src/auth.ts` → `sendLoginEmail`).
4. **Claude API anahtarı:** Gerçek menü üretimi için. Anahtar yokken örnek tariflerle çalışır.
5. **Bildirimler:** akşam hatırlatması, son kullanma bildirimi (uygulamanın kendi derlemesi gerekir).
6. **Aile ortak listesi, dünya mutfağı kütüphanesi (30 ülke).**
7. **Telefonda fotoğraftan yemek tanıma:** uygulamanın kendi derlemesi ve Türk yemekleriyle eğitilmiş model gerekir.

## Yayından önce mutlaka

- Gizlilik politikasındaki veri sorumlusu bilgilerini doldurun ve bir hukukçuya kontrol ettirin. Alerji bilgisi sağlık verisi sayılabilir; açık rıza metni gerekir.
- Uygulama kimliği `com.yesilea.app` (app.json). Mağazaya ilk yüklemeden sonra değiştirilemez.
- Sunucuyu HTTPS arkasında yayınlayın, `NODE_ENV=production` yapın.
- Örnek tarifler (`packages/shared/src/sampleRecipes.ts`) yalnızca deneme içindir.
- Yiyecek veritabanı (`foods.ts`) ve diyet tariflerinin (`dietRecipes.ts`) besin değerleri yaklaşıktır; bir diyetisyen ya da TürKomp ile kontrol ettirin.
- Sağlık verisi işlendiği için KVKK açık rıza metnini ve aydınlatma metnini hukukçuya onaylatın; VERBİS kayıt yükümlülüğünü kontrol edin.
- `/dev/premium` uç noktası üretimde kapalıdır (`NODE_ENV=production`); bunu doğrulayın.
