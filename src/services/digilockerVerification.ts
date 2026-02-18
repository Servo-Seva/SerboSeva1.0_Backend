/**
 * DigiLocker Verification Service
 * Official Government Digital Document Wallet Integration
 *
 * DigiLocker is a flagship initiative under Digital India for providing
 * a secure cloud based platform for storage, sharing and verification
 * of documents & certificates.
 *
 * Register as a Partner: https://partners.digitallocker.gov.in/
 * Sandbox Documentation: https://partners.digitallocker.gov.in/sandbox_docs/
 */

const DIGILOCKER_CLIENT_ID = process.env.DIGILOCKER_CLIENT_ID || "";
const DIGILOCKER_CLIENT_SECRET = process.env.DIGILOCKER_CLIENT_SECRET || "";
const DIGILOCKER_REDIRECT_URI =
  process.env.DIGILOCKER_REDIRECT_URI ||
  "http://localhost:5000/api/provider-registration/digilocker/callback";
const DIGILOCKER_ENV = process.env.DIGILOCKER_ENV || "sandbox";

// DigiLocker API URLs
const DIGILOCKER_URLS = {
  sandbox: {
    authorize:
      "https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize",
    token: "https://digilocker.meripehchaan.gov.in/public/oauth2/1/token",
    eaadhaar:
      "https://digilocker.meripehchaan.gov.in/public/oauth2/1/file/eaadhaar",
    userinfo: "https://digilocker.meripehchaan.gov.in/public/oauth2/1/userinfo",
  },
  production: {
    authorize: "https://api.digitallocker.gov.in/public/oauth2/1/authorize",
    token: "https://api.digitallocker.gov.in/public/oauth2/1/token",
    eaadhaar: "https://api.digitallocker.gov.in/public/oauth2/1/file/eaadhaar",
    userinfo: "https://api.digitallocker.gov.in/public/oauth2/1/userinfo",
  },
};

// Get current environment URLs
const getUrls = () =>
  DIGILOCKER_URLS[DIGILOCKER_ENV as keyof typeof DIGILOCKER_URLS] ||
  DIGILOCKER_URLS.sandbox;

// Store state tokens for verification (in production, use Redis)
const stateStore: Map<string, { providerId: string; createdAt: number }> =
  new Map();

// Clean up expired state tokens (15 min expiry)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of stateStore.entries()) {
    if (now - value.createdAt > 15 * 60 * 1000) {
      stateStore.delete(key);
    }
  }
}, 60000);

export interface DigiLockerAuthResponse {
  success: boolean;
  authUrl?: string;
  state?: string;
  error?: string;
}

export interface DigiLockerTokenResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

export interface DigiLockerUserInfo {
  success: boolean;
  data?: {
    digilockerid?: string;
    name?: string;
    dob?: string;
    gender?: string;
    eaadhaar?: string; // Last 4 digits
    mobile?: string; // Last 4 digits
  };
  error?: string;
}

export interface AadhaarData {
  success: boolean;
  data?: {
    name: string;
    dob: string;
    gender: string;
    address: string;
    maskedAadhaar: string;
    photo?: string; // Base64 encoded
  };
  error?: string;
}

/**
 * Generate DigiLocker authorization URL
 * User will be redirected to DigiLocker to authenticate and authorize access
 */
