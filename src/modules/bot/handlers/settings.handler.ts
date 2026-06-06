import { Telegraf, Markup } from "telegraf";
import { prisma } from "../../../lib/prisma";
import { mainKeyboard } from "./start.handler";
import type { SessionStore } from "../session";

export function registerSettingsHandler(bot: Telegraf, sessions: SessionStore) {

  // ── ⚙️ Sozlamalar ─────────────────────────────────────────────────────────
  bot.hears(["⚙️ Sozlamalar", "/settings"], async (ctx) => {
    const user = await prisma.user.findUnique({
      where:  { telegramId: BigInt(ctx.from.id) },
      select: { isActive: true, silentFrom: true, silentTo: true },
    });

    const status = user?.isActive ? "🟢 Faol" : "⏸ Pauza";
    const silent = user?.silentFrom != null && user?.silentTo != null
      ? `🌙 ${user.silentFrom}:00 – ${user.silentTo}:00`
      : "O'chirilgan";

    await ctx.reply(
      `⚙️ <b>Sozlamalar</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔔 Bildirishnomalar: <b>${status}</b>\n` +
      `🌙 Sokin soatlar:    <b>${silent}</b>\n\n` +
      `<i>Sokin soatlar oralig'ida hech qanday vakansiya yuborilmaydi.</i>`,
      { parse_mode: "HTML", ...settingsKeyboard(user?.isActive ?? true, user?.silentFrom ?? null) },
    );
  });

  // ── Pause ─────────────────────────────────────────────────────────────────
  bot.hears(["⏸ Pauzaga qo'yish"], async (ctx) => {
    await setActive(ctx, false);
  });

  bot.action("pause_notifications", async (ctx) => {
    await ctx.answerCbQuery();
    await setActive(ctx, false);
  });

  bot.action("resume_notifications", async (ctx) => {
    await ctx.answerCbQuery();
    await setActive(ctx, true);
  });

  // ── 🌙 Sokin soatlar ─────────────────────────────────────────────────────
  bot.action("set_silent", async (ctx) => {
    await ctx.answerCbQuery();
    sessions.set(ctx.from!.id, { step: "awaiting_silent_from" });
    await ctx.reply(
      `🌙 <b>Sokin soatlar — boshlanish vaqti</b>\n\n` +
      `Qaysi soatdan boshlab bildirishnomalar to'xtatilsin?`,
      { parse_mode: "HTML", ...silentKeyboard("from") },
    );
  });

  bot.action("clear_silent", async (ctx) => {
    await ctx.answerCbQuery("✅ O'chirildi");
    await prisma.user.update({
      where: { telegramId: BigInt(ctx.from!.id) },
      data:  { silentFrom: null, silentTo: null },
    });
    await ctx.editMessageText(
      "🌙 <b>Sokin soatlar o'chirildi.</b>\n\nBildirishnomalar 24/7 keladi.",
      { parse_mode: "HTML" },
    );
  });

  bot.action(/^silent_from:(\d+)$/, async (ctx) => {
    const from = parseInt(ctx.match[1]);
    sessions.set(ctx.from!.id, { step: "awaiting_silent_to", silentFrom: from } as any);
    await ctx.answerCbQuery(`${from}:00 tanlandi`);
    await ctx.editMessageText(
      `🌙 <b>Sokin soatlar — tugash vaqti</b>\n\n` +
      `Boshlanish: <b>${from}:00</b>\n\n` +
      `Qaysi soatgacha to'xtatilsin?`,
      { parse_mode: "HTML", ...silentKeyboard("to") },
    );
  });

  bot.action(/^silent_to:(\d+)$/, async (ctx) => {
    const session = sessions.get(ctx.from!.id) as any;
    const from    = session?.silentFrom ?? 23;
    const to      = parseInt(ctx.match[1]);

    await prisma.user.update({
      where: { telegramId: BigInt(ctx.from!.id) },
      data:  { silentFrom: from, silentTo: to },
    });
    sessions.delete(ctx.from!.id);

    await ctx.answerCbQuery("✅ Saqlandi!");
    await ctx.editMessageText(
      `🌙 <b>Sokin soatlar o'rnatildi!</b>\n\n` +
      `<b>${from}:00 – ${to}:00</b> oralig'ida bildirishnomalar to'xtatiladi.\n\n` +
      `<i>O'zgartirish: ⚙️ Sozlamalar → Sokin soatlar</i>`,
      { parse_mode: "HTML" },
    );
  });

  // ── ℹ️ Yordam ─────────────────────────────────────────────────────────────
  bot.hears(["ℹ️ Yordam", "/help"], async (ctx) => {
    await ctx.reply(
      `ℹ️ <b>IshTopperBot — Yordam</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Tugmalar:</b>\n` +
      `➕ <b>Filter qo'shish</b>  — 6 bosqichdа filter yarating\n` +
      `📋 <b>Filterlarim</b>     — filtrlarni ko'ring/o'chiring\n` +
      `🔍 <b>Qidirish</b>        — 14 kundan kalit so'z bilan\n` +
      `🕘 <b>Tarixi</b>          — oxirgi 10 ta vakansiya\n` +
      `📊 <b>Statistika</b>      — shaxsiy hisobot\n` +
      `⚙️ <b>Sozlamalar</b>      — pauza, sokin soatlar\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Filter qanday ishlaydi?</b>\n` +
      `Soha → Texnologiyalar → Daraja → Ish turi → Hudud → Maosh\n\n` +
      `📡 <b>29 kanal</b> real-vaqtda kuzatiladi!\n` +
      `Mos vakansiya chiqqanda <b>darhol</b> xabar yuboriladi.`,
      { parse_mode: "HTML", ...mainKeyboard() },
    );
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setActive(ctx: any, active: boolean): Promise<void> {
  await prisma.user.update({
    where: { telegramId: BigInt(ctx.from.id) },
    data:  { isActive: active },
  });

  await ctx.reply(
    active
      ? `✅ <b>Bildirishnomalar yoqildi!</b>\n\nMos vakansiyalar avtomatik yuboriladi 🚀`
      : `⏸ <b>Bildirishnomalar to'xtatildi.</b>\n\nQayta yoqish uchun:`,
    {
      parse_mode: "HTML",
      ...(active
        ? mainKeyboard()
        : Markup.inlineKeyboard([[Markup.button.callback("▶️ Yoqish", "resume_notifications")]]))
    },
  );
}

function settingsKeyboard(isActive: boolean, silentFrom: number | null) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  rows.push([
    isActive
      ? Markup.button.callback("⏸ Pauzaga qo'yish", "pause_notifications")
      : Markup.button.callback("▶️ Yoqish", "resume_notifications"),
  ]);
  if (silentFrom != null) {
    rows.push([
      Markup.button.callback("🌙 Vaqtni o'zgartirish", "set_silent"),
      Markup.button.callback("❌ O'chirish", "clear_silent"),
    ]);
  } else {
    rows.push([Markup.button.callback("🌙 Sokin soatlar o'rnatish", "set_silent")]);
  }
  return Markup.inlineKeyboard(rows);
}

function silentKeyboard(mode: "from" | "to") {
  const hours = mode === "from" ? [19, 20, 21, 22, 23] : [5, 6, 7, 8, 9, 10];
  const prefix = mode === "from" ? "silent_from" : "silent_to";
  const btns = hours.map((h) => Markup.button.callback(`${h}:00`, `${prefix}:${h}`));
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < btns.length; i += 3) rows.push(btns.slice(i, i + 3));
  return Markup.inlineKeyboard(rows);
}
