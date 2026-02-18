import { Router, Request, Response, NextFunction } from "express";
import sql from "../db";
import { uploadToSupabase, deleteFromSupabase } from "../supabaseStorage";
import { emitToAdmins } from "../services/socket.service";
import {
  requestAadhaarOtp,
  verifyAadhaarOtp,
  maskAadhaar as maskAadhaarNumber,
} from "../services/aadhaarVerification";
import {
  generateAuthUrl,
  exchangeCodeForToken,
  getUserInfo,
  getEAadhaar,
  verifyState,
  isTestMode as isDigiLockerTestMode,
} from "../services/digilockerVerification";
import {
  sendOTP,
  verifyOTP,
  sendRegistrationConfirmation,
  sendApprovalNotification,
} from "../services/smsService";
import multer from "multer";

const router = Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, WebP and PDF are allowed.",
        ),
      );
    }
  },
});

// ============== TYPES ==============

interface ProviderRegistrationRequest {
  provider_type: "individual" | "company";
  name: string;
  phone: string;
  email: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  specializations: string[];
  experience_years?: string;
  terms_accepted: boolean;

  // Individual fields
  aadhaar_number?: string;
  pan_number?: string;

  // Company fields
  company_name?: string;
  company_type?:
    | "proprietorship"
    | "partnership"
    | "llp"
    | "private_limited"
    | "public_limited";
  gst_number?: string;
  cin_number?: string;
}

// ============== HELPER FUNCTIONS ==============

function maskAadhaar(aadhaar: string): string {
  // Store only last 4 digits, mask the rest
  const cleaned = aadhaar.replace(/\D/g, "");
  if (cleaned.length !== 12) return "XXXX-XXXX-" + cleaned.slice(-4);
  return "XXXX-XXXX-" + cleaned.slice(-4);
}

function validateGST(gst: string): boolean {
  // GST format: 2 state code + 10 PAN + 1 entity code + 1 Z + 1 checksum
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst.toUpperCase());
}

function validatePAN(pan: string): boolean {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
}

function validateAadhaar(aadhaar: string): boolean {
  const cleaned = aadhaar.replace(/\D/g, "");
  return cleaned.length === 12;
}

function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// ============== MOBILE OTP VERIFICATION ==============

/**
 * Send OTP to mobile number for verification
 * POST /api/provider-registration/mobile/send-otp
 */
router.post(
  "/mobile/send-otp",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const cleaned = phone.replace(/\D/g, "");
      if (cleaned.length !== 10) {
        return res
          .status(400)
          .json({ error: "Please enter a valid 10-digit phone number" });
      }

      // Check if phone already registered
      const existingProvider = await sql`
        SELECT id, status FROM providers WHERE phone = ${phone}
      `;
      if (existingProvider.length > 0) {
        const status = existingProvider[0].status;
        if (status === "approved") {
          return res.status(409).json({
            error:
              "This phone number is already registered. Please login instead.",
            code: "PHONE_EXISTS",
          });
        } else if (status === "pending" || status === "under_review") {
          return res.status(409).json({
            error:
              "A registration with this phone number is already in progress. Please check your application status.",
            code: "REGISTRATION_PENDING",
          });
        } else {
          return res.status(409).json({
            error: "This phone number is already registered.",
            code: "PHONE_EXISTS",
          });
        }
      }

      const result = await sendOTP(phone);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          ...(result.otp ? { otp: result.otp } : {}), // Only in test mode
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
        });
      }
    } catch (error: any) {
      console.error("Send OTP error:", error);
      next(error);
    }
  },
);

/**
 * Verify mobile OTP
 * POST /api/provider-registration/mobile/verify-otp
 */
router.post(
  "/mobile/verify-otp",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone, otp } = req.body;

      if (!phone || !otp) {
        return res
          .status(400)
          .json({ error: "Phone number and OTP are required" });
      }

      const result = await verifyOTP(phone, otp);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          verified: true,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
          verified: false,
        });
      }
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      next(error);
    }
  },
);

