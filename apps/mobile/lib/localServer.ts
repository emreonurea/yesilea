// Sunucusuz mod: uygulamanın sunucuya gönderdiği istekleri telefonda karşılar.
// Tüm veriler bu cihazda (web'de tarayıcının yerel deposunda) durur; hiçbir yere gönderilmez.
// Sunucudaki uç noktalarla aynı cevapları verir, böylece ekranlar iki modda da aynı çalışır.

import {
  ALLERGEN_KEYS, buildCustomRecipe, buildShoppingList, computeTargets, DEFAULT_PROFILE, DIET_RECIPES, estimateCost,
  groupByAisle, isUnit, localPlan, localSingle, MEAL_SLOTS, normalize, validateBody,
  type AllergenKey, type Diet, type MealSlot, type PantryItem, type Profile, type Recipe, type UnitPrice,
} from "@menu/shared";
import { kvGetSync, kvSetSync } from "./kv";

const KEY = "yesilea:yerel:v1";

type R = Recipe & { id: string };
interface StoredPlan { id: string; week_start: string; servings: number; days: { day: number; kahvalti: string; ogle: string; aksam: string }[]; warnings: string[] }
interface LogEntry { id: string; date: string; slot: string; name: string; kcal: number; protein_g: number; karb_g: number; yag_g: number; recipe_id: string | null; portion: number; created_at: number }

interface Data {
  has_profile: boolean;
  profile: Profile;
  premium: boolean;
  pantry: (PantryItem & { id: string })[];
  prices: (UnitPrice & { name_norm: string })[];
  recipes: Record<string, R>;
  my: string[];
  plan: StoredPlan | null;
  feedback: Record<string, number>;
  checks: Record<string, boolean>;
  log: LogEntry[];
  water: Record<string, number>;
  weights: Record<string, number>;
  notes: { id: string; text: string; updated_at: string }[];
}

const empty = (): Data => ({
  has_profile: false, profile: { ...DEFAULT_PROFILE }, premium: true, pantry: [], prices: [], recipes: {}, my: [],
  plan: null, feedback: {}, checks: {}, log: [], water: {}, weights: {}, notes: [],
});

let cache: Data | null = null;
function db(): Data {
  if (cache) return cache;
  try {
    const raw = kvGetSync(KEY);
    cache = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    cache = empty();
  }
  return cache!;
}
function save() {
  kvSetSync(KEY, JSON.stringify(db()));
}

export class LocalError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
const fail = (status: number, code: string, message: string): never => {
  throw new LocalError(status, code, message);
};

const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const nowIso = () => new Date().toISOString().replace("T", " ").slice(0, 19);

