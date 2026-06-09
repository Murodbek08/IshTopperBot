import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { escapeHtml, sleep } from "../bot/utils";
import { bot } from "../bot";
import type { Vacancy } from "@prisma/client";
import { LOCATIONS } from "../bot/filter-data";
import { Markup } from "telegraf";

const CTX = "Matcher";

// ─── KEYWORD MATCHING ─────────────────────────────────────────────────────────
/**
 * Bitta keyword matnda borligini 5 usulda tekshiradi.
 * Hech qanday mos vakansiya o'tkazib yuborilmasligi uchun mo'ljallangan.
 *
 * 1. Word-boundary regex:   "react"    → "React developer"       ✓
 * 2. Normalized (flat):     "node.js"  → "nodejs"                ✓
 * 3. Dehyphenated search:   "frontend" → "front-end developer"   ✓
 * 4. Hashtag:               "react"    → "#react", "#ReactJS"    ✓
 * 5. Technologies massivi:  DB'da saqlangan texnologiyalar        ✓
 */
function keywordMatches(keyword: string, text: string, technologies: string[]): boolean {
  const kw  = keyword.toLowerCase().trim();
  const txt = text.toLowerCase();
  if (!kw || kw.length < 2) return false;

  const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // ── 1. To'g'ri word-boundary ─────────────────────────────────────────────
  if (new RegExp(`(?<![a-z0-9\\-])${escapedKw}(?![a-z0-9\\-])`, "i").test(txt)) return true;

  // ── 2. Normalized (nuqta, tire, bo'shliq olib tashlanadi) ────────────────
  const kwFlat  = kw.replace(/[.\-\s]+/g, "");
  const txtFlat = txt.replace(/[.\-\s]+/g, "");
  if (kwFlat.length >= 3 && kwFlat !== kw) {
    const esc = kwFlat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, "i").test(txt)) return true;
  }

  // ── 3. Tire/bo'shliq olib tashlanib matn ham tekshiriladi ────────────────
  // "frontend" → "front-end developer" (txtFlat = "frontenddev...")
  if (kwFlat.length >= 4) {
    if (new RegExp(`(?<![a-z0-9])${kwFlat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i").test(txtFlat)) return true;
  }

  // ── 4. Hashtag (#react, #reactjs, #nodejs) ───────────────────────────────
  if (txt.includes(`#${kwFlat}`) || txt.includes(`#${kw.replace(/[\s]/g, "")}`)) return true;

  // ── 5. Parsed technologies massivi ───────────────────────────────────────
  for (const tech of technologies) {
    const tFlat = tech.toLowerCase().replace(/[.\-\s]+/g, "");
    if (tFlat === kwFlat || tech.toLowerCase() === kw ||
        tFlat.includes(kwFlat) || kwFlat.includes(tFlat)) {
      if (kwFlat.length >= 2 && tFlat.length >= 2) return true;
    }
  }

  return false;
}

// ─── LOCATION MATCHING ────────────────────────────────────────────────────────
const REMOTE_KEYWORDS = [
  "remote", "masofaviy", "uzoqdan", "удалённ", "онлайн", "online", "distantsion",
];

function locationMatches(filterLocation: string, vacancy: Vacancy, textLower: string): boolean {
  const filterLocs  = filterLocation.split(",").map((l) => l.trim().toLowerCase());
  const wantsRemote = filterLocs.some((l) => REMOTE_KEYWORDS.includes(l));
  const vacIsRemote = vacancy.workType === "remote" ||
                      REMOTE_KEYWORDS.some((rk) => textLower.includes(rk));

  // Remote filter + remote vacancy
  if (wantsRemote && vacIsRemote) return true;

  // Vacancy location aniqlanmagan → benefit of doubt (o'tkazamiz)
  if (!vacancy.location) return true;

  // Parsed location bilan aniq mos
  const vacLoc = vacancy.location.toLowerCase();
  if (filterLocs.some((loc) => vacLoc.includes(loc) || loc.includes(vacLoc))) return true;

  // Matn ichida location keyword bor
  if (filterLocs.some((loc) => loc.length >= 4 && textLower.includes(loc))) return true;

  return false;
}

// ─── WORKTYPE MATCHING ────────────────────────────────────────────────────────
function workTypeMatches(filterWt: string, vacancy: Vacancy): boolean {
  // Hybrid har ikki tomonga mos
  if (filterWt === "hybrid" || vacancy.workType === "hybrid") return true;
  // Vacancy workType aniqlanmagan → matndan tekshiramiz
  if (!vacancy.workType) {
    const txt = vacancy.text.toLowerCase();
    const isOffice = /\bofis\b|офисе|на\s*месте|\boffice\b/i.test(txt);
    const isRemote = /\bremote\b|masofaviy|удалённ/i.test(txt);
    if (filterWt === "remote" && isOffice && !isRemote) return false;
    if (filterWt === "office" && isRemote) return false;
    return true; // aniqlanmagan — o'tkazamiz
  }
  return filterWt === vacancy.workType;
}

// ─── LEVEL MATCHING ───────────────────────────────────────────────────────────
const LEVEL_ORDER: Record<string, number> = { junior: 1, middle: 2, senior: 3 };

function levelMatches(filterLevel: string, vacancy: Vacancy): boolean {
  if (!vacancy.level) return true; // aniqlanmagan → o'tkazamiz
  const fOrd = LEVEL_ORDER[filterLevel]    ?? 0;
  const vOrd = LEVEL_ORDER[vacancy.level]  ?? 0;
  return vOrd >= fOrd;
}

// ─── SCORE ────────────────────────────────────────────────────────────────────
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
  const searchText = [
    vacancy.text,
    vacancy.title   ?? "",
    vacancy.company ?? "",
    ...(vacancy.technologies ?? []),
  ].join(" ").toLowerCase();

  const techs = vacancy.technologies ?? [];
  let score = 0;

  // ── 1. Keywords (MAJBURIY) ────────────────────────────────────────────────
  let hits = 0;
  for (const kw of filter.keywords) {
    if (keywordMatches(kw, searchText, techs)) hits++;
  }
  if (hits === 0) return 0;
  score += Math.min(hits, 6) * 10;

  // Parsed technologies bonus
  for (const kw of filter.keywords) {
    const kwFlat = kw.replace(/[.\-\s]+/g, "");
    if (techs.some((t) => t.toLowerCase().replace(/[.\-\s]+/g, "").includes(kwFlat))) {
      score += 3;
    }
  }

  // ── 2. Joylashuv ─────────────────────────────────────────────────────────
  if (filter.location) {
    if (!locationMatches(filter.location, vacancy, searchText)) return 0;
    const filterLocs = filter.location.split(",").map((l) => l.trim().toLowerCase());
    if (vacancy.location && filterLocs.some((l) => vacancy.location!.toLowerCase().includes(l))) {
      score += 8;
    }
  }

  // ── 3. Ish turi ──────────────────────────────────────────────────────────
  if (filter.workType && filter.workType !== "any") {
    if (!workTypeMatches(filter.workType, vacancy)) return 0;
    if (vacancy.workType && filter.workType === vacancy.workType) score += 6;
  }

  // ── 4. Daraja ────────────────────────────────────────────────────────────
  if (filter.level && filter.level !== "any") {
    if (!levelMatches(filter.level, vacancy)) return 0;
    if (vacancy.level && LEVEL_ORDER[filter.level] === LEVEL_ORDER[vacancy.level]) score += 7;
  }

  // ── 5. Maosh ─────────────────────────────────────────────────────────────
  if (filter.minSalary && filter.minSalary > 0) {
    if (vacancy.salaryMin && vacancy.salaryMin < filter.minSalary) return 0;
    if (vacancy.salaryMin) score += 5;
  }

  return score;
}

// ─── FORMATTER ────────────────────────────────────────────────────────────────
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

  // Meta
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

  // Raw preview (agar strukturali ma'lumot yetarli bo'lmasa)
  const hasStructured = (vacancy.title?.length ?? 0) > 5 || (vacancy.technologies?.length ?? 0) > 0;
  if (!hasStructured) {
    const raw   = vacancy.text.length > 800 ? vacancy.text.slice(0, 800) + "…" : vacancy.text;
    const clean = raw.replace(/\*\*|__/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    parts.push(`\n<blockquote expandable>${escapeHtml(clean)}</blockquote>`);
  }

  return parts.join("\n");
}

function buildKeyboard(vacancy: Vacancy) {
  const rows: ReturnType<typeof Markup.button.url>[][] = [];

  if (vacancy.messageLink) {
    rows.push([Markup.button.url("📋 To'liq e'lonni ko'rish", vacancy.messageLink)]);
  }

  // Faqat personal kontakt uchun (kanal emas)
  if (vacancy.telegramContact) {
    const handle = vacancy.telegramContact.replace("@", "");
    const isLikelyChannel = /news|channel|kanal|official|jobs|vacancy|vakans/i.test(handle);
    if (!isLikelyChannel) {
      rows.push([Markup.button.url("📨 Murojaat qilish", `https://t.me/${handle}`)]);
    }
  }

  return rows.length ? Markup.inlineKeyboard(rows) : undefined;
}

// ─── RATE LIMITER ─────────────────────────────────────────────────────────────
let sendQueue = Promise.resolve();
const SEND_DELAY_MS = 100; // ~10 msg/sec

function enqueueSend(fn: () => Promise<void>): void {
  sendQueue = sendQueue.then(() =>
    fn().then(
      () => sleep(SEND_DELAY_MS),
      () => sleep(SEND_DELAY_MS),
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

  // Toshkent vaqti (UTC+5)
  const tashkentHour = (new Date().getUTCHours() + 5) % 24;

  const matched = filters
    .filter((f) => !sentSet.has(f.userId.toString()))
    .filter((f) => {
      const u = f.user as any;
      if (u?.silentFrom == null || u?.silentTo == null) return true;
      const from = u.silentFrom as number;
      const to   = u.silentTo   as number;
      // Tungi diapazon (23:00–07:00): from > to
      const isSilent = from > to
        ? (tashkentHour >= from || tashkentHour < to)
        : (tashkentHour >= from && tashkentHour < to);
      return !isSilent;
    })
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
    title:    vacancy.title ?? "(yo'q)",
    channel:  vacancy.channel,
    level:    vacancy.level,
    workType: vacancy.workType,
    location: vacancy.location,
    techs:    (vacancy.technologies ?? []).slice(0, 5),
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

        // DB write failure vacancy re-send qilishini oldini olish uchun
        await prisma.notification.upsert({
          where:  { userId_vacancyId: { userId: filter.userId, vacancyId: vacancy.id } },
          create: { userId: filter.userId, vacancyId: vacancy.id },
          update: {},
        });

        logger.info(CTX, `✅ → userId:${filter.userId}  score:${
          matched.find((m) => m.filter.userId === filter.userId)?.score
        }`);
      } catch (err: any) {
        if (err?.code === 403 || err?.description?.includes("blocked")) {
          await prisma.user.update({
            where: { telegramId: filter.userId },
            data:  { isActive: false },
          }).catch(() => {});
          logger.warn(CTX, `Blok → deactivate userId:${filter.userId}`);
        } else if (err?.code === 429) {
          const after = (err?.parameters?.retry_after ?? 15) * 1000;
          logger.warn(CTX, `Rate limit — ${after}ms kutilmoqda`);
          await sleep(after);
        } else {
          logger.error(CTX, `Xato → userId:${filter.userId}`, { error: err?.message });
        }
      }
    });
  }
}
