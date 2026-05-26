-- User tablitsiyasida id ustuni mavjudligini tekshirish va tiklash
DO $$
BEGIN
  -- 1. id ustuni mavjudligini tekshirish
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'id'
  ) THEN
    -- id ustuni yo'q — qo'shamiz
    ALTER TABLE "User" ADD COLUMN "id" SERIAL;
  END IF;

  -- 2. Primary key mavjudligini tekshirish
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'User' AND tc.constraint_type = 'PRIMARY KEY'
  ) THEN
    -- Foreign key constraintlarni vaqtincha o'chirish
    ALTER TABLE "Filter" DROP CONSTRAINT IF EXISTS "Filter_userId_fkey";
    ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
    
    -- Primary key qo'shish
    ALTER TABLE "User" ADD PRIMARY KEY ("id");
    
    -- Foreign key constraintlarni qayta qo'shish
    ALTER TABLE "Filter" ADD CONSTRAINT "Filter_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("telegramId") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("telegramId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
