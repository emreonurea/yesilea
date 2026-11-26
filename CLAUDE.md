# Yeşilea: Claude için proje notları

Bu depoda birden fazla Claude oturumu çalışıyor: kullanıcının bilgisayarındaki Claude Code ve claude.ai'deki Claude. Bu dosya ortak devir notudur. Çalışmaya başlamadan önce `git pull` yap, bitirince bu dosyadaki "Durum" bölümünü güncelle.

Kullanıcı (Emre) Türkçe konuşur, yazılımcı değildir. Cevapları kısa, sade Türkçe ve adım adım ver. Teknik terimleri açıkla.

## Ne bu uygulama
Türkçe menü planlama, market listesi ve beslenme takibi uygulaması. Helal kurallar, alerjen kontrolü, diyet hedefleri, kalori/makro takibi, su, kilo, notlar, diyet tarifleri, kullanıcının kendi tarifleri, Premium.

## Yapı (npm workspaces)
- `packages/shared`: tüm iş kuralları (TypeScript, ESM). helal tarama (`halal.ts`), alerjenler (`allergens.ts`, AB 14), birimler, market listesi (`shopping.ts`), tarif doğrulama (`validate.ts`), diyet hedefleri (`nutrition.ts`, Mifflin-St Jeor), yiyecek veritabanı (`foods.ts`, ~213 yiyecek), diyet tarifleri (`dietRecipes.ts`), örnek tarifler (`sampleRecipes.ts`), Premium (`premium.ts`), yerel menü üretimi (`localgen.ts`).
- `apps/server`: Node `node:http` + `node:sqlite`, tsx ile çalışır. Rotalar `src/app.ts`. Claude API anahtarı yoksa örnek tariflerle (mock) çalışır.
- `apps/mobile`: Expo (SDK 58) + Expo Router.
  - Sekmeler `app/(tabs)/`: index (ana ekran kutuları), menu, list, nutrition, settings.
  - Diğer ekranlar `app/` altında yığın (stack) rotası: pantry (Evdekiler), tonight, body, notes, premium, prices, profile, diet-recipes, my-recipes, recipe/[id], privacy, terms, login, onboarding.
  - **Sunucusuz mod:** `EXPO_PUBLIC_LOCAL=1` iken `lib/api.ts` istekleri `lib/localServer.ts`'e yönlendirir, veriler localStorage'da durur. Web ve Telegram sürümü bu modda çalışır. Sunucuya yeni rota eklersen `localServer.ts`'e de ekle.
  - `lib/dialog.ts`: web'de `Alert` çalışmadığı için `confirmAction` / `showInfo` kullan.
  - `components/ErrorScreen.tsx` + `_layout.tsx` içindeki `ErrorBoundary`: ekran çökerse hata mesajını gösterir.

## Komutlar
```bash
npm install
npm test                 # tüm testler (shared + server); push etmeden önce mutlaka
npm run typecheck
npm run server           # yerel sunucu
cd apps/mobile && EXPO_PUBLIC_LOCAL=1 npx expo start --web   # sunucusuz web
```
Windows'ta: `set EXPO_PUBLIC_LOCAL=1 && npx expo start --web`

## Yayın
- **Web + Telegram (canlı, ücretsiz):** `main`'e her push `.github/workflows/web.yml` ile GitHub Pages'e çıkar: https://emreonurea.github.io/yesilea/ . Telegram botu @yesilea_bot bu adresi açar. `experiments.baseUrl` = `/yesilea`, `404.html` = `index.html` kopyası. Ayarlar ekranındaki "Sürüm" = workflow çalışma numarası. Pages önbelleği ~10 dk.
- **Sunucu (Render, `render.yaml`):** hazır ama kurulmadı. starter planı aylık ~7–8 $, kart ister. Kullanıcı daha önce "kartsız" yolu seçmişti; Render'a geçmeden önce kullanıcıya ücreti açıkça sor.
- **Mağazalar:** Google Play tek seferlik 25 $, Apple yıllık 99 $ (Türkiye'de ~1.030 TL; kart reddi sık). Hesaplar henüz açılmadı. Uygulama kimliği `com.yesilea.app`, değiştirme.

## Değişmez kurallar
- Helal: domuz, alkol vb. asla önerilmez; şüpheli katkılar işaretlenir.
- Diyet güvenliği: yalnız 18+; kalori tabanı kadın 1200 / erkek 1500; zayıf kullanıcıya kilo verme hedefi yok. Bunları gevşetme.
- KVKK: sağlık verisi için açık rıza (`health_consent_at`), `DELETE /health-data` ile silme.
- Fiyatlar yalnızca kullanıcının girdiği fiyatlardan hesaplanır; uydurma fiyat yok.
- Fotoğraftan kalori: kullanıcı fotoğrafın dışarı (Claude'a) gönderilmesini istemedi; cihaz içi yiyecek veritabanı kullanılıyor.
- `.env`, API anahtarları, bot token'ı asla depoya girmez. Kullanıcıdan sohbette şifre/anahtar isteme.
- Arayüz metinleri Türkçe.

## Çalışma şekli
- Değişiklikleri dal + PR ile yap (Claude Code şimdiye kadar #1–#3 ile böyle yaptı), testler geçince `main`'e birleştir.
- Aynı anda iki oturum çalışabilir: başlamadan `git pull`, büyük değişiklik öncesi bu dosyadaki "Durum"a bak.

## Durum (son güncelleme: 26 Kasım 2026)
**Açık hata (öncelikli):** Web/Telegram'da **Ayarlar** sekmesi ve **Evdekiler** (`app/pantry.tsx`) ekranı açılmıyor. Kullanıcı "basınca hiç açılmıyor" diyor.
- Denenenler: Evdekiler gizli sekmeden (`href:null`) yığın rotasına taşındı; ErrorBoundary eklendi (sürüm 5). Kullanıcıdan hata ekranı görüntüsü henüz gelmedi.
- Önerilen sonraki adım: `EXPO_PUBLIC_LOCAL=1 npx expo start --web` ile aç, Ayarlar'a ve ana ekrandaki Evdekiler kutusuna tıkla, tarayıcı konsolundaki hatayı oku. Şüpheliler: web'de `Alert`/`window.confirm`, `expo-secure-store` gibi yalnız mobil modüller, `router.push` yolları (`/pantry`), `baseUrl` ile yönlendirme, `localServer.ts`'te eksik rota.

**Son yapılanlar:** market listesinde adet yukarı yuvarlama, gizlilik/koşullar profil olmadan açılır, uygulama kimliği `com.yesilea.app`, Render ayarları (Claude Code, PR #1–#3); birim fiyat ekranı sadeleşti, Ayarlar'da sürüm numarası, hata ekranı (claude.ai).

**Bekleyenler:** tarif kütüphanesini 28'den büyütmek (teklif edildi, onay yok); mağaza hesapları; gizlilik sayfasında veri sorumlusu bilgileri; TEST_MODE'u mağaza öncesi 0 yapmak.
