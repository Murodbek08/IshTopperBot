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

// ─── Kanallar ro'yxati ────────────────────────────────────────────────────────

const CHANNELS = [
  // IT / Dev
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

// ─── Spam / reklama filterlash ────────────────────────────────────────────────

const SPAM_PATTERNS = [
  /t\.me\/joinchat/i,              // kanal taklifi
  /подпишитесь|obuna bo.ling/i,    // obuna so'rovi (reklama)
  /рефeral|referral|affiliate/i,
  /казино|casino|bukmeker/i,
  /kriptovalyuta investitsiya/i,
  /earn \$\d+/i,
  /100% daromad/i,
];

function isSpam(text: string): boolean {
  // Juda qisqa xabarlar
  if (text.trim().length < 50) return true;
  return SPAM_PATTERNS.some((p) => p.test(text));
}

// ─── Client ───────────────────────────────────────────────────────────────────

function createClient(): TelegramClient {
  const apiId = Number(process.env.API_ID);
  const apiHash = process.env.API_HASH!;

  if (!apiId || !apiHash) {
    throw new Error("API_ID va API_HASH environment variable kerak");
  }

  const session = new StringSession(process.env.SESSION_STRING ?? "");
  return new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    retryDelay: 2000,
  });
}

// ─── Event handler ────────────────────────────────────────────────────────────

async function handleNewMessage(
  event: NewMessageEvent,
  client: TelegramClient,
): Promise<void> {
  const message = event.message;
  if (!message.text || message.text.trim().length < 30) return;

  // Spam tekshiruvi
  if (isSpam(message.text)) {
    logger.debug(CTX, "Spam/reklama — o'tkazildi");
    return;
  }

  // Channel nomini aniqlash
  let channelName = "unknown";
  try {
    const chat = await message.getChat();
    if (chat && "username" in chat && chat.username) {
      channelName = chat.username;
    } else if (chat && "title" in chat && chat.title) {
      channelName = chat.title;
    }
  } catch {
    // ignore — ba'zan getChat() ishlamaydi
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
  if (!parsed) {
    logger.debug(CTX, `Vakansiya emas — ${channelName}`);
    return;
  }

  logger.info(CTX, `Yangi vakansiya`, {
    channel: channelName,
    title: parsed.title,
    company: parsed.company,
    techs: parsed.technologies,
    type: parsed.jobType,
    level: parsed.level,
    workType: parsed.workType,
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

  // Matching va xabarnoma
  await matchAndNotify(vacancy.id);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function startParser(): Promise<void> {
  const client = createClient();

  await client.start({
    phoneNumber: async () => input.text("📱 Telefon raqamingiz (+998...): "),
    password: async () => input.text("🔒 2FA parol (bo'lmasa Enter): "),
    phoneCode: async () => input.text("📨 SMS kod: "),
    onError: (err) => logger.error(CTX, "Auth xato", { error: err.message }),
  });

  // Session ni bir marta log qilamiz
  const savedSession = client.session.save() as unknown as string;
  if (savedSession && !process.env.SESSION_STRING) {
    logger.info(
      CTX,
      `✅ Session yaratildi. .env ga qo'ying:\nSESSION_STRING="${savedSession}"`,
    );
  }

  const chats = CHANNELS.map((ch) => `@${ch}`);

  client.addEventHandler(
    (event: NewMessageEvent) => handleNewMessage(event, client),
    new NewMessage({ chats }),
  );

  logger.info(
    CTX,
    `✅ Parser ishga tushdi — ${CHANNELS.length} kanal kuzatilmoqda`,
    { channels: CHANNELS },
  );
}
