import { Telegraf, Markup } from "telegraf";
import { prisma } from "../../../lib/prisma";
import { escapeHtml } from "../utils";

const ADMIN_IDS = (process.env.ADMIN_IDS ?? "")
  .split(",")
  .map((s) => parseInt(s.trim()))
  .filter((n) => !isNaN(n));

function isAdmin(id: number): boolean {
  return ADMIN_IDS.includes(id);
}

// Broadcast kutayotgan adminlar
const broadcastPending = new Set<number>();

export function registerAdminHandler(bot: Telegraf) {

  // ── /admin ────────────────────────────────────────────────────────────────
  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx.from.id)) { await ctx.reply("❌ Ruxsat yo'q."); return; }
    await sendAdminStats(ctx);
  });

  // ── Yangilash ─────────────────────────────────────────────────────────────
  bot.action("admin_refresh", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) { await ctx.answerCbQuery("❌"); return; }
    await ctx.answerCbQuery("🔄 Yangilanmoqda...");
    await sendAdminStats(ctx, true);
  });

  // ── Foydalanuvchilar ro'yxati ─────────────────────────────────────────────
  bot.action(/^admin_users:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx.from!.id)) { await ctx.answerCbQuery("❌"); return; }
    await ctx.answerCbQuery();
    const page = parseInt(ctx.match[1]);
    await sendUserList(ctx, page, true);
  });

  bot.command("users", async (ctx) => {
    if (!isAdmin(ctx.from.id)) { await ctx.reply("❌ Ruxsat yo'q."); return; }
    await sendUserList(ctx, 0, false);
  });

  // ── Broadcast boshlash ────────────────────────────────────────────────────
  bot.action("admin_broadcast_start", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) { await ctx.answerCbQuery("❌"); return; }
    await ctx.answerCbQuery();
    broadcastPending.add(ctx.from!.id);
    await ctx.reply(
      `📢 <b>Broadcast</b>\n\n` +
      `Barcha faol foydalanuvchilarga yuboriladigan xabarni yozing.\n\n` +
      `✅ HTML teglari ishlaydi: <code>&lt;b&gt;bold&lt;/b&gt;</code>, <code>&lt;i&gt;italic&lt;/i&gt;</code>\n\n` +
      `/cancel — bekor qilish`,
      { parse_mode: "HTML" },
    );
  });

  // ── /cancel ───────────────────────────────────────────────────────────────
  bot.command("cancel", async (ctx) => {
    if (broadcastPending.has(ctx.from.id)) {
      broadcastPending.delete(ctx.from.id);
      await ctx.reply("❌ Broadcast bekor qilindi.", Markup.removeKeyboard());
    }
  });

  // ── Broadcast xabarini ushlab yuborish ────────────────────────────────────
  bot.on("text", async (ctx, next) => {
    const userId = ctx.from.id;
    if (!isAdmin(userId) || !broadcastPending.has(userId)) {
      return next(); // admin emas yoki broadcast kutmayapti — o'tkazamiz
    }

    broadcastPending.delete(userId);
    const messageText = ctx.message.text;

    if (messageText === "/cancel") {
      await ctx.reply("❌ Broadcast bekor qilindi.");
      return;
    }

    // Faol foydalanuvchilar ro'yxati
    const users = await prisma.user.findMany({
      where:  { isActive: true },
      select: { telegramId: true },
    });

    await ctx.reply(
      `📢 <b>Broadcast boshlanmoqda...</b>\n` +
      `👥 ${users.length} ta foydalanuvchiga yuboriladi`,
      { parse_mode: "HTML" },
    );

    let sent = 0, failed = 0;

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.telegramId.toString(), messageText, {
          parse_mode: "HTML",
        });
        sent++;
      } catch (err: any) {
        failed++;
        // Bloklagan foydalanuvchini deactivate qilamiz
        if (err?.code === 403) {
          await prisma.user.update({
            where: { telegramId: user.telegramId },
            data:  { isActive: false },
          }).catch(() => {});
        }
      }
      // Rate limit: 30 msg/sec dan oshmaslik uchun
      await new Promise((res) => setTimeout(res, 50));
    }

    await ctx.reply(
      `✅ <b>Broadcast tugadi!</b>\n\n` +
      `📬 Yuborildi:    <b>${sent}</b>\n` +
      `❌ Xato/blok:   <b>${failed}</b>`,
      { parse_mode: "HTML" },
    );
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function sendAdminStats(ctx: any, edit = false): Promise<void> {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, activeUsers, newUsersToday,
    totalVacancies, vacanciesThisWeek, vacanciesThisMonth,
    totalNotifs, notifsToday,
    totalFilters,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.vacancy.count(),
    prisma.vacancy.count({ where: { createdAt: { gte: week } } }),
    prisma.vacancy.count({ where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } } }),
    prisma.notification.count(),
    prisma.notification.count({ where: { sentAt: { gte: today } } }),
    prisma.filter.count(),
  ]);

  const topChannels = await prisma.vacancy.groupBy({
    by:      ["channel"],
    _count:  { id: true },
    orderBy: { _count: { id: "desc" } },
    take:    5,
  });

  const channelLines = topChannels.length
    ? topChannels.map((c, i) => `   ${i + 1}. @${c.channel} — ${c._count.id} ta`).join("\n")
    : "   (hali ma'lumot yo'q)";

  const text =
    `🛠 <b>Admin Panel — IshTopperBot</b>\n` +
    `<i>${now.toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}</i>\n` +
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
    `📡 <b>Top kanallar:</b>\n` +
    channelLines;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("🔄 Yangilash", "admin_refresh")],
    [Markup.button.callback("👥 Foydalanuvchilar ro'yxati", "admin_users:0")],
    [Markup.button.callback("📢 Broadcast yuborish", "admin_broadcast_start")],
  ]);

  if (edit) {
    await ctx.editMessageText(text, { parse_mode: "HTML", ...keyboard }).catch(() => {});
  } else {
    await ctx.reply(text, { parse_mode: "HTML", ...keyboard });
  }
}

