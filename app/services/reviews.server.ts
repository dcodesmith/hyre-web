import { BookingStatus, Prisma, Review } from "@prisma/client";
import { subDays } from "date-fns";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { CreateReviewInput, UpdateReviewInput } from "~/schemas/review.schema";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "~/utils/errors.server";
import { sendReviewReceivedNotifications } from "~/services/review-notifications.server";

/**
 * Valid rating value (1-5 stars)
 */
type RatingValue = 1 | 2 | 3 | 4 | 5;

/**
 * Review with related booking information (public - no email)
 */
export type ReviewWithBooking = Prisma.ReviewGetPayload<{
  include: {
    booking: {
      include: {
        car: true;
        chauffeur: true;
      };
    };
    user: {
      select: {
        id: true;
        name: true;
        image: true;
      };
    };
  };
}>;

/**
 * Lightweight review type for paginated lists/carousels - only includes booking IDs
 */
export type ReviewWithBookingLight = Prisma.ReviewGetPayload<{
  include: {
    booking: {
      select: {
        id: true;
        carId: true;
        chauffeurId: true;
      };
    };
    user: {
      select: {
        id: true;
        name: true;
        image: true;
      };
    };
  };
}>;

/**
 * Review with related booking information (internal/owner - includes email)
 */
export type ReviewWithBookingInternal = Prisma.ReviewGetPayload<{
  include: {
    booking: {
      include: {
        car: true;
        chauffeur: true;
      };
    };
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        image: true;
      };
    };
  };
}>;

/**
 * Review with related booking information (admin - includes email and moderator)
 */
export type ReviewWithBookingAdmin = Prisma.ReviewGetPayload<{
  include: {
    booking: {
      include: {
        car: true;
        chauffeur: true;
      };
    };
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        image: true;
      };
    };
    moderator: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

/**
 * Paginated reviews response for admin
 */
