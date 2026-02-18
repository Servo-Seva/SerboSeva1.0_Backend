import express from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireAdmin } from "../middlewares/admin.middleware";
import {
  createReview,
  getReviewById,
  getServiceReviews,
  getUserReviews,
  updateReview,
  deleteReview,
  hasUserReviewed,
  getServiceReviewStats,
  markReviewHelpful,
  removeReviewHelpful,
  hasUserVotedHelpful,
  getAllReviews,
  moderateReview,
  getTopTestimonials,
} from "../models/review.model";
import { uploadToSupabase } from "../supabaseStorage";

const router = express.Router();

// Configure multer for memory storage (we'll upload to Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5, // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Review images bucket
const REVIEW_IMAGES_BUCKET = "review-images";

// ============== PUBLIC ROUTES ==============

/**
 * GET /api/testimonials
 * Get top-rated reviews for homepage testimonials section
 * Query params: limit (default 10)
 */
router.get("/testimonials", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const testimonials = await getTopTestimonials(limit);

    res.json({
      success: true,
      data: testimonials,
    });
  } catch (err: any) {
    console.error("Error fetching testimonials:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch testimonials",
    });
  }
});

/**
 * GET /api/services/:serviceId/reviews
 * Get all reviews for a service (paginated)
 * Query params: limit, offset, sortBy (newest|oldest|highest|lowest|helpful)
 */
router.get("/services/:serviceId/reviews", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sortBy as string) || "newest";

    const { reviews, total } = await getServiceReviews(serviceId, {
      limit,
      offset,
      sortBy: sortBy as any,
      onlyApproved: true,
    });

    res.json({
      success: true,
      data: {
        reviews,
        total,
        limit,
        offset,
        hasMore: offset + reviews.length < total,
      },
    });
  } catch (err: any) {
    console.error("Error fetching service reviews:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch reviews",
    });
  }
});

/**
 * GET /api/services/:serviceId/reviews/stats
 * Get review statistics for a service (average rating, distribution)
 */
router.get("/services/:serviceId/reviews/stats", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const stats = await getServiceReviewStats(serviceId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    console.error("Error fetching review stats:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch review statistics",
    });
  }
});

/**
 * GET /api/reviews/:reviewId
 * Get a single review by ID
 */
router.get("/reviews/:reviewId", async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await getReviewById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    res.json({
      success: true,
      data: review,
    });
  } catch (err: any) {
    console.error("Error fetching review:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch review",
    });
  }
});

// ============== AUTHENTICATED USER ROUTES ==============

/**
 * POST /api/reviews/upload-images
 * Upload review images to Supabase storage
 * Returns array of public URLs
 */
