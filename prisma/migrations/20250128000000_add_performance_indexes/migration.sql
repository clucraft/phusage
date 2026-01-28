-- Add performance indexes on CallRecord for faster queries
CREATE INDEX IF NOT EXISTS "idx_callrecord_calldate" ON "CallRecord"("callDate");
CREATE INDEX IF NOT EXISTS "idx_callrecord_carrier" ON "CallRecord"("carrierId");
CREATE INDEX IF NOT EXISTS "idx_callrecord_user" ON "CallRecord"("userEmail");
CREATE INDEX IF NOT EXISTS "idx_callrecord_origin" ON "CallRecord"("originCountry");
CREATE INDEX IF NOT EXISTS "idx_callrecord_dest" ON "CallRecord"("destCountry");

-- Add composite index for common query pattern (date + carrier)
CREATE INDEX IF NOT EXISTS "idx_callrecord_date_carrier" ON "CallRecord"("callDate", "carrierId");
