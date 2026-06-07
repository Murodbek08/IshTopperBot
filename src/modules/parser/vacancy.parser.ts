/**
 * VACANCY PARSER — O'zbekiston 47 ta Telegram kanal uchun optimallashtirilgan
 *
 * Qo'llab-quvvatlanadigan formatlar:
 *   A. Emoji-labeled  : 🏢 Kompaniya: ..., 💰 Maosh: ...
 *   B. Markdown H1/H2 : # Senior React Developer kerak
 *   C. Plain labels   : Pozitsiya: ..., Требования: ...
 *   D. Free-form UZ   : React dasturchi kerak, tajriba 1+ yil
 *   E. Free-form RU   : Ищем backend разработчика...
 *   F. Hashtag-heavy  : #React #NodeJS #vacancy
 *   G. Resume         : #резюме Pozitsiya: ...
 *   H. English-only   : Senior Backend Engineer needed
 *   I. Mixed UZ/RU/EN : Ko'p kanallarda aralash til
 */

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

// ─── Technology catalog ───────────────────────────────────────────────────────
// Format: canonical_name → [aliases_lowercase]
// MUHIM: barcha aliaslar normalize qilingan matnda (" word " space bilan) qidiriladi
const TECH_ALIASES: Record<string, string[]> = {
  // ── Frontend frameworks ────────────────────────────────────────────────────
  "React":           ["react"],                               // " react " → "reactjs" miss bo'lmaydi chunki normalize qilinadi
  "Vue.js":          ["vue.js", "vuejs", " vue "],
  "Angular":         [" angular "],                           // space: "triangular" ni miss qilmasin
  "Next.js":         ["next.js", "nextjs", " nextjs "],
  "Nuxt.js":         ["nuxt.js", "nuxtjs", " nuxt "],
  "Svelte":          ["svelte", "sveltekit"],
  "Astro":           [" astro "],
  "Remix":           [" remix "],

  // ── JS/TS ──────────────────────────────────────────────────────────────────
  "JavaScript":      [" javascript ", " js "],               // space: "jsx" ni to'sqinlik qilsin
  "TypeScript":      [" typescript ", " ts "],
  "JSX":             [" jsx "],
  "TSX":             [" tsx "],

  // ── CSS & UI ───────────────────────────────────────────────────────────────
  "HTML":            [" html ", "html5"],
  "CSS":             [" css ", "css3"],
  "SCSS":            ["scss", " sass "],
  "Tailwind CSS":    ["tailwind", "tailwindcss"],
  "Bootstrap":       ["bootstrap"],
  "Material UI":     ["material ui", "material-ui", " mui "],
  "Ant Design":      ["ant design", "antd"],
  "Chakra UI":       ["chakra ui", "chakra"],

  // ── State management ───────────────────────────────────────────────────────
  "Redux":           ["redux"],
  "Zustand":         ["zustand"],
  "MobX":            ["mobx"],
  "Recoil":          ["recoil"],

  // ── Build tools ────────────────────────────────────────────────────────────
  "Webpack":         ["webpack"],
  "Vite":            [" vite "],
  "Babel":           [" babel "],

  // ── Node / Backend JS ──────────────────────────────────────────────────────
  "Node.js":         ["node.js", "nodejs", " node "],
  "Express.js":      ["express.js", " express "],
  "NestJS":          ["nestjs", "nest.js", " nestjs ", " nest "],
  "Fastify":         ["fastify"],
  "Hono":            [" hono "],
  "tRPC":            ["trpc"],

  // ── Python ────────────────────────────────────────────────────────────────
  "Python":          ["python"],
  "Django":          ["django"],
  "FastAPI":         ["fastapi"],
  "Flask":           [" flask "],
  "Celery":          ["celery"],
  "Pydantic":        ["pydantic"],
  "SQLAlchemy":      ["sqlalchemy"],
  "aiohttp":         ["aiohttp"],
  "aiogram":         ["aiogram"],                             // Telegram bot framework

  // ── PHP ───────────────────────────────────────────────────────────────────
  "PHP":             [" php "],
  "Laravel":         ["laravel"],
  "Symfony":         ["symfony"],
  "WordPress":       ["wordpress"],

  // ── Java ──────────────────────────────────────────────────────────────────
  "Java":            [" java "],                              // space: "javascript" ni to'sqinlik
  "Spring Boot":     ["spring boot", "spring mvc", " spring "],
  "Maven":           [" maven "],
  "Gradle":          ["gradle"],
  "Hibernate":       ["hibernate"],

  // ── C# / .NET ─────────────────────────────────────────────────────────────
  "C#":              [" c# ", "csharp", "c sharp"],
  ".NET":            [" .net ", "asp.net", "dotnet", ".net core", ".net 6", ".net 7", ".net 8"],
  "Blazor":          ["blazor"],
  "SignalR":         ["signalr"],

  // ── Go ────────────────────────────────────────────────────────────────────
  "Go":              [" golang ", " go "],                    // " go " — "django"/"mongo" ni miss
  "Gin":             [" gin "],
  "Echo":            [" echo "],

  // ── Rust ──────────────────────────────────────────────────────────────────
  "Rust":            [" rust "],
  "Actix":           ["actix"],

  // ── Ruby ──────────────────────────────────────────────────────────────────
  "Ruby on Rails":   ["ruby on rails", " rails ", " ruby "],

  // ── Kotlin / Android ──────────────────────────────────────────────────────
  "Kotlin":          ["kotlin"],
  "Jetpack Compose": ["jetpack compose", " jetpack "],

  // ── Swift / iOS ───────────────────────────────────────────────────────────
  "Swift":           [" swift "],
  "SwiftUI":         ["swiftui"],
  "Objective-C":     ["objective-c", "objc"],

  // ── Mobile ────────────────────────────────────────────────────────────────
  "Flutter":         ["flutter"],
  "Dart":            [" dart "],
  "React Native":    ["react native"],
  "Expo":            [" expo "],
  "Xamarin":         ["xamarin"],
  "Ionic":           [" ionic "],
  "Android":         ["android"],
  "iOS":             [" ios "],

  // ── Databases ─────────────────────────────────────────────────────────────
  "PostgreSQL":      ["postgresql", "postgres"],
  "MySQL":           ["mysql"],
  "MongoDB":         ["mongodb", " mongo "],
  "Redis":           ["redis"],
  "SQLite":          ["sqlite"],
  "Elasticsearch":   ["elasticsearch", " elastic "],
  "Firebase":        ["firebase"],
  "Supabase":        ["supabase"],
  "DynamoDB":        ["dynamodb"],
  "ClickHouse":      ["clickhouse"],
  "Cassandra":       ["cassandra"],
  "CouchDB":         ["couchdb"],
  "SQL":             [" sql "],                               // spaces: avoid "postgresql" false match

  // ── ORM / DB tools ────────────────────────────────────────────────────────
  "Prisma":          ["prisma"],
  "TypeORM":         ["typeorm"],
  "Sequelize":       ["sequelize"],
  "Drizzle":         ["drizzle"],

  // ── DevOps / Cloud ────────────────────────────────────────────────────────
  "Docker":          ["docker"],
  "Kubernetes":      ["kubernetes", " k8s "],
  "AWS":             [" aws ", "amazon web services"],
  "GCP":             [" gcp ", "google cloud platform"],
  "Azure":           ["azure"],
  "CI/CD":           ["ci/cd", " cicd ", "github actions", "gitlab ci", "gitlab-ci"],
  "Jenkins":         ["jenkins"],
  "Terraform":       ["terraform"],
  "Ansible":         ["ansible"],
  "Nginx":           ["nginx"],
  "Linux":           ["linux", "ubuntu", "debian", "centos", "unix"],
  "Git":             [" git "],
  "GitHub":          ["github"],
  "GitLab":          ["gitlab"],
  "Bitbucket":       ["bitbucket"],
  "Vercel":          ["vercel"],
  "Netlify":         ["netlify"],

  // ── Data / ML / AI ────────────────────────────────────────────────────────
  "TensorFlow":      ["tensorflow"],
  "PyTorch":         ["pytorch"],
  "Pandas":          ["pandas"],
  "NumPy":           ["numpy"],
  "Apache Spark":    ["apache spark", "pyspark", " spark "],
  "Airflow":         ["airflow"],
  "OpenCV":          ["opencv"],
  "scikit-learn":    ["scikit-learn", "sklearn"],
  "LangChain":       ["langchain"],
  "OpenAI API":      ["openai api", "chatgpt api", "gpt-4", "gpt-3"],
  "Hugging Face":    ["hugging face", "huggingface"],
  "Jupyter":         ["jupyter"],

  // ── API / Protocols ───────────────────────────────────────────────────────
  "REST API":        ["rest api", "restful", " rest "],
  "GraphQL":         ["graphql"],
  "WebSocket":       ["websocket", "socket.io", " ws "],
  "gRPC":            [" grpc "],
  "Swagger":         ["swagger", "openapi"],

  // ── Architecture ──────────────────────────────────────────────────────────
  "Microservices":   ["microservices", "микросервис", "microsevices"],
  "RabbitMQ":        ["rabbitmq"],
  "Kafka":           [" kafka "],
  "Redis Pub/Sub":   ["pub/sub"],
  "WebRTC":          ["webrtc"],

  // ── Design / Creative ─────────────────────────────────────────────────────
  "Figma":           ["figma"],
  "Adobe XD":        ["adobe xd"],
  "Photoshop":       ["photoshop"],
  "Illustrator":     ["illustrator"],
  "Premiere Pro":    ["premiere pro", "premiere"],
  "After Effects":   ["after effects"],
  "DaVinci Resolve": ["davinci resolve", "davinci"],
  "Blender":         ["blender"],
  "Sketch":          ["sketch"],
  "InVision":        ["invision"],
  "Framer":          [" framer "],

  // ── Marketing / Analytics ─────────────────────────────────────────────────
  "Google Ads":      ["google ads", "google adwords"],
  "Meta Ads":        ["meta ads", "facebook ads", "instagram ads"],
  "SEO":             [" seo "],
  "SMM":             [" smm "],
  "Yandex Metrika":  ["yandex metrika", "yandex.metrica"],
  "Google Analytics":["google analytics"],
  "Tableau":         ["tableau"],
  "Power BI":        ["power bi"],

  // ── Project management ────────────────────────────────────────────────────
  "Jira":            [" jira "],
  "Confluence":      ["confluence"],
  "Trello":          ["trello"],
  "Notion":          ["notion"],
  "Scrum":           [" scrum "],
  "Agile":           [" agile "],

  // ── Other ─────────────────────────────────────────────────────────────────
  "1C":              [" 1c ", " 1с "],
  "SAP":             [" sap "],
  "C++":             ["c++"],
  "C":               [" c/c++ ", " c lang "],
  "Blockchain":      ["blockchain"],
  "Web3":            ["web3"],
  "Solidity":        ["solidity"],
  "Telegram Bot":    ["telegram bot", "aiogram", "telebot", "python-telegram"],
};

