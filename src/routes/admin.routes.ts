import express, { Request, Response } from "express";
import multer from "multer";
import { requireAdmin } from "../middlewares/admin.middleware";
import { uploadServiceImage, deleteServiceImage } from "../supabaseStorage";
import { sendJobAssignedNotification } from "../services/notification.service";
import {
  notifyProviderNewJob,
  notifyUserBookingUpdate,
} from "../services/socket.service";
import {
  createSubcategory,
  getSubcategoryById,
  getAllSubcategories,
  updateSubcategory,
  deleteSubcategory,
  subcategoryExistsByName,
} from "../models/subcategory.model";
import {
  createProvider,
  getProviderById,
  getAllProviders,
  updateProvider,
  deleteProvider,
  providerExistsByPhone,
} from "../models/provider.model";
import {
  assignProviderToServices,
  updateProviderServiceStatus,
  getProviderServiceById,
  getAllProviderServices,
  removeProviderFromService,
} from "../models/provider-service.model";
import {
  createServiceV2,
  getAllServicesV2,
  updateServiceV2,
  deleteServiceV2,
  getServiceByIdWithDetails,
} from "../models/service-v2.model";
import { getCategoryById } from "../models/category.model";
import {
  getAllPromoCodes,
  getPromoCodeById,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  promoCodeExists,
} from "../models/promo-code.model";

const router = express.Router();

// Configure multer for memory storage (files stored in buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.",
        ),
      );
    }
  },
});

// All routes require admin authentication
router.use(requireAdmin);

// ============== IMAGE UPLOAD ENDPOINT ==============

/**
 * POST /admin/upload/service-image
 * Upload a service image to Supabase Storage
 *
 * Request: multipart/form-data with 'image' file and 'serviceId' field
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { "url": "https://..." }
 * }
 */
router.post(
  "/upload/service-image",
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      const serviceId = req.body.serviceId;

      if (!file) {
        return res
          .status(400)
          .json({ success: false, error: "No image file provided" });
      }

      if (!serviceId) {
        return res
          .status(400)
          .json({ success: false, error: "serviceId is required" });
      }

      const imageUrl = await uploadServiceImage(
        file.buffer,
        file.originalname,
        serviceId,
        file.mimetype,
      );

      res.json({ success: true, data: { url: imageUrl } });
    } catch (err: any) {
      console.error("Error uploading image:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to upload image",
      });
    }
  },
);

/**
 * DELETE /admin/upload/service-image
 * Delete a service image from Supabase Storage
 *
 * Request Body:
 * {
 *   "imageUrl": "https://..."
 * }
 */
router.delete("/upload/service-image", async (req: Request, res: Response) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res
        .status(400)
        .json({ success: false, error: "imageUrl is required" });
    }

    await deleteServiceImage(imageUrl);
    res.json({ success: true, message: "Image deleted" });
  } catch (err: any) {
    console.error("Error deleting image:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to delete image",
    });
  }
});

// ============== SUBCATEGORY ENDPOINTS ==============

/**
 * POST /admin/subcategories
 * Create a new subcategory
 *
 * Request Body:
 * {
 *   "categoryId": "uuid",
 *   "name": "string",
 *   "icon": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { subcategory object }
 * }
 */
router.post("/subcategories", async (req: Request, res: Response) => {
  try {
    const { categoryId, name, icon } = req.body;

    // Validation
    if (!categoryId) {
      return res
        .status(400)
        .json({ success: false, error: "categoryId is required" });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "name is required" });
    }

    // Check if category exists
    const category = await getCategoryById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, error: "Category not found" });
    }

    // Check for duplicate name in same category
    const exists = await subcategoryExistsByName(categoryId, name.trim());
    if (exists) {
      return res.status(409).json({
        success: false,
        error: "Subcategory with this name already exists in this category",
      });
    }

    const subcategory = await createSubcategory(categoryId, name.trim(), icon);
    res.status(201).json({ success: true, data: subcategory });
  } catch (err: any) {
    console.error("Error creating subcategory:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to create subcategory" });
  }
});

