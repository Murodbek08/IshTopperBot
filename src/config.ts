/**
 * Centralized config — barcha env variable shu yerdan o'qiladi.
 * Start vaqtida validate qilinadi, aniq xato beriladi.
 */

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === "") {
    throw new Error(`❌ Muhim environment variable yo'q: ${key}\n.env fayliga qo'shing.`);
  }
  return val.trim();
}

function optionalEnv(key: string, defaultVal = ""): string {
  return (process.env[key] ?? defaultVal).trim();
}

function optionalInt(key: string, defaultVal: number): number {
  const val = process.env[key];
  if (!val) return defaultVal;
  const n = parseInt(val.trim(), 10);
  return isNaN(n) ? defaultVal : n;
}

export const config = {
  botToken:      requireEnv("BOT_TOKEN"),
  apiId:         parseInt(requireEnv("API_ID"), 10),
  apiHash:       requireEnv("API_HASH"),
  sessionString: optionalEnv("SESSION_STRING"),
  databaseUrl:   requireEnv("DATABASE_URL"),

  // AI (provayder-agnostik — OpenAI-mos har qanday API)
  aiApiKey:      requireEnv("AI_API_KEY"),
  aiBaseUrl:     optionalEnv("AI_BASE_URL", "https://api.deepseek.com"),
  aiModel:       optionalEnv("AI_MODEL", "deepseek-chat"),

  nodeEnv:       optionalEnv("NODE_ENV", "production"),
  port:          optionalInt("PORT", 3000),
  renderUrl:     optionalEnv("RENDER_URL"),
  adminIds:      optionalEnv("ADMIN_IDS")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0),

  get isDev() { return this.nodeEnv === "development"; },
} as const;
