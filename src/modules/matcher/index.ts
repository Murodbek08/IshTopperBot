import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { escapeHtml } from "../bot/utils";
import { bot } from "../bot";
import type { Vacancy, Filter } from "@prisma/client";
import { WORK_TYPES, LEVELS, LOCATIONS } from "../bot/filter-data";
import { Markup } from "telegraf";

const CTX = "Matcher";

// ─── Scoring ──────────────────────────────────────────────────────────────────

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
  const textLower = vacancy.text.toLowerCase();
  let score = 0;

  // ── 1. Keyword matching (MANDATORY — kamida 1 ta mos kelishi kerak) ─────
  let hits = 0;
  for (const kw of filter.keywords) {
    const re = new RegExp(
      `(?<![a-z0-9])${escapeRegex(kw.toLowerCase())}(?![a-z0-9])`,
    );
    if (re.test(textLower)) hits++;
  }
  if (hits === 0) return 0;
  score += hits * 10;

  // Parsed texnologiyalar bilan ham solishtiramiz (bonus)
  const parsedTechs = (vacancy.technologies ?? []).map((t) => t.toLowerCase());
  for (const kw of filter.keywords) {
    if (parsedTechs.some((pt) => pt.includes(kw) || kw.includes(pt))) {
      score += 5;
    }
  }

  // ── 2. Joylashuv ────────────────────────────────────────────────────────
  if (filter.location) {
    const filterLocs = filter.location.split(",").map((l) => l.trim());

    const wantsRemote = filterLocs.includes("remote");
    const vacIsRemote =
      vacancy.workType === "remote" ||
      textLower.includes("remote") ||
      textLower.includes("masofaviy") ||
      textLower.includes("удалённ");

    const locMatch =
      filterLocs.some((loc) => textLower.includes(loc)) ||
      filterLocs.some((loc) =>
        (vacancy.location?.toLowerCase() ?? "").includes(loc),
      );

    if (!locMatch && !(wantsRemote && vacIsRemote)) return 0;
    score += 8;
  }

  // ── 3. Ish turi ─────────────────────────────────────────────────────────
  if (filter.workType && vacancy.workType) {
    if (filter.workType !== vacancy.workType) {
      const isHybrid =
        filter.workType === "hybrid" || vacancy.workType === "hybrid";
      if (!isHybrid) return 0;
    } else {
      score += 6;
    }
  }

  // ── 4. Daraja ────────────────────────────────────────────────────────────
  if (filter.level && vacancy.level) {
    const order: Record<string, number> = {
      intern: 0, junior: 1, middle: 2, senior: 3, lead: 4,
    };
    const filterOrd  = order[filter.level]  ?? -1;
    const vacancyOrd = order[vacancy.level] ?? -1;
    if (vacancyOrd < filterOrd) return 0;
    if (filterOrd === vacancyOrd) score += 7;
  }

  // ── 5. Maosh ─────────────────────────────────────────────────────────────
  if (filter.minSalary) {
    if (vacancy.salaryMin && vacancy.salaryMin < filter.minSalary) return 0;
    if (vacancy.salaryMin) score += 5;
  }

  return score;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Notification formatter ───────────────────────────────────────────────────

function formatSalary(v: Vacancy): string | null {
  if (!v.salary) return null;
  if (v.salaryMin && v.salaryMax) {
    const min = v.salaryMin.toLocaleString("ru");
    const max = v.salaryMax.toLocaleString("ru");
    return `${min} – ${max} so'm`;
  }
  if (v.salaryMin) {
    return `${v.salaryMin.toLocaleString("ru")} so'm+`;
  }
  return v.salary;
}

