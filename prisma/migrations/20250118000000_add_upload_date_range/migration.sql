-- Add date range fields to UploadHistory
ALTER TABLE "UploadHistory" ADD COLUMN IF NOT EXISTS "dateRangeStart" TIMESTAMP(3);
ALTER TABLE "UploadHistory" ADD COLUMN IF NOT EXISTS "dateRangeEnd" TIMESTAMP(3);
