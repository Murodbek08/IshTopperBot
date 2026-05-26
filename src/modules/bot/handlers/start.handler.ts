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

    const name = escapeHtml(first_name ?? "do'stim");

    await ctx.replyWithAnimation(
      { url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzU5eDh5dXhxeXlqaGZ4NHNlYXE4bHN0N3Z5NXBnZm95OW1kMHNlbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7abKhOpu0NwenH3O/giphy.gif" },
      {
        caption:
          `👋 Salom, <b>${name}</b>!\n\n` +
          `🤖 <b>Vakansiya Bot</b>ga xush kelibsiz!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🎯 Men nima qilaman?\n\n` +
          `📡 <b>29+ kanal</b>dan real-vaqtda vakansiyalarni kuzataman\n` +
          `🔍 Sizning filtringizga mos kelganlarini <b>avtomatik</b> yuboraman\n` +
          `⚡ Yangi vakansiya chiqqanida <b>darhol</b> xabar beraman\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🚀 <b>Boshlash uchun:</b>\n` +
          `➕ <i>Filter qo'shish</i> tugmasini bosing va yo'nalishingizni tanlang!\n\n` +
          `💡 <i>Filter qanchalik aniq bo'lsa — vakansiyalar shunchalik mos keladi</i>`,
        parse_mode: "HTML",
        ...mainKeyboard(),
      }
    ).catch(() =>
      // Agar GIF yuborilmasa — oddiy matn bilan yuborish
      ctx.reply(
        `✨ Salom, <b>${name}</b>! 👋\n\n` +
          `🤖 <b>Vakansiya Bot</b>ga xush kelibsiz!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📡 <b>29+ kanal</b>dan real-vaqtda vakansiyalarni kuzataman\n` +
          `🔍 Filtringizga mos vakansiyalarni <b>avtomatik</b> yuboraman\n` +
          `⚡ Yangi vakansiya chiqqanida <b>darhol</b> xabar beraman\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🚀 Boshlash uchun <b>➕ Filter qo'shish</b> tugmasini bosing!`,
        {
          parse_mode: "HTML",
          ...mainKeyboard(),
        }
      )
    );
  });
}

export function mainKeyboard() {
  return Markup.keyboard([
    ["➕ Filter qo'shish", "📋 Filterlarim"],
    ["⏸ Pauzaga qo'yish", "ℹ️ Yordam"],
  ]).resize();
}
