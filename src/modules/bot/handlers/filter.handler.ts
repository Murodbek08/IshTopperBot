import { Telegraf, Markup } from "telegraf";
import { prisma } from "../../../lib/prisma";
import { escapeHtml } from "../utils";
import { mainKeyboard } from "./start.handler";
import type { SessionStore } from "../session";
import {
  FIELDS,
  WORK_TYPES,
  LEVELS,
  LOCATIONS,
  SALARY_RANGES,
  type TechItem,
  type LocationItem,
} from "../filter-data";

// ─── Type alias ───────────────────────────────────────────────────────────────
type CB = ReturnType<typeof Markup.button.callback>;

// ─── Progress bar ─────────────────────────────────────────────────────────────

function progressBar(current: number, total: number): string {
  const filled = "▓".repeat(current);
  const empty  = "░".repeat(total - current);
  return `${filled}${empty}  ${current}/${total}`;
}

// ─── Keyboard builders ────────────────────────────────────────────────────────

/** 1/6 — Soha keyboard (2 ustunli grid) */
function fieldsKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  const btns: CB[] = Object.entries(FIELDS).map(([key, d]) =>
    Markup.button.callback(`${d.emoji} ${d.label}`, `field:${key}`)
  );
  return grid(btns, 2);
}

/** 2/6 — Texnologiyalar keyboard (2 ustunli, toggle ✅) */
function techKeyboard(
  fieldKey: string,
  selected: string[],
): ReturnType<typeof Markup.inlineKeyboard> {
  const field = FIELDS[fieldKey];
  if (!field) return Markup.inlineKeyboard([]);

  const btns: CB[] = field.technologies.map((t) => {
    const isOn = selected.includes(t.label);
    return Markup.button.callback(
      isOn ? `✅ ${t.label}` : t.label,
      `tech:${t.label}`,
    );
  });

  const rows = gridRows(btns, 2);

  // Bottom row: custom + done
  const bottomRow: CB[] = [
    Markup.button.callback("✏️ O'zim yozaman", "tech:__custom__"),
  ];
  if (selected.length > 0) {
    bottomRow.push(
      Markup.button.callback(`✅ Davom etish (${selected.length})`, "tech:__done__"),
    );
  }
  rows.push(bottomRow);

  return Markup.inlineKeyboard(rows);
}

/** 3/6 — Daraja keyboard */
function levelKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  const btns: CB[] = Object.entries(LEVELS).map(([key, label]) =>
    Markup.button.callback(label, `level:${key}`)
  );
  return grid(btns, 2);
}

/** 4/6 — Ish turi keyboard */
function workTypeKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  const btns: CB[] = Object.entries(WORK_TYPES).map(([key, label]) =>
    Markup.button.callback(label, `worktype:${key}`)
  );
  return grid(btns, 2);
}

/** 5/6 — Viloyat keyboard (3 ustunli) */
function locationKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  // Remote va Xorij alohida, qolganlar 3 ustunli
  const main = LOCATIONS.filter(
    (l) => !l.keywords.includes("remote") && !l.keywords.includes("xorij"),
  );
  const special = LOCATIONS.filter(
    (l) => l.keywords.includes("remote") || l.keywords.includes("xorij"),
  );

  const mainBtns: CB[] = main.map((l) =>
    Markup.button.callback(l.label, `loc:${l.keywords[0]}`)
  );
  const rows = gridRows(mainBtns, 3);

  // Special (Remote, Xorijda) + "Hammasi"
  const specialRow: CB[] = [
    ...special.map((l) =>
      Markup.button.callback(l.label, `loc:${l.keywords[0]}`)
    ),
    Markup.button.callback("🌐 Hammasi", "loc:__all__"),
  ];
  rows.push(specialRow);

  return Markup.inlineKeyboard(rows);
}

