import { sampleReviewData } from "../app/modules/email/fixtures/preview-fixtures";
import type { ReviewData } from "../app/modules/email/templates/review-emails";
import { ReviewReceivedEmailForOwner } from "../app/modules/email/templates/review-emails";

export default function ReviewOwnerPreview({
  ownerName,
  reviewData,
}: {
  readonly ownerName: string;
  readonly reviewData: ReviewData;
}) {
  return <ReviewReceivedEmailForOwner ownerName={ownerName} reviewData={reviewData} />;
}

ReviewOwnerPreview.PreviewProps = {
  ownerName: "Sam Owner",
  reviewData: sampleReviewData,
};
