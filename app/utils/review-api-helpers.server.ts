import { type LoaderFunctionArgs } from "react-router";
import { type ZodSchema } from "zod";
import logger from "~/lib/logger.server";
import { reviewQueryParamsSchema } from "~/schemas/review.schema";
import {
  getCarRatings,
  getCarReviews,
  getChauffeurRatings,
  getChauffeurReviews,
} from "~/services/reviews.server";
import { getErrorMessage, getErrorStatus } from "./errors.server";

/**
 * Entity type for review queries
 */
type EntityType = "car" | "chauffeur";

/**
 * Configuration for entity review endpoint
 */
interface EntityReviewConfig {
  entityType: EntityType;
  paramName: string;
  paramSchema: ZodSchema<string>;
  logPrefix: string;
}

/**
 * Generic handler for fetching entity reviews (car or chauffeur)
 * Eliminates code duplication between car and chauffeur review endpoints
 *
 * @param config - Configuration for the entity type
 * @param params - Route params containing entity ID
 * @param request - Request object with query parameters
 * @returns Response with reviews and optional ratings
 */
export async function handleEntityReviewsRequest(
  config: EntityReviewConfig,
  params: LoaderFunctionArgs["params"],
  request: Request,
): Promise<Response> {
  const { entityType, paramName, paramSchema, logPrefix } = config;
  const entityId = params[paramName];

  // Validate entity ID parameter
  const paramValidation = paramSchema.safeParse(entityId);
  if (!paramValidation.success) {
    logger.warn(`${logPrefix} Invalid ${paramName} param`, {
      errors: paramValidation.error.issues,
    });
    return Response.json(
      {
        success: false,
        error: paramValidation.error.issues[0]?.message ?? `Invalid ${entityType} ID`,
      },
      { status: 400 },
    );
  }

  const validatedEntityId = paramValidation.data;
  const url = new URL(request.url);

  // Validate query parameters
  const validation = reviewQueryParamsSchema.safeParse({
    page: url.searchParams.get("page"),
    limit: url.searchParams.get("limit"),
    includeRatings: url.searchParams.get("includeRatings"),
  });

  if (!validation.success) {
    logger.warn(`${logPrefix} Invalid query parameters`, {
      [paramName]: validatedEntityId,
      errors: validation.error.issues,
    });
    return Response.json(
      {
        success: false,
        error: validation.error.issues[0]?.message ?? "Invalid query parameters",
        errors: validation.error.issues,
      },
      { status: 400 },
    );
  }

  const { page, limit, includeRatings } = validation.data;

  try {
    logger.info(`${logPrefix} Fetching ${entityType} reviews`, {
      [paramName]: validatedEntityId,
      page,
      limit,
      includeRatings,
    });

    // Fetch reviews and optionally ratings in parallel
    const getReviewsPromise =
      entityType === "car"
        ? getCarReviews(validatedEntityId, page, limit)
        : getChauffeurReviews(validatedEntityId, page, limit);

    const getRatingsFunction = entityType === "car" ? getCarRatings : getChauffeurRatings;
    const getRatingsPromise = includeRatings
      ? getRatingsFunction(validatedEntityId)
      : Promise.resolve(null);

    const [reviewsData, ratingsData] = await Promise.all([getReviewsPromise, getRatingsPromise]);

    return Response.json({
      success: true,
      ...reviewsData,
      ...(ratingsData && { ratings: ratingsData }),
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const statusCode = getErrorStatus(error);

    logger.error(`${logPrefix} Error fetching ${entityType} reviews`, {
      [paramName]: validatedEntityId,
      page,
      limit,
      error: errorMessage,
      statusCode,
    });

    return Response.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: statusCode },
    );
  }
}
