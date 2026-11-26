process.env.LLM_MOCK = "1";
process.env.APPLE_BUNDLE_ID = "com.test.menu";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { generateKeyPairSync, sign } from "node:crypto";
import { SAMPLE_RECIPES } from "@menu/shared";
import { createApp } from "../src/app";
import { openDb } from "../src/db";
import { generatePlan, generateSingle, mockProvider, type GenInput, type Provider } from "../src/generate";
import { setJwksFetcher, verifyIdToken } from "../src/auth";
import { resetRateLimits, weekStart, trWeekday } from "../src/limits";

let server: Server;
let base = "";

async function api(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const r = await fetch(base + path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: r.status, data: (await r.json()) as any };
}

async function login(email: string) {
  const s = await api("/auth/email/start", { body: { email } });
  assert.equal(s.status, 200);
  const v = await api("/auth/email/verify", { body: { email, code: s.data.dev_code } });
  assert.equal(v.status, 200);
  return v.data.token as string;
}

before(async () => {
  const db = openDb(":memory:");
  server = createServer(createApp(db, mockProvider));
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => server.close());

test("giriş: hatalı kod reddedilir, doğru kod oturum açar", async () => {
  const s = await api("/auth/email/start", { body: { email: "a@ornek.com" } });
  const bad = await api("/auth/email/verify", { body: { email: "a@ornek.com", code: "000000" === s.data.dev_code ? "111111" : "000000" } });
  assert.equal(bad.status, 400);
  const ok = await api("/auth/email/verify", { body: { email: "a@ornek.com", code: s.data.dev_code } });
  assert.ok(ok.data.token);
  assert.equal((await api("/me")).status, 401);
  assert.equal((await api("/me", { token: ok.data.token })).data.has_profile, false);
});

test("uçtan uca: profil, malzeme, menü, değiştirme, liste, maliyet, silme", async () => {
  resetRateLimits();
  const t = await login("b@ornek.com");
  const noConsent = await api("/profile", { method: "PUT", token: t, body: { household_size: 3, allergies: ["sut"] } });
  assert.equal(noConsent.status, 400, "rıza olmadan alerji kaydedilmemeli");
  const prof = await api("/profile", { method: "PUT", token: t, body: { household_size: 3, weekly_budget_try: 2000, diet: "hepsi", allergies: ["sut"], dislikes: ["patlıcan"], max_weekday_minutes: 60, health_consent: true } });
  assert.equal(prof.status, 200);
  assert.equal(prof.data.halal_sensitive, true);

  const add = await api("/pantry", { token: t, body: { name: "domates", qty: 1, unit: "kg", expires_on: "2026-12-01" } });
  assert.equal(add.status, 200);
  assert.equal((await api("/pantry", { token: t, body: { name: "", qty: 1 } })).status, 400);
  await api("/prices", { method: "PUT", token: t, body: { name: "domates", unit: "kg", price_try: 40 } });

  const plan = await api("/plans", { token: t, body: {} });
  assert.equal(plan.status, 200, JSON.stringify(plan.data));
  assert.equal(plan.data.days.length, 7);
  for (const d of plan.data.days) {
    for (const s of ["kahvalti", "ogle", "aksam"]) {
      const r = d[s];
      assert.equal(r.servings, 3);
      assert.ok(!r.allergens.includes("sut"), `${r.name_tr} süt içeriyor`);
      assert.ok(!/patl[ıi]can/i.test(JSON.stringify(r.ingredients)), `${r.name_tr} patlıcan içeriyor`);
      if (d.day <= 5) assert.ok(r.prep_min + r.cook_min <= 60, `${r.name_tr} süre sınırı`);
    }
  }

  const before = plan.data.days[0].aksam.name_tr;
  const sw = await api(`/plans/${plan.data.id}/swap`, { token: t, body: { day: 1, slot: "aksam" } });
  assert.equal(sw.status, 200, JSON.stringify(sw.data));
  assert.notEqual(sw.data.days[0].aksam.name_tr, before);
  assert.equal(sw.data.days[1].ogle.name_tr, plan.data.days[1].ogle.name_tr, "diğer öğünler değişmemeli");

  const list = await api("/shopping-list", { token: t });
  assert.equal(list.status, 200);
  assert.ok(list.data.groups.length > 0);
  const firstKey = list.data.groups[0].items[0].key;
  const checked = await api("/shopping-list/check", { token: t, body: { key: firstKey, checked: true, updated_at: Date.now() } });
  assert.equal(checked.data.groups[0].items[0].checked, true);
  // Eski tarihli (çevrimdışı) işaretleme yeniyi ezmez
  const stale = await api("/shopping-list/check", { token: t, body: { items: [{ key: firstKey, checked: false, updated_at: 1 }] } });
  assert.equal(stale.data.groups[0].items[0].checked, true);
  assert.ok(["hesaplandı", "kısmen tahmini", "tahmini"].includes(list.data.cost.label));
  assert.equal(list.data.budget_try, 2000);

  const tonight = await api("/tonight", { token: t, body: {} });
  assert.equal(tonight.status, 200);
  const again = await api("/tonight", { token: t, body: { exclude: [tonight.data.name_tr] } });
  assert.notEqual(again.data.name_tr, tonight.data.name_tr);

  assert.equal((await api(`/recipes/${tonight.data.id}/feedback`, { token: t, body: { vote: -1 } })).status, 200);

  const exp = await api("/account/export", { token: t });
  assert.equal(exp.data.profile.household_size, 3);
  assert.equal(exp.data.feedback.length, 1);

  // Su ve kilo
  const w1 = await api("/water", { token: t, body: { date: "2026-11-26", ml: 250 } });
  assert.equal(w1.data.ml, 250);
  assert.equal((await api("/water", { token: t, body: { date: "2026-11-26", ml: -500 } })).data.ml, 0);
  await api("/profile", { method: "PUT", token: t, body: { household_size: 3, body: { sex: "kadin", age: 30, height_cm: 170, weight_kg: 70, activity: "orta", goal: "koru" } } });
  assert.equal((await api("/water/2026-11-26", { token: t })).data.target_ml, 2300);
  const kg = await api("/weight", { token: t, body: { date: "2026-11-26", kg: 68.5 } });
  assert.equal(kg.data[0].kg, 68.5);
  assert.equal((await api("/me", { token: t })).data.profile.body.weight_kg, 68.5);
  assert.equal((await api("/weight", { token: t, body: { date: "2026-11-26", kg: 20 } })).status, 400);

  // Notlar
  const n1 = await api("/notes", { token: t, body: { text: "Pazar günü misafir var" } });
  assert.equal(n1.data.length, 1);
  const n2 = await api(`/notes/${n1.data[0].id}`, { method: "PUT", token: t, body: { text: "Pazar: 6 kişi" } });
  assert.equal(n2.data[0].text, "Pazar: 6 kişi");
  assert.equal((await api("/notes", { token: t, body: { text: "  " } })).status, 400);
  assert.equal((await api(`/notes/${n1.data[0].id}`, { method: "DELETE", token: t })).data.length, 0);

  // Diyet programı
  const bad = await api("/profile", { method: "PUT", token: t, body: { household_size: 3, body: { sex: "kadin", age: 15, height_cm: 160, weight_kg: 50 } } });
  assert.equal(bad.status, 400);
  await api("/profile", { method: "PUT", token: t, body: { household_size: 3, body: { sex: "kadin", age: 30, height_cm: 170, weight_kg: 70, activity: "orta", goal: "koru" } } });
  const me = await api("/me", { token: t });
  assert.equal(me.data.targets.kcal, 2250);
  assert.ok(plan.data.days[0].aksam.nutrition.kcal > 0, "tariflerde besin değeri olmalı");

  // Rızayı geri alma: sağlık verileri silinir
  assert.equal((await api("/health-data", { method: "DELETE", token: t })).status, 200);
  const after = await api("/me", { token: t });
  assert.equal(after.data.profile.body, null);
  assert.deepEqual(after.data.profile.allergies, []);
  assert.equal(after.data.profile.health_consent_at, null);
  assert.equal((await api("/weight", { token: t, body: { date: "2026-11-26", kg: 70 } })).status, 400);

  assert.equal((await api("/account", { method: "DELETE", token: t })).status, 200);
  assert.equal((await api("/me", { token: t })).status, 401);
});

test("ücretsiz sınır: haftalık menü hakkı dolunca 402", async () => {
  resetRateLimits();
  const t = await login("c@ornek.com");
  await api("/profile", { method: "PUT", token: t, body: { household_size: 2, health_consent: true } });
  assert.equal((await api("/plans", { token: t, body: { fresh: true } })).status, 200);
  assert.equal((await api("/plans", { token: t, body: { fresh: true } })).status, 200);
  const third = await api("/plans", { token: t, body: { fresh: true } });
  assert.equal(third.status, 402);
  assert.match(third.data.error.message, /abonel/);
  const prem = await api("/dev/premium", { token: t, body: { on: true } });
  assert.equal(prem.data.premium, true);
  assert.equal((await api("/plans", { token: t, body: { fresh: true } })).status, 200, "premium sınırsız olmalı");

  // Kalori ve makro takibi
  const cur = await api("/plans/current", { token: t });
  const rid = cur.data.days[0].aksam.id;
  const kcal = cur.data.days[0].aksam.nutrition.kcal;
  const l1 = await api("/log", { token: t, body: { date: "2026-11-26", slot: "aksam", recipe_id: rid, portion: 1.5 } });
  assert.equal(l1.status, 200);
  assert.equal(l1.data.totals.kcal, Math.round(kcal * 1.5));
  const l2 = await api("/log", { token: t, body: { date: "2026-11-26", name: "elma", kcal: 95, protein_g: 0.5, karb_g: 25, yag_g: 0.3 } });
  assert.equal(l2.data.entries.length, 2);
  assert.equal((await api("/log", { token: t, body: { date: "2026-11-26", name: "x", kcal: -5 } })).status, 400);
  assert.equal((await api("/log", { token: t, body: { date: "2026-11-25", name: "çay", kcal: 0 } })).status, 200);
  const del = await api(`/log/${l2.data.entries[1].id}`, { method: "DELETE", token: t });
  assert.equal(del.data.entries.length, 1);
  const wk = await api("/log-week/2026-11-26", { token: t });
  assert.equal(wk.data.length, 7);
  assert.equal(wk.data[6].totals.kcal, Math.round(kcal * 1.5));
  // Diyet yemekleri ve kendi yemeğim
  const lib = await api("/library/diet", { token: t });
  assert.equal(lib.data.length, 12);
  const dietLog = await api("/log", { token: t, body: { date: "2026-11-24", recipe_id: lib.data[0].id } });
  assert.equal(dietLog.data.totals.kcal, lib.data[0].nutrition.kcal);
  const mine = await api("/my-recipes", { token: t, body: { name: "Annemin mercimeği", servings: 2, items: [{ food: "Haşlanmış patates", grams: 200 }, { name: "özel sos", kcal: 100, protein_g: 0, karb_g: 5, yag_g: 9 }] } });
  assert.equal(mine.status, 200, JSON.stringify(mine.data));
  assert.equal(mine.data.nutrition.kcal, Math.round((174 + 100) / 2));
  assert.equal((await api("/my-recipes", { token: t, body: { name: "x", servings: 2, items: [] } })).status, 400);
  assert.equal((await api("/my-recipes", { token: t })).data.length, 1);
  const ml = await api("/log", { token: t, body: { date: "2026-11-24", recipe_id: mine.data.id } });
  assert.equal(ml.data.entries.length, 2);
  assert.equal((await api(`/my-recipes/${mine.data.id}`, { method: "DELETE", token: t })).data.length, 0);

  await api("/dev/premium", { token: t, body: { on: false } });
  assert.equal((await api("/log/2026-11-26", { token: t })).status, 402);
});

test("vegan profil + çok kısıt: uygun tarif yoksa anlaşılır hata", async () => {
  resetRateLimits();
  const t = await login("d@ornek.com");
  await api("/profile", { method: "PUT", token: t, body: { household_size: 2, diet: "vegan", allergies: ["gluten"], dislikes: ["soğan", "domates"], health_consent: true } });
  const r = await api("/tonight", { token: t, body: {} });
  assert.equal(r.status, 422);
  assert.ok(r.data.error.message.length > 10);
});

// ----- Model çıktısı doğrulama ve yeniden deneme -----

const input: GenInput = {
  profile: { household_size: 2, weekly_budget_try: null, diet: "hepsi", halal_sensitive: true, allergies: [], dislikes: [], max_weekday_minutes: null, body: null, health_consent_at: null },
  pantry: [], liked: [], disliked: [], prices: [],
};
const { slots: _s, ...corba } = SAMPLE_RECIPES.find((r) => r.name_tr === "Mercimek çorbası")!;

test("yasaklı malzemeli tarif reddedilir ve yeniden üretilir", async () => {
  let calls = 0;
  const p: Provider = {
    plan: async () => null,
    single: async (_i, _r, errors) => {
      calls++;
      if (calls === 1) return { ...corba, name_tr: "Pastalı", ingredients: [...corba.ingredients, { name: "pancetta", qty: 100, unit: "g", aisle: "et_tavuk_balik" }] };
      assert.ok(errors.some((e) => e.includes("yasaklı")), "hata modele geri bildirilmeli");
      return corba;
    },
  };
  const r = await generateSingle(input, { slot: "aksam", day: 1, avoid: [] }, p);
  assert.equal(r.name_tr, "Mercimek çorbası");
  assert.equal(calls, 2);
});

test("bozuk JSON 3 denemeden sonra anlaşılır hata verir", async () => {
  const p: Provider = { plan: async () => ({ days: "yok" }), single: async () => ({ name_tr: "" }) };
  await assert.rejects(generateSingle(input, { slot: "aksam", day: 1, avoid: [] }, p), /tarif bulunamadı/);
  await assert.rejects(generatePlan(input, p), /Menü hazırlanamadı/);
});

test("menüde birkaç hatalı öğün tek tek onarılır", async () => {
  const good = await mockProvider.plan(input, []) as any;
  good.days[2].aksam = { ...good.days[2].aksam, ingredients: [...good.days[2].aksam.ingredients, { name: "beyaz şarap", qty: 0.5, unit: "su_bardagi", aisle: "diger" }] };
  let planCalls = 0;
  const p: Provider = { plan: async () => { planCalls++; return good; }, single: mockProvider.single };
  const r = await generatePlan(input, p);
  assert.equal(planCalls, 1);
  assert.ok(!JSON.stringify(r.plan).includes("şarap"));
});

test("Apple/Google kimlik belirteci doğrulama", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1" };
  setJwksFetcher(async () => [jwk as any]);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const make = (payload: object) => {
    const h = enc({ alg: "RS256", kid: "k1" });
    const b = enc(payload);
    return `${h}.${b}.${sign("RSA-SHA256", Buffer.from(`${h}.${b}`), privateKey).toString("base64url")}`;
  };
  const opts = { jwksUrl: "x", issuers: ["https://appleid.apple.com"], audiences: ["com.test.menu"] };
  const exp = Math.floor(Date.now() / 1000) + 600;
  const ok = await verifyIdToken(make({ iss: "https://appleid.apple.com", aud: "com.test.menu", sub: "u1", exp }), opts);
  assert.equal(ok.sub, "u1");
  await assert.rejects(verifyIdToken(make({ iss: "https://evil", aud: "com.test.menu", sub: "u1", exp }), opts));
  await assert.rejects(verifyIdToken(make({ iss: "https://appleid.apple.com", aud: "baska", sub: "u1", exp }), opts));
  await assert.rejects(verifyIdToken(make({ iss: "https://appleid.apple.com", aud: "com.test.menu", sub: "u1", exp: 1 }), opts));
  const t = make({ iss: "https://appleid.apple.com", aud: "com.test.menu", sub: "u1", exp });
  await assert.rejects(verifyIdToken(t.slice(0, -4) + "AAAA", opts));
  const viaApi = await api("/auth/apple", { body: { identityToken: t } });
  assert.equal(viaApi.status, 200);
});

