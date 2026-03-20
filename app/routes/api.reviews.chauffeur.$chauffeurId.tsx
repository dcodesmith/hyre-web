import { type LoaderFunctionArgs } from "react-router";
import { chauffeurIdParamSchema } from "~/schemas/review.schema";
import { handleEntityReviewsRequest } from "~/utils/review-api-helpers.server";

/**
 * GET /api/reviews/chauffeur/:chauffeurId
 * Get paginated reviews for a specific chauffeur
 * Optionally include aggregated ratings
 *
 * Authentication: Not required (public endpoint)
 *
 * Params:
 * - chauffeurId: string (CUID)
 *
 * Query params:
 * - page?: number (default: 1)
 * - limit?: number (default: 10, max: 100)
 * - includeRatings?: boolean (default: false) - Include aggregated ratings
 *
 * Response:
 * - 200: Success with reviews and pagination
 * - 400: Invalid parameters
 * - 500: Server error
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  return handleEntityReviewsRequest(
    {
      entityType: "chauffeur",
      paramName: "chauffeurId",
      paramSchema: chauffeurIdParamSchema,
      logPrefix: "[API /api/reviews/chauffeur/:chauffeurId]",
    },
    params,
    request,
  );
}
