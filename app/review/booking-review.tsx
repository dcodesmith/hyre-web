import { Loader2, MessageSquare, Star } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";

import type { CustomerReview } from "~/api/reviews/schema";
import { DetailCard, DetailCardBody, DetailCardHeader } from "~/booking/booking-detail-card";
import { DetailStarRating } from "~/car/compact-star-rating";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import type { ReviewFieldErrors } from "~/review/review-form-schema";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;
const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type RatingName = "overallRating" | "carRating" | "chauffeurRating" | "serviceRating";

export type BookingReviewActionData = {
  readonly error?: string;
  readonly fieldErrors?: ReviewFieldErrors;
  readonly ok?: true;
  readonly operation?: "created" | "updated";
  readonly revalidate?: false;
};

const reviewDateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Africa/Lagos",
});

function canEditReview(review: CustomerReview, now: string) {
  const createdAt = Date.parse(review.createdAt);
  const currentTime = Date.parse(now);

  return (
    Number.isFinite(createdAt) &&
    Number.isFinite(currentTime) &&
    createdAt >= currentTime - EDIT_WINDOW_MS
  );
}

function RatingField({
  name,
  label,
  initialValue,
  errors,
}: {
  readonly name: RatingName;
  readonly label: string;
  readonly initialValue?: number;
  readonly errors?: readonly string[];
}) {
  const [rating, setRating] = useState(initialValue);
  const errorId = `${name}-error`;

  return (
    <fieldset
      className="space-y-2"
      aria-invalid={Boolean(errors?.length)}
      aria-describedby={errors?.length ? errorId : undefined}
    >
      <legend className="text-sm font-medium">
        {label} <span className="text-red-500">*</span>
      </legend>
      <div className="flex w-fit gap-1" role="radiogroup" aria-label={`${label} rating`}>
        {STAR_VALUES.map((value) => (
          <label
            key={value}
            className="cursor-pointer rounded p-1 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={value}
              checked={rating === value}
              onChange={() => setRating(value)}
              required
            />
            <Star
              className={
                value <= (rating ?? 0)
                  ? "size-7 fill-amber-400 text-amber-400"
                  : "size-7 text-neutral-300"
              }
              aria-hidden="true"
            />
            <span className="sr-only">
              {value} {value === 1 ? "star" : "stars"}
            </span>
          </label>
        ))}
      </div>
      <FormError id={errorId} errors={errors} />
    </fieldset>
  );
}

function DetailedRating({ label, rating }: { readonly label: string; readonly rating: number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <DetailStarRating rating={rating} ariaLabel={`${label}: ${rating} out of 5 stars`} />
    </div>
  );
}

function ReviewForm({
  review,
  fetcher,
  onCancel,
}: {
  readonly review: CustomerReview | null;
  readonly fetcher: ReturnType<typeof useFetcher<BookingReviewActionData>>;
  readonly onCancel: () => void;
}) {
  const isEditing = review !== null;
  const isSaving = fetcher.state !== "idle";
  const actionData = fetcher.state === "idle" ? fetcher.data : undefined;
  const errors = actionData?.fieldErrors;
  const [commentLength, setCommentLength] = useState(review?.comment?.length ?? 0);

  return (
    <DetailCard>
      <DetailCardHeader>
        <Star className="h-5 w-5 text-blue-600" aria-hidden="true" />
        <h2>{isEditing ? "Edit Your Review" : "Share Your Experience"}</h2>
      </DetailCardHeader>
      <DetailCardBody>
        <fetcher.Form method="post" className="space-y-6">
          <p className="text-sm text-slate-600">
            {isEditing
              ? "Update your review. You can edit your review within 7 days of posting."
              : "Share your experience to help others make better decisions."}
          </p>
          <input
            type="hidden"
            name="intent"
            value={isEditing ? "update-review" : "create-review"}
          />
          {isEditing ? <input type="hidden" name="reviewId" value={review.id} /> : null}

          <FormError>{actionData?.error}</FormError>

          <RatingField
            name="overallRating"
            label="Overall Experience"
            initialValue={review?.overallRating}
            errors={errors?.overallRating}
          />
          <RatingField
            name="carRating"
            label="Car Condition"
            initialValue={review?.carRating}
            errors={errors?.carRating}
          />
          <RatingField
            name="chauffeurRating"
            label="Chauffeur Service"
            initialValue={review?.chauffeurRating ?? undefined}
            errors={errors?.chauffeurRating}
          />
          <RatingField
            name="serviceRating"
            label="Service Quality"
            initialValue={review?.serviceRating}
            errors={errors?.serviceRating}
          />

          <div className="space-y-2">
            <label htmlFor="review-comment" className="text-sm font-medium">
              Additional Comments <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="review-comment"
              name="comment"
              defaultValue={review?.comment ?? ""}
              maxLength={2000}
              rows={4}
              placeholder="Share more details about your experience..."
              className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
              aria-invalid={Boolean(errors?.comment?.length)}
              aria-describedby={errors?.comment?.length ? "review-comment-error" : undefined}
              onChange={(event) => setCommentLength(event.currentTarget.value.length)}
            />
            <div className="flex items-start justify-between gap-4">
              <FormError id="review-comment-error" errors={errors?.comment} />
              <p className="ml-auto text-xs text-muted-foreground">
                {commentLength} / 2000 characters
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} aria-busy={isSaving}>
              {isSaving ? (
                <>
                  <span className="inline-flex animate-spin motion-reduce:animate-none">
                    <Loader2 className="size-4" aria-hidden="true" />
                  </span>
                  Saving…
                </>
              ) : isEditing ? (
                "Update Review"
              ) : (
                "Submit Review"
              )}
            </Button>
          </div>
        </fetcher.Form>
      </DetailCardBody>
    </DetailCard>
  );
}

