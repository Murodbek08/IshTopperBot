-- Vacancy jadvalidagi yetishmayotgan ustunlarni xavfsiz qo'shish (IF NOT EXISTS)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Vacancy' AND column_name='salaryMax') THEN
    ALTER TABLE "Vacancy" ADD COLUMN "salaryMax" INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Vacancy' AND column_name='salaryMin') THEN
    ALTER TABLE "Vacancy" ADD COLUMN "salaryMin" INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Vacancy' AND column_name='jobType') THEN
    ALTER TABLE "Vacancy" ADD COLUMN "jobType" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Vacancy' AND column_name='messageLink') THEN
    ALTER TABLE "Vacancy" ADD COLUMN "messageLink" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Vacancy' AND column_name='isActive') THEN
    ALTER TABLE "Vacancy" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Vacancy' AND column_name='telegramContact') THEN
    ALTER TABLE "Vacancy" ADD COLUMN "telegramContact" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Vacancy' AND column_name='phone') THEN
    ALTER TABLE "Vacancy" ADD COLUMN "phone" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='silentFrom') THEN
    ALTER TABLE "User" ADD COLUMN "silentFrom" INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='silentTo') THEN
    ALTER TABLE "User" ADD COLUMN "silentTo" INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Filter' AND column_name='fieldKey') THEN
    ALTER TABLE "Filter" ADD COLUMN "fieldKey" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Filter' AND column_name='fieldLabel') THEN
    ALTER TABLE "Filter" ADD COLUMN "fieldLabel" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Filter' AND column_name='level') THEN
    ALTER TABLE "Filter" ADD COLUMN "level" TEXT;
  END IF;
END $$;
