import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { escapeHtml } from "../bot/utils";
import { bot } from "../bot";
import type { Vacancy } from "@prisma/client";
import { WORK_TYPES, LEVELS, LOCATIONS } from "../bot/filter-data";

const CTX = "Matcher";

// ─── Scoring ──────────────────────────────────────────────────────────────────
/**
 * 0   → mos kelmadi (yuborilmaydi)
 * 1+  → mos keldi  (qancha yuqori bo'lsa, shuncha mos)
 *
 * Filter.keywords MASSIVI — texnologiyalar uchun expanded lowercase keywords:
 *   ["react", "reactjs", "react.js", "typescript", "ts", "frontend"]
 *
 * Filter.location — birinchi keywords string yoki keywords join(","):
 *   "toshkent,tashkent,ташкент"  yoki  null (hammasi)
 *
 * Filter.workType — "remote" | "office" | "hybrid" | null
 */
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
    // Word-boundary-ga yaqin match
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

    // Remote filteri bo'lsa — remote vakansiyalarga ham mos
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
      // Hybrid har ikki tomonni qabul qiladi
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
    if (vacancyOrd < filterOrd) return 0; // daraja pastroq bo'lsa yo'q
    if (filterOrd === vacancyOrd) score += 7;
  }

  // ── 5. Maosh ─────────────────────────────────────────────────────────────
  if (filter.minSalary) {
    if (vacancy.salaryMin && vacancy.salaryMin < filter.minSalary) return 0;
    if (vacancy.salaryMin) score += 5;
    // Maosh ko'rsatilmagan vakansiyalar o'tadi (foydalanuvchi ko'radi)
  }

  return score;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Notification formatter ───────────────────────────────────────────────────

function formatNotification(vacancy: Vacancy): string {
  const lines: string[] = [];

  lines.push(`🔔 <b>Yangi vakansiya!</b>  ·  <i>${escapeHtml(vacancy.channel)}</i>`);
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  if (vacancy.title) {
    lines.push(`📌 <b>${escapeHtml(vacancy.title)}</b>`);
  }
  if (vacancy.company) {
    lines.push(`🏢 ${escapeHtml(vacancy.company)}`);
  }

  // Meta satri
  const meta: string[] = [];
  if (vacancy.location) {
    // Location label topamiz
    const locItem = LOCATIONS.find((l) =>
      l.keywords.some((k) => vacancy.location!.toLowerCase().includes(k)),
    );
    meta.push(locItem ? locItem.label : `📍 ${escapeHtml(vacancy.location)}`);
  }
  if (vacancy.workType) {
    const wt = { remote: "🏠 Remote", office: "🏢 Ofis", hybrid: "🔄 Hybrid" };
    meta.push(wt[vacancy.workType as keyof typeof wt] ?? vacancy.workType);
  }
  if (vacancy.level) {
    const lv: Record<string, string> = {
      intern: "🟣 Intern", junior: "🟢 Junior",
      middle: "🟡 Middle", senior: "🔴 Senior", lead: "⚫ Lead",
    };
    meta.push(lv[vacancy.level] ?? vacancy.level);
  }
  if (meta.length) lines.push(meta.join("  ·  "));

  // Stack
  if (vacancy.technologies?.length) {
    lines.push(`🛠 <code>${vacancy.technologies.join(", ")}</code>`);
  }

  // Maosh
  if (vacancy.salary) {
    lines.push(`💰 <b>${escapeHtml(vacancy.salary)}</b>`);
  }

  // Kontakt
  lines.push("");
  if (vacancy.telegramContact) {
    lines.push(`📨 ${escapeHtml(vacancy.telegramContact)}`);
  }
  if (vacancy.phone) {
    lines.push(`📞 <code>${escapeHtml(vacancy.phone)}</code>`);
  }

  lines.push("");
  lines.push("─────────────────────");

  // Preview
  const hasStructured =
    vacancy.title || vacancy.company || (vacancy.technologies?.length ?? 0) > 0;
  const maxLen = hasStructured ? 350 : 700;
  const preview =
    vacancy.text.length > maxLen
      ? vacancy.text.slice(0, maxLen) + "…"
      : vacancy.text;

  const clean = preview
    .replace(/\*\*|__/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  lines.push(`<blockquote expandable>${escapeHtml(clean)}</blockquote>`);

  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function matchAndNotify(vacancyId: number): Promise<void> {
  const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId } });
  if (!vacancy) return;

  // Rezyumelarga notification yuborilmaydi
  if ((vacancy as any).jobType === "resume") return;

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
        workType:  (f as any).workType,
        minSalary: f.minSalary,
        level:     (f as any).level,
      }),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  logger.info(CTX, `#${vacancyId} — ${matched.length}/${filters.length} mos`, {
    title: vacancy.title,
    channel: vacancy.channel,
  });

  if (!matched.length) return;

  const message = formatNotification(vacancy);

  await runWithConcurrency(matched, async ({ filter }) => {
    try {
      await bot.telegram.sendMessage(filter.userId.toString(), message, {
        parse_mode: "HTML",
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
