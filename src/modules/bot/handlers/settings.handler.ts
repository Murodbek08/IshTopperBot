import { Telegraf, Markup } from "telegraf";
import { prisma } from "../../../lib/prisma";
import { escapeHtml } from "../utils";
import { mainKeyboard } from "./start.handler";
import type { SessionStore } from "../session";

export function registerSettingsHandler(bot: Telegraf, sessions: SessionStore) {

  // ── ⚙️ Sozlamalar menyusi ────────────────────────────────────────────────
  bot.hears(["⚙️ Sozlamalar", "/settings"], async (ctx) => {
    const user = await prisma.user.findUnique({
      where:  { telegramId: BigInt(ctx.from.id) },
      select: { isActive: true, silentFrom: true, silentTo: true },
    });

    const status = user?.isActive ? "🟢 Faol" : "⏸ Pauza";
    const silent =
      user?.silentFrom != null && user?.silentTo != null
        ? `🌙 ${user.silentFrom}:00 – ${user.silentTo}:00`
        : "O'chirilgan";

    const text =
      `⚙️ <b>Sozlamalar</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔔 Bildirishnomalar: <b>${status}</b>\n` +
      `🌙 Sokin soatlar:    <b>${silent}</b>\n\n` +
      `<i>Sokin soatlar oralig'ida hech qanday vakansiya yuborilmaydi.</i>`;

    await ctx.reply(text, {
      parse_mode: "HTML",
      ...settingsKeyboard(user?.isActive ?? true, user?.silentFrom ?? null),
    });
  });

  // ── Pause / Resume ────────────────────────────────────────────────────────
  bot.hears(["⏸ Pauzaga qo'yish", "/pause"], async (ctx) => {
    await toggleNotifications(ctx, false);
  });

  bot.action("pause_notifications", async (ctx) => {
    await ctx.answerCbQuery();
    await toggleNotifications(ctx, false);
  });

  bot.action("resume_notifications", async (ctx) => {
    await ctx.answerCbQuery();
    await toggleNotifications(ctx, true);
  });

  // ── 🌙 Sokin soatlar ─────────────────────────────────────────────────────
  bot.action("set_silent", async (ctx) => {
    await ctx.answerCbQuery();
    sessions.set(ctx.from!.id, { step: "awaiting_silent_from" });
    await ctx.reply(
      `🌙 <b>Sokin soatlar</b>\n\n` +
      `Qaysi soatdan boshlab bildirishnomalarni <b>to'xtatsin</b>?\n\n` +
      `<i>Misol: kechqurun 23:00 dan</i>`,
      { parse_mode: "HTML", ...silentHourKeyboard("from") },
    );
  });

  bot.action("clear_silent", async (ctx) => {
    await ctx.answerCbQuery("✅ Sokin soatlar o'chirildi");
    await prisma.user.update({
      where: { telegramId: BigInt(ctx.from!.id) },
      data:  { silentFrom: null, silentTo: null },
    });
    await ctx.editMessageText(
      "🌙 <b>Sokin soatlar o'chirildi.</b>\n\nEndi bildirishnomalar 24/7 keladi.",
      { parse_mode: "HTML" },
    );
  });

  // Sokin soat tanlash — FROM
  bot.action(/^silent_from:(\d+)$/, async (ctx) => {
    const from = parseInt(ctx.match[1]);
    sessions.set(ctx.from!.id, { step: "awaiting_silent_to", silentFrom: from } as any);
    await ctx.answerCbQuery(`${from}:00 tanlandi`);
    await ctx.editMessageText(
      `🌙 <b>Sokin soatlar</b>\n\n` +
      `Boshlanish: <b>${from}:00</b>\n\n` +
      `Qaysi soatgacha <b>to'xtatsin</b>?`,
      { parse_mode: "HTML", ...silentHourKeyboard("to") },
    );
  });

  // Sokin soat tanlash — TO
  bot.action(/^silent_to:(\d+)$/, async (ctx) => {
    const session = sessions.get(ctx.from!.id) as any;
    const from = session?.silentFrom ?? 23;
    const to   = parseInt(ctx.match[1]);

    await prisma.user.update({
      where: { telegramId: BigInt(ctx.from!.id) },
      data:  { silentFrom: from, silentTo: to },
    });
    sessions.delete(ctx.from!.id);

    await ctx.answerCbQuery("✅ Saqlandi!");
    await ctx.editMessageText(
      `🌙 <b>Sokin soatlar o'rnatildi!</b>\n\n` +
      `<b>${from}:00 – ${to}:00</b> oralig'ida bildirishnomalar to'xtatiladi.\n\n` +
      `<i>O'zgartirish uchun Sozlamalar → Sokin soatlar</i>`,
      { parse_mode: "HTML" },
    );
  });

  // ── ℹ️ Yordam ─────────────────────────────────────────────────────────────
  bot.hears(["ℹ️ Yordam", "/help"], async (ctx) => {
    await ctx.reply(
      `ℹ️ <b>IshTopperBot — Yordam</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Asosiy buyruqlar:</b>\n` +
      `➕ <b>Filter qo'shish</b> — yangi filter yarating (6 bosqich)\n` +
      `📋 <b>Filterlarim</b>     — faol filtrlarni ko'ring va boshqaring\n` +
      `🔍 <b>Qidirish</b>        — so'nggi 7 kundan kalit so'z bilan qidiring\n` +
      `🕘 <b>Tarixi</b>          — sizga yuborilgan oxirgi 10 vakansiya\n` +
      `📊 <b>Statistika</b>      — shaxsiy statistika va hisobot\n` +
      `⚙️ <b>Sozlamalar</b>      — pauza, sokin soatlar\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Filter qanday ishlaydi?</b>\n` +
      `1️⃣ Soha tanlang (Frontend, Backend...)\n` +
      `2️⃣ Texnologiyalar belgilang\n` +
      `3️⃣ Daraja: Junior/Middle/Senior\n` +
      `4️⃣ Ish turi: Remote/Ofis/Hybrid\n` +
      `5️⃣ Hudud tanlang\n` +
      `6️⃣ Minimal maosh (ixtiyoriy)\n\n` +
      `📡 <b>29 kanal</b> kuzatilmoqda — mos vakansiya chiqqanda darhol xabar beriladi!`,
      { parse_mode: "HTML", ...mainKeyboard() },
    );
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function toggleNotifications(ctx: any, active: boolean): Promise<void> {
  await prisma.user.update({
    where: { telegramId: BigInt(ctx.from?.id ?? ctx.from.id) },
    data:  { isActive: active },
  });

  if (active) {
    await ctx.reply(
      `✅ <b>Bildirishnomalar yoqildi!</b>\n\n` +
      `Mos vakansiyalar avtomatik yuboriladi 🚀`,
      { parse_mode: "HTML", ...mainKeyboard() },
    );
  } else {
    await ctx.reply(
      `⏸ <b>Bildirishnomalar to'xtatildi.</b>\n\n` +
      `Qayta yoqish uchun:`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([[
          Markup.button.callback("▶️ Yoqish", "resume_notifications"),
        ]]),
      },
    );
  }
}

function settingsKeyboard(isActive: boolean, silentFrom: number | null) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  if (isActive) {
    rows.push([Markup.button.callback("⏸ Pauzaga qo'yish", "pause_notifications")]);
  } else {
    rows.push([Markup.button.callback("▶️ Yoqish", "resume_notifications")]);
  }

  if (silentFrom != null) {
    rows.push([
      Markup.button.callback("🌙 Sokin soatni o'zgartirish", "set_silent"),
      Markup.button.callback("❌ O'chirish", "clear_silent"),
    ]);
  } else {
    rows.push([Markup.button.callback("🌙 Sokin soatlar o'rnatish", "set_silent")]);
  }

  return Markup.inlineKeyboard(rows);
}

function silentHourKeyboard(mode: "from" | "to") {
  // Soatlar: 20, 21, 22, 23, 0, 1, 2, 3 (tunda)
  const hours = mode === "from"
    ? [19, 20, 21, 22, 23]
    : [5, 6, 7, 8, 9, 10];

  const action = mode === "from" ? "silent_from" : "silent_to";
  const btns = hours.map((h) =>
    Markup.button.callback(`${h}:00`, `${action}:${h}`),
  );

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < btns.length; i += 3) rows.push(btns.slice(i, i + 3));

  return Markup.inlineKeyboard(rows);
}