/**
 * GET /admin/subcategories
 * Get all subcategories
 */
router.get("/subcategories", async (req: Request, res: Response) => {
  try {
    const subcategories = await getAllSubcategories();
    res.json({ success: true, data: subcategories });
  } catch (err: any) {
    console.error("Error fetching subcategories:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch subcategories" });
  }
});

/**
 * PATCH /admin/subcategories/:id
 * Update a subcategory
 */
router.patch("/subcategories/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, icon, image_url, categoryId } = req.body;

    const existing = await getSubcategoryById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Subcategory not found" });
    }

    const updated = await updateSubcategory(id, {
      name,
      icon,
      image_url,
      category_id: categoryId,
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("Error updating subcategory:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to update subcategory" });
  }
});

/**
 * DELETE /admin/subcategories/:id
 * Delete a subcategory
 */
router.delete("/subcategories/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await deleteSubcategory(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, error: "Subcategory not found" });
    }
    res.json({ success: true, message: "Subcategory deleted" });
  } catch (err: any) {
    console.error("Error deleting subcategory:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete subcategory" });
  }
});

// ============== SERVICE ENDPOINTS ==============

/**
 * POST /admin/services
 * Create a new service
 *
 * Request Body:
 * {
 *   "subcategoryId": "uuid",
 *   "name": "string",
 *   "description": "string (optional)",
 *   "basePrice": number (optional),
 *   "durationMinutes": number (optional),
 *   "thumbnailUrl": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { service object }
 * }
 */
router.post("/services", async (req: Request, res: Response) => {
  try {
    const {
      subcategoryId,
      name,
      description,
      basePrice,
      durationMinutes,
      thumbnailUrl,
    } = req.body;

    // Validation
    if (!subcategoryId) {
      return res
        .status(400)
        .json({ success: false, error: "subcategoryId is required" });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "name is required" });
    }

    // Check if subcategory exists
    const subcategory = await getSubcategoryById(subcategoryId);
    if (!subcategory) {
      return res
        .status(404)
        .json({ success: false, error: "Subcategory not found" });
    }

    const service = await createServiceV2({
      subcategory_id: subcategoryId,
      name: name.trim(),
      description,
      base_price: basePrice,
      duration_minutes: durationMinutes,
      thumbnail_url: thumbnailUrl,
    });

    res.status(201).json({ success: true, data: service });
  } catch (err: any) {
    console.error("Error creating service:", err);
    res.status(500).json({ success: false, error: "Failed to create service" });
  }
});

/**
 * GET /admin/services
 * Get all services with details
 */
router.get("/services", async (req: Request, res: Response) => {
  try {
    const services = await getAllServicesV2();
    res.json({ success: true, data: services });
  } catch (err: any) {
    console.error("Error fetching services:", err);
    res.status(500).json({ success: false, error: "Failed to fetch services" });
  }
});

/**
 * PATCH /admin/services/:id
 * Update a service
 */
router.patch("/services/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      subcategoryId,
      name,
      description,
      basePrice,
      isActive,
      durationMinutes,
      thumbnailUrl,
    } = req.body;

    const existing = await getServiceByIdWithDetails(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Service not found" });
    }

    const updated = await updateServiceV2(id, {
      subcategory_id: subcategoryId,
      name,
      description,
      base_price: basePrice,
      is_active: isActive,
      duration_minutes: durationMinutes,
      thumbnail_url: thumbnailUrl,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("Error updating service:", err);
    res.status(500).json({ success: false, error: "Failed to update service" });
  }
});

/**
 * DELETE /admin/services/:id
 * Delete a service
 */
router.delete("/services/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await deleteServiceV2(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, error: "Service not found" });
    }
    res.json({ success: true, message: "Service deleted" });
  } catch (err: any) {
    console.error("Error deleting service:", err);
    res.status(500).json({ success: false, error: "Failed to delete service" });
  }
});

