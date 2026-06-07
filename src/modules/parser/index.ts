import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import * as input from "input";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { config } from "../../config";
import { parseVacancy } from "./vacancy.parser";
import { isSpam } from "./spam.filter";
import { matchAndNotify } from "../matcher";

const CTX = "Parser";

// ─── Kuzatiladigan kanallar ───────────────────────────────────────────────────
const CHANNELS = [
  // ── Mavjud kanallar ──────────────────────────────────────────────────────
  "UstozShogird",           // Ustoz-Shogird — o'zbek IT hamjamiyati
  "vakansiyalar_uz_uz",     // Vakansiyalar UZ
  "freelancer_Uzbek",       // Freelancer Uzbekistan
  "unilance",               // Unilance — freelance platform
  "ayti_jobs",              // AytiJobs
  "joblinkuz",              // JobLink UZ
  "data_ish",               // Data Science ish o'rinlari
  "we_use_js",              // JS developers vakansiya
  "nodejsjobsfeed",         // Node.js jobs
  "qamar_ads",              // Qamar ads — vakansiyalar
  "ishmi_ish",              // Ish bor — vakansiyalar
  "Exampleuz",              // Example.uz IT Jobs
  "techjobs_vakansiya",     // Tech Jobs Vakansiya
  "freelance_link",         // Freelance Link
  "frontend",               // Frontend developers
  "upjobsuz",               // UpJobs UZ
  "Jobs_uz_vacancy",        // Jobs UZ Vacancy
  "kasbim_uz",              // Kasbim.uz
  "UstozShogirdSohalar",    // Ustoz-Shogird sohalar
  "freelance_uzb",          // Freelance UZB
  "itmarket_uz",            // IT Market UZ
  "rabotak_razrabotchik",   // Razrabotchik ish o'rinlari
  "it_jobs_uz",             // IT Jobs UZ
  "fintech_jobs",           // FinTech Jobs
  "click_jobs",             // ClickJobs — yuqori maoshli IT
  "jobmarket_uz",           // Job Market UZ
  "rizqimuz",               // Rizqim.uz
  "frontEndJobo",           // Frontend jobs
  "frontendVacancy",        // Frontend Vacancy

  // ── Yangi qo'shilgan kanallar ─────────────────────────────────────────
  "uzdev_jobs",             // UzDev Jobs — turli kompaniyalar vakansiyalari
  "ITjobs_Uzbekistan",      // Uzbekistan IT Jobs — Toshkent va O'zbekiston
  "itjobstashkent",         // IT Jobs Tashkent
  "ishgo_uz",               // IshGO — umumiy ish o'rinlari
  "uzpythonjobs",           // Python vakansiyalar O'zbekiston
  "ishtop",                 // Ish Top — kunlik vakansiyalar
  "ish_toshkent",           // Ish Toshkent — Toshkent vakansiyalari
  "ishtoparuz_kanal",       // IshTopar.uz — minglab vakansiyalar
  "ish_boru",               // Bo'sh ishlar e'lonlar — barcha viloyatlar
  "it_vakansii_jobs",       // IT vakansiyalar (RU/UZ)
  "uzdev",                  // UzDev — o'zbek dasturchilar hamjamiyati
  "flutter_jobs_uz",        // Flutter developer vakansiyalar
  "android_jobs_uz",        // Android developer vakansiyalar
  "backend_jobs_uz",        // Backend developer vakansiyalar
  "designjobs_uz",          // Design vakansiyalar UZ
  "qamarkonsult",           // Qamar konsult — IT HR
  "it_hr_uz",               // IT HR UZ — recruiterlar
  "devjobs_uz",             // DevJobs UZ
] as const;

// ─── Channel name cache ───────────────────────────────────────────────────────
const channelCache = new Map<string, string>();

async function resolveChannelName(message: NewMessageEvent["message"]): Promise<string> {
  try {
    const chat = await message.getChat();
    if (!chat) return "unknown";

    const key = String((chat as any).id ?? "");
    if (channelCache.has(key)) return channelCache.get(key)!;

    let name = "unknown";
    if ("username" in chat && (chat as any).username) {
      name = (chat as any).username as string;
    } else if ("title" in chat && (chat as any).title) {
      name = ((chat as any).title as string).replace(/\s+/g, "_");
    }

    if (key) channelCache.set(key, name);
    return name;
  } catch {
    return "unknown";
  }
}

