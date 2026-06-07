import { Telegraf, Markup } from "telegraf";
import { prisma } from "../../../lib/prisma";
import { escapeHtml, formatDate, sleep } from "../utils";
import { mainKeyboard } from "./start.handler";
import type { SessionStore } from "../session";

export function registerStatsHandler(bot: Telegraf, sessions: SessionStore) {

  // ── 📊 Statistika ──────────────────────────────────────────────────────────
  bot.hears(["📊 Statistika", "/stats"], async (ctx) => {
    const userId = BigInt(ctx.from.id);

    const [user, filterCount, notifCount, lastNotif, totalVacancies] = await Promise.all([
      prisma.user.findUnique({ where: { telegramId: userId } }),
      prisma.filter.count({ where: { userId } }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.findFirst({
        where:   { userId },
        orderBy: { sentAt: "desc" },
        include: { vacancy: { select: { title: true, channel: true } } },
      }),
      prisma.vacancy.count(),
    ]);

    if (!user) {
      await ctx.reply("❌ Topilmadi. /start yuboring.", mainKeyboard());
      return;
    }

    const status = user.isActive ? "🟢 Faol" : "⏸ Pauza";
    const silent = user.silentFrom != null && user.silentTo != null
      ? `🌙 ${user.silentFrom}:00 – ${user.silentTo}:00`
      : "—";

    const lastVac = lastNotif
      ? `${escapeHtml(lastNotif.vacancy.title ?? "Noma'lum")} · <i>${escapeHtml(lastNotif.vacancy.channel)}</i>`
      : "—";
    const lastTime = lastNotif ? formatDate(lastNotif.sentAt) : "—";

    await ctx.reply(
      `📊 <b>Sizning statistikangiz</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 <b>Profil:</b>\n` +
      `   Holat:          ${status}\n` +
      `   Sokin soatlar:  ${silent}\n\n` +
      `🎯 <b>Filterlar:</b>        <b>${filterCount} ta</b>\n\n` +
      `📬 <b>Bildirishnomalar:</b>\n` +
      `   Jami:           <b>${notifCount} ta</b>\n` +
      `   Oxirgisi:       ${lastTime}\n` +
      `   ↳ ${lastVac}\n\n` +
      `🌐 <b>Tizim:</b>\n` +
      `   Bazada vakansiya: <b>${totalVacancies.toLocaleString("ru")} ta</b>\n` +
      `   Kuzatilayotgan kanallar: <b>39 ta</b>`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📋 Filterlarni ko'rish", "go_to_filters")],
          [Markup.button.callback("🕘 Oxirgi vakansiyalar", "go_to_history")],
        ]),
      },
    );
  });

  bot.action("go_to_filters", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply("📋 Filterlarim tugmasini bosing 👇", mainKeyboard());
  });

  bot.action("go_to_history", async (ctx) => {
    await ctx.answerCbQuery();
    await sendHistory(ctx, BigInt(ctx.from!.id));
  });

  // ── 🕘 Tarixi ─────────────────────────────────────────────────────────────
  bot.hears(["🕘 Tarixi", "/history"], async (ctx) => {
    await sendHistory(ctx, BigInt(ctx.from.id));
  });

  // ── 🔍 Qidirish ───────────────────────────────────────────────────────────
  bot.hears(["🔍 Qidirish", "/search"], async (ctx) => {
    sessions.set(ctx.from.id, { step: "awaiting_search_query" });
    await ctx.reply(
      `🔍 <b>Vakansiya qidirish</b>\n\n` +
      `So'nggi <b>14 kun</b> ichidagi vakansiyalardan qidiradi.\n\n` +
      `<b>Kalit so'z yozing:</b>\n` +
      `<i>Misol: React, Python, Toshkent, Senior</i>`,
      { parse_mode: "HTML", ...Markup.removeKeyboard() },
    );
  });
}