router.post(
  "/reviews/upload-images",
  requireAuth,
  upload.array("images", 5),
  async (req, res) => {
    try {
      const userId = (req as any).userId;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No images provided",
        });
      }

      console.log(
        `[ReviewAPI] Uploading ${files.length} images for user ${userId}`,
      );

      const uploadedUrls: string[] = [];

      for (const file of files) {
        const ext = file.originalname.split(".").pop()?.toLowerCase() || "jpg";
        const storagePath = `reviews/${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        const publicUrl = await uploadToSupabase(
          file.buffer,
          storagePath,
          file.mimetype,
          REVIEW_IMAGES_BUCKET,
        );

        uploadedUrls.push(publicUrl);
      }

      console.log(
        `[ReviewAPI] Successfully uploaded ${uploadedUrls.length} images`,
      );

      res.json({
        success: true,
        data: {
          urls: uploadedUrls,
        },
      });
    } catch (err: any) {
      console.error("Error uploading review images:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to upload images",
      });
    }
  },
);

/**
 * POST /api/services/:serviceId/reviews
 * Create a new review for a service
 */
router.post("/services/:serviceId/reviews", requireAuth, async (req, res) => {
  try {
    const { serviceId } = req.params;
    const userId = (req as any).userId;
    const { rating, title, review_text, booking_id, images } = req.body;

    console.log("[ReviewAPI] Creating review:", {
      serviceId,
      userId,
      rating,
      review_text,
      booking_id,
    });
    console.log("[ReviewAPI] Request body:", req.body);

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: "Rating must be between 1 and 5",
      });
    }

    // Check if user already reviewed (for this booking if provided)
    const alreadyReviewed = await hasUserReviewed(
      userId,
      serviceId,
      booking_id,
    );
    console.log("[ReviewAPI] Already reviewed check:", alreadyReviewed);
    if (alreadyReviewed) {
      return res.status(400).json({
        success: false,
        error: "You have already reviewed this service",
      });
    }

    const review = await createReview({
      service_id: serviceId,
      user_id: userId,
      booking_id,
      rating,
      title,
      review_text,
      is_verified_purchase: !!booking_id, // Verified if booking_id is provided
      images,
    });

    console.log("[ReviewAPI] Review created successfully:", review.id);

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (err: any) {
    console.error("Error creating review:", err);
    res.status(500).json({
      success: false,
      error: "Failed to create review",
    });
  }
});

/**
 * GET /api/user/reviews
 * Get all reviews by the current user
 */
router.get("/user/reviews", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const reviews = await getUserReviews(userId);

    res.json({
      success: true,
      data: reviews,
    });
  } catch (err: any) {
    console.error("Error fetching user reviews:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch your reviews",
    });
  }
});

/**
 * GET /api/services/:serviceId/reviews/check
 * Check if current user has reviewed a service
 */
router.get(
  "/services/:serviceId/reviews/check",
  requireAuth,
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const userId = (req as any).userId;
      const bookingId = req.query.bookingId as string | undefined;

      const hasReviewed = await hasUserReviewed(userId, serviceId, bookingId);

      res.json({
        success: true,
        data: { hasReviewed },
      });
    } catch (err: any) {
      console.error("Error checking review status:", err);
      res.status(500).json({
        success: false,
        error: "Failed to check review status",
      });
    }
  },
);

/**
 * PATCH /api/reviews/:reviewId
 * Update a review (only by the owner)
 */
router.patch("/reviews/:reviewId", requireAuth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = (req as any).userId;
    const { rating, title, review_text, images } = req.body;

    // Check if review exists and belongs to user
    const existingReview = await getReviewById(reviewId);
    if (!existingReview) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    if (existingReview.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: "You can only edit your own reviews",
      });
    }

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        error: "Rating must be between 1 and 5",
      });
    }

    const updatedReview = await updateReview(reviewId, {
      rating,
      title,
      review_text,
      images,
    });

    res.json({
      success: true,
      data: updatedReview,
    });
  } catch (err: any) {
    console.error("Error updating review:", err);
    res.status(500).json({
      success: false,
      error: "Failed to update review",
    });
  }
});

/**
 * DELETE /api/reviews/:reviewId
 * Delete a review (only by the owner)
 */
router.delete("/reviews/:reviewId", requireAuth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = (req as any).userId;

    // Check if review exists and belongs to user
    const existingReview = await getReviewById(reviewId);
    if (!existingReview) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    if (existingReview.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: "You can only delete your own reviews",
      });
    }

    await deleteReview(reviewId);

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (err: any) {
    console.error("Error deleting review:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete review",
    });
  }
});

/**
 * POST /api/reviews/:reviewId/helpful
 * Mark a review as helpful
 */
router.post("/reviews/:reviewId/helpful", requireAuth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = (req as any).userId;

    const result = await markReviewHelpful(reviewId, userId);

    if (result.alreadyVoted) {
      return res.status(400).json({
        success: false,
        error: "You have already marked this review as helpful",
      });
    }

    res.json({
      success: true,
      message: "Review marked as helpful",
    });
  } catch (err: any) {
    console.error("Error marking review as helpful:", err);
    res.status(500).json({
      success: false,
      error: "Failed to mark review as helpful",
    });
  }
});

/**
 * DELETE /api/reviews/:reviewId/helpful
 * Remove helpful vote from a review
 */
router.delete("/reviews/:reviewId/helpful", requireAuth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = (req as any).userId;

    const removed = await removeReviewHelpful(reviewId, userId);

    if (!removed) {
      return res.status(400).json({
        success: false,
        error: "You haven't marked this review as helpful",
      });
    }

    res.json({
      success: true,
      message: "Helpful vote removed",
    });
  } catch (err: any) {
    console.error("Error removing helpful vote:", err);
    res.status(500).json({
      success: false,
      error: "Failed to remove helpful vote",
    });
  }
});

/**
 * GET /api/reviews/:reviewId/helpful/check
 * Check if current user has voted a review as helpful
 */
router.get(
  "/reviews/:reviewId/helpful/check",
  requireAuth,
  async (req, res) => {
    try {
      const { reviewId } = req.params;
      const userId = (req as any).userId;

      const hasVoted = await hasUserVotedHelpful(reviewId, userId);

      res.json({
        success: true,
        data: { hasVoted },
      });
    } catch (err: any) {
      console.error("Error checking helpful vote:", err);
      res.status(500).json({
        success: false,
        error: "Failed to check helpful vote",
      });
    }
  },
);

// ============== ADMIN ROUTES ==============

/**
 * GET /api/admin/reviews
 * Get all reviews (for moderation)
 * Query params: limit, offset, onlyPending
 */
router.get("/admin/reviews", requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const onlyPending = req.query.onlyPending === "true";

    const { reviews, total } = await getAllReviews({
      limit,
      offset,
      onlyPending,
    });

    res.json({
      success: true,
      data: {
        reviews,
        total,
        limit,
        offset,
        hasMore: offset + reviews.length < total,
      },
    });
  } catch (err: any) {
    console.error("Error fetching all reviews:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch reviews",
    });
  }
});

/**
 * PATCH /api/admin/reviews/:reviewId/moderate
 * Approve or reject a review
 */
router.patch(
  "/admin/reviews/:reviewId/moderate",
  requireAdmin,
  async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { approved } = req.body;

      if (typeof approved !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "approved field must be a boolean",
        });
      }

      const review = await moderateReview(reviewId, approved);

      if (!review) {
        return res.status(404).json({
          success: false,
          error: "Review not found",
        });
      }

      res.json({
        success: true,
        data: review,
        message: approved ? "Review approved" : "Review rejected",
      });
    } catch (err: any) {
      console.error("Error moderating review:", err);
      res.status(500).json({
        success: false,
        error: "Failed to moderate review",
      });
    }
  },
);

/**
 * DELETE /api/admin/reviews/:reviewId
 * Delete any review (admin)
 */
router.delete("/admin/reviews/:reviewId", requireAdmin, async (req, res) => {
  try {
    const { reviewId } = req.params;

    const deleted = await deleteReview(reviewId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (err: any) {
    console.error("Error deleting review (admin):", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete review",
    });
  }
});

export default router;
