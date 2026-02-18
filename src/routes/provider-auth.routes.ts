/**
 * Provider Authentication Routes
 * Handles provider login, session management, and dashboard data
 * Uses Firebase Phone OTP (same as user auth) - no custom SMS needed
 */

import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import sql from "../db";
import admin from "../firebaseAdmin";
import {
  notifyUserBookingUpdate,
  emitToAdmins,
} from "../services/socket.service";

const router = Router();

// ============== TYPES ==============

interface ProviderSession {
  providerId: string;
  name: string;
  phone: string;
  provider_type: string;
  status: string;
}

// ============== MIDDLEWARE ==============

/**
 * Verify provider JWT token
 */
export const authenticateProvider = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token =
      req.cookies?.provider_token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      providerId: string;
      type: string;
    };

    if (decoded.type !== "provider") {
      return res.status(403).json({ error: "Invalid token type" });
    }

    // Fetch provider details
    const [provider] = await sql`
      SELECT id, name, phone, email, provider_type, status, kyc_status
      FROM providers
      WHERE id = ${decoded.providerId}
    `;

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    (req as any).provider = provider;
    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Session expired. Please login again." });
    }
    return res.status(401).json({ error: "Invalid authentication token" });
  }
};

// ============== AUTH ROUTES ==============

/**
 * Check if provider exists with this phone number
 * GET /api/provider-auth/check-phone/:phone
 */
router.get(
  "/check-phone/:phone",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone } = req.params;

      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const cleaned = phone.replace(/\D/g, "");
      if (cleaned.length !== 10) {
        return res
          .status(400)
          .json({ error: "Please enter a valid 10-digit phone number" });
      }

      // Check if provider exists with this phone
      const [provider] = await sql`
      SELECT id, name, status, kyc_status FROM providers WHERE phone = ${cleaned}
    `;

      if (!provider) {
        return res.status(404).json({
          exists: false,
          error: "No provider account found with this phone number",
          suggestion: "Please register first at /provider-registration",
        });
      }

      res.json({
        exists: true,
        provider_status: provider.status,
        name: provider.name,
      });
    } catch (error: any) {
      console.error("Check phone error:", error);
      next(error);
    }
  },
);

/**
 * Firebase OTP Login for Providers
 * POST /api/provider-auth/firebase-login
 * Frontend sends Firebase ID token after phone OTP verification
 */
router.post(
  "/firebase-login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firebaseToken } = req.body;

      if (!firebaseToken) {
        return res.status(400).json({ error: "Firebase token is required" });
      }

      // 1️⃣ Verify Firebase token
      const decoded = await admin.auth().verifyIdToken(firebaseToken);
      console.log("Provider Firebase login - decoded token:", decoded.uid);

      let phone = decoded.phone_number;

      // If phone missing, fetch from Firebase user record
      if (!phone) {
        try {
          const userRecord = await admin.auth().getUser(decoded.uid);
          if (userRecord.phoneNumber) phone = userRecord.phoneNumber;
        } catch (fetchErr) {
          console.error("Failed to fetch Firebase user record:", fetchErr);
        }
      }

      if (!phone) {
        return res.status(400).json({
          error: "Phone number is required for provider login",
          message: "Please use phone OTP authentication",
        });
      }

      // Extract 10-digit phone (remove +91)
      const cleanedPhone = phone.replace(/^\+91/, "").replace(/\D/g, "");

      // 2️⃣ Check if provider exists with this phone
      const [provider] = await sql`
      SELECT id, name, phone, email, provider_type, status, kyc_status, created_at
      FROM providers
      WHERE phone = ${cleanedPhone}
    `;

      if (!provider) {
        return res.status(404).json({
          error: "No provider account found with this phone number",
          suggestion: "Please register first at /provider-registration",
          phone: cleanedPhone,
        });
      }

      // 3️⃣ Generate JWT token
      const token = jwt.sign(
        {
          providerId: provider.id,
          type: "provider",
          name: provider.name,
          firebaseUid: decoded.uid,
        },
        process.env.JWT_SECRET as string,
        { expiresIn: "30d" },
      );

      // 4️⃣ Set cookie
      const isProd = process.env.NODE_ENV === "production";
      res.cookie("provider_token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // 5️⃣ Log login
      try {
        await sql`
        INSERT INTO provider_activity_log (provider_id, action, ip_address)
        VALUES (${provider.id}, 'logged_in_firebase', ${req.ip || null})
      `;
      } catch (logErr) {
        console.warn("Could not log provider login:", logErr);
      }

      console.log(`Provider ${provider.name} logged in via Firebase OTP`);

      res.json({
        success: true,
        message: "Login successful",
        provider: {
          id: provider.id,
          name: provider.name,
          phone: provider.phone,
          email: provider.email,
          provider_type: provider.provider_type,
          status: provider.status,
          kyc_status: provider.kyc_status,
        },
        token, // Also send token in response for mobile apps
      });
    } catch (error: any) {
      console.error("Provider Firebase login error:", error);

      if (error.code === "auth/id-token-expired") {
        return res
          .status(401)
          .json({ error: "Token expired. Please try again." });
      }
      if (error.code === "auth/argument-error") {
        return res.status(400).json({ error: "Invalid token format" });
      }

      next(error);
    }
  },
);