export function generateAuthUrl(providerId: string): DigiLockerAuthResponse {
  if (
    !DIGILOCKER_CLIENT_ID ||
    DIGILOCKER_CLIENT_ID === "your_digilocker_client_id"
  ) {
    // Test mode - simulate DigiLocker flow
    console.log("[DIGILOCKER] Test mode - generating mock auth URL");
    const testState = `TEST-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    stateStore.set(testState, { providerId, createdAt: Date.now() });

    return {
      success: true,
      // In test mode, redirect to our own test endpoint
      authUrl: `${DIGILOCKER_REDIRECT_URI}?code=test_code_123&state=${testState}`,
      state: testState,
    };
  }

  try {
    const urls = getUrls();
    const state = `DL-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Store state for verification
    stateStore.set(state, { providerId, createdAt: Date.now() });

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: DIGILOCKER_CLIENT_ID,
      redirect_uri: DIGILOCKER_REDIRECT_URI,
      state: state,
      // Request access to eAadhaar and user profile
      scope: "openid profile eaadhaar",
      // Code challenge for PKCE (recommended)
      code_challenge_method: "S256",
    });

    const authUrl = `${urls.authorize}?${params.toString()}`;

    console.log(`[DIGILOCKER] Generated auth URL for provider ${providerId}`);

    return {
      success: true,
      authUrl,
      state,
    };
  } catch (error: any) {
    console.error("[DIGILOCKER] Error generating auth URL:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  state: string,
): Promise<DigiLockerTokenResponse & { providerId?: string }> {
  // Verify state
  const stateData = stateStore.get(state);
  if (!stateData) {
    return { success: false, error: "Invalid or expired state token" };
  }

  // Test mode
  if (
    !DIGILOCKER_CLIENT_ID ||
    DIGILOCKER_CLIENT_ID === "your_digilocker_client_id"
  ) {
    console.log("[DIGILOCKER] Test mode - simulating token exchange");
    stateStore.delete(state);
    return {
      success: true,
      accessToken: `test_access_token_${Date.now()}`,
      refreshToken: `test_refresh_token_${Date.now()}`,
      expiresIn: 3600,
      providerId: stateData.providerId,
    };
  }

  try {
    const urls = getUrls();

    const response = await fetch(urls.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: DIGILOCKER_REDIRECT_URI,
        client_id: DIGILOCKER_CLIENT_ID,
        client_secret: DIGILOCKER_CLIENT_SECRET,
      }),
    });

    const data = (await response.json()) as any;

    if (data.access_token) {
      stateStore.delete(state);
      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        providerId: stateData.providerId,
      };
    }

    return {
      success: false,
      error:
        data.error_description || data.error || "Failed to get access token",
    };
  } catch (error: any) {
    console.error("[DIGILOCKER] Token exchange error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get user info from DigiLocker
 */
export async function getUserInfo(
  accessToken: string,
): Promise<DigiLockerUserInfo> {
  // Test mode
  if (
    !DIGILOCKER_CLIENT_ID ||
    DIGILOCKER_CLIENT_ID === "your_digilocker_client_id"
  ) {
    console.log("[DIGILOCKER] Test mode - returning mock user info");
    return {
      success: true,
      data: {
        digilockerid: "test_user_123",
        name: "Test Provider User",
        dob: "01-01-1990",
        gender: "M",
        eaadhaar: "4321",
        mobile: "6789",
      },
    };
  }

  try {
    const urls = getUrls();

    const response = await fetch(urls.userinfo, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await response.json()) as any;

    if (data.digilockerid || data.name) {
      return {
        success: true,
        data: {
          digilockerid: data.digilockerid,
          name: data.name,
          dob: data.dob,
          gender: data.gender,
          eaadhaar: data.eaadhaar,
          mobile: data.mobile,
        },
      };
    }

    return {
      success: false,
      error: data.error_description || "Failed to get user info",
    };
  } catch (error: any) {
    console.error("[DIGILOCKER] User info error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Fetch eAadhaar document from DigiLocker
 * Note: This requires the user to have linked their Aadhaar with DigiLocker
 */
export async function getEAadhaar(accessToken: string): Promise<AadhaarData> {
  // Test mode
  if (
    !DIGILOCKER_CLIENT_ID ||
    DIGILOCKER_CLIENT_ID === "your_digilocker_client_id"
  ) {
    console.log("[DIGILOCKER] Test mode - returning mock eAadhaar data");
    return {
      success: true,
      data: {
        name: "Test Provider User",
        dob: "01-01-1990",
        gender: "Male",
        address: "123 Test Street, Test Area, Test City, Test State - 123456",
        maskedAadhaar: "XXXX-XXXX-4321",
      },
    };
  }

  try {
    const urls = getUrls();

    const response = await fetch(urls.eaadhaar, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // eAadhaar is returned as XML or PDF
    const contentType = response.headers.get("content-type");

    if (
      contentType?.includes("application/xml") ||
      contentType?.includes("text/xml")
    ) {
      const xmlData = await response.text();
      // Parse XML to extract Aadhaar data
      // This is a simplified example - actual XML parsing may be more complex
      const nameMatch = xmlData.match(/<name>([^<]+)<\/name>/i);
      const dobMatch = xmlData.match(/<dob>([^<]+)<\/dob>/i);
      const genderMatch = xmlData.match(/<gender>([^<]+)<\/gender>/i);
      const addressMatch = xmlData.match(/<address>([^<]+)<\/address>/i);
      const uidMatch = xmlData.match(/<uid>([^<]+)<\/uid>/i);

      return {
        success: true,
        data: {
          name: nameMatch?.[1] || "Unknown",
          dob: dobMatch?.[1] || "",
          gender: genderMatch?.[1] || "",
          address: addressMatch?.[1] || "",
          maskedAadhaar: uidMatch?.[1]
            ? `XXXX-XXXX-${uidMatch[1].slice(-4)}`
            : "XXXX-XXXX-XXXX",
        },
      };
    }

    return {
      success: false,
      error: "Unexpected response format from DigiLocker",
    };
  } catch (error: any) {
    console.error("[DIGILOCKER] eAadhaar fetch error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify state token and get provider ID
 */
export function verifyState(state: string): {
  valid: boolean;
  providerId?: string;
} {
  const stateData = stateStore.get(state);
  if (!stateData) {
    return { valid: false };
  }
  return { valid: true, providerId: stateData.providerId };
}

/**
 * Check if DigiLocker is configured
 */
export function isDigiLockerConfigured(): boolean {
  return !!(
    DIGILOCKER_CLIENT_ID && DIGILOCKER_CLIENT_ID !== "your_digilocker_client_id"
  );
}

/**
 * Check if running in test mode
 */
export function isTestMode(): boolean {
  return (
    !DIGILOCKER_CLIENT_ID ||
    DIGILOCKER_CLIENT_ID === "your_digilocker_client_id"
  );
}
