/**
 * Spam filtri — faqat 100% tasdiqlangan spam bloklash.
 * Shubhali postlar o'tkaziladi (yaxshisi keraksizni yuborgan ma'qul,
 * kerakli postni o'tkazib yuborishdan ko'ra).
 */

// Faqat shu patternlar bo'lganda ANIQ spam deb hisoblaymiz
const HARD_SPAM: RegExp[] = [
  /казино|casino|bukm(e|ё)k(e|ё)r/i,
  /kriptovalyuta\s*(inv|foy|darom)/i,
  /earn\s*\$\d+\s*(per|a)\s*(day|week)/i,
  /100%\s*(daromad|foyda|прибыл)/i,
  /stavka\s*qo.ying|ставки\s*онлайн/i,
  /реферальн|referral\s*program/i,
  /промокод\s+[A-Z0-9]{4,}/i,
  /t\.me\/\+[A-Za-z0-9_-]{10,}/i,         // joinchat linki
  /obuna\s*bo.ling[^.]{0,40}kanal/i,       // kanal reklama
  /подпишитесь\s*на\s*каш/i,
  /работа\s*в\s*интернете\s*без\s*опыта.{0,50}заработ/i,
  /\bmlm\b|\bpyramid\b/i,
  /бесплатн\w+\s*курс\w*\s*[пп]о\s*зараб/i,
];

// Bu patternlar bo'lsa LEKIN job signal ham bo'lsa — o'tkazamiz
const SOFT_SPAM: RegExp[] = [
  /t\.me\/joinchat/i,
  /подпишитесь|obuna bo.ling/i,
  /affiliate/i,
];

// Job signallari — bu bo'lsa soft spam ham o'tadi
const JOB_SIGNALS: RegExp[] = [
  /developer|dasturchi|dizayner|designer|engineer/i,
  /kerak|вакансия|vacancy|ishga\s*qabul/i,
  /resume|rezyume|резюме/i,
  /maosh|зарплата|salary|\$\d+/i,
  /talablar|требования|requirements/i,
  /@[A-Za-z0-9_]{3,32}/,
  /\+998\d{9}/,
];

export function isSpam(text: string): boolean {
  const t = text.trim();

  // 1. Juda qisqa (20 belgidan kam) — lekin job signal bo'lsa o'tkazamiz
  if (t.length < 20) {
    return !JOB_SIGNALS.some((p) => p.test(t));
  }

  // 2. Hard spam — hech qanday holatda o'tmasin
  if (HARD_SPAM.some((p) => p.test(t))) return true;

  // 3. Soft spam — job signal bo'lsa o'tkazamiz
  if (SOFT_SPAM.some((p) => p.test(t))) {
    const hasJobSignal = JOB_SIGNALS.some((p) => p.test(t));
    return !hasJobSignal;
  }

  return false;
}
