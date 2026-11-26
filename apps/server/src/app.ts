import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ALLERGEN_KEYS, buildCustomRecipe, buildShoppingList, DIET_RECIPES, computeTargets, validateBody, DEFAULT_PROFILE, estimateCost, groupByAisle, isUnit, MEAL_SLOTS, normalize,
  type AllergenKey, type Diet, type MealPlan, type MealSlot, type PantryItem, type Profile, type Recipe, type UnitPrice,
} from "@menu/shared";
import { appleLogin, deleteSession, googleLogin, startEmailLogin, userFromToken, verifyEmailLogin } from "./auth";
import { config } from "./config";
import { newId, tx, type DB } from "./db";
import { defaultProvider, generatePlan, generateSingle, type GenInput, type Provider } from "./generate";
import { ApiError, readJson, Router, send, type Ctx } from "./http";
import { addUsage, assertQuota, isPremium, cacheGet, cacheKey, cacheSet, rateLimit, trWeekday, usageSummary, weekStart } from "./limits";

// ---------- Veri erişimi ----------

function getProfile(db: DB, userId: string): Profile {
  const row = db.prepare("SELECT data FROM profiles WHERE user_id = ?").get(userId) as { data: string } | undefined;
  return row ? { ...DEFAULT_PROFILE, ...JSON.parse(row.data) } : { ...DEFAULT_PROFILE };
}

function getPantry(db: DB, userId: string): PantryItem[] {
  return db.prepare("SELECT id, name, qty, unit, expires_on FROM pantry WHERE user_id = ? ORDER BY expires_on IS NULL, expires_on, name")
    .all(userId) as unknown as PantryItem[];
}

function getPrices(db: DB, userId: string): UnitPrice[] {
  return db.prepare("SELECT name, unit, price_try FROM prices WHERE user_id = ? ORDER BY name").all(userId) as unknown as UnitPrice[];
}

