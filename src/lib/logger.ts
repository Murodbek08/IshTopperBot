type Level = "info" | "warn" | "error" | "debug";

const COLORS: Record<Level, string> = {
  info:  "\x1b[36m",  // cyan
  warn:  "\x1b[33m",  // yellow
  error: "\x1b[31m",  // red
  debug: "\x1b[90m",  // gray
};
const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const isDev = process.env.NODE_ENV === "development";

function log(level: Level, context: string, message: string, meta?: unknown): void {
  const ts    = new Date().toISOString();
  const color = COLORS[level];
  const lvl   = level.toUpperCase().padEnd(5);
  const metaStr = meta !== undefined
    ? "\n  " + JSON.stringify(meta, null, 2).replace(/\n/g, "\n  ")
    : "";

  const line = `${color}${BOLD}[${lvl}]${RESET} ${color}[${context}]${RESET} ${message}${metaStr}`;
  const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[method](`\x1b[90m${ts}\x1b[0m ${line}`);
}

export const logger = {
  info:  (ctx: string, msg: string, meta?: unknown) => log("info",  ctx, msg, meta),
  warn:  (ctx: string, msg: string, meta?: unknown) => log("warn",  ctx, msg, meta),
  error: (ctx: string, msg: string, meta?: unknown) => log("error", ctx, msg, meta),
  debug: (ctx: string, msg: string, meta?: unknown) => {
    if (isDev) log("debug", ctx, msg, meta);
  },
};
