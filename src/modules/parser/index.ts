import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import * as input from "input";
import * as dotenv from "dotenv";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { Api } from "telegram";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { parseVacancy } from "./vacancy.parser";
import { isSpam } from "./spam.filter";
import { matchAndNotify } from "../matcher";

dotenv.config();

const CTX = "Parser";

// ─── Kanallar ro'yxati ────────────────────────────────────────────────────────
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
  if (!apiId || !apiHash) throw new Error("API_ID va API_HASH kerak");

  const session = new StringSession(process.env.SESSION_STRING ?? "");
  return new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 10,
    retryDelay: 3000,
    autoReconnect: true,
    // Uzilganda qayta ulashga harakat qiladi
  });
}

// ─── Channel name cache ───────────────────────────────────────────────────────
const channelCache = new Map<string, string>(); // peerId → channelName

async function resolveChannelName(
  message: NewMessageEvent["message"],
): Promise<string> {
  try {
    const chat = await message.getChat();
    if (!chat) return "unknown";

    const key = chat.className + String((chat as any).id ?? "");
    if (channelCache.has(key)) return channelCache.get(key)!;

    let name = "unknown";
    if ("username" in chat && (chat as any).username) {
      name = (chat as any).username as string;
    } else if ("title" in chat && (chat as any).title) {
      name = (chat as any).title as string;
    }

    channelCache.set(key, name);
    return name;
  } catch {
    return "unknown";
  }
}

// ─── Save & notify ────────────────────────────────────────────────────────────

async function processMessage(
  message: NewMessageEvent["message"],
  channelName: string,
): Promise<void> {
  const text = message.text?.trim() ?? "";
  if (!text || text.length < 15) return;

  // Spam tekshiruvi
  if (isSpam(text)) {
    logger.debug(CTX, `Spam — ${channelName}`);
    return;
  }

  const messageId  = BigInt(message.id);
  const messageLink =
    channelName !== "unknown"
      ? `https://t.me/${channelName}/${message.id}`
      : null;

  // Duplicate
  const exists = await prisma.vacancy.findUnique({
    where:  { messageId },
    select: { id: true },
  });
  if (exists) return;

  // Parse
  const parsed = parseVacancy(text, channelName);
  if (!parsed) {
    logger.debug(CTX, `Score past — ${channelName} | ${text.slice(0, 60)}`);
    return;
  }

  logger.info(CTX, `✅ Yangi vakansiya`, {
    channel:  channelName,
    title:    parsed.title ?? "(title yo'q)",
    level:    parsed.level,
    workType: parsed.workType,
    techs:    parsed.technologies.slice(0, 5),
    link:     messageLink,
  });

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
}

// ─── Event handler ────────────────────────────────────────────────────────────

async function handleNewMessage(
  event: NewMessageEvent,
  _client: TelegramClient,
): Promise<void> {
  try {
    const message     = event.message;
    const channelName = await resolveChannelName(message);
    await processMessage(message, channelName);
  } catch (err: any) {
    // Bitta xabar xatosi butun streamni to'xtatmasin
    logger.error(CTX, "handleNewMessage xato", { error: err?.message ?? String(err) });
  }
}

// ─── Connection watchdog ──────────────────────────────────────────────────────

async function startWithReconnect(client: TelegramClient): Promise<void> {
  const chats = CHANNELS.map((ch) => `@${ch}`);

  const addHandlers = () => {
    client.addEventHandler(
      (event: NewMessageEvent) => handleNewMessage(event, client),
      new NewMessage({ chats }),
    );
    logger.info(CTX, `✅ Parser tayyor — ${CHANNELS.length} kanal kuzatilmoqda`);
  };

  // Birinchi ulanish
  addHandlers();

  // Har 5 daqiqada ulanish holatini tekshirish
  setInterval(async () => {
    try {
      if (!client.connected) {
        logger.warn(CTX, "Ulanish uzildi — qayta ulanmoqda...");
        await client.connect();
        addHandlers();
        logger.info(CTX, "✅ Qayta ulandi");
      }
    } catch (err: any) {
      logger.error(CTX, "Reconnect xato", { error: err?.message });
    }
  }, 5 * 60 * 1000);
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

  const savedSession = client.session.save() as unknown as string;
  if (savedSession && !process.env.SESSION_STRING) {
    logger.info(CTX, `SESSION_STRING="${savedSession}"`);
  }

  await startWithReconnect(client);
}
