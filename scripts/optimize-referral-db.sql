-- Referral System Database Optimization Script
-- Run this after the main referral migration to add performance indexes and constraints

-- Add referral code format constraint (8 chars, alphanumeric, uppercase)
ALTER TABLE "User" ADD CONSTRAINT referral_code_format 
CHECK (referralCode IS NULL OR (LENGTH(referralCode) = 8 AND referralCode ~ '^[A-Z0-9]+$'));

-- Add performance indexes for referral queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_referral_signup 
ON "User"(referredByUserId, referralSignupAt) WHERE referredByUserId IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_referral_attribution_created 
ON "ReferralAttribution"(createdAt DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_referral_reward_status_created 
ON "ReferralReward"(status, createdAt DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_referral_reward_release_condition
ON "ReferralReward"(releaseCondition, status) WHERE status = 'PENDING';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_referral_status
ON "Booking"(referralStatus, referralReferrerUserId) WHERE referralStatus != 'NONE';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_referral_stats_updated
ON "UserReferralStats"(updatedAt DESC);

-- Add unique constraint to prevent duplicate rewards per booking (safety net)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_referral_reward_booking_unique
ON "ReferralReward"(bookingId) WHERE status != 'REVERSED';

-- Add compound index for admin dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_referral_attribution_referrer_created
ON "ReferralAttribution"(referrerUserId, createdAt DESC);

-- Add index for referral code validation performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_referral_code_lower
ON "User"(LOWER(referralCode)) WHERE referralCode IS NOT NULL;

-- Comments for documentation
COMMENT ON CONSTRAINT referral_code_format ON "User" IS 'Ensures referral codes are exactly 8 uppercase alphanumeric characters';
COMMENT ON INDEX idx_user_referral_signup IS 'Optimizes queries for users referred by specific referrer with signup date filtering';
COMMENT ON INDEX idx_referral_reward_booking_unique IS 'Prevents duplicate rewards for the same booking (safety constraint)';
COMMENT ON INDEX idx_user_referral_code_lower IS 'Optimizes case-insensitive referral code lookups';

-- Analyze tables to update statistics after index creation
ANALYZE "User";
ANALYZE "ReferralAttribution"; 
ANALYZE "ReferralReward";
ANALYZE "UserReferralStats";
ANALYZE "Booking";