// ============== PROVIDER ENDPOINTS ==============

/**
 * POST /admin/providers
 * Create a new provider
 *
 * Request Body:
 * {
 *   "name": "string",
 *   "phone": "string",
 *   "experience": number (optional, years),
 *   "status": "pending" | "active" | "blocked" (optional, default: pending),
 *   "avatarUrl": "string (optional)"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { provider object }
 * }
 */
router.post("/providers", async (req: Request, res: Response) => {
  try {
    const { name, phone, experience, status, avatarUrl } = req.body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "name is required" });
    }
    if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "phone is required" });
    }
    if (status && !["pending", "active", "blocked"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "status must be 'pending', 'active', or 'blocked'",
      });
    }

    // Check for duplicate phone
    const exists = await providerExistsByPhone(phone.trim());
    if (exists) {
      return res.status(409).json({
        success: false,
        error: "Provider with this phone number already exists",
      });
    }

    const provider = await createProvider({
      name: name.trim(),
      phone: phone.trim(),
      experience: experience || 0,
      status: status || "pending",
      avatar_url: avatarUrl,
    });

    res.status(201).json({ success: true, data: provider });
  } catch (err: any) {
    console.error("Error creating provider:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to create provider" });
  }
});

/**
 * GET /admin/providers
 * Get all providers
 * Query params: ?status=active|pending|blocked (optional)
 */
router.get("/providers", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as
      | "pending"
      | "active"
      | "blocked"
      | undefined;
    const providers = await getAllProviders(status);
    res.json({ success: true, data: providers });
  } catch (err: any) {
    console.error("Error fetching providers:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch providers" });
  }
});

/**
 * GET /admin/providers/:id
 * Get provider by ID
 */
router.get("/providers/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const provider = await getProviderById(id);
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, error: "Provider not found" });
    }
    res.json({ success: true, data: provider });
  } catch (err: any) {
    console.error("Error fetching provider:", err);
    res.status(500).json({ success: false, error: "Failed to fetch provider" });
  }
});

/**
 * PATCH /admin/providers/:id
 * Update a provider
 */
router.patch("/providers/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, experience, status, avatarUrl } = req.body;

    if (status && !["pending", "active", "blocked"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "status must be 'pending', 'active', or 'blocked'",
      });
    }

    const existing = await getProviderById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Provider not found" });
    }

    const updated = await updateProvider(id, {
      name,
      phone,
      experience,
      status,
      avatar_url: avatarUrl,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("Error updating provider:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to update provider" });
  }
});

/**
 * DELETE /admin/providers/:id
 * Delete a provider
 */
router.delete("/providers/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await deleteProvider(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, error: "Provider not found" });
    }
    res.json({ success: true, message: "Provider deleted" });
  } catch (err: any) {
    console.error("Error deleting provider:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete provider" });
  }
});

// ============== PROVIDER-SERVICE ASSIGNMENT ENDPOINTS ==============

/**
 * POST /admin/assign-provider
 * Assign a provider to one or more services
 *
 * Request Body:
 * {
 *   "providerId": "uuid",
 *   "serviceIds": ["uuid", "uuid", ...]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "assigned": [...newly assigned],
 *     "skipped": number (already assigned count)
 *   }
 * }
 */
router.post("/assign-provider", async (req: Request, res: Response) => {
  try {
    const { providerId, serviceIds } = req.body;

    // Validation
    if (!providerId) {
      return res
        .status(400)
        .json({ success: false, error: "providerId is required" });
    }
    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "serviceIds must be a non-empty array",
      });
    }

    // Check if provider exists
    const provider = await getProviderById(providerId);
    if (!provider) {
      return res
        .status(404)
        .json({ success: false, error: "Provider not found" });
    }

    // Assign provider to services (duplicates are handled in the model)
    const assigned = await assignProviderToServices(providerId, serviceIds);
    const skippedCount = serviceIds.length - assigned.length;

    res.status(201).json({
      success: true,
      data: {
        assigned,
        skipped: skippedCount,
        message:
          skippedCount > 0
            ? `${assigned.length} assigned, ${skippedCount} skipped (already assigned or service not found)`
            : `${assigned.length} services assigned to provider`,
      },
    });
  } catch (err: any) {
    console.error("Error assigning provider:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to assign provider to services" });
  }
});

