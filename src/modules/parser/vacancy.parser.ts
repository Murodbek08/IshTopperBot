/**
 * SENIOR-LEVEL VACANCY PARSER
 *
 * Maqsad: 29 Telegram kanaldan kelgan BARCHA ish e'lonlarini ushlash.
 * Tamoyil: "shubhali bo'lsa — o'tkazib yubor, lekin null qaytarma".
 *
 * Qo'llab-quvvatlanadigan formatlar:
 *   A. Emoji-labeled:  🏢 Kompaniya: ..., 💰 Maosh: ...
 *   B. Markdown H1/H2: # Senior React Developer kerak
 *   C. Plain labels:   Pozitsiya: ..., Требования: ...
 *   D. Free-form:      Salom dasturchi izlayap, ...
 *   E. Hashtag-heavy:  #React #NodeJS #kerak
 *   F. Resume:         #резюме Позиция: ...
 *   G. Caps header:    ВАКАНСИЯ / DEVELOPER KERAK
 *   H. English-only:   Senior Backend Engineer needed
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
// Canonical name → aliases (all lowercase)
const TECH_ALIASES: Record<string, string[]> = {
  "React":         ["react", "reactjs", "react.js"],
  "Vue.js":        ["vue", "vuejs", "vue.js"],
  "Angular":       ["angular", "angularjs"],
  "Next.js":       ["next.js", "nextjs", "next js"],
  "Nuxt.js":       ["nuxt.js", "nuxtjs", "nuxt"],
  "JavaScript":    ["javascript", "js ", "js,", "js.", "js\n", "#js"],
  "TypeScript":    ["typescript", "ts ", "ts,", "ts.", "ts\n", "#ts"],
  "HTML":          ["html", "html5"],
  "CSS":           ["css", "css3"],
  "SCSS":          ["scss", "sass"],
  "Tailwind CSS":  ["tailwind", "tailwindcss"],
  "Bootstrap":     ["bootstrap"],
  "Redux":         ["redux", "redux toolkit", "rtk"],
  "Zustand":       ["zustand"],
  "MobX":          ["mobx"],
  "Svelte":        ["svelte", "sveltekit"],
  "jQuery":        ["jquery"],
  "Webpack":       ["webpack"],
  "Vite":          ["vite"],
  "Node.js":       ["node.js", "nodejs", "node js"],
  "Express.js":    ["express", "express.js"],
  "NestJS":        ["nestjs", "nest.js", "nest "],
  "Fastify":       ["fastify"],
  "Python":        ["python"],
  "Django":        ["django"],
  "FastAPI":       ["fastapi"],
  "Flask":         ["flask"],
  "PHP":           ["php"],
  "Laravel":       ["laravel"],
  "Symfony":       ["symfony"],
  "Java":          ["java "],                        // trailing space avoids "javascript"
  "Spring Boot":   ["spring boot", "spring"],
  "C#":            ["c#", "csharp"],
  ".NET":          [".net", "asp.net", "dotnet"],
  "Go":            [" go ", " golang "],              // spaces for isolation
  "Rust":          ["rust "],
  "Ruby on Rails": ["ruby on rails", "rails", "ruby"],
  "Kotlin":        ["kotlin"],
  "Scala":         ["scala"],
  "Elixir":        ["elixir"],
  "Flutter":       ["flutter"],
  "React Native":  ["react native"],
  "Swift":         ["swift"],
  "Android":       ["android"],
  "iOS":           ["ios"],
  "Dart":          ["dart"],
  "Jetpack Compose": ["jetpack compose", "jetpack"],
  "PostgreSQL":    ["postgresql", "postgres"],
  "MySQL":         ["mysql"],
  "MongoDB":       ["mongodb", "mongo"],
  "Redis":         ["redis"],
  "SQLite":        ["sqlite"],
  "Elasticsearch": ["elasticsearch", "elastic"],
  "Firebase":      ["firebase"],
  "Supabase":      ["supabase"],
  "DynamoDB":      ["dynamodb"],
  "ClickHouse":    ["clickhouse"],
  "SQL":           [" sql ", "\nsql\n", "sql,", "sql."],
  "NoSQL":         ["nosql"],
  "Prisma":        ["prisma"],
  "TypeORM":       ["typeorm"],
  "Sequelize":     ["sequelize"],
  "Hibernate":     ["hibernate"],
  "Docker":        ["docker"],
  "Kubernetes":    ["kubernetes", "k8s"],
  "AWS":           ["aws", "amazon web"],
  "GCP":           ["gcp", "google cloud"],
  "Azure":         ["azure"],
  "CI/CD":         ["ci/cd", "cicd"],
  "Jenkins":       ["jenkins"],
  "Terraform":     ["terraform"],
  "Ansible":       ["ansible"],
  "Nginx":         ["nginx"],
  "Linux":         ["linux", "ubuntu", "debian"],
  "Git":           ["git "],
  "GitHub":        ["github"],
  "GitLab":        ["gitlab"],
  "GitHub Actions":["github actions"],
  "Vercel":        ["vercel"],
  "TensorFlow":    ["tensorflow"],
  "PyTorch":       ["pytorch"],
  "Pandas":        ["pandas"],
  "NumPy":         ["numpy"],
  "Apache Spark":  ["apache spark", "pyspark", "spark"],
  "Airflow":       ["airflow"],
  "OpenCV":        ["opencv"],
  "scikit-learn":  ["scikit-learn", "sklearn"],
  "LangChain":     ["langchain"],
  "REST API":      ["rest api", "restful", "rest "],
  "GraphQL":       ["graphql"],
  "WebSocket":     ["websocket", "socket.io", "ws "],
  "gRPC":          ["grpc"],
  "Microservices": ["microservices", "microsevices"],
  "RabbitMQ":      ["rabbitmq"],
  "Kafka":         ["kafka"],
  "Figma":         ["figma"],
  "Adobe XD":      ["adobe xd"],
  "Photoshop":     ["photoshop", "adobe photoshop"],
  "Illustrator":   ["illustrator"],
  "Premiere Pro":  ["premiere pro", "premiere"],
  "After Effects": ["after effects"],
  "DaVinci Resolve": ["davinci resolve", "davinci"],
  "Google Ads":    ["google ads"],
  "Meta Ads":      ["meta ads", "facebook ads"],
  "SEO":           ["seo"],
  "Blockchain":    ["blockchain"],
  "Web3":          ["web3"],
  "Solidity":      ["solidity"],
  "1C":            ["1c "],
  "SAP":           ["sap"],
  "C++":           ["c++"],
};

// ─── City map ─────────────────────────────────────────────────────────────────
const CITY_MAP: Array<[RegExp, string]> = [
  [/toshkent|tashkent|ташкент/i,         "Toshkent"],
  [/samarqand|самарканд|samarkand/i,     "Samarqand"],
  [/buxoro|бухар/i,                      "Buxoro"],
  [/namangan|наманган/i,                 "Namangan"],
  [/andijon|андижан/i,                   "Andijon"],
  [/farg.ona|фергана|fergana/i,          "Farg'ona"],
  [/qarshi|карши/i,                      "Qarshi"],
  [/nukus|нукус/i,                       "Nukus"],
  [/termiz|термез/i,                     "Termiz"],
  [/urganch|ургенч/i,                    "Urganch"],
  [/navoiy|навои/i,                      "Navoiy"],
  [/jizzax|джизак/i,                     "Jizzax"],
  [/guliston|гулистан/i,                 "Guliston"],
  [/qo.qon|коканд|kokand/i,             "Qo'qon"],
];

// ─── Label groups ─────────────────────────────────────────────────────────────
const L_TITLE    = ["Pozitsiya","Позиция","Lavozim","Должность","Vakansiya","Title","Role","Вакансия"];
const L_COMPANY  = ["Kompaniya","Компания","Idora","Firma","Ish joyi","Работодатель","Агентство","Employer"];
const L_LOCATION = ["Hudud","Joylashuv","Shahar","Manzil","Регион","Город","Локация","Адрес","Location","Местоположение","Shahar"];
const L_SALARY   = ["Maosh","Ish haqi","Oylik","Зарплата","Salary","Оплата","Daromad","Доход","Вилка","Ожидания","Budget","Byudjet"];
const L_TECH     = ["Stack","Стек","Texnologiya","Технологии","Skills","Навыки","Ko.nikmalar","Talablar","Требования","Tools","Asboblar","Requirements","Tech","Used"];
const L_CONTACT  = ["Murojaat","Kontakt","Aloqa","Bog.lan","Связь","Контакт","Telegram","CV yuboring","Резюме отправить","Apply","HR","Рекрутер"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanLine(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27FF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/[✅❌⚠️📌📍💼⚡🔧🎯📋👤🛠🔰💰🏢📞🌐📨]/g, "")
    .replace(/\*+/g, "")
    .replace(/_{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Label'dan keyingi qiymatni qaytaradi */
