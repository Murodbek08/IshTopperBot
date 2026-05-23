import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { escapeHtml } from "../bot/utils";
import { bot } from "../bot";
import type { Vacancy } from "@prisma/client";

const CTX = "Matcher";

// ─── Matching logic ───────────────────────────────────────────────────────────

function vacancyMatchesFilter(
  vacancy: Vacancy,
  filter: {
    keywords: string[];
    location: string | null;
    minSalary: number | null;
  },
): boolean {
  const textLower = vacancy.text.toLowerCase();

  // 1. Kalit so'zlardan kamida bittasi mos kelishi shart
  const keywordMatch = filter.keywords.some((kw) =>
    textLower.includes(kw.toLowerCase()),
  );
  if (!keywordMatch) return false;

  // 2. Joylashuv filteri — parsed location YOKI raw text orqali
  if (filter.location) {
    const filterLocs = filter.location
      .split(/[,،]+/)
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);

    const locationInText = filterLocs.some((loc) => textLower.includes(loc));
    const locationInParsed = filterLocs.some(
      (loc) => vacancy.location?.toLowerCase().includes(loc) ?? false,
    );
    const isRemoteOk =
      filterLocs.includes("remote") &&
      (vacancy.workType === "remote" || textLower.includes("remote"));

    if (!locationInText && !locationInParsed && !isRemoteOk) return false;
  }

  // 3. Minimal maosh filteri — parsed salaryMin orqali tekshiriladi
  if (filter.minSalary && vacancy.salaryMin) {
    if (vacancy.salaryMin < filter.minSalary) return false;
  }

  return true;
}

// ─── Notification formatter ───────────────────────────────────────────────────

function formatNotification(vacancy: Vacancy): string {
  const lines: string[] = [];

  lines.push(`💼 <b>Yangi vakansiya — ${escapeHtml(vacancy.channel)}</b>`);
  lines.push("");

  if (vacancy.title) {
    lines.push(`📌 <b>${escapeHtml(vacancy.title)}</b>`);
  }
  if (vacancy.company) {
    lines.push(`🏢 ${escapeHtml(vacancy.company)}`);
  }
  if (vacancy.location) {
    lines.push(`📍 ${escapeHtml(vacancy.location)}`);
  }
  if (vacancy.technologies.length > 0) {
    lines.push(`🛠 ${vacancy.technologies.join(", ")}`);
  }
  if (vacancy.salary) {
    lines.push(`💰 ${escapeHtml(vacancy.salary)}`);
  }
  if (vacancy.telegramContact) {
    lines.push(`🇺🇿 Telegram: ${escapeHtml(vacancy.telegramContact)}`);
  }
  if (vacancy.phone) {
    lines.push(`📞 Aloqa: ${escapeHtml(vacancy.phone)}`);
  }
  if (vacancy.level) {
    const levelMap = { junior: "Junior", middle: "Middle", senior: "Senior" };
    lines.push(`📊 ${levelMap[vacancy.level]}`);
  }
  if (vacancy.workType) {
    const typeMap = {
      remote: "Remote 🏠",
      office: "Ofis 🏢",
      hybrid: "Hybrid 🔄",
    };
    lines.push(`⚡ ${typeMap[vacancy.workType]}`);
  }

  lines.push("");
  lines.push("─────────────────────");

  const hasStructured =
    vacancy.title || vacancy.company || vacancy.technologies.length > 0;
  const maxPreview = hasStructured ? 400 : 800;
  const preview =
    vacancy.text.length > maxPreview
      ? vacancy.text.slice(0, maxPreview) + "..."
      : vacancy.text;

  const cleanPreview = preview.replace(/\*\*|__/g, "");
  lines.push(escapeHtml(cleanPreview));

  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Yangi vacancy saqlangandan so'ng chaqiriladi.
 * Barcha active userlarning filterlarini tekshirib,
 * mos keladiganlariga bildirishnoma yuboradi.
 */
export async function matchAndNotify(vacancyId: number): Promise<void> {
  const vacancy = await prisma.vacancy.findUnique({
    where: { id: vacancyId },
  });
  if (!vacancy) return;

  // Barcha active userlarning filterlarini bitta query'da olamiz
  const filters = await prisma.filter.findMany({
    where: { user: { isActive: true } },
    include: { user: true },
  });

  if (filters.length === 0) return;

  logger.debug(
    CTX,
    `Checking vacancy #${vacancyId} against ${filters.length} filters`,
  );

  // Notification yuboring'dan oldin duplicate'larni batch'da tekshiramiz
  const existingNotifications = await prisma.notification.findMany({
    where: {
      vacancyId,
      userId: { in: filters.map((f) => f.userId) },
    },
    select: { userId: true },
  });

  const alreadySentSet = new Set(
    existingNotifications.map((n) => n.userId.toString()),
  );

  const matched = filters.filter(
    (f) =>
      !alreadySentSet.has(f.userId.toString()) &&
      vacancyMatchesFilter(vacancy, f),
  );

  logger.info(
    CTX,
    `Vacancy #${vacancyId}: ${matched.length}/${filters.length} filter mos keldi`,
  );

  const message = formatNotification(vacancy);

  // Parallel yuborish (rate limit uchun concurrency limit qo'shamiz)
  await runWithConcurrency(
    matched,
    async (filter) => {
      try {
        await bot.telegram.sendMessage(filter.userId.toString(), message, {
          parse_mode: "HTML",
        });

        await prisma.notification.create({
          data: { userId: filter.userId, vacancyId: vacancy.id },
        });

        logger.info(CTX, `Yuborildi`, {
          user: filter.userId.toString(),
          vacancy: vacancyId,
        });
      } catch (err: any) {
        if (err.code === 403) {
          // User botni bloklagan — deactivate
          logger.warn(CTX, `User botni bloklagan, deactivate`, {
            user: filter.userId.toString(),
          });
          await prisma.user.update({
            where: { telegramId: filter.userId },
            data: { isActive: false },
          });
        } else {
          logger.error(CTX, `Yuborishda xato`, {
            user: filter.userId.toString(),
            error: err.message,
          });
        }
      }
    },
    5, // bir vaqtda max 5 ta parallel
  );
}

/** Promise'larni cheklangan concurrency bilan bajaradi */
async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  limit: number,
): Promise<void> {
  let i = 0;
  async function worker(): Promise<void> {
    while (i < items.length) {
      const item = items[i++] as T;
      await fn(item);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}