/**
 * Check if email is already registered
 * POST /api/provider-registration/check-email
 */
router.post(
  "/check-email",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Check if email already registered
      const existingProvider = await sql`
        SELECT id, status FROM providers WHERE email = ${email.toLowerCase()}
      `;

      if (existingProvider.length > 0) {
        const status = existingProvider[0].status;
        if (status === "approved") {
          return res.status(409).json({
            available: false,
            error:
              "This email is already registered. Please login or use a different email.",
            code: "EMAIL_EXISTS",
          });
        } else if (status === "pending" || status === "under_review") {
          return res.status(409).json({
            available: false,
            error: "A registration with this email is already in progress.",
            code: "REGISTRATION_PENDING",
          });
        } else {
          return res.status(409).json({
            available: false,
            error: "This email is already registered.",
            code: "EMAIL_EXISTS",
          });
        }
      }

      res.json({ available: true });
    } catch (error: any) {
      console.error("Check email error:", error);
      next(error);
    }
  },
);

// ============== PUBLIC ROUTES ==============

/**
 * Register a new service provider
 * POST /api/provider-registration
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: ProviderRegistrationRequest = req.body;

    // Validate required fields
    if (!data.name || !data.phone || !data.email) {
      return res
        .status(400)
        .json({ error: "Name, phone, and email are required" });
    }

    if (
      !data.provider_type ||
      !["individual", "company"].includes(data.provider_type)
    ) {
      return res
        .status(400)
        .json({ error: "Provider type must be 'individual' or 'company'" });
    }

    if (!data.terms_accepted) {
      return res
        .status(400)
        .json({ error: "You must accept the terms and conditions" });
    }

    if (!data.specializations || data.specializations.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one specialization is required" });
    }

    // Validate address
    if (!data.address_line1 || !data.city || !data.state || !data.pincode) {
      return res.status(400).json({ error: "Complete address is required" });
    }

    // Validate individual-specific fields
    if (data.provider_type === "individual") {
      if (!data.aadhaar_number || !validateAadhaar(data.aadhaar_number)) {
        return res
          .status(400)
          .json({ error: "Valid 12-digit Aadhaar number is required" });
      }
    }

    // Validate company-specific fields
    if (data.provider_type === "company") {
      if (!data.company_name) {
        return res.status(400).json({ error: "Company name is required" });
      }
      if (!data.company_type) {
        return res.status(400).json({ error: "Company type is required" });
      }
      if (data.gst_number && !validateGST(data.gst_number)) {
        return res.status(400).json({ error: "Invalid GST number format" });
      }
    }

    // Validate PAN if provided
    if (data.pan_number && !validatePAN(data.pan_number)) {
      return res.status(400).json({ error: "Invalid PAN number format" });
    }

    // Check if phone already registered
    const existing = await sql`
      SELECT id FROM providers WHERE phone = ${data.phone}
    `;
    if (existing.length > 0) {
      return res.status(409).json({ error: "Phone number already registered" });
    }

    // Check if email already registered
    const existingEmail = await sql`
      SELECT id FROM providers WHERE email = ${data.email}
    `;
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Create provider
    const [provider] = await sql`
      INSERT INTO providers (
        provider_type,
        name,
        phone,
        email,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        specializations,
        experience,
        terms_accepted,
        terms_accepted_at,
        aadhaar_number,
        pan_number,
        company_name,
        company_type,
        gst_number,
        cin_number,
        status,
        kyc_status
      ) VALUES (
        ${data.provider_type},
        ${data.name},
        ${data.phone},
        ${data.email},
        ${data.address_line1},
        ${data.address_line2 || null},
        ${data.city},
        ${data.state},
        ${data.pincode},
        ${data.specializations},
        ${data.experience_years ? parseInt(data.experience_years) : 0},
        true,
        NOW(),
        ${data.aadhaar_number ? maskAadhaar(data.aadhaar_number) : null},
        ${data.pan_number ? data.pan_number.toUpperCase() : null},
        ${data.company_name || null},
        ${data.company_type || null},
        ${data.gst_number ? data.gst_number.toUpperCase() : null},
        ${data.cin_number || null},
        'pending',
        'pending'
      )
      RETURNING *
    `;

    // Log the registration
    await sql`
      INSERT INTO provider_activity_log (provider_id, action, new_value, ip_address)
      VALUES (
        ${provider.id},
        'registered',
        ${JSON.stringify({ provider_type: data.provider_type, name: data.name })},
        ${req.ip || null}
      )
    `;

    // Generate short ID for easy reference (no SMS - shown in app only)
    const shortId = provider.id.slice(0, 8).toUpperCase();

    // Emit real-time notification to admins about new registration
    emitToAdmins("provider:new-registration", {
      provider: {
        id: provider.id,
        short_id: shortId,
        name: provider.name,
        phone: provider.phone,
        email: provider.email,
        provider_type: provider.provider_type,
        specializations: provider.specializations,
        status: provider.status,
        kyc_status: provider.kyc_status,
        created_at: provider.created_at,
      },
    });

    res.status(201).json({
      success: true,
      message:
        "Registration submitted successfully. Please save your registration ID and upload required documents.",
      provider: {
        id: provider.id,
        short_id: shortId, // Short ID for easy reference
        name: provider.name,
        phone: provider.phone,
        provider_type: provider.provider_type,
        status: provider.status,
        kyc_status: provider.kyc_status,
      },
    });
  } catch (error: any) {
    console.error("Provider registration error:", error);
    next(error);
  }
});

/**
 * Upload document for provider
 * POST /api/provider-registration/:providerId/documents
 */