function getFeedback(db: DB, userId: string) {
  const rows = db.prepare("SELECT recipe_name, vote FROM feedback WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as
    { recipe_name: string; vote: number }[];
  return { liked: rows.filter((r) => r.vote > 0).map((r) => r.recipe_name), disliked: rows.filter((r) => r.vote < 0).map((r) => r.recipe_name) };
}

function genInput(db: DB, userId: string): GenInput {
  const profile = getProfile(db, userId);
  // Diyet programına göre menü hazırlama Premium özelliğidir.
  if (!isPremium(db, userId)) profile.body = null;
  return { profile, pantry: getPantry(db, userId), prices: getPrices(db, userId), ...getFeedback(db, userId) };
}

function saveRecipe(db: DB, userId: string, r: Recipe, source = "generated"): Recipe & { id: string } {
  const id = newId();
  const withId = { ...r, id };
  db.prepare("INSERT INTO recipes (id, user_id, source, data) VALUES (?, ?, ?, ?)").run(id, userId, source, JSON.stringify(withId));
  return withId;
}

function getRecipe(db: DB, userId: string, id: string): Recipe & { id: string } {
  const row = db.prepare("SELECT data FROM recipes WHERE id = ? AND (user_id = ? OR user_id IS NULL)").get(id, userId) as { data: string } | undefined;
  if (!row) throw new ApiError(404, "not_found", "Tarif bulunamadı.");
  return JSON.parse(row.data);
}

interface StoredPlan { id: string; week_start: string; servings: number; days: { day: number; kahvalti: string; ogle: string; aksam: string }[]; warnings: string[] }

function savePlan(db: DB, userId: string, plan: MealPlan, servings: number, warnings: string[]): StoredPlan {
  return tx(db, () => {
    const days = plan.days.map((d) => ({
      day: d.day,
      kahvalti: saveRecipe(db, userId, d.kahvalti).id,
      ogle: saveRecipe(db, userId, d.ogle).id,
      aksam: saveRecipe(db, userId, d.aksam).id,
    }));
    const stored: StoredPlan = { id: newId(), week_start: weekStart(), servings, days, warnings };
    db.prepare("INSERT INTO plans (id, user_id, week_start, servings, data, warnings) VALUES (?, ?, ?, ?, ?, ?)")
      .run(stored.id, userId, stored.week_start, servings, JSON.stringify(days), JSON.stringify(warnings));
    return stored;
  });
}

function currentPlan(db: DB, userId: string): StoredPlan | null {
  const row = db.prepare("SELECT id, week_start, servings, data, warnings FROM plans WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1")
    .get(userId) as { id: string; week_start: string; servings: number; data: string; warnings: string } | undefined;
  if (!row) return null;
  return { id: row.id, week_start: row.week_start, servings: row.servings, days: JSON.parse(row.data), warnings: JSON.parse(row.warnings) };
}

function expandPlan(db: DB, userId: string, p: StoredPlan) {
  return {
    id: p.id, week_start: p.week_start, servings: p.servings, warnings: p.warnings,
    days: p.days.map((d) => ({
      day: d.day,
      kahvalti: getRecipe(db, userId, d.kahvalti),
      ogle: getRecipe(db, userId, d.ogle),
      aksam: getRecipe(db, userId, d.aksam),
    })),
  };
}

function shoppingFor(db: DB, userId: string, p: StoredPlan) {
  const full = expandPlan(db, userId, p);
  const entries = full.days.flatMap((d) => MEAL_SLOTS.map((s) => ({ recipe: d[s], servings: p.servings })));
  const items = buildShoppingList(entries, getPantry(db, userId));
  const checks = new Map(
    (db.prepare("SELECT item_key, checked FROM shopping_checks WHERE user_id = ? AND plan_id = ?").all(userId, p.id) as
      { item_key: string; checked: number }[]).map((r) => [r.item_key, !!r.checked]),
  );
  const withChecks = items.map((i) => ({ ...i, checked: checks.get(i.key) ?? false }));
  const cost = estimateCost(items, getPrices(db, userId));
  const budget = getProfile(db, userId).weekly_budget_try;
  return { plan_id: p.id, groups: groupByAisle(withChecks), cost, budget_try: budget };
}

// ---------- Girdi doğrulama ----------

function parseProfile(b: any, prevConsent: string | null = null): Profile {
  const p = { ...DEFAULT_PROFILE };
  const hh = Number(b?.household_size);
  if (!(Number.isInteger(hh) && hh >= 1 && hh <= 12)) throw new ApiError(400, "bad_profile", "Hane 1 ile 12 kişi arasında olmalı.");
  p.household_size = hh;
  if (b.weekly_budget_try != null && b.weekly_budget_try !== "") {
    const v = Number(b.weekly_budget_try);
    if (!(v >= 0)) throw new ApiError(400, "bad_profile", "Bütçe geçerli bir tutar olmalı.");
    p.weekly_budget_try = v;
  }
  const diets: Diet[] = ["hepsi", "vejetaryen", "vegan"];
  p.diet = diets.includes(b.diet) ? b.diet : "hepsi";
  p.halal_sensitive = b.halal_sensitive !== false;
  p.allergies = (Array.isArray(b.allergies) ? b.allergies : []).filter((a: string) => ALLERGEN_KEYS.includes(a as AllergenKey));
  p.dislikes = (Array.isArray(b.dislikes) ? b.dislikes : []).map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 30)
    .map((s: string) => s.slice(0, 40));
  if (b.max_weekday_minutes != null && b.max_weekday_minutes !== "") {
    const m = Number(b.max_weekday_minutes);
    if (!(m >= 10 && m <= 240)) throw new ApiError(400, "bad_profile", "Süre sınırı 10-240 dakika olmalı.");
    p.max_weekday_minutes = m;
  }
  if (b.body) {
    const body = validateBody(b.body);
    if (typeof body === "string") throw new ApiError(400, "bad_body", body);
    p.body = body;
  }
  // Alerji ve vücut bilgisi sağlık verisidir: açık rıza olmadan kaydedilmez.
  p.health_consent_at = prevConsent ?? (b.health_consent === true ? new Date().toISOString() : null);
  if ((p.body || p.allergies.length) && !p.health_consent_at) {
    throw new ApiError(400, "consent_required", "Alerji ve vücut bilgilerinizi kaydetmek için sağlık verilerinin işlenmesine açık rıza vermeniz gerekiyor.");
  }
  return p;
}

