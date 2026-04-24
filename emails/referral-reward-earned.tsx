import { sampleReferralReward } from "../app/modules/email/fixtures/preview-fixtures";
import type { ReferralRewardEarnedData } from "../app/modules/email/templates/referral-emails";
import { ReferralRewardEarnedEmail } from "../app/modules/email/templates/referral-emails";

export default function ReferralRewardEarnedPreview({
  rewardData,
}: {
  readonly rewardData: ReferralRewardEarnedData;
}) {
  return <ReferralRewardEarnedEmail rewardData={rewardData} />;
}

ReferralRewardEarnedPreview.PreviewProps = {
  rewardData: sampleReferralReward,
};
