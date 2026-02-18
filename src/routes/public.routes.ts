import express, { Request, Response } from "express";
import sql from "../db";
import {
  listCategoriesWithCounts,
  getCategoryById,
  getPopularServices,
} from "../models/category.model";
import {
  getSubcategoriesByCategoryId,
  getSubcategoryById,
} from "../models/subcategory.model";
import {
  getServicesBySubcategoryId,
  getServiceByIdWithDetails,
} from "../models/service-v2.model";
import { getActiveProvidersForService } from "../models/provider-service.model";
import {
  validatePromoCode,
  getActivePromoCodes,
} from "../models/promo-code.model";

const router = express.Router();

// ============== CATEGORY ENDPOINTS ==============

/**
 * GET /api/categories
 * Get all categories with service counts
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "name": "AC & Appliances",
 *       "description": "...",
 *       "created_at": "...",
 *       "service_count": 15
 *     }
 *   ]
 * }
 */
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categories = await listCategoriesWithCounts();
    res.json({ success: true, data: categories });
  } catch (err: any) {
    console.error("Error fetching categories:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch categories" });
  }
});

/**
 * GET /api/categories/:categoryId
 * Get a single category by ID
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { category object }
 * }
 */
router.get("/categories/:categoryId", async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const category = await getCategoryById(categoryId);

    if (!category) {
      return res
        .status(404)
        .json({ success: false, error: "Category not found" });
    }

    res.json({ success: true, data: category });
  } catch (err: any) {
    console.error("Error fetching category:", err);
    res.status(500).json({ success: false, error: "Failed to fetch category" });
  }
});

// ============== SUBCATEGORY ENDPOINTS ==============

/**
 * GET /api/categories/:categoryId/subcategories
 * Get all subcategories for a category
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "category_id": "uuid",
 *       "name": "Home Appliances",
 *       "icon": "❄️",
 *       "created_at": "..."
 *     }
 *   ]
 * }
 */
router.get(
  "/categories/:categoryId/subcategories",
  async (req: Request, res: Response) => {
    try {
      const { categoryId } = req.params;

      // Check if category exists
      const category = await getCategoryById(categoryId);
      if (!category) {
        return res
          .status(404)
          .json({ success: false, error: "Category not found" });
      }

      const subcategories = await getSubcategoriesByCategoryId(categoryId);
      res.json({
        success: true,
        data: subcategories,
        category: {
          id: category.id,
          name: category.name,
        },
      });
    } catch (err: any) {
      console.error("Error fetching subcategories:", err);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch subcategories" });
    }
  },
);

// ============== SERVICE ENDPOINTS ==============

/**
 * GET /api/subcategories/:subcategoryId/services
 * Get all services for a subcategory
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "subcategory_id": "uuid",
 *       "name": "AC Installation",
 *       "description": "...",
 *       "base_price": "500",
 *       "is_active": true,
 *       ...
 *     }
 *   ],
 *   "subcategory": { id, name }
 * }
 */
router.get(
  "/subcategories/:subcategoryId/services",
  async (req: Request, res: Response) => {
    try {
      const { subcategoryId } = req.params;

      // Check if subcategory exists
      const subcategory = await getSubcategoryById(subcategoryId);
      if (!subcategory) {
        return res
          .status(404)
          .json({ success: false, error: "Subcategory not found" });
      }

      const services = await getServicesBySubcategoryId(subcategoryId);
      res.json({
        success: true,
        data: services,
        subcategory: {
          id: subcategory.id,
          name: subcategory.name,
          icon: subcategory.icon,
          category_id: subcategory.category_id,
        },
      });
    } catch (err: any) {
      console.error("Error fetching services:", err);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch services" });
    }
  },
);

/**
 * GET /api/services/:serviceId
 * Get a single service with full details
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { service object with subcategory and category info }
 * }
 */

/**
 * GET /api/services/popular
 * Get popular services
 */
router.get("/services/popular", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || "8"), 10) || 8;
    const services = await getPopularServices(limit);
    if (!services) {
      return res.json({ success: true, data: [] });
    }
    // Handle case where service might return {success: false} if using that pattern,
    // but looking at getPopularServices source code it returns Row[] directly.
    res.json({ success: true, data: services });
  } catch (err: any) {
    console.error("Error in /services/popular:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch popular services" });
  }
});

