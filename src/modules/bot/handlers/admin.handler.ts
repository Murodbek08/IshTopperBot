import { Telegraf, Markup } from "telegraf";
import { prisma } from "../../../lib/prisma";
import { escapeHtml, formatDate, sleep } from "../utils";
import { config } from "../../../config";
import { bot } from "../index";
import type { SessionStore } from "../session";

const PAGE_SIZE = 10;

// Broadcast kutayotgan adminlar (in-memory, restart da tozalanadi)
const broadcastPending = new Set<number>();

function isAdmin(id: number): boolean {
  return config.adminIds.includes(id);
}

export function registerAdminHandler(telegraf: Telegraf, sessions?: SessionStore) {

  // ── /admin ────────────────────────────────────────────────────────────────
  telegraf.command("admin", async (ctx) => {
    if (!isAdmin(ctx.from.id)) { await ctx.reply("❌ Ruxsat yo'q."); return; }
    await sendAdminStats(ctx, false);
  });

  // ── Yangilash ─────────────────────────────────────────────────────────────
  telegraf.action("admin_refresh", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) { await ctx.answerCbQuery("❌"); return; }
    await ctx.answerCbQuery("🔄 Yangilanmoqda...");
    await sendAdminStats(ctx, true);
  });

  // ── Foydalanuvchilar ro'yxati ─────────────────────────────────────────────
  telegraf.action(/^admin_users:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx.from!.id)) { await ctx.answerCbQuery("❌"); return; }
    await ctx.answerCbQuery();
    await sendUserList(ctx, parseInt(ctx.match[1]), true);
  });

  telegraf.command("users", async (ctx) => {
    if (!isAdmin(ctx.from.id)) { await ctx.reply("❌ Ruxsat yo'q."); return; }
    await sendUserList(ctx, 0, false);
  });

  // ── Broadcast boshlash ────────────────────────────────────────────────────
  telegraf.action("admin_broadcast_start", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) { await ctx.answerCbQuery("❌"); return; }
    await ctx.answerCbQuery();
    broadcastPending.add(ctx.from!.id);
    await ctx.reply(
      `📢 <b>Broadcast</b>\n\n` +
      `Barcha faol foydalanuvchilarga yuboriladigan xabarni yozing.\n\n` +
      `<b>HTML teglari qo'llab-quvvatlanadi:</b>\n` +
      `<code>&lt;b&gt;bold&lt;/b&gt;</code>  <code>&lt;i&gt;italic&lt;/i&gt;</code>  <code>&lt;code&gt;code&lt;/code&gt;</code>\n\n` +
      `/cancel — bekor qilish`,
      { parse_mode: "HTML" },
    );
  });

  // ── /cancel ───────────────────────────────────────────────────────────────
  telegraf.command("cancel", async (ctx) => {
    if (broadcastPending.delete(ctx.from.id)) {
      await ctx.reply("❌ Broadcast bekor qilindi.");
    }
  });

  // ── Broadcast text handler (ADMIN uchun) ──────────────────────────────────
  telegraf.on("text", async (ctx, next) => {
    const userId = ctx.from.id;
    // Agar admin emas yoki broadcast kutmayotgan bo'lsa — o'tkazib yuborish
    if (!isAdmin(userId) || !broadcastPending.has(userId)) {
      return next();
    }
    // Agar foydalanuvchida boshqa aktiv session bo'lsa (masalan qidirish) — o'tkazib yuborish
    if (sessions?.get(userId)) {
      broadcastPending.delete(userId);
      return next();
    }
    broadcastPending.delete(userId);

    const messageText = ctx.message.text;
    if (messageText === "/cancel") {
      await ctx.reply("❌ Bekor qilindi.");
      return;
    }

    await runBroadcast(ctx, messageText);
  });
}

// ─── Broadcast logikasi ───────────────────────────────────────────────────────
async function runBroadcast(ctx: any, text: string): Promise<void> {
  const users = await prisma.user.findMany({
    where:  { isActive: true },
    select: { telegramId: true },
  });

  const progressMsg = await ctx.reply(
    `📢 <b>Broadcast boshlanmoqda...</b>\n👥 ${users.length} ta foydalanuvchi`,
    { parse_mode: "HTML" },
  );

  let sent = 0, failed = 0, blocked = 0;
  const startTime = Date.now();

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.telegramId.toString(), text, { parse_mode: "HTML" });
      sent++;
    } catch (err: any) {
      if (err?.code === 403) {
        blocked++;
        // Bloklagan userlarni deactivate qilamiz
        await prisma.user.update({
          where: { telegramId: user.telegramId },
          data:  { isActive: false },
        }).catch(() => {});
      } else if (err?.code === 429) {
        await sleep((err?.parameters?.retry_after ?? 10) * 1000);
        // Qayta urinish
        try {
          await bot.telegram.sendMessage(user.telegramId.toString(), text, { parse_mode: "HTML" });
          sent++;
        } catch { failed++; }
      } else {
        failed++;
      }
    }
    await sleep(50); // 20 msg/sec
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  await ctx.reply(
    `✅ <b>Broadcast tugadi!</b>  (${elapsed} son)\n\n` +
    `📬 Yuborildi:   <b>${sent}</b>\n` +
    `⛔ Bloklagan:   <b>${blocked}</b>\n` +
    `❌ Xato:        <b>${failed}</b>`,
    { parse_mode: "HTML" },
  );
}

