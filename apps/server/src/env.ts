// .env dosyasını (varsa) diğer modüllerden önce yükler.
try {
  process.loadEnvFile(".env");
} catch {
  /* .env yoksa varsayılanlarla devam */
}