/**
 * PATCH /admin/provider-services/:id
 * Enable or disable a provider-service assignment
 *
 * Request Body:
 * {
 *   "status": "active" | "inactive"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { provider_service object }
 * }
 */
router.patch("/provider-services/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validation
    if (!status || !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "status must be 'active' or 'inactive'",
      });
    }

    const existing = await getProviderServiceById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Provider-service assignment not found",
      });
    }

    const updated = await updateProviderServiceStatus(id, status);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("Error updating provider-service status:", err);
    res.status(500).json({ success: false, error: "Failed to update status" });
  }
});

/**
 * GET /admin/provider-services
 * Get all provider-service assignments
 */
router.get("/provider-services", async (req: Request, res: Response) => {
  try {
    const assignments = await getAllProviderServices();
    res.json({ success: true, data: assignments });
  } catch (err: any) {
    console.error("Error fetching provider-services:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch assignments" });
  }
});

/**
 * DELETE /admin/provider-services/:id
 * Remove a provider-service assignment
 */
router.delete("/provider-services/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await removeProviderFromService(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, error: "Assignment not found" });
    }
    res.json({ success: true, message: "Assignment removed" });
  } catch (err: any) {
    console.error("Error removing provider-service:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to remove assignment" });
  }
});

// ============== BOOKINGS MANAGEMENT ==============

import sql from "../db";

/**
 * GET /admin/bookings
 * Get all bookings for admin dashboard
 */
router.get("/bookings", async (req: Request, res: Response) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;

    let result;
    if (status && status !== "all") {
      result = await sql`
        SELECT b.*,
               p.name as provider_name,
               p.phone as provider_phone,
               p.email as provider_email,
               COALESCE(
                 (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
                 p.avatar_url
               ) as provider_photo
        FROM bookings b
        LEFT JOIN providers p ON b.provider_id = p.id
        WHERE b.status = ${status as string}
        ORDER BY b.created_at DESC
        LIMIT ${Number(limit)}
        OFFSET ${Number(offset)}
      `;
    } else {
      result = await sql`
        SELECT b.*,
               p.name as provider_name,
               p.phone as provider_phone,
               p.email as provider_email,
               COALESCE(
                 (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
                 p.avatar_url
               ) as provider_photo
        FROM bookings b
        LEFT JOIN providers p ON b.provider_id = p.id
        ORDER BY b.created_at DESC
        LIMIT ${Number(limit)}
        OFFSET ${Number(offset)}
      `;
    }

    // Parse JSON fields and add provider info
    const bookings = result.map((row: any) => {
      const booking: any = {
        ...row,
        service:
          typeof row.service === "string"
            ? JSON.parse(row.service)
            : row.service,
        delivery_address:
          typeof row.delivery_address === "string"
            ? JSON.parse(row.delivery_address)
            : row.delivery_address,
      };

      // Add provider object if assigned
      if (row.provider_id) {
        booking.provider = {
          id: row.provider_id,
          name: row.provider_name,
          phone: row.provider_phone,
          email: row.provider_email,
          photo_url: row.provider_photo,
        };
      }

      // Clean up temporary fields
      delete booking.provider_name;
      delete booking.provider_phone;
      delete booking.provider_email;
      delete booking.provider_photo;

      return booking;
    });

    res.json({ success: true, bookings });
  } catch (err: any) {
    console.error("Error fetching all bookings:", err);
    res.status(500).json({ success: false, error: "Failed to fetch bookings" });
  }
});

