-- AlterTable: Filter ga workType ustunini qo'shish (agar mavjud bo'lmasa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Filter' AND column_name = 'workType'
  ) THEN
    ALTER TABLE "Filter" ADD COLUMN "workType" TEXT;
  END IF;
END $$;
