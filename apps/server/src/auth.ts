import { createHash, createPublicKey, randomBytes, randomInt, timingSafeEqual, verify } from "node:crypto";
import { config } from "./config";
import { newId, type DB } from "./db";
import { ApiError } from "./http";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// ---------- Oturum ----------

export function createSession(db: DB, userId: string): string {
  const token = randomBytes(32).toString("base64url");
  const exp = Date.now() + config.sessionDays * 86400_000;
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha(token), userId, exp);
  return token;
}

export function userFromToken(db: DB, header: string | undefined): string | null {
  const m = /^Bearer (.+)$/.exec(header ?? "");
  if (!m) return null;
  const row = db.prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?").get(sha(m[1])) as
    | { user_id: string; expires_at: number } | undefined;
  if (!row || row.expires_at < Date.now()) return null;
  return row.user_id;
}

export function deleteSession(db: DB, header: string | undefined) {
  const m = /^Bearer (.+)$/.exec(header ?? "");
  if (m) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(m[1]));
}

function findOrCreateUser(db: DB, field: "email" | "apple_sub" | "google_sub", value: string, email?: string): string {
  const row = db.prepare(`SELECT id FROM users WHERE ${field} = ?`).get(value) as { id: string } | undefined;
  if (row) return row.id;
  // Aynı e-postayla daha önce açılmış hesap varsa ona bağla.
  if (email && field !== "email") {
    const byEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string } | undefined;
    if (byEmail) {
      db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).run(value, byEmail.id);
      return byEmail.id;
    }
  }
  const id = newId();
  if (field === "email") db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(id, value);
  else db.prepare(`INSERT INTO users (id, ${field}, email) VALUES (?, ?, ?)`).run(id, value, email ?? null);
  return id;
}

// ---------- E-posta ile kod ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Kodu kullanıcıya iletir: Brevo yapılandırılmışsa e-postayla; değilse yalnızca geliştirme ya da test modunda. */
async function sendLoginEmail(email: string, code: string) {
  if (config.brevoApiKey && config.mailFrom) {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": config.brevoApiKey },
      body: JSON.stringify({
        sender: { email: config.mailFrom, name: "Yeşilea" },
        to: [{ email }],
        subject: `Yeşilea giriş kodunuz: ${code}`,
        textContent: `Yeşilea giriş kodunuz: ${code}\n\nKod 10 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayın.`,
      }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!r || !r.ok) throw new ApiError(502, "email_failed", "Giriş kodu gönderilemedi. Lütfen biraz sonra tekrar deneyin.");
    return;
  }
  if (!config.isProd || config.testMode) console.log(`[test] ${email} giriş kodu: ${code}`);
  else throw new ApiError(501, "email_not_configured", "E-posta gönderimi henüz yapılandırılmadı.");
}

/** Kod uygulamada gösterilsin mi? Yalnızca e-posta servisi yokken, geliştirme ya da test modunda. */
const showCodeInApp = () => !(config.brevoApiKey && config.mailFrom) && (!config.isProd || config.testMode);

export async function startEmailLogin(db: DB, rawEmail: unknown): Promise<{ dev_code?: string }> {
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ApiError(400, "bad_email", "Geçerli bir e-posta adresi girin.");
  const prev = db.prepare("SELECT expires_at FROM login_codes WHERE email = ?").get(email) as { expires_at: number } | undefined;
  if (prev && prev.expires_at - 9 * 60_000 > Date.now()) {
    throw new ApiError(429, "code_wait", "Yeni kod istemek için bir dakika bekleyin.");
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  db.prepare("INSERT OR REPLACE INTO login_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)")
    .run(email, sha(`${email}:${code}`), Date.now() + 10 * 60_000);
  await sendLoginEmail(email, code);
  return showCodeInApp() ? { dev_code: code } : {};
}

export function verifyEmailLogin(db: DB, rawEmail: unknown, rawCode: unknown): string {
  const email = String(rawEmail ?? "").trim().toLowerCase();
  const code = String(rawCode ?? "").trim();
  const row = db.prepare("SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?").get(email) as
    | { code_hash: string; expires_at: number; attempts: number } | undefined;
  if (!row || row.expires_at < Date.now()) throw new ApiError(400, "code_expired", "Kodun süresi doldu, yeni kod isteyin.");
  if (row.attempts >= 5) throw new ApiError(429, "code_attempts", "Çok fazla deneme yapıldı, yeni kod isteyin.");
  const ok = timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(sha(`${email}:${code}`)));
  if (!ok) {
    db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?").run(email);
    throw new ApiError(400, "code_wrong", "Kod hatalı.");
  }
  db.prepare("DELETE FROM login_codes WHERE email = ?").run(email);
  return createSession(db, findOrCreateUser(db, "email", email));
}