/** 6/6 — Maosh keyboard */
function salaryKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  const btns: CB[] = Object.entries(SALARY_RANGES).map(([key, d]) =>
    Markup.button.callback(d.label, `salary:${key}`)
  );
  return grid(btns, 3);
}

// ─── Grid utils ───────────────────────────────────────────────────────────────

function gridRows(btns: CB[], cols: number): CB[][] {
  const rows: CB[][] = [];
  for (let i = 0; i < btns.length; i += cols) {
    rows.push(btns.slice(i, i + cols));
  }
  return rows;
}

function grid(btns: CB[], cols: number): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard(gridRows(btns, cols));
}

// ─── Step message builders ────────────────────────────────────────────────────

const TOTAL = 6;

function step1Text(): string {
  return (
    `🔍 <b>Yangi filter yaratish</b>\n` +
    `${progressBar(1, TOTAL)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>1-qadam — Soha tanlang</b>\n\n` +
    `Qaysi sohadagi vakansiyalarni kuzatmoqchisiz?\n\n` +
    `💡 <i>Sohani tanlang — keyin texnologiyalar ro'yxati chiqadi</i>`
  );
}

function step2Text(fieldKey: string, selected: string[]): string {
  const field = FIELDS[fieldKey];
  const selText =
    selected.length > 0
      ? `\n\n✅ <b>Tanlangan (${selected.length} ta):</b>\n<code>${selected.join(", ")}</code>`
      : "\n\n💡 <i>Bir nechta tanlash mumkin — barchasi 'yoki' sifatida qidiriladi</i>";
  return (
    `🔍 <b>Yangi filter yaratish</b>\n` +
    `${progressBar(2, TOTAL)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>2-qadam — Texnologiyalar</b>\n\n` +
    `${field.emoji} <b>${field.label}</b> bo'yicha texnologiyalarni tanlang${selText}`
  );
}

function step3Text(): string {
  return (
    `🔍 <b>Yangi filter yaratish</b>\n` +
    `${progressBar(3, TOTAL)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>3-qadam — Daraja / Tajriba</b>\n\n` +
    `Qaysi tajriba darajasini qidirmoqchisiz?\n\n` +
    `💡 <i>"Hammasi" tanlasangiz — barcha darajalar ko'rsatiladi</i>`
  );
}

function step4Text(): string {
  return (
    `🔍 <b>Yangi filter yaratish</b>\n` +
    `${progressBar(4, TOTAL)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>4-qadam — Ish turi / Format</b>\n\n` +
    `Qaysi formatda ishlashni xohlaysiz?`
  );
}

function step5Text(): string {
  return (
    `🔍 <b>Yangi filter yaratish</b>\n` +
    `${progressBar(5, TOTAL)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>5-qadam — Hudud / Viloyat</b>\n\n` +
    `Qaysi hududdagi vakansiyalarni ko'rmoqchisiz?\n\n` +
    `💡 <i>"Hammasi" — butun O'zbekiston + Remote</i>`
  );
}

