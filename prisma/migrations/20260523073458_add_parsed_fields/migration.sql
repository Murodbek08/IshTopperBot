-- CreateTable
CREATE TABLE "Vacancy" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "messageId" BIGINT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "location" TEXT,
    "salary" TEXT,
    "salaryMin" INTEGER,
    "technologies" TEXT[],
    "telegramContact" TEXT,
    "phone" TEXT,
    "workType" TEXT,
    "level" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("telegramId")
);

-- CreateTable
CREATE TABLE "Filter" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "keywords" TEXT[],
    "location" TEXT,
    "minSalary" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Filter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "vacancyId" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vacancy_messageId_key" ON "Vacancy"("messageId");

-- CreateIndex
CREATE INDEX "Vacancy_createdAt_idx" ON "Vacancy"("createdAt");

-- CreateIndex
CREATE INDEX "Vacancy_channel_idx" ON "Vacancy"("channel");

-- CreateIndex
CREATE INDEX "Filter_userId_idx" ON "Filter"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_vacancyId_key" ON "Notification"("userId", "vacancyId");

-- AddForeignKey
ALTER TABLE "Filter" ADD CONSTRAINT "Filter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("telegramId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("telegramId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
