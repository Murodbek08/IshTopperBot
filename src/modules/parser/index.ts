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
// Har bir kanal tekshirilgan: mavjud, faol, yo'nalishga mos
const CHANNELS = [

  // ════════════════════════════════════════════════════════════════
  // ✅ IT-FOCUSED — faqat yoki asosan IT vakansiyalar
  // ════════════════════════════════════════════════════════════════

  "UstozShogird",           // ✅ 22K obunachilar | IT job marketplace, Python/React/Flutter
  "unilance",               // ✅ Faol | IT freelance, $718-$8000, Python/Java/Go/.NET
  "ayti_jobs",              // ✅ 9.3K obunachilar | IT jobs, Node.js/Python/Java/Blockchain
  "Exampleuz",              // ✅ 8.8K obunachilar | IT + creative, Python/React/Django
  "UstozShogirdSohalar",    // ✅ Faol | IT yo'nalishlari bo'yicha ish
  "itmarket_uz",            // ✅ Faol | IT rezyumalar va vakansiyalar, NestJS/React/Python
  "rabotak_razrabotchik",   // ✅ Faol | Node.js focused vakansiyalar
  "fintech_jobs",           // ✅ 8.9K obunachilar | IT + Freelance, Python/Go/Frontend
  "click_jobs",             // ✅ Faol | Yuqori maoshli IT, Node.js/Vue/PostgreSQL
  "frontEndJobo",           // ✅ 10.8K obunachilar | Frontend IT agregator, $300-$5000
  "frontendVacancy",        // ✅ 2.5K obunachilar | Frontend jobs, React/Vue/Angular, UZ
  "uzdev_jobs",             // ✅ 24.6K obunachilar | IT jobs, Java/Python/React/Docker/AI
  "ITjobs_Uzbekistan",      // ✅ 1.5K obunachilar | IT jobs, Flutter/Laravel/Docker/QA
  "itjobstashkent",         // ✅ 12.2K obunachilar | IT jobs Tashkent
  "uzpythonjobs",           // ✅ Faol | Python/FastAPI/Django/AI vakansiyalar
  "ITworksUz",              // ✅ 2.7K obunachilar | IT Vacancies Tashkent
  "dartuz_jobs",            // ✅ 2.2K obunachilar | Flutter/Dart jobs, $300-$8000
  "backend_jobs_uz",        // ✅ 590 obunachilar | Backend jobs, Python/Java/Node.js
  "ishmi_ish",              // ✅ 3.5K obunachilar | IT + design, Go/Swift/CI-CD
  "it_jobs_uz",             // ✅ TGStat tasdiqlangan | IT Jobs UZ

  // ════════════════════════════════════════════════════════════════
  // ✅ IT + UMUMIY ARALASH — IT vakansiyalar bor, lekin umumiy ham
  // ════════════════════════════════════════════════════════════════

  "techjobs_vakansiya",     // ✅ 5.4K obunachilar | TechJobs.uz rekruting, IT + umumiy
  "freelance_link",         // ✅ 6.8K obunachilar | IT + service vakansiyalar
  "upjobsuz",               // ✅ 4.9K obunachilar | IT + creative, DevOps/Frontend/3D
  "Jobs_uz_vacancy",        // ✅ 11.4K obunachilar | Remote jobs + rezyumalar
  "freelance_uzb",          // ✅ Faol | IT freelance + marketing, Toshkent
  "joblinkuz",              // ✅ Faol | Umumiy, lekin IT vakansiyalar bor
  "teamwork_uz",            // ✅ 9.1K obunachilar | IT freelance platforma, Figma/Android
  "kasbim_uz",              // ✅ 15.5K obunachilar | Asosan umumiy, IT bor

  // ════════════════════════════════════════════════════════════════
  // ⚠️ UMUMIY — IT vakansiyalar kam, lekin bor
  //    Parser IT bo'lmaganlarni o'zi filterlaydi
  // ════════════════════════════════════════════════════════════════

  "rizqimuz",               // ⚠️ Asosan umumiy, IT design/SMM bor
  "jobmarket_uz",           // ⚠️ 12.3K obunachilar | Asosan umumiy
  "data_ish",               // ⚠️ 12.3K obunachilar | IT, media, finance, sales aralash
  "ishtop",                 // ⚠️ Faol | Umumiy, IT vakansiyalar ham bor
  "ish_toshkent",           // ⚠️ 18.4K obunachilar | Umumiy Toshkent ish
  "ishtoparuz_kanal",       // ⚠️ 181K obunachilar | Katta kanal, umumiy, IT ham bor
  "ishgo_uz",               // ⚠️ Faol | Umumiy ish o'rinlari

  // ════════════════════════════════════════════════════════════════
  // ⚠️ MAXSUS COMMUNITY — news + jobs aralash
  // ════════════════════════════════════════════════════════════════

  "nodejsjobsfeed",         // ⚠️ Global Node.js jobs (RU/xalqaro), O'zbekiston emas
  "linkedinjobsuzbekistan", // ⚠️ LinkedIn UZ jobs — professional, aralash

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

// ─── Kuzatiladigan kanallar set (tez lookup uchun, lowercase) ─────────────────
const CHANNELS_SET = new Set(CHANNELS.map((ch) => ch.toLowerCase()));

// ─── Event handler ────────────────────────────────────────────────────────────
async function handleNewMessage(event: NewMessageEvent): Promise<void> {
  try {
    const channelName = await resolveChannelName(event.message);
    // Faqat kuzatiladigan kanallardan kelgan xabarlarni qayta ishlash
    if (!CHANNELS_SET.has(channelName.toLowerCase())) return;
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
export function startParser(): Promise<void> {
  return new Promise<void>(async (resolve, reject) => {
    const client = createClient();

    await client.start({
      phoneNumber: async () => input.text("📱 Telefon raqamingiz (+998...): "),
      password:    async () => input.text("🔒 2FA parol (bo'lmasa Enter): "),
      phoneCode:   async () => input.text("📨 SMS kod: "),
      onError:     (err) => logger.error(CTX, "Auth xato", { error: err.message }),
    });

    const savedSession = client.session.save() as unknown as string;
    if (savedSession && !config.sessionString) {
      logger.info(CTX, `SESSION_STRING ni .env ga qo'ying:\nSESSION_STRING="${savedSession}"`);
    }

    // chats filteri yo'q — username resolution flood wait ni oldini oladi
    // Kanal filtrlash handleNewMessage ichida CHANNELS_SET orqali amalga oshiriladi
    client.addEventHandler(handleNewMessage, new NewMessage({}));

    logger.info(CTX, `✅ Parser ishga tushdi — ${CHANNELS.length} kanal kuzatilmoqda`, {
      channels: CHANNELS,
    });

    // Ulanish monitoringi — 5 daqiqada bir haqiqiy API ping
    // client.connected yetarli emas — "zombie" ulanishni ushlamas
    const pingInterval = setInterval(async () => {
      try {
        await Promise.race([
          client.getMe(),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("Ping timeout 30s")), 30_000),
          ),
        ]);
        logger.debug(CTX, "Ping OK ✅");
      } catch (err: any) {
        logger.error(CTX, `Ping xato — parser qayta ishga tushadi: ${err?.message}`);
        clearInterval(pingInterval);
        client.disconnect().catch(() => {});
        reject(err); // runParserForever() ni ishga tushiradi
      }
    }, 5 * 60 * 1000);
  });
}
