-- Phase 4: messaging, reviews, moderation, disputes, verification and fraud flags.
-- Review.sellerId and Dispute.details are NOT NULL without defaults: safe because no reviews or
-- disputes exist before this phase.
-- CreateEnum
CREATE TYPE "IdVerificationStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModerationActionType" ADD VALUE 'HIDE_MESSAGE';
ALTER TYPE "ModerationActionType" ADD VALUE 'HIDE_REVIEW';

-- DropIndex
DROP INDEX "Conversation_sellerId_updatedAt_idx";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "buyerLastReadAt" TIMESTAMP(3),
ADD COLUMN     "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sellerLastReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "details" TEXT NOT NULL,
ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedById" TEXT,
ADD COLUMN     "sellerRespondedAt" TIMESTAMP(3),
ADD COLUMN     "sellerResponse" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "moderationNote" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "hiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fraudFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "fraudReviewedAt" TIMESTAMP(3),
ADD COLUMN     "refundedMinor" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "sellerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "idDocumentKeyEnc" TEXT,
ADD COLUMN     "idReviewNote" TEXT,
ADD COLUMN     "idReviewedAt" TIMESTAMP(3),
ADD COLUMN     "idReviewedById" TEXT,
ADD COLUMN     "idSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "idVerificationStatus" "IdVerificationStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationPrefs" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX "Conversation_sellerId_lastMessageAt_idx" ON "Conversation"("sellerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_buyerId_lastMessageAt_idx" ON "Conversation"("buyerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Review_sellerId_createdAt_idx" ON "Review"("sellerId", "createdAt");

-- AddForeignKey
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_idReviewedById_fkey" FOREIGN KEY ("idReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

