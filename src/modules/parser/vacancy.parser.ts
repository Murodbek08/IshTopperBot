/**
 * Telegram kanallardan kelgan vakansiya matnlarini parse qiladi.
 *
 * Qo'llab-quvvatlanadigan formatlar:
 * 1. Strukturali (emoji label):  🏢 Idora: ..., 💰 Maosh: ...
 * 2. Markdown sarlavhali:        # Backend Developer kerak
 * 3. Erkin matn:                 Kompaniya: ..., talablar, maosh
 * 4. Aralash (RU + UZ):          Вакансия, Компания, Requirements
 * 5. Rezyume formatida:          #резюме, Позиция: ...
 */

export interface ParsedVacancy {
  title: string | null;
  company: string | null;
  location: string | null;
  salary: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  technologies: string[];
  telegramContact: string | null;
  phone: string | null;
  workType: "remote" | "office" | "hybrid" | null;
  level: "junior" | "middle" | "senior" | null;
  jobType: "vacancy" | "resume" | null;
  isActive: boolean;
}

// ─── Technology catalog ───────────────────────────────────────────────────────

const KNOWN_TECHNOLOGIES: string[] = [
  // Frontend
  "React", "React.js", "ReactJS",
  "Vue", "Vue.js", "VueJS",
  "Angular",
  "Next.js", "NextJS", "Next",
  "Nuxt.js", "Nuxt",
  "JavaScript",
  "TypeScript",
  "HTML", "HTML5",
  "CSS", "CSS3",
  "SCSS", "SASS", "Less",
  "Tailwind", "Tailwind CSS",
  "Bootstrap",
  "Redux", "Zustand", "MobX",
  "Svelte",
  "jQuery",
  "Webpack", "Vite",
  // Backend
  "Node.js", "NodeJS",
  "Express", "Express.js",
  "NestJS", "Nest.js",
  "Fastify",
  "Python",
  "Django",
  "FastAPI",
  "Flask",
  "PHP",
  "Laravel",
  "Symfony",
  "Java",
  "Spring", "Spring Boot",
  "C#", ".NET", "ASP.NET",
  "Go", "Golang",
  "Rust",
  "Ruby", "Ruby on Rails", "Rails",
  "Kotlin",
  "Scala",
  "Elixir",
  // Mobile
  "Flutter",
  "React Native",
  "Swift",
  "Android",
  "iOS",
  "Dart",
  "Xamarin",
  "Jetpack Compose",
  // Database
  "PostgreSQL", "Postgres",
  "MySQL",
  "MongoDB",
  "Redis",
  "SQLite",
  "Elasticsearch",
  "Cassandra",
  "Firebase",
  "Supabase",
  "DynamoDB",
  "ClickHouse",
  "SQL",
  "NoSQL",
  // ORM
  "Prisma",
  "TypeORM",
  "Sequelize",
  "Hibernate",
  // DevOps / Infra
  "Docker",
  "Kubernetes", "K8s",
  "AWS",
  "GCP", "Google Cloud",
  "Azure",
  "CI/CD",
  "Jenkins",
  "Terraform",
  "Ansible",
  "Nginx",
  "Linux",
  "Git",
  "GitHub", "GitLab", "Bitbucket",
  "GitHub Actions",
  "Vercel",
  // AI / Data
  "TensorFlow",
  "PyTorch",
  "Pandas",
  "NumPy",
  "Spark",
  "Airflow",
  "OpenCV",
  "scikit-learn",
  "LangChain",
  // API / Architecture
  "REST", "REST API",
  "GraphQL",
  "WebSocket", "Socket.io",
  "gRPC",
  "Microservices",
  "BullMQ",
  // Design
  "Figma",
  "Adobe XD",
  "Photoshop",
  "Illustrator",
  "After Effects",
  "DaVinci Resolve",
  "Premiere Pro",
  "CapCut",
  // SMM / Marketing
  "Google Ads",
  "Meta Ads", "Facebook Ads",
  "SEO",
  // Other
  "Blockchain", "Web3",
  "Solidity",
  "1C",
  "SAP",
];

