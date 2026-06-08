/**
 * SPAM FILTRI — O'zbekiston 47 ta vakansiya kanali uchun optimallashtirilgan
 *
 * Tamoyil:
 *   - HARD spam: 100% aniq spam — har doim bloklaydi
 *   - SOFT spam: shubhali — agar job signal bo'lsa o'tkazadi
 *   - JOB signal: vakansiyaga xos belgilar — soft spamni o'tkazadi
 *
 * MUHIM: Shubhali postlarni o'tkazish yaxshiroq,
 *        chunki kerakli vakansiyani o'tkazib yuborish jiddiyroq muammo.
 */

// ─── HARD SPAM — hech qachon o'tmasin ────────────────────────────────────────
const HARD_SPAM: RegExp[] = [
  // Kazino / qimor
  /казино|casino|slot\s*machine|online\s*casino|qimor/i,
  /bukm(e|ё)k(e|ё)r|букмекер|stavka\s*qo.ying|ставки\s*онлайн/i,

  // Kripto sxemalar (investitsiya emas, lekin "daromad" bilan birga)
  /kriptovalyuta\s*(inv|foy|darom)|крипто\s*(инвест|зараб)/i,
  /crypto\s*(earn|profit|passive\s*income|mining\s*farm)/i,

  // "Kafolatlangan daromad" vadalar
  /100%\s*(daromad|foyda|прибыл|kafolat|гарантия)/i,
  /earn\s*\$\d+\s*(per|a)\s*(day|week|hour)/i,
  /\$\d+\s*(per|a)\s*(day|week|hour)\s*(from\s*home|online)/i,
  /пассивный\s*доход\s*\$\d+/i,

  // MLM / piramida
  /\bmlm\b|\bпирамид|\bpyramid\s*(scheme|scam)/i,
  /сетевой\s*маркетинг|network\s*marketing|реферальн/i,
  /referral\s*(program|link|bonus)\s*(?!.{0,30}(?:developer|engineer))/i,

  // Joinchat havolalar — FAQAT sxema bilan birga (yakka holda legit vakansiyalarda ham bo'ladi)
  // /t\.me\/\+[A-Za-z0-9_-]{10,}/i,  ← olib tashlandi: ko'p real vakansiyalar invite link beradi

  // Kurs/trening spam ("o'rganing va \$X ishlang" formati)
  /(?:o.rganing|kurs\s*bor|курс\s*есть).{0,80}(?:\$\d+|заработ)/i,
  /бесплатн\w+\s*курс\w*\s*[пп]о\s*зараб/i,
  /зарабат\w+\s*(?:не\s*выход\w+|дома|онлайн)\s*(?:от|до|\$)\s*\d+/i,

  // "Promo kod" reklama
  /промокод\s+[A-Z0-9]{4,}/i,

  // "Kanal obunasi" spam
  /obuna\s*bo.ling[^.]{0,50}kanal(?!.{0,30}(?:vakansiya|job))/i,
  /подпишитесь\s*на\s*наш\w*\s*канал(?!.{0,30}(?:вакансия|job))/i,

  // To'g'ridan-to'g'ri internet pul ishlash vadasi (dasturchi bo'lmagan)
  /работа\s*в\s*интернете\s*без\s*опыта.{0,80}заработ/i,
  /ишсиз\s*қолманг.{0,50}(?:\$\d+|даромад|заработ)/i,

  // Haddan tashqari "like" / "follow" so'rash (botlar)
  /like\s*qiling.{0,30}follow\s*qiling/i,
];

// ─── SOFT SPAM — job signal bo'lsa o'tkazamiz ────────────────────────────────
const SOFT_SPAM: RegExp[] = [
  /t\.me\/joinchat/i,
  /подпишитесь|obuna\s*bo.ling/i,
  /affiliate/i,
  /repost\s*qiling|репостни/i,
  /forward\s*qiling/i,
];

// ─── JOB SIGNALS — bu bo'lsa soft spam ham o'tadi ────────────────────────────
const JOB_SIGNALS: RegExp[] = [
  /developer|dasturchi|разработчик|programmer/i,
  /designer|dizayner|дизайнер/i,
  /devops|sysadmin|engineer|muhandis/i,
  /tester|qa\b|quality\s*assurance/i,
  /manager|менеджер|analyst|аналитик/i,
  /kerak\b|вакансия|vacancy|ishga\s*qabul/i,
  /hiring|looking\s*for|job\s*opening/i,
  /resume|rezyume|резюме/i,
  /maosh|зарплата|salary|\$\d+/i,
  /talablar|требования|requirements/i,
  /tajriba|опыт\s*работы|experience/i,
  /@[A-Za-z0-9_]{3,32}/,
  /\+998\d{9}/,
  /fullstack|frontend|backend|flutter|react|python|node\.js/i,
  /junior|middle|senior|intern|trainee/i,
];

export function isSpam(text: string): boolean {
  const t = text.trim();

  // 1. Juda qisqa (20 belgidan kam) — job signal bo'lmasa spam
  if (t.length < 20) {
    return !JOB_SIGNALS.some((p) => p.test(t));
  }

  // 2. Hard spam — hech qachon o'tmasin
  if (HARD_SPAM.some((p) => p.test(t))) return true;

  // 3. Soft spam — job signal bo'lsa o'tkazamiz
  if (SOFT_SPAM.some((p) => p.test(t))) {
    return !JOB_SIGNALS.some((p) => p.test(t));
  }

  return false;
}
