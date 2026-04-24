import { sampleReferralAttribution } from "../app/modules/email/fixtures/preview-fixtures";
import type { ReferralAttributionUserData } from "../app/modules/email/templates/referral-emails";
import { ReferralAttributionEmail } from "../app/modules/email/templates/referral-emails";

export default function ReferralAttributionPreview({
  userData,
}: {
  readonly userData: ReferralAttributionUserData;
}) {
  return <ReferralAttributionEmail userData={userData} />;
}

ReferralAttributionPreview.PreviewProps = {
  userData: sampleReferralAttribution,
};