function step6Text(): string {
  return (
    `🔍 <b>Yangi filter yaratish</b>\n` +
    `${progressBar(6, TOTAL)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>6-qadam — Minimal maosh (ixtiyoriy)</b>\n\n` +
    `Qancha maoshdan yuqori vakansiyalarni ko'rsatay?\n\n` +
    `💡 <i>"Farqi yo'q" — maoshga qaramay barcha vakansiyalar</i>`
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function buildSummary(session: {
  field?: string;
  technologies?: string[];
  level?: string | null;
  workType?: string | null;
  location?: string | null;
  minSalary?: number | null;
}): string {
  const field     = session.field ? FIELDS[session.field] : null;
  const fieldLabel= field ? `${field.emoji} ${field.label}` : "—";
  const techs     = (session.technologies ?? []).join(", ") || "Belgilanmagan";
  const level     = session.level ? LEVELS[session.level] : "⚪ Hammasi";
  const workType  = session.workType ? WORK_TYPES[session.workType] : "🌐 Hammasi";

  // Location label qidirish
  let locationLabel = "🌍 Butun O'zbekiston";
  if (session.location && session.location !== "__all__") {
    const found = LOCATIONS.find((l) => l.keywords.includes(session.location!));
    locationLabel = found ? found.label : session.location;
  }

  const salary = session.minSalary
    ? `${session.minSalary.toLocaleString("ru")} so'mdan`
    : "Farqi yo'q";

  return (
    `🎉 <b>Filter muvaffaqiyatli yaratildi!</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🗂  Soha:         <b>${fieldLabel}</b>\n` +
    `🛠  Texnologiyalar: <code>${escapeHtml(techs)}</code>\n` +
    `📊  Daraja:       <b>${level}</b>\n` +
    `⚡  Ish turi:     <b>${workType}</b>\n` +
    `📍  Hudud:        <b>${locationLabel}</b>\n` +
    `💰  Min. maosh:   <b>${salary}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🚀 <i>Mos vakansiyalar avtomatik yuboriladi!</i>`
  );
}

// ─── Filter card (Filterlarim uchun) ─────────────────────────────────────────

function filterCard(f: any, index: number): string {
  // location label
  let locLabel = "🌍 Hammasi";
  if (f.location) {
    const found = LOCATIONS.find((l) => l.keywords.includes(f.location));
    locLabel = found ? found.label : f.location;
  }

  const workLabel = f.workType ? WORK_TYPES[f.workType] ?? f.workType : "🌐 Hammasi";
  const levelLabel= f.level    ? LEVELS[f.level]       ?? f.level    : "⚪ Hammasi";
  const salary    = f.minSalary ? `${f.minSalary.toLocaleString("ru")} so'm+` : "—";

  // keywords → texnologiya nomlarini ajratib ko'rsatish
  const techsDisplay = f.keywords
    .filter((k: string) => k !== f.fieldKey)
    .join(", ") || "—";

  // fieldLabel ni olish
  const fieldLabel = f.fieldLabel ?? (f.fieldKey ? FIELDS[f.fieldKey]?.label ?? "Filter" : "Filter");

  return (
    `<b>${index + 1}. ${escapeHtml(fieldLabel)}</b>\n` +
    `   🛠 <code>${escapeHtml(techsDisplay)}</code>\n` +
    `   📊 ${levelLabel}  |  ${workLabel}\n` +
    `   📍 ${locLabel}  |  💰 ${salary}`
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export function registerFilterHandlers(bot: Telegraf, sessions: SessionStore) {

  // ── Qadam 1: Soha ──────────────────────────────────────────────────────────
  bot.hears(["➕ Filter qo'shish", "/filter"], async (ctx) => {
    sessions.set(ctx.from.id, { step: "awaiting_field", technologies: [] });
    await ctx.reply(step1Text(), { parse_mode: "HTML", ...fieldsKeyboard() });
  });

  bot.action(/^field:(.+)$/, async (ctx) => {
    const key = ctx.match[1];
    if (!FIELDS[key]) { await ctx.answerCbQuery("❌ Noto'g'ri soha"); return; }

    sessions.set(ctx.from.id, {
      step: "awaiting_technologies",
      field: key,
      technologies: [],
    });
    await ctx.answerCbQuery();
    await ctx.editMessageText(step2Text(key, []), {
      parse_mode: "HTML",
      ...techKeyboard(key, []),
    });
  });

  // ── Qadam 2: Texnologiyalar (toggle) ───────────────────────────────────────
  bot.action(/^tech:(.+)$/, async (ctx) => {
    const value   = ctx.match[1];
    const session = sessions.get(ctx.from.id);

    if (!session || !["awaiting_technologies", "awaiting_custom_tech"].includes(session.step)) {
      await ctx.answerCbQuery("⚠️ Avval sohani tanlang"); return;
    }

    // Custom yozish
    if (value === "__custom__") {
      sessions.set(ctx.from.id, { ...session, step: "awaiting_custom_tech" });
      await ctx.answerCbQuery();
      await ctx.reply(
        `✏️ <b>O'z texnologiyangizni yozing</b>\n\n` +
        `Vergul bilan ajratib yozing:\n<code>React Native, GraphQL, Expo</code>`,
        { parse_mode: "HTML" },
      );
      return;
    }

    // Tasdiqlash
    if (value === "__done__") {
      const techs = session.technologies ?? [];
      if (techs.length === 0) { await ctx.answerCbQuery("❌ Kamida 1 ta texnologiya tanlang"); return; }
      sessions.set(ctx.from.id, { ...session, step: "awaiting_level" });
      await ctx.answerCbQuery("✅ Tasdiqlandi!");
      await ctx.editMessageText(step3Text(), { parse_mode: "HTML", ...levelKeyboard() });
      return;
    }

    // Toggle
    const current  = session.technologies ?? [];
    const isOn     = current.includes(value);
    const updated  = isOn ? current.filter((t) => t !== value) : [...current, value];

    sessions.set(ctx.from.id, { ...session, step: "awaiting_technologies", technologies: updated });
    await ctx.answerCbQuery(isOn ? `❌ ${value} olib tashlandi` : `✅ ${value} qo'shildi`);
    await ctx.editMessageText(step2Text(session.field!, updated), {
      parse_mode: "HTML",
      ...techKeyboard(session.field!, updated),
    });
  });

  // ── Qadam 3: Daraja ────────────────────────────────────────────────────────
  bot.action(/^level:(.+)$/, async (ctx) => {
    const level   = ctx.match[1];
    const session = sessions.get(ctx.from.id);
    if (!session) { await ctx.answerCbQuery("⚠️ Session topilmadi"); return; }

    sessions.set(ctx.from.id, {
      ...session,
      step: "awaiting_work_type",
      level: level === "any" ? null : level,
    });
    await ctx.answerCbQuery(LEVELS[level] + " tanlandi!");
    await ctx.editMessageText(step4Text(), { parse_mode: "HTML", ...workTypeKeyboard() });
  });

  // ── Qadam 4: Ish turi ──────────────────────────────────────────────────────
  bot.action(/^worktype:(.+)$/, async (ctx) => {
    const wt      = ctx.match[1];
    const session = sessions.get(ctx.from.id);
    if (!session) { await ctx.answerCbQuery("⚠️ Session topilmadi"); return; }

    sessions.set(ctx.from.id, {
      ...session,
      step: "awaiting_location",
      workType: wt === "any" ? null : wt,
    });
    await ctx.answerCbQuery(WORK_TYPES[wt] + " tanlandi!");
    await ctx.editMessageText(step5Text(), { parse_mode: "HTML", ...locationKeyboard() });
  });

  // ── Qadam 5: Viloyat ───────────────────────────────────────────────────────
  bot.action(/^loc:(.+)$/, async (ctx) => {
    const locKey  = ctx.match[1];
    const session = sessions.get(ctx.from.id);
    if (!session) { await ctx.answerCbQuery("⚠️ Session topilmadi"); return; }

    const location = locKey === "__all__" ? null : locKey;

    sessions.set(ctx.from.id, { ...session, step: "awaiting_salary", location });
    await ctx.answerCbQuery();
    await ctx.editMessageText(step6Text(), { parse_mode: "HTML", ...salaryKeyboard() });
  });

  // ── Qadam 6: Maosh ────────────────────────────────────────────────────────
  bot.action(/^salary:(.+)$/, async (ctx) => {
    const key     = ctx.match[1];
    const session = sessions.get(ctx.from.id);
    if (!session) { await ctx.answerCbQuery("⚠️ Session topilmadi"); return; }

    const minSalary = key === "any" ? null : (SALARY_RANGES[key]?.min ?? null);

    // ─── Keywords build ───────────────────────────────────────────────────
    // Texnologiyalar label → keywords (kichik harf, matching uchun)
    const field      = session.field ? FIELDS[session.field] : null;
    const techItems  = field?.technologies ?? [];
    const selectedLabels = session.technologies ?? [];

    const techKeywords: string[] = [];
    for (const label of selectedLabels) {
      const item = techItems.find((t) => t.label === label);
      if (item) {
        techKeywords.push(...item.keywords);
      } else {
        // custom — label o'zini keyword sifatida qo'shamiz
        techKeywords.push(label.toLowerCase());
      }
    }

    // Soha o'zi ham keyword (masalan "frontend")
    if (session.field) techKeywords.push(session.field.toLowerCase());

    // Location keywords
    let locationStr: string | null = null;
    if (session.location && session.location !== "__all__") {
      const locItem = LOCATIONS.find((l) => l.keywords.includes(session.location!));
      // Birinchi keyword saqlash + remote ham qo'shamiz agar mos kelsa
      locationStr = locItem ? locItem.keywords.join(",") : session.location;
    }

    // Prisma ga saqlash
    await prisma.filter.create({
      data: {
        userId:     BigInt(ctx.from.id),
        keywords:   [...new Set(techKeywords)], // duplicate yo'q
        location:   locationStr,
        workType:   session.workType ?? null,
        level:      session.level ?? null,
        minSalary:  minSalary,
        fieldKey:   session.field ?? null,
        fieldLabel: session.field ? FIELDS[session.field]?.label ?? null : null,
      },
    });

    sessions.delete(ctx.from.id);
    await ctx.answerCbQuery("✅ Filter saqlandi!");
    await ctx.editMessageText(buildSummary({ ...session, minSalary }), {
      parse_mode: "HTML",
    });
  });

  // ── Filterlarim ───────────────────────────────────────────────────────────
  bot.hears(["📋 Filterlarim", "/myfilters"], async (ctx) => {
    const filters = await prisma.filter.findMany({
      where:   { userId: BigInt(ctx.from.id) },
      orderBy: { createdAt: "desc" },
    });

    if (filters.length === 0) {
      return ctx.reply(
        `📭 <b>Sizda hali filter yo'q</b>\n\n` +
        `➕ <b>Filter qo'shish</b> tugmasini bosib, birinchi filtringizni yarating!\n\n` +
        `💡 <i>Filter qanchalik aniq bo'lsa — mos vakansiyalar shunchalik ko'p keladi</i>`,
        { parse_mode: "HTML" },
      );
    }

    // Filterlarni to'liq matn sifatida ko'rsatish
    const cards = filters.map((f, i) => filterCard(f, i)).join("\n\n");

    const text =
      `📋 <b>Sizning filterlaringiz — ${filters.length} ta</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      cards + `\n━━━━━━━━━━━━━━━━━━━━`;

    // Har bir filter uchun o'chirish + tahrirlash tugmasi
    const inlineRows = filters.map((f, i) => [
      Markup.button.callback(`✏️ ${i + 1}-ni tahrirlash`, `edit_filter:${f.id}`),
      Markup.button.callback(`🗑 O'chirish`, `del_filter:${f.id}`),
    ]);
    inlineRows.push([Markup.button.callback("➕ Yangi filter", "new_filter")]);

    await ctx.reply(text, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard(inlineRows),
    });
  });

  // ── Filter o'chirish ──────────────────────────────────────────────────────
  bot.action(/del_filter:(\d+)/, async (ctx) => {
    const id      = parseInt(ctx.match[1]);
    const deleted = await prisma.filter.deleteMany({
      where: { id, userId: BigInt(ctx.from!.id) },
    });
    if (deleted.count === 0) { await ctx.answerCbQuery("⚠️ Topilmadi"); return; }
    await ctx.answerCbQuery("✅ O'chirildi!");
    await ctx.editMessageText(
      "🗑 <b>Filter o'chirildi.</b>\n\n📋 <b>Filterlarim</b> tugmasini bosib yangilangan ro'yxatni ko'ring.",
      { parse_mode: "HTML" },
    );
  });

  // ── Filter tahrirlash — o'chirib qayta yaratish ────────────────────────────
  bot.action(/edit_filter:(\d+)/, async (ctx) => {
    const id = parseInt(ctx.match[1]);
    await prisma.filter.deleteMany({ where: { id, userId: BigInt(ctx.from!.id) } });
    sessions.set(ctx.from!.id, { step: "awaiting_field", technologies: [] });
    await ctx.answerCbQuery("✏️ Qayta yaratamiz...");
    await ctx.reply(
      `✏️ <b>Filter tahrirlash</b>\n\nEski filter o'chirildi. Yangi filter yarating:`,
      { parse_mode: "HTML" },
    );
    await ctx.reply(step1Text(), { parse_mode: "HTML", ...fieldsKeyboard() });
  });

  // ── "Yangi filter" inline button ──────────────────────────────────────────
  bot.action("new_filter", async (ctx) => {
    sessions.set(ctx.from!.id, { step: "awaiting_field", technologies: [] });
    await ctx.answerCbQuery();
    await ctx.reply(step1Text(), { parse_mode: "HTML", ...fieldsKeyboard() });
  });

  // ── Pauzaga qo'yish ───────────────────────────────────────────────────────
  bot.hears("⏸ Pauzaga qo'yish", async (ctx) => {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
    });

    if (!user?.isActive) {
      return ctx.reply(
        `▶️ <b>Bildirishnomalar allaqachon to'xtatilgan</b>\n\n` +
        `Qayta yoqish uchun pastdagi tugmani bosing.`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([[
            Markup.button.callback("▶️ Yoqish", "resume_notifications"),
          ]]),
        },
      );
    }

    await prisma.user.update({
      where: { telegramId: BigInt(ctx.from.id) },
      data:  { isActive: false },
    });

    await ctx.reply(
      `⏸ <b>Bildirishnomalar to'xtatildi</b>\n\n` +
      `Qayta yoqish uchun quyidagi tugmani bosing.`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([[
          Markup.button.callback("▶️ Yoqish", "resume_notifications"),
        ]]),
      },
    );
  });

  bot.action("resume_notifications", async (ctx) => {
    await prisma.user.update({
      where: { telegramId: BigInt(ctx.from!.id) },
      data:  { isActive: true },
    });
    await ctx.answerCbQuery("✅ Yoqildi!");
    await ctx.editMessageText(
      "✅ <b>Bildirishnomalar yoqildi!</b>\n\nEndi mos vakansiyalar avtomatik yuboriladi 🚀",
      { parse_mode: "HTML" },
    );
  });

  // ── Yordam ────────────────────────────────────────────────────────────────
  bot.hears(["ℹ️ Yordam", "/help"], async (ctx) => {
    await ctx.reply(
      `ℹ️ <b>Yordam — Vakansiya Bot</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `➕ <b>Filter qo'shish</b>\n` +
      `   6 bosqich: soha → texnologiyalar → daraja\n` +
      `   → ish turi → viloyat → maosh\n` +
      `   Faqat tugmalar orqali — hech narsa yozmasdan!\n\n` +
      `📋 <b>Filterlarim</b>\n` +
      `   Filterlaringizni ko'rish, tahrirlash, o'chirish\n\n` +
      `⏸ <b>Pauzaga qo'yish</b>\n` +
      `   Bildirishnomalarni vaqtincha to'xtatish\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📡 <b>29+ kanal kuzatilmoqda</b>\n` +
      `<i>Yangi vakansiya filtringizga mos kelsa, darhol yuboriladi.</i>`,
      { parse_mode: "HTML" },
    );
  });
}
