import { Telegraf } from "telegraf";
import { config } from "../../config";
import { logger } from "../../lib/logger";
import { createSessionStore } from "./session";
import { registerStartHandler } from "./handlers/start.handler";
import { registerFilterHandlers } from "./handlers/filter.handler";
import { registerMessageHandler } from "./handlers/message.handler";
import { registerStatsHandler } from "./handlers/stats.handler";
import { registerSettingsHandler } from "./handlers/settings.handler";
import { registerAdminHandler } from "./handlers/admin.handler";

const CTX = "Bot";

export const bot = new Telegraf(config.botToken);
const sessions = createSessionStore();

// Handlerlar tartib bilan ro'yxatdan o'tadi (tartib muhim!)
registerStartHandler(bot);
registerStatsHandler(bot, sessions);
registerSettingsHandler(bot, sessions);
registerFilterHandlers(bot, sessions);
registerAdminHandler(bot);        // Admin handler OXIRIGA yaqin — text handler bor
registerMessageHandler(bot, sessions); // Fallback — ENG OXIRIDA

// Global xato ushlagich
bot.catch((err: any, ctx) => {
  logger.error(CTX, `Update xatosi`, {
    error:      err?.message ?? String(err),
    updateType: ctx.updateType,
    userId:     ctx.from?.id,
  });
});

export async function startBot(): Promise<void> {
  // 409 Conflict: eski instance hali o'chmagan — kutib qayta urinamiz
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await bot.launch({ dropPendingUpdates: true });
      logger.info(CTX, `✅ Bot ishga tushdi: @${bot.botInfo?.username}`);
      return;
    } catch (err: any) {
      if (err?.message?.includes("409") && attempt < 5) {
        const wait = attempt * 5000; // 5s, 10s, 15s, 20s
        logger.warn(CTX, `409 Conflict — ${wait / 1000}s kutilmoqda (urinish ${attempt}/5)...`);
        await new Promise((res) => setTimeout(res, wait));
      } else {
        throw err;
      }
    }
  }
}
