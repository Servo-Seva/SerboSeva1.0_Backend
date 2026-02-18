import { Router, Request, Response } from "express";
import sql from "../db";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// ==========================================
// BANK ACCOUNT ENDPOINTS
// ==========================================

// Get all bank accounts for a provider
router.get(
  "/:providerId/bank-accounts",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;

      const result = await sql`
            SELECT 
                id, account_holder_name, account_number, ifsc_code, 
                bank_name, branch_name, account_type, is_primary, 
                is_verified, verified_at, created_at, updated_at
            FROM provider_bank_accounts 
            WHERE provider_id = ${providerId}
            ORDER BY is_primary DESC, created_at DESC
        `;

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch bank accounts" });
    }
  },
);

// Add a new bank account
router.post(
  "/:providerId/bank-accounts",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;
      const {
        account_holder_name,
        account_number,
        ifsc_code,
        bank_name,
        branch_name,
        account_type,
        is_primary,
      } = req.body;

      // Validate required fields
      if (!account_holder_name || !account_number || !ifsc_code || !bank_name) {
        return res.status(400).json({
          success: false,
          message:
            "Account holder name, account number, IFSC code, and bank name are required",
        });
      }

      // Validate IFSC code format (11 characters)
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "Invalid IFSC code format",
        });
      }

      // Check if provider exists and is approved
      const providerCheck = await sql`
            SELECT id, status FROM providers WHERE id = ${providerId}
        `;

      if (providerCheck.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Provider not found" });
      }

      if (
        providerCheck[0].status !== "approved" &&
        providerCheck[0].status !== "active"
      ) {
        return res.status(403).json({
          success: false,
          message: "Only approved providers can add payment details",
        });
      }

      // If this is set as primary, unset other primary accounts
      if (is_primary) {
        await sql`
                UPDATE provider_bank_accounts SET is_primary = false WHERE provider_id = ${providerId}
            `;
      }

      const result = await sql`
            INSERT INTO provider_bank_accounts 
                (provider_id, account_holder_name, account_number, ifsc_code, bank_name, branch_name, account_type, is_primary)
            VALUES (${providerId}, ${account_holder_name}, ${account_number}, ${ifsc_code.toUpperCase()}, ${bank_name}, ${branch_name || null}, ${account_type || "savings"}, ${is_primary || false})
            RETURNING *
        `;

      res.status(201).json({
        success: true,
        message: "Bank account added successfully",
        data: result[0],
      });
    } catch (error: any) {
      console.error("Error adding bank account:", error);
      if (error.code === "23505") {
        // Unique constraint violation
        return res.status(400).json({
          success: false,
          message: "This account number is already registered",
        });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to add bank account" });
    }
  },
);

// Update a bank account
router.put(
  "/:providerId/bank-accounts/:accountId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerId, accountId } = req.params;
      const {
        account_holder_name,
        account_number,
        ifsc_code,
        bank_name,
        branch_name,
        account_type,
        is_primary,
      } = req.body;

      // Check if account exists and belongs to provider
      const accountCheck = await sql`
            SELECT id FROM provider_bank_accounts WHERE id = ${accountId} AND provider_id = ${providerId}
        `;

      if (accountCheck.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Bank account not found" });
      }

      // If setting as primary, unset other primary accounts
      if (is_primary) {
        await sql`
                UPDATE provider_bank_accounts SET is_primary = false WHERE provider_id = ${providerId} AND id != ${accountId}
            `;
      }

      const result = await sql`
            UPDATE provider_bank_accounts SET
                account_holder_name = COALESCE(${account_holder_name}, account_holder_name),
                account_number = COALESCE(${account_number}, account_number),
                ifsc_code = COALESCE(${ifsc_code ? ifsc_code.toUpperCase() : null}, ifsc_code),
                bank_name = COALESCE(${bank_name}, bank_name),
                branch_name = COALESCE(${branch_name}, branch_name),
                account_type = COALESCE(${account_type}, account_type),
                is_primary = COALESCE(${is_primary}, is_primary),
                is_verified = false,
                updated_at = NOW()
            WHERE id = ${accountId} AND provider_id = ${providerId}
            RETURNING *
        `;

      res.json({
        success: true,
        message: "Bank account updated successfully",
        data: result[0],
      });
    } catch (error) {
      console.error("Error updating bank account:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update bank account" });
    }
  },
);

