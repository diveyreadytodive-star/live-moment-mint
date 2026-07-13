-- Migration 0002: add new Moment columns + Mint unique constraints
--
-- 권장: Option A — prisma db push (idempotent, schema에서 자동 생성)
--   DATABASE_URL="<neon_url>" pnpm exec prisma db push
--
-- 이 SQL은 수동 fallback (Option B). psql로 직접 실행:
--   psql $DATABASE_URL -f prisma/migrations/0002_add_moment_fields/migration.sql

-- New nullable Moment columns (IF NOT EXISTS = valid Postgres syntax for columns)
ALTER TABLE "Moment" ADD COLUMN IF NOT EXISTS "onchainStatus" TEXT;
ALTER TABLE "Moment" ADD COLUMN IF NOT EXISTS "imageData"     BYTEA;
ALTER TABLE "Moment" ADD COLUMN IF NOT EXISTS "metadataJson"  TEXT;

-- Mint: unique on txSig (replay prevention)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Mint_txSig_key'
  ) THEN
    ALTER TABLE "Mint" ADD CONSTRAINT "Mint_txSig_key" UNIQUE ("txSig");
  END IF;
END $$;

-- Mint: unique on (momentId, minterPubkey) (per-wallet-per-moment dedup)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Mint_momentId_minterPubkey_key'
  ) THEN
    ALTER TABLE "Mint" ADD CONSTRAINT "Mint_momentId_minterPubkey_key"
      UNIQUE ("momentId", "minterPubkey");
  END IF;
END $$;
