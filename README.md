# 🤖 IshBot

Telegram kanallarini kuzatib, foydalanuvchi filterlariga mos vakansiyalarni avtomatik yuboruvchi bot.

## Qanday ishlaydi?

```
Telegram kanal → yangi post
       ↓
  MTProto parser ushlaydi
       ↓
  Vakansiyami? → Ha → DB ga saqlaydi + parse qiladi
       ↓
  Barcha filterlarga tekshiradi
       ↓
  Mos kelsa → foydalanuvchiga yuboradi
```

## Texnologiyalar

- **Runtime:** Node.js + TypeScript
- **Bot:** Telegraf
- **Parser:** GramJS (MTProto)
- **DB:** PostgreSQL + Prisma

---

## O'rnatish

### 1. Loyihani clone qiling

```bash
git clone https://github.com/murodbek08/ishbot.git
cd ishbot
npm install
```

### 2. `.env` fayl yarating

```bash
cp .env.example .env
```

`.env` ni to'ldiring:

```env
# PostgreSQL
DATABASE_URL="postgresql://postgres:PAROL@localhost:5432/ishbot"

# MTProto — https://my.telegram.org dan oling
API_ID=12345678
API_HASH=abcdef1234567890abcdef1234567890

# Birinchi auth dan keyin konsolda chiqadi
SESSION_STRING=""

# @BotFather dan oling
BOT_TOKEN="1234567890:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

NODE_ENV=development
```

### 3. Database yarating

```bash
# PostgreSQL da:
createdb ishbot

# Yoki psql da:
# CREATE DATABASE ishbot;
```

### 4. Migration ishga tushiring

```bash
npx prisma generate
npx prisma migrate dev
```

### 5. Birinchi marta ishga tushiring

```bash
npm run dev
```

Terminal quyidagilarni so'raydi:

```
📱 Telefon raqamingiz: +998901234567
📨 SMS kodingiz: 12345
```

Kiritgandan keyin konsolda `SESSION_STRING` chiqadi — uni `.env` ga ko'chiring:

```
SESSION_STRING="1BVtsOHABu..."
```

### 6. Qayta ishga tushiring

```bash
npm run dev
# Endi SMS so'ramasdan to'g'ri ishga tushadi
```

---

## Bot komandalar

| Tugma | Vazifasi |
|-------|----------|
| `/start` | Ro'yxatdan o'tish |
| `➕ Filter qo'shish` | Yangi filter yaratish (3 qadam) |
| `📋 Filterlarim` | Filterlarni ko'rish va o'chirish |
| `⏸ Pauzaga qo'yish` | Bildirishnomalarni to'xtatish |
| `ℹ️ Yordam` | Yordam matni |

### Filter yaratish qadamlari

```
1. Kalit so'zlar  →  frontend, react, typescript
2. Shahar         →  toshkent, remote  (yoki o'tkazib yuborish)
3. Minimal maosh  →  3000000          (yoki o'tkazib yuborish)
```

---

## Kuzatilayotgan kanallar

`src/modules/parser/index.ts` da `CHANNELS` arrayni tahrirlang:

```ts
const CHANNELS = [
  "UstozShogird",
  "itjobs_uz",
] as const;
```

---

## Vacancy parse qilinadigan fieldlar

| Field | Misol |
|-------|-------|
| `title` | "Frontend developer kerak" |
| `company` | "IT Time Academy" |
| `location` | "Toshkent", "Namangan" |
| `salary` | "Suhbat asosida", "3 000 000" |
| `salaryMin` | 3000000 |
| `technologies` | ["React", "TypeScript", "CSS"] |
| `telegramContact` | "@hr_manager" |
| `phone` | "+998901234567" |
| `workType` | "remote" / "office" / "hybrid" |
| `level` | "junior" / "middle" / "senior" |

---


## Fayl tuzilmasi

```
src/
├── index.ts                        # Entry point
├── lib/
│   ├── prisma.ts                   # Singleton Prisma client
│   └── logger.ts                   # Rangli structured logger
└── modules/
    ├── parser/
    │   ├── vacancy.parser.ts       # Matn → strukturaviy ma'lumot
    │   └── index.ts                # MTProto, kanallarni kuzatish
    ├── bot/
    │   ├── index.ts                # Bot assembly
    │   ├── session.ts              # Multi-step dialog holati
    │   ├── utils.ts                # escapeHtml
    │   └── handlers/
    │       ├── start.handler.ts    # /start
    │       ├── filter.handler.ts   # Filter CRUD
    │       └── message.handler.ts  # Multi-step input
    └── matcher/
        └── index.ts                # Vacancy ↔ Filter moslashtirish
```

---

## Muammolar

**Tarmoq uzilib-ulanib turibdi (ETIMEDOUT)**

Uzbekistonda Telegram MTProto ba'zan bloklanadi. Yechim:
- VPN yoqing, yoki
- VPS ga deploy qiling (Evropa serveri to'g'ridan ulanadi)

**`SESSION_STRING` yo'qoldi**

Qayta `npm run dev` ishga tushiring — telefon raqam va SMS so'raydi, yangi session beradi.

**Prisma xatolari**

```bash
npx prisma generate
npx prisma migrate dev
```
