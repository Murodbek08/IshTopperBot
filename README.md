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
- **Deploy:** Docker + Render.com

---

## Local ishga tushirish

### 1. Loyihani clone qiling

```bash
git clone https://github.com/Murodbek08/IshTopperBot.git
cd ishbot
npm install
```

### 2. `.env` fayl yarating

```bash
cp .env.example .env
```

`.env` ni to'ldiring:

```env
DATABASE_URL=postgresql://postgres:PAROL@localhost:5432/ishbot
API_ID=12345678
API_HASH=abcdef1234567890abcdef1234567890
SESSION_STRING=
BOT_TOKEN=1234567890:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NODE_ENV=development
```

### 3. Database yarating

```bash
createdb ishbot
npx prisma generate
npx prisma migrate dev
```

### 4. Birinchi marta ishga tushiring

```bash
npm run dev
```

Terminal so'raydi:

```
📱 Telefon raqamingiz: +998901234567
📨 SMS kodingiz: 12345
```

Kiritgandan keyin konsolda `SESSION_STRING` chiqadi — uni `.env` ga ko'chiring (qo'shtirnoqsiz):

```
SESSION_STRING=1BVtsOHABu...
```

### 5. Qayta ishga tushiring

```bash
npm run dev
```

---

## Docker bilan ishga tushirish

```bash
# Image build
docker build -t ishbot .

# Ishga tushirish
docker run --env-file .env ishbot
```

> ⚠️ `.env` da `SESSION_STRING` qo'shtirnoqsiz bo'lishi kerak

---

## Render.com ga deploy qilish

### 1. GitHub ga yuklash

```bash
git init
git add .
git commit -m "ishbot"
git remote add origin https://github.com/USERNAME/ishbot.git
git push -u origin main
```

### 2. Render da PostgreSQL yaratish

1. [render.com](https://render.com) → **New → PostgreSQL**
2. Region: **Frankfurt**
3. Plan: **Free**
4. Yaratilgandan keyin **Internal Database URL** ni nusxalab oling

### 3. Render da Web Service yaratish

1. **New → Web Service** → GitHub repo ni tanlang
2. Sozlamalar:
   - Environment: **Docker**
   - Region: **Frankfurt**
   - Plan: **Free**
3. Environment Variables:

```
DATABASE_URL     →  Internal Database URL (Render PostgreSQL dan)
API_ID           →  my.telegram.org dan
API_HASH         →  my.telegram.org dan
BOT_TOKEN        →  @BotFather dan
SESSION_STRING   →  local npm run dev dan olingan (qo'shtirnoqsiz)
NODE_ENV         →  production
```

4. **Create Web Service** → Deploy boshlangani kutiladi ✅

---

## Bot komandalar

| Tugma                | Vazifasi                         |
| -------------------- | -------------------------------- |
| `/start`             | Ro'yxatdan o'tish                |
| `➕ Filter qo'shish` | Yangi filter yaratish (3 qadam)  |
| `📋 Filterlarim`     | Filterlarni ko'rish va o'chirish |
| `⏸ Pauzaga qo'yish`  | Bildirishnomalarni to'xtatish    |
| `ℹ️ Yordam`          | Yordam matni                     |

### Filter yaratish qadamlari

```
1. Kalit so'zlar  →  frontend, react, typescript
2. Shahar         →  toshkent, remote  (yoki o'tkazib yuborish)
3. Minimal maosh  →  3000000           (yoki o'tkazib yuborish)
```

---

## Kuzatilayotgan kanallar (29 ta)

`src/modules/parser/index.ts` da `CHANNELS` arrayni tahrirlang:

```ts
const CHANNELS = [
  "UstozShogird",
  "vakansiyalar_uz_uz",
  "freelancer_Uzbek",
  "unilance",
  "ayti_jobs",
  "joblinkuz",
  "data_ish",
  "we_use_js",
  "nodejsjobsfeed",
  "qamar_ads",
  "ishmi_ish",
  "Exampleuz",
  "techjobs_vakansiya",
  "freelance_link",
  "frontend",
  "upjobsuz",
  "Jobs_uz_vacancy",
  "kasbim_uz",
  "UstozShogirdSohalar",
  "freelance_uzb",
  "itmarket_uz",
  "rabotak_razrabotchik",
  "it_jobs_uz",
  "fintech_jobs",
  "click_jobs",
  "jobmarket_uz",
  "rizqimuz",
  "frontEndJobo",
  "frontendVacancy",
] as const;
```

> ⚠️ Har bir kanalga Telegram da a'zo bo'lish shart

---

## Vacancy parse qilinadigan fieldlar

| Field             | Misol                          |
| ----------------- | ------------------------------ |
| `title`           | "Frontend developer kerak"     |
| `company`         | "IT Time Academy"              |
| `location`        | "Toshkent", "Namangan"         |
| `salary`          | "Suhbat asosida", "3 000 000"  |
| `salaryMin`       | 3000000                        |
| `technologies`    | ["React", "TypeScript", "CSS"] |
| `telegramContact` | "@hr_manager"                  |
| `phone`           | "+998901234567"                |
| `workType`        | "remote" / "office" / "hybrid" |
| `level`           | "junior" / "middle" / "senior" |

---

## Fayl tuzilmasi

```
ishbot/
├── Dockerfile
├── .dockerignore
├── .env.example
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── index.ts                        # Entry point
│   ├── lib/
│   │   ├── prisma.ts                   # Singleton Prisma client
│   │   └── logger.ts                   # Rangli structured logger
│   └── modules/
│       ├── parser/
│       │   ├── vacancy.parser.ts       # Matn → strukturaviy ma'lumot
│       │   └── index.ts                # MTProto, kanallarni kuzatish
│       ├── bot/
│       │   ├── index.ts                # Bot assembly
│       │   ├── session.ts              # Multi-step dialog holati
│       │   ├── utils.ts                # escapeHtml
│       │   └── handlers/
│       │       ├── start.handler.ts
│       │       ├── filter.handler.ts
│       │       └── message.handler.ts
│       └── matcher/
│           └── index.ts                # Vacancy ↔ Filter moslashtirish
└── package.json
```

---

## Muammolar

**`SESSION_STRING` xatosi Docker da**

`.env` da qo'shtirnoqsiz yozing:

```
SESSION_STRING=1AgAOMTQ5...
```

**Tarmoq uzilib-ulanib turibdi (ETIMEDOUT)**

Uzbekistonda Telegram MTProto ba'zan bloklanadi. Render Frankfurt serverida bu muammo yo'q.

**Prisma xatolari**

```bash
npx prisma generate
npx prisma migrate dev
```

**Render da migration ishlamasa**

`Dockerfile` ga qo'shing:

```dockerfile
RUN npx prisma migrate deploy
```