test("RevenueCat bildirimi Premium durumunu değiştirir", async () => {
  resetRateLimits();
  process.env.REVENUECAT_WEBHOOK_SECRET = "gizli";
  const t = await login("rc@ornek.com");
  const me = await api("/me", { token: t });
  const hook = (type: string, auth = "Bearer gizli") => fetch(base + "/webhooks/revenuecat", {
    method: "POST", headers: { "content-type": "application/json", authorization: auth },
    body: JSON.stringify({ event: { type, app_user_id: me.data.id } }),
  });
  assert.equal((await hook("INITIAL_PURCHASE", "Bearer yanlis")).status, 401);
  await hook("INITIAL_PURCHASE");
  assert.equal((await api("/me", { token: t })).data.premium, true);
  await hook("CANCELLATION");
  assert.equal((await api("/me", { token: t })).data.premium, true, "iptal dönem sonuna kadar sürer");
  await hook("EXPIRATION");
  assert.equal((await api("/me", { token: t })).data.premium, false);
});

test("Türkiye saatiyle hafta başı", () => {
  // 2026-11-29 Pazar 22:30 UTC = 30 Kasım Pazartesi 01:30 TR
  const t = Date.UTC(2026, 10, 29, 22, 30);
  assert.equal(weekStart(t), "2026-11-30");
  assert.equal(trWeekday(t), 1);
});

test("üretimde e-posta servisi yoksa kod gösterilmez; test modunda gösterilir", async () => {
  resetRateLimits();
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const { config } = await import("../src/config");
    // config.isProd modül yüklenirken okunur; burada doğrudan davranışı test etmek için geçici olarak değiştiriyoruz.
    (config as any).isProd = true;
    process.env.TEST_MODE = "0";
    const r1 = await api("/auth/email/start", { body: { email: "prod1@ornek.com" } });
    assert.equal(r1.status, 501);
    process.env.TEST_MODE = "1";
    const r2 = await api("/auth/email/start", { body: { email: "prod2@ornek.com" } });
    assert.ok(r2.data.dev_code, "test modunda kod gösterilmeli");
    assert.equal((await api("/health")).data.test, true);
    (config as any).isProd = false;
  } finally {
    process.env.NODE_ENV = prev;
    process.env.TEST_MODE = "0";
  }
});
