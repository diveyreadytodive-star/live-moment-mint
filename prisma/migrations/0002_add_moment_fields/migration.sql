-- Add onchainStatus, imageData, metadataJson to Moment
ALTER TABLE "Moment" ADD COLUMN IF NOT EXISTS "onchainStatus" TEXT;
ALTER TABLE "Moment" ADD COLUMN IF NOT EXISTS "imageData" BYTEA;
ALTER TABLE "Moment" ADD COLUMN IF NOT EXISTS "metadataJson" TEXT;
