import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { escapeHtml } from "../bot/utils";
import { bot } from "../bot";
import type { Vacancy } from "@prisma/client";
import { LOCATIONS } from "../bot/filter-data";
import { Markup } from "telegraf";

const CTX = "Matcher";

// ─── KEYWORD MATCHING ─────────────────────────────────────────────────────────
/**
 * Bitta keyword matnda borligini 4 usulda tekshiradi:
 * 1. To'g'ridan so'z chegarasi bilan: "react" → "React developer"
 * 2. Normallashtirilgan: "node.js" → "nodejs", "front-end" → "frontend"
 * 3. Hashtag: "react" → "#react", "#ReactJS"
 * 4. Texnologiyalar massivi: to'g'ri mos
 */
function keywordMatches(keyword: string, text: string, technologies: string[]): boolean {
  const kw   = keyword.toLowerCase().trim();
  const txt  = text.toLowerCase();

  if (!kw || kw.length < 2) return false;

  // ── 1. To'g'ri word-boundary regex ─────────────────────────────────────────
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(?<![a-z0-9\\-])${escaped}(?![a-z0-9\\-])`, "i").test(txt)) return true;

  // ── 2. Normallashtirilgan forma (nuqta, tire, bo'shliq olib tashlanadi) ─────
  const norm = kw.replace(/[.\-\s]+/g, "");
  if (norm.length >= 2 && norm !== kw) {
    const escapedNorm = norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?<![a-z0-9])${escapedNorm}(?![a-z0-9])`, "i").test(txt)) return true;
  }

  // ── 3. Hashtag forma (#react, #reactjs, #nodejs) ────────────────────────────
  const hashForm = kw.replace(/[\.\s\-]/g, "");
  if (txt.includes(`#${hashForm}`)) return true;
  if (txt.includes(`#${norm}`))     return true;

  // ── 4. Parsed texnologiyalar massivi ────────────────────────────────────────
  const techLower = technologies.map((t) => t.toLowerCase());
  if (techLower.some((t) => {
    const tNorm = t.replace(/[.\-\s]+/g, "");
    return t === kw || tNorm === norm || t.includes(kw) || kw.includes(t);
  })) return true;

  return false;
}

// ─── LOCATION MATCHING ────────────────────────────────────────────────────────
/**
 * Tamoyil:
 * - Vacancy'da aniq joylashuv ko'rsatilgan va filter bilan mos kelmasa → bloklash
 * - Vacancy'da joylashuv yo'q (null) → o'tkazish (benefit of doubt)
 * - Remote vakansiya + remote filter → o'tkazish
 */
function locationMatches(
  filterLocation: string,
  vacancy: Vacancy,
  textLower: string,
): boolean {
  const filterLocs = filterLocation.split(",").map((l) => l.trim().toLowerCase());

  const remoteKeywords = ["remote", "masofaviy", "uzoqdan", "онлайн", "удалённ", "online", "distantsion"];
  const wantsRemote = filterLocs.some((l) => remoteKeywords.includes(l));

  const vacIsRemote =
    vacancy.workType === "remote" ||
    remoteKeywords.some((rk) => textLower.includes(rk));

  // Remote filter + remote vacancy → mos
  if (wantsRemote && vacIsRemote) return true;

  // Vacancy'da joylashuv ko'rsatilmagan → benefit of doubt (o'tkazamiz)
  if (!vacancy.location && !vacIsRemote) return true;

  // Parsed location bilan solishtiramiz
  const vacLoc = (vacancy.location ?? "").toLowerCase();
  if (filterLocs.some((loc) => vacLoc.includes(loc))) return true;

  // Matn ichida joylashuv so'zi borligini tekshiramiz
  if (filterLocs.some((loc) => textLower.includes(loc))) return true;

  return false;
}

// ─── WORKTYPE MATCHING ────────────────────────────────────────────────────────
/**
 * Tamoyil:
 * - Vacancy workType aniqlanmagan (null) → o'tkazamiz
 * - Hybrid har qanday tomondan mos keladi
 * - Aniq mos kelmasa → bloklash
 */
