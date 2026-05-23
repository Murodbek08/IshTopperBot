import { Telegraf, Markup } from "telegraf";
import { prisma } from "../../../lib/prisma";
import { escapeHtml } from "../utils";

export function registerStartHandler(bot: Telegraf) {
  bot.start(async (ctx) => {
    const { id, username, first_name } = ctx.from;

    await prisma.user.upsert({
      where: { telegramId: BigInt(id) },
      update: { isActive: true, username: username ?? null },
      create: {
        telegramId: BigInt(id),
        username: username ?? null,
        firstName: first_name ?? null,
      },
    });

    await ctx.reply(
      `Salom, ${escapeHtml(first_name ?? "do'stim")}! 👋\n\n` +
        `Vakansiya botiga xush kelibsiz.\n` +
        `Men sizga mos vakansiyalarni <b>avtomatik</b> yuboraman.\n\n` +
        `Filter qo'shib, kerakli texnologiyalar bo'yicha vakansiyalarni kuzating! 🔍`,
      {
        parse_mode: "HTML",
        ...mainKeyboard(),
      },
    );
  });
}

export function mainKeyboard() {
  return Markup.keyboard([
    ["➕ Filter qo'shish", "📋 Filterlarim"],
    ["⏸ Pauzaga qo'yish", "ℹ️ Yordam"],
  ]).resize();
}
