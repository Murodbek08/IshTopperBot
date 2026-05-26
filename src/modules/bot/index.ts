import { Telegraf } from "telegraf";
import * as dotenv from "dotenv";
import { logger } from "../../lib/logger";
import { createSessionStore } from "./session";
import { registerStartHandler } from "./handlers/start.handler";
import { registerFilterHandlers } from "./handlers/filter.handler";
import { registerMessageHandler } from "./handlers/message.handler";

dotenv.config();

const CTX = "Bot";

if (!process.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN environment variable kerak!");
}

export const bot = new Telegraf(process.env.BOT_TOKEN);
const sessions = createSessionStore();

// ─── Handlers ─────────────────────────────────────────────────────────────────
registerStartHandler(bot);
registerFilterHandlers(bot, sessions);
registerMessageHandler(bot, sessions);

// ─── Global error handler ─────────────────────────────────────────────────────
bot.catch((err: any, ctx) => {
  logger.error(CTX, `Update xatosi: ${err.message}`, {
    updateType: ctx.updateType,
    user: ctx.from?.id,
  });
});

export async function startBot(): Promise<void> {
  await bot.launch({
    dropPendingUpdates: true, // eski xabarlarni o'tkazib yuborish
  });

  logger.info(CTX, `Bot ishga tushdi: @${bot.botInfo?.username} ✅`);

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