/**
 * PATCH /admin/bookings/:id/status
 * Update booking status (admin only)
 */
router.patch("/bookings/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await sql`
      UPDATE bookings 
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Booking not found" });
    }

    res.json({ success: true, booking: result[0] });
  } catch (err: any) {
    console.error("Error updating booking status:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to update booking status" });
  }
});

/**
 * PATCH /admin/bookings/:id/assign-provider
 * Assign a service provider to a booking
 */
router.patch(
  "/bookings/:id/assign-provider",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { provider_id } = req.body;

      if (!provider_id) {
        return res
          .status(400)
          .json({ success: false, error: "provider_id is required" });
      }

      // Check if provider exists and is approved/active
      const provider = await sql`
      SELECT id, name, phone, email, status, avatar_url as profile_image_url, provider_type, specializations
      FROM providers 
      WHERE id = ${provider_id} AND status IN ('approved', 'active')
    `;

      if (provider.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Provider not found or not approved/active",
        });
      }

      // Update the booking with the provider
      const result = await sql`
      UPDATE bookings 
      SET 
        provider_id = ${provider_id}, 
        status = 'assigned',
        assigned_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

      if (result.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Booking not found" });
      }

      // Parse the booking
      const bookingData = result[0];
      const booking = {
        ...bookingData,
        service:
          typeof bookingData.service === "string"
            ? JSON.parse(bookingData.service)
            : bookingData.service,
        delivery_address:
          typeof bookingData.delivery_address === "string"
            ? JSON.parse(bookingData.delivery_address)
            : bookingData.delivery_address,
        provider: provider[0],
      };

      // Send push notification to the provider (async, don't wait)
      const address = booking.delivery_address;
      const addressStr =
        typeof address === "object" && address
          ? `${address.line1 || ""}, ${address.city || ""}`
          : address || "Address not available";

      sendJobAssignedNotification(provider_id, id, {
        bookingId: id,
        customerName:
          (bookingData as any).customer_name ||
          bookingData.user_id ||
          "Customer",
        serviceName:
          booking.service?.name || booking.service?.service_name || "Service",
        serviceTime: bookingData.time_slot,
        serviceDate: bookingData.booking_date,
        address: addressStr,
        price: `₹${bookingData.final_amount || booking.service?.price || 0}`,
        status: "assigned",
      })
        .then((notifResult) => {
          if (notifResult.success) {
            console.log(`✅ Push notification sent to provider ${provider_id}`);
          } else {
            console.log(
              `⚠️ Could not send push notification: ${notifResult.error}`,
            );
          }
        })
        .catch((err) => {
          console.error("Error sending push notification:", err);
        });

      // Send real-time Socket.io notification to provider dashboard
      notifyProviderNewJob(provider_id, booking);

      // Send real-time Socket.io notification to customer about provider assignment
      if (bookingData.user_id) {
        notifyUserBookingUpdate(bookingData.user_id, id, {
          id: id,
          status: "assigned",
          provider: {
            id: provider[0].id,
            name: provider[0].name,
            phone: provider[0].phone,
            profile_image_url: provider[0].profile_image_url,
            provider_type: provider[0].provider_type,
          },
          assigned_at: new Date().toISOString(),
        });
        console.log(
          `✅ Real-time notification sent to customer ${bookingData.user_id} for provider assignment`,
        );
      }

      res.json({
        success: true,
        message: "Provider assigned successfully",
        booking,
      });
    } catch (err: any) {
      console.error("Error assigning provider to booking:", err);
      res
        .status(500)
        .json({ success: false, error: "Failed to assign provider" });
    }
  },
);

/**
 * GET /admin/approved-providers
 * Get all approved providers for assignment
 */
router.get("/approved-providers", async (req: Request, res: Response) => {
  try {
    const { service_category } = req.query;

    // Get providers with status 'approved' or 'active' (both mean ready to work)
    const result = await sql`
      SELECT 
        p.id,
        p.name,
        p.phone,
        p.email,
        COALESCE(
          (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
          p.avatar_url
        ) as profile_image_url,
        p.provider_type,
        p.specializations,
        p.status,
        p.approved_at,
        COALESCE(
          (SELECT COUNT(*) FROM bookings 
           WHERE provider_id = p.id AND status = 'completed'), 
          0
        )::int as completed_jobs
      FROM providers p
      WHERE p.status IN ('approved', 'active')
      ORDER BY completed_jobs DESC, p.name ASC
    `;

    res.json({
      success: true,
      providers: result.map((p: any) => ({
        ...p,
        rating: 4.5, // Default rating for now
        specializations:
          typeof p.specializations === "string"
            ? JSON.parse(p.specializations)
            : p.specializations || [],
      })),
    });
  } catch (err: any) {
    console.error("Error fetching approved providers:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch providers",
      details: err.message,
    });
  }
});

// ============== PROVIDER REGISTRATION MANAGEMENT ==============

/**
 * GET /admin/provider-registrations
 * Get all provider registrations with optional status filter
 */
router.get("/provider-registrations", async (req: Request, res: Response) => {
  try {
    const { status, kyc_status, provider_type } = req.query;

    let query = sql`
      SELECT 
        p.*,
        (
          SELECT json_agg(json_build_object(
            'id', pd.id,
            'document_type', pd.document_type,
            'file_url', pd.file_url,
            'verification_status', pd.verification_status,
            'rejection_reason', pd.rejection_reason,
            'created_at', pd.created_at
          ))
          FROM provider_documents pd
          WHERE pd.provider_id = p.id
        ) as documents
      FROM providers p
      WHERE 1=1
    `;

    // Build conditions dynamically
    const conditions: string[] = [];

    if (status) {
      conditions.push(`p.status = '${status}'`);
    }
    if (kyc_status) {
      conditions.push(`p.kyc_status = '${kyc_status}'`);
    }
    if (provider_type) {
      conditions.push(`p.provider_type = '${provider_type}'`);
    }

    // Simple approach - just get all and filter
    const allProviders = await sql`
      SELECT 
        p.*,
        (
          SELECT json_agg(json_build_object(
            'id', pd.id,
            'document_type', pd.document_type,
            'file_url', pd.file_url,
            'verification_status', pd.verification_status,
            'rejection_reason', pd.rejection_reason,
            'created_at', pd.created_at
          ))
          FROM provider_documents pd
          WHERE pd.provider_id = p.id
        ) as documents
      FROM providers p
      ORDER BY p.created_at DESC
    `;

    let providers: any[] = [...allProviders];

    // Filter in JS for simplicity
    if (status) {
      providers = providers.filter((p: any) => p.status === status);
    }
    if (kyc_status) {
      providers = providers.filter((p: any) => p.kyc_status === kyc_status);
    }
    if (provider_type) {
      providers = providers.filter(
        (p: any) => p.provider_type === provider_type,
      );
    }

    res.json({ success: true, providers });
  } catch (err: any) {
    console.error("Error fetching provider registrations:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch provider registrations",
    });
  }
});

/**
 * GET /admin/provider-registrations/:id
 * Get detailed provider registration info
 */
router.get(
  "/provider-registrations/:id",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [provider] = await sql`
      SELECT * FROM providers WHERE id = ${id}
    `;

      if (!provider) {
        return res
          .status(404)
          .json({ success: false, error: "Provider not found" });
      }

      const documents = await sql`
      SELECT * FROM provider_documents WHERE provider_id = ${id}
    `;

      const verifications = await sql`
      SELECT * FROM digilocker_verifications WHERE provider_id = ${id}
    `;

      const activityLog = await sql`
      SELECT 
        pal.*,
        u.name as performed_by_name
      FROM provider_activity_log pal
      LEFT JOIN users u ON u.id = pal.performed_by
      WHERE pal.provider_id = ${id}
      ORDER BY pal.created_at DESC
    `;

      res.json({
        success: true,
        provider,
        documents,
        verifications,
        activity_log: activityLog,
      });
    } catch (err: any) {
      console.error("Error fetching provider details:", err);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch provider details" });
    }
  },
);

/**
 * PATCH /admin/provider-registrations/:id/approve
 * Approve a provider registration
 */
router.patch(
  "/provider-registrations/:id/approve",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const adminUserId = (req as any).userId;

      const [provider] = await sql`
      SELECT * FROM providers WHERE id = ${id}
    `;

      if (!provider) {
        return res
          .status(404)
          .json({ success: false, error: "Provider not found" });
      }

      // Update provider status
      const [updated] = await sql`
      UPDATE providers
      SET 
        status = 'active',
        kyc_status = 'verified',
        approved_by = ${adminUserId},
        approved_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

      // Log the approval
      await sql`
      INSERT INTO provider_activity_log (provider_id, action, performed_by, old_value, new_value, notes)
      VALUES (
        ${id},
        'approved',
        ${adminUserId},
        ${JSON.stringify({ status: provider.status, kyc_status: provider.kyc_status })},
        ${JSON.stringify({ status: "active", kyc_status: "verified" })},
        'Provider approved by admin'
      )
    `;

      // TODO: Send notification to provider (SMS/Email)

      res.json({
        success: true,
        message: "Provider approved successfully",
        provider: updated,
      });
    } catch (err: any) {
      console.error("Error approving provider:", err);
      res
        .status(500)
        .json({ success: false, error: "Failed to approve provider" });
    }
  },
);

