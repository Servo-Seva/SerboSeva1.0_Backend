/**
 * Aadhaar Verification Service
 * Supports multiple KYC providers: Sandbox, Surepass, Signzy, Karza
 *
 * To get API keys:
 * - Sandbox: https://sandbox.co.in (free testing available)
 * - Surepass: https://surepass.io
 * - Signzy: https://signzy.com
 * - Karza: https://karza.in
 */

// Use native fetch (Node.js 18+)

const AADHAAR_API_PROVIDER = process.env.AADHAAR_API_PROVIDER || "sandbox";
const AADHAAR_API_KEY = process.env.AADHAAR_API_KEY || "";
const AADHAAR_API_SECRET = process.env.AADHAAR_API_SECRET || "";
const AADHAAR_API_BASE_URL =
  process.env.AADHAAR_API_BASE_URL || "https://api.sandbox.co.in";
const AADHAAR_TEST_MODE = process.env.AADHAAR_TEST_MODE === "true";

// Store client_ids for OTP verification (in production, use Redis)
const clientIdStore: Map<
  string,
  { clientId: string; aadhaar: string; expiresAt: number }
> = new Map();

// Clean up expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of clientIdStore.entries()) {
    if (value.expiresAt < now) {
      clientIdStore.delete(key);
    }
  }
}, 60000);

export interface AadhaarOtpResponse {
  success: boolean;
  message: string;
  clientId?: string; // Reference ID for OTP verification
  maskedMobile?: string;
  error?: string;
  devOtp?: string; // Only returned in test mode for development
}

export interface AadhaarVerifyResponse {
  success: boolean;
  message: string;
  data?: {
    name: string;
    dob?: string;
    gender?: string;
    address?: {
      house?: string;
      street?: string;
      landmark?: string;
      locality?: string;
      vtc?: string;
      district?: string;
      state?: string;
      pincode?: string;
      country?: string;
      fullAddress?: string;
    };
    photo?: string; // Base64 encoded
    maskedAadhaar?: string;
  };
  error?: string;
}

/**
 * Request OTP for Aadhaar verification
 */
