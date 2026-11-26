import "./env";
import { createServer } from "node:http";
import { createApp } from "./app";
import { config } from "./config";
import { openDb } from "./db";

const db = openDb(config.dbPath);
const server = createServer(createApp(db));
server.listen(config.port, () => {
  console.log(`Sunucu http://localhost:${config.port} adresinde çalışıyor.`);
  if (config.llmMock) console.log("ANTHROPIC_API_KEY yok ya da LLM_MOCK=1: örnek tariflerle çalışılıyor.");
});
