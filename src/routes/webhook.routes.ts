import { Router } from "express";
import { razorpayWebhook } from "../services/booking.service";

const router = Router();

/**
 * @route   POST /api/webhooks/razorpay
 * @desc    Razorpay webhook for payment events (server-to-server)
 * @access  Public (verified via signature)
 *
 * Events handled:
 * - payment.captured: Payment successful
 * - payment.failed: Payment failed
 * - refund.processed: Refund completed
 */
router.post("/razorpay", razorpayWebhook);

export default router;