router.post(
  "/:providerId/documents",
  upload.single("document"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { providerId } = req.params;
      const { document_type } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const validDocTypes = [
        "aadhaar_card",
        "aadhaar_front",
        "aadhaar_back",
        "pan_card",
        "photo",
        "address_proof",
        "gst_certificate",
        "company_registration",
        "partnership_deed",
        "board_resolution",
        "authorized_signatory_id",
        "resume",
        "other",
      ];

      if (!document_type || !validDocTypes.includes(document_type)) {
        return res.status(400).json({ error: "Invalid document type" });
      }

      // Check if provider exists
      const [provider] = await sql`
        SELECT id, provider_type, kyc_status FROM providers WHERE id = ${providerId}
      `;

      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Upload to Supabase Storage
      const fileName = `providers/${providerId}/${document_type}_${Date.now()}.${file.mimetype.split("/")[1]}`;
      const fileUrl = await uploadToSupabase(
        file.buffer,
        fileName,
        file.mimetype,
      );

      // Check if document already exists
      const existingDoc = await sql`
        SELECT id, file_url FROM provider_documents 
        WHERE provider_id = ${providerId} AND document_type = ${document_type}
      `;

      if (existingDoc.length > 0) {
        // Delete old file from storage
        try {
          await deleteFromSupabase(existingDoc[0].file_url);
        } catch (e) {
          console.warn("Failed to delete old document:", e);
        }

        // Update existing record
        const [doc] = await sql`
          UPDATE provider_documents
          SET 
            file_url = ${fileUrl},
            file_name = ${file.originalname},
            file_size = ${file.size},
            mime_type = ${file.mimetype},
            verification_status = 'pending',
            updated_at = NOW()
          WHERE id = ${existingDoc[0].id}
          RETURNING *
        `;

        return res.json({
          success: true,
          message: "Document updated successfully",
          document: doc,
        });
      }

      // Create new document record
      const [doc] = await sql`
        INSERT INTO provider_documents (
          provider_id,
          document_type,
          file_url,
          file_name,
          file_size,
          mime_type
        ) VALUES (
          ${providerId},
          ${document_type},
          ${fileUrl},
          ${file.originalname},
          ${file.size},
          ${file.mimetype}
        )
        RETURNING *
      `;

      // Update provider KYC status to submitted if pending
      await sql`
        UPDATE providers 
        SET kyc_status = 'submitted' 
        WHERE id = ${providerId} AND kyc_status = 'pending'
      `;

      // Log the upload
      await sql`
        INSERT INTO provider_activity_log (provider_id, action, new_value)
        VALUES (
          ${providerId},
          'document_uploaded',
          ${JSON.stringify({ document_type, file_name: file.originalname })}
        )
      `;

      res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        document: doc,
      });
    } catch (error: any) {
      console.error("Document upload error:", error);
      next(error);
    }
  },
);

