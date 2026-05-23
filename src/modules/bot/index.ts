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
  throw new Error("BOT_TOKEN environment variable is required");
}

export const bot = new Telegraf(process.env.BOT_TOKEN);

const sessions = createSessionStore();

// ─── Handlers ─────────────────────────────────────────────────────────────────
registerStartHandler(bot);
registerFilterHandlers(bot, sessions);
registerMessageHandler(bot, sessions);

// ─── Global error handler ─────────────────────────────────────────────────────
bot.catch((err: unknown, ctx) => {
  logger.error(CTX, `Unhandled bot error for update ${ctx.update.update_id}`, {
    error: err instanceof Error ? err.message : String(err),
  });
});

// ─── Launch ───────────────────────────────────────────────────────────────────
export async function startBot(): Promise<void> {
  await bot.launch();
  logger.info(CTX, "Bot ishga tushdi ✅");

  // Graceful shutdown
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