// ─── History helper ───────────────────────────────────────────────────────────
async function sendHistory(ctx: any, userId: bigint): Promise<void> {
  const notifs = await prisma.notification.findMany({
    where:   { userId },
    orderBy: { sentAt: "desc" },
    take:    10,
    include: {
      vacancy: {
        select: {
          title: true, company: true, channel: true, technologies: true,
          level: true, workType: true, salary: true, messageLink: true,
          createdAt: true,
        },
      },
    },
  });

  if (!notifs.length) {
    await ctx.reply(
      `🕘 <b>Tarixi bo'sh</b>\n\n` +
      `Hali hech qanday vakansiya yuborilmagan.\n` +
      `Avval <b>➕ Filter qo'shish</b> tugmasini bosing.`,
      { parse_mode: "HTML", ...mainKeyboard() },
    );
    return;
  }

  await ctx.reply(
    `🕘 <b>Oxirgi ${notifs.length} ta vakansiya</b>`,
    { parse_mode: "HTML", ...mainKeyboard() },
  );

  for (const n of notifs) {
    const v = n.vacancy;
    const lines: string[] = [];

    lines.push(v.title ? `💼 <b>${escapeHtml(v.title)}</b>` : `💼 <b>Vakansiya</b>`);
    if (v.company) lines.push(`🏢 ${escapeHtml(v.company)}`);

    const meta: string[] = [];
    if (v.level)    meta.push({ junior: "🟢 Junior", middle: "🟡 Middle", senior: "🔴 Senior" }[v.level] ?? v.level);
    if (v.workType) meta.push({ remote: "🏠 Remote", office: "🏢 Ofis", hybrid: "🔄 Hybrid" }[v.workType] ?? v.workType);
    if (meta.length) lines.push(meta.join("  ·  "));

    if (v.technologies?.length) {
      lines.push(`🛠 <code>${escapeHtml(v.technologies.slice(0, 5).join(" · "))}</code>`);
    }
    if (v.salary) lines.push(`💰 ${escapeHtml(v.salary)}`);
    lines.push(`📡 <i>${escapeHtml(v.channel)}</i>  ·  <i>${formatDate(n.sentAt)}</i>`);

    const keyboard = v.messageLink
      ? Markup.inlineKeyboard([[Markup.button.url("📋 Ko'rish", v.messageLink)]])
      : undefined;

    await ctx.reply(lines.join("\n"), {
      parse_mode: "HTML",
      ...(keyboard ?? {}),
    }).catch(() => {});

    await sleep(150);
  }
}

// ─── Search query handler (message.handler dan chaqiriladi) ──────────────────
export async function handleSearchQuery(ctx: any, query: string): Promise<void> {
  const q = query.trim();
  if (q.length < 2) {
    await ctx.reply("❌ Kamida 2 ta belgi kiriting.", mainKeyboard());
    return;
  }

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 kun

  const vacancies = await prisma.vacancy.findMany({
    where: {
      createdAt: { gte: since },
      OR: [
        { title:    { contains: q, mode: "insensitive" } },
        { company:  { contains: q, mode: "insensitive" } },
        { text:     { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take:    8,
  });

  if (!vacancies.length) {
    await ctx.reply(
      `🔍 <b>"${escapeHtml(q)}"</b> bo'yicha natija topilmadi.\n\n` +
      `So'nggi 14 kun ichidagi vakansiyalar orasida qidirdi.`,
      { parse_mode: "HTML", ...mainKeyboard() },
    );
    return;
  }

  await ctx.reply(
    `🔍 <b>"${escapeHtml(q)}"</b> — <b>${vacancies.length} ta natija</b>`,
    { parse_mode: "HTML", ...mainKeyboard() },
  );

  for (const v of vacancies) {
    const lines: string[] = [];
    lines.push(v.title ? `💼 <b>${escapeHtml(v.title)}</b>` : `💼 <b>Vakansiya</b>`);
    if (v.company) lines.push(`🏢 ${escapeHtml(v.company)}`);

    const meta: string[] = [];
    if (v.level)    meta.push({ junior: "🟢 Junior", middle: "🟡 Middle", senior: "🔴 Senior" }[v.level] ?? v.level);
    if (v.workType) meta.push({ remote: "🏠 Remote", office: "🏢 Ofis", hybrid: "🔄 Hybrid" }[v.workType] ?? v.workType);
    if (v.location) meta.push(`📍 ${escapeHtml(v.location)}`);
    if (meta.length) lines.push(meta.join("  ·  "));

    if (v.technologies?.length) {
      lines.push(`🛠 <code>${escapeHtml(v.technologies.slice(0, 6).join(" · "))}</code>`);
    }
    if (v.salary)   lines.push(`💰 ${escapeHtml(v.salary)}`);
    lines.push(`📡 <i>${escapeHtml(v.channel)}</i>  ·  <i>${formatDate(v.createdAt)}</i>`);

    const keyboard = v.messageLink
      ? Markup.inlineKeyboard([[Markup.button.url("📋 Ko'rish", v.messageLink)]])
      : undefined;

    await ctx.reply(lines.join("\n"), { parse_mode: "HTML", ...(keyboard ?? {}) }).catch(() => {});
    await sleep(150);
  }
}
