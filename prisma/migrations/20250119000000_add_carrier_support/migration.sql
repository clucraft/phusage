-- CreateTable
CREATE TABLE "Carrier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_name_key" ON "Carrier"("name");

-- Insert default carrier for existing data
INSERT INTO "Carrier" ("name") VALUES ('Verizon');

-- Add carrierId column as nullable first
ALTER TABLE "CallRecord" ADD COLUMN "carrierId" INTEGER;
ALTER TABLE "RateMatrix" ADD COLUMN "carrierId" INTEGER;
ALTER TABLE "UploadHistory" ADD COLUMN "carrierId" INTEGER;

-- Update existing records to use the default carrier (Verizon, id=1)
UPDATE "CallRecord" SET "carrierId" = 1 WHERE "carrierId" IS NULL;
UPDATE "RateMatrix" SET "carrierId" = 1 WHERE "carrierId" IS NULL;
UPDATE "UploadHistory" SET "carrierId" = 1 WHERE "carrierId" IS NULL;

-- Make carrierId required on CallRecord and RateMatrix
ALTER TABLE "CallRecord" ALTER COLUMN "carrierId" SET NOT NULL;
ALTER TABLE "RateMatrix" ALTER COLUMN "carrierId" SET NOT NULL;

-- Drop the old unique constraint on RateMatrix
ALTER TABLE "RateMatrix" DROP CONSTRAINT IF EXISTS "RateMatrix_originCountry_destination_callType_key";

-- Add new unique constraint including carrierId
ALTER TABLE "RateMatrix" ADD CONSTRAINT "RateMatrix_originCountry_destination_callType_carrierId_key" UNIQUE ("originCountry", "destination", "callType", "carrierId");

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateMatrix" ADD CONSTRAINT "RateMatrix_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadHistory" ADD CONSTRAINT "UploadHistory_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