// ─── Xabar qayta ishlash ──────────────────────────────────────────────────────
async function processMessage(
  message: NewMessageEvent["message"],
  channelName: string,
): Promise<void> {
  const text = message.text?.trim() ?? "";
  if (!text || text.length < 15) return;

  if (isSpam(text)) {
    logger.debug(CTX, `Spam — @${channelName}`);
    return;
  }

  const messageId = BigInt(message.id);

  // Duplicate tekshiruvi
  const exists = await prisma.vacancy.findUnique({
    where:  { messageId },
    select: { id: true },
  });
  if (exists) return;

  // Parse
  const parsed = parseVacancy(text, channelName);
  if (!parsed) {
    logger.debug(CTX, `Score past — @${channelName} | "${text.slice(0, 50)}..."`);
    return;
  }

  const messageLink =
    channelName !== "unknown"
      ? `https://t.me/${channelName}/${message.id}`
      : null;

  logger.info(CTX, `✅ Yangi ${parsed.jobType}`, {
    channel:  channelName,
    title:    parsed.title ?? "(yo'q)",
    level:    parsed.level,
    workType: parsed.workType,
    techs:    parsed.technologies.slice(0, 5),
  });

  try {
    const vacancy = await prisma.vacancy.create({
      data: {
        text,
        channel:         channelName,
        messageId,
        messageLink,
        title:           parsed.title,
        company:         parsed.company,
        location:        parsed.location,
        salary:          parsed.salary,
        salaryMin:       parsed.salaryMin,
        salaryMax:       parsed.salaryMax,
        technologies:    parsed.technologies,
        telegramContact: parsed.telegramContact,
        phone:           parsed.phone,
        workType:        parsed.workType,
        level:           parsed.level,
        jobType:         parsed.jobType,
      },
    });

    await matchAndNotify(vacancy.id);
  } catch (err: any) {
    // messageId unique constraint — bu xabar allaqachon saqlangan
    if (err?.code === "P2002") return;
    logger.error(CTX, "DB saqlashda xato", { error: err?.message });
  }
}

// ─── Event handler ────────────────────────────────────────────────────────────
async function handleNewMessage(event: NewMessageEvent): Promise<void> {
  try {
    const channelName = await resolveChannelName(event.message);
    await processMessage(event.message, channelName);
  } catch (err: any) {
    logger.error(CTX, "handleNewMessage xato", { error: err?.message ?? String(err) });
  }
}

// ─── Client yaratish ──────────────────────────────────────────────────────────
function createClient(): TelegramClient {
  const session = new StringSession(config.sessionString);
  return new TelegramClient(session, config.apiId, config.apiHash, {
    connectionRetries: 10,
    retryDelay:        3000,
    autoReconnect:     true,
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function startParser(): Promise<void> {
  const client = createClient();

  await client.start({
    phoneNumber: async () => input.text("📱 Telefon raqamingiz (+998...): "),
    password:    async () => input.text("🔒 2FA parol (bo'lmasa Enter): "),
    phoneCode:   async () => input.text("📨 SMS kod: "),
    onError:     (err) => logger.error(CTX, "Auth xato", { error: err.message }),
  });

  // Birinchi marta session string logga chiqariladi
  const savedSession = client.session.save() as unknown as string;
  if (savedSession && !config.sessionString) {
    logger.info(CTX, `SESSION_STRING ni .env ga qo'ying:\nSESSION_STRING="${savedSession}"`);
  }

  const chats = CHANNELS.map((ch) => `@${ch}`);

  // MUHIM: handler faqat BIR MARTA qo'shiladi
  // Reconnect bo'lganda TelegramClient avtomatik qayta ulanadi (autoReconnect: true)
  // addEventHandler qayta chaqirilmaydi — duplicate handler muammosinining oldini oladi
  client.addEventHandler(handleNewMessage, new NewMessage({ chats }));

  logger.info(CTX, `✅ Parser ishga tushdi — ${chats.length} kanal kuzatilmoqda`, {
    channels: CHANNELS,
  });

  // Ulanish monitoringi — 5 daqiqada bir tekshirish
  setInterval(async () => {
    try {
      if (!client.connected) {
        logger.warn(CTX, "Ulanish yo'q — qayta ulanmoqda...");
        await client.connect();
        logger.info(CTX, "✅ Qayta ulandi");
        // addEventHandler CHAQIRILMAYDI — mavjud handler saqlanadi
      }
    } catch (err: any) {
      logger.error(CTX, "Reconnect xato", { error: err?.message });
    }
  }, 5 * 60 * 1000);
}
