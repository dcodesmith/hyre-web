import { data } from "react-router";

import type { CustomerReview } from "~/api/reviews/schema";
import type { BookingReviewActionData } from "~/review/booking-review";
import { BookingReview } from "~/review/booking-review";

const fixtureReview = {
  id: "review-1",
  overallRating: 5,
  carRating: 4,
  chauffeurRating: 5,
  serviceRating: 4,
  comment: "The car was spotless and the chauffeur was excellent.",
  createdAt: "2026-07-30T09:00:00.000Z",
  user: {
    id: "user-1",
    name: "Ada Okafor",
    image: null,
  },
} satisfies CustomerReview;

export function action() {
  return data<BookingReviewActionData>({ ok: true, operation: "updated" });
}

export function loader({ request }: { readonly request: Request }) {
  const searchParams = new URL(request.url).searchParams;
  const availability = searchParams.get("availability");

  return {
    availability: availability === "moderated" ? "moderated" : "available",
    missingChauffeurRating: searchParams.get("chauffeurRating") === "missing",
  } as const;
}

export default function BookingReviewFixture({
  loaderData,
}: {
  readonly loaderData: ReturnType<typeof loader>;
}) {
  const review =
    loaderData.availability === "available"
      ? {
          ...fixtureReview,
          chauffeurRating: loaderData.missingChauffeurRating ? null : fixtureReview.chauffeurRating,
        }
      : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <BookingReview
        review={review}
        availability={loaderData.availability}
        now="2026-08-01T12:00:00.000Z"
      />
    </div>
  );
}