// ─── Foydalanuvchilar ro'yxati ────────────────────────────────────────────────

const PAGE_SIZE = 10;

async function sendUserList(ctx: any, page: number, edit: boolean): Promise<void> {
  const totalUsers = await prisma.user.count();
  const totalPages = Math.ceil(totalUsers / PAGE_SIZE);
  const safePage   = Math.max(0, Math.min(page, totalPages - 1));

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    skip:    safePage * PAGE_SIZE,
    take:    PAGE_SIZE,
    include: {
      _count: { select: { filters: true, notifications: true } },
    },
  });

  if (!users.length) {
    await ctx.reply("👥 Foydalanuvchilar yo'q.");
    return;
  }

  const lines: string[] = [
    `👥 <b>Foydalanuvchilar</b>  (${safePage + 1}/${totalPages} bet, jami: ${totalUsers})\n━━━━━━━━━━━━━━━━━━━━\n`,
  ];

  for (const u of users) {
    const name    = escapeHtml(u.firstName ?? u.username ?? "Noma'lum");
    const uname   = u.username ? ` @${escapeHtml(u.username)}` : "";
    const status  = u.isActive ? "🟢" : "⏸";
    const joined  = u.createdAt.toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent" });

    lines.push(
      `${status} <b>${name}</b>${uname}\n` +
      `   ID: <code>${u.telegramId}</code>\n` +
      `   📋 ${u._count.filters} filtr  ·  📬 ${u._count.notifications} bildirishnoma\n` +
      `   📅 ${joined}`,
    );
  }

  const navButtons: ReturnType<typeof Markup.button.callback>[] = [];
  if (safePage > 0)              navButtons.push(Markup.button.callback("◀️ Oldingi", `admin_users:${safePage - 1}`));
  if (safePage < totalPages - 1) navButtons.push(Markup.button.callback("Keyingi ▶️", `admin_users:${safePage + 1}`));

  const keyboard = Markup.inlineKeyboard([
    navButtons,
    [Markup.button.callback("🔙 Admin panel", "admin_refresh")],
  ].filter((row) => row.length > 0));

  const text = lines.join("\n");

  if (edit) {
    await ctx.editMessageText(text, { parse_mode: "HTML", ...keyboard }).catch(() => {});
  } else {
    await ctx.reply(text, { parse_mode: "HTML", ...keyboard });
  }
}
