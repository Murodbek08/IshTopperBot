/**
 * IT sohalari, texnologiyalar, ish turlari va viloyatlar katalogi
 * Barcha ma'lumotlar button orqali tanlanadi — foydalanuvchi hech narsa yozmaydi.
 */

export interface FieldData {
  label: string;
  emoji: string;
  technologies: TechItem[];
}

export interface TechItem {
  label: string;       // ko'rsatiladigan nom
  keywords: string[];  // matching uchun kalit so'zlar (lowercase)
}

// ─── Sohalar va texnologiyalar ────────────────────────────────────────────────

export const FIELDS: Record<string, FieldData> = {
  frontend: {
    label: "Frontend",
    emoji: "🖥",
    technologies: [
      { label: "React",        keywords: ["react", "reactjs", "react.js"] },
      { label: "Vue.js",       keywords: ["vue", "vuejs", "vue.js", "nuxt"] },
      { label: "Angular",      keywords: ["angular"] },
      { label: "Next.js",      keywords: ["next.js", "nextjs", "next"] },
      { label: "TypeScript",   keywords: ["typescript", "ts"] },
      { label: "JavaScript",   keywords: ["javascript", "js"] },
      { label: "HTML/CSS",     keywords: ["html", "css", "html5", "css3"] },
      { label: "Tailwind",     keywords: ["tailwind", "tailwindcss"] },
      { label: "Redux",        keywords: ["redux", "zustand", "mobx"] },
      { label: "Vite/Webpack", keywords: ["vite", "webpack"] },
      { label: "SCSS/SASS",    keywords: ["scss", "sass", "less"] },
      { label: "Bootstrap",    keywords: ["bootstrap"] },
      { label: "Svelte",       keywords: ["svelte", "sveltekit"] },
      { label: "jQuery",       keywords: ["jquery"] },
    ],
  },

  backend: {
    label: "Backend",
    emoji: "⚙️",
    technologies: [
      { label: "Node.js",      keywords: ["node.js", "nodejs", "node"] },
      { label: "NestJS",       keywords: ["nestjs", "nest.js", "nest"] },
      { label: "Express.js",   keywords: ["express", "express.js"] },
      { label: "Python",       keywords: ["python"] },
      { label: "Django",       keywords: ["django"] },
      { label: "FastAPI",      keywords: ["fastapi"] },
      { label: "Java",         keywords: ["java", "spring", "spring boot"] },
      { label: "Go",           keywords: ["go", "golang"] },
      { label: "PHP / Laravel",keywords: ["php", "laravel", "symfony"] },
      { label: "C# / .NET",    keywords: ["c#", ".net", "asp.net", "dotnet"] },
      { label: "Ruby",         keywords: ["ruby", "rails", "ruby on rails"] },
      { label: "Rust",         keywords: ["rust"] },
      { label: "Kotlin",       keywords: ["kotlin"] },
      { label: "GraphQL",      keywords: ["graphql"] },
      { label: "REST API",     keywords: ["rest", "rest api"] },
      { label: "gRPC",         keywords: ["grpc"] },
    ],
  },

  mobile: {
    label: "Mobile",
    emoji: "📱",
    technologies: [
      { label: "React Native", keywords: ["react native"] },
      { label: "Flutter",      keywords: ["flutter", "dart"] },
      { label: "Swift / iOS",  keywords: ["swift", "ios", "xcode"] },
      { label: "Kotlin / Android", keywords: ["kotlin", "android", "jetpack"] },
      { label: "Xamarin",      keywords: ["xamarin"] },
      { label: "Expo",         keywords: ["expo"] },
    ],
  },

  devops: {
    label: "DevOps / Cloud",
    emoji: "🔧",
    technologies: [
      { label: "Docker",       keywords: ["docker"] },
      { label: "Kubernetes",   keywords: ["kubernetes", "k8s"] },
      { label: "AWS",          keywords: ["aws", "amazon web services"] },
      { label: "GCP",          keywords: ["gcp", "google cloud"] },
      { label: "Azure",        keywords: ["azure"] },
      { label: "CI/CD",        keywords: ["ci/cd", "cicd", "jenkins", "github actions", "gitlab ci"] },
      { label: "Terraform",    keywords: ["terraform"] },
      { label: "Linux",        keywords: ["linux", "ubuntu", "centos"] },
      { label: "Nginx",        keywords: ["nginx"] },
      { label: "Ansible",      keywords: ["ansible"] },
    ],
  },

  data: {
    label: "Data / ML / AI",
    emoji: "📊",
    technologies: [
      { label: "Python",       keywords: ["python"] },
      { label: "TensorFlow",   keywords: ["tensorflow"] },
      { label: "PyTorch",      keywords: ["pytorch"] },
      { label: "Pandas/NumPy", keywords: ["pandas", "numpy"] },
      { label: "SQL",          keywords: ["sql"] },
      { label: "Spark",        keywords: ["spark", "apache spark"] },
      { label: "Airflow",      keywords: ["airflow"] },
      { label: "scikit-learn", keywords: ["scikit-learn", "sklearn"] },
      { label: "LangChain",    keywords: ["langchain"] },
      { label: "OpenCV",       keywords: ["opencv"] },
    ],
  },

  fullstack: {
    label: "Full Stack",
    emoji: "🔀",
    technologies: [
      { label: "React + Node",  keywords: ["react", "node.js", "nodejs"] },
      { label: "Next.js",       keywords: ["next.js", "nextjs"] },
      { label: "Vue + Node",    keywords: ["vue", "node.js"] },
      { label: "TypeScript",    keywords: ["typescript"] },
      { label: "PostgreSQL",    keywords: ["postgresql", "postgres"] },
      { label: "MongoDB",       keywords: ["mongodb", "mongo"] },
      { label: "Redis",         keywords: ["redis"] },
      { label: "Supabase",      keywords: ["supabase"] },
      { label: "Prisma / TypeORM", keywords: ["prisma", "typeorm"] },
      { label: "GraphQL",       keywords: ["graphql"] },
      { label: "WebSocket",     keywords: ["websocket", "socket.io"] },
    ],
  },

  database: {
    label: "Database / DBA",
    emoji: "🗄",
    technologies: [
      { label: "PostgreSQL",   keywords: ["postgresql", "postgres"] },
      { label: "MySQL",        keywords: ["mysql"] },
      { label: "MongoDB",      keywords: ["mongodb", "mongo"] },
      { label: "Redis",        keywords: ["redis"] },
      { label: "Elasticsearch",keywords: ["elasticsearch", "elastic"] },
      { label: "ClickHouse",   keywords: ["clickhouse"] },
      { label: "SQLite",       keywords: ["sqlite"] },
      { label: "Firebase",     keywords: ["firebase"] },
      { label: "Supabase",     keywords: ["supabase"] },
    ],
  },

  design: {
    label: "UI/UX Design",
    emoji: "🎨",
    technologies: [
      { label: "Figma",        keywords: ["figma"] },
      { label: "Adobe XD",     keywords: ["adobe xd", "xd"] },
      { label: "Photoshop",    keywords: ["photoshop", "ps"] },
      { label: "Illustrator",  keywords: ["illustrator", "ai"] },
      { label: "After Effects",keywords: ["after effects", "ae"] },
      { label: "Prototyping",  keywords: ["prototype", "wireframe"] },
      { label: "Sketch",       keywords: ["sketch"] },
    ],
  },

  qa: {
    label: "QA / Testing",
    emoji: "🧪",
    technologies: [
      { label: "Selenium",     keywords: ["selenium"] },
      { label: "Cypress",      keywords: ["cypress"] },
      { label: "Playwright",   keywords: ["playwright"] },
      { label: "Jest",         keywords: ["jest"] },
      { label: "Postman",      keywords: ["postman"] },
      { label: "Manual QA",    keywords: ["manual qa", "manual testing", "qc"] },
      { label: "Automation QA",keywords: ["automation qa", "autotest"] },
      { label: "JMeter",       keywords: ["jmeter"] },
    ],
  },

  marketing: {
    label: "Marketing / SMM",
    emoji: "📢",
    technologies: [
      { label: "Google Ads",   keywords: ["google ads", "google adwords"] },
      { label: "Meta Ads",     keywords: ["meta ads", "facebook ads", "instagram ads"] },
      { label: "SEO",          keywords: ["seo"] },
      { label: "SMM",          keywords: ["smm"] },
      { label: "Copywriting",  keywords: ["copywriting", "copywriter", "kontent"] },
      { label: "Targeting",    keywords: ["target", "targeting", "targetolog"] },
      { label: "Analytics",    keywords: ["analytics", "google analytics", "metrika"] },
    ],
  },

  other: {
    label: "Boshqa / Umumiy",
    emoji: "💼",
    technologies: [
      { label: "Git",          keywords: ["git", "github", "gitlab"] },
      { label: "1C",           keywords: ["1c", "1с"] },
      { label: "Blockchain",   keywords: ["blockchain", "web3", "solidity"] },
      { label: "AI / Prompt",  keywords: ["ai", "prompt", "chatgpt", "openai"] },
      { label: "Robotics",     keywords: ["arduino", "lego", "scratch", "robot"] },
      { label: "Project Manager", keywords: ["pm", "project manager", "scrum", "agile"] },
      { label: "Business Analyst", keywords: ["ba", "business analyst", "requirements"] },
    ],
  },
};

