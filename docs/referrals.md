## Referral Program Specification

### Overview
Introduce a referral program to incentivize user growth: every registered user receives a unique referral code. A new user (referee) who signs up with a valid referral code receives a discount on their first eligible booking. The referring user (referrer) receives an equal-value reward when the referee completes a qualifying booking.

### Objectives
- Increase new user signups from word-of-mouth.
- Drive first-booking conversion for referred users.
- Reward referrers for successful conversions while minimizing fraud.

### Definitions
- Referral Code: Unique identifier tied to a user, shareable via links or text.
- Referrer: Existing user whose code is used.
- Referee: New user who signs up using a referral code.
- Attribution: The mapping from a referee to their referrer.
- Reward: Monetary value granted to referrer and discount applied to referee.
- Qualifying Booking: A booking that meets program rules (e.g., minimum amount, eligible types) and reaches a specific lifecycle stage (e.g., paid or completed) to release the referrer reward.

### High-Level Requirements
- Generate a unique referral code for every user upon registration.
- Support referral attribution during signup via input field and deep links using `?ref=CODE`.
- Enforce single referrer per referee; self-referrals are not allowed.
- Apply a one-time discount to referee’s first qualifying booking.
- Grant the referrer an equal-value reward when the referee’s booking qualifies.
- Handle refunds/cancellations by reversing or withholding rewards per rules.
- Provide admin visibility into referrals, redemptions, and reversals.
- Provide messaging/email notifications to both referrer and referee for key events.
- Make core program parameters configurable without redeploys.

### Assumptions and Constraints
- Default behavior is referee discount on first qualifying booking only. Subsequent bookings are not discounted by the referral program.
- Referrer reward is granted when the referee booking reaches a release condition (configurable: after payment is captured or after completion/return window).
- Discounts apply before taxes and platform fees by default (configurable) to avoid complications and preserve fiscal calculations.
- Referral codes are case-insensitive and URL-safe.
- A user can refer unlimited people unless a configurable limit is set.
- One active referral discount per booking; cannot stack with other promo codes (configurable).

### Program Parameters (Configurable)
- REFERRAL_ENABLED: Toggle program on/off.
- REFERRAL_DISCOUNT_AMOUNT: Fixed discount amount (in NGN or applicable currency). Optionally support percentage in future.
- REFERRAL_MIN_BOOKING_AMOUNT: Minimum booking total required for referral discount eligibility.
- REFERRAL_ELIGIBLE_TYPES: Booking types eligible (e.g., DAY, NIGHT, FULL_DAY).
- REFERRAL_RELEASE_CONDITION: When to release referrer reward: PAID or COMPLETED.
- REFERRAL_EXPIRY_DAYS: Time window after sign-up in which the referee must complete a qualifying booking to receive discount (optional).
- REFERRAL_MAX_PER_REFERRER_MONTH: Soft cap to limit monthly rewards; excess may queue or be blocked.
- REFERRAL_SELF_REFERRAL_BLOCK: Enforce no self-referrals (always true by default).
- REFERRAL_STACKING_ALLOWED: Whether referral discount can stack with other promos.

### User Flows
#### 1) Referrer Gets Code
- After registration, user sees their referral code and a share link (e.g., app home/profile page). Example link: `https://hire.example.com/auth?ref=AB12CD`.

#### 2) Referee Signs Up with Code
- Referee follows link or enters `AB12CD` on sign-up form.
- System validates the code, attributes referee to referrer, and stores attribution.
- If invalid or duplicate attribution attempt, show a helpful error.

#### 3) Referee Books First Qualifying Trip
- When referee creates first qualifying booking, system applies discount automatically if not used before and booking meets criteria.
- UI displays applied discount and remaining payable amount.
- On payment success or booking completion (per configuration), the referrer reward is calculated and granted.

#### 4) Notifications
- On successful attribution: optional welcome email to referee acknowledging discount eligibility.
- On successful reward: email/SMS to both referrer and referee.

### Data Model (Revised)
Notes: Aligned with existing Prisma schema conventions and performance optimizations.

Changes to `User`:
- referralCode: string, unique, generated on registration (8 chars, base58 encoded).
- referredByUserId: string | null, the referrer's user id (set at signup; immutable).
- referralAttributionSource: enum/string (e.g., LINK, MANUAL, IMPORT).
- referralSignupAt: datetime (timestamp of successful attribution at signup).
- referralDiscountUsed: boolean default false (to prevent multiple discount usage).

Changes to `Booking`:
- referralReferrerUserId: string | null (for convenience and joins).
- referralDiscountAmount: decimal(10,2) default 0.
- referralStatus: enum [NONE, APPLIED, REWARDED, REVERSED] representing lifecycle for the booking.

New table: `UserReferralStats` (separate for performance):
- id, createdAt, updatedAt.
- userId (unique).
- totalReferrals: int default 0.
- totalRewardsGranted: decimal(10,2) default 0.
- totalRewardsPending: decimal(10,2) default 0.
- lastReferralAt: datetime.

