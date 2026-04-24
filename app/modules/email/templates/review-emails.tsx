import { Heading, Hr, Section, Text, render } from "react-email";
import { formatRating } from "~/utils/review-formatting";
import { EmailTemplate } from "./EmailTemplate";

export type ReviewData = {
  readonly customerName: string;
  readonly bookingReference: string;
  readonly carName: string;
  readonly overallRating: number;
  readonly carRating: number;
  readonly chauffeurRating: number;
  readonly serviceRating: number;
  readonly comment: string | null;
  readonly reviewDate: string;
};

const getRatingStars = (rating: number): string => {
  const clampedRating = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(clampedRating) + "☆".repeat(5 - clampedRating);
};

type RatingOrder = "owner" | "chauffeur";

function ReviewSummarySection({
  reviewData,
  ratingOrder,
}: {
  readonly reviewData: ReviewData;
  readonly ratingOrder: RatingOrder;
}) {
  const ratings =
    ratingOrder === "owner"
      ? [
          { label: "Overall Rating", value: reviewData.overallRating },
          { label: "Car Rating", value: reviewData.carRating },
          { label: "Chauffeur Rating", value: reviewData.chauffeurRating },
          { label: "Service Rating", value: reviewData.serviceRating },
        ]
      : [
          { label: "Chauffeur Rating", value: reviewData.chauffeurRating },
          { label: "Overall Rating", value: reviewData.overallRating },
          { label: "Car Rating", value: reviewData.carRating },
          { label: "Service Rating", value: reviewData.serviceRating },
        ];

  return (
    <Section className="mt-4 border border-gray-200 rounded-md p-4 bg-gray-50">
      <Text className="font-semibold mb-3 underline">Review Summary</Text>
      {ratings.map(({ label, value }) => (
        <Text key={label} className="m-0 py-1">
          <span className="font-semibold">{label}:</span> {getRatingStars(value)} (
          {formatRating(value)}/5)
        </Text>
      ))}
      {reviewData.comment && (
        <>
          <Hr className="my-2 border-gray-300" />
          <Text className="m-0 py-1">
            <span className="font-semibold">Comment:</span>
          </Text>
          <Text className="m-0 py-2 italic text-gray-700">{reviewData.comment}</Text>
        </>
      )}
    </Section>
  );
}

function BookingDetailsSection({ reviewData }: { readonly reviewData: ReviewData }) {
  return (
    <Section className="mt-4 border-t border-gray-200 pt-4">
      <Text className="font-semibold mb-2 underline">Booking Details</Text>
      <Text className="m-0 py-1">
        <span className="font-semibold">Booking Reference:</span> {reviewData.bookingReference}
      </Text>
      <Text className="m-0 py-1">
        <span className="font-semibold">Reviewed on:</span> {reviewData.reviewDate}
      </Text>
    </Section>
  );
}

export function ReviewReceivedEmailForOwner({
  ownerName,
  reviewData,
}: {
  readonly ownerName: string;
  readonly reviewData: ReviewData;
}) {
  const previewText = `You received a ${formatRating(reviewData.overallRating)}-star review from ${reviewData.customerName}`;

  return (
    <EmailTemplate previewText={previewText} pageTitle="New Review Received">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        New Review Received ⭐
      </Heading>
      <Text className="mb-3">Hello {ownerName},</Text>
      <Text className="mb-3">
        Great news! <span className="font-semibold">{reviewData.customerName}</span> has left a{" "}
        <span className="font-semibold">{formatRating(reviewData.overallRating)}-star review</span>{" "}
        for your vehicle, <span className="font-semibold">{reviewData.carName}</span>.
      </Text>

      <ReviewSummarySection reviewData={reviewData} ratingOrder="owner" />
      <BookingDetailsSection reviewData={reviewData} />

      <Text className="mt-4 mb-3">
        Thank you for providing excellent service! Your reviews help build trust and attract more
        customers.
      </Text>
    </EmailTemplate>
  );
}

/**
 * Render review received email for car owners
 */
export async function renderReviewReceivedEmailForOwner(ownerName: string, reviewData: ReviewData) {
  return render(<ReviewReceivedEmailForOwner ownerName={ownerName} reviewData={reviewData} />);
}

export function ReviewReceivedEmailForChauffeur({
  chauffeurName,
  reviewData,
}: {
  readonly chauffeurName: string;
  readonly reviewData: ReviewData;
}) {
  const previewText = `You received a ${formatRating(reviewData.chauffeurRating)}-star chauffeur review from ${reviewData.customerName}`;

  return (
    <EmailTemplate previewText={previewText} pageTitle="New Review Received">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        New Review Received ⭐
      </Heading>
      <Text className="mb-3">Hello {chauffeurName},</Text>
      <Text className="mb-3">
        Great news! <span className="font-semibold">{reviewData.customerName}</span> has left a{" "}
        <span className="font-semibold">
          {formatRating(reviewData.chauffeurRating)}-star review
        </span>{" "}
        for your service as chauffeur for the{" "}
        <span className="font-semibold">{reviewData.carName}</span> booking.
      </Text>

      <ReviewSummarySection reviewData={reviewData} ratingOrder="chauffeur" />
      <BookingDetailsSection reviewData={reviewData} />

      <Text className="mt-4 mb-3">
        Thank you for providing excellent service! Your reviews help build trust and showcase your
        professionalism.
      </Text>
    </EmailTemplate>
  );
}

/**
 * Render review received email for chauffeurs
 */
export async function renderReviewReceivedEmailForChauffeur(
  chauffeurName: string,
  reviewData: ReviewData,
) {
  return render(
    <ReviewReceivedEmailForChauffeur chauffeurName={chauffeurName} reviewData={reviewData} />,
  );
}
