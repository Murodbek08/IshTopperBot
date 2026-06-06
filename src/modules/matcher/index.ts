import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { escapeHtml } from "../bot/utils";
import { bot } from "../bot";
import type { Vacancy } from "@prisma/client";
import { WORK_TYPES, LEVELS, LOCATIONS } from "../bot/filter-data";
import { Markup } from "telegraf";

const CTX = "Matcher";

// ─── Scoring ──────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreMatch(
  vacancy: Vacancy,
  filter: {
    keywords:  string[];
    location:  string | null;
    workType?: string | null;
    minSalary: number | null;
    level?:    string | null;
  },
): number {
  const textLower = (vacancy.text + " " + (vacancy.title ?? "") + " " + (vacancy.technologies ?? []).join(" ")).toLowerCase();
  let score = 0;

  // ── 1. Keyword (MAJBURIY — kamida 1 ta mos) ──────────────────────────────
  let hits = 0;
  for (const kw of filter.keywords) {
    const re = new RegExp(`(?<![a-z0-9])${escapeRegex(kw)}(?![a-z0-9])`, "i");
    if (re.test(textLower)) hits++;
  }
  if (hits === 0) return 0;
  score += Math.min(hits, 5) * 10; // max 50 ball keyword'dan

  // Parsed texnologiyalar bonus
  const parsedTechs = (vacancy.technologies ?? []).map((t) => t.toLowerCase());
  for (const kw of filter.keywords) {
    if (parsedTechs.some((pt) => pt.includes(kw) || kw.includes(pt))) {
      score += 5;
    }
  }

  // ── 2. Joylashuv ─────────────────────────────────────────────────────────
  if (filter.location) {
    const filterLocs = filter.location.split(",").map((l) => l.trim().toLowerCase());
    const wantsRemote = filterLocs.includes("remote");

    const vacIsRemote =
      vacancy.workType === "remote" ||
      /remote|masofaviy|удалённ|онлайн/i.test(vacancy.text);

    const locMatch =
      filterLocs.some((loc) => textLower.includes(loc)) ||
      filterLocs.some((loc) => (vacancy.location?.toLowerCase() ?? "").includes(loc));

    if (!locMatch && !(wantsRemote && vacIsRemote)) return 0;
    score += 8;
  }

  // ── 3. Ish turi ──────────────────────────────────────────────────────────
  if (filter.workType && vacancy.workType) {
    if (filter.workType === vacancy.workType) {
      score += 6;
    } else {
      const hybrid = filter.workType === "hybrid" || vacancy.workType === "hybrid";
      if (!hybrid) return 0;
    }
  }

  // ── 4. Daraja ────────────────────────────────────────────────────────────
  if (filter.level && vacancy.level) {
    const ord: Record<string, number> = { junior: 1, middle: 2, senior: 3 };
    const fOrd = ord[filter.level]  ?? 0;
    const vOrd = ord[vacancy.level] ?? 0;
    if (vOrd < fOrd) return 0;        // vacancy darajasi pastroq — skip
    if (fOrd === vOrd) score += 7;
  }

  // ── 5. Maosh ─────────────────────────────────────────────────────────────
  if (filter.minSalary) {
    if (vacancy.salaryMin && vacancy.salaryMin < filter.minSalary) return 0;
    if (vacancy.salaryMin) score += 5;
    // Maosh ko'rsatilmagan — o'tkazamiz (foydalanuvchi o'zi ko'radi)
  }

  return score;
}

// ─── Formatter ────────────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<string, string> = {
  junior: "🟢 Junior", middle: "🟡 Middle", senior: "🔴 Senior", intern: "🟣 Intern",
};
const WORK_BADGE: Record<string, string> = {
  remote: "🏠 Remote", office: "🏢 Ofis", hybrid: "🔄 Hybrid",
};

function formatSalary(v: Vacancy): string | null {
  if (!v.salary) return null;
  if (v.salaryMin && v.salaryMax) {
    return `${v.salaryMin.toLocaleString("ru")} – ${v.salaryMax.toLocaleString("ru")} so'm`;
  }
  if (v.salaryMin) return `${v.salaryMin.toLocaleString("ru")} so'm+`;
  return v.salary;
}