function weekStart(): string {
  const d = new Date();
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
const weekday = () => ((new Date().getDay() + 6) % 7) + 1;

// Diyet kütüphanesi her açılışta kayıtlı olsun
function ensureLibrary() {
  const d = db();
  for (const { slots: _s, ...r } of DIET_RECIPES) d.recipes[r.id] = r as R;
}

function saveRecipe(r: Recipe): R {
  const id = newId();
  const withId = { ...r, id };
  db().recipes[id] = withId;
  return withId;
}
function getRecipe(id: string): R {
  return db().recipes[id] ?? fail(404, "not_found", "Tarif bulunamadı.");
}

const genInput = () => {
  const d = db();
  return {
    profile: d.premium ? d.profile : { ...d.profile, body: null },
    pantry: d.pantry,
    disliked: Object.entries(d.feedback).filter(([, v]) => v < 0).map(([k]) => k),
  };
};

function expandPlan(p: StoredPlan) {
  return {
    id: p.id, week_start: p.week_start, servings: p.servings, warnings: p.warnings,
    days: p.days.map((x) => ({ day: x.day, kahvalti: getRecipe(x.kahvalti), ogle: getRecipe(x.ogle), aksam: getRecipe(x.aksam) })),
  };
}

function shopping() {
  const d = db();
  if (!d.plan) return null;
  const full = expandPlan(d.plan);
  const entries = full.days.flatMap((x) => MEAL_SLOTS.map((s) => ({ recipe: x[s], servings: d.plan!.servings })));
  const items = buildShoppingList(entries, d.pantry);
  const withChecks = items.map((i) => ({ ...i, checked: d.checks[`${d.plan!.id}|${i.key}`] ?? false }));
  return { plan_id: d.plan.id, groups: groupByAisle(withChecks), cost: estimateCost(items, d.prices), budget_try: d.profile.weekly_budget_try };
}

function logDay(date: string) {
  const entries = db().log.filter((e) => e.date === date).sort((a, b) => a.created_at - b.created_at);
  const sum = (k: "kcal" | "protein_g" | "karb_g" | "yag_g") => Math.round(entries.reduce((a, e) => a + e[k], 0));
  return { date, entries, totals: { kcal: sum("kcal"), protein_g: sum("protein_g"), karb_g: sum("karb_g"), yag_g: sum("yag_g") } };
}

function waterDay(date: string) {
  const b = db().profile.body;
  return { date, ml: db().water[date] ?? 0, target_ml: b ? Math.round((b.weight_kg * 33) / 50) * 50 : 2000 };
}

const weightList = () => Object.entries(db().weights).map(([date, kg]) => ({ date, kg })).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60);
const myRecipes = () => db().my.map((id) => db().recipes[id]).filter(Boolean);
const notesList = () => [...db().notes].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
const pantryList = () => [...db().pantry].sort((a, b) => (a.expires_on ?? "9999").localeCompare(b.expires_on ?? "9999") || a.name.localeCompare(b.name, "tr"));
const pricesList = () => db().prices.map(({ name_norm: _n, ...p }) => p).sort((a, b) => a.name.localeCompare(b.name, "tr"));

function parseProfile(b: any, prevConsent: string | null): Profile {
  const p = { ...DEFAULT_PROFILE };
  const hh = Number(b?.household_size);
  if (!(Number.isInteger(hh) && hh >= 1 && hh <= 12)) fail(400, "bad_profile", "Hane 1 ile 12 kişi arasında olmalı.");
  p.household_size = hh;
  if (b.weekly_budget_try != null && b.weekly_budget_try !== "") {
    const v = Number(b.weekly_budget_try);
    if (!(v >= 0)) fail(400, "bad_profile", "Bütçe geçerli bir tutar olmalı.");
    p.weekly_budget_try = v;
  }
  p.diet = (["hepsi", "vejetaryen", "vegan"] as Diet[]).includes(b.diet) ? b.diet : "hepsi";
  p.halal_sensitive = b.halal_sensitive !== false;
  p.allergies = (Array.isArray(b.allergies) ? b.allergies : []).filter((a: string) => ALLERGEN_KEYS.includes(a as AllergenKey));
  p.dislikes = (Array.isArray(b.dislikes) ? b.dislikes : []).map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 30);
  if (b.max_weekday_minutes != null && b.max_weekday_minutes !== "") {
    const m = Number(b.max_weekday_minutes);
    if (!(m >= 10 && m <= 240)) fail(400, "bad_profile", "Süre sınırı 10-240 dakika olmalı.");
    p.max_weekday_minutes = m;
  }
  if (b.body) {
    const body = validateBody(b.body);
    if (typeof body === "string") fail(400, "bad_body", body);
    p.body = body as Profile["body"];
  }
  p.health_consent_at = prevConsent ?? (b.health_consent === true ? new Date().toISOString() : null);
  if ((p.body || p.allergies.length) && !p.health_consent_at) {
    fail(400, "consent_required", "Alerji ve vücut bilgilerinizi kaydetmek için sağlık verilerinin işlenmesine açık rıza vermeniz gerekiyor.");
  }
  return p;
}

const consentOnly = () => {
  if (!db().profile.health_consent_at) fail(400, "consent_required", "Bu kaydı tutmak için Diyet programım ekranından sağlık verileri açık rızasını vermeniz gerekiyor.");
};