function parsePantry(b: any, partial = false): Partial<PantryItem> {
  const out: Partial<PantryItem> = {};
  if (!partial || b.name !== undefined) {
    const name = String(b?.name ?? "").trim();
    if (!name || name.length > 80) throw new ApiError(400, "bad_item", "Malzeme adı girin.");
    out.name = name;
  }
  if (!partial || b.qty !== undefined) {
    if (b.qty == null || b.qty === "") out.qty = null;
    else {
      const q = Number(b.qty);
      if (!(q > 0)) throw new ApiError(400, "bad_item", "Miktar sıfırdan büyük olmalı.");
      out.qty = q;
    }
  }
  if (!partial || b.unit !== undefined) {
    if (b.unit != null && !isUnit(b.unit)) throw new ApiError(400, "bad_item", "Geçersiz birim.");
    out.unit = b.unit ?? null;
  }
  if (!partial || b.expires_on !== undefined) {
    if (b.expires_on && !/^\d{4}-\d{2}-\d{2}$/.test(b.expires_on)) throw new ApiError(400, "bad_item", "Tarih YYYY-AA-GG biçiminde olmalı.");
    out.expires_on = b.expires_on || null;
  }
  return out;
}

// ---------- Uygulama ----------

export function createApp(db: DB, provider: Provider = defaultProvider()) {
  const r = new Router();
  // Diyet yemekleri kütüphanesini (herkese açık tarifler) veritabanına yükle.
  for (const { slots: _s, ...rec } of DIET_RECIPES) {
    db.prepare("INSERT OR REPLACE INTO recipes (id, user_id, source, data) VALUES (?, NULL, 'diyet', ?)").run(rec.id, JSON.stringify(rec));
  }
  const llmGuard = (uid: string) => rateLimit(`llm:${uid}`, config.limits.llmPerHour, 3600_000,
    "Kısa sürede çok fazla öneri istendi. Bir süre sonra tekrar deneyin.");

  r.add("GET", "/health", () => ({ ok: true, mock: config.llmMock, test: config.testMode || !config.isProd }), { auth: false });

  // Giriş
  r.add("POST", "/auth/email/start", ({ body }) => startEmailLogin(db, body.email), { auth: false });
  r.add("POST", "/auth/email/verify", ({ body }) => ({ token: verifyEmailLogin(db, body.email, body.code) }), { auth: false });
  r.add("POST", "/auth/apple", async ({ body }) => ({ token: await appleLogin(db, body.identityToken) }), { auth: false });
  r.add("POST", "/auth/google", async ({ body }) => ({ token: await googleLogin(db, body.idToken) }), { auth: false });
  r.add("POST", "/auth/logout", ({ req }) => { deleteSession(db, req.headers.authorization); return { ok: true }; });

  // Profil
  r.add("GET", "/me", ({ userId }) => {
    const u = db.prepare("SELECT email, created_at FROM users WHERE id = ?").get(userId!) as { email: string | null; created_at: string };
    const hasProfile = !!db.prepare("SELECT 1 FROM profiles WHERE user_id = ?").get(userId!);
    const profile = getProfile(db, userId!);
    return {
      id: userId, email: u.email, created_at: u.created_at, has_profile: hasProfile, profile,
      targets: profile.body ? computeTargets(profile.body) : null,
      ...usageSummary(db, userId!),
    };
  });
  r.add("PUT", "/profile", ({ userId, body }) => {
    const p = parseProfile(body, getProfile(db, userId!).health_consent_at);
    db.prepare("INSERT OR REPLACE INTO profiles (user_id, data) VALUES (?, ?)").run(userId!, JSON.stringify(p));
    return p;
  });

  // Evdeki malzemeler
  r.add("GET", "/pantry", ({ userId }) => getPantry(db, userId!));
  r.add("POST", "/pantry", ({ userId, body }) => {
    const p = parsePantry(body) as PantryItem;
    const id = newId();
    db.prepare("INSERT INTO pantry (id, user_id, name, qty, unit, expires_on) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, userId!, p.name, p.qty, p.unit, p.expires_on ?? null);
    return { id, ...p };
  });
  r.add("PATCH", "/pantry/:id", ({ userId, params, body }) => {
    const p = parsePantry(body, true);
    const cols = Object.keys(p);
    if (cols.length) {
      const res = db.prepare(`UPDATE pantry SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ? AND user_id = ?`)
        .run(...(cols.map((c) => (p as any)[c]) as (string | number | null)[]), params.id, userId!);
      if (!res.changes) throw new ApiError(404, "not_found", "Malzeme bulunamadı.");
    }
    return getPantry(db, userId!).find((i) => i.id === params.id);
  });
  r.add("DELETE", "/pantry/:id", ({ userId, params }) => {
    db.prepare("DELETE FROM pantry WHERE id = ? AND user_id = ?").run(params.id, userId!);
    return { ok: true };
  });

  // Birim fiyatlar
  r.add("GET", "/prices", ({ userId }) => getPrices(db, userId!));
  r.add("PUT", "/prices", ({ userId, body }) => {
    const name = String(body?.name ?? "").trim();
    const price = Number(body?.price_try);
    if (!name || !isUnit(body?.unit) || !(price > 0)) throw new ApiError(400, "bad_price", "Malzeme, birim ve sıfırdan büyük fiyat girin.");
    db.prepare(`INSERT INTO prices (user_id, name_norm, name, unit, price_try) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (user_id, name_norm) DO UPDATE SET name = excluded.name, unit = excluded.unit, price_try = excluded.price_try, updated_at = datetime('now')`)
      .run(userId!, normalize(name), name, body.unit, price);
    return getPrices(db, userId!);
  });
  r.add("DELETE", "/prices/:name", ({ userId, params }) => {
    db.prepare("DELETE FROM prices WHERE user_id = ? AND name_norm = ?").run(userId!, normalize(params.name));
    return getPrices(db, userId!);
  });

  // Haftalık menü
  r.add("POST", "/plans", async ({ userId, body }) => {
    const uid = userId!;
    assertQuota(db, uid, "plan");
    const input = genInput(db, uid);
    const key = cacheKey({ k: "plan", input, mock: config.llmMock, model: config.modelFast });
    let result = body?.fresh ? null : cacheGet<{ plan: MealPlan; warnings: string[] }>(db, key);
    if (!result) {
      llmGuard(uid);
      result = await generatePlan(input, provider);
      cacheSet(db, key, result);
      addUsage(db, uid, "plan");
    }
    const stored = savePlan(db, uid, result.plan, input.profile.household_size, result.warnings);
    return expandPlan(db, uid, stored);
  });
  r.add("GET", "/plans/current", ({ userId }) => {
    const p = currentPlan(db, userId!);
    return p ? expandPlan(db, userId!, p) : null;
  });
  r.add("POST", "/plans/:id/swap", async ({ userId, params, body }) => {
    const uid = userId!;
    const p = currentPlan(db, uid);
    if (!p || p.id !== params.id) throw new ApiError(404, "not_found", "Menü bulunamadı.");
    const day = Number(body?.day);
    const slot = body?.slot as MealSlot;
    const target = p.days.find((d) => d.day === day);
    if (!target || !MEAL_SLOTS.includes(slot)) throw new ApiError(400, "bad_slot", "Geçersiz gün ya da öğün.");
    assertQuota(db, uid, "swap");
    llmGuard(uid);
    const full = expandPlan(db, uid, p);
    const current = full.days.find((d) => d.day === day)![slot].name_tr;
    const variety = full.days.flatMap((d) => MEAL_SLOTS.map((s) => d[s].name_tr)).filter((n) => n !== current);
    const recipe = await generateSingle(genInput(db, uid), { slot, day, avoid: [current], variety }, provider);
    target[slot] = saveRecipe(db, uid, recipe).id;
    db.prepare("UPDATE plans SET data = ? WHERE id = ?").run(JSON.stringify(p.days), p.id);
    addUsage(db, uid, "swap");
    return expandPlan(db, uid, p);
  });

  // Bu akşam ne pişirsem
  r.add("POST", "/tonight", async ({ userId, body }) => {
    const uid = userId!;
    assertQuota(db, uid, "tonight");
    const avoid = (Array.isArray(body?.exclude) ? body.exclude : []).map(String).slice(0, 30);
    const input = genInput(db, uid);
    const req = { slot: "aksam" as const, day: trWeekday(), avoid, tonight: true };
    const key = cacheKey({ k: "tonight", input, req, mock: config.llmMock, model: config.modelFast });
    let recipe = cacheGet<Recipe>(db, key);
    if (!recipe) {
      llmGuard(uid);
      recipe = await generateSingle(input, req, provider);
      cacheSet(db, key, recipe);
      addUsage(db, uid, "tonight");
    }
    return saveRecipe(db, uid, recipe, "tonight");
  });

  // Tarif
  r.add("GET", "/recipes/:id", ({ userId, params }) => getRecipe(db, userId!, params.id));
  r.add("POST", "/recipes/:id/feedback", ({ userId, params, body }) => {
    const rec = getRecipe(db, userId!, params.id);
    const vote = Number(body?.vote);
    if (vote === 0) db.prepare("DELETE FROM feedback WHERE user_id = ? AND recipe_name = ?").run(userId!, rec.name_tr);
    else if (vote === 1 || vote === -1) {
      db.prepare(`INSERT INTO feedback (user_id, recipe_name, vote) VALUES (?, ?, ?)
        ON CONFLICT (user_id, recipe_name) DO UPDATE SET vote = excluded.vote, updated_at = datetime('now')`).run(userId!, rec.name_tr, vote);
    } else throw new ApiError(400, "bad_vote", "Geçersiz oy.");
    return { ok: true };
  });

  // Market listesi
  r.add("GET", "/shopping-list", ({ userId }) => {
    const p = currentPlan(db, userId!);
    return p ? shoppingFor(db, userId!, p) : null;
  });
  r.add("POST", "/shopping-list/check", ({ userId, body }) => {
    const p = currentPlan(db, userId!);
    if (!p) throw new ApiError(404, "not_found", "Market listesi yok.");
    const updates = Array.isArray(body?.items) ? body.items : [body];
    for (const u of updates) {
      if (typeof u?.key !== "string") continue;
      const at = Number(u.updated_at) || Date.now();
      // Çevrimdışı yapılan işaretlemelerde en son yapılan geçerli olur.
      db.prepare(`INSERT INTO shopping_checks (user_id, plan_id, item_key, checked, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (user_id, plan_id, item_key) DO UPDATE SET checked = excluded.checked, updated_at = excluded.updated_at
        WHERE excluded.updated_at >= shopping_checks.updated_at`).run(userId!, p.id, u.key, u.checked ? 1 : 0, at);
    }
    return shoppingFor(db, userId!, p);
  });

  // Kalori ve makro takibi (Premium)
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const premiumOnly = (uid: string) => {
    if (!isPremium(db, uid)) throw new ApiError(402, "premium", "Kalori ve makro takibi Premium'a özel.");
  };
  const consentOnly = (uid: string) => {
    if (!getProfile(db, uid).health_consent_at) {
      throw new ApiError(400, "consent_required", "Bu kaydı tutmak için Diyet programım ekranından sağlık verileri açık rızasını vermeniz gerekiyor.");
    }
  };
  const logDay = (uid: string, date: string) => {
    const entries = db.prepare("SELECT id, date, slot, name, kcal, protein_g, karb_g, yag_g, recipe_id, portion FROM food_log WHERE user_id = ? AND date = ? ORDER BY created_at")
      .all(uid, date) as { kcal: number; protein_g: number; karb_g: number; yag_g: number }[];
    const sum = (k: "kcal" | "protein_g" | "karb_g" | "yag_g") => Math.round(entries.reduce((a, e) => a + e[k], 0));
    return { date, entries, totals: { kcal: sum("kcal"), protein_g: sum("protein_g"), karb_g: sum("karb_g"), yag_g: sum("yag_g") } };
  };
  r.add("GET", "/log/:date", ({ userId, params }) => {
    premiumOnly(userId!);
    if (!DATE_RE.test(params.date)) throw new ApiError(400, "bad_date", "Geçersiz tarih.");
    return logDay(userId!, params.date);
  });
  r.add("GET", "/log-week/:date", ({ userId, params }) => {
    premiumOnly(userId!);
    if (!DATE_RE.test(params.date)) throw new ApiError(400, "bad_date", "Geçersiz tarih.");
    const end = new Date(params.date + "T00:00:00Z");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(end.getTime() - (6 - i) * 86400_000).toISOString().slice(0, 10);
      return { date: d, totals: logDay(userId!, d).totals };
    });
  });
  r.add("POST", "/log", ({ userId, body }) => {
    const uid = userId!;
    premiumOnly(uid);
    consentOnly(uid);
    const date = String(body?.date ?? "");
    if (!DATE_RE.test(date)) throw new ApiError(400, "bad_date", "Geçersiz tarih.");
    const slot = ["kahvalti", "ogle", "aksam", "ara"].includes(body?.slot) ? body.slot : "ara";
    const portion = body?.portion == null ? 1 : Number(body.portion);
    if (!(portion > 0 && portion <= 10)) throw new ApiError(400, "bad_portion", "Porsiyon 0-10 arasında olmalı.");
    let e: { name: string; kcal: number; protein_g: number; karb_g: number; yag_g: number; recipe_id: string | null };
    if (body?.recipe_id) {
      const rec = getRecipe(db, uid, String(body.recipe_id));
      if (!rec.nutrition) throw new ApiError(400, "no_nutrition", "Bu tarifin besin bilgisi yok, elle ekleyin.");
      const n = rec.nutrition;
      e = { name: rec.name_tr, kcal: n.kcal * portion, protein_g: n.protein_g * portion, karb_g: n.karb_g * portion, yag_g: n.yag_g * portion, recipe_id: rec.id };
    } else {
      const name = String(body?.name ?? "").trim().slice(0, 80);
      const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
      const kcal = num(body?.kcal), p = num(body?.protein_g), c = num(body?.karb_g), f = num(body?.yag_g);
      if (!name) throw new ApiError(400, "bad_entry", "Yiyecek adı girin.");
      if (![kcal, p, c, f].every((v) => Number.isFinite(v) && v >= 0 && v <= 5000)) throw new ApiError(400, "bad_entry", "Değerler sıfır ya da daha büyük olmalı.");
      e = { name, kcal: kcal * portion, protein_g: p * portion, karb_g: c * portion, yag_g: f * portion, recipe_id: null };
    }
    db.prepare("INSERT INTO food_log (id, user_id, date, slot, name, kcal, protein_g, karb_g, yag_g, recipe_id, portion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(newId(), uid, date, slot, e.name, e.kcal, e.protein_g, e.karb_g, e.yag_g, e.recipe_id, portion);
    return logDay(uid, date);
  });
  r.add("DELETE", "/log/:id", ({ userId, params }) => {
    const row = db.prepare("SELECT date FROM food_log WHERE id = ? AND user_id = ?").get(params.id, userId!) as { date: string } | undefined;
    if (!row) throw new ApiError(404, "not_found", "Kayıt bulunamadı.");
    db.prepare("DELETE FROM food_log WHERE id = ?").run(params.id);
    return logDay(userId!, row.date);
  });

  // Su takibi
  const waterTarget = (uid: string) => {
    const b = getProfile(db, uid).body;
    return b ? Math.round((b.weight_kg * 33) / 50) * 50 : 2000;
  };
  const waterDay = (uid: string, date: string) => {
    const row = db.prepare("SELECT ml FROM water_log WHERE user_id = ? AND date = ?").get(uid, date) as { ml: number } | undefined;
    return { date, ml: row?.ml ?? 0, target_ml: waterTarget(uid) };
  };
  r.add("GET", "/water/:date", ({ userId, params }) => {
    if (!DATE_RE.test(params.date)) throw new ApiError(400, "bad_date", "Geçersiz tarih.");
    return waterDay(userId!, params.date);
  });
  r.add("POST", "/water", ({ userId, body }) => {
    const date = String(body?.date ?? "");
    const delta = Number(body?.ml);
    if (!DATE_RE.test(date) || !Number.isFinite(delta) || Math.abs(delta) > 2000) throw new ApiError(400, "bad_water", "Geçersiz değer.");
    const d = Math.round(delta);
    db.prepare(`INSERT INTO water_log (user_id, date, ml) VALUES (?, ?, MAX(0, ?))
      ON CONFLICT (user_id, date) DO UPDATE SET ml = MIN(10000, MAX(0, ml + ?))`).run(userId!, date, d, d);
    return waterDay(userId!, date);
  });

  // Kilo takibi: kaydedilen son kilo diyet programına da yansır.
  const weights = (uid: string) => db.prepare("SELECT date, kg FROM weight_log WHERE user_id = ? ORDER BY date DESC LIMIT 60").all(uid);
  r.add("GET", "/weight", ({ userId }) => weights(userId!));
  r.add("POST", "/weight", ({ userId, body }) => {
    consentOnly(userId!);
    const date = String(body?.date ?? "");
    const kg = Number(body?.kg);
    if (!DATE_RE.test(date) || !(kg >= 35 && kg <= 300)) throw new ApiError(400, "bad_weight", "Kilo 35-300 kg arasında olmalı.");
    db.prepare("INSERT INTO weight_log (user_id, date, kg) VALUES (?, ?, ?) ON CONFLICT (user_id, date) DO UPDATE SET kg = excluded.kg")
      .run(userId!, date, Math.round(kg * 10) / 10);
    const latest = db.prepare("SELECT kg FROM weight_log WHERE user_id = ? ORDER BY date DESC LIMIT 1").get(userId!) as { kg: number };
    const p = getProfile(db, userId!);
    if (p.body) {
      p.body = { ...p.body, weight_kg: latest.kg };
      db.prepare("INSERT OR REPLACE INTO profiles (user_id, data) VALUES (?, ?)").run(userId!, JSON.stringify(p));
    }
    return weights(userId!);
  });
  r.add("DELETE", "/weight/:date", ({ userId, params }) => {
    db.prepare("DELETE FROM weight_log WHERE user_id = ? AND date = ?").run(userId!, params.date);
    return weights(userId!);
  });

  // Diyet yemekleri (herkese açık)
  r.add("GET", "/library/diet", () =>
    (db.prepare("SELECT data FROM recipes WHERE source = 'diyet' AND user_id IS NULL").all() as { data: string }[]).map((x) => JSON.parse(x.data)));

  // Yemeklerim: kullanıcının kendi tarifleri (Premium)
  const myRecipes = (uid: string) =>
    (db.prepare("SELECT data FROM recipes WHERE user_id = ? AND source = 'custom' ORDER BY created_at DESC, rowid DESC").all(uid) as { data: string }[])
      .map((x) => JSON.parse(x.data));
  r.add("GET", "/my-recipes", ({ userId }) => myRecipes(userId!));
  r.add("POST", "/my-recipes", ({ userId, body }) => {
    premiumOnly(userId!);
    const n = db.prepare("SELECT COUNT(*) c FROM recipes WHERE user_id = ? AND source = 'custom'").get(userId!) as { c: number };
    if (n.c >= 300) throw new ApiError(400, "too_many", "En fazla 300 kendi yemeğiniz olabilir.");
    const rec = buildCustomRecipe(body);
    if (typeof rec === "string") throw new ApiError(400, "bad_recipe", rec);
    return saveRecipe(db, userId!, rec, "custom");
  });
  r.add("DELETE", "/my-recipes/:id", ({ userId, params }) => {
    db.prepare("DELETE FROM recipes WHERE id = ? AND user_id = ? AND source = 'custom'").run(params.id, userId!);
    return myRecipes(userId!);
  });

  // KVKK: sağlık verilerini sil ve açık rızayı geri al
  r.add("DELETE", "/health-data", ({ userId }) => {
    const uid = userId!;
    tx(db, () => {
      const p = getProfile(db, uid);
      db.prepare("INSERT OR REPLACE INTO profiles (user_id, data) VALUES (?, ?)")
        .run(uid, JSON.stringify({ ...p, body: null, allergies: [], health_consent_at: null }));
      for (const t of ["food_log", "weight_log", "water_log"]) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(uid);
    });
    return { ok: true };
  });

  // Notlar
  const listNotes = (uid: string) => db.prepare("SELECT id, text, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC").all(uid);
  const noteText = (v: unknown) => {
    const t = String(v ?? "").trim();
    if (!t) throw new ApiError(400, "bad_note", "Not boş olamaz.");
    if (t.length > 5000) throw new ApiError(400, "bad_note", "Not en fazla 5000 karakter olabilir.");
    return t;
  };
  r.add("GET", "/notes", ({ userId }) => listNotes(userId!));
  r.add("POST", "/notes", ({ userId, body }) => {
    const n = db.prepare("SELECT COUNT(*) c FROM notes WHERE user_id = ?").get(userId!) as { c: number };
    if (n.c >= 500) throw new ApiError(400, "too_many", "En fazla 500 not tutulabilir.");
    db.prepare("INSERT INTO notes (id, user_id, text) VALUES (?, ?, ?)").run(newId(), userId!, noteText(body?.text));
    return listNotes(userId!);
  });
  r.add("PUT", "/notes/:id", ({ userId, params, body }) => {
    const res = db.prepare("UPDATE notes SET text = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?").run(noteText(body?.text), params.id, userId!);
    if (!res.changes) throw new ApiError(404, "not_found", "Not bulunamadı.");
    return listNotes(userId!);
  });
  r.add("DELETE", "/notes/:id", ({ userId, params }) => {
    db.prepare("DELETE FROM notes WHERE id = ? AND user_id = ?").run(params.id, userId!);
    return listNotes(userId!);
  });

  // RevenueCat abonelik bildirimi: mağazadaki satın alma / yenileme / bitişi Premium durumuna yansıtır.
  // Uygulama, RevenueCat'e kullanıcı kimliği olarak bu sunucudaki kullanıcı id'sini verir (app_user_id).
  r.add("POST", "/webhooks/revenuecat", ({ req, body }) => {
    const secret = config.revenuecatWebhookSecret;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) throw new ApiError(401, "unauthorized", "Yetkisiz.");
    const ev = body?.event ?? {};
    const uid = String(ev.app_user_id ?? "");
    const exists = db.prepare("SELECT 1 FROM users WHERE id = ?").get(uid);
    if (!exists) return { ok: true, ignored: "unknown_user" };
    const on = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "SUBSCRIPTION_EXTENDED", "TEMPORARY_ENTITLEMENT_GRANT"];
    const off = ["EXPIRATION"];
    if (on.includes(ev.type)) db.prepare("UPDATE users SET plan = 'premium' WHERE id = ?").run(uid);
    else if (off.includes(ev.type)) db.prepare("UPDATE users SET plan = 'free' WHERE id = ?").run(uid);
    // CANCELLATION: dönem sonuna kadar Premium sürer; bitişte EXPIRATION gelir.
    return { ok: true };
  }, { auth: false });

  // Geliştirme: ödeme sistemi bağlanana kadar Premium'u denemek için. Üretimde kapalı.
  r.add("POST", "/dev/premium", ({ userId, body }) => {
    if (config.isProd && !config.testMode) throw new ApiError(404, "not_found", "Bulunamadı.");
    db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(body?.on ? "premium" : "free", userId!);
    return usageSummary(db, userId!);
  });

  // KVKK: veriyi indir ve hesabı sil
  r.add("GET", "/account/export", ({ userId }) => {
    const uid = userId!;
    const all = (sql: string) => db.prepare(sql).all(uid);
    return {
      user: db.prepare("SELECT id, email, plan, created_at FROM users WHERE id = ?").get(uid),
      profile: getProfile(db, uid),
      pantry: getPantry(db, uid),
      prices: getPrices(db, uid),
      feedback: all("SELECT recipe_name, vote, updated_at FROM feedback WHERE user_id = ?"),
      plans: all("SELECT id, week_start, servings, data, created_at FROM plans WHERE user_id = ?"),
      water: all("SELECT date, ml FROM water_log WHERE user_id = ?"),
      weight: all("SELECT date, kg FROM weight_log WHERE user_id = ?"),
      notes: all("SELECT text, updated_at FROM notes WHERE user_id = ?"),
      food_log: all("SELECT date, slot, name, kcal, protein_g, karb_g, yag_g, portion FROM food_log WHERE user_id = ?"),
      recipes: (all("SELECT data FROM recipes WHERE user_id = ?") as { data: string }[]).map((x) => JSON.parse(x.data)),
    };
  });
  r.add("DELETE", "/account", ({ userId }) => {
    db.prepare("DELETE FROM users WHERE id = ?").run(userId!);
    return { ok: true };
  });

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "authorization, content-type");
    res.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    try {
      const url = new URL(req.url ?? "/", "http://x");
      const m = r.match(req.method ?? "GET", url.pathname);
      if (!m) throw new ApiError(404, "not_found", "Bulunamadı.");
      const ctx: Ctx = { req, params: m.params, body: await readJson(req) };
      if (m.route.auth) {
        const uid = userFromToken(db, req.headers.authorization);
        if (!uid) throw new ApiError(401, "unauthorized", "Oturumunuz sona erdi, lütfen tekrar giriş yapın.");
        ctx.userId = uid;
        rateLimit(`req:${uid}`, config.limits.requestsPerMinute, 60_000);
      } else {
        rateLimit(`ip:${req.socket.remoteAddress}`, 30, 60_000);
      }
      send(res, 200, (await m.route.handler(ctx)) ?? null);
    } catch (e) {
      if (e instanceof ApiError) send(res, e.status, { error: { code: e.code, message: e.message } });
      else {
        console.error("[server] beklenmeyen hata", e);
        send(res, 500, { error: { code: "internal", message: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin." } });
      }
    }
  };
}
