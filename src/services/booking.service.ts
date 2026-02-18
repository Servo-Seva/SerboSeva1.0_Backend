import { Request, Response, NextFunction } from "express";
import sql from "../db";
import crypto from "crypto";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  createRefund,
  verifyWebhookSignature,
  fetchPaymentDetails,
} from "../services/razorpay.service";
import { emitToAdmins } from "./socket.service";

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface BookingService {
  service_id: string;
  service_name: string;
  quantity: number;
  price: number;
  category?: string;
  image_url?: string;
}

export interface DeliveryAddress {
  full_name?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  phone?: string;
}

export interface SlotInfo {
  date: string;
  time: string;
}

export interface CheckoutItem {
  service: BookingService;
  slot: SlotInfo;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate human-readable order number: SS-YYYYMMDD-XXXX-RANDOM
 * Uses random suffix to avoid collisions in concurrent transactions
 */
function generateOrderNumber(): string {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

  // Use timestamp + random to ensure uniqueness
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `SS-${dateStr}-${timestamp.slice(-4)}${random}`;
}

/**
 * Generate 6-digit OTP for service verification
 */
function generateServiceOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Parse booking from database row
 */
function parseBooking(row: any) {
  if (!row) return null;
  return {
    ...row,
    service:
      typeof row.service === "string" ? JSON.parse(row.service) : row.service,
    delivery_address:
      typeof row.delivery_address === "string"
        ? JSON.parse(row.delivery_address)
        : row.delivery_address,
  };
}

/**
 * Calculate booking expiry time (15 minutes for online payment)
 */
function getPaymentExpiryTime(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 15);
  return expiry;
}

// =====================================================
// MAIN CHECKOUT API - Supports both COD & Online
// =====================================================

/**
 * POST /api/bookings/checkout
 *
 * Main checkout endpoint - Creates bookings based on payment mode
 *
 * For COD: Creates confirmed bookings immediately
 * For ONLINE: Creates pending bookings + Razorpay order
 */