type Handler = (body: any, params: Record<string, string>) => unknown;
const routes: [string, string, Handler][] = [
  ["GET", "/health", () => ({ ok: true, mock: true, test: true, local: true })],
  ["POST", "/auth/logout", () => ({ ok: true })],

  ["GET", "/me", () => {
    const d = db();
    return {
      id: "yerel", email: null, has_profile: d.has_profile, profile: d.profile,
      targets: d.profile.body ? computeTargets(d.profile.body) : null, premium: d.premium,
      usage: { plan: { used: 0, limit: null }, tonight: { used: 0, limit: null }, swap: { used: 0, limit: null } },
    };
  }],
  ["PUT", "/profile", (b) => {
    const d = db();
    d.profile = parseProfile(b, d.profile.health_consent_at);
    d.has_profile = true;
    return d.profile;
  }],
  ["DELETE", "/health-data", () => {
    const d = db();
    d.profile = { ...d.profile, body: null, allergies: [], health_consent_at: null };
    d.log = []; d.water = {}; d.weights = {};
    return { ok: true };
  }],

  ["GET", "/pantry", () => pantryList()],
  ["POST", "/pantry", (b) => {
    const name = String(b?.name ?? "").trim();
    if (!name) fail(400, "bad_item", "Malzeme adı girin.");
    const qty = b.qty == null || b.qty === "" ? null : Number(b.qty);
    if (qty !== null && !(qty > 0)) fail(400, "bad_item", "Miktar sıfırdan büyük olmalı.");
    if (b.unit != null && !isUnit(b.unit)) fail(400, "bad_item", "Geçersiz birim.");
    const item = { id: newId(), name, qty, unit: b.unit ?? null, expires_on: b.expires_on || null };
    db().pantry.push(item);
    return item;
  }],
  ["PATCH", "/pantry/:id", (b, p) => {
    const it = db().pantry.find((x) => x.id === p.id) ?? fail(404, "not_found", "Malzeme bulunamadı.");
    Object.assign(it, b);
    return it;
  }],
  ["DELETE", "/pantry/:id", (_b, p) => {
    db().pantry = db().pantry.filter((x) => x.id !== p.id);
    return { ok: true };
  }],

  ["GET", "/prices", () => pricesList()],
  ["PUT", "/prices", (b) => {
    const name = String(b?.name ?? "").trim();
    const price = Number(b?.price_try);
    if (!name || !isUnit(b?.unit) || !(price > 0)) fail(400, "bad_price", "Malzeme, birim ve sıfırdan büyük fiyat girin.");
    const nn = normalize(name);
    const d = db();
    d.prices = d.prices.filter((x) => x.name_norm !== nn);
    d.prices.push({ name, unit: b.unit, price_try: price, name_norm: nn });
    return pricesList();
  }],
  ["DELETE", "/prices/:name", (_b, p) => {
    db().prices = db().prices.filter((x) => x.name_norm !== normalize(p.name));
    return pricesList();
  }],

  ["GET", "/plans/current", () => (db().plan ? expandPlan(db().plan!) : null)],
  ["POST", "/plans", () => {
    const input = genInput();
    const plan = localPlan(input) ?? fail(422, "no_plan", "Tercihlerinize uyan yeterli tarif bulunamadı. Profil kısıtlarınızı gevşetip tekrar deneyin.");
    const days = plan.days.map((x) => ({ day: x.day, kahvalti: saveRecipe(x.kahvalti).id, ogle: saveRecipe(x.ogle).id, aksam: saveRecipe(x.aksam).id }));
    db().plan = { id: newId(), week_start: weekStart(), servings: input.profile.household_size, days, warnings: [] };
    return expandPlan(db().plan!);
  }],
  ["POST", "/plans/:id/swap", (b, p) => {
    const plan = db().plan;
    if (!plan || plan.id !== p.id) fail(404, "not_found", "Menü bulunamadı.");
    const day = Number(b?.day);
    const slot = b?.slot as MealSlot;
    const target = plan!.days.find((x) => x.day === day);
    if (!target || !MEAL_SLOTS.includes(slot)) fail(400, "bad_slot", "Geçersiz gün ya da öğün.");
    const full = expandPlan(plan!);
    const current = full.days.find((x) => x.day === day)![slot].name_tr;
    const variety = full.days.flatMap((x) => MEAL_SLOTS.map((s) => x[s].name_tr)).filter((n) => n !== current);
    const r = localSingle(genInput(), slot, day, [current], variety) ?? fail(422, "no_recipe", "Bu öğün için başka uygun tarif bulunamadı.");
    target![slot] = saveRecipe(r).id;
    return expandPlan(plan!);
  }],
  ["POST", "/tonight", (b) => {
    const exclude = (Array.isArray(b?.exclude) ? b.exclude : []).map(String);
    const r = localSingle(genInput(), "aksam", weekday(), exclude) ?? fail(422, "no_recipe", "Başka uygun tarif kalmadı. Profil kısıtlarınızı gevşetip tekrar deneyin.");
    return saveRecipe(r);
  }],

  ["GET", "/recipes/:id", (_b, p) => getRecipe(p.id)],
  ["POST", "/recipes/:id/feedback", (b, p) => {
    const r = getRecipe(p.id);
    const vote = Number(b?.vote);
    if (vote === 0) delete db().feedback[r.name_tr];
    else db().feedback[r.name_tr] = vote;
    return { ok: true };
  }],

  ["GET", "/shopping-list", () => shopping()],
  ["POST", "/shopping-list/check", (b) => {
    const d = db();
    if (!d.plan) fail(404, "not_found", "Market listesi yok.");
    if (typeof b?.key === "string") d.checks[`${d.plan!.id}|${b.key}`] = !!b.checked;
    return shopping();
  }],

  ["GET", "/log/:date", (_b, p) => logDay(p.date)],
  ["GET", "/log-week/:date", (_b, p) => {
    const end = new Date(p.date + "T00:00:00Z");
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(end.getTime() - (6 - i) * 86400_000).toISOString().slice(0, 10);
      return { date: dt, totals: logDay(dt).totals };
    });
  }],
  ["POST", "/log", (b) => {
    consentOnly();
    const date = String(b?.date ?? "");
    if (!DATE_RE.test(date)) fail(400, "bad_date", "Geçersiz tarih.");
    const slot = ["kahvalti", "ogle", "aksam", "ara"].includes(b?.slot) ? b.slot : "ara";
    const portion = b?.portion == null ? 1 : Number(b.portion);
    if (!(portion > 0 && portion <= 10)) fail(400, "bad_portion", "Porsiyon 0-10 arasında olmalı.");
    let e: Omit<LogEntry, "id" | "date" | "slot" | "portion" | "created_at">;
    if (b?.recipe_id) {
      const r = getRecipe(String(b.recipe_id));
      const n = r.nutrition ?? fail(400, "no_nutrition", "Bu tarifin besin bilgisi yok, elle ekleyin.");
      e = { name: r.name_tr, kcal: n.kcal * portion, protein_g: n.protein_g * portion, karb_g: n.karb_g * portion, yag_g: n.yag_g * portion, recipe_id: r.id };
    } else {
      const name = String(b?.name ?? "").trim();
      const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
      const vals = [b?.kcal, b?.protein_g, b?.karb_g, b?.yag_g].map(num);
      if (!name) fail(400, "bad_entry", "Yiyecek adı girin.");
      if (!vals.every((v) => Number.isFinite(v) && v >= 0 && v <= 5000)) fail(400, "bad_entry", "Değerler sıfır ya da daha büyük olmalı.");
      e = { name, kcal: vals[0] * portion, protein_g: vals[1] * portion, karb_g: vals[2] * portion, yag_g: vals[3] * portion, recipe_id: null };
    }
    db().log.push({ ...e, id: newId(), date, slot, portion, created_at: Date.now() });
    return logDay(date);
  }],
  ["DELETE", "/log/:id", (_b, p) => {
    const e = db().log.find((x) => x.id === p.id) ?? fail(404, "not_found", "Kayıt bulunamadı.");
    db().log = db().log.filter((x) => x.id !== p.id);
    return logDay(e.date);
  }],

  ["GET", "/water/:date", (_b, p) => waterDay(p.date)],
  ["POST", "/water", (b) => {
    const date = String(b?.date ?? "");
    const delta = Math.round(Number(b?.ml));
    if (!DATE_RE.test(date) || !Number.isFinite(delta)) fail(400, "bad_water", "Geçersiz değer.");
    db().water[date] = Math.min(10000, Math.max(0, (db().water[date] ?? 0) + delta));
    return waterDay(date);
  }],
  ["GET", "/weight", () => weightList()],
  ["POST", "/weight", (b) => {
    consentOnly();
    const date = String(b?.date ?? "");
    const kg = Number(b?.kg);
    if (!DATE_RE.test(date) || !(kg >= 35 && kg <= 300)) fail(400, "bad_weight", "Kilo 35-300 kg arasında olmalı.");
    const d = db();
    d.weights[date] = Math.round(kg * 10) / 10;
    const latest = weightList()[0];
    if (d.profile.body && latest) d.profile = { ...d.profile, body: { ...d.profile.body, weight_kg: latest.kg } };
    return weightList();
  }],
  ["DELETE", "/weight/:date", (_b, p) => {
    delete db().weights[p.date];
    return weightList();
  }],

  ["GET", "/library/diet", () => DIET_RECIPES.map((r) => db().recipes[r.id] ? { ...db().recipes[r.id], slots: r.slots } : r)],
  ["GET", "/my-recipes", () => myRecipes()],
  ["POST", "/my-recipes", (b) => {
    const rec = buildCustomRecipe(b);
    if (typeof rec === "string") fail(400, "bad_recipe", rec);
    const saved = saveRecipe(rec as Recipe);
    db().my.unshift(saved.id);
    return saved;
  }],
  ["DELETE", "/my-recipes/:id", (_b, p) => {
    db().my = db().my.filter((x) => x !== p.id);
    delete db().recipes[p.id];
    return myRecipes();
  }],

  ["GET", "/notes", () => notesList()],
  ["POST", "/notes", (b) => {
    const t = String(b?.text ?? "").trim();
    if (!t) fail(400, "bad_note", "Not boş olamaz.");
    db().notes.push({ id: newId(), text: t.slice(0, 5000), updated_at: nowIso() });
    return notesList();
  }],
  ["PUT", "/notes/:id", (b, p) => {
    const n = db().notes.find((x) => x.id === p.id) ?? fail(404, "not_found", "Not bulunamadı.");
    const t = String(b?.text ?? "").trim();
    if (!t) fail(400, "bad_note", "Not boş olamaz.");
    n.text = t.slice(0, 5000);
    n.updated_at = nowIso();
    return notesList();
  }],
  ["DELETE", "/notes/:id", (_b, p) => {
    db().notes = db().notes.filter((x) => x.id !== p.id);
    return notesList();
  }],

  ["POST", "/dev/premium", (b) => {
    db().premium = !!b?.on;
    return { premium: db().premium };
  }],
  ["GET", "/account/export", () => db()],
  ["DELETE", "/account", () => {
    cache = empty();
    return { ok: true };
  }],
];

/** Uygulamanın istek fonksiyonunun yerine geçer. */
export async function localRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  ensureLibrary();
  const parts = path.split("?")[0].split("/").filter(Boolean);
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const pp = pattern.split("/").filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (pp.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = decodeURIComponent(parts[i])), true) : seg === parts[i]))) {
      const result = handler(body ?? {}, params);
      save();
      return JSON.parse(JSON.stringify(result ?? null)) as T;
    }
  }
  throw new LocalError(404, "not_found", "Bulunamadı.");
}
