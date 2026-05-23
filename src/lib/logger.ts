type Level = "info" | "warn" | "error" | "debug";

const COLORS: Record<Level, string> = {
  info: "\x1b[36m",   // cyan
  warn: "\x1b[33m",   // yellow
  error: "\x1b[31m",  // red
  debug: "\x1b[90m",  // gray
};
const RESET = "\x1b[0m";

function log(level: Level, context: string, message: string, meta?: unknown) {
  const ts = new Date().toISOString();
  const color = COLORS[level];
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  console[level === "debug" ? "log" : level](
    `${color}[${ts}] [${level.toUpperCase()}] [${context}]${RESET} ${message}${metaStr}`,
  );
}

export const logger = {
  info: (ctx: string, msg: string, meta?: unknown) => log("info", ctx, msg, meta),
  warn: (ctx: string, msg: string, meta?: unknown) => log("warn", ctx, msg, meta),
  error: (ctx: string, msg: string, meta?: unknown) => log("error", ctx, msg, meta),
  debug: (ctx: string, msg: string, meta?: unknown) => {
    if (process.env.NODE_ENV === "development") log("debug", ctx, msg, meta);
  },
};
