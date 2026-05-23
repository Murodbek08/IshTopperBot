import { Telegraf, Markup } from "telegraf";
import { prisma } from "../../../lib/prisma";
import { mainKeyboard } from "./start.handler";
import type { SessionStore } from "../session";

const SKIP_KEYBOARD = Markup.keyboard([["⏭ O'tkazib yuborish"]])
  .resize()
  .oneTime();

export function registerMessageHandler(bot: Telegraf, sessions: SessionStore) {
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const session = sessions.get(userId);

    // Session yo'q — odatiy xabar
    if (!session) {
      await ctx.reply(
        "Buyruqni tushunmadim. Pastdagi tugmalardan foydalaning 👇",
        mainKeyboard(),
      );
      return;
    }

    // ─── Step 1: Keywords ───────────────────────────────────────────────────
    if (session.step === "awaiting_keywords") {
      const keywords = text
        .split(/[,;]+/)
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 0);

      if (keywords.length === 0) {
        await ctx.reply("❌ Kamida bitta kalit so'z kiriting.");
        return;
      }

      sessions.set(userId, { step: "awaiting_location", keywords });

      await ctx.reply(
        "📍 <b>2/3 — Shahar</b>\n\n" +
          "Qaysi shaharda vakansiya qidirasiz?\n\n" +
          "Misol: <code>toshkent</code>, <code>namangan</code>, <code>remote</code>\n\n" +
          "<i>O'tkazib yuborish uchun tugmani bosing (hamma shaharlar)</i>",
        { parse_mode: "HTML", ...SKIP_KEYBOARD },
      );
      return;
    }

    // ─── Step 2: Location ───────────────────────────────────────────────────
    if (session.step === "awaiting_location") {
      const location =
        text === "⏭ O'tkazib yuborish" ? null : text.toLowerCase().trim();

      sessions.set(userId, {
        ...session,
        step: "awaiting_salary",
        location,
      });

      await ctx.reply(
        "💰 <b>3/3 — Minimal maosh</b>\n\n" +
          "Minimal maosh miqdorini kiriting (so'mda):\n" +
          "Misol: <code>3000000</code>\n\n" +
          "<i>O'tkazib yuborish uchun tugmani bosing</i>",
        { parse_mode: "HTML", ...SKIP_KEYBOARD },
      );
      return;
    }

    // ─── Step 3: Salary ─────────────────────────────────────────────────────
    if (session.step === "awaiting_salary") {
      let minSalary: number | null = null;

      if (text !== "⏭ O'tkazib yuborish") {
        const num = parseInt(text.replace(/\s/g, ""), 10);
        if (isNaN(num) || num <= 0) {
          await ctx.reply(
            "❌ Noto'g'ri format. Faqat raqam kiriting yoki o'tkazib yuboring.",
            SKIP_KEYBOARD,
          );
          return;
        }
        minSalary = num;
      }

      // Filter saqlash
      await prisma.filter.create({
        data: {
          userId: BigInt(userId),
          keywords: session.keywords!,
          location: session.location ?? null,
          minSalary,
        },
      });

      sessions.delete(userId);

      // Tasdiqlash xabari
      let confirmText =
        "✅ <b>Filter muvaffaqiyatli qo'shildi!</b>\n\n" +
        `🔑 Kalit so'zlar: <code>${session.keywords!.join(", ")}</code>\n`;

      if (session.location) {
        confirmText += `📍 Shahar: <b>${session.location}</b>\n`;
      } else {
        confirmText += `📍 Shahar: <i>Hammasi</i>\n`;
      }

      if (minSalary) {
        confirmText += `💰 Min. maosh: <b>${minSalary.toLocaleString()} so'm</b>\n`;
      } else {
        confirmText += `💰 Min. maosh: <i>Belgilanmagan</i>\n`;
      }

      confirmText += "\n<i>Mos vakansiyalar avtomatik yuboriladi 🚀</i>";

      await ctx.reply(confirmText, {
        parse_mode: "HTML",
        ...mainKeyboard(),
      });
    }
  });
}
