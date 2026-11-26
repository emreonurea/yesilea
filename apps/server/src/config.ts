const env = process.env;
const int = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  port: int(env.PORT, 8787),
  dbPath: env.DB_PATH ?? "./data/app.db",
  isProd: env.NODE_ENV === "production",
  anthropicKey: env.ANTHROPIC_API_KEY ?? "",
  /** Anahtar yoksa ya da LLM_MOCK=1 ise örnek tariflerle çalışır. */
  get llmMock() {
    return env.LLM_MOCK === "1" || !this.anthropicKey;
  },
  modelFast: env.MODEL_FAST ?? "claude-haiku-5-5",
  modelQuality: env.MODEL_QUALITY ?? "claude-sonnet-5-5",
  get appleBundleId() {
    return env.APPLE_BUNDLE_ID ?? "";
  },
  get googleClientIds() {
    return (env.GOOGLE_CLIENT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  },
  limits: {
    freePlansPerWeek: int(env.FREE_PLANS_PER_WEEK, 2),
    freeTonightPerDay: int(env.FREE_TONIGHT_PER_DAY, 5),
    freeSwapsPerWeek: int(env.FREE_SWAPS_PER_WEEK, 10),
    requestsPerMinute: int(env.REQUESTS_PER_MINUTE, 60),
    llmPerHour: int(env.LLM_PER_HOUR, 20),
  },
  /** Kapalı test dönemi: giriş kodu uygulamada gösterilir, Premium denenebilir. Mağaza yayınından önce kapatın. */
  get testMode() {
    return env.TEST_MODE === "1";
  },
  get brevoApiKey() {
    return env.BREVO_API_KEY ?? "";
  },
  get mailFrom() {
    return env.MAIL_FROM ?? "";
  },
  get revenuecatWebhookSecret() {
    return env.REVENUECAT_WEBHOOK_SECRET ?? "";
  },
  sessionDays: 60,
  cacheDays: 7,
};