export const checkout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      items, // Array of { service, slot }
      delivery_address,
      address_id,
      payment_mode, // 'cod' | 'online'
      promo_code,
      discount_amount = 0,
      tip_amount = 0,
      customer_notes,
      idempotency_key, // Prevent duplicate bookings
    } = req.body;

    // ===== VALIDATION =====

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items array is required" });
    }

    if (
      !delivery_address?.line1 ||
      !delivery_address?.city ||
      !delivery_address?.state ||
      !delivery_address?.pincode
    ) {
      return res
        .status(400)
        .json({ error: "Complete delivery address is required" });
    }

    if (!payment_mode || !["cod", "online"].includes(payment_mode)) {
      return res
        .status(400)
        .json({ error: "Payment mode must be 'cod' or 'online'" });
    }

    // Validate each item
    for (const item of items) {
      if (
        !item.service?.service_id ||
        !item.service?.service_name ||
        !item.service?.quantity ||
        !item.service?.price
      ) {
        return res.status(400).json({ error: "Invalid service data in items" });
      }
      if (!item.slot?.date || !item.slot?.time) {
        return res
          .status(400)
          .json({ error: "Slot date and time required for each item" });
      }
    }

    // ===== IDEMPOTENCY CHECK =====

    if (idempotency_key) {
      const existing = await sql`
        SELECT batch_id FROM bookings 
        WHERE idempotency_key = ${idempotency_key}
        LIMIT 1
      `;

      if (existing.length > 0) {
        // Return existing batch
        const bookings = await sql`
          SELECT * FROM bookings WHERE batch_id = ${existing[0].batch_id}
        `;
        return res.status(200).json({
          success: true,
          message: "Booking already exists (idempotent)",
          batch_id: existing[0].batch_id,
          bookings: bookings.map(parseBooking),
        });
      }
    }

    // ===== PROMO CODE VALIDATION =====

    let promoId = null;
    let appliedDiscount = discount_amount;

    if (promo_code) {
      const promo = await sql`
        SELECT * FROM promo_codes 
        WHERE code = ${promo_code.toUpperCase()} 
          AND is_active = true
          AND (valid_until IS NULL OR valid_until > NOW())
          AND (usage_limit IS NULL OR used_count < usage_limit)
      `;

      if (promo.length === 0) {
        return res.status(400).json({ error: "Invalid or expired promo code" });
      }

      // Check user usage limit (default 1 use per user if not tracked separately)
      const userUsage = await sql`
        SELECT COUNT(*) as count FROM promo_code_usage 
        WHERE promo_id = ${promo[0].id} AND user_id = ${userId}
      `;

      const maxUsesPerUser = 1; // Default limit per user
      if (parseInt(userUsage[0].count) >= maxUsesPerUser) {
        return res
          .status(400)
          .json({ error: "Promo code usage limit exceeded" });
      }

      promoId = promo[0].id;
    }

    // ===== CALCULATE TOTALS =====

    const subtotal = items.reduce(
      (sum: number, item: CheckoutItem) =>
        sum + item.service.price * item.service.quantity,
      0,
    );

    const taxRate = 0; // Adjust based on your tax requirements
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal - appliedDiscount + tip_amount + taxAmount;

    // ===== HANDLE BASED ON PAYMENT MODE =====

    if (payment_mode === "online") {
      // ===== ONLINE PAYMENT: Store pending checkout, don't create booking yet =====
      const expiresAt = getPaymentExpiryTime();

      try {
        // Create Razorpay order first
        const tempReceipt = `SS-${Date.now().toString(36).toUpperCase()}`;
        const razorpayOrder = await createRazorpayOrder({
          amount: Math.round(totalAmount * 100), // Convert to paisa
          currency: "INR",
          receipt: tempReceipt,
          notes: {
            user_id: userId,
            items_count: items.length.toString(),
            promo_code: promo_code || "",
          },
        });

        // Store checkout data in pending_checkouts table (booking created only after payment)
        const checkoutData = {
          items,
          delivery_address,
          address_id,
          customer_notes,
          discount_amount: appliedDiscount,
          tip_amount,
          tax_amount: taxAmount,
        };

        await sql`
          INSERT INTO pending_checkouts (
            user_id,
            pg_order_id,
            checkout_data,
            total_amount,
            promo_id,
            promo_code,
            discount_amount,
            tip_amount,
            idempotency_key,
            expires_at
          ) VALUES (
            ${userId},
            ${razorpayOrder.orderId},
            ${JSON.stringify(checkoutData)},
            ${totalAmount},
            ${promoId},
            ${promo_code?.toUpperCase() || null},
            ${appliedDiscount},
            ${tip_amount},
            ${idempotency_key || null},
            ${expiresAt}
          )
        `;

        // Return Razorpay order details (NO booking created yet)
        return res.status(200).json({
          success: true,
          payment_mode: "online",
          message: "Complete payment to confirm booking",
          total_amount: totalAmount,
          // Empty bookings array - booking will be created after payment
          bookings: [],
          batch_id: razorpayOrder.orderId, // Use order_id as reference
          payment: {
            gateway: "razorpay",
            order_id: razorpayOrder.orderId,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
            expires_at: expiresAt,
          },
        });
      } catch (error: any) {
        console.error("Razorpay order creation failed:", error);
        return res.status(500).json({
          error: "Payment gateway error. Please try again.",
          details: error.message,
        });
      }
    }

    // ===== COD PAYMENT: Create bookings immediately =====

    const batchId = crypto.randomUUID();
    const expiresAt = null;

    // Distribute discount and tip across items
    const discountPerItem =
      items.length > 0 ? appliedDiscount / items.length : 0;
    const tipPerItem = items.length > 0 ? tip_amount / items.length : 0;
    const taxPerItem = items.length > 0 ? taxAmount / items.length : 0;

    const createdBookings = await sql.begin(async (tx) => {
      const bookings: any[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const orderNumber = generateOrderNumber();
        const serviceOTP = generateServiceOTP();

        const itemSubtotal = item.service.price * item.service.quantity;
        const itemTotal = Math.max(
          0,
          itemSubtotal - discountPerItem + tipPerItem + taxPerItem,
        );

        const [booking] = await tx`
          INSERT INTO bookings (
            batch_id,
            order_number,
            user_id,
            service,
            subtotal,
            discount_amount,
            tip_amount,
            tax_amount,
            total_amount,
            currency,
            address_id,
            delivery_address,
            booking_date,
            time_slot,
            status,
            payment_mode,
            payment_status,
            promo_code,
            promo_id,
            service_otp,
            customer_notes,
            idempotency_key,
            expires_at
          ) VALUES (
            ${batchId},
            ${orderNumber},
            ${userId},
            ${JSON.stringify(item.service)},
            ${itemSubtotal},
            ${discountPerItem},
            ${tipPerItem},
            ${taxPerItem},
            ${itemTotal},
            'INR',
            ${address_id || null},
            ${JSON.stringify(delivery_address)},
            ${item.slot.date},
            ${item.slot.time},
            'confirmed',
            'cod',
            'pending',
            ${promo_code?.toUpperCase() || null},
            ${promoId},
            ${serviceOTP},
            ${customer_notes || null},
            ${i === 0 ? idempotency_key : null},
            ${expiresAt}
          )
          RETURNING *
        `;

        bookings.push(booking);
      }

      // Record promo code usage
      if (promoId && bookings.length > 0) {
        await tx`
          INSERT INTO promo_code_usage (promo_id, user_id, booking_id, discount_applied)
          VALUES (${promoId}, ${userId}, ${bookings[0].id}, ${appliedDiscount})
        `;

        await tx`
          UPDATE promo_codes SET used_count = used_count + 1 
          WHERE id = ${promoId}
        `;
      }

      return bookings;
    });

    // ===== COD RESPONSE =====

    const response: any = {
      success: true,
      batch_id: batchId,
      bookings_count: createdBookings.length,
      payment_mode: "cod",
      total_amount: totalAmount,
      bookings: createdBookings.map(parseBooking),
      message: "Booking confirmed! Pay after service completion.",
    };

    // Notify admins about new booking in real-time
    // Send each booking separately for easier frontend handling
    for (const booking of createdBookings) {
      const parsedBooking = parseBooking(booking);
      emitToAdmins("booking:new", {
        id: parsedBooking.id,
        order_number: parsedBooking.order_number,
        status: parsedBooking.status,
        payment_mode: parsedBooking.payment_mode,
        payment_status: parsedBooking.payment_status,
        service: parsedBooking.service,
        delivery_address: parsedBooking.delivery_address,
        booking_date: parsedBooking.booking_date,
        time_slot: parsedBooking.time_slot,
        final_amount: parsedBooking.total_amount, // DB column is total_amount
        created_at: parsedBooking.created_at,
      });
      console.log(
        `✅ Admin notified about new COD booking ${parsedBooking.id}`,
      );
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("Checkout error:", error);
    next(error);
  }
};