// Delete a bank account
router.delete(
  "/:providerId/bank-accounts/:accountId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerId, accountId } = req.params;

      const result = await sql`
            DELETE FROM provider_bank_accounts WHERE id = ${accountId} AND provider_id = ${providerId} RETURNING id
        `;

      if (result.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Bank account not found" });
      }

      res.json({
        success: true,
        message: "Bank account deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting bank account:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete bank account" });
    }
  },
);

// ==========================================
// UPI ENDPOINTS
// ==========================================

// Get all UPI details for a provider
router.get(
  "/:providerId/upi",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;

      const result = await sql`
            SELECT 
                id, upi_id, upi_provider, is_primary, 
                is_verified, verified_at, created_at, updated_at
            FROM provider_upi_details 
            WHERE provider_id = ${providerId}
            ORDER BY is_primary DESC, created_at DESC
        `;

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error fetching UPI details:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch UPI details" });
    }
  },
);

// Add a new UPI ID
router.post(
  "/:providerId/upi",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;
      const { upi_id, upi_provider, is_primary } = req.body;

      // Validate required fields
      if (!upi_id) {
        return res.status(400).json({
          success: false,
          message: "UPI ID is required",
        });
      }

      // Validate UPI ID format
      const upiIdLower = upi_id.toLowerCase().trim();

      // Check length (minimum 5 chars like a@upi, max 50)
      if (upiIdLower.length < 5 || upiIdLower.length > 50) {
        return res.status(400).json({
          success: false,
          message: "UPI ID must be between 5 and 50 characters",
        });
      }

      // Check for valid UPI format: username@handle
      // Valid handles: upi, paytm, okaxis, okhdfcbank, ybl, ibl, axl, sbi, etc.
      const upiRegex =
        /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,}@[a-zA-Z][a-zA-Z0-9]{2,}$/;
      if (!upiRegex.test(upiIdLower)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid UPI ID format. Example: yourname@paytm or 9876543210@ybl",
        });
      }

      // Validate common UPI handles
      const validHandles = [
        "upi",
        "paytm",
        "okaxis",
        "okhdfcbank",
        "okicici",
        "oksbi",
        "ybl",
        "ibl",
        "axl",
        "sbi",
        "icici",
        "hdfc",
        "axis",
        "apl",
        "rapl",
        "waaxis",
        "wahdfcbank",
        "waicici",
        "wasbi",
        "axisbank",
        "hdfcbank",
        "sbibank",
        "icicibank",
        "kotak",
        "indus",
        "federal",
        "rbl",
        "idbi",
        "pnb",
        "bob",
        "citi",
        "dbs",
        "hsbc",
        "sc",
        "barodampay",
        "aubank",
        "freecharge",
        "amazonpay",
        "gpay",
        "phonepe",
        "airtel",
        "jio",
        "postbank",
        "indianbank",
        "canbk",
        "unionbank",
      ];

      const handle = upiIdLower.split("@")[1];
      if (!validHandles.includes(handle)) {
        // Allow other handles but log for monitoring
        console.log(
          `Unknown UPI handle detected: ${handle} for UPI ID: ${upiIdLower}`,
        );
      }

      // Check if provider exists and is approved
      const providerCheck = await sql`
            SELECT id, status FROM providers WHERE id = ${providerId}
        `;

      if (providerCheck.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Provider not found" });
      }

      if (
        providerCheck[0].status !== "approved" &&
        providerCheck[0].status !== "active"
      ) {
        return res.status(403).json({
          success: false,
          message: "Only approved providers can add payment details",
        });
      }

      // If this is set as primary, unset other primary UPI IDs
      if (is_primary) {
        await sql`
                UPDATE provider_upi_details SET is_primary = false WHERE provider_id = ${providerId}
            `;
      }

      const result = await sql`
            INSERT INTO provider_upi_details 
                (provider_id, upi_id, upi_provider, is_primary)
            VALUES (${providerId}, ${upi_id.toLowerCase()}, ${upi_provider || null}, ${is_primary || false})
            RETURNING *
        `;

      res.status(201).json({
        success: true,
        message: "UPI ID added successfully",
        data: result[0],
      });
    } catch (error: any) {
      console.error("Error adding UPI ID:", error);
      if (error.code === "23505") {
        // Unique constraint violation
        return res.status(400).json({
          success: false,
          message: "This UPI ID is already registered",
        });
      }
      res.status(500).json({ success: false, message: "Failed to add UPI ID" });
    }
  },
);