/**
 * Get current provider session
 * GET /api/provider-auth/me
 */
router.get("/me", authenticateProvider, async (req: Request, res: Response) => {
  const provider = (req as any).provider;
  res.json({
    authenticated: true,
    provider: {
      id: provider.id,
      name: provider.name,
      phone: provider.phone,
      email: provider.email,
      provider_type: provider.provider_type,
      status: provider.status,
      kyc_status: provider.kyc_status,
    },
  });
});

/**
 * Logout provider
 * POST /api/provider-auth/logout
 */
router.post("/logout", (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("provider_token", {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  res.json({ success: true, message: "Logged out successfully" });
});

// ============== DASHBOARD DATA ROUTES ==============

/**
 * Get payment configuration (UPI ID, etc.)
 * GET /api/provider-auth/config/payment-details
 */
router.get(
  "/config/payment-details",
  authenticateProvider,
  async (req: Request, res: Response) => {
    res.json({
      upi_id: process.env.COMPANY_UPI_ID || "SerboSeva@upi",
    });
  },
);

/**
 * Get provider dashboard stats
 * GET /api/provider-auth/dashboard/stats
 */
router.get(
  "/dashboard/stats",
  authenticateProvider,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = (req as any).provider;

      // Check if provider is approved
      if (provider.status !== "approved" && provider.status !== "active") {
        return res.json({
          approved: false,
          status: provider.status,
          kyc_status: provider.kyc_status,
          message:
            provider.status === "pending"
              ? "Your account is pending approval"
              : "Your account is not approved",
        });
      }

      // Get booking statistics
      // Provider earns 95% of total_amount (5% platform commission deducted)
      const stats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_bookings,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_bookings,
        COUNT(*) FILTER (WHERE status IN ('in_progress', 'in-progress', 'assigned')) as in_progress_bookings,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
        COUNT(*) as total_bookings,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount * 0.95 ELSE 0 END), 0) as total_earnings
      FROM bookings
      WHERE provider_id = ${provider.id}
    `;

      // Get today's bookings count
      const todayStats = await sql`
      SELECT COUNT(*) as today_bookings
      FROM bookings
      WHERE provider_id = ${provider.id}
        AND booking_date = CURRENT_DATE
        AND status NOT IN ('cancelled', 'completed')
    `;

      // Get average rating from bookings (since service_reviews doesn't have provider_id)
      const ratingStats = await sql`
      SELECT 
        COALESCE(AVG(sr.rating), 0) as average_rating,
        COUNT(sr.id) as total_reviews
      FROM service_reviews sr
      INNER JOIN bookings b ON b.id::text = sr.booking_id
      WHERE b.provider_id = ${provider.id}
    `;

      res.json({
        approved: true,
        stats: {
          pending: parseInt(stats[0]?.pending_bookings || "0"),
          confirmed: parseInt(stats[0]?.confirmed_bookings || "0"),
          in_progress: parseInt(stats[0]?.in_progress_bookings || "0"),
          completed: parseInt(stats[0]?.completed_bookings || "0"),
          cancelled: parseInt(stats[0]?.cancelled_bookings || "0"),
          total: parseInt(stats[0]?.total_bookings || "0"),
          total_earnings: parseFloat(stats[0]?.total_earnings || "0"),
          today_bookings: parseInt(todayStats[0]?.today_bookings || "0"),
          average_rating: parseFloat(
            ratingStats[0]?.average_rating || "0",
          ).toFixed(1),
          total_reviews: parseInt(ratingStats[0]?.total_reviews || "0"),
        },
      });
    } catch (error: any) {
      console.error("Dashboard stats error:", error);
      next(error);
    }
  },
);

/**
 * Get provider's bookings
 * GET /api/provider-auth/dashboard/bookings
 */
router.get(
  "/dashboard/bookings",
  authenticateProvider,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = (req as any).provider;
      const { status, page = 1, limit = 20 } = req.query;

      if (provider.status !== "approved" && provider.status !== "active") {
        return res.status(403).json({ error: "Account not approved" });
      }

      const offset = (Number(page) - 1) * Number(limit);

      let bookings;
      if (status && status !== "all") {
        bookings = await sql`
        SELECT 
          b.id, b.id as order_number, b.status, b.total_amount, 
          b.payment_mode, b.payment_status,
          b.booking_date as scheduled_date, b.time_slot as scheduled_time, b.created_at,
          b.delivery_address,
          u.name as customer_name, u.phone as customer_phone,
          b.service as items
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id::text
        WHERE b.provider_id = ${provider.id}
          AND b.status = ${String(status)}
        ORDER BY b.booking_date DESC, b.time_slot DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
      } else {
        bookings = await sql`
        SELECT 
          b.id, b.id as order_number, b.status, b.total_amount, 
          b.payment_mode, b.payment_status,
          b.booking_date as scheduled_date, b.time_slot as scheduled_time, b.created_at,
          b.delivery_address,
          u.name as customer_name, u.phone as customer_phone,
          b.service as items
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id::text
        WHERE b.provider_id = ${provider.id}
        ORDER BY 
          CASE 
            WHEN b.status IN ('in_progress', 'in-progress', 'assigned') THEN 1
            WHEN b.status = 'confirmed' THEN 2
            WHEN b.status = 'pending' THEN 3
            ELSE 4
          END,
          b.booking_date ASC, b.time_slot ASC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
      }

      // Get total count
      let countResult;
      if (status && status !== "all") {
        countResult = await sql`
        SELECT COUNT(*) as total
        FROM bookings
        WHERE provider_id = ${provider.id} AND status = ${String(status)}
      `;
      } else {
        countResult = await sql`
        SELECT COUNT(*) as total
        FROM bookings
        WHERE provider_id = ${provider.id}
      `;
      }

      // Parse JSONB fields properly
      const parsedBookings = bookings.map((booking: any) => ({
        ...booking,
        items:
          typeof booking.items === "string"
            ? JSON.parse(booking.items)
            : booking.items,
        delivery_address:
          typeof booking.delivery_address === "string"
            ? JSON.parse(booking.delivery_address)
            : booking.delivery_address,
      }));

      res.json({
        bookings: parsedBookings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: parseInt(countResult[0]?.total || "0"),
          pages: Math.ceil(
            parseInt(countResult[0]?.total || "0") / Number(limit),
          ),
        },
      });
    } catch (error: any) {
      console.error("Get bookings error:", error);
      next(error);
    }
  },
);

/**
 * Update booking status (provider action)
 * PATCH /api/provider-auth/dashboard/bookings/:bookingId/status
 */
router.patch(
  "/dashboard/bookings/:bookingId/status",
  authenticateProvider,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = (req as any).provider;
      const { bookingId } = req.params;
      let { status, notes } = req.body;

      if (provider.status !== "approved" && provider.status !== "active") {
        return res.status(403).json({ error: "Account not approved" });
      }

      // Normalize status - convert in-progress to in_progress for database
      if (status === "in-progress") {
        status = "in_progress";
      }

      const validStatuses = [
        "confirmed",
        "in_progress",
        "in-progress",
        "completed",
        "cancelled",
        "provider_cancelled",
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // Verify booking belongs to provider
      const [booking] = await sql`
      SELECT id, status, provider_id FROM bookings WHERE id = ${bookingId}
    `;

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.provider_id !== provider.id) {
        return res
          .status(403)
          .json({ error: "This booking is not assigned to you" });
      }

      // Normalize for database storage
      const dbStatus = status === "in-progress" ? "in_progress" : status;

      // If provider is cancelling, use provider_cancelled status and remove provider assignment
      // This keeps the booking active for admin to reassign
      if (status === "cancelled") {
        const [updated] = await sql`
          UPDATE bookings
          SET 
            status = 'provider_cancelled',
            provider_id = NULL,
            updated_at = NOW()
          WHERE id = ${bookingId}
          RETURNING *
        `;

        // Get user_id from booking for notification
        const userId = booking.user_id || updated.user_id;

        // Emit real-time update to customer via Socket.io
        if (userId) {
          notifyUserBookingUpdate(userId, bookingId, {
            id: updated.id,
            status: "provider_cancelled",
            updated_at: updated.updated_at,
            message:
              "Your provider cancelled. We're finding a new provider for you.",
          });
        }

        // Notify admins urgently about provider cancellation
        emitToAdmins("booking:provider-cancelled", {
          bookingId,
          status: "provider_cancelled",
          previousProviderId: provider.id,
          previousProviderName: provider.name,
          updatedAt: updated.updated_at,
          urgent: true,
          message: `Provider ${provider.name} cancelled booking #${bookingId.slice(0, 8)}. Needs reassignment.`,
        });

        return res.json({
          success: true,
          message: "Booking declined. Admin will reassign another provider.",
          booking: updated,
        });
      }

      // Update booking status
      const [updated] = await sql`
      UPDATE bookings
      SET 
        status = ${dbStatus},
        updated_at = NOW()
        ${dbStatus === "completed" ? sql`, completed_at = NOW()` : sql``}
      WHERE id = ${bookingId}
      RETURNING *
    `;

      // Get user_id from booking for notification
      const userId = booking.user_id || updated.user_id;

      // Emit real-time update to customer via Socket.io
      if (userId) {
        notifyUserBookingUpdate(userId, bookingId, {
          id: updated.id,
          status: updated.status,
          updated_at: updated.updated_at,
          completed_at: updated.completed_at,
        });
      }

      // Also notify admins
      emitToAdmins("booking:status-updated", {
        bookingId,
        status: updated.status,
        providerId: provider.id,
        providerName: provider.name,
        updatedAt: updated.updated_at,
      });

      res.json({
        success: true,
        message: `Booking ${status}`,
        booking: updated,
      });
    } catch (error: any) {
      console.error("Update booking status error:", error);
      next(error);
    }
  },
);

