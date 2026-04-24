import { sampleReviewData } from "../app/modules/email/fixtures/preview-fixtures";
import type { ReviewData } from "../app/modules/email/templates/review-emails";
import { ReviewReceivedEmailForChauffeur } from "../app/modules/email/templates/review-emails";

export default function ReviewChauffeurPreview({
  chauffeurName,
  reviewData,
}: {
  readonly chauffeurName: string;
  readonly reviewData: ReviewData;
}) {
  return <ReviewReceivedEmailForChauffeur chauffeurName={chauffeurName} reviewData={reviewData} />;
}

ReviewChauffeurPreview.PreviewProps = {
  chauffeurName: "Pat Chauffeur",
  reviewData: sampleReviewData,
};
