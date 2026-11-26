import { createHash } from "node:crypto";
import { config } from "./config";
import type { DB } from "./db";
import { ApiError } from "./http";

// ---------- İstek sınırı (bellekte, tek sunucu için) ----------

const windows = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number, message = "Çok sık istek gönderildi. Biraz bekleyip tekrar deneyin.") {
  const now = Date.now();
  const arr = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new ApiError(429, "rate_limited", message);
  arr.push(now);
  windows.set(key, arr);
}

export function resetRateLimits() {
  windows.clear();
}

// ---------- Tarih yardımcıları (Türkiye saati, UTC+3) ----------

const TR_OFFSET = 3 * 3600_000;

export function trToday(now = Date.now()): Date {
  const d = new Date(now + TR_OFFSET);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Bugünün haftanın kaçıncı günü olduğu: 1 = Pazartesi ... 7 = Pazar. */
export function trWeekday(now = Date.now()): number {
  const wd = trToday(now).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function weekStart(now = Date.now()): string {
  const d = trToday(now);
  d.setUTCDate(d.getUTCDate() - (trWeekday(now) - 1));
  return d.toISOString().slice(0, 10);
}

export const dayKey = (now = Date.now()) => trToday(now).toISOString().slice(0, 10);

// ---------- Ücretsiz sürüm kullanım sınırları ----------

export type UsageKind = "plan" | "tonight" | "swap";

function period(kind: UsageKind) {
  return kind === "tonight" ? `d:${dayKey()}` : `w:${weekStart()}`;
}

function limitFor(kind: UsageKind) {
  const l = config.limits;
  return kind === "plan" ? l.freePlansPerWeek : kind === "tonight" ? l.freeTonightPerDay : l.freeSwapsPerWeek;
}

export function isPremium(db: DB, userId: string) {
  const row = db.prepare("SELECT plan FROM users WHERE id = ?").get(userId) as { plan: string } | undefined;
  return row?.plan === "premium";
}

export function usageCount(db: DB, userId: string, kind: UsageKind): number {
  const row = db.prepare("SELECT count FROM usage WHERE user_id = ? AND period = ? AND kind = ?").get(userId, period(kind), kind) as
    | { count: number } | undefined;
  return row?.count ?? 0;
}

export function assertQuota(db: DB, userId: string, kind: UsageKind) {
  if (isPremium(db, userId)) return;
  if (usageCount(db, userId, kind) >= limitFor(kind)) {
    const what = kind === "plan" ? "haftalık menü" : kind === "tonight" ? "günlük öneri" : "haftalık öğün değiştirme";
    throw new ApiError(402, "quota", `Ücretsiz sürümdeki ${what} hakkınız doldu. Sınırsız kullanım için aboneliğe geçebilirsiniz.`);
  }
}

export function addUsage(db: DB, userId: string, kind: UsageKind) {
  db.prepare(`INSERT INTO usage (user_id, period, kind, count) VALUES (?, ?, ?, 1)
    ON CONFLICT (user_id, period, kind) DO UPDATE SET count = count + 1`).run(userId, period(kind), kind);
}

export function usageSummary(db: DB, userId: string) {
  const premium = isPremium(db, userId);
  const kinds: UsageKind[] = ["plan", "tonight", "swap"];
  return {
    premium,
    usage: Object.fromEntries(kinds.map((k) => [k, { used: usageCount(db, userId, k), limit: premium ? null : limitFor(k) }])),
  };
}

// ---------- Model yanıt önbelleği ----------

export const cacheKey = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

export function cacheGet<T>(db: DB, key: string): T | null {
  const row = db.prepare("SELECT data, created_at FROM llm_cache WHERE key = ?").get(key) as { data: string; created_at: number } | undefined;
  if (!row || Date.now() - row.created_at > config.cacheDays * 86400_000) return null;
  return JSON.parse(row.data) as T;
}

export function cacheSet(db: DB, key: string, data: unknown) {
  db.prepare("INSERT OR REPLACE INTO llm_cache (key, data, created_at) VALUES (?, ?, ?)").run(key, JSON.stringify(data), Date.now());
}
