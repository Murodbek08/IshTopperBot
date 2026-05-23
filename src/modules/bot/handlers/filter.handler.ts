import { Telegraf, Markup } from "telegraf";
import { prisma } from "../../../lib/prisma";
import { escapeHtml } from "../utils";
import type { SessionStore } from "../session";

export function registerFilterHandlers(bot: Telegraf, sessions: SessionStore) {
  // ─── Filter qo'shish ─────────────────────────────────────────────────────
  bot.hears(["➕ Filter qo'shish", "/filter"], async (ctx) => {
    sessions.set(ctx.from.id, { step: "awaiting_keywords" });

    await ctx.reply(
      "🔍 <b>Yangi filter yaratish — 1/3</b>\n\n" +
        "Qaysi kalit so'zlar bo'yicha vakansiya qidirmoqchisiz?\n\n" +
        "Vergul bilan yozing:\n" +
        "<code>frontend, react, typescript</code>\n\n" +
        "<i>💡 Kalit so'zlar vakansiya matnida qidiriladi</i>",
      { parse_mode: "HTML" },
    );
  });

  // ─── Filterlarim ─────────────────────────────────────────────────────────
  bot.hears(["📋 Filterlarim", "/myfilters"], async (ctx) => {
    const filters = await prisma.filter.findMany({
      where: { userId: BigInt(ctx.from.id) },
    });

    if (filters.length === 0) {
      return ctx.reply(
        "📭 Sizda hali filter yo'q.\n\n" +
          "➕ <b>Filter qo'shish</b> tugmasini bosing.",
        { parse_mode: "HTML" },
      );
    }

    let text = `📋 <b>Sizning filterlaringiz (${filters.length} ta):</b>\n\n`;

    filters.forEach((f, i) => {
      text += `<b>${i + 1}.</b> 🔑 <code>${escapeHtml(f.keywords.join(", "))}</code>`;
      if (f.location) text += `\n   📍 ${escapeHtml(f.location)}`;
      if (f.minSalary)
        text += `\n   💰 ${f.minSalary.toLocaleString()} so'mdan`;
      text += "\n\n";
    });

    const buttons = filters.map((f, i) =>
      Markup.button.callback(
        `🗑 ${i + 1}-filterni o'chirish`,
        `del_filter:${f.id}`,
      ),
    );

    await ctx.reply(text, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard(buttons, { columns: 1 }),
    });
  });

  // ─── Filter o'chirish (inline callback) ──────────────────────────────────
  bot.action(/del_filter:(\d+)/, async (ctx) => {
    const filterId = parseInt(ctx.match[1]);

    // Faqat o'z filterini o'chira oladi
    const deleted = await prisma.filter.deleteMany({
      where: { id: filterId, userId: BigInt(ctx.from!.id) },
    });

    if (deleted.count === 0) {
      await ctx.answerCbQuery("⚠️ Filter topilmadi");
      return;
    }

    await ctx.answerCbQuery("✅ Filter o'chirildi");
    await ctx.editMessageText("✅ <b>Filter muvaffaqiyatli o'chirildi.</b>", {
      parse_mode: "HTML",
    });
  });

  // ─── Pauzaga qo'yish ─────────────────────────────────────────────────────
  bot.hears("⏸ Pauzaga qo'yish", async (ctx) => {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
    });

    if (!user?.isActive) {
      return ctx.reply(
        "▶️ Bildirishnomalar allaqachon to'xtatilgan.\n\n" +
          "/start yozib qayta yoqishingiz mumkin.",
      );
    }

    await prisma.user.update({
      where: { telegramId: BigInt(ctx.from.id) },
      data: { isActive: false },
    });

    await ctx.reply(
      "⏸ <b>Bildirishnomalar to'xtatildi.</b>\n\n" +
        "Qayta yoqish uchun /start yozing.",
      { parse_mode: "HTML" },
    );
  });

  // ─── Yordam ──────────────────────────────────────────────────────────────
  bot.hears(["ℹ️ Yordam", "/help"], async (ctx) => {
    await ctx.reply(
      "ℹ️ <b>Yordam</b>\n\n" +
        "➕ <b>Filter qo'shish</b>\n" +
        "   Kalit so'zlar, shahar va minimal maosh bo'yicha\n" +
        "   shaxsiy filter yarating\n\n" +
        "📋 <b>Filterlarim</b>\n" +
        "   Barcha filterlaringizni ko'ring,\n" +
        "   kerakmasini o'chiring\n\n" +
        "⏸ <b>Pauzaga qo'yish</b>\n" +
        "   Bildirishnomalarni vaqtincha to'xtatish\n\n" +
        "📡 <b>Kuzatilayotgan kanallar (29 ta):</b>\n" +
        "   • UstozShogird\n" +
        "   • vakansiyalar_uz_uz\n" +
        "   • freelancer_Uzbek\n" +
        "   • unilance\n" +
        "   • ayti_jobs\n" +
        "   • joblinkuz\n" +
        "   • data_ish\n" +
        "   • we_use_js\n" +
        "   • nodejsjobsfeed\n" +
        "   • qamar_ads\n" +
        "   • ishmi_ish\n" +
        "   • Exampleuz\n" +
        "   • techjobs_vakansiya\n" +
        "   • freelance_link\n" +
        "   • frontend\n" +
        "   • upjobsuz\n" +
        "   • Jobs_uz_vacancy\n" +
        "   • kasbim_uz\n" +
        "   • UstozShogirdSohalar\n" +
        "   • freelance_uzb\n" +
        "   • itmarket_uz\n" +
        "   • rabotak_razrabotchik\n" +
        "   • it_jobs_uz\n" +
        "   • fintech_jobs\n" +
        "   • click_jobs\n" +
        "   • jobmarket_uz\n" +
        "   • rizqimuz\n" +
        "   • frontEndJobo\n" +
        "   • frontendVacancy\n\n" +
        "<i>Yangi vakansiya filterlarga mos kelsa, avtomatik yuboriladi.</i>",
      { parse_mode: "HTML" },
    );
  });
}
