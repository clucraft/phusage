-- Migration: Geographic Rate Matrix Support
-- This migration updates the schema to support Verizon geographic termination rates

-- AlterTable: Add columns to CallRecord for phone number parsing
ALTER TABLE "CallRecord" ADD COLUMN IF NOT EXISTS "sourceNumber" TEXT;
ALTER TABLE "CallRecord" ADD COLUMN IF NOT EXISTS "originCountry" TEXT;
ALTER TABLE "CallRecord" ADD COLUMN IF NOT EXISTS "destCountry" TEXT;

-- CreateIndex: Add indexes for country columns on CallRecord
CREATE INDEX IF NOT EXISTS "CallRecord_originCountry_idx" ON "CallRecord"("originCountry");
CREATE INDEX IF NOT EXISTS "CallRecord_destCountry_idx" ON "CallRecord"("destCountry");

-- AlterTable: Add fileType to UploadHistory
ALTER TABLE "UploadHistory" ADD COLUMN IF NOT EXISTS "fileType" TEXT NOT NULL DEFAULT 'teams';

-- Drop existing RateMatrix table and recreate with new structure
-- Note: This will delete any existing rate data
DROP TABLE IF EXISTS "RateMatrix";

-- CreateTable: RateMatrix with geographic structure
CREATE TABLE "RateMatrix" (
    "id" SERIAL NOT NULL,
    "originCountry" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "destCountry" TEXT NOT NULL,
    "callType" TEXT NOT NULL,
    "pricePerMinute" DECIMAL(10,4) NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on origin + destination + callType
CREATE UNIQUE INDEX "RateMatrix_originCountry_destination_callType_key" ON "RateMatrix"("originCountry", "destination", "callType");

-- CreateIndex: Index on originCountry for filtering
CREATE INDEX "RateMatrix_originCountry_idx" ON "RateMatrix"("originCountry");

-- CreateIndex: Index on destCountry for filtering
CREATE INDEX "RateMatrix_destCountry_idx" ON "RateMatrix"("destCountry");