// =====================================================
// VERIFY ONLINE PAYMENT - Called after Razorpay payment
// =====================================================

/**
 * POST /api/bookings/verify-payment
 *
 * Called by frontend after successful Razorpay payment
 * Verifies signature and CREATES booking (booking not created until payment verified)
 */
export const verifyPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      batch_id, // This is now the razorpay order_id
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ error: "Missing payment verification data" });
    }

    // ===== VERIFY SIGNATURE =====

    const isValid = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isValid) {
      console.error("Razorpay signature verification failed");
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // ===== GET PENDING CHECKOUT DATA =====

    const pendingCheckouts = await sql`
      SELECT * FROM pending_checkouts 
      WHERE pg_order_id = ${razorpay_order_id} 
        AND user_id = ${userId}
    `;

    if (pendingCheckouts.length === 0) {
      // Check if booking already exists (idempotency)
      const existingBookings = await sql`
        SELECT * FROM bookings 
        WHERE pg_order_id = ${razorpay_order_id} 
          AND user_id = ${userId}
      `;

      if (existingBookings.length > 0) {
        return res.json({
          success: true,
          message: "Booking already confirmed",
          bookings: existingBookings.map(parseBooking),
        });
      }

      return res.status(404).json({
        error: "Checkout session not found or expired",
      });
    }

    const pendingCheckout = pendingCheckouts[0];
    const checkoutData =
      typeof pendingCheckout.checkout_data === "string"
        ? JSON.parse(pendingCheckout.checkout_data)
        : pendingCheckout.checkout_data;

    // ===== CREATE BOOKINGS NOW (Payment verified) =====

    const batchId = crypto.randomUUID();
    const items = checkoutData.items;
    const delivery_address = checkoutData.delivery_address;
    const address_id = checkoutData.address_id;
    const customer_notes = checkoutData.customer_notes;
    const discountAmount = pendingCheckout.discount_amount || 0;
    const tipAmount = pendingCheckout.tip_amount || 0;
    const taxAmount = checkoutData.tax_amount || 0;

    const discountPerItem =
      items.length > 0 ? discountAmount / items.length : 0;
    const tipPerItem = items.length > 0 ? tipAmount / items.length : 0;
    const taxPerItem = items.length > 0 ? taxAmount / items.length : 0;

    const createdBookings = await sql.begin(async (tx) => {
      const bookings: any[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const orderNumber = generateOrderNumber();
        const serviceOTP = generateServiceOTP();

        const itemSubtotal = item.service.price * item.service.quantity;
        const itemTotal = Math.max(
          0,
          itemSubtotal - discountPerItem + tipPerItem + taxPerItem,
        );

        const [booking] = await tx`
          INSERT INTO bookings (
            batch_id,
            order_number,
            user_id,
            service,
            subtotal,
            discount_amount,
            tip_amount,
            tax_amount,
            total_amount,
            currency,
            address_id,
            delivery_address,
            booking_date,
            time_slot,
            status,
            payment_mode,
            payment_status,
            payment_gateway,
            pg_order_id,
            pg_payment_id,
            pg_signature,
            promo_code,
            promo_id,
            service_otp,
            customer_notes,
            idempotency_key
          ) VALUES (
            ${batchId},
            ${orderNumber},
            ${userId},
            ${JSON.stringify(item.service)},
            ${itemSubtotal},
            ${discountPerItem},
            ${tipPerItem},
            ${taxPerItem},
            ${itemTotal},
            'INR',
            ${address_id || null},
            ${JSON.stringify(delivery_address)},
            ${item.slot.date},
            ${item.slot.time},
            'confirmed',
            'online',
            'paid',
            'razorpay',
            ${razorpay_order_id},
            ${razorpay_payment_id},
            ${razorpay_signature},
            ${pendingCheckout.promo_code || null},
            ${pendingCheckout.promo_id || null},
            ${serviceOTP},
            ${customer_notes || null},
            ${i === 0 ? pendingCheckout.idempotency_key : null}
          )
          RETURNING *
        `;

        bookings.push(booking);
      }

      // Record promo code usage
      if (pendingCheckout.promo_id && bookings.length > 0) {
        await tx`
          INSERT INTO promo_code_usage (promo_id, user_id, booking_id, discount_applied)
          VALUES (${pendingCheckout.promo_id}, ${userId}, ${bookings[0].id}, ${discountAmount})
        `;

        await tx`
          UPDATE promo_codes SET used_count = used_count + 1 
          WHERE id = ${pendingCheckout.promo_id}
        `;
      }

      // Create payment transaction record
      await tx`
        INSERT INTO payment_transactions (
          booking_id,
          transaction_type,
          amount,
          currency,
          payment_gateway,
          pg_order_id,
          pg_payment_id,
          pg_signature,
          status,
          completed_at
        ) VALUES (
          ${bookings[0].id},
          'payment',
          ${pendingCheckout.total_amount},
          'INR',
          'razorpay',
          ${razorpay_order_id},
          ${razorpay_payment_id},
          ${razorpay_signature},
          'success',
          NOW()
        )
      `;

      // Delete the pending checkout (booking created successfully)
      await tx`
        DELETE FROM pending_checkouts WHERE pg_order_id = ${razorpay_order_id}
      `;

      return bookings;
    });

    // ===== NOTIFY ADMINS =====

    for (const booking of createdBookings) {
      const parsedBooking = parseBooking(booking);
      emitToAdmins("booking:new", {
        id: parsedBooking.id,
        order_number: parsedBooking.order_number,
        status: parsedBooking.status,
        payment_mode: parsedBooking.payment_mode,
        payment_status: parsedBooking.payment_status,
        service: parsedBooking.service,
        delivery_address: parsedBooking.delivery_address,
        booking_date: parsedBooking.booking_date,
        time_slot: parsedBooking.time_slot,
        final_amount: parsedBooking.total_amount,
        created_at: parsedBooking.created_at,
      });
      console.log(
        `✅ Admin notified about new confirmed booking ${parsedBooking.id}`,
      );
    }

    res.json({
      success: true,
      message: "Payment verified and booking confirmed!",
      batch_id: batchId,
      bookings: createdBookings.map(parseBooking),
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    next(error);
  }
};

// =====================================================
// RAZORPAY WEBHOOK - Server-to-server verification
// =====================================================

/**
 * POST /api/webhooks/razorpay
 *
 * Webhook endpoint for Razorpay events
 * Handles: payment.captured, payment.failed, refund.processed
 */
export const razorpayWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

    // Verify webhook signature
    const isValid = verifyWebhookSignature(
      JSON.stringify(req.body),
      signature,
      webhookSecret,
    );

    if (!isValid) {
      console.error("Invalid Razorpay webhook signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    switch (event) {
      case "payment.captured": {
        const payment = payload.payment.entity;
        const orderId = payment.order_id;
        const paymentId = payment.id;

        // Check if booking already exists (frontend already called verifyPayment)
        const existingBookings = await sql`
          SELECT id FROM bookings WHERE pg_order_id = ${orderId}
        `;

        if (existingBookings.length > 0) {
          // Booking exists, just update payment status if needed
          await sql`
            UPDATE bookings 
            SET payment_status = 'paid',
                pg_payment_id = ${paymentId},
                updated_at = NOW()
            WHERE pg_order_id = ${orderId}
              AND payment_status != 'paid'
          `;
          console.log(
            `Webhook: Payment already processed for order ${orderId}`,
          );
        } else {
          // Booking doesn't exist yet - create from pending_checkouts
          // This handles edge cases where frontend didn't call verifyPayment
          const pendingCheckouts = await sql`
            SELECT * FROM pending_checkouts WHERE pg_order_id = ${orderId}
          `;

          if (pendingCheckouts.length > 0) {
            const pendingCheckout = pendingCheckouts[0];
            const checkoutData =
              typeof pendingCheckout.checkout_data === "string"
                ? JSON.parse(pendingCheckout.checkout_data)
                : pendingCheckout.checkout_data;

            const batchId = crypto.randomUUID();
            const items = checkoutData.items;
            const delivery_address = checkoutData.delivery_address;
            const address_id = checkoutData.address_id;
            const customer_notes = checkoutData.customer_notes;
            const discountAmount = pendingCheckout.discount_amount || 0;
            const tipAmount = pendingCheckout.tip_amount || 0;
            const taxAmount = checkoutData.tax_amount || 0;

            const discountPerItem =
              items.length > 0 ? discountAmount / items.length : 0;
            const tipPerItem = items.length > 0 ? tipAmount / items.length : 0;
            const taxPerItem = items.length > 0 ? taxAmount / items.length : 0;

            await sql.begin(async (tx) => {
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const orderNumber = generateOrderNumber();
                const serviceOTP = generateServiceOTP();

                const itemSubtotal = item.service.price * item.service.quantity;
                const itemTotal = Math.max(
                  0,
                  itemSubtotal - discountPerItem + tipPerItem + taxPerItem,
                );

                await tx`
                  INSERT INTO bookings (
                    batch_id, order_number, user_id, service, subtotal,
                    discount_amount, tip_amount, tax_amount, total_amount,
                    currency, address_id, delivery_address, booking_date,
                    time_slot, status, payment_mode, payment_status,
                    payment_gateway, pg_order_id, pg_payment_id,
                    promo_code, promo_id, service_otp, customer_notes,
                    idempotency_key
                  ) VALUES (
                    ${batchId}, ${orderNumber}, ${pendingCheckout.user_id},
                    ${JSON.stringify(item.service)}, ${itemSubtotal},
                    ${discountPerItem}, ${tipPerItem}, ${taxPerItem}, ${itemTotal},
                    'INR', ${address_id || null}, ${JSON.stringify(delivery_address)},
                    ${item.slot.date}, ${item.slot.time}, 'confirmed', 'online', 'paid',
                    'razorpay', ${orderId}, ${paymentId},
                    ${pendingCheckout.promo_code || null}, ${pendingCheckout.promo_id || null},
                    ${serviceOTP}, ${customer_notes || null},
                    ${i === 0 ? pendingCheckout.idempotency_key : null}
                  )
                `;
              }

              // Delete the pending checkout
              await tx`DELETE FROM pending_checkouts WHERE pg_order_id = ${orderId}`;
            });

            console.log(
              `Webhook: Created booking from pending checkout for order ${orderId}`,
            );
          }
        }

        console.log(`Payment captured for order ${orderId}`);
        break;
      }

      case "payment.failed": {
        const payment = payload.payment.entity;
        const orderId = payment.order_id;
        const errorCode = payment.error_code;
        const errorDescription = payment.error_description;

        // Delete pending checkout on payment failure (don't create booking)
        await sql`
          DELETE FROM pending_checkouts WHERE pg_order_id = ${orderId}
        `;

        // Also update any existing bookings (shouldn't exist in new flow, but for safety)
        await sql`
          UPDATE bookings 
          SET status = 'failed',
              payment_status = 'failed',
              updated_at = NOW()
          WHERE pg_order_id = ${orderId}
            AND status = 'pending_payment'
        `;

        console.log(`Payment failed for order ${orderId}: ${errorDescription}`);
        break;
      }

      case "refund.processed": {
        const refund = payload.refund.entity;
        const paymentId = refund.payment_id;
        const refundId = refund.id;
        const refundAmount = refund.amount / 100; // Convert from paisa

        await sql`
          UPDATE bookings 
          SET refund_status = 'processed',
              refund_id = ${refundId},
              refund_amount = refund_amount + ${refundAmount},
              refunded_at = NOW(),
              payment_status = CASE 
                WHEN refund_amount + ${refundAmount} >= total_amount THEN 'refunded'
                ELSE 'partially_refunded'
              END
          WHERE pg_payment_id = ${paymentId}
        `;

        await sql`
          INSERT INTO payment_transactions (
            booking_id,
            transaction_type,
            amount,
            payment_gateway,
            pg_payment_id,
            pg_refund_id,
            status,
            gateway_response,
            completed_at
          )
          SELECT 
            id,
            'refund',
            ${refundAmount},
            'razorpay',
            ${paymentId},
            ${refundId},
            'success',
            ${JSON.stringify(refund)},
            NOW()
          FROM bookings 
          WHERE pg_payment_id = ${paymentId}
          LIMIT 1
        `;

        console.log(`Refund processed: ${refundId}`);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    // Always respond 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    // Still respond 200 to prevent retries for processing errors
    res.status(200).json({ received: true, error: "Processing error" });
  }
};

// =====================================================
// CANCEL BOOKING WITH REFUND
// =====================================================

/**
 * POST /api/bookings/:id/cancel
 *
 * Cancel a booking with optional refund
 */
export const cancelBookingWithRefund = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { cancellation_reason } = req.body;

    // Find booking
    const bookings = await sql`
      SELECT * FROM bookings 
      WHERE id = ${id} AND user_id = ${userId}
    `;

    if (bookings.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = bookings[0];

    // Check if cancellable
    const nonCancellableStatuses = ["completed", "cancelled", "in_progress"];
    if (nonCancellableStatuses.includes(booking.status)) {
      return res.status(400).json({
        error: `Cannot cancel booking with status: ${booking.status}`,
      });
    }

    // Calculate refund amount based on cancellation policy
    let refundAmount = 0;
    let refundPercentage = 100;

    if (booking.payment_status === "paid") {
      // Cancellation policy
      const bookingDate = new Date(booking.booking_date);
      const now = new Date();
      const hoursUntilService =
        (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilService > 24) {
        refundPercentage = 100; // Full refund
      } else if (hoursUntilService > 6) {
        refundPercentage = 50; // 50% refund
      } else {
        refundPercentage = 0; // No refund
      }

      refundAmount =
        (parseFloat(booking.total_amount) * refundPercentage) / 100;
    }

    // Process refund if applicable
    let refundResult = null;
    if (refundAmount > 0 && booking.pg_payment_id) {
      try {
        refundResult = await createRefund({
          paymentId: booking.pg_payment_id,
          amount: Math.round(refundAmount * 100), // Convert to paisa
          notes: {
            booking_id: id,
            reason: cancellation_reason || "User requested cancellation",
          },
        });
      } catch (error: any) {
        console.error("Refund error:", error);
        // Don't block cancellation if refund fails
      }
    }

    // Update booking
    const [updated] = await sql`
      UPDATE bookings 
      SET status = 'cancelled',
          cancelled_at = NOW(),
          cancellation_reason = ${cancellation_reason || "User requested cancellation"},
          cancelled_by = 'user',
          refund_amount = ${refundAmount},
          refund_status = ${refundResult ? "initiated" : "none"},
          refund_id = ${refundResult?.refundId || null}
      WHERE id = ${id}
      RETURNING *
    `;

    res.json({
      success: true,
      message: "Booking cancelled",
      booking: parseBooking(updated),
      refund: refundResult
        ? {
            amount: refundAmount,
            percentage: refundPercentage,
            status: "initiated",
            refund_id: refundResult.refundId,
          }
        : null,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    next(error);
  }
};

// =====================================================
// EXPIRED BOOKINGS CLEANUP JOB
// =====================================================

/**
 * Cleanup job to cancel expired pending_payment bookings
 * Should be run via cron every 5 minutes
 */
export async function cleanupExpiredBookings() {
  try {
    const expired = await sql`
      UPDATE bookings 
      SET status = 'failed',
          payment_status = 'failed',
          cancellation_reason = 'Payment timeout',
          cancelled_by = 'system',
          cancelled_at = NOW()
      WHERE status = 'pending_payment'
        AND expires_at < NOW()
      RETURNING id, order_number
    `;

    if (expired.length > 0) {
      console.log(`Cancelled ${expired.length} expired bookings`);
    }

    return expired;
  } catch (error) {
    console.error("Cleanup expired bookings error:", error);
    throw error;
  }
}

// =====================================================
// GET USER BOOKINGS
// =====================================================

/**
 * Parse booking from database row with service thumbnail fallback
 */
function parseBookingWithImage(row: any) {
  if (!row) return null;
  console.log(row);

  let service;
  try {
    service =
      typeof row.service === "string" ? JSON.parse(row.service) : row.service;
  } catch (e) {
    console.error("Error parsing primary service JSON:", e);
    service = {};
  }

  // Handle double-encoded JSON if necessary (sometimes happens with manual inserts/migrations)
  if (typeof service === "string") {
    try {
      service = JSON.parse(service);
    } catch (e) {
      console.error("Failed to parse double-encoded service JSON:", e);
      // Try to recover if it's not JSON but just a string
      service = { name: service };
    }
  }

  // Ensure service is an object
  if (!service || typeof service !== "object") {
    service = {};
  }

  // ALWAYS use thumbnail from services table (images are stored there, not in bookings)
  if (row.service.thumbnail_url) {
    service.image_url = row.service.thumbnail_url;
  }
  console.log("row.service_thumbnail:", row.thumbnail_url);

  return {
    ...row,
    service,
    delivery_address:
      typeof row.delivery_address === "string"
        ? JSON.parse(row.delivery_address)
        : row.delivery_address,
    // Remove the extra column from response
    // service_thumbnail: undefined,
  };
}

export const getUserBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { status, limit = 20, offset = 0 } = req.query;

    let result;
    if (status) {
      result = await sql`
        SELECT b.*, 
               s.thumbnail_url as service_thumbnail,
               p.name as provider_name,
               p.phone as provider_phone,
               p.email as provider_email,
               COALESCE(
                 (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
                 p.avatar_url
               ) as provider_photo
        FROM bookings b
        LEFT JOIN services s ON s.id::text = ((b.service #>> '{}')::jsonb->>'service_id')
        LEFT JOIN providers p ON b.provider_id = p.id
        WHERE b.user_id = ${userId} AND b.status = ${status as string}
        ORDER BY b.created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    } else {
      result = await sql`
        SELECT b.*, 
               s.thumbnail_url as service_thumbnail,
               p.name as provider_name,
               p.phone as provider_phone,
               p.email as provider_email,
               COALESCE(
                 (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
                 p.avatar_url
               ) as provider_photo
        FROM bookings b
        LEFT JOIN services s ON s.id::text = ((b.service #>> '{}')::jsonb->>'service_id')
        LEFT JOIN providers p ON b.provider_id = p.id
        WHERE b.user_id = ${userId}
        ORDER BY b.created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    }

    console.log("getUserBookings: Raw result rows:", result.length);
    if (result.length > 0) {
      console.log(
        "getUserBookings: First row provider_id:",
        result[0].provider_id,
      );
      console.log(
        "getUserBookings: First row provider_name:",
        result[0].provider_name,
      );
      console.log(
        "getUserBookings: First row provider_phone:",
        result[0].provider_phone,
      );
    }

    // Parse bookings and include provider info
    const bookings = result.map((row: any) => {
      const booking = parseBookingWithImage(row);
      if (row.provider_id) {
        booking.provider = {
          id: row.provider_id,
          name: row.provider_name,
          phone: row.provider_phone,
          email: row.provider_email,
          photo_url: row.provider_photo,
        };
        console.log(
          "getUserBookings: Added provider to booking:",
          booking.id,
          booking.provider,
        );
      }
      return booking;
    });

    res.json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    next(error);
  }
};

// =====================================================
// GET BOOKING BY ID
// =====================================================

export const getBookingById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const result = await sql`
      SELECT b.*, 
             p.name as provider_name,
             p.phone as provider_phone,
             COALESCE(
               (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
               p.avatar_url
             ) as provider_photo,
             p.email as provider_email,
             p.specializations as provider_specializations,
             r.id as review_id,
             r.rating as review_rating,
             r.review_text as review_text
      FROM bookings b
      LEFT JOIN providers p ON b.provider_id = p.id
      LEFT JOIN service_reviews r ON r.booking_id = b.id::text AND r.user_id = b.user_id::uuid
      WHERE b.id = ${id} AND b.user_id = ${userId}
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = parseBooking(result[0]);

    // Add review info if exists
    if (result[0].review_id) {
      booking.review = {
        id: result[0].review_id,
        rating: result[0].review_rating,
        review_text: result[0].review_text,
      };
    }

    // Add provider info if assigned
    if (result[0].provider_id) {
      booking.provider = {
        id: result[0].provider_id,
        name: result[0].provider_name,
        phone: result[0].provider_phone,
        email: result[0].provider_email,
        photo_url: result[0].provider_photo,
        specializations:
          typeof result[0].provider_specializations === "string"
            ? JSON.parse(result[0].provider_specializations)
            : result[0].provider_specializations,
      };
    }

    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Get booking error:", error);
    next(error);
  }
};

// =====================================================
// VERIFY SERVICE OTP (for provider)
// =====================================================

export const verifyServiceOTP = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }

    const result = await sql`
      UPDATE bookings 
      SET otp_verified_at = NOW(),
          status = 'in_progress',
          started_at = NOW()
      WHERE id = ${id} 
        AND service_otp = ${otp}
        AND status = 'assigned'
        AND otp_verified_at IS NULL
      RETURNING *
    `;

    if (result.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid OTP or booking not ready" });
    }

    res.json({
      success: true,
      message: "OTP verified, service started",
      booking: parseBooking(result[0]),
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    next(error);
  }
};

// =====================================================
// COMPLETE SERVICE (for provider)
// =====================================================

export const completeService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { provider_notes } = req.body;

    const result = await sql`
      UPDATE bookings 
      SET status = 'completed',
          completed_at = NOW(),
          provider_notes = ${provider_notes || null},
          payment_status = CASE 
            WHEN payment_mode = 'cod' AND payment_status = 'pending' THEN 'paid'
            ELSE payment_status
          END
      WHERE id = ${id} 
        AND status = 'in_progress'
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(400).json({ error: "Booking not in progress" });
    }

    res.json({
      success: true,
      message: "Service completed",
      booking: parseBooking(result[0]),
    });
  } catch (error) {
    console.error("Complete service error:", error);
    next(error);
  }
};