/**
 * Lookup provider by short ID (first 8 characters of UUID)
 * GET /api/provider-registration/lookup/:shortId
 */
router.get(
  "/lookup/:shortId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shortId } = req.params;

      if (!shortId || shortId.length < 6) {
        return res
          .status(400)
          .json({ error: "Short ID must be at least 6 characters" });
      }

      // Search for provider whose ID starts with this short ID (case-insensitive)
      const providers = await sql`
      SELECT id, name, provider_type, status
      FROM providers 
      WHERE LOWER(CAST(id AS TEXT)) LIKE ${shortId.toLowerCase() + "%"}
      LIMIT 5
    `;

      if (providers.length === 0) {
        return res
          .status(404)
          .json({ error: "No provider found with this ID" });
      }

      if (providers.length === 1) {
        // Exact match found
        res.json({
          found: true,
          provider_id: providers[0].id,
          name: providers[0].name,
          status: providers[0].status,
        });
      } else {
        // Multiple matches (rare but possible)
        res.json({
          found: true,
          multiple: true,
          message:
            "Multiple providers found. Please use the full registration ID.",
          providers: providers.map((p: any) => ({
            id: p.id.slice(0, 8).toUpperCase(),
            name: p.name,
          })),
        });
      }
    } catch (error: any) {
      console.error("Provider lookup error:", error);
      next(error);
    }
  },
);

/**
 * Get provider registration status
 * GET /api/provider-registration/:providerId/status
 */
router.get(
  "/:providerId/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { providerId } = req.params;

      const [provider] = await sql`
      SELECT 
        id, name, provider_type, status, kyc_status, 
        rejection_reason, created_at, approved_at
      FROM providers 
      WHERE id = ${providerId}
    `;

      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Get uploaded documents
      const documents = await sql`
      SELECT document_type, verification_status, rejection_reason, created_at, file_url
      FROM provider_documents
      WHERE provider_id = ${providerId}
    `;

      // Calculate what documents are still required
      // For individual: aadhaar_card and photo are mandatory, pan_card is optional (can add later)
      const requiredDocs =
        provider.provider_type === "individual"
          ? ["aadhaar_card", "photo"]
          : [
              "gst_certificate",
              "company_registration",
              "authorized_signatory_id",
              "photo",
            ];

      const uploadedTypes = documents.map((d: any) => d.document_type);
      const missingDocs = requiredDocs.filter(
        (d) => !uploadedTypes.includes(d),
      );

      res.json({
        provider: {
          id: provider.id,
          name: provider.name,
          provider_type: provider.provider_type,
          status: provider.status,
          kyc_status: provider.kyc_status,
          rejection_reason: provider.rejection_reason,
          created_at: provider.created_at,
          approved_at: provider.approved_at,
        },
        documents,
        required_documents: requiredDocs,
        missing_documents: missingDocs,
        is_complete: missingDocs.length === 0,
      });
    } catch (error: any) {
      console.error("Get provider status error:", error);
      next(error);
    }
  },
);

/**
 * Get terms and conditions
 * GET /api/provider-registration/terms
 */
