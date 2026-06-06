/** HTML entity escape — Telegram HTML parse_mode uchun */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Toshkent vaqtida sana-vaqt formatlash */
export function formatDate(d: Date): string {
  return d.toLocaleString("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day:      "2-digit",
    month:    "2-digit",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
  });
}

/** Faqat sana (vaqtsiz) */
export function formatDateOnly(d: Date): string {
  return d.toLocaleDateString("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day:      "2-digit",
    month:    "2-digit",
    year:     "numeric",
  });
}

/** So'm formatida son: 5000000 → "5 000 000" */
export function formatMoney(n: number): string {
  return n.toLocaleString("ru-RU");
}

/** ms dan inson o'qiy oladigan vaqt: 63000 → "1 daqiqa 3 son" */
export function humanDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} son`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m} daqiqa ${rem} son` : `${m} daqiqa`;
}

/** Array dan duplicate olib tashlash */
export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/** Promise ni timeout bilan cheklash */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${ms}ms`)), ms),
    ),
  ]);
}

/** ms kutish */
export function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
