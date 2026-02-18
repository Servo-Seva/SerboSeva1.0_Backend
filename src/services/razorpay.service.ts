import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export interface CreateOrderParams {
  amount: number; // in paisa (₹100 = 10000)
  currency?: string;
  receipt: string; // booking order_number
  notes?: Record<string, string>;
}

export interface VerifyPaymentParams {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RefundParams {
  paymentId: string;
  amount?: number; // in paisa, optional for partial refund
  notes?: Record<string, string>;
}

/**
 * Create a Razorpay order for online payment
 */
export async function createRazorpayOrder(params: CreateOrderParams) {
  const { amount, currency = "INR", receipt, notes } = params;

  const order = await razorpay.orders.create({
    amount, // in paisa
    currency,
    receipt,
    notes: notes || {},
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    receipt: order.receipt,
    status: order.status,
  };
}

/**
 * Verify Razorpay payment signature
 * CRITICAL: Must verify before confirming booking
 */
export function verifyRazorpaySignature(params: VerifyPaymentParams): boolean {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");

  return expectedSignature === razorpay_signature;
}

/**
 * Fetch payment details from Razorpay
 */
export async function fetchPaymentDetails(paymentId: string) {
  const payment = await razorpay.payments.fetch(paymentId);
  return payment;
}

/**
 * Create refund for a payment
 */
export async function createRefund(params: RefundParams) {
  const { paymentId, amount, notes } = params;

  const refundOptions: any = {
    notes: notes || {},
  };

  // If amount specified, it's a partial refund
  if (amount) {
    refundOptions.amount = amount;
  }

  const refund = await razorpay.payments.refund(paymentId, refundOptions);

  return {
    refundId: refund.id,
    paymentId: refund.payment_id,
    amount: refund.amount,
    currency: refund.currency,
    status: refund.status,
  };
}

/**
 * Verify webhook signature from Razorpay
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return expectedSignature === signature;
}

export default razorpay;