// ─── Admin statistika ─────────────────────────────────────────────────────────
async function sendAdminStats(ctx: any, edit: boolean): Promise<void> {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers, activeUsers, newUsersToday,
    totalVacancies, vacanciesThisWeek, vacanciesThisMonth,
    totalNotifs, notifsToday,
    totalFilters,
    topChannels,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.vacancy.count(),
    prisma.vacancy.count({ where: { createdAt: { gte: week } } }),
    prisma.vacancy.count({ where: { createdAt: { gte: month } } }),
    prisma.notification.count(),
    prisma.notification.count({ where: { sentAt: { gte: today } } }),
    prisma.filter.count(),
    prisma.vacancy.groupBy({
      by:      ["channel"],
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
      take:    5,
    }),
  ]);

  const channelLines = topChannels.length
    ? topChannels.map((c, i) => `   ${i + 1}. @${c.channel} — ${c._count.id} ta`).join("\n")
    : "   (hali ma'lumot yo'q)";

  const text =
    `🛠 <b>Admin Panel — IshTopperBot</b>\n` +
    `<i>${formatDate(now)}</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👥 <b>Foydalanuvchilar:</b>\n` +
    `   Jami:            <b>${totalUsers}</b>\n` +
    `   Faol:            <b>${activeUsers}</b>  (pauza: ${totalUsers - activeUsers})\n` +
    `   Bugun qo'shildi: <b>${newUsersToday}</b>\n\n` +
    `📋 <b>Filterlar:</b>\n` +
    `   Jami:            <b>${totalFilters}</b>  (~${(totalFilters / Math.max(activeUsers, 1)).toFixed(1)} ta/user)\n\n` +
    `💼 <b>Vakansiyalar:</b>\n` +
    `   Jami:            <b>${totalVacancies.toLocaleString("ru")}</b>\n` +
    `   Bu hafta:        <b>${vacanciesThisWeek}</b>\n` +
    `   Bu oy:           <b>${vacanciesThisMonth}</b>\n\n` +
    `📬 <b>Bildirishnomalar:</b>\n` +
    `   Jami:            <b>${totalNotifs.toLocaleString("ru")}</b>\n` +
    `   Bugun:           <b>${notifsToday}</b>\n\n` +
    `📡 <b>Top kanallar:</b>\n${channelLines}`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("🔄 Yangilash", "admin_refresh")],
    [Markup.button.callback("👥 Foydalanuvchilar", "admin_users:0")],
    [Markup.button.callback("📢 Broadcast", "admin_broadcast_start")],
  ]);

  if (edit) {
    await ctx.editMessageText(text, { parse_mode: "HTML", ...keyboard }).catch(() => {});
  } else {
    await ctx.reply(text, { parse_mode: "HTML", ...keyboard });
  }
}

// ─── Foydalanuvchilar ro'yxati ────────────────────────────────────────────────
async function sendUserList(ctx: any, page: number, edit: boolean): Promise<void> {
  const totalUsers = await prisma.user.count();
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const safePage   = Math.max(0, Math.min(page, totalPages - 1));

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    skip:    safePage * PAGE_SIZE,
    take:    PAGE_SIZE,
    include: { _count: { select: { filters: true, notifications: true } } },
  });

  if (!users.length) {
    await ctx.reply("👥 Foydalanuvchilar yo'q.");
    return;
  }

  const lines: string[] = [
    `👥 <b>Foydalanuvchilar</b>  (${safePage + 1}/${totalPages} bet · jami: ${totalUsers})\n━━━━━━━━━━━━━━━━━━━━\n`,
  ];

  for (const u of users) {
    const name   = escapeHtml(u.firstName ?? u.username ?? "Noma'lum");
    const uname  = u.username ? ` @${u.username}` : "";
    const status = u.isActive ? "🟢" : "⏸";
    const silent = u.silentFrom != null
      ? `  🌙 ${u.silentFrom}:00–${u.silentTo}:00`
      : "";

    lines.push(
      `${status} <b>${name}</b>${escapeHtml(uname)}${silent}\n` +
      `   <code>${u.telegramId}</code>  ·  📋 ${u._count.filters}  ·  📬 ${u._count.notifications}\n` +
      `   📅 ${formatDate(u.createdAt)}`,
    );
  }

  const nav: ReturnType<typeof Markup.button.callback>[] = [];
  if (safePage > 0)              nav.push(Markup.button.callback("◀️", `admin_users:${safePage - 1}`));
  if (safePage < totalPages - 1) nav.push(Markup.button.callback("▶️", `admin_users:${safePage + 1}`));

  const keyboard = Markup.inlineKeyboard([
    ...(nav.length ? [nav] : []),
    [Markup.button.callback("🔙 Admin panel", "admin_refresh")],
  ]);

  const text = lines.join("\n");
  if (edit) {
    await ctx.editMessageText(text, { parse_mode: "HTML", ...keyboard }).catch(() => {});
  } else {
    await ctx.reply(text, { parse_mode: "HTML", ...keyboard });
  }
}
