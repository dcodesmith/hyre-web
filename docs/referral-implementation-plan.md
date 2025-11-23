# Referral System Implementation Plan

## Phase 1: Database & Core Services ✅ COMPLETED

### 1.1 Database Schema Updates ✅
- [x] Updated Prisma schema with referral tables
- [x] Added referral fields to User model
- [x] Added referral fields to Booking model
- [x] Created new models: UserReferralStats, ReferralAttribution, ReferralReward, ReferralProgramConfig
- [x] Added proper indexes and constraints

### 1.2 Referral Service ✅
- [x] Created `app/services/referral.server.ts`
- [x] Referral code generation with collision avoidance
- [x] Referral validation and attribution
- [x] Discount eligibility checking
- [x] Reward management functions

### 1.3 Authentication Integration ✅
- [x] Updated `auth.server.ts` to handle referral attribution on signup
- [x] Updated `auth.tsx` to accept referral codes from URL and form
- [x] Added referral code input to signup form
- [x] Added visual feedback for referral link usage

### 1.4 API Endpoints ✅
- [x] `/api/referrals/validate/:code` - Validate referral codes
- [x] `/api/referrals/user` - Get user referral info
- [x] `/referrals` - User-facing referral dashboard

## Phase 2: Booking Integration & Discount Application

### 2.1 Booking Service Integration
**Status: TODO**

Files to modify:
- `app/services/booking.server.ts`
- Booking creation routes
- Payment/pricing calculation logic

Tasks:
- [ ] Integrate `checkReferralEligibility()` in booking pricing
- [ ] Apply `applyReferralDiscount()` during booking creation
- [ ] Update booking total calculations to include referral discounts
- [ ] Add referral discount line items to booking receipts

### 2.2 Payment Integration
**Status: TODO**

Files to modify:
- `app/services/payment.server.ts`
- Payment webhook handlers
- Booking status update logic

Tasks:
- [ ] Call `releaseReferralReward()` when payment is successful
- [ ] Handle reward reversals on refunds/cancellations
- [ ] Add referral status updates to payment webhooks

### 2.3 UI Updates for Booking Flow
**Status: TODO**

Files to create/modify:
- Booking form components
- Pricing display components
- Confirmation/receipt pages

Tasks:
- [ ] Show referral discount eligibility in booking form
- [ ] Display applied discounts in pricing breakdown
- [ ] Add referral discount to booking confirmations
- [ ] Show referral status in booking history

## Phase 3: Admin Dashboard & Management

### 3.1 Admin Referral Dashboard
**Status: TODO**

Files to create:
- `app/routes/admin.referrals._index.tsx`
- `app/routes/admin.referrals.$id.tsx`
- `app/services/admin-referral.server.ts`

Tasks:
- [ ] Create admin referral overview page
- [ ] Add referral analytics and metrics
- [ ] Enable manual reward release/reversal
- [ ] Add fraud detection alerts
- [ ] Export referral data as CSV

### 3.2 Configuration Management
**Status: TODO**

Files to create:
- `app/routes/admin.referrals.config.tsx`

Tasks:
- [ ] Create admin interface for referral program configuration
- [ ] Allow runtime updates of discount amounts, limits, etc.
- [ ] Add feature flags for A/B testing

## Phase 4: Email & Notifications

### 4.1 Email Templates
**Status: TODO**

Files to create:
- `app/modules/email/templates/referral-attribution.tsx`
- `app/modules/email/templates/referral-reward.tsx`
- `app/modules/email/templates/referral-discount-applied.tsx`

Tasks:
- [ ] Create email for successful referral attribution
- [ ] Create email for reward release
- [ ] Create email for discount applied
- [ ] Add email throttling and queue management

### 4.2 Notification Integration
**Status: TODO**

Files to modify:
- Email sending service
- SMS notification service (if exists)

Tasks:
- [ ] Integrate referral emails into existing email queue
- [ ] Add SMS notifications for key referral events
- [ ] Add in-app notifications for referral updates

## Phase 5: Data Migration & Backfill

### 5.1 Database Migration
**Status: TODO - CRITICAL**

Tasks:
- [ ] Create and run Prisma migration for schema changes
- [ ] Backfill referral codes for existing users
- [ ] Insert default configuration values

**Migration Commands:**
```bash
# Generate migration
npx prisma migrate dev --name add_referral_system

# Alternative: Reset and reseed (development only)
npx prisma migrate reset
```

### 5.2 Data Seeding
**Status: TODO**

Files to create/modify:
- `prisma/seed.ts` (add referral config seeding)