function formatNotification(vacancy: Vacancy): string {
  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────────
  const levelEmoji: Record<string, string> = {
    junior: "🟢", middle: "🟡", senior: "🔴", intern: "🟣", lead: "⚫",
  };
  const levelLabel: Record<string, string> = {
    junior: "Junior", middle: "Middle", senior: "Senior", intern: "Intern", lead: "Lead",
  };
  const workLabel: Record<string, string> = {
    remote: "🏠 Remote", office: "🏢 Ofis", hybrid: "🔄 Hybrid",
  };

  const lvl = vacancy.level ? `${levelEmoji[vacancy.level] ?? "⚪"} ${levelLabel[vacancy.level]}` : null;
  const wt  = vacancy.workType ? workLabel[vacancy.workType] ?? vacancy.workType : null;

  // Title
  if (vacancy.title) {
    lines.push(`💼 <b>${escapeHtml(vacancy.title)}</b>`);
  } else {
    lines.push(`💼 <b>Yangi vakansiya</b>`);
  }

  // Company
  if (vacancy.company) {
    lines.push(`🏢 ${escapeHtml(vacancy.company)}`);
  }

  lines.push("");

  // Meta chips: daraja · ish turi · joylashuv
  const chips: string[] = [];
  if (lvl)              chips.push(lvl);
  if (wt)               chips.push(wt);
  if (vacancy.location) {
    const locItem = LOCATIONS.find((l) =>
      l.keywords.some((k) => vacancy.location!.toLowerCase().includes(k)),
    );
    chips.push(locItem ? locItem.label : `📍 ${escapeHtml(vacancy.location)}`);
  }
  if (chips.length) lines.push(chips.join("  ·  "));

  // Stack
  if (vacancy.technologies?.length) {
    const techStr = vacancy.technologies
      .map((t) => `#${t.replace(/[.\s]/g, "_")}`)
      .join(" ");
    lines.push(`\n🛠 <code>${escapeHtml(vacancy.technologies.join(" · "))}</code>`);
  }

  // Maosh
  const salaryFormatted = formatSalary(vacancy);
  if (salaryFormatted) {
    lines.push(`💰 <b>${escapeHtml(salaryFormatted)}</b>`);
  }

  lines.push("");

  // Kontakt
  const contacts: string[] = [];
  if (vacancy.telegramContact) {
    contacts.push(`📨 ${escapeHtml(vacancy.telegramContact)}`);
  }
  if (vacancy.phone) {
    contacts.push(`📞 <code>${escapeHtml(vacancy.phone)}</code>`);
  }
  if (contacts.length) lines.push(contacts.join("  ·  "));

  // Manba
  lines.push(`\n📡 <i>${escapeHtml(vacancy.channel)}</i>`);

  // To'liq matn preview — faqat structured ma'lumot yetarli bo'lmasa
  const hasStructured =
    (vacancy.title ?? "").length > 5 ||
    (vacancy.technologies?.length ?? 0) > 0;

  if (!hasStructured) {
    lines.push("\n─────────────────────");
    const preview =
      vacancy.text.length > 600
        ? vacancy.text.slice(0, 600) + "…"
        : vacancy.text;
    const clean = preview
      .replace(/\*\*|__/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    lines.push(`<blockquote expandable>${escapeHtml(clean)}</blockquote>`);
  }

  return lines.join("\n");
}

function buildInlineKeyboard(vacancy: Vacancy) {
  const buttons: ReturnType<typeof Markup.button.url>[] = [];

  if (vacancy.messageLink) {
    buttons.push(Markup.button.url("📋 To'liq e'lonni ko'rish", vacancy.messageLink));
  }

  if (vacancy.telegramContact) {
    const username = vacancy.telegramContact.replace("@", "");
    buttons.push(Markup.button.url("📨 Murojaat qilish", `https://t.me/${username}`));
  }

  if (!buttons.length) return undefined;

  // Agar ikkita bo'lsa — ikki qator
  if (buttons.length === 2) {
    return Markup.inlineKeyboard([
      [buttons[0]],
      [buttons[1]],
    ]);
  }
  return Markup.inlineKeyboard([buttons]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function matchAndNotify(vacancyId: number): Promise<void> {
  const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId } });
  if (!vacancy) return;

  // Rezyumelarga notification yuborilmaydi
  if (vacancy.jobType === "resume") return;

  const filters = await prisma.filter.findMany({
    where: { user: { isActive: true } },
    include: { user: true },
  });
  if (!filters.length) return;

  // Duplicate tekshiruv
  const existing = await prisma.notification.findMany({
    where: { vacancyId, userId: { in: filters.map((f) => f.userId) } },
    select: { userId: true },
  });
  const alreadySent = new Set(existing.map((n) => n.userId.toString()));

  // Score hisoblash
  const matched = filters
    .filter((f) => !alreadySent.has(f.userId.toString()))
    .map((f) => ({
      filter: f,
      score: scoreMatch(vacancy, {
        keywords:  f.keywords,
        location:  f.location,
        workType:  f.workType,
        minSalary: f.minSalary,
        level:     f.level,
      }),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  logger.info(CTX, `#${vacancyId} — ${matched.length}/${filters.length} mos`, {
    title: vacancy.title,
    channel: vacancy.channel,
    link: vacancy.messageLink,
  });

  if (!matched.length) return;

  const message  = formatNotification(vacancy);
  const keyboard = buildInlineKeyboard(vacancy);

  await runWithConcurrency(matched, async ({ filter }) => {
    try {
      await bot.telegram.sendMessage(filter.userId.toString(), message, {
        parse_mode: "HTML",
        ...(keyboard ?? {}),
      });
      await prisma.notification.create({
        data: { userId: filter.userId, vacancyId: vacancy.id },
      });
      logger.info(CTX, `✅ → ${filter.userId}`);
    } catch (err: any) {
      if (err.code === 403) {
        await prisma.user.update({
          where: { telegramId: filter.userId },
          data:  { isActive: false },
        });
        logger.warn(CTX, `Bloklagan, deactivate → ${filter.userId}`);
      } else {
        logger.error(CTX, `Xato → ${filter.userId}`, { error: err.message });
      }
    }
  }, 5);
}

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  limit: number,
): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) await fn(items[i++] as T);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