/**
 * GET /api/services/web-services
 * Get web design & development services
 */
router.get("/services/web-services", async (req: Request, res: Response) => {
  try {
    const rows = await sql`
      SELECT 
        s.id,
        s.name,
        s.description,
        s.price,
        s.base_price,
        s.thumbnail_url,
        s.duration_minutes,
        s.is_active,
        s.created_at,
        sub.name as subcategory_name,
        sub.icon as subcategory_icon,
        c.id as category_id,
        c.name as category_name,
        COALESCE(
          (SELECT AVG(rating)::numeric(3,2) FROM service_reviews WHERE service_id = s.id),
          4.5
        ) as avg_rating,
        COALESCE(
          (SELECT COUNT(*) FROM service_reviews WHERE service_id = s.id),
          0
        ) as reviews_count
      FROM services s
      LEFT JOIN subcategories sub ON s.subcategory_id = sub.id
      LEFT JOIN categories c ON sub.category_id = c.id
      WHERE s.is_active = true 
        AND (s.name ILIKE '%website%' OR s.name ILIKE '%web%')
        AND s.name NOT ILIKE '%content%'
      ORDER BY s.price ASC
      LIMIT 5
    `;
    res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error("Error in /services/web-services:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch web services",
    });
  }
});

router.get("/services/:serviceId", async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const service = await getServiceByIdWithDetails(serviceId);

    if (!service) {
      return res
        .status(404)
        .json({ success: false, error: "Service not found" });
    }

    res.json({ success: true, data: service });
  } catch (err: any) {
    console.error("Error fetching service:", err);
    res.status(500).json({ success: false, error: "Failed to fetch service" });
  }
});

// ============== PROVIDER ENDPOINTS ==============

/**
 * GET /api/services/:serviceId/providers
 * Get all active providers for a service
 *
 * Rules:
 * - Only returns providers where:
 *   - provider_services.status = 'active'
 *   - providers.status = 'active'
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "provider_id": "uuid",
 *       "provider_name": "John Doe",
 *       "provider_phone": "+91...",
 *       "provider_experience": 5,
 *       "provider_avatar_url": "...",
 *       "assignment_status": "active"
 *     }
 *   ],
 *   "service": { id, name }
 * }
 */
router.get(
  "/services/:serviceId/providers",
  async (req: Request, res: Response) => {
    try {
      const { serviceId } = req.params;

      // Check if service exists
      const service = await getServiceByIdWithDetails(serviceId);
      if (!service) {
        return res
          .status(404)
          .json({ success: false, error: "Service not found" });
      }

      // Get active providers for this service
      const providers = await getActiveProvidersForService(serviceId);

      res.json({
        success: true,
        data: providers,
        service: {
          id: service.id,
          name: service.name,
        },
      });
    } catch (err: any) {
      console.error("Error fetching providers for service:", err);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch providers" });
    }
  },
);

// ============== PROMO CODES ==============

/**
 * GET /api/promo-codes
 * Get active promo codes for display
 */
router.get("/promo-codes", async (_req: Request, res: Response) => {
  try {
    const promoCodes = await getActivePromoCodes(5);
    res.json({ success: true, data: promoCodes });
  } catch (err: any) {
    console.error("Error fetching promo codes:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch promo codes" });
  }
});

/**
 * POST /api/promo-codes/validate
 * Validate a promo code and get discount amount
 *
 * Request body:
 * {
 *   "code": "SAVE10",
 *   "order_total": 500
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "valid": true,
 *     "discount": 10,
 *     "message": "Promo code applied! You save ₹10"
 *   }
 * }
 */
router.post("/promo-codes/validate", async (req: Request, res: Response) => {
  try {
    const { code, order_total } = req.body;

    if (!code) {
      return res
        .status(400)
        .json({ success: false, error: "Promo code is required" });
    }

    if (order_total === undefined || order_total < 0) {
      return res
        .status(400)
        .json({ success: false, error: "Valid order_total is required" });
    }

    const result = await validatePromoCode(code, order_total);

    res.json({
      success: true,
      data: {
        valid: result.valid,
        discount: result.discount,
        message: result.message,
        promo_id: result.promo_code?.id,
        discount_type: result.promo_code?.discount_type,
        discount_value: result.promo_code?.discount_value,
      },
    });
  } catch (err: any) {
    console.error("Error validating promo code:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to validate promo code" });
  }
});

export default router;
