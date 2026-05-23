import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import * as input from "input";
import * as dotenv from "dotenv";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { parseVacancy } from "./vacancy.parser";
import { matchAndNotify } from "../matcher";

dotenv.config();

const CTX = "Parser";

// ─── Config ───────────────────────────────────────────────────────────────────

const CHANNELS = [
  "UstozShogird",
  "vakansiyalar_uz_uz",
  "freelancer_Uzbek",
  "unilance",
  "ayti_jobs",
  "joblinkuz",
  "data_ish",
  "we_use_js",
  "nodejsjobsfeed",
  "qamar_ads",
  "ishmi_ish",
  "Exampleuz",
  "techjobs_vakansiya",
  "freelance_link",
  "frontend",
  "upjobsuz",
  "Jobs_uz_vacancy",
  "kasbim_uz",
  "UstozShogirdSohalar",
  "freelance_uzb",
  "itmarket_uz",
  "rabotak_razrabotchik",
  "it_jobs_uz",
  "fintech_jobs",
  "click_jobs",
  "jobmarket_uz",
  "rizqimuz",
  "frontEndJobo",
  "frontendVacancy",
] as const;

// ─── Client ───────────────────────────────────────────────────────────────────

function createClient(): TelegramClient {
  const apiId = Number(process.env.API_ID);
  const apiHash = process.env.API_HASH!;

  if (!apiId || !apiHash) {
    throw new Error("API_ID va API_HASH environment variable kerak");
  }

  // SESSION env'dan olish yoki bo'sh string (birinchi marta auth)
  const sessionString = process.env.SESSION_STRING ?? "";
  const session = new StringSession(sessionString);

  return new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });
}

// ─── Event handler ────────────────────────────────────────────────────────────

async function handleNewMessage(event: NewMessageEvent): Promise<void> {
  const message = event.message;

  // Faqat matnli xabarlarni qabul qilamiz
  if (!message.text || message.text.trim().length < 20) return;

  // Channel nomini aniqlaymiz
  let channelName = "unknown";
  try {
    const chat = await message.getChat();
    if (chat && "username" in chat && chat.username) {
      channelName = chat.username;
    } else if (chat && "title" in chat && chat.title) {
      channelName = chat.title;
    }
  } catch {
    // ignore
  }

  const messageId = BigInt(message.id);

  // Duplicate tekshirish
  const exists = await prisma.vacancy.findUnique({
    where: { messageId },
    select: { id: true },
  });
  if (exists) return;

  // Parse qilish
  const parsed = parseVacancy(message.text);

  // Vakansiyaga o'xshamasa saqlashdan o'tamiz
  if (!parsed) {
    logger.debug(CTX, `Vakansiya emas, o'tkazib yuborildi`, { channelName });
    return;
  }

  logger.info(CTX, `Yangi vakansiya aniqlandi`, {
    channel: channelName,
    title: parsed.title,
    company: parsed.company,
    techs: parsed.technologies,
  });

  // DB ga saqlash
  const vacancy = await prisma.vacancy.create({
    data: {
      text: message.text,
      channel: channelName,
      messageId,
      title: parsed.title,
      company: parsed.company,
      location: parsed.location,
      salary: parsed.salary,
      salaryMin: parsed.salaryMin,
      technologies: parsed.technologies,
      telegramContact: parsed.telegramContact,
      phone: parsed.phone,
      workType: parsed.workType,
      level: parsed.level,
    },
  });

  // Matching va notification
  await matchAndNotify(vacancy.id);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function startParser(): Promise<void> {
  const client = createClient();

  // Auth
  await client.start({
    phoneNumber: async () => input.text("📱 Telefon raqamingiz: "),
    password: async () => input.text("🔒 2FA parolingiz (bo'lmasa Enter): "),
    phoneCode: async () => input.text("📨 SMS kodingiz: "),
    onError: (err) => logger.error(CTX, "Auth xatosi", { error: err.message }),
  });

  // Session string'ni bir marta konsolga chiqaramiz — .env ga qo'yish uchun
  const savedSession = client.session.save() as unknown as string;
  if (savedSession && !process.env.SESSION_STRING) {
    logger.info(
      CTX,
      "✅ Yangi session yaratildi. Quyidagini .env ga qo'ying:\n" +
        `SESSION_STRING="${savedSession}"`,
    );
  }

  // Channel'larga subscribe
  const chats = CHANNELS.map((ch) => `@${ch}`);
  client.addEventHandler(handleNewMessage, new NewMessage({ chats }));

  logger.info(
    CTX,
    `Parser ishga tushdi. ${CHANNELS.length} kanal kuzatilmoqda ✅`,
    {
      channels: CHANNELS,
    },
  );
}
