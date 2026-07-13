-- Migration 0002: add new Moment columns + Mint unique constraints
-- Run: DATABASE_URL="<neon_url>" pnpm exec prisma db push

-- New nullable Moment columns
ALTER TABLE "Moment" ADD COLUMN IF NOT EXISTS "onchainStatus" TEXT;
ALTER TABLE "Moment" ADD COLUMN IF NOT EXISTS "imageData"     BYTEA;
ALTER TABLE "Moment" ADD COLUMN IF NOT EXISTS "metadataJson"  TEXT;

-- Mint: prevent replay and per-wallet-per-moment duplicates
ALTER TABLE "Mint" ADD CONSTRAINT IF NOT EXISTS "Mint_txSig_key"
  UNIQUE ("txSig");
ALTER TABLE "Mint" ADD CONSTRAINT IF NOT EXISTS "Mint_momentId_minterPubkey_key"
  UNIQUE ("momentId", "minterPubkey");
