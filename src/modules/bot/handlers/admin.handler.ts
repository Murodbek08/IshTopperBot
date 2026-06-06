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

export function registerAdminHandler(bot: Telegraf) {

  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      await ctx.reply("❌ Ruxsat yo'q.");
      return;
    }

    await sendAdminStats(ctx);
  });

  bot.action("admin_refresh", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) { await ctx.answerCbQuery("❌"); return; }
    await ctx.answerCbQuery("🔄 Yangilanmoqda...");
    await sendAdminStats(ctx, true);
  });

  bot.action("admin_broadcast_start", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) { await ctx.answerCbQuery("❌"); return; }
    await ctx.answerCbQuery();
    await ctx.reply(
      "📢 <b>Broadcast</b>\n\nYubormoqchi bo'lgan xabarni yozing:\n<i>/cancel — bekor qilish</i>",
      { parse_mode: "HTML" },
    );
  });
}

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

  // Eng ko'p vakansiya joylagan kanallar
  const topChannels = await prisma.vacancy.groupBy({
    by:      ["channel"],
    _count:  { id: true },
    orderBy: { _count: { id: "desc" } },
    take:    5,
  });

  const channelLines = topChannels
    .map((c, i) => `   ${i + 1}. @${c.channel} — ${c._count.id} ta`)
    .join("\n");

  const text =
    `🛠 <b>Admin Panel — IshTopperBot</b>\n` +
    `<i>${now.toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👥 <b>Foydalanuvchilar:</b>\n` +
    `   Jami:           <b>${totalUsers}</b>\n` +
    `   Faol:           <b>${activeUsers}</b>  (pauza: ${totalUsers - activeUsers})\n` +
    `   Bugun qo'shildi: <b>${newUsersToday}</b>\n\n` +
    `📋 <b>Filterlar:</b>\n` +
    `   Jami:           <b>${totalFilters}</b>  (o'rtacha ${(totalFilters / Math.max(activeUsers, 1)).toFixed(1)} ta/user)\n\n` +
    `💼 <b>Vakansiyalar:</b>\n` +
    `   Jami:           <b>${totalVacancies.toLocaleString("ru")}</b>\n` +
    `   Bu hafta:       <b>${vacanciesThisWeek}</b>\n` +
    `   Bu oy:          <b>${vacanciesThisMonth}</b>\n\n` +
    `📬 <b>Bildirishnomalar:</b>\n` +
    `   Jami:           <b>${totalNotifs.toLocaleString("ru")}</b>\n` +
    `   Bugun:          <b>${notifsToday}</b>\n\n` +
    `📡 <b>Top kanallar (all-time):</b>\n` +
    channelLines;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("🔄 Yangilash", "admin_refresh")],
    [Markup.button.callback("📢 Broadcast", "admin_broadcast_start")],
  ]);

  if (edit) {
    await ctx.editMessageText(text, { parse_mode: "HTML", ...keyboard }).catch(() => {});
  } else {
    await ctx.reply(text, { parse_mode: "HTML", ...keyboard });
  }
}