function extractLabel(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // "Label:" yoki "Label —" yoki "Label -" formatlar
    const re = new RegExp(
      `(?:^|\\n)[^\\n]{0,15}${esc}[^\\n]{0,5}[:\\-–—][ \\t]*(.+)`,
      "im",
    );
    const m = text.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

// ─── VACANCY SCORE — asosiy detection mexanizmi ───────────────────────────────
/**
 * Ball tizimi. >= 2 bo'lsa vakansiya/rezyume deb hisoblaymiz.
 * Bu approach "kerak" so'zisiz ham ushlanadi.
 */
function vacancyScore(text: string): number {
  let score = 0;
  const t = text.toLowerCase();

  // Aniq vakansiya/rezyume belgilari (katta ball)
  if (/kerak\b|вакансия|vacancy|#ish\b|#vakansiya|ishga\s*qabul|bo.sh\s*ish|ishchi\s*kerak/i.test(t)) score += 4;
  if (/#резюме|#resume|rezyume|резюме/i.test(t))                            score += 4;
  if (/ish\s*e.lon|ish\s*o.rni|xodim\s*kerak|сотрудник\s*нужен|qidirilmoqda|izlanmoqda/i.test(t)) score += 4;

  // Kasb unvonlari
  if (/developer|dasturchi|engineer|инженер/i.test(t))                      score += 3;
  if (/designer|dizayner|дизайнер/i.test(t))                                score += 3;
  if (/manager|менеджер|analyst|аналитик|devops|tester|qa\b/i.test(t))      score += 3;
  if (/specialist|mutaxassis|специалист/i.test(t))                          score += 2;
  if (/fullstack|full.stack|frontend|backend|mobile\s+dev/i.test(t))        score += 3;
  if (/\b(junior|middle|senior|intern|lead)\b/i.test(t))                    score += 2;

  // Maosh belgilari
  if (/maosh|зарплата|salary|oylik|оплата/i.test(t))                       score += 2;
  if (/\$\s*\d+|\d+\s*(usd|uzs|so.m|млн|mln)/i.test(t))                   score += 2;
  if (/от\s*\d|\d+\s*[-–]\s*\d+\s*(млн|mln|\$)/i.test(t))                 score += 2;

  // Talablar/texnologiyalar bo'limi
  if (/talablar|требования|requirements|skills:|stack:/i.test(t))           score += 2;
  if (/#[a-z]{2,}(js|py|ts|net)\b/i.test(t))                               score += 2;

  // Kontakt ma'lumotlari
  if (/@[A-Za-z0-9_]{3,32}/.test(text))                                    score += 2;
  if (/\+?998\d{9}/.test(text))                                             score += 2;

  // O'zbek IT konteksti
  if (/tajriba|опыт\s*работы|experience/i.test(t))                         score += 1;
  if (/murojaat|резюме отправить|cv qabul|apply/i.test(t))                  score += 1;
  if (/remote|masofaviy|офис|ofis\b|uzoqdan\s*ishlash/i.test(t))           score += 1;
  if (/ish\s*vaqti|to.liq\s*stavka|yarim\s*stavka|part.?time|full.?time/i.test(t)) score += 1;

  return score;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseJobType(text: string): "vacancy" | "resume" {
  if (/#резюме|#resume|rezyume|резюме|позиция:|ожидания|cv qabul/i.test(text)) {
    return "resume";
  }
  return "vacancy";
}

function parseIsActive(text: string): boolean {
  if (/#noaktiv|#inactive|#closed|закрыто|yopildi/i.test(text)) return false;
  return true;
}

function parseTechnologies(text: string): string[] {
  const found = new Set<string>();

  // Qidirish maydoni: butun matn + hashtags
  const hashtags = (text.match(/#([A-Za-z0-9_.+]+)/g) ?? [])
    .map((h) => ` ${h.slice(1)} `)
    .join(" ");
  const searchIn = ` ${text} ${hashtags} `.toLowerCase();

  for (const [canonical, aliases] of Object.entries(TECH_ALIASES)) {
    for (const alias of aliases) {
      if (searchIn.includes(alias)) {
        found.add(canonical);
        break; // bitta match topilsa yetarli
      }
    }
  }

  return Array.from(found).sort();
}

function parseSalaryNumber(raw: string): { min: number | null; max: number | null } {
  const s = raw.replace(/\s/g, "").toLowerCase();

  // "от X до Y" format
  const ruRange = raw.match(/от\s*([\d\s,.]+?)\s*до\s*([\d\s,.]+)/i);
  if (ruRange) {
    const a = parseNum(ruRange[1]);
    const b = parseNum(ruRange[2]);
    if (a && b) return { min: Math.min(a, b), max: Math.max(a, b) };
  }

  // "$X-Y" yoki "$X – $Y"
  const usdRange = raw.match(/\$\s*([\d,]+)\s*[-–—]\s*\$?\s*([\d,]+)/);
  if (usdRange) {
    const rate = 12700;
    return {
      min: Math.round(parseFloat(usdRange[1].replace(",", "")) * rate),
      max: Math.round(parseFloat(usdRange[2].replace(",", "")) * rate),
    };
  }

  // "$X"
  const usd = raw.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (usd) {
    return { min: Math.round(parseFloat(usd[1].replace(",", "")) * 12700), max: null };
  }

  // "X EUR"
  const eur = raw.match(/([\d,.]+)\s*eur/i);
  if (eur) {
    return { min: Math.round(parseFloat(eur[1].replace(",", "")) * 13500), max: null };
  }

  // "Xmln" / "X mln" / "X–Y mln"
  const mlnRange = raw.match(/([\d.]+)\s*[-–—]\s*([\d.]+)\s*m(?:ln|illion|лн)/i);
  if (mlnRange) {
    return {
      min: Math.round(parseFloat(mlnRange[1]) * 1_000_000),
      max: Math.round(parseFloat(mlnRange[2]) * 1_000_000),
    };
  }
  const mln = raw.match(/([\d.]+)\s*m(?:ln|illion|лн)/i);
  if (mln) {
    return { min: Math.round(parseFloat(mln[1]) * 1_000_000), max: null };
  }

  // "X000 - Y000" (so'm)
  const somRange = s.match(/([\d]{3,})[^\\d]+([\d]{3,})/);
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
  if (/kelish|suhbat|muhokama|договор|negotiable|обговор|обсуждается|по\s*договору/i.test(salary)) {
    return { salary, salaryMin: null, salaryMax: null };
  }

  const { min, max } = parseSalaryNumber(salary);
  return { salary, salaryMin: min, salaryMax: max };
}

function parseWorkType(text: string): "remote" | "office" | "hybrid" | null {
  const t = text.toLowerCase();
  const remote  = /\bremote\b|удалённ|масофавий|masofaviy|uzoqdan|distantsion|онлайн|onlayn/i.test(t);
  const office  = /\boffice\b|офис|ofisda|на\s*месте|offline|offlayn/i.test(t);
  const hybrid  = /hybrid|гибрид|gibrid|aralash/i.test(t);

  if (hybrid || (remote && office)) return "hybrid";
  if (remote)  return "remote";
  if (office)  return "office";
  return null;
}

function parseLevel(text: string): "junior" | "middle" | "senior" | null {
  if (/\bsenior\b|\bsr\.\b|\btech\s*lead\b|\blead\b|\bпрофи\b/i.test(text))         return "senior";
  if (/\bmiddle\+?\b|\bmid\b|\bstrong\s*junior\b|\bуверенный\s*junior\b/i.test(text)) return "middle";
  if (/\bjunior\b|\bjr\.\b|\bintern\b|\bстажёр\b|\bstajyor\b/i.test(text))           return "junior";
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

  // 1. Labeled — eng ishonchli
  const labeled = text.match(
    /(?:murojaat|kontakt|aloqa|bog.lan|связь|контакт|telegram|hr|apply|cv\s*yubor|резюме\s*отправ)[^\n@]{0,50}@([A-Za-z0-9_]{3,32})/i,
  );
  if (labeled) return `@${labeled[1]}`;

  // 2. Inline "CV: @user" yoki "→ @user"
  const arrow = text.match(/(?:→|➡️|👉|📨)[^\n@]{0,20}@([A-Za-z0-9_]{3,32})/);
  if (arrow) return `@${arrow[1]}`;

  // 3. Barcha @mention — kanal va botlarni olib tashlab birinchisini olamiz
  const all = [...text.matchAll(/@([A-Za-z0-9_]{3,32})/g)].map((m) => m[1]);
  for (const handle of all) {
    const h = handle.toLowerCase();
    if (h === chLower) continue;                      // kanal o'zi
    if (h.endsWith("_channel") || h.endsWith("_uz_uz")) continue;
    if (/news|kanal|channel|official|admin(?!_)/.test(h)) continue;
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

  // 2. Label'dan
  const labeled = extractLabel(text, L_TITLE);
  if (labeled) return cleanLine(labeled.split("\n")[0]).trim().slice(0, 150);

  // 3. Birinchi qator — ish belgisi bo'lsa
  const lines = text.split("\n");
  for (const line of lines.slice(0, 4)) {
    const c = cleanLine(line).trim();
    if (c.length < 6 || c.length > 160) continue;
    if (
      /kerak\b|вакансия|vacancy|developer|dasturchi|engineer|designer|dizayner|manager|analyst|devops|tester|qa\b|frontend|backend|fullstack|flutter|lead|junior|middle|senior/i.test(c)
    ) {
      return c;
    }
  }

  // 4. CAPS qator (5+ belgi)
  const caps = text.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ\s]{4,80})\s*\n/m);
  if (caps) return cleanLine(caps[1]).trim().slice(0, 150);

  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseVacancy(
  text: string,
  channelName?: string,
): ParsedVacancy | null {
  if (!text || text.trim().length < 15) return null;

  // Ball tizimi — 2 yoki undan ko'p bo'lsa vakansiya
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