New table: `ReferralAttribution`
- id, createdAt.
- refereeUserId (unique; one referrer per referee).
- referrerUserId (indexed).
- referralCode (for audit).
- source: enum [LINK, MANUAL].
- ipAddress: inet.
- userAgent: text.
- sessionId: string.
- securityFlags: jsonb (for fraud signals).

New table: `ReferralReward`
- id, createdAt, updatedAt.
- referrerUserId (indexed).
- refereeUserId (indexed).
- bookingId (indexed) – the qualifying booking.
- amount: decimal(10,2).
- status: enum [PENDING, RELEASED, REVERSED].
- releaseCondition: enum [PAID, COMPLETED].
- distributionMethod: enum [STORE_CREDIT, WALLET_BALANCE].
- reason: text (for audit).
- processedAt: datetime.

New table: `ReferralProgramConfig`
- key: string (primary key).
- value: jsonb.
- updatedAt: datetime.
- updatedBy: string (admin user id).

### Referral Code Generation (Revised)
- Format: 8 characters minimum, base58 encoded (excludes 0, O, I, l for clarity).
- Consider adding timestamp-based prefix to reduce collisions.
- Case-insensitive validation with normalization to uppercase.
- Generate at user creation with atomic uniqueness check and retry logic (max 3 attempts).
- Users may not change their referral code.
- Optional: Generate longer internal codes but display shorter vanity versions.

### Validation Rules (Enhanced)
- No self-referrals: `referredByUserId` cannot equal `user.id`.
- Single attribution: a user can only be attributed to one referrer, set at signup and immutable.
- Code must belong to an existing active user.
- Prevent circular referrals (A refers B and B refers A) – implicitly prevented by single attribution at signup.
- Velocity limits: limit number of rewards per referrer per time window if configured.
- Discount only applied if: referral is attributed, discount not previously used (`referralDiscountUsed = false`), booking meets minimum and eligible types, and program is enabled.
- Rate limiting: Max 10 referral code validation attempts per IP per hour to prevent brute force.
- Attribution window: Referral links valid for 30 days from generation (configurable).
- Concurrency control: Use database constraints and atomic updates to prevent race conditions on discount application.

### Discount and Reward Computation
- Default: Discount is a fixed amount applied to the booking’s net total before platform fee and VAT.
- If discount exceeds net total, clamp to net total (no negative totals).
- Reward equals the referee discount amount applied. If the discount is clamped, the reward equals the actual discount applied.
- Reward release timing determined by REFERRAL_RELEASE_CONDITION:
  - PAID: release upon successful payment capture.
  - COMPLETED: release after booking completion and any refund window.
- On cancellation/refund:
  - If booking is cancelled before release condition, do not release reward.
  - If reward already released and booking later refunded, mark reward REVERSED and deduct from referrer balance or create a debit record for reconciliation.

### Lifecycle and State Machine
Per booking referral state (`referralStatus`):
- NONE: No referral involved.
- APPLIED: Discount applied to referee’s first booking.
- REWARDED: Referrer reward released.
- REVERSED: Reward reversed due to refund/cancellation or fraud.

Per reward record (`ReferralReward.status`):
- PENDING → RELEASED → (optional) REVERSED.

### Integration Points
- Signup: validate `?ref=CODE` or form field; set `referredByUserId` and create `ReferralAttribution` record.
- Pricing: when building booking totals, if user has unused referral attribution and this is their first eligible booking, apply `referralDiscountAmount` and set `referralCodeUsed` and `referralReferrerUserId`.
- Payment/Booking lifecycle: upon meeting release condition, create/update `ReferralReward` and set booking `referralStatus` to REWARDED.
- Cancellation/Refund: evaluate and reverse reward if needed; update `referralStatus` and `ReferralReward.status`.

### UI/UX
- Profile/Home: show user’s referral code and share link with copy button.
- Signup: optional input for referral code; prefill from `?ref` param.
- Booking: if eligible, display an informational banner that the referral discount will be applied to this booking, with the amount.
- Receipts: line item for “Referral Discount”.
- Admin: referral analytics page (search by referrer/referee/code), counts of attributed signups, applied discounts, released and reversed rewards; export CSV.

### Emails and Messaging
- On attribution: “You’re eligible for a referral discount on your first booking.”
- On applied discount: “Your referral discount was applied to booking {reference}.”
- On reward released: to referrer, “Your referral reward from {referee} has been released.”
- On reversal: explain reversal reason.
Use existing email queue and messaging templates; add new templates and throttle as needed.

### Admin and Ops
- View lists and details of `ReferralAttribution` and `ReferralReward`.
- Manual actions: mark reward released/reversed, adjust amounts, merge users if needed.
- Threshold alerts: notify ops if a referrer exceeds configured velocity or reversal rate.

### Fraud Prevention and Abuse Mitigation
- Block self-referrals and disposable email domains.
- Enforce device/IP checks to flag suspicious attributions (e.g., same IP across many signups).
- Velocity limits per referrer; soft or hard caps with review.
- Post-facto anomaly detection: high refund rates tied to a referrer.
- Blacklist misused codes.

