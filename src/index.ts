import * as dotenv from "dotenv";
dotenv.config();

import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { startBot } from "./modules/bot";
import { startParser } from "./modules/parser";
import axios from "axios";
import http from "http";

setInterval(
  () => {
    const RENDER_URL = "https://ishtopperbot.onrender.com";
    axios
      .get(RENDER_URL)
      .then(() => console.log("⏰ Bot uyg'oq saqlandi!"))
      .catch((err) => console.log("⏰ Uyg'otish xabari yuborildi."));
  },
  10 * 60 * 1000,
);

const CTX = "Main";

async function main() {
  logger.info(CTX, "IshBot ishga tushmoqda...");

  // DB ulanishini tekshirish
  try {
    await prisma.$connect();
    logger.info(CTX, "PostgreSQL ulanish muvaffaqiyatli ✅");
  } catch (err: any) {
    logger.error(CTX, "DB ulanishida xato!", { error: err.message });
    process.exit(1);
  }

  const PORT = process.env.PORT || 3000;
  http
    .createServer((_, res) => {
      res.writeHead(200);
      res.end("IshBot ishlayapti ✅");
    })
    .listen(PORT, () => {
      logger.info(CTX, `Health check server: port ${PORT}`);
    });

  // Bot va parser'ni parallel ishga tushiramiz
  await Promise.all([
    startBot().catch((err) => {
      logger.error(CTX, "Bot ishga tushmadi", { error: err.message });
      process.exit(1);
    }),
    startParser().catch((err) => {
      logger.error(CTX, "Parser ishga tushmadi", { error: err.message });
      process.exit(1);
    }),
  ]);
}

main();
