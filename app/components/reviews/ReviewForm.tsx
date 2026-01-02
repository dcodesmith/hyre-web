import { type FieldMetadata, getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { createReviewSchema, updateReviewSchema } from "~/schemas/review.schema";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { StarRating } from "./StarRating";

type RatingValue = 1 | 2 | 3 | 4 | 5;
type RatingFieldName = "overallRating" | "carRating" | "chauffeurRating" | "serviceRating";

type ReviewFormProps = {
  readonly bookingId?: string;
  readonly existingReview?: {
    readonly id: string;
    readonly overallRating: number;
    readonly carRating: number;
    readonly chauffeurRating: number;
    readonly serviceRating: number;
    readonly comment: string | null;
  };
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
  readonly inModal?: boolean;
};

type Rating = {
  readonly overallRating: RatingValue | null;
  readonly carRating: RatingValue | null;
  readonly chauffeurRating: RatingValue | null;
  readonly serviceRating: RatingValue | null;
};

/**
 * Type guard to check if a value is a valid rating (1-5)
 */
function isValidRating(value: unknown): value is RatingValue {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Safely converts a value to RatingValue, returning null if invalid
 */
function toRatingValue(value: unknown): RatingValue | null {
  return isValidRating(value) ? value : null;
}

interface RatingFieldProps {
  readonly label: string;
  readonly fieldName: RatingFieldName;
  readonly rating: RatingValue | null;
  readonly onRatingChange: (field: RatingFieldName, value: RatingValue) => void;
  readonly field: FieldMetadata<number>;
  readonly ariaLabel: string;
}

function RatingField({
  label,
  fieldName,
  rating,
  onRatingChange,
  field,
  ariaLabel,
}: RatingFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>
        {label} <span className="text-red-500">*</span>
      </Label>
      <div className="flex items-center gap-3">
        <StarRating
          rating={rating ?? 0}
          interactive
          onRatingChange={(value) => onRatingChange(fieldName, value)}
          size="lg"
          ariaLabel={ariaLabel}
        />
        {rating && (
          <span className="text-sm text-gray-600">
            {rating} {rating === 1 ? "star" : "stars"}
          </span>
        )}
      </div>
      <input {...getInputProps(field, { type: "hidden" })} value={rating ?? ""} />
      {field.errors && <p className="text-sm text-red-500">{field.errors.join(" ")}</p>}
    </div>
  );
}

export function ReviewForm({
  bookingId,
  existingReview,
  onSuccess,
  onCancel,
  inModal = false,
}: ReviewFormProps) {
  const fetcher = useFetcher<{ success: boolean; error?: string; review?: unknown }>();
  const isSubmitting = fetcher.state === "submitting";
  const successHandledRef = useRef(false);

  const isEditing = !!existingReview;
  const schema = isEditing ? updateReviewSchema : createReviewSchema;

  const [ratings, setRatings] = useState<Rating>({
    overallRating: toRatingValue(existingReview?.overallRating),
    carRating: toRatingValue(existingReview?.carRating),
    chauffeurRating: toRatingValue(existingReview?.chauffeurRating),
    serviceRating: toRatingValue(existingReview?.serviceRating),
  });

  const [commentLength, setCommentLength] = useState(existingReview?.comment?.length ?? 0);

  const [form, fields] = useForm({
    defaultValue: existingReview
      ? {
          overallRating: existingReview.overallRating,
          carRating: existingReview.carRating,
          chauffeurRating: existingReview.chauffeurRating,
          serviceRating: existingReview.serviceRating,
          comment: existingReview.comment ?? "",
        }
      : {
          bookingId,
          overallRating: undefined,
          carRating: undefined,
          chauffeurRating: undefined,
          serviceRating: undefined,
          comment: "",
        },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  // Reset when starting a new submission
  useEffect(() => {
    if (fetcher.state === "submitting") {
      successHandledRef.current = false;
    }
  }, [fetcher.state]);

  // Handle successful submission
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success && !successHandledRef.current) {
      successHandledRef.current = true;
      onSuccess?.();
    }
  }, [fetcher.state, fetcher.data, onSuccess]);

  const handleRatingChange = (field: RatingFieldName, value: RatingValue) => {
    setRatings((prev) => ({ ...prev, [field]: value }));
  };

  const action = isEditing ? `/api/reviews/${existingReview.id}` : "/api/reviews/create";
  const method = isEditing ? "PUT" : "POST";

  const allRatingsSet =
    ratings.overallRating !== null &&
    ratings.carRating !== null &&
    ratings.chauffeurRating !== null &&
    ratings.serviceRating !== null;

  const getSubmitButtonText = (): string => {
    if (isSubmitting) {
      return isEditing ? "Updating..." : "Submitting...";
    }
    return isEditing ? "Update Review" : "Submit Review";
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const submission = parseWithZod(formData, { schema });

    if (submission.status !== "success") {
      // Form validation failed - conform will handle displaying errors
      return;
    }

    // Convert form data to JSON
    const jsonData = submission.value;

    fetcher.submit(jsonData, {
      method,
      action,
      encType: "application/json",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Your Review" : "Write a Review"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update your review. You can edit your review within 7 days of posting."
            : "Share your experience to help others make better decisions."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form {...getFormProps(form)} onSubmit={handleSubmit} className="space-y-6">
          {fetcher.data?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{fetcher.data.error}</p>
            </div>
          )}

          <RatingField
            label="Overall Experience"
            fieldName="overallRating"
            rating={ratings.overallRating}
            onRatingChange={handleRatingChange}
            field={fields.overallRating}
            ariaLabel="Overall experience rating"
          />

          <RatingField
            label="Car Condition"
            fieldName="carRating"
            rating={ratings.carRating}
            onRatingChange={handleRatingChange}
            field={fields.carRating}
            ariaLabel="Car condition rating"
          />

          <RatingField
            label="Chauffeur Service"
            fieldName="chauffeurRating"
            rating={ratings.chauffeurRating}
            onRatingChange={handleRatingChange}
            field={fields.chauffeurRating}
            ariaLabel="Chauffeur service rating"
          />

          <RatingField
            label="Service Quality"
            fieldName="serviceRating"
            rating={ratings.serviceRating}
            onRatingChange={handleRatingChange}
            field={fields.serviceRating}
            ariaLabel="Service quality rating"
          />

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor={fields.comment.id}>
              Additional Comments <span className="text-gray-500 text-xs">(optional)</span>
            </Label>
            <Textarea
              id={fields.comment.id}
              name={fields.comment.name}
              defaultValue={fields.comment.initialValue}
              placeholder="Share more details about your experience..."
              rows={4}
              maxLength={2000}
              onChange={(e) => {
                setCommentLength(e.target.value.length);
              }}
            />
            <div className="flex justify-between items-center">
              {fields.comment.errors && (
                <p className="text-sm text-red-500">{fields.comment.errors.join(" ")}</p>
              )}
              <p className="text-xs text-gray-500 ml-auto">{commentLength} / 2000 characters</p>
            </div>
          </div>

          {/* Hidden bookingId for create */}
          {!isEditing && bookingId && (
            <input {...getInputProps(fields.bookingId, { type: "hidden" })} />
          )}

          <div
            className={`flex flex-col sm:flex-row gap-2 pt-4 ${inModal ? "sm:justify-end" : ""}`}
          >
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || !allRatingsSet}
              className="w-full sm:w-auto"
            >
              {getSubmitButtonText()}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
