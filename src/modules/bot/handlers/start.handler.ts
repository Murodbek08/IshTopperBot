import { Telegraf, Markup } from "telegraf";
import { prisma } from "../../../lib/prisma";
import { escapeHtml } from "../utils";

export function registerStartHandler(bot: Telegraf) {
  bot.start(async (ctx) => {
    const { id, username, first_name } = ctx.from;

    await prisma.user.upsert({
      where:  { telegramId: BigInt(id) },
      update: { isActive: true, username: username ?? null, firstName: first_name ?? null },
      create: {
        telegramId: BigInt(id),
        username:   username ?? null,
        firstName:  first_name ?? null,
      },
    });

    const name = escapeHtml(first_name ?? "do'stim");

    const text =
      `👋 Salom, <b>${name}</b>!\n\n` +
      `🤖 <b>IshTopperBot</b>ga xush kelibsiz!\n\n` +
      `<b>Men nima qilaman?</b>\n` +
      `📡 <b>29+ Telegram kanal</b>ni real-vaqtda kuzataman\n` +
      `🎯 Filtringizga mos vakansiyalarni <b>darhol</b> yuboraman\n` +
      `🔍 Maosh, daraja, hudud bo'yicha <b>aniq filtrlash</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🚀 <b>Boshlash:</b> <i>➕ Filter qo'shish</i> tugmasini bosing`;

    await ctx.replyWithAnimation(
      { url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzU5eDh5dXhxeXlqaGZ4NHNlYXE4bHN0N3Z5NXBnZm95OW1kMHNlbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7abKhOpu0NwenH3O/giphy.gif" },
      { caption: text, parse_mode: "HTML", ...mainKeyboard() },
    ).catch(() =>
      ctx.reply(text, { parse_mode: "HTML", ...mainKeyboard() }),
    );
  });
}

export function mainKeyboard() {
  return Markup.keyboard([
    ["➕ Filter qo'shish", "📋 Filterlarim"],
    ["🔍 Qidirish",        "🕘 Tarixi"],
    ["📊 Statistika",      "⚙️ Sozlamalar"],
  ]).resize();
}