router.get("/terms", async (req: Request, res: Response) => {
  const terms = {
    version: "1.0",
    last_updated: "2026-01-29",
    sections: [
      {
        title: "1. Eligibility",
        content: `To register as a service provider on SerboSeva, you must:
• Be at least 18 years of age
• Have valid government-issued identification (Aadhaar card for individuals)
• Possess the necessary skills and certifications for your chosen service categories
• Have a valid bank account for receiving payments
• Have a smartphone with internet access
• For companies: Have valid GST registration and company incorporation documents`,
      },
      {
        title: "2. Registration and Verification",
        content: `• You must provide accurate and complete information during registration
• All documents submitted must be genuine and valid
• We will verify your identity through DigiLocker or manual document verification
• False or misleading information will result in immediate rejection and possible legal action
• Background verification may be conducted as per applicable laws
• Verification typically takes 24-48 hours after document submission`,
      },
      {
        title: "3. Service Standards",
        content: `• You agree to provide services with professionalism and due diligence
• Services must be completed as per the booking specifications and within scheduled time
• You must maintain cleanliness and follow safety protocols
• Customer property must be treated with care and respect
• Any damage caused must be reported immediately
• Carry all necessary tools and equipment for the service`,
      },
      {
        title: "4. Payment Terms",
        content: `• Platform commission will be deducted from each booking as per current rates
• Commission rates are communicated during onboarding and may be updated periodically
• Payments will be settled weekly to your registered bank account (every Monday)
• All payment details are visible in your partner dashboard
• Cancellation charges may apply as per the cancellation policy
• Fraudulent activity will result in withholding of payments and account termination`,
      },
      {
        title: "5. Code of Conduct",
        content: `• Professional behavior with all customers is mandatory
• No harassment, discrimination, or inappropriate conduct of any kind
• Respect customer privacy and confidentiality
• Do not solicit customers for off-platform bookings
• Wear appropriate attire and carry valid ID during service visits
• Respond promptly to customer queries and communications`,
      },
      {
        title: "6. Termination",
        content: `• SerboSeva reserves the right to suspend or terminate your account
• Repeated negative reviews or complaints may lead to deactivation
• Violation of terms will result in immediate termination
• You may request account deletion at any time with 7 days notice
• Pending payments will be settled within 30 days of account closure`,
      },
      {
        title: "7. Dispute Resolution",
        content: `• Disputes will be resolved through SerboSeva's internal grievance mechanism
• Customer complaints should be responded to within 24 hours
• For unresolved disputes, arbitration under Indian Arbitration Act applies
• Courts in Gujarat shall have exclusive jurisdiction`,
      },
      {
        title: "8. Data Privacy",
        content: `• Your personal data will be processed as per our Privacy Policy
• Aadhaar data is used solely for identity verification through UIDAI
• We comply with IT Act, 2000 and applicable data protection regulations
• You consent to background verification and document validation
• Location data is collected only during active service hours
• You can request data deletion at any time`,
      },
    ],
  };

  res.json(terms);
});

// ============== AADHAAR OTP VERIFICATION (REAL API) ==============

/**
 * Request OTP for Aadhaar verification
 * POST /api/provider-registration/:providerId/aadhaar/request-otp
 */
router.post(
  "/:providerId/aadhaar/request-otp",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { providerId } = req.params;
      const { aadhaar_number } = req.body;

      // Validate provider ID format
      if (!isValidUUID(providerId)) {
        return res.status(400).json({ error: "Invalid provider ID format" });
      }

      // Validate Aadhaar number
      if (!aadhaar_number || !validateAadhaar(aadhaar_number)) {
        return res
          .status(400)
          .json({ error: "Please enter a valid 12-digit Aadhaar number" });
      }

      // Check if provider exists
      const [provider] = await sql`
      SELECT id, name, aadhaar_verified FROM providers WHERE id = ${providerId}
    `;

      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      if (provider.aadhaar_verified) {
        return res.status(400).json({ error: "Aadhaar is already verified" });
      }

      // Call Aadhaar verification API
      const result = await requestAadhaarOtp(aadhaar_number);

      if (!result.success) {
        return res.status(400).json({ error: result.error || result.message });
      }

      const clientId = result.clientId || `UNKNOWN-${Date.now()}`;

      // Log verification attempt
      await sql`
      INSERT INTO digilocker_verifications (
        provider_id, request_id, document_type, status, aadhaar_number
      ) VALUES (
        ${providerId}, ${clientId}, 'aadhaar_otp', 'otp_sent', ${maskAadhaarNumber(aadhaar_number)}
      )
    `;

      console.log(
        `[AADHAAR] OTP requested for provider ${providerId}, clientId: ${clientId}`,
      );

      const response: any = {
        success: true,
        request_id: clientId,
        message: result.message,
        masked_mobile: result.maskedMobile,
      };

      // Include dev_otp for testing (only available in test mode)
      if (result.devOtp) {
        response.dev_otp = result.devOtp;
      }

      res.json(response);
    } catch (error: any) {
      console.error("Aadhaar OTP request error:", error);
      next(error);
    }
  },
);

