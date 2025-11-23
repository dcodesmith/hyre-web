import { prisma } from "../app/modules/db/db.server";

const defaultReferralConfig = [
  { key: "REFERRAL_ENABLED", value: true },
  { key: "REFERRAL_DISCOUNT_AMOUNT", value: 10000 }, // ₦10,000
  { key: "REFERRAL_MIN_BOOKING_AMOUNT", value: 20000 }, // ₦20,000
  { key: "REFERRAL_ELIGIBLE_TYPES", value: ["DAY", "NIGHT", "FULL_DAY"] },
  // Release rewards on completion; discount consumption handled by completion flow
  { key: "REFERRAL_RELEASE_CONDITION", value: "COMPLETED" },
  { key: "REFERRAL_EXPIRY_DAYS", value: 30 },
  { key: "REFERRAL_MAX_CREDITS_PER_BOOKING", value: 30000 }, // ₦30,000 max credits per booking
];

export async function seedReferralConfig() {
  console.log("🔄 Seeding referral configuration...");

  const allowOverride = process.env.SEED_OVERRIDE_REFERRAL_CONFIG === "true";

  await Promise.all(
    defaultReferralConfig.map((config) =>
      prisma.referralProgramConfig.upsert({
        where: { key: config.key },
        update: allowOverride ? { value: config.value, updatedAt: new Date() } : {},
        create: { key: config.key, value: config.value, updatedAt: new Date() },
      }),
    ),
  );

  console.log("✅ Referral configuration seeded successfully");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await seedReferralConfig();
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}
