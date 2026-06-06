import { Telegraf, Markup } from "telegraf";
import { prisma } from "../../../lib/prisma";
import { escapeHtml } from "../utils";
import path from "path";
import fs from "fs";

// Logo fayli — loyiha papkasida logo.png bo'lishi kerak
const LOGO_PATH = path.join(process.cwd(), "logo.png");

// Telegram file_id cache — bot restartdan keyin ham ishlashi uchun
let cachedFileId: string | null = null;

async function sendWithLogo(ctx: any, text: string): Promise<void> {
  const opts = { caption: text, parse_mode: "HTML" as const, ...mainKeyboard() };

  // 1. Cached file_id bor bo'lsa — tez yuboramiz
  if (cachedFileId) {
    try {
      await ctx.replyWithPhoto(cachedFileId, opts);
      return;
    } catch {
      cachedFileId = null; // file_id eskirgan — tozalaymiz
    }
  }

  // 2. Local logo.png bor bo'lsa — yuklaymiz va file_id saqlaymiz
  if (fs.existsSync(LOGO_PATH)) {
    try {
      const msg = await ctx.replyWithPhoto(
        { source: fs.createReadStream(LOGO_PATH) },
        opts,
      );
      // Yuborilgan rasmning file_id ni saqlaymiz
      cachedFileId = msg.photo?.at(-1)?.file_id ?? null;
      return;
    } catch {
      // Logo yuborilmadi — matn bilan davom etamiz
    }
  }

  // 3. Fallback — faqat matn
  await ctx.reply(text, { parse_mode: "HTML", ...mainKeyboard() });
}

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
      `💼 <b>IshTopperBot</b>ga xush kelibsiz!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Nima qilaman?</b>\n\n` +
      `📡 <b>29+ kanal</b>ni real-vaqtda kuzataman\n` +
      `🎯 Filtringizga mos vakansiyalarni <b>darhol</b> yuboraman\n` +
      `🔍 Maosh · Daraja · Hudud bo'yicha <b>aniq filtrlash</b>\n` +
      `⚡ Yangi vakansiya chiqsa — <b>birinchilardan</b> bilasiz\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🚀 Boshlash uchun <b>➕ Filter qo'shish</b> tugmasini bosing!`;

    await sendWithLogo(ctx, text);
  });
}

export function mainKeyboard() {
  return Markup.keyboard([
    ["➕ Filter qo'shish", "📋 Filterlarim"],
    ["🔍 Qidirish",        "🕘 Tarixi"],
    ["📊 Statistika",      "⚙️ Sozlamalar"],
  ]).resize();
}
