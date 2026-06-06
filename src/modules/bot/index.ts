import { Telegraf } from "telegraf";
import * as dotenv from "dotenv";
import { logger } from "../../lib/logger";
import { createSessionStore } from "./session";
import { registerStartHandler } from "./handlers/start.handler";
import { registerFilterHandlers } from "./handlers/filter.handler";
import { registerMessageHandler } from "./handlers/message.handler";
import { registerStatsHandler } from "./handlers/stats.handler";
import { registerSettingsHandler } from "./handlers/settings.handler";
import { registerAdminHandler } from "./handlers/admin.handler";

dotenv.config();

const CTX = "Bot";

if (!process.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN environment variable kerak!");
}

export const bot = new Telegraf(process.env.BOT_TOKEN);
const sessions = createSessionStore();

// ─── Handlerlarni tartib bilan ro'yxatdan o'tkazamiz ─────────────────────────
registerStartHandler(bot);
registerStatsHandler(bot, sessions);
registerSettingsHandler(bot, sessions);
registerFilterHandlers(bot, sessions);
registerAdminHandler(bot);
registerMessageHandler(bot, sessions);   // OXIRIDA — fallback handler

// ─── Global error handler ─────────────────────────────────────────────────────
bot.catch((err: any, ctx) => {
  logger.error(CTX, `Update xatosi: ${err?.message ?? String(err)}`, {
    updateType: ctx.updateType,
    user:       ctx.from?.id,
  });
});

export async function startBot(): Promise<void> {
  await bot.launch({ dropPendingUpdates: true });
  logger.info(CTX, `✅ Bot ishga tushdi: @${bot.botInfo?.username}`);

  process.once("SIGINT",  () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
