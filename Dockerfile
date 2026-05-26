FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

CMD npx prisma migrate resolve --rolled-back 20260526080701_ishbot 2>/dev/null || true && \
    npx prisma migrate resolve --applied 20260526080701_ishbot 2>/dev/null || true && \
    npx prisma migrate deploy && \
    node dist/index.js