-- CreateExtension
-- Fuzzy-search fallback. Wrapped so a host that doesn't offer pg_trgm still migrates;
-- search then falls back to plain ILIKE matching (see src/server/search/postgres.ts).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm is not available: %', SQLERRM;
END
$$;

-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('PENDING', 'READY', 'REJECTED');

-- AlterTable
ALTER TABLE "ListingImage" DROP COLUMN "scanned",
ADD COLUMN     "status" "ImageStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- CreateIndex
DO $$
BEGIN
  CREATE INDEX "Listing_title_trgm_idx" ON "Listing" USING GIN ("title" gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping trigram index: %', SQLERRM;
END
$$;

-- CreateIndex
CREATE UNIQUE INDEX "ListingImage_storageKey_key" ON "ListingImage"("storageKey");