// ---------- Apple / Google kimlik belirteci ----------

type Jwk = { kid?: string; kty?: string; n?: string; e?: string; [k: string]: unknown };
type JwksFetcher = (url: string) => Promise<Jwk[]>;

const jwksCache = new Map<string, { keys: Jwk[]; at: number }>();
let fetchJwks: JwksFetcher = async (url) => {
  const hit = jwksCache.get(url);
  if (hit && Date.now() - hit.at < 3600_000) return hit.keys;
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new ApiError(502, "jwks", "Giriş sağlayıcısına ulaşılamadı.");
  const keys = ((await r.json()) as { keys: Jwk[] }).keys;
  jwksCache.set(url, { keys, at: Date.now() });
  return keys;
};

/** Testlerde sahte anahtar seti vermek için. */
export function setJwksFetcher(f: JwksFetcher) {
  fetchJwks = f;
}

const b64 = (s: string) => Buffer.from(s, "base64url");

export async function verifyIdToken(token: string, opts: { jwksUrl: string; issuers: string[]; audiences: string[] }) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) throw new ApiError(401, "bad_token", "Giriş doğrulanamadı.");
  const header = JSON.parse(b64(parts[0]).toString());
  const payload = JSON.parse(b64(parts[1]).toString());
  if (header.alg !== "RS256") throw new ApiError(401, "bad_token", "Giriş doğrulanamadı.");
  const jwk = (await fetchJwks(opts.jwksUrl)).find((k) => k.kid === header.kid);
  if (!jwk) throw new ApiError(401, "bad_token", "Giriş doğrulanamadı.");
  const key = createPublicKey({ key: jwk as any, format: "jwk" });
  const ok = verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, b64(parts[2]));
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!ok || !opts.issuers.includes(payload.iss) || !aud.some((a: string) => opts.audiences.includes(a)) ||
      typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    throw new ApiError(401, "bad_token", "Giriş doğrulanamadı.");
  }
  return payload as { sub: string; email?: string; email_verified?: boolean | string };
}

export async function appleLogin(db: DB, identityToken: unknown): Promise<string> {
  if (!config.appleBundleId) throw new ApiError(501, "apple_not_configured", "Apple ile giriş yapılandırılmadı.");
  const p = await verifyIdToken(String(identityToken), {
    jwksUrl: "https://appleid.apple.com/auth/keys",
    issuers: ["https://appleid.apple.com"],
    audiences: [config.appleBundleId],
  });
  const email = p.email && String(p.email_verified) === "true" ? p.email.toLowerCase() : undefined;
  return createSession(db, findOrCreateUser(db, "apple_sub", p.sub, email));
}

export async function googleLogin(db: DB, idToken: unknown): Promise<string> {
  if (!config.googleClientIds.length) throw new ApiError(501, "google_not_configured", "Google ile giriş yapılandırılmadı.");
  const p = await verifyIdToken(String(idToken), {
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    issuers: ["https://accounts.google.com", "accounts.google.com"],
    audiences: config.googleClientIds,
  });
  const email = p.email && String(p.email_verified) === "true" ? p.email.toLowerCase() : undefined;
  return createSession(db, findOrCreateUser(db, "google_sub", p.sub, email));
}
