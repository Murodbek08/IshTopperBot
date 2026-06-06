import * as dotenv from "dotenv";
dotenv.config();

// Config BIRINCHI validate qilinadi — aniq xato xabari
import { config } from "./config";

import http from "http";
import { logger } from "./lib/logger";
import { prisma, disconnectPrisma } from "./lib/prisma";
import { startBot } from "./modules/bot";
import { startParser } from "./modules/parser";

const CTX = "Main";

// ─── Keep-alive (Render.com free tier uyquga ketishini oldini olish) ──────────
function startKeepAlive(): void {
  if (!config.renderUrl) return;
  const interval = 9 * 60 * 1000; // 9 daqiqa
  setInterval(async () => {
    try {
      const res = await fetch(config.renderUrl);
      logger.debug(CTX, `Keep-alive ping: ${res.status}`);
    } catch {
      logger.debug(CTX, "Keep-alive ping yuborildi");
    }
  }, interval);
  logger.info(CTX, `Keep-alive yoqildi → ${config.renderUrl}`);
}

// ─── Health-check server ──────────────────────────────────────────────────────
function startHealthServer(): void {
  const start = Date.now();
  const server = http.createServer((_, res) => {
    const uptime = Math.floor((Date.now() - start) / 1000);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime }));
  });

  server.listen(config.port, () => {
    logger.info(CTX, `Health-check server: http://localhost:${config.port}`);
  });
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
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

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  logger.info(CTX, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info(CTX, "🚀 IshTopperBot ishga tushmoqda...");
  logger.info(CTX, `   Muhit: ${config.nodeEnv}`);
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

  // Bot va parser parallel ishga tushadi
  await Promise.all([
    startBot().catch((err: Error) => {
      logger.error(CTX, "❌ Bot ishga tushmadi", { error: err.message });
      process.exit(1);
    }),
    startParser().catch((err: Error) => {
      logger.error(CTX, "❌ Parser ishga tushmadi", { error: err.message });
      process.exit(1);
    }),
  ]);
}

main();
