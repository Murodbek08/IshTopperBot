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
  jobType: "vacancy" | "resume" | null; // vakansiya yoki rezyume
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
  "JavaScript", "JS",
  "TypeScript", "TS",
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
  "Node.js", "NodeJS", "Node",
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
  "LEGO", "Arduino", "Scratch",
  "1C",
  "SAP",
];

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

// Label patterns (UZ + RU)
const COMPANY_LABELS = [
  "Idora", "Kompaniya", "Компания", "Ish joyi", "Работодатель",
  "Firma", "Корпорация", "Агентство",
];
const LOCATION_LABELS = [
  "Hudud", "Joylashuv", "Shahar", "Manzil",
  "Регион", "Город", "Локация", "Адрес", "Location", "Местоположение",
];
const SALARY_LABELS = [
  "Maosh", "Ish haqi", "Зарплата", "Salary", "Оплата", "Ish\u202fhaqi",
  "Daromad", "Доход",
];
const TECH_LABELS = [
  "Texnologiya", "Texnologiyalar", "Технологии", "Stack", "Стек",
  "Skills", "Ko'nikmalar", "Навыки", "Talablar", "Требования",
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

function extractListAfterLabel(text: string, ...labels: string[]): string[] {
  const line = extractAfterLabel(text, ...labels);
  if (!line) return [];
  return line
    .split(/[,;/|]+/)
    .map((s) => stripEmoji(s).trim())
    .filter((s) => s.length > 1);
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseJobType(text: string): "vacancy" | "resume" {
  if (/#резюме|#resume|rezyume|резюме|Позиция:|Ожидания по зарплате/i.test(text)) {
    return "resume";
  }
  return "vacancy";
}

function parseIsActive(text: string): boolean {
  // "ish holati: #aktiv" yoki "holat: #aktiv"
  if (/#aktiv|#active|ish holati:\s*#?aktiv/i.test(text)) return true;
  if (/#noaktiv|#inactive|#closed/i.test(text)) return false;
  return true; // default: aktiv deb hisoblaymiz
}

function parseTechnologies(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  // 1. Label qatoridan olish
  const techLine = extractAfterLabel(text, ...TECH_LABELS) ?? "";

  // 2. Hash-tag'lardan olish: #react #nodejs
  const hashtags = (text.match(/#([A-Za-z0-9_.]+)/g) ?? [])
    .map((h) => h.slice(1))
    .join(" ");

  const searchIn = (techLine + " " + hashtags + " " + text).toLowerCase();

  for (const tech of KNOWN_TECHNOLOGIES) {
    // Word-boundary-like match
    const techLower = tech.toLowerCase();
    const pattern = new RegExp(
      `(?<![a-z0-9])${techLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`,
      "i",
    );
    if (pattern.test(searchIn)) {
      // Canonical form qo'shamiz
      const canonical = normalizetech(tech);
      found.add(canonical);
    }
  }

  return Array.from(found);
}

/** Texnologiya nomini normalize qiladi: ReactJS → React, NodeJS → Node.js */
function normalizetech(tech: string): string {
  const map: Record<string, string> = {
    "ReactJS": "React",
    "React.js": "React",
    "VueJS": "Vue.js",
    "NodeJS": "Node.js",
    "NextJS": "Next.js",
    "NuxtJS": "Nuxt.js",
    "Postgres": "PostgreSQL",
    "K8s": "Kubernetes",
    "Golang": "Go",
    "TS": "TypeScript",
    "JS": "JavaScript",
  };
  return map[tech] ?? tech;
}

function parseSalaryNumber(raw: string): { min: number | null; max: number | null } {
  // "3 000 000 – 5 000 000" yoki "3mln" yoki "$1000-2000"
  const cleaned = raw.replace(/[\s_]/g, "");

  // Dollar/EUR konvertatsiya (taxminiy: 1$ ≈ 12700 UZS, 1€ ≈ 13500)
  const dollarMatch = cleaned.match(/\$\s*([\d.,]+)\s*[-–—]\s*([\d.,]+)/);
  if (dollarMatch) {
    const min = parseFloat(dollarMatch[1].replace(",", "")) * 12700;
    const max = parseFloat(dollarMatch[2].replace(",", "")) * 12700;
    return { min: Math.round(min), max: Math.round(max) };
  }
  const singleDollar = cleaned.match(/\$\s*([\d.,]+)/);
  if (singleDollar) {
    const val = parseFloat(singleDollar[1].replace(",", "")) * 12700;
    return { min: Math.round(val), max: null };
  }

  // EUR
  const eurMatch = cleaned.match(/(\d[\d.,]+)\s*EUR/i);
  if (eurMatch) {
    const val = parseFloat(eurMatch[1].replace(",", "")) * 13500;
    return { min: Math.round(val), max: null };
  }

  // "Xmln" → X * 1_000_000
  const mlnMatch = cleaned.match(/([\d.]+)\s*mln/i);
  if (mlnMatch) {
    const val = parseFloat(mlnMatch[1]) * 1_000_000;
    return { min: Math.round(val), max: null };
  }

  // Range: "3000000 – 5000000" yoki "3000000-5000000"
  const rangeMatch = cleaned.match(/([\d]{4,})[^\d]+([\d]{4,})/);
  if (rangeMatch) {
    const a = parseInt(rangeMatch[1]);
    const b = parseInt(rangeMatch[2]);
    if (!isNaN(a) && !isNaN(b)) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }

  // Single number
  const single = cleaned.match(/[\d]{4,}/);
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

  if (/suhbat|kelish|договор|negotiable|обговор|kelishiladi/i.test(salary)) {
    return { salary, salaryMin: null, salaryMax: null };
  }

  const { min, max } = parseSalaryNumber(salary);
  return { salary, salaryMin: min, salaryMax: max };
}

function parseWorkType(text: string): "remote" | "office" | "hybrid" | null {
  const lower = text.toLowerCase();
  const isRemote = /\bremote\b|удалённ|masofaviy|uzoqdan|масофав|online\s*ish|onlayn/i.test(lower);
  const isOffice = /\boffice\b|ofis|оффис|на\s*месте|offline|offlayn|oflayn/i.test(lower);
  const isHybrid = /hybrid|gibrid|aralash|гибрид/i.test(lower);

  if (isHybrid) return "hybrid";
  if (isRemote && isOffice) return "hybrid";
  if (isRemote) return "remote";
  if (isOffice) return "office";
  return null;
}

function parseLevel(text: string): "junior" | "middle" | "senior" | null {
  // Birinchi senior tekshiramiz (chunk da middle bo'lishi mumkin)
  if (/\bsenior\b|\bsr\.?\b/i.test(text)) return "senior";
  if (/\bmiddle\+?\b|\bmid\b/i.test(text)) return "middle";
  if (/\bjunior\b|\bjr\.?\b|\bintern\b|\bstajyor\b/i.test(text)) return "junior";
  return null;
}

function parsePhone(text: string): string | null {
  // +998 XX XXX XX XX formatlar
  const m = text.match(/((?:\+?998|8)[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/);
  if (!m) return null;
  return m[1].replace(/[\s\-]/g, "").replace(/^8/, "+998");
}

function parseTelegramContact(text: string): string | null {
  // "Telegram: @username" yoki "Murojaat: @username" dan olish
  const labeled = text.match(
    /(?:telegram|murojaat|kontakt|aloqa|связь|контакт)[^\n@]{0,30}@([A-Za-z0-9_]{3,32})/i,
  );
  if (labeled) return `@${labeled[1]}`;

  // Oddiy @mention
  const plain = text.match(/@([A-Za-z0-9_]{3,32})/);
  return plain ? `@${plain[1]}` : null;
}

function parseLocation(text: string): string | null {
  // Label'dan olish
  const raw = extractAfterLabel(text, ...LOCATION_LABELS);
  if (raw) {
    const cleaned = stripEmoji(raw)
      .split(/[\n,]/)[0]
      .trim();
    // City normalization
    const lower = cleaned.toLowerCase();
    for (const [key, val] of Object.entries(UZBEK_CITIES_MAP)) {
      if (lower.includes(key)) return val;
    }
    return cleaned || null;
  }

  // Matndan city qidirish
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(UZBEK_CITIES_MAP)) {
    const re = new RegExp(`\\b${key}\\b`, "i");
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
  const mdMatch = text.match(/^#\s+(.+)/m);
  if (mdMatch) return stripEmoji(mdMatch[1]).trim();

  // 2. "Позиция: ..." yoki "Pozitsiya: ..."
  const posMatch = extractAfterLabel(text, ...TITLE_LABELS);
  if (posMatch) return stripEmoji(posMatch.split("\n")[0]).trim();

  // 3. Birinchi qator — "Xodim kerak:", "XXX dasturchi kerak" kabi
  const firstLine = stripEmoji(text.split("\n")[0]).trim();
  if (
    firstLine.length > 4 &&
    firstLine.length < 120 &&
    /kerak|вакансия|vacancy|developer|dasturchi|mutaxassis|specialist|manager|dizayner|designer|operator|ustoz|o'qituvchi/i.test(
      firstLine,
    )
  ) {
    return firstLine;
  }

  // 4. "ВАКСАНИЯ ..." yoki "ВАКАНСИЯ ..." kabi bosh harf satri
  const capsMatch = text.match(
    /^([A-ZА-ЯЁ\s]{5,80})\n/m,
  );
  if (capsMatch) {
    const candidate = stripEmoji(capsMatch[1]).trim();
    if (candidate.length > 4) return candidate;
  }

  return null;
}

// ─── Vacancy detector ─────────────────────────────────────────────────────────

/** Bu matn vakansiya yoki rezyume ekanini aniqlaydi */
function isVacancyOrResume(text: string): boolean {
  return (
    // Vakansiya belgilari
    /kerak|vacancy|вакансия|xodim\s*kerak|ish\s*o.rni|ishga\s*qabul|#vakansiya|#ish/i.test(text) ||
    // Rezyume belgilari
    /#резюме|#resume|rezyume|резюме|позиция:|ожидания по зарплате/i.test(text) ||
    // Umumiy belgilar
    /developer|dasturchi|mutaxassis|specialist|manager|dizayner|operator|ustoz|o'qituvchi|учитель|мастер/i.test(text) ||
    // Maosh/ish sharoitlari bo'lsa
    (/(maosh|зарплата|salary)/i.test(text) && /(talablar|требования|requirements|vazifalar)/i.test(text))
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseVacancy(text: string): ParsedVacancy | null {
  if (!text || text.trim().length < 30) return null;
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
    telegramContact: parseTelegramContact(text),
    phone: parsePhone(text),
    workType: parseWorkType(text),
    level: parseLevel(text),
    jobType,
    isActive: parseIsActive(text),
  };
}