function ExistingReview({
  review,
  operation,
  canEdit,
  onEdit,
}: {
  readonly review: CustomerReview;
  readonly operation?: BookingReviewActionData["operation"];
  readonly canEdit: boolean;
  readonly onEdit: () => void;
}) {
  const createdAt = new Date(review.createdAt);
  const reviewedOn = Number.isNaN(createdAt.getTime()) ? "" : reviewDateFormatter.format(createdAt);

  return (
    <DetailCard>
      <DetailCardHeader>
        <Star className="h-5 w-5 text-blue-600" aria-hidden="true" />
        <h2>Your Review</h2>
      </DetailCardHeader>
      <DetailCardBody>
        <div className="space-y-4">
          {reviewedOn ? <p className="text-sm text-slate-600">Submitted {reviewedOn}</p> : null}
          {operation ? (
            <output className="block text-sm text-green-700">
              {operation === "created"
                ? "Review submitted successfully."
                : "Review updated successfully."}
            </output>
          ) : null}
          <DetailStarRating
            rating={review.overallRating}
            ariaLabel={`Overall experience: ${review.overallRating} out of 5 stars`}
          />
          <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
            <DetailedRating label="Car" rating={review.carRating} />
            <DetailedRating label="Chauffeur" rating={review.chauffeurRating ?? 0} />
            <DetailedRating label="Service" rating={review.serviceRating} />
          </div>
          {review.comment ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
              {review.comment}
            </p>
          ) : null}
          {canEdit ? (
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onEdit}>
              Edit Review
            </Button>
          ) : null}
        </div>
      </DetailCardBody>
    </DetailCard>
  );
}

export function BookingReview({
  review,
  now,
}: {
  readonly review: CustomerReview | null;
  readonly now: string;
}) {
  const fetcher = useFetcher<BookingReviewActionData>();
  const [formOpen, setFormOpen] = useState(false);
  const saved = fetcher.state === "idle" && fetcher.data?.ok === true;
  const operation = saved ? fetcher.data?.operation : undefined;

  function openForm() {
    fetcher.reset();
    setFormOpen(true);
  }

  if (formOpen && !saved) {
    return (
      <div id="review" className="scroll-mt-6">
        <ReviewForm review={review} fetcher={fetcher} onCancel={() => setFormOpen(false)} />
      </div>
    );
  }

  if (review) {
    return (
      <div id="review" className="scroll-mt-6">
        <ExistingReview
          review={review}
          operation={operation}
          canEdit={canEditReview(review, now)}
          onEdit={openForm}
        />
      </div>
    );
  }

  return (
    <div id="review" className="scroll-mt-6">
      <DetailCard>
        <DetailCardHeader>
          <Star className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <h2>Share Your Experience</h2>
        </DetailCardHeader>
        <DetailCardBody>
          <div className="space-y-4">
            {saved ? (
              <output className="block text-sm text-green-700">
                Review submitted successfully.
              </output>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Your feedback helps us improve and helps other customers make informed decisions.
                  It only takes a minute!
                </p>
                <Button type="button" className="w-full sm:w-auto" onClick={openForm}>
                  <MessageSquare aria-hidden="true" />
                  Write a Review
                </Button>
              </>
            )}
          </div>
        </DetailCardBody>
      </DetailCard>
    </div>
  );
}