// Qisqa texnologiyalar uchun alohida strict match ro'yxati
// Bular faqat to'liq so'z sifatida match qilinadi, regex orqali emas
const STRICT_MATCH_TECHS = new Set([
  "go", "golang", "sql", "java", "c#", ".net", "php", "rust",
  "swift", "dart", "less", "sass", "next", "nuxt", "node",
  "rails", "flask", "spark",
]);

// ─── Constants ────────────────────────────────────────────────────────────────

const UZBEK_CITIES_MAP: Record<string, string> = {
  toshkent: "Toshkent",
  tashkent: "Toshkent",
  ташкент: "Toshkent",
  samarqand: "Samarqand",
  самарканд: "Samarqand",
  buxoro: "Buxoro",
  бухара: "Buxoro",
  namangan: "Namangan",
  наманган: "Namangan",
  andijon: "Andijon",
  андижан: "Andijon",
  "farg'ona": "Farg'ona",
  fergana: "Farg'ona",
  фергана: "Farg'ona",
  qarshi: "Qarshi",
  карши: "Qarshi",
  nukus: "Nukus",
  нукус: "Nukus",
  termiz: "Termiz",
  термез: "Termiz",
  urganch: "Urganch",
  ургенч: "Urganch",
  navoiy: "Navoiy",
  навои: "Navoiy",
  jizzax: "Jizzax",
  джизак: "Jizzax",
  guliston: "Guliston",
  гулистан: "Guliston",
  "qo'qon": "Qo'qon",
  коканд: "Qo'qon",
};

