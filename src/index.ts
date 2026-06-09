import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./config";
import http from "http";
import { logger } from "./lib/logger";
import { prisma, disconnectPrisma } from "./lib/prisma";
import { startBot } from "./modules/bot";
import { startParser } from "./modules/parser";

const CTX = "Main";

// ─── Keep-alive ────────────────────────────────────────────────────────────────
// Render.com free tier 15 daqiqada uyquga ketadi — o'zimizni ping qilamiz
function startKeepAlive(): void {
  // RENDER_URL bo'lmasa — o'zimizning health check portimizni ping qilamiz
  const url = config.renderUrl || `http://localhost:${config.port}`;

  setInterval(async () => {
    try {
      await fetch(url);
      logger.debug(CTX, `Keep-alive ping OK → ${url}`);
    } catch {
      logger.debug(CTX, "Keep-alive ping yuborildi");
    }
  }, 9 * 60 * 1000); // 9 daqiqa

  logger.info(CTX, `Keep-alive yoqildi → ${url}`);
}

// ─── Health-check server ───────────────────────────────────────────────────────
function startHealthServer(): http.Server {
  const start = Date.now();
  const server = http.createServer((_, res) => {
    const uptime = Math.floor((Date.now() - start) / 1000);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime }));
  });

  server.listen(config.port, () => {
    logger.info(CTX, `Health-check server: http://localhost:${config.port}`);
  });

  return server;
}

// ─── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info(CTX, `${signal} signali — to'xtatilmoqda...`);
  try {
    await disconnectPrisma();
    logger.info(CTX, "DB ulanishi yopildi ✅");
  } catch (err: any) {
    logger.error(CTX, "DB yopishda xato", { error: err?.message });
  }
  process.exit(0);
}

process.once("SIGINT",  () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

// ─── Bot ni qayta ishga tushiruvchi wrapper ────────────────────────────────────
// process.exit chaqirilmaydi — Render o'zi restart qilmasin
async function runBotForever(): Promise<void> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      logger.info(CTX, `Bot ishga tushirilmoqda (urinish #${attempt})...`);
      await startBot();
      // startBot() qaytsa (bo'lmasligi kerak) — qayta urinamiz
      logger.warn(CTX, "Bot to'xtatildi — 10s dan keyin qayta ishga tushadi");
    } catch (err: any) {
      const isConflict = err?.message?.includes("409");
      const wait = isConflict ? 8000 : Math.min(attempt * 5000, 60000);
      logger.error(CTX, `Bot xato (${err?.message}) — ${wait / 1000}s kutilmoqda...`);
      await new Promise((res) => setTimeout(res, wait));
    }
  }
}

// ─── Parser ni qayta ishga tushiruvchi wrapper ────────────────────────────────
async function runParserForever(): Promise<void> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      logger.info(CTX, `Parser ishga tushirilmoqda (urinish #${attempt})...`);
      await startParser();
      logger.warn(CTX, "Parser to'xtatildi — 30s dan keyin qayta ishga tushadi");
    } catch (err: any) {
      const wait = Math.min(attempt * 10000, 120000);
      logger.error(CTX, `Parser xato (${err?.message}) — ${wait / 1000}s kutilmoqda...`);
      await new Promise((res) => setTimeout(res, wait));
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  logger.info(CTX, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info(CTX, "🚀 IshTopperBot ishga tushmoqda...");
  logger.info(CTX, `   Muhit:      ${config.nodeEnv}`);
  logger.info(CTX, `   Admin IDlar: ${config.adminIds.join(", ") || "—"}`);
  logger.info(CTX, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // DB ulanishini tekshirish
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info(CTX, "✅ PostgreSQL ulanish muvaffaqiyatli");
  } catch (err: any) {
    logger.error(CTX, "❌ DB ulanishida xato!", { error: err.message });
    process.exit(1);
  }

  startHealthServer();
  startKeepAlive();

  // Bot va parser parallel — ikkalasi ham xato bo'lsa qayta urinadi
  await Promise.all([
    runBotForever(),
    runParserForever(),
  ]);
}

main();
