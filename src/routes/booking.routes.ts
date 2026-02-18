import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  createBooking,
  createBatchBookings,
  getUserBookings,
  getUserBookingBatches,
  updateBookingStatus,
  updatePaymentStatus,
  updateBatchPaymentStatus,
  cancelBooking,
  cancelBatchBookings,
  rescheduleBooking,
  updateBookingAddress,
} from "../models/booking.model";
import {
  checkout,
  verifyPayment,
  cancelBookingWithRefund,
  verifyServiceOTP,
  completeService,
  getBookingById,
} from "../services/booking.service";

const router = Router();

// =====================================================
// PUBLIC ROUTES (No auth required for webhooks)
// =====================================================

// Razorpay webhook is handled in a separate route file

// =====================================================
// AUTHENTICATED ROUTES
// =====================================================
router.use(requireAuth);

/**
 * @route   GET /api/bookings/config/payment-details
 * @desc    Get payment configuration details (UPI ID, etc.)
 * @access  Private
 */
router.get("/config/payment-details", (req, res) => {
  res.json({
    upi_id: process.env.COMPANY_UPI_ID || "SerboSeva@upi",
  });
});

/**
 * @route   POST /api/bookings/checkout
 * @desc    Main checkout endpoint - Creates bookings with COD or Online payment
 * @access  Private
 * @body    {
 *   items: Array<{ service: {...}, slot: {date, time} }>,
 *   delivery_address: {...},
 *   payment_mode: 'cod' | 'online',
 *   promo_code?: string,
 *   discount_amount?: number,
 *   tip_amount?: number,
 *   idempotency_key?: string
 * }
 * @returns For COD: { bookings, batch_id }
 *          For ONLINE: { bookings, batch_id, payment: { order_id, amount, key_id } }
 */
router.post("/checkout", checkout);

/**
 * @route   POST /api/bookings/verify-payment
 * @desc    Verify Razorpay payment after successful frontend payment
 * @access  Private
 * @body    { razorpay_order_id, razorpay_payment_id, razorpay_signature, batch_id }
 */
router.post("/verify-payment", verifyPayment);

/**
 * @route   POST /api/bookings/:id/cancel
 * @desc    Cancel booking with automatic refund calculation
 * @access  Private
 * @body    { cancellation_reason?: string }
 */
router.post("/:id/cancel", cancelBookingWithRefund);

/**
 * @route   POST /api/bookings/:id/verify-otp
 * @desc    Verify service OTP (for provider to start service)
 * @access  Private (Provider)
 * @body    { otp: string }
 */
router.post("/:id/verify-otp", verifyServiceOTP);

/**
 * @route   POST /api/bookings/:id/complete
 * @desc    Mark service as completed
 * @access  Private (Provider)
 * @body    { provider_notes?: string }
 */
router.post("/:id/complete", completeService);

/**
 * @route   POST /api/bookings/batch
 * @desc    Create multiple bookings (one per service with its own slot) - LEGACY
 * @access  Private (authenticated users)
 * @body    {
 *   items: Array<{
 *     service: {service_id, service_name, quantity, price, category?},
 *     slot: {date: string, time: string}
 *   }>,
 *   delivery_address: {line1, line2?, city, state, pincode, country?, phone?},
 *   address_id?: string,
 *   payment_method?: string,
 *   promo_code?: string,
 *   discount_amount?: number,
 *   tip_amount?: number,
 *   customer_notes?: string,
 *   currency?: string
 * }
 * @returns { batch_id, bookings_count, bookings: [...] }
 */
router.post("/batch", createBatchBookings);

/**
 * @route   POST /api/bookings
 * @desc    Create a single booking
 * @access  Private (authenticated users)
 * @body    {
 *   service: {service_id, service_name, quantity, price},
 *   total_amount: number,
 *   currency?: string,
 *   address_id?: string,
 *   delivery_address: {line1, line2?, city, state, pincode, country},
 *   booking_date: string (YYYY-MM-DD),
 *   time_slot: string (e.g., "09:00-11:00"),
 *   payment_method?: string,
 *   promo_code?: string,
 *   discount_amount?: number,
 *   tip_amount?: number,
 *   customer_notes?: string
 * }
 */
router.post("/", createBooking);

/**
 * @route   GET /api/bookings
 * @desc    Get all bookings for the authenticated user
 * @access  Private
 * @query   status?: string, batch_id?: string, limit?: number, offset?: number
 */
router.get("/", getUserBookings);

/**
 * @route   GET /api/bookings/batches
 * @desc    Get bookings grouped by batch (checkout session)
 * @access  Private
 * @query   limit?: number, offset?: number
 */
router.get("/batches", getUserBookingBatches);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get a specific booking by ID
 * @access  Private (owner only)
 */
router.get("/:id", getBookingById);

/**
 * @route   PATCH /api/bookings/:id/status
 * @desc    Update booking status
 * @access  Private (owner only)
 * @body    {status: string, cancellation_reason?: string}
 */
router.patch("/:id/status", updateBookingStatus);

/**
 * @route   PATCH /api/bookings/:id/payment
 * @desc    Update payment status for single booking
 * @access  Private (owner only)
 * @body    {payment_status: string, payment_id?: string, payment_method?: string}
 */
router.patch("/:id/payment", updatePaymentStatus);

/**
 * @route   PATCH /api/bookings/batch/:batchId/payment
 * @desc    Update payment status for all bookings in a batch
 * @access  Private (owner only)
 * @body    {payment_status: string, payment_id?: string, payment_method?: string}
 */
router.patch("/batch/:batchId/payment", updateBatchPaymentStatus);

/**
 * @route   PATCH /api/bookings/:id/address
 * @desc    Update booking delivery address
 * @access  Private (owner only)
 * @body    {delivery_address: {line1, line2?, city, state, pincode, country?, phone?, full_name?}}
 */
router.patch("/:id/address", updateBookingAddress);

/**
 * @route   PATCH /api/bookings/:id/reschedule
 * @desc    Reschedule a booking (change date/time)
 * @access  Private (owner only)
 * @body    {booking_date: string, time_slot: string}
 */
router.patch("/:id/reschedule", rescheduleBooking);

/**
 * @route   DELETE /api/bookings/:id
 * @desc    Cancel a single booking
 * @access  Private (owner only)
 * @body    {cancellation_reason?: string}
 */
router.delete("/:id", cancelBooking);

/**
 * @route   DELETE /api/bookings/batch/:batchId
 * @desc    Cancel all bookings in a batch
 * @access  Private (owner only)
 * @body    {cancellation_reason?: string}
 */
router.delete("/batch/:batchId", cancelBatchBookings);

export default router;