/**
 * Verify OTP and complete Aadhaar verification
 * POST /api/provider-registration/:providerId/aadhaar/verify-otp
 */
router.post(
  "/:providerId/aadhaar/verify-otp",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { providerId } = req.params;
      const { request_id, otp } = req.body;

      // Validate provider ID format
      if (!isValidUUID(providerId)) {
        return res.status(400).json({ error: "Invalid provider ID format" });
      }

      if (!request_id || !otp) {
        return res
          .status(400)
          .json({ error: "Request ID and OTP are required" });
      }

      // Check if provider exists
      const [provider] = await sql`
      SELECT id, name FROM providers WHERE id = ${providerId}
    `;

      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Call Aadhaar verification API to verify OTP
      const result = await verifyAadhaarOtp(request_id, otp);

      if (!result.success) {
        return res.status(400).json({
          error: result.error || result.message,
          message: result.message,
        });
      }

      // Update verification record
      await sql`
      UPDATE digilocker_verifications
      SET 
        status = 'verified',
        verified_name = ${result.data?.name || null},
        verified_dob = ${result.data?.dob || null},
        verified_address = ${result.data?.address?.fullAddress || null},
        completed_at = NOW()
      WHERE request_id = ${request_id}
    `;

      // Update provider with verified Aadhaar
      await sql`
      UPDATE providers
      SET 
        aadhaar_number = ${result.data?.maskedAadhaar || "XXXX-XXXX-XXXX"},
        aadhaar_verified = true,
        aadhaar_verification_date = NOW(),
        digilocker_request_id = ${request_id},
        kyc_status = CASE 
          WHEN provider_type = 'individual' AND pan_number IS NOT NULL THEN 'submitted'
          ELSE kyc_status
        END,
        updated_at = NOW()
      WHERE id = ${providerId}
    `;

      // Log activity
      await sql`
      INSERT INTO provider_activity_log (provider_id, action, details, performed_by)
      VALUES (${providerId}, 'aadhaar_verified', ${"Aadhaar verified via OTP - " + (result.data?.name || "N/A")}, ${providerId})
    `;

      console.log(
        `[AADHAAR] Verification successful for provider ${providerId}`,
      );

      res.json({
        success: true,
        message: "Aadhaar verified successfully!",
        verified_data: {
          name: result.data?.name,
          masked_aadhaar: result.data?.maskedAadhaar,
          dob: result.data?.dob,
          address: result.data?.address?.fullAddress,
        },
      });
    } catch (error: any) {
      console.error("Aadhaar OTP verification error:", error);
      next(error);
    }
  },
);

/**
 * Resend OTP for Aadhaar verification
 * POST /api/provider-registration/:providerId/aadhaar/resend-otp
 */