function workTypeMatches(filterWorkType: string, vacancy: Vacancy): boolean {
  // Vacancy workType aniqlanmagan — texst orqali qayta tekshiramiz
  if (!vacancy.workType) {
    const txt = vacancy.text.toLowerCase();
    if (filterWorkType === "remote") {
      // Aniq "ofis" desa va remote demasa → bloklash
      const isOffice  = /\bofis\b|офисе|на\s*месте|\boffice\b/i.test(txt);
      const isRemote  = /remote|masofaviy|удалённ|онлайн/i.test(txt);
      if (isOffice && !isRemote) return false;
      return true; // aniqlanmagan → o'tkazamiz
    }
    if (filterWorkType === "office") {
      const isRemote = /\bremote\b|masofaviy|удалённ/i.test(txt);
      if (isRemote) return false;
      return true;
    }
    return true; // hybrid yoki aniqlanmagan
  }

  if (filterWorkType === vacancy.workType) return true;

  // Hybrid har ikki tomondan mos
  if (filterWorkType === "hybrid" || vacancy.workType === "hybrid") return true;

  return false;
}

// ─── LEVEL MATCHING ───────────────────────────────────────────────────────────
/**
 * Tamoyil:
 * - Vacancy level aniqlanmagan → o'tkazamiz (parser topimagan)
 * - Vacancy level filter level dan pastroq → bloklash
 * - Teng yoki yuqori → o'tkazamiz
 */
function levelMatches(filterLevel: string, vacancy: Vacancy): boolean {
  if (!vacancy.level) return true; // aniqlanmagan → o'tkazamiz

  const ord: Record<string, number> = { junior: 1, middle: 2, senior: 3 };
  const fOrd = ord[filterLevel]      ?? 0;
  const vOrd = ord[vacancy.level]    ?? 0;

  return vOrd >= fOrd;
}

// ─── SALARY MATCHING ──────────────────────────────────────────────────────────
/**
 * Tamoyil:
 * - Vacancy salary aniqlanmagan → o'tkazamiz
 * - Vacancy salary filter min'dan kam → bloklash
 */
function salaryMatches(minSalary: number, vacancy: Vacancy): boolean {
  if (!vacancy.salaryMin) return true; // aniqlanmagan → o'tkazamiz
  return vacancy.salaryMin >= minSalary;
}

// ─── MAIN SCORE FUNCTION ──────────────────────────────────────────────────────
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
  const textLower = (
    vacancy.text + " " +
    (vacancy.title   ?? "") + " " +
    (vacancy.company ?? "") + " " +
    (vacancy.technologies ?? []).join(" ")
  ).toLowerCase();

  const technologies = vacancy.technologies ?? [];
  let score = 0;

  // ── 1. Keywords (MAJBURIY — kamida 1 ta mos kelishi kerak) ──────────────────
  let hits = 0;
  for (const kw of filter.keywords) {
    if (keywordMatches(kw, textLower, technologies)) hits++;
  }
  if (hits === 0) return 0;
  score += Math.min(hits, 6) * 10; // max 60 ball

  // Parsed texnologiyalar bonus
  for (const kw of filter.keywords) {
    if (technologies.some((t) => t.toLowerCase().includes(kw.replace(/[.\-\s]+/g, "")))) {
      score += 5;
    }
  }

  // ── 2. Joylashuv ─────────────────────────────────────────────────────────────
  if (filter.location) {
    if (!locationMatches(filter.location, vacancy, textLower)) return 0;
    // Aniq mos kelsa bonus
    const filterLocs = filter.location.split(",").map((l) => l.trim().toLowerCase());
    if (vacancy.location && filterLocs.some((l) => (vacancy.location!).toLowerCase().includes(l))) {
      score += 8;
    }
  }

  // ── 3. Ish turi ───────────────────────────────────────────────────────────────
  if (filter.workType && filter.workType !== "any") {
    if (!workTypeMatches(filter.workType, vacancy)) return 0;
    if (vacancy.workType && filter.workType === vacancy.workType) score += 6;
  }

  // ── 4. Daraja ─────────────────────────────────────────────────────────────────
  if (filter.level && filter.level !== "any") {
    if (!levelMatches(filter.level, vacancy)) return 0;
    const ord: Record<string, number> = { junior: 1, middle: 2, senior: 3 };
    if (vacancy.level && ord[filter.level] === ord[vacancy.level]) score += 7;
  }

  // ── 5. Maosh ──────────────────────────────────────────────────────────────────
  if (filter.minSalary && filter.minSalary > 0) {
    if (!salaryMatches(filter.minSalary, vacancy)) return 0;
    if (vacancy.salaryMin) score += 5;
  }

  return score;
}