function formatNotification(vacancy: Vacancy): string {
  const parts: string[] = [];

  // ── Sarlavha ─────────────────────────────────────────────────────────────
  const titleText = vacancy.title
    ? `💼 <b>${escapeHtml(vacancy.title)}</b>`
    : `💼 <b>Yangi vakansiya</b>`;
  parts.push(titleText);

  if (vacancy.company) {
    parts.push(`🏢 ${escapeHtml(vacancy.company)}`);
  }

  // ── Meta qator ───────────────────────────────────────────────────────────
  const meta: string[] = [];
  if (vacancy.level)    meta.push(LEVEL_BADGE[vacancy.level] ?? vacancy.level);
  if (vacancy.workType) meta.push(WORK_BADGE[vacancy.workType] ?? vacancy.workType);
  if (vacancy.location) {
    const loc = LOCATIONS.find((l) =>
      l.keywords.some((k) => vacancy.location!.toLowerCase().includes(k)),
    );
    meta.push(loc ? loc.label : `📍 ${escapeHtml(vacancy.location)}`);
  }
  if (meta.length) parts.push("\n" + meta.join("  ·  "));

  // ── Texnologiyalar ───────────────────────────────────────────────────────
  if (vacancy.technologies?.length) {
    parts.push(`🛠 <code>${escapeHtml(vacancy.technologies.join(" · "))}</code>`);
  }

  // ── Maosh ────────────────────────────────────────────────────────────────
  const sal = formatSalary(vacancy);
  if (sal) parts.push(`💰 <b>${escapeHtml(sal)}</b>`);

  // ── Kontakt ──────────────────────────────────────────────────────────────
  const contacts: string[] = [];
  if (vacancy.telegramContact) contacts.push(`📨 ${escapeHtml(vacancy.telegramContact)}`);
  if (vacancy.phone)           contacts.push(`📞 <code>${escapeHtml(vacancy.phone)}</code>`);
  if (contacts.length) parts.push("\n" + contacts.join("  "));

  // ── Manba ────────────────────────────────────────────────────────────────
  parts.push(`\n📡 <i>${escapeHtml(vacancy.channel)}</i>`);

  // ── Matn preview — agar strukturali ma'lumot yetarli bo'lmasa ────────────
  const hasEnoughInfo =
    (vacancy.title?.length ?? 0) > 5 || (vacancy.technologies?.length ?? 0) > 0;

  if (!hasEnoughInfo) {
    const maxLen = 800;
    const raw = vacancy.text.length > maxLen
      ? vacancy.text.slice(0, maxLen) + "…"
      : vacancy.text;
    const clean = raw
      .replace(/\*\*|__/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
    parts.push(`\n<blockquote expandable>${escapeHtml(clean)}</blockquote>`);
  }

  return parts.join("\n");
}

function buildKeyboard(vacancy: Vacancy) {
  const rows: ReturnType<typeof Markup.button.url>[][] = [];

  if (vacancy.messageLink) {
    rows.push([Markup.button.url("📋 To'liq e'lonni ko'rish", vacancy.messageLink)]);
  }
  if (vacancy.telegramContact) {
    const u = vacancy.telegramContact.replace("@", "");
    rows.push([Markup.button.url("📨 Murojaat qilish", `https://t.me/${u}`)]);
  }

  return rows.length ? Markup.inlineKeyboard(rows) : undefined;
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Telegram: max ~30 msg/sec global, lekin xavfsizlik uchun ~10/sec
let sendQueue = Promise.resolve();
const SEND_DELAY_MS = 120; // ~8 msg/sec

function enqueueSend(fn: () => Promise<void>): Promise<void> {
  sendQueue = sendQueue.then(() =>
    fn().then(
      () => new Promise<void>((res) => setTimeout(res, SEND_DELAY_MS)),
      ()  => new Promise<void>((res) => setTimeout(res, SEND_DELAY_MS)),
    )
  );
  return sendQueue;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function matchAndNotify(vacancyId: number): Promise<void> {
  const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId } });
  if (!vacancy || vacancy.jobType === "resume") return;

  const filters = await prisma.filter.findMany({
    where:   { user: { isActive: true } },
    include: { user: true },
  });
  if (!filters.length) return;

  // Allaqachon yuborilgan foydalanuvchilar
  const sent = await prisma.notification.findMany({
    where:  { vacancyId, userId: { in: filters.map((f) => f.userId) } },
    select: { userId: true },
  });
  const sentSet = new Set(sent.map((n) => n.userId.toString()));

  // Score hisoblash
  const matched = filters
    .filter((f) => !sentSet.has(f.userId.toString()))
    .map((f) => ({
      filter: f,
      score:  scoreMatch(vacancy, {
        keywords:  f.keywords,
        location:  f.location,
        workType:  f.workType,
        minSalary: f.minSalary,
        level:     f.level,
      }),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  logger.info(CTX, `#${vacancyId} → ${matched.length}/${filters.length} mos`, {
    title:   vacancy.title,
    channel: vacancy.channel,
  });

  if (!matched.length) return;

  const text     = formatNotification(vacancy);
  const keyboard = buildKeyboard(vacancy);

  for (const { filter } of matched) {
    enqueueSend(async () => {
      try {
        await bot.telegram.sendMessage(
          filter.userId.toString(),
          text,
          { parse_mode: "HTML", ...(keyboard ?? {}) },
        );
        await prisma.notification.create({
          data: { userId: filter.userId, vacancyId: vacancy.id },
        });
        logger.info(CTX, `✅ → userId:${filter.userId}`);
      } catch (err: any) {
        if (err?.code === 403 || err?.description?.includes("blocked")) {
          await prisma.user.update({
            where: { telegramId: filter.userId },
            data:  { isActive: false },
          });
          logger.warn(CTX, `Bot bloki → deactivate userId:${filter.userId}`);
        } else if (err?.code === 429) {
          // Rate limit — keyingi urinish uchun kutamiz
          const retry = (err?.parameters?.retry_after ?? 10) * 1000;
          logger.warn(CTX, `Rate limit — ${retry}ms kutilmoqda`);
          await new Promise((res) => setTimeout(res, retry));
        } else {
          logger.error(CTX, `Xato → userId:${filter.userId}`, { error: err?.message });
        }
      }
    });
  }
}