### Configuration and Feature Flags
- Environment variables for core toggles and amounts.
- Optional runtime config via `ReferralProgramConfig` with caching and admin UI.
- Feature flag to enable per region or cohort for staged rollout.

### Analytics and Reporting
- Track events: `referral_click`, `referral_signup_attributed`, `referral_discount_applied`, `referral_reward_released`, `referral_reward_reversed`.
- Funnels: clicks → signups → first booking → reward release.
- KPIs: referral-driven signups, first-booking conversion rate, CAC via referrals, fraud/reversal rate.

### Edge Cases
- Referee enters invalid/expired code: show error, allow signup without attribution.
- Referee changes mind after signup: no changes; attribution is immutable.
- Referee cancels first booking and rebooks: discount remains available until a qualifying booking is completed (configurable whether discount is “consumed” upon application or upon release condition).
- Multi-currency: define discount in local currency; if multi-currency is introduced later, convert at booking time.
- Code collisions: rare; handle with regeneration at user creation time.

### Rollout Plan
1) Phase 0 – Internal testing: enable for staff/test users; verify end-to-end flows in staging.
2) Phase 1 – Soft launch: enable for 10% of new signups; monitor fraud signals and performance.
3) Phase 2 – Full launch: enable for all; continue monitoring and iterate on rules.
4) Phase 3 – Optimize: introduce dynamic rewards, percentage discounts, or tiered benefits if ROI supports it.

### QA Plan and Test Scenarios
- Attribution
  - Accept referral via `?ref` param and via input field.
  - Reject invalid code and self-referral.
- Discount Application
  - Apply to first eligible booking only; clamp at net total; respect min amount and eligible types.
  - Verify stacking behavior per configuration.
- Reward Release
  - Release on payment or completion depending on config.
  - Reverse on cancellation/refund; ensure accounting integrity.
- Concurrency
  - Multiple simultaneous bookings; ensure only the first consumes the discount.
  - Idempotency for reward creation.
- Admin
  - List, filter, export attributions and rewards; manual overrides.
- Messaging
  - Emails/SMS are queued and sent with correct variables and throttling.

### Technical Implementation Requirements

#### Database Performance Optimizations
```sql
-- Essential indexes for performance
CREATE INDEX idx_user_referral_code ON User(referralCode);
CREATE INDEX idx_user_referred_by ON User(referredByUserId);
CREATE INDEX idx_referral_attribution_referrer ON ReferralAttribution(referrerUserId);
CREATE INDEX idx_referral_reward_status_created ON ReferralReward(status, createdAt);
CREATE INDEX idx_booking_referral_status ON Booking(referralStatus);

-- Unique constraints for data integrity
ALTER TABLE User ADD CONSTRAINT unique_referral_code UNIQUE(referralCode);
ALTER TABLE ReferralAttribution ADD CONSTRAINT unique_referee UNIQUE(refereeUserId);
ALTER TABLE User ADD CONSTRAINT check_no_self_referral CHECK (id != referredByUserId);
```

#### Caching Strategy
- Cache referral code validation results (Redis, 5min TTL)
- Cache user referral eligibility status (Redis, 1hr TTL)
- Cache referral program configuration (Redis, 24hr TTL)

#### API Endpoints Required
- `POST /auth/signup` - Modified to handle referral attribution
- `GET /api/referrals/validate/:code` - Validate referral code
- `GET /api/user/referral` - Get user's referral info and stats
- `POST /api/bookings/pricing` - Modified to apply referral discounts
- `GET /api/admin/referrals` - Admin dashboard data
- `POST /api/admin/referrals/rewards/:id/release` - Manual reward release

#### Security Measures
- CSRF protection on referral attribution
- Rate limiting on code validation endpoints
- IP-based fraud detection for suspicious attribution patterns
- Session tracking for attribution source validation

### Open Questions (Prioritized)
**Critical (Must decide before development):**
- Reward distribution method: Store credit vs wallet balance vs cash?
- Discount consumption timing: on booking creation or successful payment?
- Initial REFERRAL_DISCOUNT_AMOUNT: Fixed amount (₦5000?) or percentage (10%)?

**Important (Can be configured later):**
- Minimum booking amount required? Suggested: ₦20,000
- Eligible booking types: All types or subset?
- Reward release condition: PAID vs COMPLETED? Suggested: PAID
- Monthly cap per referrer? Suggested: 10 referrals

**Optional (Nice to have):**
- Allow stacking with promo codes? Suggested: No
- Attribution grace period for users who forgot to use code?

### Acceptance Criteria
- Every new user is assigned a unique referral code at registration.
- Users can sign up with a referral code via deep link or form input; attribution is persisted and immutable.
- Referee’s first qualifying booking automatically applies the configured discount and displays it in the UI and receipt.
- A reward equal to the applied discount is created for the referrer and released per configuration; reversals occur on refunds/cancellations per rules.
- Admin can view referral attributions and rewards, including statuses and audit details.
- Program behavior is configurable via environment variables and/or admin-managed runtime config.


