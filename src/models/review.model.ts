import sql from "../db";

// ============== TYPES ==============

export interface ServiceReview {
  id: string;
  service_id: string;
  user_id: string;
  booking_id: string | null;
  rating: number;
  title: string | null;
  review_text: string | null;
  is_verified_purchase: boolean;
  is_approved: boolean;
  helpful_count: number;
  images: string[];
  created_at: string;
  updated_at: string;
  // Joined fields
  user_name?: string;
  service_name?: string;
}

export interface ReviewStats {
  average_rating: number;
  total_reviews: number;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface CreateReviewInput {
  service_id: string;
  user_id: string;
  booking_id?: string;
  rating: number;
  title?: string;
  review_text?: string;
  is_verified_purchase?: boolean;
  images?: string[];
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  review_text?: string;
  images?: string[];
  is_approved?: boolean;
}

// ============== REVIEW QUERIES ==============

/**
 * Create a new review
 */
export async function createReview(
  data: CreateReviewInput,
): Promise<ServiceReview> {
  const rows = await sql`
    INSERT INTO service_reviews (
      service_id, user_id, booking_id, rating, title, review_text, 
      is_verified_purchase, images
    )
    VALUES (
      ${data.service_id},
      ${data.user_id},
      ${data.booking_id || null},
      ${data.rating},
      ${data.title || null},
      ${data.review_text || null},
      ${data.is_verified_purchase || false},
      ${data.images || []}
    )
    RETURNING *
  `;
  return rows[0] as ServiceReview;
}

/**
 * Get a review by ID
 */
export async function getReviewById(
  reviewId: string,
): Promise<ServiceReview | null> {
  const rows = await sql`
    SELECT r.*, u.name as user_name, s.name as service_name
    FROM service_reviews r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN services s ON r.service_id = s.id
    WHERE r.id = ${reviewId}
  `;
  return rows.length ? (rows[0] as ServiceReview) : null;
}

/**
 * Get all reviews for a service (with pagination)
 */
export async function getServiceReviews(
  serviceId: string,
  options: {
    limit?: number;
    offset?: number;
    sortBy?: "newest" | "oldest" | "highest" | "lowest" | "helpful";
    onlyApproved?: boolean;
  } = {},
): Promise<{ reviews: ServiceReview[]; total: number }> {
  const {
    limit = 10,
    offset = 0,
    sortBy = "newest",
    onlyApproved = true,
  } = options;

  let orderClause = sql`created_at DESC`;
  if (sortBy === "oldest") orderClause = sql`created_at ASC`;
  else if (sortBy === "highest")
    orderClause = sql`rating DESC, created_at DESC`;
  else if (sortBy === "lowest") orderClause = sql`rating ASC, created_at DESC`;
  else if (sortBy === "helpful")
    orderClause = sql`helpful_count DESC, created_at DESC`;

  // Get total count
  const countResult = await sql`
    SELECT COUNT(*) as total
    FROM service_reviews
    WHERE service_id = ${serviceId}
    ${onlyApproved ? sql`AND is_approved = true` : sql``}
  `;
  const total = parseInt(countResult[0]?.total || "0");

  // Get reviews
  const reviews = await sql`
    SELECT r.*, u.name as user_name
    FROM service_reviews r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.service_id = ${serviceId}
    ${onlyApproved ? sql`AND r.is_approved = true` : sql``}
    ORDER BY ${orderClause}
    LIMIT ${limit} OFFSET ${offset}
  `;

  return {
    reviews: reviews as unknown as ServiceReview[],
    total,
  };
}

/**
 * Get reviews by a user
 */
export async function getUserReviews(userId: string): Promise<ServiceReview[]> {
  const rows = await sql`
    SELECT r.*, s.name as service_name
    FROM service_reviews r
    LEFT JOIN services s ON r.service_id = s.id
    WHERE r.user_id = ${userId}
    ORDER BY r.created_at DESC
  `;
  return rows as unknown as ServiceReview[];
}

/**
 * Update a review
 */
export async function updateReview(
  reviewId: string,
  data: UpdateReviewInput,
): Promise<ServiceReview | null> {
  const rows = await sql`
    UPDATE service_reviews
    SET
      rating = COALESCE(${data.rating ?? null}, rating),
      title = COALESCE(${data.title ?? null}, title),
      review_text = COALESCE(${data.review_text ?? null}, review_text),
      images = COALESCE(${data.images ?? null}, images),
      is_approved = COALESCE(${data.is_approved ?? null}, is_approved),
      updated_at = now()
    WHERE id = ${reviewId}
    RETURNING *
  `;
  return rows.length ? (rows[0] as ServiceReview) : null;
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM service_reviews WHERE id = ${reviewId}
  `;
  return result.count > 0;
}

/**
 * Check if user has already reviewed a service (optionally for a specific booking)
 */
export async function hasUserReviewed(
  userId: string,
  serviceId: string,
  bookingId?: string,
): Promise<boolean> {
  let rows;
  if (bookingId) {
    rows = await sql`
      SELECT id FROM service_reviews
      WHERE user_id = ${userId} AND service_id = ${serviceId} AND booking_id = ${bookingId}
    `;
  } else {
    rows = await sql`
      SELECT id FROM service_reviews
      WHERE user_id = ${userId} AND service_id = ${serviceId}
    `;
  }
  return rows.length > 0;
}

/**
 * Get review statistics for a service
 */
export async function getServiceReviewStats(
  serviceId: string,
): Promise<ReviewStats> {
  // Get average and total
  const statsResult = await sql`
    SELECT 
      COALESCE(AVG(rating), 0) as average_rating,
      COUNT(*) as total_reviews
    FROM service_reviews
    WHERE service_id = ${serviceId} AND is_approved = true
  `;

  // Get rating distribution
  const distributionResult = await sql`
    SELECT rating, COUNT(*) as count
    FROM service_reviews
    WHERE service_id = ${serviceId} AND is_approved = true
    GROUP BY rating
    ORDER BY rating
  `;

  const distribution: ReviewStats["rating_distribution"] = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (const row of distributionResult) {
    distribution[row.rating as 1 | 2 | 3 | 4 | 5] = parseInt(row.count);
  }

  return {
    average_rating: parseFloat(statsResult[0]?.average_rating || "0"),
    total_reviews: parseInt(statsResult[0]?.total_reviews || "0"),
    rating_distribution: distribution,
  };
}

/**
 * Mark a review as helpful
 */
export async function markReviewHelpful(
  reviewId: string,
  userId: string,
): Promise<{ success: boolean; alreadyVoted: boolean }> {
  // Check if already voted
  const existing = await sql`
    SELECT id FROM review_helpful_votes
    WHERE review_id = ${reviewId} AND user_id = ${userId}
  `;

  if (existing.length > 0) {
    return { success: false, alreadyVoted: true };
  }

  // Add vote and increment count
  await sql`
    INSERT INTO review_helpful_votes (review_id, user_id)
    VALUES (${reviewId}, ${userId})
  `;

  await sql`
    UPDATE service_reviews
    SET helpful_count = helpful_count + 1
    WHERE id = ${reviewId}
  `;

  return { success: true, alreadyVoted: false };
}

/**
 * Remove helpful vote from a review
 */
export async function removeReviewHelpful(
  reviewId: string,
  userId: string,
): Promise<boolean> {
  const result = await sql`
    DELETE FROM review_helpful_votes
    WHERE review_id = ${reviewId} AND user_id = ${userId}
  `;

  if (result.count > 0) {
    await sql`
      UPDATE service_reviews
      SET helpful_count = GREATEST(helpful_count - 1, 0)
      WHERE id = ${reviewId}
    `;
    return true;
  }
  return false;
}

/**
 * Check if user has voted a review as helpful
 */
export async function hasUserVotedHelpful(
  reviewId: string,
  userId: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM review_helpful_votes
    WHERE review_id = ${reviewId} AND user_id = ${userId}
  `;
  return rows.length > 0;
}

// ============== ADMIN QUERIES ==============

/**
 * Get all reviews (for admin moderation)
 */
export async function getAllReviews(
  options: {
    limit?: number;
    offset?: number;
    onlyPending?: boolean;
  } = {},
): Promise<{ reviews: ServiceReview[]; total: number }> {
  const { limit = 20, offset = 0, onlyPending = false } = options;

  const countResult = await sql`
    SELECT COUNT(*) as total
    FROM service_reviews
    ${onlyPending ? sql`WHERE is_approved = false` : sql``}
  `;
  const total = parseInt(countResult[0]?.total || "0");

  const reviews = await sql`
    SELECT r.*, u.name as user_name, s.name as service_name
    FROM service_reviews r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN services s ON r.service_id = s.id
    ${onlyPending ? sql`WHERE r.is_approved = false` : sql``}
    ORDER BY r.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return {
    reviews: reviews as unknown as ServiceReview[],
    total,
  };
}

/**
 * Approve or reject a review (admin)
 */
export async function moderateReview(
  reviewId: string,
  approved: boolean,
): Promise<ServiceReview | null> {
  const rows = await sql`
    UPDATE service_reviews
    SET is_approved = ${approved}, updated_at = now()
    WHERE id = ${reviewId}
    RETURNING *
  `;
  return rows.length ? (rows[0] as ServiceReview) : null;
}

/**
 * Get top testimonials for homepage display
 * Returns highly-rated, approved reviews with user name, city, and service name
 */
export async function getTopTestimonials(limit: number = 5) {
  const rows = await sql`
    SELECT 
      r.id, r.rating, r.title, r.review_text, r.is_verified_purchase, r.created_at,
      u.name as user_name,
      s.name as service_name,
      (SELECT a.city FROM addresses a WHERE a.user_id = r.user_id ORDER BY a.is_primary DESC, a.created_at DESC LIMIT 1) as user_city
    FROM service_reviews r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN services s ON r.service_id = s.id
    WHERE r.is_approved = true
      AND r.rating = 5
      AND r.review_text IS NOT NULL
      AND r.review_text != ''
    ORDER BY r.helpful_count DESC, r.created_at DESC
    LIMIT ${limit}
  `;
  return rows;
}