/**
 * PATCH /admin/provider-registrations/:id/reject
 * Reject a provider registration
 */
router.patch(
  "/provider-registrations/:id/reject",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminUserId = (req as any).userId;

      if (!reason) {
        return res
          .status(400)
          .json({ success: false, error: "Rejection reason is required" });
      }

      const [provider] = await sql`
      SELECT * FROM providers WHERE id = ${id}
    `;

      if (!provider) {
        return res
          .status(404)
          .json({ success: false, error: "Provider not found" });
      }

      // Update provider status
      const [updated] = await sql`
      UPDATE providers
      SET 
        status = 'blocked',
        kyc_status = 'rejected',
        rejection_reason = ${reason}
      WHERE id = ${id}
      RETURNING *
    `;

      // Log the rejection
      await sql`
      INSERT INTO provider_activity_log (provider_id, action, performed_by, old_value, new_value, notes)
      VALUES (
        ${id},
        'rejected',
        ${adminUserId},
        ${JSON.stringify({ status: provider.status, kyc_status: provider.kyc_status })},
        ${JSON.stringify({ status: "blocked", kyc_status: "rejected" })},
        ${reason}
      )
    `;

      // TODO: Send notification to provider (SMS/Email)

      res.json({
        success: true,
        message: "Provider rejected",
        provider: updated,
      });
    } catch (err: any) {
      console.error("Error rejecting provider:", err);
      res
        .status(500)
        .json({ success: false, error: "Failed to reject provider" });
    }
  },
);