router.post(
  "/:providerId/aadhaar/resend-otp",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { providerId } = req.params;
      const { aadhaar_number } = req.body;

      // Validate provider ID format
      if (!isValidUUID(providerId)) {
        return res.status(400).json({ error: "Invalid provider ID format" });
      }

      if (!aadhaar_number || !validateAadhaar(aadhaar_number)) {
        return res
          .status(400)
          .json({ error: "Please provide the Aadhaar number again" });
      }

      // Call Aadhaar verification API (resend is same as initial request)
      const result = await requestAadhaarOtp(aadhaar_number);

      if (!result.success) {
        return res.status(400).json({ error: result.error || result.message });
      }

      const clientId = result.clientId || `UNKNOWN-${Date.now()}`;

      // Log new verification attempt
      await sql`
      INSERT INTO digilocker_verifications (
        provider_id, request_id, document_type, status, aadhaar_number
      ) VALUES (
        ${providerId}, ${clientId}, 'aadhaar_otp', 'otp_resent', ${maskAadhaarNumber(aadhaar_number)}
      )
    `;

      console.log(
        `[AADHAAR] OTP resent for provider ${providerId}, new clientId: ${clientId}`,
      );

      const response: any = {
        success: true,
        request_id: clientId,
        message: result.message,
        masked_mobile: result.maskedMobile,
      };

      // Include dev_otp for testing (only available in test mode)
      if (result.devOtp) {
        response.dev_otp = result.devOtp;
      }

      res.json(response);
    } catch (error: any) {
      console.error("Aadhaar OTP resend error:", error);
      next(error);
    }
  },
);

/**
 * Get Aadhaar verification status
 * GET /api/provider-registration/:providerId/aadhaar/status
 */
router.get(
  "/:providerId/aadhaar/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { providerId } = req.params;

      // Validate provider ID format
      if (!isValidUUID(providerId)) {
        return res.status(400).json({ error: "Invalid provider ID format" });
      }

      const [provider] = await sql`
      SELECT 
        id, name, aadhaar_number, aadhaar_verified, 
        aadhaar_verification_date, digilocker_request_id
      FROM providers 
      WHERE id = ${providerId}
    `;

      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      res.json({
        verified: provider.aadhaar_verified || false,
        masked_aadhaar: provider.aadhaar_number || null,
        verification_date: provider.aadhaar_verification_date,
        request_id: provider.digilocker_request_id,
      });
    } catch (error: any) {
      console.error("Aadhaar status error:", error);
      next(error);
    }
  },
);

// ============== DIGILOCKER VERIFICATION ==============

/**
 * Initiate DigiLocker verification
 * POST /api/provider-registration/:providerId/digilocker/initiate
 * Returns authorization URL to redirect user to DigiLocker
 */
router.post(
  "/:providerId/digilocker/initiate",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { providerId } = req.params;

      // Validate provider ID format
      if (!isValidUUID(providerId)) {
        return res.status(400).json({ error: "Invalid provider ID format" });
      }

      const [provider] = await sql`
      SELECT id, name, aadhaar_verified FROM providers WHERE id = ${providerId}
    `;

      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      if (provider.aadhaar_verified) {
        return res.status(400).json({ error: "Aadhaar is already verified" });
      }

      // Generate DigiLocker authorization URL
      const result = generateAuthUrl(providerId);

      if (!result.success) {
        return res
          .status(500)
          .json({ error: result.error || "Failed to generate auth URL" });
      }

      const stateToken = result.state || `DL-${Date.now()}`;

      // Log verification attempt
      await sql`
      INSERT INTO digilocker_verifications (
        provider_id, request_id, document_type, status
      ) VALUES (
        ${providerId}, ${stateToken}, 'digilocker_aadhaar', 'initiated'
      )
    `;

      console.log(
        `[DIGILOCKER] Initiated verification for provider ${providerId}`,
      );

      res.json({
        success: true,
        redirect_url: result.authUrl,
        state: result.state,
        is_test_mode: isDigiLockerTestMode(),
        message: isDigiLockerTestMode()
          ? "Test mode - verification will be simulated"
          : "Redirect user to DigiLocker for verification",
      });
    } catch (error: any) {
      console.error("DigiLocker initiate error:", error);
      next(error);
    }
  },
);

/**
 * DigiLocker OAuth callback
 * GET /api/provider-registration/digilocker/callback
 * Handles redirect from DigiLocker after user authorization
 */
