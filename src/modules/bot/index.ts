import { Telegraf } from "telegraf";
import { config } from "../../config";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
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

// Har qanday interaksiyada User mavjudligini kafolatlaydi
// (aks holda /start bosmagan userda Filter yaratishda FK xatosi bo'ladi)
bot.use(async (ctx, next) => {
  if (ctx.from && !ctx.from.is_bot) {
    try {
      await prisma.user.upsert({
        where:  { telegramId: BigInt(ctx.from.id) },
        update: { isActive: true },
        create: {
          telegramId: BigInt(ctx.from.id),
          username:   ctx.from.username ?? null,
          firstName:  ctx.from.first_name ?? null,
        },
      });
    } catch (err: any) {
      logger.warn(CTX, `User upsert xato: ${err?.message ?? err}`);
    }
  }
  return next();
});

// Handlerlar tartib bilan ro'yxatdan o'tadi (tartib muhim!)
registerStartHandler(bot);
registerStatsHandler(bot, sessions);
registerSettingsHandler(bot, sessions);
registerFilterHandlers(bot, sessions);
registerAdminHandler(bot, sessions); // Admin handler OXIRIGA yaqin — text handler bor
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
  await bot.launch({ dropPendingUpdates: true });
  logger.info(CTX, `✅ Bot ishga tushdi: @${bot.botInfo?.username}`);
}