/**
 * PATCH /admin/provider-registrations/:id/documents/:docId/verify
 * Verify a specific document
 */
router.patch(
  "/provider-registrations/:id/documents/:docId/verify",
  async (req: Request, res: Response) => {
    try {
      const { id, docId } = req.params;
      const { status, rejection_reason } = req.body;
      const adminUserId = (req as any).userId;

      if (!status || !["verified", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Status must be 'verified' or 'rejected'",
        });
      }

      if (status === "rejected" && !rejection_reason) {
        return res
          .status(400)
          .json({ success: false, error: "Rejection reason is required" });
      }

      const [doc] = await sql`
      UPDATE provider_documents
      SET 
        verification_status = ${status},
        verified_by = ${adminUserId},
        verified_at = NOW(),
        rejection_reason = ${status === "rejected" ? rejection_reason : null}
      WHERE id = ${docId} AND provider_id = ${id}
      RETURNING *
    `;

      if (!doc) {
        return res
          .status(404)
          .json({ success: false, error: "Document not found" });
      }

      // Log the verification
      await sql`
      INSERT INTO provider_activity_log (provider_id, action, performed_by, new_value)
      VALUES (
        ${id},
        'document_verified',
        ${adminUserId},
        ${JSON.stringify({ document_type: doc.document_type, status })}
      )
    `;

      res.json({
        success: true,
        message: `Document ${status}`,
        document: doc,
      });
    } catch (err: any) {
      console.error("Error verifying document:", err);
      res
        .status(500)
        .json({ success: false, error: "Failed to verify document" });
    }
  },
);