export async function requestAadhaarOtp(
  aadhaarNumber: string,
): Promise<AadhaarOtpResponse> {
  const cleanAadhaar = aadhaarNumber.replace(/\D/g, "");

  if (cleanAadhaar.length !== 12) {
    return {
      success: false,
      message: "Invalid Aadhaar number",
      error: "Aadhaar must be 12 digits",
    };
  }

  // Test mode - simulate OTP request
  if (
    AADHAAR_TEST_MODE ||
    !AADHAAR_API_KEY ||
    AADHAAR_API_KEY === "your_aadhaar_api_key_here"
  ) {
    console.log("[AADHAAR] Test mode - simulating OTP request");
    const testClientId = `TEST-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store test OTP
    clientIdStore.set(testClientId, {
      clientId: testClientId,
      aadhaar: cleanAadhaar,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Store the test OTP separately for verification
    (clientIdStore.get(testClientId) as any).testOtp = testOtp;

    console.log(
      `[AADHAAR TEST] OTP for ${maskAadhaar(cleanAadhaar)}: ${testOtp}`,
    );

    return {
      success: true,
      message: "OTP sent successfully (TEST MODE)",
      clientId: testClientId,
      maskedMobile: `XXXXXX${Math.floor(1000 + Math.random() * 9000)}`,
      devOtp: testOtp, // Return OTP for testing
    };
  }

  // Production mode - call actual API
  try {
    switch (AADHAAR_API_PROVIDER.toLowerCase()) {
      case "sandbox":
        return await sandboxRequestOtp(cleanAadhaar);
      case "surepass":
        return await surepassRequestOtp(cleanAadhaar);
      default:
        return await sandboxRequestOtp(cleanAadhaar);
    }
  } catch (error: any) {
    console.error("[AADHAAR] OTP request error:", error);
    return {
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    };
  }
}

/**
 * Verify OTP and get Aadhaar details
 */
export async function verifyAadhaarOtp(
  clientId: string,
  otp: string,
): Promise<AadhaarVerifyResponse> {
  // Test mode - verify against stored test OTP
  if (
    AADHAAR_TEST_MODE ||
    !AADHAAR_API_KEY ||
    AADHAAR_API_KEY === "your_aadhaar_api_key_here"
  ) {
    console.log("[AADHAAR] Test mode - verifying OTP");

    const storedData = clientIdStore.get(clientId) as any;

    if (!storedData) {
      return {
        success: false,
        message: "OTP expired or invalid",
        error: "Session not found",
      };
    }

    if (Date.now() > storedData.expiresAt) {
      clientIdStore.delete(clientId);
      return {
        success: false,
        message: "OTP expired",
        error: "Please request a new OTP",
      };
    }

    if (storedData.testOtp !== otp.trim()) {
      return {
        success: false,
        message: "Invalid OTP",
        error: "The OTP entered is incorrect",
      };
    }

    // Success - return mock verified data
    clientIdStore.delete(clientId);

    return {
      success: true,
      message: "Aadhaar verified successfully (TEST MODE)",
      data: {
        name: "Test User",
        dob: "01-01-1990",
        gender: "M",
        address: {
          house: "123",
          street: "Test Street",
          locality: "Test Area",
          district: "Test District",
          state: "Test State",
          pincode: "123456",
          country: "India",
          fullAddress:
            "123, Test Street, Test Area, Test District, Test State - 123456",
        },
        maskedAadhaar: maskAadhaar(storedData.aadhaar),
      },
    };
  }

  // Production mode - call actual API
  try {
    switch (AADHAAR_API_PROVIDER.toLowerCase()) {
      case "sandbox":
        return await sandboxVerifyOtp(clientId, otp);
      case "surepass":
        return await surepassVerifyOtp(clientId, otp);
      default:
        return await sandboxVerifyOtp(clientId, otp);
    }
  } catch (error: any) {
    console.error("[AADHAAR] OTP verification error:", error);
    return {
      success: false,
      message: "Verification failed",
      error: error.message,
    };
  }
}

/**
 * Mask Aadhaar number for storage
 */
function maskAadhaar(aadhaar: string): string {
  const cleaned = aadhaar.replace(/\D/g, "");
  if (cleaned.length !== 12) return "XXXX-XXXX-XXXX";
  return `XXXX-XXXX-${cleaned.slice(-4)}`;
}

// ============== SANDBOX API IMPLEMENTATION ==============

async function sandboxRequestOtp(aadhaar: string): Promise<AadhaarOtpResponse> {
  console.log(`[SANDBOX] Requesting OTP for Aadhaar: ${maskAadhaar(aadhaar)}`);
  console.log(
    `[SANDBOX] API URL: ${AADHAAR_API_BASE_URL}/kyc/aadhaar/okyc/otp`,
  );

  const response = await fetch(`${AADHAAR_API_BASE_URL}/kyc/aadhaar/okyc/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: AADHAAR_API_KEY,
      "x-api-key": AADHAAR_API_KEY,
      "x-api-secret": AADHAAR_API_SECRET,
      "x-api-version": "2.0",
    },
    body: JSON.stringify({
      "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
      aadhaar_number: aadhaar,
      consent: "y",
      reason: "For KYC verification of service provider",
    }),
  });

  console.log(`[SANDBOX] Response status: ${response.status}`);

  const data = (await response.json()) as any;

  if (data.code === 200 || data.status === "success") {
    // Store the reference_id for verification
    const clientId = data.data?.ref_id || data.data?.client_id || data.ref_id;

    clientIdStore.set(clientId, {
      clientId,
      aadhaar,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return {
      success: true,
      message: data.message || "OTP sent successfully",
      clientId,
      maskedMobile: data.data?.mobile || "XXXXXX****",
    };
  }

  return {
    success: false,
    message: data.message || "Failed to send OTP",
    error: data.error || data.message,
  };
}

async function sandboxVerifyOtp(
  clientId: string,
  otp: string,
): Promise<AadhaarVerifyResponse> {
  const storedData = clientIdStore.get(clientId);

  if (!storedData) {
    return {
      success: false,
      message: "Session expired",
      error: "Please request a new OTP",
    };
  }

  console.log(`[SANDBOX] Verifying OTP for ref_id: ${clientId}`);

  const response = await fetch(
    `${AADHAAR_API_BASE_URL}/kyc/aadhaar/okyc/otp/verify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: AADHAAR_API_KEY,
        "x-api-key": AADHAAR_API_KEY,
        "x-api-secret": AADHAAR_API_SECRET,
        "x-api-version": "2.0",
      },
      body: JSON.stringify({
        "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
        reference_id: clientId,
        otp: otp,
      }),
    },
  );

  console.log(`[SANDBOX] Verify response status: ${response.status}`);

  const data = (await response.json()) as any;

  if (data.code === 200 || data.status === "success") {
    clientIdStore.delete(clientId);

    const kycData = data.data || {};

    return {
      success: true,
      message: "Aadhaar verified successfully",
      data: {
        name: kycData.name || kycData.full_name,
        dob: kycData.dob || kycData.date_of_birth,
        gender: kycData.gender,
        address: {
          house: kycData.house || kycData.address?.house,
          street: kycData.street || kycData.address?.street,
          landmark: kycData.landmark || kycData.address?.landmark,
          locality:
            kycData.locality ||
            kycData.address?.locality ||
            kycData.address?.po,
          vtc: kycData.vtc || kycData.address?.vtc,
          district: kycData.district || kycData.address?.dist,
          state: kycData.state || kycData.address?.state,
          pincode: kycData.pincode || kycData.address?.pc,
          country: kycData.country || "India",
          fullAddress:
            kycData.full_address ||
            kycData.address?.full ||
            [
              kycData.house,
              kycData.street,
              kycData.locality,
              kycData.district,
              kycData.state,
              kycData.pincode,
            ]
              .filter(Boolean)
              .join(", "),
        },
        photo: kycData.photo || kycData.profile_image,
        maskedAadhaar: maskAadhaar(storedData.aadhaar),
      },
    };
  }

  return {
    success: false,
    message: data.message || "Verification failed",
    error: data.error || data.message,
  };
}

// ============== SUREPASS API IMPLEMENTATION ==============

async function surepassRequestOtp(
  aadhaar: string,
): Promise<AadhaarOtpResponse> {
  const response = await fetch(
    `https://kyc-api.surepass.io/api/v1/aadhaar-v2/generate-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AADHAAR_API_KEY}`,
      },
      body: JSON.stringify({
        id_number: aadhaar,
      }),
    },
  );

  const data = (await response.json()) as any;

  if (data.success || data.status_code === 200) {
    const clientId = data.data?.client_id;

    clientIdStore.set(clientId, {
      clientId,
      aadhaar,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return {
      success: true,
      message: data.message || "OTP sent successfully",
      clientId,
      maskedMobile: data.data?.mobile || "XXXXXX****",
    };
  }

  return {
    success: false,
    message: data.message || "Failed to send OTP",
    error: data.message,
  };
}

async function surepassVerifyOtp(
  clientId: string,
  otp: string,
): Promise<AadhaarVerifyResponse> {
  const storedData = clientIdStore.get(clientId);

  if (!storedData) {
    return {
      success: false,
      message: "Session expired",
      error: "Please request a new OTP",
    };
  }

  const response = await fetch(
    `https://kyc-api.surepass.io/api/v1/aadhaar-v2/submit-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AADHAAR_API_KEY}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        otp: otp,
      }),
    },
  );

  const data = (await response.json()) as any;

  if (data.success || data.status_code === 200) {
    clientIdStore.delete(clientId);

    const kycData = data.data || {};

    return {
      success: true,
      message: "Aadhaar verified successfully",
      data: {
        name: kycData.full_name,
        dob: kycData.dob,
        gender: kycData.gender,
        address: {
          house: kycData.address?.house,
          street: kycData.address?.street,
          landmark: kycData.address?.landmark,
          locality: kycData.address?.loc,
          vtc: kycData.address?.vtc,
          district: kycData.address?.dist,
          state: kycData.address?.state,
          pincode: kycData.address?.pc,
          country: kycData.address?.country || "India",
          fullAddress: kycData.address?.full_address,
        },
        photo: kycData.profile_image,
        maskedAadhaar: maskAadhaar(storedData.aadhaar),
      },
    };
  }

  return {
    success: false,
    message: data.message || "Verification failed",
    error: data.message,
  };
}

export { maskAadhaar };
