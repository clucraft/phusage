-- AlterTable: Add role column to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';

-- CreateTable: AppSettings
CREATE TABLE IF NOT EXISTS "AppSettings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppSettings_key_key" ON "AppSettings"("key");

-- Update first user to admin (if exists)
UPDATE "User" SET "role" = 'admin' WHERE "id" = (SELECT MIN("id") FROM "User");
