FROM node:20-alpine

WORKDIR /app

# Install OpenSSL (Prisma uchun kerak)
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

CMD npx prisma db push && node dist/index.js