export type PaginatedReviewsAdmin = {
  reviews: ReviewWithBookingAdmin[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

/**
 * Aggregated ratings for a car or chauffeur
 */
export type AggregatedRatings = {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
};

/**
 * Paginated reviews response (lightweight - for lists/carousels)
 */
export type PaginatedReviews = {
  reviews: ReviewWithBookingLight[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

/**
 * Create a review for a completed booking
 * Validates:
 * - Booking exists and is COMPLETED
 * - Booking belongs to the user
 * - Review doesn't already exist for this booking
 * - Booking was completed within the last 30 days
 * Note: All 4 ratings are guaranteed by schema validation (CreateReviewInput)
 */
export async function createReview(userId: string, input: CreateReviewInput): Promise<Review> {
  logger.info("Creating review", { userId, bookingId: input.bookingId });

  // Fetch booking with all necessary details for validation and notifications
  const bookingDetails = await prisma.booking.findFirst({
    where: {
      id: input.bookingId,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      status: true,
      endDate: true,
      chauffeurId: true,
      bookingReference: true,
      car: {
        select: {
          make: true,
          model: true,
          year: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      chauffeur: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!bookingDetails) {
    throw new NotFoundError("Booking not found");
  }

  if (bookingDetails.status !== BookingStatus.COMPLETED) {
    throw new BadRequestError("Review can only be created for completed bookings");
  }

  // Validate booking belongs to user
  if (bookingDetails.userId !== userId) {
    throw new ForbiddenError("You can only review your own bookings");
  }

  // Validate booking has a chauffeur (required for chauffeurRating)
  if (!bookingDetails.chauffeurId || !bookingDetails.chauffeur) {
    throw new BadRequestError("Booking must have a chauffeur assigned");
  }

  // Check if review already exists
  const existingReview = await prisma.review.findUnique({
    where: { bookingId: input.bookingId },
  });

  if (existingReview) {
    throw new ConflictError("Review already exists for this booking");
  }

  // Validate 30-day creation window
  const thirtyDaysAgo = subDays(new Date(), 30);
  if (bookingDetails.endDate < thirtyDaysAgo) {
    throw new BadRequestError("Review can only be created within 30 days of booking completion");
  }

  // Create review (all ratings are guaranteed by schema validation)
  try {
    const review = await prisma.review.create({
      data: {
        bookingId: input.bookingId,
        userId,
        overallRating: input.overallRating,
        carRating: input.carRating,
        chauffeurRating: input.chauffeurRating,
        serviceRating: input.serviceRating,
        comment: input.comment || null,
        isVisible: true,
      },
    });

    logger.info("Review created successfully", { reviewId: review.id, bookingId: input.bookingId });

    // Send notifications to owner and chauffeur (non-blocking)
    // Don't wait for notifications to complete - they run asynchronously
    const carName = bookingDetails.car.year
      ? `${bookingDetails.car.make} ${bookingDetails.car.model} (${bookingDetails.car.year})`
      : `${bookingDetails.car.make} ${bookingDetails.car.model}`;

    sendReviewReceivedNotifications({
      owner: {
        id: bookingDetails.car.owner.id,
        name: bookingDetails.car.owner.name,
        email: bookingDetails.car.owner.email,
      },
      chauffeur: {
        id: bookingDetails.chauffeur.id,
        name: bookingDetails.chauffeur.name,
        email: bookingDetails.chauffeur.email,
      },
      review: {
        bookingReference: bookingDetails.bookingReference,
        carName,
        customerName: bookingDetails.user?.name || bookingDetails.user?.email || "Customer",
        overallRating: input.overallRating,
        carRating: input.carRating,
        chauffeurRating: input.chauffeurRating,
        serviceRating: input.serviceRating,
        comment: input.comment ?? null,
        reviewDate: new Date(),
      },
    }).catch((error) => {
      // Log notification errors but don't fail review creation
      logger.error("Failed to send review notifications", {
        error: error instanceof Error ? error.message : String(error),
        bookingId: input.bookingId,
        reviewId: review.id,
      });
    });

    return review;
  } catch (error) {
    // Handle race condition: if two requests try to create a review concurrently,
    // both might pass the pre-check, but only one will succeed due to unique constraint
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes("bookingId")
    ) {
      logger.warn("Review creation failed due to unique constraint violation", {
        bookingId: input.bookingId,
        userId,
      });
      throw new ConflictError("Review already exists for this booking");
    }

    // Re-throw other errors unchanged
    throw error;
  }
}

/**
 * Update an existing review
 * Validates:
 * - Review exists and belongs to the user
 * - Review was created within the last 7 days (edit window)
 * - At least one field is being updated
 */
export async function updateReview(
  userId: string,
  reviewId: string,
  input: UpdateReviewInput,
): Promise<Review> {
  logger.info("Updating review", { userId, reviewId });

  // Get existing review
  const existingReview = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!existingReview) {
    throw new NotFoundError("Review not found");
  }

  // Validate review belongs to user
  if (existingReview.userId !== userId) {
    throw new ForbiddenError("You can only update your own reviews");
  }

  // Validate 7-day edit window
  const sevenDaysAgo = subDays(new Date(), 7);
  if (existingReview.createdAt < sevenDaysAgo) {
    throw new BadRequestError("Review can only be edited within 7 days of creation");
  }

  // Check if there are any updates
  const hasUpdates =
    input.overallRating !== undefined ||
    input.carRating !== undefined ||
    input.chauffeurRating !== undefined ||
    input.serviceRating !== undefined ||
    input.comment !== undefined;

  if (!hasUpdates) {
    throw new BadRequestError("No updates provided");
  }

  // Build update data (only include fields that are provided)
  const updateData: Prisma.ReviewUpdateInput = Object.fromEntries(
    Object.entries({
      overallRating: input.overallRating,
      carRating: input.carRating,
      chauffeurRating: input.chauffeurRating,
      serviceRating: input.serviceRating,
      comment: input.comment,
    }).filter(([_, value]) => value !== undefined),
  );

  // Update review
  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: updateData,
  });

  logger.info("Review updated successfully", { reviewId, bookingId: existingReview.bookingId });

  return updatedReview;
}

/**
 * Get review by ID (public - no email)
 */
export async function getReviewById(reviewId: string): Promise<ReviewWithBooking | null> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      booking: {
        include: {
          car: true,
          chauffeur: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return review;
}

/**
 * Get review for a specific booking (public - no email)
 */
export async function getReviewByBookingId(bookingId: string): Promise<ReviewWithBooking | null> {
  const review = await prisma.review.findUnique({
    where: { bookingId },
    include: {
      booking: {
        include: {
          car: true,
          chauffeur: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return review;
}

/**
 * Get review for a specific booking (internal/owner - includes email)
 * Use this when the requester is the review owner or for authenticated internal endpoints
 */
export async function getReviewByBookingIdInternal(
  bookingId: string,
): Promise<ReviewWithBookingInternal | null> {
  const review = await prisma.review.findUnique({
    where: { bookingId },
    include: {
      booking: {
        include: {
          car: true,
          chauffeur: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return review;
}

/**
 * Hide a review (admin moderation)
 * Sets isVisible to false and records moderation details
 */
export async function hideReview(
  reviewId: string,
  moderatorId: string,
  moderationNotes?: string,
): Promise<Review> {
  logger.info("Hiding review", { reviewId, moderatorId });

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new NotFoundError("Review not found");
  }

  if (!review.isVisible) {
    logger.warn("Review already hidden", { reviewId });
    return review;
  }

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: {
      isVisible: false,
      moderatedAt: new Date(),
      moderatedBy: moderatorId,
      moderationNotes: moderationNotes || "Review hidden by moderator",
    },
  });

  logger.info("Review hidden successfully", { reviewId, moderatorId });

  return updatedReview;
}

/**
 * Show/unhide a review (admin moderation)
 * Sets isVisible to true and updates moderation details
 */
export async function showReview(
  reviewId: string,
  moderatorId: string,
  moderationNotes?: string,
): Promise<Review> {
  logger.info("Showing review", { reviewId, moderatorId });

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new NotFoundError("Review not found");
  }

  if (review.isVisible) {
    logger.warn("Review already visible", { reviewId });
    return review;
  }

  const updatedReview = await prisma.review.update({
    where: { id: reviewId },
    data: {
      isVisible: true,
      moderatedAt: new Date(),
      moderatedBy: moderatorId,
      moderationNotes: moderationNotes || "Review restored by moderator",
    },
  });

  logger.info("Review shown successfully", { reviewId, moderatorId });

  return updatedReview;
}

/**
 * Delete a review (admin moderation)
 * Hides the review and records moderation details
 */
export async function softDeleteReview(
  reviewId: string,
  moderatorId?: string,
  moderationNotes?: string,
): Promise<Review> {
  logger.info("Soft deleting review", { reviewId, moderatorId });

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new NotFoundError("Review not found");
  }

  if (!review.isVisible && review.moderatedAt) {
    logger.warn("Review already moderated/deleted", { reviewId });
    return review;
  }

  const deletedReview = await prisma.review.update({
    where: { id: reviewId },
    data: {
      isVisible: false,
      moderatedAt: new Date(),
      moderatedBy: moderatorId,
      moderationNotes: moderationNotes || "Review deleted by moderator",
    },
  });

  logger.info("Review deleted successfully", { reviewId, moderatorId });

  return deletedReview;
}

/**
 * Calculate aggregated ratings from an array of rating values
 * Shared helper function for getCarRatings and getChauffeurRatings
 */
function calculateAggregatedRatings(ratings: number[]): AggregatedRatings {
  if (ratings.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    };
  }

  // Calculate average rating
  const totalRating = ratings.reduce((sum, rating) => sum + rating, 0);
  const averageRating = totalRating / ratings.length;

  // Initialize rating distribution
  const distribution: Record<RatingValue, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  // Calculate rating distribution
  for (const rating of ratings) {
    const ratingValue = rating as RatingValue;
    distribution[ratingValue] = (distribution[ratingValue] || 0) + 1;
  }

  return {
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
    totalReviews: ratings.length,
    ratingDistribution: distribution,
  };
}

/**
 * Get aggregated ratings for a car
 * Only includes visible reviews
 */
export async function getCarRatings(carId: string): Promise<AggregatedRatings> {
  // Get all visible reviews for bookings of this car
  const reviews = await prisma.review.findMany({
    where: {
      isVisible: true,
      booking: {
        carId,
      },
    },
    select: {
      carRating: true,
    },
  });

  const ratings = reviews.map((review) => review.carRating);
  return calculateAggregatedRatings(ratings);
}

/**
 * Get aggregated ratings for multiple cars in a single query
 * This is more efficient than calling getCarRatings for each car individually
 * Only includes visible reviews
 */
export async function getBatchCarRatings(
  carIds: string[],
): Promise<Record<string, AggregatedRatings>> {
  if (carIds.length === 0) {
    return {};
  }

  // Get all visible reviews for bookings of these cars in a single query
  const reviews = await prisma.review.findMany({
    where: {
      isVisible: true,
      booking: {
        carId: { in: carIds },
      },
    },
    select: {
      carRating: true,
      booking: {
        select: {
          carId: true,
        },
      },
    },
  });

  // Group ratings by carId
  const ratingsByCarId = new Map<string, number[]>();

  // Initialize all car IDs with empty arrays
  for (const carId of carIds) {
    ratingsByCarId.set(carId, []);
  }

  // Populate ratings
  for (const review of reviews) {
    const carId = review.booking.carId;
    const ratings = ratingsByCarId.get(carId);
    if (ratings) {
      ratings.push(review.carRating);
    }
  }

  // Calculate aggregated ratings for each car
  const result: Record<string, AggregatedRatings> = {};
  for (const [carId, ratings] of ratingsByCarId) {
    result[carId] = calculateAggregatedRatings(ratings);
  }

  return result;
}

/**
 * Get aggregated ratings for a chauffeur
 * Only includes visible reviews
 */
export async function getChauffeurRatings(chauffeurId: string): Promise<AggregatedRatings> {
  // Get all visible reviews for bookings with this chauffeur
  const reviews = await prisma.review.findMany({
    where: {
      isVisible: true,
      booking: {
        chauffeurId,
      },
    },
    select: {
      chauffeurRating: true,
    },
  });

  const ratings = reviews.map((review) => review.chauffeurRating);
  return calculateAggregatedRatings(ratings);
}

async function getPaginatedReviews(
  whereClause: Prisma.ReviewWhereInput,
  page = 1,
  limit = 10,
): Promise<PaginatedReviews> {
  const validPage = Math.max(1, page);
  const validLimit = Math.max(1, Math.min(limit, 100));
  const skip = (validPage - 1) * validLimit;

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where: whereClause }),
    prisma.review.findMany({
      where: whereClause,
      include: {
        booking: {
          select: {
            id: true,
            carId: true,
            chauffeurId: true,
          },
        },
        user: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: validLimit,
    }),
  ]);

  const totalPages = Math.ceil(total / validLimit);
  return {
    reviews,
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      totalPages,
      hasNextPage: validPage < totalPages,
      hasPreviousPage: validPage > 1,
    },
  };
}

/**
 * Get paginated reviews for a car
 * Only returns visible reviews
 */
export async function getCarReviews(
  carId: string,
  page = 1,
  limit = 10,
): Promise<PaginatedReviews> {
  return getPaginatedReviews({ isVisible: true, booking: { carId } }, page, limit);
}

/**
 * Get paginated reviews for a chauffeur
 * Only returns visible reviews
 */
export async function getChauffeurReviews(
  chauffeurId: string,
  page = 1,
  limit = 10,
): Promise<PaginatedReviews> {
  return getPaginatedReviews(
    { isVisible: true, booking: { chauffeur: { id: chauffeurId } } },
    page,
    limit,
  );
}

/**
 * Get paginated reviews by a specific user
 * Returns all reviews (visible and hidden) since user should see their own reviews
 */
export async function getUserReviews(
  userId: string,
  page = 1,
  limit = 10,
): Promise<PaginatedReviews> {
  return getPaginatedReviews({ userId }, page, limit);
}

/**
 * Admin: Get all reviews with optional filters
 * Returns all reviews (visible and hidden) for admin moderation
 */
export type AdminReviewFilters = {
  isVisible?: boolean;
  rating?: 1 | 2 | 3 | 4 | 5; // Filter by overall rating (1-5)
  search?: string; // Search in comment or user name
  userId?: string; // Filter by user ID
  bookingId?: string; // Filter by booking ID
  moderated?: boolean; // Filter by moderation status (has moderatedAt)
};

export async function getAllReviewsForAdmin(
  filters: AdminReviewFilters = {},
  page = 1,
  limit = 20,
): Promise<PaginatedReviewsAdmin> {
  const validPage = Math.max(1, page);
  const validLimit = Math.max(1, Math.min(limit, 100));
  const skip = (validPage - 1) * validLimit;

  // Build where clause
  const whereClause: Prisma.ReviewWhereInput = {};

  if (filters.isVisible !== undefined) {
    whereClause.isVisible = filters.isVisible;
  }

  if (filters.rating !== undefined) {
    whereClause.overallRating = filters.rating;
  }

  if (filters.userId) {
    whereClause.userId = filters.userId;
  }

  if (filters.bookingId) {
    whereClause.bookingId = filters.bookingId;
  }

  if (filters.moderated !== undefined) {
    whereClause.moderatedAt = filters.moderated ? { not: null } : null;
  }

  if (filters.search) {
    whereClause.OR = [
      { comment: { contains: filters.search, mode: "insensitive" } },
      { user: { name: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where: whereClause }),
    prisma.review.findMany({
      where: whereClause,
      include: {
        booking: {
          include: {
            car: true,
            chauffeur: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        moderator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: validLimit,
    }),
  ]);

  const totalPages = Math.ceil(total / validLimit);
  return {
    reviews: reviews as ReviewWithBookingAdmin[],
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      totalPages,
      hasNextPage: validPage < totalPages,
      hasPreviousPage: validPage > 1,
    },
  };
}
