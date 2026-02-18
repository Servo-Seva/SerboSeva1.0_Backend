/**
 * SMS Service for SerboSeva
 * Supports multiple SMS providers: MSG91, Twilio, Fast2SMS
 * Used for mobile OTP verification and notifications
 */

import axios from "axios";

// Configuration
const SMS_PROVIDER = process.env.SMS_PROVIDER || "fast2sms"; // 'msg91', 'twilio', 'fast2sms'
const SMS_API_KEY = process.env.SMS_API_KEY || "";
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || "SVOSVA";
const SMS_TEMPLATE_ID = process.env.SMS_TEMPLATE_ID || "";

// For Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";

// Test mode for development
const SMS_TEST_MODE = process.env.SMS_TEST_MODE === "true";

// OTP storage (in production, use Redis or database)
const otpStore: Map<
  string,
  { otp: string; expiresAt: number; attempts: number }
> = new Map();

// Clean up expired OTPs every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of otpStore.entries()) {
      if (value.expiresAt < now) {
        otpStore.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

/**
 * Generate a random 6-digit OTP
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  // If it's a 10-digit number, assume Indian and add +91
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  // If it already has country code
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+${cleaned}`;
  }
  return `+${cleaned}`;
}

/**
 * Send SMS via MSG91
 */
async function sendViaMSG91(phone: string, message: string): Promise<boolean> {
  try {
    const response = await axios.post(
      "https://control.msg91.com/api/v5/flow/",
      {
        template_id: SMS_TEMPLATE_ID,
        sender: SMS_SENDER_ID,
        mobiles: phone.replace("+", ""),
        VAR1: message, // Template variable
      },
      {
        headers: {
          authkey: SMS_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data?.type === "success";
  } catch (error: any) {
    console.error("MSG91 Error:", error.response?.data || error.message);
    return false;
  }
}

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(phone: string, message: string): Promise<boolean> {
  try {
    const client = require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: phone,
    });
    return true;
  } catch (error: any) {
    console.error("Twilio Error:", error.message);
    return false;
  }
}

/**
 * Send SMS via Fast2SMS (Popular Indian provider)
 */
async function sendViaFast2SMS(
  phone: string,
  message: string,
): Promise<boolean> {
  try {
    const cleanPhone = phone.replace("+91", "").replace("+", "");
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "q", // Quick SMS route
        message: message,
        language: "english",
        flash: 0,
        numbers: cleanPhone,
      },
      {
        headers: {
          authorization: SMS_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data?.return === true;
  } catch (error: any) {
    console.error("Fast2SMS Error:", error.response?.data || error.message);
    return false;
  }
}

/**
 * Send SMS using configured provider
 */
export async function sendSMS(
  phone: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const formattedPhone = formatPhoneNumber(phone);

  if (SMS_TEST_MODE) {
    console.log(`[SMS TEST MODE] To: ${formattedPhone}`);
    console.log(`[SMS TEST MODE] Message: ${message}`);
    return { success: true };
  }

  if (!SMS_API_KEY) {
    console.warn("SMS API key not configured. Message not sent.");
    return { success: false, error: "SMS service not configured" };
  }

  let success = false;

  switch (SMS_PROVIDER.toLowerCase()) {
    case "msg91":
      success = await sendViaMSG91(formattedPhone, message);
      break;
    case "twilio":
      success = await sendViaTwilio(formattedPhone, message);
      break;
    case "fast2sms":
    default:
      success = await sendViaFast2SMS(formattedPhone, message);
      break;
  }

  return {
    success,
    error: success ? undefined : "Failed to send SMS",
  };
}

/**
 * Send OTP to phone number
 */
export async function sendOTP(phone: string): Promise<{
  success: boolean;
  message: string;
  otp?: string; // Only returned in test mode
  requestId?: string;
}> {
  const formattedPhone = formatPhoneNumber(phone);
  const key = `otp:${formattedPhone}`;

  // Check if OTP was recently sent (rate limiting)
  const existing = otpStore.get(key);
  if (existing && existing.expiresAt > Date.now() + 8 * 60 * 1000) {
    // OTP was sent less than 2 minutes ago
    return {
      success: false,
      message: "Please wait 2 minutes before requesting a new OTP",
    };
  }

  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

  // Store OTP
  otpStore.set(key, { otp, expiresAt, attempts: 0 });

  // Prepare message
  const message = `Your SerboSeva verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`;

  // Send SMS
  const result = await sendSMS(phone, message);

  if (result.success) {
    return {
      success: true,
      message: "OTP sent successfully",
      requestId: key,
      ...(SMS_TEST_MODE ? { otp } : {}), // Return OTP only in test mode
    };
  } else {
    otpStore.delete(key); // Clean up on failure
    return {
      success: false,
      message: result.error || "Failed to send OTP",
    };
  }
}

/**
 * Verify OTP
 */
export async function verifyOTP(
  phone: string,
  otp: string,
): Promise<{
  success: boolean;
  message: string;
}> {
  const formattedPhone = formatPhoneNumber(phone);
  const key = `otp:${formattedPhone}`;

  const stored = otpStore.get(key);

  if (!stored) {
    return {
      success: false,
      message: "OTP expired or not found. Please request a new OTP.",
    };
  }

  // Check expiry
  if (stored.expiresAt < Date.now()) {
    otpStore.delete(key);
    return {
      success: false,
      message: "OTP has expired. Please request a new OTP.",
    };
  }

  // Check attempts (max 3)
  if (stored.attempts >= 3) {
    otpStore.delete(key);
    return {
      success: false,
      message: "Too many incorrect attempts. Please request a new OTP.",
    };
  }

  // Verify OTP
  if (stored.otp === otp) {
    otpStore.delete(key); // Clear after successful verification
    return {
      success: true,
      message: "OTP verified successfully",
    };
  } else {
    // Increment attempts
    stored.attempts++;
    otpStore.set(key, stored);
    return {
      success: false,
      message: `Incorrect OTP. ${3 - stored.attempts} attempts remaining.`,
    };
  }
}

/**
 * Send registration confirmation with provider ID
 */
export async function sendRegistrationConfirmation(
  phone: string,
  name: string,
  providerId: string,
): Promise<{ success: boolean; error?: string }> {
  const message = `Dear ${name}, your SerboSeva provider registration is submitted successfully! Your Registration ID is: ${providerId.slice(0, 8).toUpperCase()}. Track status at: SerboSeva.com/provider-status. Team SerboSeva`;

  return await sendSMS(phone, message);
}

/**
 * Send approval notification
 */
export async function sendApprovalNotification(
  phone: string,
  name: string,
  approved: boolean,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  let message: string;

  if (approved) {
    message = `Congratulations ${name}! Your SerboSeva provider account has been approved. You can now start accepting service requests. Download the app to get started. Team SerboSeva`;
  } else {
    message = `Dear ${name}, your SerboSeva provider application was not approved. Reason: ${reason || "Documents verification failed"}. Please resubmit your documents. Team SerboSeva`;
  }

  return await sendSMS(phone, message);
}

export default {
  sendSMS,
  sendOTP,
  verifyOTP,
  sendRegistrationConfirmation,
  sendApprovalNotification,
};