// ─── City map ─────────────────────────────────────────────────────────────────
const CITY_MAP: Array<[RegExp, string]> = [
  [/toshkent|tashkent|ташкент/i,              "Toshkent"],
  [/samarqand|самарканд|samarkand/i,          "Samarqand"],
  [/buxoro|бухар/i,                           "Buxoro"],
  [/namangan|наманган/i,                      "Namangan"],
  [/andijon|андижан/i,                        "Andijon"],
  [/farg.ona|фергана|fergana/i,               "Farg'ona"],
  [/qashqadaryo|qarshi|карши|кашкадарья/i,   "Qarshi"],
  [/nukus|нукус/i,                            "Nukus"],
  [/termiz|термез/i,                          "Termiz"],
  [/urganch|xorazm|ургенч|хорезм/i,          "Urganch"],
  [/navoiy|навои/i,                           "Navoiy"],
  [/jizzax|джизак/i,                          "Jizzax"],
  [/guliston|сырдарья|гулистан/i,             "Guliston"],
  [/qo.qon|коканд|kokand/i,                  "Qo'qon"],
  [/surxondaryo|сурхандарья/i,               "Termiz"],
];

// ─── Label groups (UZ / RU / EN) ─────────────────────────────────────────────
const L_TITLE    = [
  "Pozitsiya","Позиция","Lavozim","Должность","Vakansiya","Title","Role",
  "Вакансия","Bo'sh lavozim","Ish o'rni","Kerak","Talab","Soha",
];
const L_COMPANY  = [
  "Kompaniya","Компания","Idora","Firma","Ish joyi","Работодатель",
  "Агентство","Employer","Tashkilot","Корпорация","Studio","Agentstvo",
];
const L_LOCATION = [
  "Hudud","Joylashuv","Shahar","Manzil","Регион","Город","Локация",
  "Адрес","Location","Местоположение","Viloyat","Joyi","Ish joyi",
];
const L_SALARY   = [
  "Maosh","Ish haqi","Oylik","Зарплата","Salary","Оплата","Daromad",
  "Доход","Вилка","Ожидания","Budget","Byudjet","To'lov","Kompensatsiya",
  "Compensation","ZP","ЗП","Maoshi","Pay",
];
const L_TECH     = [
  "Stack","Стек","Texnologiya","Технологии","Skills","Навыки",
  "Ko.nikmalar","Talablar","Требования","Tools","Requirements",
  "Tech","Used","Framework","Instrumentlar","Bilim","Знания",
];
const L_CONTACT  = [
  "Murojaat","Kontakt","Aloqa","Bog.lan","Связь","Контакт","Telegram",
  "CV yuboring","Резюме отправить","Apply","HR","Рекрутер","Rezyume",
  "Portfolio","CV","Aloqa uchun","Yuboring","Отправьте","Yuborish",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Emoji, markdown, extra whitespace tozalash */
function cleanLine(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27FF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/[✅❌⚠️📌📍💼⚡🔧🎯📋👤🛠🔰💰🏢📞🌐📨✔️➡️👉🔹🔸▪️•]/g, "")
    .replace(/\*+/g, "")
    .replace(/_{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Label'dan keyingi qiymatni qaytaradi */
function extractLabel(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(?:^|\\n)[^\\n]{0,20}${esc}[^\\n]{0,8}[:\\-–—][ \\t]*(.+)`,
      "im",
    );
    const m = text.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

// ─── VACANCY SCORE — asosiy detection mexanizmi ───────────────────────────────
/**
 * Ball tizimi. >= 2 bo'lsa vakansiya/rezyume hisoblanadi.
 * O'zbekiston kanallarining barcha formatlarini ushlash uchun keng yondashuv.
 */
function vacancyScore(text: string): number {
  let score = 0;
  const t = text.toLowerCase();

  // ── Aniq vakansiya/rezyume belgilari (katta ball) ─────────────────────────
  if (/kerak\b|вакансия|vacancy|#ish\b|#vakansiya|ishga\s*qabul/i.test(t))       score += 4;
  if (/#резюме|#resume|rezyume|резюме/i.test(t))                                  score += 4;
  if (/ish\s*e.lon|ish\s*o.rni|xodim\s*kerak|сотрудник\s*нужен/i.test(t))        score += 4;
  if (/qidirilmoqda|izlayapmiz|taklif\s*qilamiz|qabul\s*qilamiz/i.test(t))       score += 4;
  if (/bo.sh\s*o.rin|bo.sh\s*ish|ishchi\s*qidirilyapti/i.test(t))                score += 4;
  if (/hiring|we.re\s*hiring|we\s*are\s*hiring|looking\s*for\s*a?\s*(dev|eng)/i.test(t)) score += 4;
  if (/join\s*(our|us|team)|open\s*position|job\s*opening/i.test(t))              score += 3;
  if (/набор|открыта\s*вакансия|открытая\s*вакансия|приглашаем/i.test(t))        score += 4;

  // ── Kasb unvonlari ────────────────────────────────────────────────────────
  if (/developer|dasturchi|разработчик|programmer|кодер/i.test(t))               score += 3;
  if (/designer|dizayner|дизайнер|ui.?ux/i.test(t))                              score += 3;
  if (/manager|менеджер|analyst|аналитик/i.test(t))                              score += 2;
  if (/devops|sysadmin|системный\s*администратор|sysops/i.test(t))               score += 3;
  if (/tester|qa\b|quality\s*assurance|тестировщик/i.test(t))                    score += 3;
  if (/specialist|mutaxassis|специалист/i.test(t))                               score += 2;
  if (/fullstack|full.stack|frontend|back.?end|mobile\s*dev/i.test(t))           score += 3;
  if (/\b(junior|middle|senior|intern|trainee|stajyor|стажёр|lead)\b/i.test(t))  score += 2;
  if (/engineer|muhandis|инженер/i.test(t))                                      score += 2;

  // ── Maosh belgilari ───────────────────────────────────────────────────────
  if (/maosh|зарплата|salary|oylik|оплата|ish\s*haqi/i.test(t))                  score += 2;
  if (/\$\s*\d+|\d+\s*(usd|uzs|so.m|sum|млн|mln|ming)/i.test(t))               score += 2;
  if (/от\s*\d|\d+\s*[-–]\s*\d+\s*(млн|mln|\$|usd)/i.test(t))                  score += 2;
  if (/kelishiladi|обговорим|negotiable|contract|по\s*договору/i.test(t))        score += 1;

  // ── Talablar / texnologiyalar bo'limi ─────────────────────────────────────
  if (/talablar|требования|requirements|skills:|stack:/i.test(t))                score += 2;
  if (/#[a-z]{2,}(js|py|ts|net|sql)\b/i.test(t))                                score += 2;
  if (/tajriba\s*\d|\d\+\s*yil|опыт\s*\d|\d\+\s*лет|experience\s*\d/i.test(t)) score += 2;

  // ── Kontakt ma'lumotlari ──────────────────────────────────────────────────
  if (/@[A-Za-z0-9_]{3,32}/.test(text))                                          score += 2;
  if (/\+?998\d{9}/.test(text))                                                  score += 2;
  if (/cv\s*yuboring|rezyume\s*yuboring|cv\s*qabul|portfolio\s*yubor/i.test(t)) score += 1;
  if (/apply\s*(here|now|via|to)|send\s*(cv|resume|portfolio)/i.test(t))        score += 1;

  // ── Ish sharoiti ─────────────────────────────────────────────────────────
  if (/remote|masofaviy|офис|ofis\b|uzoqdan|onlayn/i.test(t))                    score += 1;
  if (/full.?time|part.?time|to.liq\s*stavka|yarim\s*stavka/i.test(t))           score += 1;
  if (/murojaat|резюме\s*отправить|apply/i.test(t))                              score += 1;

  return score;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseJobType(text: string): "vacancy" | "resume" {
  if (/#резюме|#resume|rezyume|резюме|позиция:|ожидания|cv qabul|мое резюме/i.test(text)) {
    return "resume";
  }
  return "vacancy";
}

function parseIsActive(text: string): boolean {
  if (/#noaktiv|#inactive|#closed|закрыто|yopildi|#yopildi|filled|закрытая/i.test(text)) {
    return false;
  }
  return true;
}

/**
 * Texnologiyalarni aniqlash — 47 kanal uchun optimallashtirilgan.
 *
 * Algoritm:
 * 1. Matnni normalize qilamiz (tinish belgilari → bo'shliq)
 * 2. Hashtag'larni alohida qo'shamiz
 * 3. Har bir alias uchun includes() tekshiruvi
 */
function parseTechnologies(text: string): string[] {
  const found = new Set<string>();

  // Hashtag'larni ajratib olamiz: #ReactJS → " ReactJS "
  const hashtags = (text.match(/#([A-Za-z0-9_.+]+)/g) ?? [])
    .map((h) => ` ${h.slice(1)} `)
    .join(" ");

  // Normalize:
  // - tinish belgilari → bo'shliq (shuning uchun "java," → "java ", "js." → "js ")
  // - bosh-oxirga bo'shliq qo'shamiz (" java " alias end-of-text ni ushlaydi)
  const searchIn = ` ${text} ${hashtags} `
    .toLowerCase()
    .replace(/[,;:()[\]{}/\\!?'"«»·•\-]/g, " ")
    .replace(/\s+/g, " ");

  for (const [canonical, aliases] of Object.entries(TECH_ALIASES)) {
    for (const alias of aliases) {
      if (searchIn.includes(alias)) {
        found.add(canonical);
        break;
      }
    }
  }

  return Array.from(found).sort();
}

function parseSalaryNumber(raw: string): { min: number | null; max: number | null } {
  const s = raw.replace(/\s/g, "").toLowerCase();

  // "от X до Y" (Russian range)
  const ruRange = raw.match(/от\s*([\d\s,.]+?)\s*до\s*([\d\s,.]+)/i);
  if (ruRange) {
    const a = parseNum(ruRange[1]);
    const b = parseNum(ruRange[2]);
    if (a && b) return { min: Math.min(a, b), max: Math.max(a, b) };
  }

  // "X–Y mln" yoki "X-Y mln" (O'zbek format: "3–5 mln so'm")
  const mlnRange = raw.match(/([\d.]+)\s*[-–—]\s*([\d.]+)\s*m(?:ln|illion|лн)/i);
  if (mlnRange) {
    return {
      min: Math.round(parseFloat(mlnRange[1]) * 1_000_000),
      max: Math.round(parseFloat(mlnRange[2]) * 1_000_000),
    };
  }

  // "X mln" yoki "X млн"
  const mln = raw.match(/([\d.]+)\s*m(?:ln|illion|лн)/i);
  if (mln) {
    return { min: Math.round(parseFloat(mln[1]) * 1_000_000), max: null };
  }

  // "$X–$Y" yoki "$X - Y"
  const usdRange = raw.match(/\$\s*([\d,]+)\s*[-–—]\s*\$?\s*([\d,]+)/);
  if (usdRange) {
    const rate = 12800; // 1 USD ≈ 12800 UZS (2025)
    return {
      min: Math.round(parseFloat(usdRange[1].replace(",", "")) * rate),
      max: Math.round(parseFloat(usdRange[2].replace(",", "")) * rate),
    };
  }

  // "$X" yoki "X$" yoki "X USD"
  const usd = raw.match(/\$\s*([\d,]+(?:\.\d+)?)|(\d+(?:,\d+)?)\s*(?:usd|\$)/i);
  if (usd) {
    const val = parseFloat((usd[1] ?? usd[2]).replace(",", ""));
    return { min: Math.round(val * 12800), max: null };
  }

  // "X EUR"
  const eur = raw.match(/([\d,.]+)\s*eur/i);
  if (eur) {
    return { min: Math.round(parseFloat(eur[1].replace(",", "")) * 13800), max: null };
  }

  // "X ming so'm" yoki "X 000 so'm"
  const ming = raw.match(/([\d]+)\s*ming/i);
  if (ming) {
    return { min: parseInt(ming[1]) * 1000, max: null };
  }

  // "X 000 000" yoki "X000000" (so'm to'g'ridan-to'g'ri)
  const bigNum = s.match(/(\d[\d\s]{6,})/);
  if (bigNum) {
    const v = parseInt(bigNum[1].replace(/\s/g, ""));
    if (!isNaN(v) && v >= 500_000 && v <= 500_000_000) {
      return { min: v, max: null };
    }
  }

  // X000 - Y000 range (so'm)
  const somRange = s.match(/(\d{3,})\s*[-–—]\s*(\d{3,})/);
  if (somRange) {
    const a = parseInt(somRange[1]);
    const b = parseInt(somRange[2]);
    if (!isNaN(a) && !isNaN(b) && a > 0 && b > 0) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }

  // Yagona son
  const single = raw.match(/([\d][\d\s,.]*[\d])/);
  if (single) {
    const v = parseInt(single[1].replace(/[\s,]/g, ""));
    if (!isNaN(v) && v > 100 && v < 2_000_000_000) return { min: v, max: null };
  }

  return { min: null, max: null };
}

function parseNum(s: string): number | null {
  const cleaned = s.replace(/[\s,]/g, "");
  const n = parseInt(cleaned);
  return isNaN(n) ? null : n;
}

function parseSalary(text: string) {
  const raw = extractLabel(text, L_SALARY);
  if (!raw) return { salary: null, salaryMin: null, salaryMax: null };

  const salary = cleanLine(raw).split("\n")[0].trim();
  if (/kelish|suhbat|muhokama|договор|negotiable|обговор|обсуждается|по\s*договору|ko.rib|ko'rib/i.test(salary)) {
    return { salary, salaryMin: null, salaryMax: null };
  }

  const { min, max } = parseSalaryNumber(salary);
  return { salary, salaryMin: min, salaryMax: max };
}

function parseWorkType(text: string): "remote" | "office" | "hybrid" | null {
  const t = text.toLowerCase();
  const remote  = /\bremote\b|удалённ|масофавий|masofaviy|uzoqdan|distantsion|онлайн|onlayn|full\s*remote|to.liq\s*remote/i.test(t);
  const office  = /\boffice\b|офис|ofisda|на\s*месте|offline|offlayn|onsite|on.?site/i.test(t);
  const hybrid  = /hybrid|гибрид|gibrid|aralash|mixed|remote.{0,20}ofis|ofis.{0,20}remote/i.test(t);

  if (hybrid || (remote && office)) return "hybrid";
  if (remote)  return "remote";
  if (office)  return "office";
  return null;
}

function parseLevel(text: string): "junior" | "middle" | "senior" | null {
  const t = text.toLowerCase();

  // Senior belgilari
  if (/\bsenior\b|\bsr\b|\btech\s*lead\b|\blead\s*dev|\bпрофи\b|5\+\s*(yil|лет|year)/i.test(text)) return "senior";
  // Middle belgilari
  if (/\bmiddle\+?\b|\bmid\b|\bstrong\s*junior\b|\bуверенный\s*junior\b|3\+\s*(yil|лет|year)/i.test(text)) return "middle";
  // Junior / Intern belgilari
  if (/\bjunior\b|\bjr\b|\bintern\b|\bстажёр\b|\bstajyor\b|\btrainee\b|\bboshlang.ich/i.test(text)) return "junior";

  // Tajriba yillari bo'yicha taxminiy daraja
  const expMatch = text.match(/(\d+)\s*\+?\s*(yil|лет|год|year)/i);
  if (expMatch) {
    const years = parseInt(expMatch[1]);
    if (years >= 4) return "senior";
    if (years >= 2) return "middle";
    if (years >= 0) return "junior";
  }

  return null;
}

function parsePhone(text: string): string | null {
  const m = text.match(
    /(\+?\s*9\s*9\s*8[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/,
  );
  if (!m) return null;
  return m[1].replace(/[\s\-]/g, "").replace(/^998/, "+998").replace(/^\+?998/, "+998");
}

function parseTelegramContact(text: string, channelName?: string): string | null {
  const chLower = (channelName ?? "").toLowerCase();

  // 1. Labeled kontakt — eng ishonchli
  const labeled = text.match(
    /(?:murojaat|kontakt|aloqa|bog.lan|связь|контакт|telegram|hr|apply|cv\s*yubor|rezyume|резюме\s*отправ|yuboring|send\s*cv|portfolio)[^\n@]{0,60}@([A-Za-z0-9_]{3,32})/i,
  );
  if (labeled) return `@${labeled[1]}`;

  // 2. Arrow / emoji kontakt ko'rsatkichlari
  const arrow = text.match(/(?:→|➡️|👉|📨|✉️|📩)[^\n@]{0,25}@([A-Za-z0-9_]{3,32})/);
  if (arrow) return `@${arrow[1]}`;

  // 3. "Kontakt: @username" yoki "HR: @username" formatlar
  const inline = text.match(
    /(?:^|\n)[^\n]{0,15}(?:kontakt|hr|муроjaat|aloqa|cv|rezyume)[^\n@]{0,30}@([A-Za-z0-9_]{3,32})/im,
  );
  if (inline) return `@${inline[1]}`;

  // 4. Barcha @mention — kanallar va botlarni olib tashlab birinchisini olamiz
  const all = [...text.matchAll(/@([A-Za-z0-9_]{3,32})/g)].map((m) => m[1]);
  for (const handle of all) {
    const h = handle.toLowerCase();
    if (h === chLower) continue;
    if (h.endsWith("_channel") || h.endsWith("_kanal")) continue;
    if (/news|kanal|channel|official|admin(?!_)|jobs(?!_)|vacancy|vakans/.test(h)) continue;
    return `@${handle}`;
  }

  return null;
}

function parseLocation(text: string): string | null {
  // 1. Label'dan
  const raw = extractLabel(text, L_LOCATION);
  if (raw) {
    const line = cleanLine(raw).split(/[\n,/]/)[0].trim();
    for (const [re, city] of CITY_MAP) {
      if (re.test(line)) return city;
    }
    if (line.length > 1 && line.length < 60) return line;
  }

  // 2. Matndan city qidirish
  for (const [re, city] of CITY_MAP) {
    if (re.test(text)) return city;
  }

  return null;
}

function parseCompany(text: string): string | null {
  const raw = extractLabel(text, L_COMPANY);
  if (!raw) return null;
  const cleaned = cleanLine(raw).split(/[\n,]/)[0].trim().slice(0, 100);
  return cleaned || null;
}

function parseTitle(text: string): string | null {
  // 1. Markdown # Header
  const md = text.match(/^#{1,3}\s+(.+)/m);
  if (md) return cleanLine(md[1]).trim().slice(0, 150);

  // 2. Label'dan (Pozitsiya:, Вакансия:, Role: ...)
  const labeled = extractLabel(text, L_TITLE);
  if (labeled) return cleanLine(labeled.split("\n")[0]).trim().slice(0, 150);

  // 3. "Kerak: Senior React Developer" formati
  const needsFormat = text.match(/^(?:kerak|вакансия|vacancy|hiring)[:\s!]+([^\n]{5,100})/im);
  if (needsFormat) return cleanLine(needsFormat[1]).trim().slice(0, 150);

  // 4. Birinchi 5 qatordan kasb unvonini qidirish
  const lines = text.split("\n");
  for (const line of lines.slice(0, 5)) {
    const c = cleanLine(line).trim();
    if (c.length < 5 || c.length > 160) continue;
    if (
      /kerak\b|вакансия|vacancy|developer|dasturchi|engineer|designer|dizayner|manager|analyst|devops|tester|\bqa\b|frontend|backend|fullstack|flutter|lead|junior|middle|senior|разработчик|дизайнер|менеджер/i.test(c)
    ) {
      return c;
    }
  }

  // 5. CAPS sarlavha (5+ belgi, harf bilan boshlanadi)
  const caps = text.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9\s]{4,80})\s*\n/m);
  if (caps) return cleanLine(caps[1]).trim().slice(0, 150);

  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseVacancy(
  text: string,
  channelName?: string,
): ParsedVacancy | null {
  if (!text || text.trim().length < 15) return null;

  const score = vacancyScore(text);
  if (score < 2) return null;

  const { salary, salaryMin, salaryMax } = parseSalary(text);

  return {
    title:           parseTitle(text),
    company:         parseCompany(text),
    location:        parseLocation(text),
    salary,
    salaryMin,
    salaryMax,
    technologies:    parseTechnologies(text),
    telegramContact: parseTelegramContact(text, channelName),
    phone:           parsePhone(text),
    workType:        parseWorkType(text),
    level:           parseLevel(text),
    jobType:         parseJobType(text),
    isActive:        parseIsActive(text),
  };
}