router.get(
  "/digilocker/callback",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state, error, error_description } = req.query;
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";

      if (error) {
        console.error(
          `[DIGILOCKER] Authorization error: ${error} - ${error_description}`,
        );
        return res.redirect(
          `${frontendUrl}/provider-registration?digilocker_error=${encodeURIComponent(String(error_description || error))}`,
        );
      }

      if (!code || !state) {
        return res.redirect(
          `${frontendUrl}/provider-registration?error=missing_params`,
        );
      }

      // Exchange code for token
      const tokenResult = await exchangeCodeForToken(
        String(code),
        String(state),
      );

      if (!tokenResult.success || !tokenResult.accessToken) {
        console.error("[DIGILOCKER] Token exchange failed:", tokenResult.error);
        return res.redirect(
          `${frontendUrl}/provider-registration?error=token_exchange_failed`,
        );
      }

      const providerId = tokenResult.providerId;
      if (!providerId) {
        return res.redirect(
          `${frontendUrl}/provider-registration?error=invalid_state`,
        );
      }

      // Get user info from DigiLocker
      const userInfo = await getUserInfo(tokenResult.accessToken);

      // Get eAadhaar data
      const aadhaarData = await getEAadhaar(tokenResult.accessToken);

      // Update verification record
      await sql`
      UPDATE digilocker_verifications
      SET 
        status = 'verified',
        verified_name = ${userInfo.data?.name || aadhaarData.data?.name || "Verified"},
        verified_dob = ${userInfo.data?.dob || aadhaarData.data?.dob || null},
        verified_address = ${aadhaarData.data?.address || null},
        aadhaar_number = ${aadhaarData.data?.maskedAadhaar || "XXXX-XXXX-" + (userInfo.data?.eaadhaar || "XXXX")},
        completed_at = NOW()
      WHERE request_id = ${String(state)}
    `;

      // Update provider record
      await sql`
      UPDATE providers
      SET 
        aadhaar_number = ${aadhaarData.data?.maskedAadhaar || "XXXX-XXXX-" + (userInfo.data?.eaadhaar || "XXXX")},
        aadhaar_verified = true,
        aadhaar_verification_date = NOW(),
        digilocker_request_id = ${String(state)},
        kyc_status = CASE 
          WHEN provider_type = 'individual' AND pan_number IS NOT NULL THEN 'submitted'
          ELSE kyc_status
        END,
        updated_at = NOW()
      WHERE id = ${providerId}
    `;

      // Log activity
      await sql`
      INSERT INTO provider_activity_log (provider_id, action, details, performed_by)
      VALUES (${providerId}, 'aadhaar_verified', ${"Verified via DigiLocker - " + (userInfo.data?.name || "N/A")}, ${providerId})
    `;

      console.log(
        `[DIGILOCKER] Verification successful for provider ${providerId}`,
      );

      // Redirect back to frontend with success
      res.redirect(
        `${frontendUrl}/provider-registration?digilocker_success=true&provider_id=${providerId}`,
      );
    } catch (error: any) {
      console.error("DigiLocker callback error:", error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
      res.redirect(
        `${frontendUrl}/provider-registration?error=verification_failed`,
      );
    }
  },
);

/**
 * Check DigiLocker verification status
 * GET /api/provider-registration/:providerId/digilocker/status
 */
router.get(
  "/:providerId/digilocker/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { providerId } = req.params;

      if (!isValidUUID(providerId)) {
        return res.status(400).json({ error: "Invalid provider ID format" });
      }

      const [provider] = await sql`
      SELECT 
        id, name, aadhaar_number, aadhaar_verified, 
        aadhaar_verification_date, digilocker_request_id
      FROM providers 
      WHERE id = ${providerId}
    `;

      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Get latest verification record
      const [verification] = await sql`
      SELECT * FROM digilocker_verifications 
      WHERE provider_id = ${providerId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

      res.json({
        verified: provider.aadhaar_verified || false,
        masked_aadhaar: provider.aadhaar_number || null,
        verification_date: provider.aadhaar_verification_date,
        verification_status: verification?.status || null,
        verified_name: verification?.verified_name || null,
        is_test_mode: isDigiLockerTestMode(),
      });
    } catch (error: any) {
      console.error("DigiLocker status error:", error);
      next(error);
    }
  },
);

export default router;