/**
 * Update payment status (for COD orders)
 * PATCH /api/provider-auth/dashboard/bookings/:bookingId/payment-status
 */
router.patch(
  "/dashboard/bookings/:bookingId/payment-status",
  authenticateProvider,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = (req as any).provider;
      const { bookingId } = req.params;
      const { payment_status } = req.body;

      if (provider.status !== "approved" && provider.status !== "active") {
        return res.status(403).json({ error: "Account not approved" });
      }

      const validStatuses = ["pending", "paid", "failed", "refunded"];
      if (!validStatuses.includes(payment_status)) {
        return res.status(400).json({ error: "Invalid payment status" });
      }

      // Verify booking belongs to provider and is COD
      const [booking] = await sql`
        SELECT id, status, provider_id, payment_mode, payment_status, user_id 
        FROM bookings WHERE id = ${bookingId}
      `;

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.provider_id !== provider.id) {
        return res
          .status(403)
          .json({ error: "This booking is not assigned to you" });
      }

      if (booking.payment_mode !== "cod") {
        return res
          .status(400)
          .json({ error: "Payment status can only be updated for COD orders" });
      }

      // Allow payment collection when service is in progress (before completing)
      if (
        booking.status !== "in_progress" &&
        booking.status !== "in-progress" &&
        booking.status !== "completed"
      ) {
        return res.status(400).json({
          error: "Service must be in progress or completed to collect payment",
        });
      }

      // Update payment status
      const [updated] = await sql`
        UPDATE bookings
        SET 
          payment_status = ${payment_status},
          updated_at = NOW()
        WHERE id = ${bookingId}
        RETURNING *
      `;

      // Emit real-time update to customer
      const userId = booking.user_id;
      if (userId) {
        notifyUserBookingUpdate(userId, bookingId, {
          id: updated.id,
          payment_status: updated.payment_status,
          updated_at: updated.updated_at,
        });
      }

      // Notify admins
      emitToAdmins("booking:payment-updated", {
        bookingId,
        paymentStatus: updated.payment_status,
        providerId: provider.id,
        providerName: provider.name,
        updatedAt: updated.updated_at,
      });

      res.json({
        success: true,
        message: "Payment status updated",
        booking: updated,
      });
    } catch (error: any) {
      console.error("Update payment status error:", error);
      next(error);
    }
  },
);

/**
 * Get single booking details
 * GET /api/provider-auth/dashboard/bookings/:bookingId
 */
router.get(
  "/dashboard/bookings/:bookingId",
  authenticateProvider,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = (req as any).provider;
      const { bookingId } = req.params;

      const [booking] = await sql`
      SELECT 
        b.*,
        u.name as customer_name, u.phone as customer_phone, u.email as customer_email
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id::text
      WHERE b.id = ${bookingId} AND b.provider_id = ${provider.id}
    `;

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      res.json({ booking });
    } catch (error: any) {
      console.error("Get booking details error:", error);
      next(error);
    }
  },
);

export default router;