// ─── NOTIFICATION FORMATTER ───────────────────────────────────────────────────

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

  // Sarlavha
  parts.push(vacancy.title
    ? `💼 <b>${escapeHtml(vacancy.title)}</b>`
    : `💼 <b>Yangi vakansiya</b>`);

  if (vacancy.company) parts.push(`🏢 ${escapeHtml(vacancy.company)}`);

  // Meta (daraja · ish turi · hudud)
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

  // Texnologiyalar
  if (vacancy.technologies?.length) {
    parts.push(`🛠 <code>${escapeHtml(vacancy.technologies.join(" · "))}</code>`);
  }

  // Maosh
  const sal = formatSalary(vacancy);
  if (sal) parts.push(`💰 <b>${escapeHtml(sal)}</b>`);

  // Kontakt
  const contacts: string[] = [];
  if (vacancy.telegramContact) contacts.push(`📨 ${escapeHtml(vacancy.telegramContact)}`);
  if (vacancy.phone)           contacts.push(`📞 <code>${escapeHtml(vacancy.phone)}</code>`);
  if (contacts.length) parts.push("\n" + contacts.join("  "));

  // Manba
  parts.push(`\n📡 <i>${escapeHtml(vacancy.channel)}</i>`);

  // Raw preview — strukturali ma'lumot yetarli bo'lmasa
  const hasEnoughInfo = (vacancy.title?.length ?? 0) > 5 || (vacancy.technologies?.length ?? 0) > 0;
  if (!hasEnoughInfo) {
    const preview = vacancy.text.length > 800 ? vacancy.text.slice(0, 800) + "…" : vacancy.text;
    const clean   = preview.replace(/\*\*|__/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
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

// ─── RATE LIMITER ─────────────────────────────────────────────────────────────
let sendQueue = Promise.resolve();
const SEND_DELAY_MS = 100; // ~10 msg/sec

function enqueueSend(fn: () => Promise<void>): void {
  sendQueue = sendQueue.then(() =>
    fn().then(
      () => new Promise<void>((res) => setTimeout(res, SEND_DELAY_MS)),
      ()  => new Promise<void>((res) => setTimeout(res, SEND_DELAY_MS)),
    ),
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

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

  // Toshkent soati (UTC+5)
  const tashkentHour = (new Date().getUTCHours() + 5) % 24;

  const matched = filters
    .filter((f) => !sentSet.has(f.userId.toString()))
    .filter((f) => {
      // Sokin soatlar tekshiruvi
      const u = f.user as any;
      if (u?.silentFrom == null || u?.silentTo == null) return true;
      const from = u.silentFrom as number;
      const to   = u.silentTo   as number;
      const isSilent = from > to
        ? (tashkentHour >= from || tashkentHour < to)
        : (tashkentHour >= from && tashkentHour < to);
      return !isSilent;
    })
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

  logger.info(CTX, `#${vacancyId} → ${matched.length}/${filters.length} mos`, {
    title:    vacancy.title ?? "(title yo'q)",
    channel:  vacancy.channel,
    techs:    (vacancy.technologies ?? []).slice(0, 4),
    level:    vacancy.level,
    workType: vacancy.workType,
    location: vacancy.location,
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
          logger.warn(CTX, `Blok → deactivate userId:${filter.userId}`);
        } else if (err?.code === 429) {
          const retryAfter = (err?.parameters?.retry_after ?? 15) * 1000;
          logger.warn(CTX, `Rate limit — ${retryAfter}ms kutilmoqda`);
          await new Promise((res) => setTimeout(res, retryAfter));
        } else {
          logger.error(CTX, `Xato → userId:${filter.userId}`, { error: err?.message });
        }
      }
    });
  }
}