// Update a UPI ID
router.put(
  "/:providerId/upi/:upiId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerId, upiId } = req.params;
      const { upi_id, upi_provider, is_primary } = req.body;

      // Check if UPI entry exists and belongs to provider
      const upiCheck = await sql`
            SELECT id FROM provider_upi_details WHERE id = ${upiId} AND provider_id = ${providerId}
        `;

      if (upiCheck.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "UPI ID not found" });
      }

      // Validate UPI ID format if provided
      if (upi_id) {
        const upiIdLower = upi_id.toLowerCase().trim();

        if (upiIdLower.length < 5 || upiIdLower.length > 50) {
          return res.status(400).json({
            success: false,
            message: "UPI ID must be between 5 and 50 characters",
          });
        }

        const upiRegex =
          /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,}@[a-zA-Z][a-zA-Z0-9]{2,}$/;
        if (!upiRegex.test(upiIdLower)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid UPI ID format. Example: yourname@paytm or 9876543210@ybl",
          });
        }
      }

      // If setting as primary, unset other primary UPI IDs
      if (is_primary) {
        await sql`
                UPDATE provider_upi_details SET is_primary = false WHERE provider_id = ${providerId} AND id != ${upiId}
            `;
      }

      const result = await sql`
            UPDATE provider_upi_details SET
                upi_id = COALESCE(${upi_id ? upi_id.toLowerCase() : null}, upi_id),
                upi_provider = COALESCE(${upi_provider}, upi_provider),
                is_primary = COALESCE(${is_primary}, is_primary),
                is_verified = false,
                updated_at = NOW()
            WHERE id = ${upiId} AND provider_id = ${providerId}
            RETURNING *
        `;

      res.json({
        success: true,
        message: "UPI ID updated successfully",
        data: result[0],
      });
    } catch (error) {
      console.error("Error updating UPI ID:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update UPI ID" });
    }
  },
);

// Delete a UPI ID
router.delete(
  "/:providerId/upi/:upiId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerId, upiId } = req.params;

      const result = await sql`
            DELETE FROM provider_upi_details WHERE id = ${upiId} AND provider_id = ${providerId} RETURNING id
        `;

      if (result.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "UPI ID not found" });
      }

      res.json({
        success: true,
        message: "UPI ID deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting UPI ID:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete UPI ID" });
    }
  },
);

// ==========================================
// COMBINED PAYMENT DETAILS
// ==========================================

// Get all payment details for a provider (bank accounts + UPI)
router.get(
  "/:providerId/all",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;

      const [bankAccounts, upiDetails] = await Promise.all([
        sql`
                SELECT 
                    id, account_holder_name, account_number, ifsc_code, 
                    bank_name, branch_name, account_type, is_primary, 
                    is_verified, verified_at, created_at, updated_at
                FROM provider_bank_accounts 
                WHERE provider_id = ${providerId}
                ORDER BY is_primary DESC, created_at DESC
            `,
        sql`
                SELECT 
                    id, upi_id, upi_provider, is_primary, 
                    is_verified, verified_at, created_at, updated_at
                FROM provider_upi_details 
                WHERE provider_id = ${providerId}
                ORDER BY is_primary DESC, created_at DESC
            `,
      ]);

      res.json({
        success: true,
        data: {
          bank_accounts: bankAccounts,
          upi_details: upiDetails,
        },
      });
    } catch (error) {
      console.error("Error fetching payment details:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch payment details" });
    }
  },
);

export default router;
