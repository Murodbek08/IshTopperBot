/**
 * Centralized config — barcha env variable shu yerdan o'qiladi.
 * Start vaqtida validate qilinadi, aniq xato beriladi.
 */

function require(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === "") {
    throw new Error(`❌ Muhim environment variable yo'q: ${key}\n.env fayliga qo'shing.`);
  }
  return val.trim();
}

function optional(key: string, defaultVal = ""): string {
  return (process.env[key] ?? defaultVal).trim();
}

function optionalInt(key: string, defaultVal: number): number {
  const val = process.env[key];
  if (!val) return defaultVal;
  const n = parseInt(val.trim(), 10);
  return isNaN(n) ? defaultVal : n;
}

export const config = {
  // Telegram Bot
  botToken:      require("BOT_TOKEN"),

  // MTProto Parser
  apiId:         parseInt(require("API_ID"), 10),
  apiHash:       require("API_HASH"),
  sessionString: optional("SESSION_STRING"),

  // Database
  databaseUrl:   require("DATABASE_URL"),

  // App
  nodeEnv:       optional("NODE_ENV", "production"),
  port:          optionalInt("PORT", 3000),
  renderUrl:     optional("RENDER_URL"),          // agar Render.com ishlatilsa

  // Admin
  adminIds: optional("ADMIN_IDS")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0),

  get isDev() { return this.nodeEnv === "development"; },
} as const;