const COMPANY_LABELS = [
  "Idora", "Kompaniya", "Компания", "Ish joyi", "Работодатель",
  "Firma", "Корпорация", "Агентство",
];
const LOCATION_LABELS = [
  "Hudud", "Joylashuv", "Shahar", "Manzil",
  "Регион", "Город", "Локация", "Адрес", "Location", "Местоположение",
];
const SALARY_LABELS = [
  "Maosh", "Ish haqi", "Зарплата", "Salary", "Оплата", "Ish haqi",
  "Daromad", "Доход", "Oylik",
];
const TECH_LABELS = [
  "Texnologiya", "Texnologiyalar", "Технологии", "Stack", "Стек",
  "Skills", "Ko'nikmalar", "Навыки", "Talablar", "Требования", "Tools",
];
const TITLE_LABELS = [
  "Pozitsiya", "Позиция", "Lavozim", "Title", "Должность", "Vakansiya",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripEmoji(str: string): string {
  return str
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27FF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/[🏢📚🇺🇿📞🌐🕰💰‼️✅❌⚠️📌📍💼⚡🔧🎯📋👤🛠🔰]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAfterLabel(text: string, ...labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(?:^|\\n)\\s*[^\\n]{0,10}${escaped}\\s*[:\\-–—]\\s*(.+)`,
      "im",
    );
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseJobType(text: string): "vacancy" | "resume" {
  if (/#резюме|#resume|rezyume|резюме|Позиция:|Ожидания по зарплате/i.test(text)) {
    return "resume";
  }
  return "vacancy";
}

function parseIsActive(text: string): boolean {
  if (/#aktiv|#active|ish holati:\s*#?aktiv/i.test(text)) return true;
  if (/#noaktiv|#inactive|#closed/i.test(text)) return false;
  return true;
}

function parseTechnologies(text: string): string[] {
  const found = new Set<string>();

  // Label qatoridan olish
  const techLine = extractAfterLabel(text, ...TECH_LABELS) ?? "";

  // Hash-tag'lardan olish: #react #nodejs
  const hashtags = (text.match(/#([A-Za-z0-9_.]+)/g) ?? [])
    .map((h) => h.slice(1))
    .join(" ");

  const searchIn = (techLine + " " + hashtags + " " + text).toLowerCase();

  for (const tech of KNOWN_TECHNOLOGIES) {
    const techLower = tech.toLowerCase();

    let matched = false;

    if (STRICT_MATCH_TECHS.has(techLower)) {
      // Strict: faqat to'liq so'z bo'lsa
      const strictRe = new RegExp(
        `(?:^|[^a-z0-9])${techLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`,
        "i",
      );
      matched = strictRe.test(searchIn);
    } else {
      // Normal word-boundary match
      const re = new RegExp(
        `(?<![a-z0-9])${techLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`,
        "i",
      );
      matched = re.test(searchIn);
    }

    if (matched) {
      found.add(normalizeTech(tech));
    }
  }

  return Array.from(found);
}

function normalizeTech(tech: string): string {
  const map: Record<string, string> = {
    "ReactJS": "React",
    "React.js": "React",
    "VueJS": "Vue.js",
    "NodeJS": "Node.js",
    "NextJS": "Next.js",
    "Next": "Next.js",
    "NuxtJS": "Nuxt.js",
    "Nuxt": "Nuxt.js",
    "Postgres": "PostgreSQL",
    "K8s": "Kubernetes",
    "Golang": "Go",
    "Node": "Node.js",
    "Rails": "Ruby on Rails",
  };
  return map[tech] ?? tech;
}

function parseSalaryNumber(raw: string): { min: number | null; max: number | null } {
  const cleaned = raw.replace(/[\s_]/g, "");

  // Dollar range: "$1000-2000" yoki "$1,000 - $2,000"
  const dollarRange = cleaned.match(/\$\s*([\d,]+)\s*[-–—]\s*\$?\s*([\d,]+)/);
  if (dollarRange) {
    const min = parseFloat(dollarRange[1].replace(",", "")) * 12700;
    const max = parseFloat(dollarRange[2].replace(",", "")) * 12700;
    return { min: Math.round(min), max: Math.round(max) };
  }

  // Single dollar: "$1500"
  const singleDollar = cleaned.match(/\$\s*([\d,]+)/);
  if (singleDollar) {
    const val = parseFloat(singleDollar[1].replace(",", "")) * 12700;
    return { min: Math.round(val), max: null };
  }

  // EUR
  const eurMatch = cleaned.match(/([\d.]+)\s*EUR/i);
  if (eurMatch) {
    const val = parseFloat(eurMatch[1]) * 13500;
    return { min: Math.round(val), max: null };
  }

  // "от X до Y" (Russian)
  const fromToMatch = raw.match(/от\s*([\d\s]+)\s*до\s*([\d\s]+)/i);
  if (fromToMatch) {
    const a = parseInt(fromToMatch[1].replace(/\s/g, ""));
    const b = parseInt(fromToMatch[2].replace(/\s/g, ""));
    if (!isNaN(a) && !isNaN(b)) return { min: Math.min(a, b), max: Math.max(a, b) };
  }

  // "Xmln" → X * 1_000_000
  const mlnMatch = cleaned.match(/([\d.]+)\s*mln/i);
  if (mlnMatch) {
    const val = parseFloat(mlnMatch[1]) * 1_000_000;
    return { min: Math.round(val), max: null };
  }

  // Range with separator: "3 000 000 – 5 000 000"
  const rangeMatch = raw.replace(/\s/g, "").match(/([\d]{4,})[^\d]+([\d]{4,})/);
  if (rangeMatch) {
    const a = parseInt(rangeMatch[1]);
    const b = parseInt(rangeMatch[2]);
    if (!isNaN(a) && !isNaN(b)) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }

  // Single number >= 4 digits
  const single = cleaned.match(/([\d]{4,})/);
  if (single) {
    const val = parseInt(single[0]);
    if (!isNaN(val) && val > 0 && val < 2_000_000_000) {
      return { min: val, max: null };
    }
  }

  return { min: null, max: null };
}

function parseSalary(text: string): {
  salary: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
} {
  const raw = extractAfterLabel(text, ...SALARY_LABELS);
  if (!raw) return { salary: null, salaryMin: null, salaryMax: null };

  const salary = stripEmoji(raw).split("\n")[0].trim();

  if (/suhbat|kelish|договор|negotiable|обговор|kelishiladi|muhokama/i.test(salary)) {
    return { salary, salaryMin: null, salaryMax: null };
  }

  const { min, max } = parseSalaryNumber(salary);
  return { salary, salaryMin: min, salaryMax: max };
}

function parseWorkType(text: string): "remote" | "office" | "hybrid" | null {
  const lower = text.toLowerCase();
  const isRemote = /\bremote\b|удалённ|masofaviy|uzoqdan|масофав|online\s*ish|onlayn|distantsion/i.test(lower);
  const isOffice = /\boffice\b|ofis|оффис|на\s*месте|offline|offlayn|oflayn|ofisda/i.test(lower);
  const isHybrid = /hybrid|gibrid|aralash|гибрид/i.test(lower);

  if (isHybrid) return "hybrid";
  if (isRemote && isOffice) return "hybrid";
  if (isRemote) return "remote";
  if (isOffice) return "office";
  return null;
}

function parseLevel(text: string): "junior" | "middle" | "senior" | null {
  if (/\bsenior\b|\bsr\.?\b|\btech\s*lead\b|\blead\b/i.test(text)) return "senior";
  if (/\bmiddle\+?\b|\bmid\b|\bstrong\s*junior\b/i.test(text)) return "middle";
  if (/\bjunior\b|\bjr\.?\b|\bintern\b|\bstajyor\b|\bno\s*experience\b/i.test(text)) return "junior";
  return null;
}

function parsePhone(text: string): string | null {
  const m = text.match(/((?:\+?998|8)[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/);
  if (!m) return null;
  return m[1].replace(/[\s\-]/g, "").replace(/^8/, "+998");
}

function parseTelegramContact(text: string, channelName?: string): string | null {
  const channelLower = channelName?.toLowerCase() ?? "";

  // Birinchi: labeled contact (murojaat/aloqa/kontakt orqali)
  const labeled = text.match(
    /(?:telegram|murojaat|kontakt|aloqa|связь|контакт|bog.lan|写信)[^\n@]{0,40}@([A-Za-z0-9_]{3,32})/i,
  );
  if (labeled) return `@${labeled[1]}`;

  // Ikkinchi: "CV yuboring → @username" yoki "yuborish: @username"
  const cvContact = text.match(
    /(?:cv|rezyume|resume|portfolio|ariza)[^\n@]{0,30}@([A-Za-z0-9_]{3,32})/i,
  );
  if (cvContact) return `@${cvContact[1]}`;

  // Uchinchi: barcha @mention larni yig'ib, kanalnikini olib tashlaymiz
  const allMentions = [...text.matchAll(/@([A-Za-z0-9_]{3,32})/g)].map(
    (m) => m[1],
  );

  for (const mention of allMentions) {
    // Kanal nomiga o'xshash yoki bot ekanini tekshiramiz
    if (mention.toLowerCase() === channelLower) continue;
    if (mention.toLowerCase().endsWith("bot")) continue;
    if (mention.toLowerCase().endsWith("_uz") && mention.toLowerCase().includes("vak")) continue;
    return `@${mention}`;
  }

  return null;
}

function parseLocation(text: string): string | null {
  const raw = extractAfterLabel(text, ...LOCATION_LABELS);
  if (raw) {
    const cleaned = stripEmoji(raw)
      .split(/[\n,/]/)[0]
      .trim();
    const lower = cleaned.toLowerCase();
    for (const [key, val] of Object.entries(UZBEK_CITIES_MAP)) {
      if (lower.includes(key)) return val;
    }
    if (cleaned.length > 1 && cleaned.length < 60) return cleaned;
  }

  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(UZBEK_CITIES_MAP)) {
    const re = new RegExp(`(?:^|[^a-z])${key}(?:[^a-z]|$)`, "i");
    if (re.test(lower)) return val;
  }
  return null;
}

function parseCompany(text: string): string | null {
  const raw = extractAfterLabel(text, ...COMPANY_LABELS);
  if (!raw) return null;
  return stripEmoji(raw)
    .split(/[\n,📚]/)[0]
    .trim()
    .slice(0, 80) || null;
}

function parseTitle(text: string): string | null {
  // 1. Markdown H1: # Backend Developer kerak
  const mdMatch = text.match(/^#\s+([^#\n].+)/m);
  if (mdMatch) return stripEmoji(mdMatch[1]).trim();

  // 2. "Позиция: ..." yoki "Pozitsiya: ..."
  const posMatch = extractAfterLabel(text, ...TITLE_LABELS);
  if (posMatch) return stripEmoji(posMatch.split("\n")[0]).trim();

  // 3. Birinchi qator — ish e'loni belgisi bo'lsa
  const firstLine = stripEmoji(text.split("\n")[0]).trim();
  if (
    firstLine.length > 4 &&
    firstLine.length < 120 &&
    /kerak|вакансия|vacancy|developer|dasturchi|mutaxassis|specialist|manager|dizayner|designer|operator|ustoz|o'qituvchi|engineer|analyst|devops|tester|qa\b/i.test(
      firstLine,
    )
  ) {
    return firstLine;
  }

  // 4. Birinchi 3 qatordan qidiramiz (ba'zan 2-3-qatorda lavozim bo'ladi)
  const lines = text.split("\n").slice(0, 3);
  for (const line of lines) {
    const clean = stripEmoji(line).trim();
    if (
      clean.length > 5 &&
      clean.length < 100 &&
      /junior|middle|senior|developer|engineer|dasturchi|dizayner|manager|analyst|lead|frontend|backend|fullstack|mobile|flutter|react|node/i.test(
        clean,
      )
    ) {
      return clean;
    }
  }

  // 5. Caps qator
  const capsMatch = text.match(/^([A-ZА-ЯЁ\s]{5,80})\n/m);
  if (capsMatch) {
    const candidate = stripEmoji(capsMatch[1]).trim();
    if (candidate.length > 4) return candidate;
  }

  return null;
}

// ─── Vacancy detector ─────────────────────────────────────────────────────────

function isVacancyOrResume(text: string): boolean {
  // Aniq vakansiya belgilari
  if (/kerak|vacancy|вакансия|xodim\s*kerak|ish\s*o.rni|ishga\s*qabul|#vakansiya|#ish\b/i.test(text)) return true;

  // Aniq rezyume belgilari
  if (/#резюме|#resume|rezyume|резюме|позиция:|ожидания по зарплате|cv qabul/i.test(text)) return true;

  // IT kasblari (kerak so'zisiz ham)
  if (/\b(?:junior|middle|senior|lead|intern)\b.{0,40}(?:developer|engineer|designer|analyst|devops|tester|qa\b)/i.test(text)) return true;
  if (/(?:frontend|backend|fullstack|full.stack|mobile)\s+(?:developer|engineer|dasturchi)/i.test(text)) return true;

  // Umumiy kasblar
  if (/\b(?:developer|dasturchi|mutaxassis|specialist|manager|dizayner|designer|operator|ustoz|o'qituvchi|учитель|мастер|programm[ei]r|engineer)\b/i.test(text)) return true;

  // Rezyume ko'rsatkichlari (maosh kutish + tajriba)
  if (/(maosh|зарплата|salary)/i.test(text) && /(talablar|требования|requirements|vazifalar|tajriba|опыт)/i.test(text)) return true;

  // "Ish e'loni" yoki "Ishchi qidiriladi" kabi
  if (/ish\s*e.lon|ishchi\s*qidiri|xodim\s*qidiri|сотрудник\s*ищ|работник\s*нужен/i.test(text)) return true;

  return false;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseVacancy(text: string, channelName?: string): ParsedVacancy | null {
  if (!text || text.trim().length < 20) return null;
  if (!isVacancyOrResume(text)) return null;

  const { salary, salaryMin, salaryMax } = parseSalary(text);
  const jobType = parseJobType(text);

  return {
    title: parseTitle(text),
    company: parseCompany(text),
    location: parseLocation(text),
    salary,
    salaryMin,
    salaryMax,
    technologies: parseTechnologies(text),
    telegramContact: parseTelegramContact(text, channelName),
    phone: parsePhone(text),
    workType: parseWorkType(text),
    level: parseLevel(text),
    jobType,
    isActive: parseIsActive(text),
  };
}
