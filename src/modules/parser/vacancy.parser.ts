/**
 * Telegram kanaldan kelgan xom vakansiya matnini
 * strukturaviy ma'lumotlarga ajratib oladi.
 *
 * Misol matn:
 * "Xodim kerak:
 *  🏢 Idora: IT Time Academy
 *  📚 Texnologiya: React, JavaScript, Html, Css
 *  🇺🇿 Telegram: @Asadbek_0805
 *  ..."
 */

export interface ParsedVacancy {
  title: string | null;
  company: string | null;
  location: string | null;
  salary: string | null;
  salaryMin: number | null;
  technologies: string[];
  telegramContact: string | null;
  phone: string | null;
  workType: "remote" | "office" | "hybrid" | null;
  level: "junior" | "middle" | "senior" | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Emoji va unicode belgilarni olib tashlab, label'dan keyin kelgan qiymatni oladi */
function extractAfterLabel(text: string, ...labels: string[]): string | null {
  for (const label of labels) {
    // "Idora: IT Time Academy" yoki "Idora — IT Time Academy"
    const re = new RegExp(`${label}\\s*[:\\-–—]\\s*(.+)`, "im");
    const match = text.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

/** Matndan emoji va ikon belgilarini tozalaydi */
function stripEmoji(str: string): string {
  return str
    .replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/[🏢📚🇺🇿📞🌐🕰💰‼️✅❌⚠️]/g, "")
    .trim();
}

/** Matnda mavjud bo'lgan texnologiya nomlarini topadi */
const KNOWN_TECHNOLOGIES = [
  "React",
  "Vue",
  "Angular",
  "Next.js",
  "Nuxt",
  "JavaScript",
  "TypeScript",
  "HTML",
  "CSS",
  "SCSS",
  "SASS",
  "Node.js",
  "Express",
  "NestJS",
  "Fastify",
  "Python",
  "Django",
  "FastAPI",
  "Flask",
  "PHP",
  "Laravel",
  "Symfony",
  "Java",
  "Spring",
  "C#",
  ".NET",
  "Flutter",
  "React Native",
  "Swift",
  "Kotlin",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Docker",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
  "Git",
  "GraphQL",
  "REST",
  "Tailwind",
  "Bootstrap",
  "Figma",
  "Photoshop",
  "1C",
  "SAP",
];

function parseTechnologies(text: string): string[] {
  // Avval "Texnologiya:" label'idan keyingi qatorni ko'rish
  const techLine =
    extractAfterLabel(
      text,
      "Texnologiya",
      "Технологии",
      "Stack",
      "Skills",
      "Ko'nikmalar",
    ) ?? "";

  // techLine'dan ham, butun matndan ham qidirish
  const searchIn = (techLine + " " + text).toLowerCase();

  return KNOWN_TECHNOLOGIES.filter((tech) =>
    searchIn.includes(tech.toLowerCase()),
  );
}

/** Maoshni string'dan raqamga o'giradi: "3 000 000" → 3000000 */
function parseSalaryNumber(raw: string): number | null {
  // Faqat birinchi raqam guruhini olamiz: "3 500 000 – 5 000 000" → 3500000
  const match = raw.match(/[\d][\d\s_]*/);
  if (!match) return null;
  const cleaned = match[0].replace(/[\s_]/g, "");
  const num = parseInt(cleaned, 10);
  if (isNaN(num) || num <= 0 || num > 2_000_000_000) return null;
  return num;
}

/** Ish turini aniqlaydi */
function parseWorkType(text: string): "remote" | "office" | "hybrid" | null {
  const lower = text.toLowerCase();
  if (/\bremote\b|удалённ|masofaviy|uzoqdan/i.test(lower)) return "remote";
  if (/hybrid|gibrid|aralash/i.test(lower)) return "hybrid";
  if (/ofis|office|idora\s*da|на\s*месте/i.test(lower)) return "office";
  return null;
}

/** Daraja (level) ni aniqlaydi */
function parseLevel(text: string): "junior" | "middle" | "senior" | null {
  const lower = text.toLowerCase();
  if (/\bsenior\b|\bsr\b/i.test(lower)) return "senior";
  if (/\bmiddle\+?\b|\bmid\b/i.test(lower)) return "middle";
  if (/\bjunior\b|\bjr\b/i.test(lower)) return "junior";
  return null;
}

/** Telefon raqamlarni topadi: +998901234567 yoki 998 90 123 45 67 */
function parsePhone(text: string): string | null {
  const match = text.match(
    /(\+?998[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/,
  );
  if (!match) return null;
  // Normalizatsiya: faqat + va raqamlar
  return match[1].replace(/[\s\-]/g, "");
}

/** Telegram username topadi: @username */
function parseTelegramContact(text: string): string | null {
  const match = text.match(/@([A-Za-z0-9_]{3,32})/);
  return match ? `@${match[1]}` : null;
}

/** Joylashuvni aniqlaydi */
const UZBEK_CITIES = [
  "toshkent",
  "samarqand",
  "buxoro",
  "namangan",
  "andijon",
  "farg'ona",
  "qarshi",
  "nukus",
  "termiz",
  "urganch",
  "navoiy",
  "jizzax",
  "guliston",
  "tashkent",
  "fergana",
  "bukhara",
];

function parseLocation(text: string): string | null {
  // Label'dan olish
  const raw =
    extractAfterLabel(
      text,
      "Hudud",
      "Joylashuv",
      "Shahar",
      "Manzil",
      "Регион",
      "Город",
    ) ?? "";

  if (raw) return stripEmoji(raw).split(/[,\n]/)[0].trim();

  // Matnda shahar nomini qidirish
  const lower = text.toLowerCase();
  for (const city of UZBEK_CITIES) {
    if (lower.includes(city)) {
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }
  return null;
}

/** Sarlavhani topadi */
function parseTitle(text: string): string | null {
  // Birinchi qatorni ko'rish
  const firstLine = text.split("\n")[0].trim();

  // "Xodim kerak", "Ish o'rni", "Vakansiya" kabi so'zlar bo'lsa
  if (/kerak|vacancy|вакансия|ish\s*o.rni|ishga\s*qabul/i.test(firstLine)) {
    return stripEmoji(firstLine) || null;
  }

  // "Idora:..." dan oldingi qism sarlavha bo'lishi mumkin
  const companyLine = text.match(/(?:Idora|Kompaniya|Ish\s*joyi)[:\s]+(.+)/im);
  if (companyLine) {
    const titleGuess = stripEmoji(text.split("\n")[0]);
    if (titleGuess.length > 3 && titleGuess.length < 100) return titleGuess;
  }

  return null;
}

/** Kompaniya nomini topadi */
function parseCompany(text: string): string | null {
  const raw = extractAfterLabel(
    text,
    "Idora",
    "Kompaniya",
    "Компания",
    "Ish joyi",
  );
  if (!raw) return null;
  // Faqat birinchi qatorni, emoji va ortiqcha belgilarni olib tashlab
  return stripEmoji(raw)
    .split(/[\n,]/)[0] // birinchi qator/vergulgacha
    .replace(/📚.*$/s, "") // "📚 Texnologiya:..." dan keyinini kesib tashlash
    .trim();
}

/** Maoshni topadi */
function parseSalary(text: string): {
  salary: string | null;
  salaryMin: number | null;
} {
  const raw = extractAfterLabel(
    text,
    "Maosh",
    "Ish haqi",
    "Зарплата",
    "Salary",
  );

  if (!raw) return { salary: null, salaryMin: null };

  const salary = stripEmoji(raw).trim();

  // "Suhbat asosida", "Kelishiladi" → raqam yo'q
  if (/suhbat|kelish|договор|negotiable/i.test(salary)) {
    return { salary, salaryMin: null };
  }

  const salaryMin = parseSalaryNumber(salary);
  return { salary, salaryMin };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Telegram kanal postidan vakansiya ma'lumotlarini parse qiladi.
 * Hech narsa topa olmasa null qaytaradi — spam/reklama bo'lishi mumkin.
 */
export function parseVacancy(text: string): ParsedVacancy | null {
  // Vakansiyaga o'xshamaydigan matnlarni filtrlaymiz
  const isVacancy =
    /kerak|vacancy|вакансия|ish\s*o.rni|developer|dasturchi|ishga\s*qabul|o.qituvchi|murabbiy|#ish/i.test(
      text,
    );
  if (!isVacancy) return null;

  const { salary, salaryMin } = parseSalary(text);

  return {
    title: parseTitle(text),
    company: parseCompany(text),
    location: parseLocation(text),
    salary,
    salaryMin,
    technologies: parseTechnologies(text),
    telegramContact: parseTelegramContact(text),
    phone: parsePhone(text),
    workType: parseWorkType(text),
    level: parseLevel(text),
  };
}
