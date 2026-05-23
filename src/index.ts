import * as dotenv from "dotenv";
dotenv.config();

import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { startBot } from "./modules/bot";
import { startParser } from "./modules/parser";

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