// ─── Ish turi ─────────────────────────────────────────────────────────────────

export const WORK_TYPES: Record<string, string> = {
  remote:  "🏠 Remote",
  office:  "🏢 Ofis",
  hybrid:  "🔄 Hybrid",
  any:     "🌐 Hammasi",
};

// ─── Daraja ───────────────────────────────────────────────────────────────────

export const LEVELS: Record<string, string> = {
  intern: "🟣 Intern / Trainee",
  junior: "🟢 Junior",
  middle: "🟡 Middle",
  senior: "🔴 Senior",
  lead:   "⚫ Lead / Tech Lead",
  any:    "⚪ Hammasi",
};

// ─── Viloyatlar — to'liq O'zbekiston ─────────────────────────────────────────

export interface LocationItem {
  label: string;
  keywords: string[]; // matching uchun
}

export const LOCATIONS: LocationItem[] = [
  { label: "🏙 Toshkent sh.",       keywords: ["toshkent", "tashkent", "ташкент"] },
  { label: "🌆 Toshkent vil.",      keywords: ["toshkent viloyati", "toshkent region"] },
  { label: "🕌 Samarqand",          keywords: ["samarqand", "самарканд"] },
  { label: "📚 Namangan",           keywords: ["namangan", "наманган"] },
  { label: "🏔 Andijon",            keywords: ["andijon", "андижан"] },
  { label: "🌸 Farg'ona",           keywords: ["farg'ona", "fargona", "fergana", "фергана"] },
  { label: "🏛 Buxoro",             keywords: ["buxoro", "bukhara", "бухара"] },
  { label: "🌊 Xorazm (Urganch)",   keywords: ["xorazm", "urganch", "хорезм", "ургенч"] },
  { label: "🌾 Qashqadaryo (Qarshi)",keywords: ["qashqadaryo", "qarshi", "кашкадарья", "карши"] },
  { label: "🏜 Surxondaryo (Termiz)",keywords: ["surxondaryo", "termiz", "сурхандарья", "термез"] },
  { label: "🌿 Sirdaryo (Guliston)", keywords: ["sirdaryo", "guliston", "сырдарья", "гулистан"] },
  { label: "🗺 Jizzax",             keywords: ["jizzax", "джизак"] },
  { label: "⛏ Navoiy",             keywords: ["navoiy", "навои"] },
  { label: "🌍 Qoraqalpog'iston",   keywords: ["qoraqalpogiston", "nukus", "каракалпакстан", "нукус"] },
  { label: "🏠 Remote (Masofaviy)", keywords: ["remote", "masofaviy", "uzoqdan", "онлайн", "online"] },
  { label: "✈️ Xorijda",            keywords: ["xorij", "abroad", "за рубежом", "за границей"] },
];

// ─── Maosh diapazoni ──────────────────────────────────────────────────────────

export const SALARY_RANGES: Record<string, { label: string; min: number }> = {
  "1m":  { label: "1 mln+",  min: 1_000_000 },
  "2m":  { label: "2 mln+",  min: 2_000_000 },
  "3m":  { label: "3 mln+",  min: 3_000_000 },
  "5m":  { label: "5 mln+",  min: 5_000_000 },
  "7m":  { label: "7 mln+",  min: 7_000_000 },
  "10m": { label: "10 mln+", min: 10_000_000 },
  "15m": { label: "15 mln+", min: 15_000_000 },
  "any": { label: "Farqi yo'q", min: 0 },
};
