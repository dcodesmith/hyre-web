import { Heading, Hr, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { env } from "~/utils/server/env.server";
import { EmailTemplate } from "./EmailTemplate";
import { formatCurrency } from "~/lib/utils";

function DetailListItem({
  label,
  value,
  isCurrency = false,
}: {
  readonly label: string;
  readonly value: string | number | undefined | null;
  readonly isCurrency?: boolean;
}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  let displayValue: string | number = value;

  if (isCurrency) {
    displayValue = formatCurrency(Number(value));
  }

  return (
    <Text className="m-0 py-1">
      <span className="font-semibold">{label}:</span> {displayValue}
    </Text>
  );
}

// --- Referral Attribution Success Email ---
export function renderReferralAttributionEmail(userData: {
  readonly name: string;
  readonly referralCode: string;
  readonly referrerName: string;
  readonly discountAmount: number;
  readonly phoneNumber?: string;
}) {
  const previewText = `Welcome! Your referral code from ${userData.referrerName} has been applied`;

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Welcome - Referral Applied">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Welcome to {env.APP_NAME}! 🎉
      </Heading>
      <Text className="mb-3">Hello {userData.name},</Text>
      <Text className="mb-3">
        Welcome to {env.APP_NAME}! Your account has been successfully created using{" "}
        <span className="font-semibold">{userData.referrerName}</span>'s referral code.
      </Text>

      <Section className="border border-green-200 rounded-md p-4 my-4 bg-green-50">
        <Text className="font-semibold mb-2 text-green-800">🎁 Referral Discount Applied!</Text>
        <DetailListItem label="Discount Amount" value={userData.discountAmount} isCurrency={true} />
        <DetailListItem label="Your Referral Code" value={userData.referralCode} />
        <Text className="text-sm text-green-700 mt-2">
          This discount will be automatically applied to your first eligible booking.
        </Text>
      </Section>

      <Text className="mb-3">
        You can now start browsing our fleet and make your first booking with this exclusive
        discount!
      </Text>

      <Text className="mb-3">
        <strong>Next steps:</strong>
      </Text>
      <Text className="mb-1">• Browse available vehicles</Text>
      <Text className="mb-1">• Make your first booking and enjoy your discount</Text>
      <Text className="mb-3">
        • Share your referral code "{userData.referralCode}" with friends
      </Text>

      {userData.phoneNumber && (
        <Section className="mt-4 border-t border-gray-200 pt-4">
          <Text className="text-sm text-gray-600">
            📱 We'll send booking confirmations and updates to your phone number:{" "}
            {userData.phoneNumber}
          </Text>
        </Section>
      )}
    </EmailTemplate>,
  );
}

// --- Referral Discount Applied Email ---
export function renderReferralDiscountAppliedEmail(bookingData: {
  customerName: string;
  bookingReference: string;
  carName: string;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  referrerName: string;
  phoneNumber?: string;
}) {
  const previewText = "Referral discount applied to your booking";

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Referral Discount Applied">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Referral Discount Applied! 💰
      </Heading>
      <Text className="mb-3">Hello {bookingData.customerName},</Text>
      <Text className="mb-3">
        Great news! Your referral discount has been successfully applied to your booking for the{" "}
        <span className="font-semibold">{bookingData.carName}</span>.
      </Text>

      <Section className="border border-green-200 rounded-md p-4 my-4 bg-green-50">
        <Text className="font-semibold mb-2 text-green-800 underline">
          Discount Details (Booking Reference: {bookingData.bookingReference})
        </Text>
        <DetailListItem
          label="Original Amount"
          value={bookingData.originalAmount}
          isCurrency={true}
        />
        <DetailListItem
          label="Referral Discount"
          value={`-${bookingData.discountAmount}`}
          isCurrency={true}
        />
        <Hr className="my-2 border-green-300" />
        <DetailListItem label="Final Amount" value={bookingData.finalAmount} isCurrency={true} />
        <Text className="text-sm text-green-700 mt-2">
          Thanks to {bookingData.referrerName} for the referral!
        </Text>
      </Section>

      <Text className="mb-3">
        Your booking is confirmed with the discounted price. We hope you enjoy your ride!
      </Text>

      {bookingData.phoneNumber && (
        <Section className="mt-4 border-t border-gray-200 pt-4">
          <Text className="text-sm text-gray-600">
            📱 Booking updates will be sent to: {bookingData.phoneNumber}
          </Text>
        </Section>
      )}
    </EmailTemplate>,
  );
}

// --- Referral Reward Earned Email ---
export function renderReferralRewardEarnedEmail(rewardData: {
  referrerName: string;
  referredUserName: string;
  rewardAmount: number;
  bookingReference: string;
  totalReferrals: number;
  totalRewardsEarned: number;
  phoneNumber?: string;
}) {
  const previewText = `You've earned a referral reward of ${formatCurrency(rewardData.rewardAmount)}!`;

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Referral Reward Earned">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        You've Earned a Referral Reward! 🎉
      </Heading>
      <Text className="mb-3">Hello {rewardData.referrerName},</Text>
      <Text className="mb-3">
        Congratulations! <span className="font-semibold">{rewardData.referredUserName}</span> has
        successfully completed their first booking using your referral code, and you've earned a
        reward!
      </Text>

      <Section className="border border-blue-200 rounded-md p-4 my-4 bg-blue-50">
        <Text className="font-semibold mb-2 text-blue-800">💰 Reward Details</Text>
        <DetailListItem label="Reward Earned" value={rewardData.rewardAmount} isCurrency={true} />
        <DetailListItem label="Referred User" value={rewardData.referredUserName} />
        <DetailListItem label="Booking Reference" value={rewardData.bookingReference} />
        <Hr className="my-2 border-blue-300" />
        <Text className="text-sm text-blue-700 mt-2">
          This reward will be processed according to our referral program terms.
        </Text>
      </Section>

      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2 underline">Your Referral Stats</Text>
        <DetailListItem label="Total Successful Referrals" value={rewardData.totalReferrals} />
        <DetailListItem
          label="Total Rewards Earned"
          value={rewardData.totalRewardsEarned}
          isCurrency={true}
        />
      </Section>

      <Text className="mt-4">
        Keep sharing your referral code to earn more rewards! Thank you for helping us grow the{" "}
        {env.APP_NAME} community.
      </Text>

      {rewardData.phoneNumber && (
        <Section className="mt-4 border-t border-gray-200 pt-4">
          <Text className="text-sm text-gray-600">
            📱 Reward notifications sent to: {rewardData.phoneNumber}
          </Text>
        </Section>
      )}
    </EmailTemplate>,
  );
}
