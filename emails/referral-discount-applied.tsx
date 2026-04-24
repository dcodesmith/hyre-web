import { sampleReferralDiscountBooking } from "../app/modules/email/fixtures/preview-fixtures";
import type { ReferralDiscountBookingData } from "../app/modules/email/templates/referral-emails";
import { ReferralDiscountAppliedEmail } from "../app/modules/email/templates/referral-emails";

export default function ReferralDiscountAppliedPreview({
  bookingData,
}: {
  readonly bookingData: ReferralDiscountBookingData;
}) {
  return <ReferralDiscountAppliedEmail bookingData={bookingData} />;
}

ReferralDiscountAppliedPreview.PreviewProps = {
  bookingData: sampleReferralDiscountBooking,
};
