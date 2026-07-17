import { ai, AI_MODEL } from "../../lib/ai";
import { logger } from "../../lib/logger";
import { sleep } from "../bot/utils";

const CTX = "AIParser";

export interface ParsedVacancy {
  title:           string | null;
  company:         string | null;
  location:        string | null;
  salary:          string | null;
  salaryMin:       number | null;
  salaryMax:       number | null;
  technologies:    string[];
  telegramContact: string | null;
  phone:           string | null;
  workType:        "remote" | "office" | "hybrid" | null;
  level:           "junior" | "middle" | "senior" | null;
  jobType:         "vacancy" | "resume";
  isActive:        boolean;
}

/** AI chaqiruvi qayta urinishlardan keyin ham muvaffaqiyatsiz bo'lganda tashlanadi. */
export class AIParseError extends Error {}

const SYSTEM_PROMPT = `Sen Telegram kanallaridagi IT ish e'lonlarini tahlil qiluvchi ekstraktorsan.
Matn o'zbek, rus yoki ingliz tilida (aralash ham) bo'lishi mumkin.
Vazifang: postni tahlil qilib, quyidagi maydonlar bilan FAQAT JSON obyekt qaytarish.

- isRelevant (boolean): post IT/dasturlash sohasidagi vakansiya YOKI IT mutaxassisning rezyumesi bo'lsa true.
  IT bo'lmagan ish (sotuvchi, oshpaz, haydovchi...), reklama, spam yoki e'lon bo'lmagan oddiy xabar bo'lsa false.
- jobType ("vacancy"|"resume"): ish beruvchi izlasa "vacancy", nomzod o'zini taklif qilsa "resume".
- title (string|null): lavozim nomi, masalan "Senior React Developer".
- company (string|null): kompaniya nomi; aniq bo'lmasa null.
- location (string|null): shahar/mamlakat; sof masofaviy bo'lsa null.
- salary (string|null): maosh matnda qanday yozilgan bo'lsa shundayligicha ("$1000-2000", "5-8 mln"); yo'q bo'lsa null.
- salaryMin, salaryMax (number|null): maoshni OYLIK, SO'MDA (UZS) songa aylantir.
  Kurs: 1 USD ≈ 12800 so'm, 1 EUR ≈ 13800 so'm. "mln"=1000000. Bitta son bo'lsa salaryMax=null. Maosh yo'q bo'lsa ikkalasi null.
- technologies (string[]): texnologiyalar kanonik nom bilan ("React","Node.js","Python","PostgreSQL"...); yo'q bo'lsa [].
- telegramContact (string|null): bog'lanish @username (@ bilan); yo'q bo'lsa null.
- phone (string|null): telefon raqami; yo'q bo'lsa null.
- workType ("remote"|"office"|"hybrid"|null).
- level ("junior"|"middle"|"senior"|null): intern/trainee→"junior", lead→"senior".

Boshqa hech narsa yozma — faqat JSON.`;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

const num = (v: unknown): number | null =>
  typeof v === "number" && isFinite(v) && v > 0 ? Math.round(v) : null;

function toParsed(d: Record<string, unknown>): ParsedVacancy {
  return {
    title:           str(d.title),
    company:         str(d.company),
    location:        str(d.location),
    salary:          str(d.salary),
    salaryMin:       num(d.salaryMin),
    salaryMax:       num(d.salaryMax),
    technologies:    Array.isArray(d.technologies)
      ? d.technologies.filter((t): t is string => typeof t === "string" && t.trim() !== "").slice(0, 30)
      : [],
    telegramContact: str(d.telegramContact),
    phone:           str(d.phone),
    workType:        d.workType === "remote" || d.workType === "office" || d.workType === "hybrid" ? d.workType : null,
    level:           d.level === "junior" || d.level === "middle" || d.level === "senior" ? d.level : null,
    jobType:         d.jobType === "resume" ? "resume" : "vacancy",
    isActive:        true,
  };
}

const MAX_ATTEMPTS = 3;

/**
 * Postni AI orqali tahlil qiladi.
 * - IT vakansiya/rezyume bo'lmasa → null (ataylab o'tkazib yuborildi).
 * - AI barcha urinishlardan keyin ham javob bera olmasa → AIParseError tashlanadi
 *   (chaqiruvchi vakansiyani xom holda saqlab, yo'qotmasligi uchun).
 */
export async function parseVacancy(
  text: string,
  channel: string,
): Promise<ParsedVacancy | null> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await ai.chat.completions.create({
        model:           AI_MODEL,
        temperature:     0,
        max_tokens:      800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: text },
        ],
      });

      const raw = res.choices[0]?.message?.content;
      if (!raw) throw new Error("AI bo'sh javob qaytardi");

      const d = JSON.parse(raw) as Record<string, unknown>;
      if (d.isRelevant !== true) return null;

      return toParsed(d);
    } catch (err: any) {
      lastErr = err;
      logger.warn(CTX, `Urinish ${attempt}/${MAX_ATTEMPTS} muvaffaqiyatsiz — @${channel}: ${err?.message ?? err}`);
      if (attempt < MAX_ATTEMPTS) await sleep(1000 * attempt); // 1s, 2s
    }
  }

  logger.error(CTX, `AI parse — barcha urinishlar tugadi @${channel}`, {
    error: (lastErr as any)?.message ?? String(lastErr),
  });
  throw new AIParseError((lastErr as any)?.message ?? "AI parse xato");
}