// ============== PROMO CODES CRUD ==============

/**
 * GET /admin/promo-codes
 * Get all promo codes
 */
router.get("/promo-codes", async (_req: Request, res: Response) => {
  try {
    const promoCodes = await getAllPromoCodes();
    res.json({ success: true, data: promoCodes });
  } catch (err: any) {
    console.error("Error fetching promo codes:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch promo codes" });
  }
});

/**
 * GET /admin/promo-codes/:id
 * Get a single promo code by ID
 */
router.get("/promo-codes/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const promoCode = await getPromoCodeById(id);

    if (!promoCode) {
      return res
        .status(404)
        .json({ success: false, error: "Promo code not found" });
    }

    res.json({ success: true, data: promoCode });
  } catch (err: any) {
    console.error("Error fetching promo code:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch promo code" });
  }
});

/**
 * POST /admin/promo-codes
 * Create a new promo code
 */
router.post("/promo-codes", async (req: Request, res: Response) => {
  try {
    const {
      code,
      description,
      discount_type,
      discount_value,
      min_order_value,
      max_discount,
      usage_limit,
      valid_from,
      valid_until,
      is_active,
    } = req.body;

    if (!code || !discount_type || discount_value === undefined) {
      return res.status(400).json({
        success: false,
        error: "code, discount_type, and discount_value are required",
      });
    }

    if (!["flat", "percentage"].includes(discount_type)) {
      return res.status(400).json({
        success: false,
        error: "discount_type must be 'flat' or 'percentage'",
      });
    }

    // Check if code already exists
    const exists = await promoCodeExists(code);
    if (exists) {
      return res
        .status(400)
        .json({ success: false, error: "Promo code already exists" });
    }

    const promoCode = await createPromoCode({
      code,
      description,
      discount_type,
      discount_value,
      min_order_value,
      max_discount,
      usage_limit,
      valid_from,
      valid_until,
      is_active,
    });

    res.status(201).json({ success: true, data: promoCode });
  } catch (err: any) {
    console.error("Error creating promo code:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to create promo code" });
  }
});

/**
 * PUT /admin/promo-codes/:id
 * Update a promo code
 */
router.put("/promo-codes/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existing = await getPromoCodeById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Promo code not found" });
    }

    // If updating code, check for duplicates
    if (updates.code && updates.code.toUpperCase() !== existing.code) {
      const exists = await promoCodeExists(updates.code);
      if (exists) {
        return res
          .status(400)
          .json({ success: false, error: "Promo code already exists" });
      }
    }

    const promoCode = await updatePromoCode(id, updates);
    res.json({ success: true, data: promoCode });
  } catch (err: any) {
    console.error("Error updating promo code:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to update promo code" });
  }
});

/**
 * DELETE /admin/promo-codes/:id
 * Delete a promo code
 */
router.delete("/promo-codes/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await getPromoCodeById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Promo code not found" });
    }

    await deletePromoCode(id);
    res.json({ success: true, message: "Promo code deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting promo code:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete promo code" });
  }
});

export default router;