Tasks:
- [ ] Seed referral program configuration with default values
- [ ] Generate referral codes for existing users
- [ ] Create UserReferralStats records for existing users

## Phase 6: Testing & Quality Assurance

### 6.1 Unit Tests
**Status: TODO**

Files to create:
- `app/services/__tests__/referral.server.test.ts`

Tasks:
- [ ] Test referral code generation and validation
- [ ] Test referral attribution logic
- [ ] Test discount eligibility and application
- [ ] Test reward lifecycle management

### 6.2 Integration Tests
**Status: TODO**

Tasks:
- [ ] Test end-to-end referral flow from signup to reward
- [ ] Test authentication with referral codes
- [ ] Test booking with referral discounts
- [ ] Test admin functionality

### 6.3 Performance Testing
**Status: TODO**

Tasks:
- [ ] Load test referral code validation endpoint
- [ ] Test database performance with referral indexes
- [ ] Monitor referral attribution during signup flow

## Phase 7: Monitoring & Analytics

### 7.1 Analytics Integration
**Status: TODO**

Tasks:
- [ ] Add referral event tracking
- [ ] Create referral conversion funnels
- [ ] Monitor fraud patterns and suspicious activity
- [ ] Track program ROI and effectiveness

### 7.2 Alerting & Monitoring
**Status: TODO**

Tasks:
- [ ] Set up alerts for high referral velocity (potential fraud)
- [ ] Monitor reward processing failures
- [ ] Track referral program configuration changes
- [ ] Alert on unusual attribution patterns

## Quick Start Checklist

To implement the referral system immediately:

### 1. Database Setup
```bash
# Run the migration to create tables
npx prisma migrate dev --name add_referral_system

# Generate Prisma client with new types
npx prisma generate

# Optionally seed with default config
npx prisma db seed
```

### 2. Default Configuration
Insert these values into `ReferralProgramConfig` table:
- `REFERRAL_ENABLED`: `true`
- `REFERRAL_DISCOUNT_AMOUNT`: `5000` (₦5,000)
- `REFERRAL_MIN_BOOKING_AMOUNT`: `20000` (₦20,000)
- `REFERRAL_ELIGIBLE_TYPES`: `["DAY", "NIGHT", "FULL_DAY"]`
- `REFERRAL_RELEASE_CONDITION`: `"PAID"`
- `REFERRAL_EXPIRY_DAYS`: `30`
- `REFERRAL_MAX_PER_REFERRER_MONTH`: `10`

### 3. Test the Flow
1. Visit `/auth?ref=TESTCODE` to test referral signup
2. Visit `/referrals` to see the referral dashboard
3. Test API endpoints: `/api/referrals/validate/TESTCODE`

### 4. Integration Points
The system is designed to integrate with your existing:
- Authentication flow (✅ completed)
- Booking creation process (needs integration)
- Payment processing (needs integration)
- Email system (needs templates)

## Security Considerations

### Implemented Safeguards
- [x] Self-referral prevention
- [x] Single attribution per user
- [x] Rate limiting on referral validation
- [x] IP and user agent tracking for fraud detection
- [x] Atomic database transactions for referral operations

### Additional Security (TODO)
- [ ] Device fingerprinting for advanced fraud detection
- [ ] Velocity limits per IP address
- [ ] Blacklist functionality for abused codes
- [ ] Manual review queue for suspicious patterns

## Performance Optimizations

### Implemented
- [x] Proper database indexing
- [x] Efficient referral code generation
- [x] Atomic transactions for consistency

### Recommended (TODO)
- [ ] Redis caching for referral validation
- [ ] Background job processing for reward calculations
- [ ] Batch processing for reward releases

## Known Limitations & Future Enhancements

### Current Limitations
1. Fixed discount amount only (no percentage discounts)
2. Single discount per user (no repeat referrals)
3. Manual reward distribution (no automated payouts)
4. Basic fraud detection

### Future Enhancements
1. Dynamic discount amounts and tiers
2. Referrer-specific discount rates
3. Automated payout to wallet/bank accounts
4. Advanced machine learning fraud detection
5. Multi-currency support
6. Corporate/bulk referral programs

## Rollout Strategy

### Phase 1: Internal Testing (1 week)
- Deploy to staging environment
- Test with internal team
- Verify all core functionality

### Phase 2: Limited Beta (2 weeks)
- Enable for 10% of new signups
- Monitor metrics and fraud signals
- Collect user feedback

### Phase 3: Full Launch (1 week)
- Enable for all users
- Marketing campaign launch
- Monitor performance and scale

### Phase 4: Optimization (Ongoing)
- A/B test different discount amounts
- Optimize conversion rates
- Enhance fraud detection