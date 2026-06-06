FROM node:20-alpine

WORKDIR /app

# Install OpenSSL (Prisma uchun kerak)
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .
# Logo serverga ko'chiriladi (mavjud bo'lsa)
RUN ls logo.png 2>/dev/null && echo "Logo topildi ✅" || echo "Logo yo'q — faqat matn ko'rsatiladi"

RUN npx prisma generate
RUN npm run build

CMD npx prisma migrate deploy && node dist/index.js
