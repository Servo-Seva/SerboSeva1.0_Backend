import express from "express";
import { getPopularServices, getServiceById } from "../models/category.model";
import sql from "../db";

const router = express.Router();

// Get all services (for admin dropdowns)
router.get("/services", async (req, res) => {
  try {
    const rows = await sql`
      SELECT id, name
      FROM services
      WHERE is_active = true
      ORDER BY name ASC
    `;
    res.json(rows);
  } catch (err: any) {
    console.error("Error in /services:", err);
    res
      .status(500)
      .json({ error: "failed to fetch services", details: err.message });
  }
});

// popular services
router.get("/services/popular", async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit || "10"), 10) || 10;
    const items = await getPopularServices(limit);
    res.json(items);
  } catch (err: any) {
    console.error("Error in /services/popular:", err);
    res.status(500).json({
      error: "failed to fetch popular services",
      details: err.message,
    });
  }
});

// Get web design & development services
router.get("/services/web-services", async (req, res) => {
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
      error: "failed to fetch web services",
      details: err.message,
    });
  }
});

// get service details
router.get("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const svc = await getServiceById(id);
    if (!svc)
      return res
        .status(404)
        .json({ success: false, error: "service not found" });
    res.json({ success: true, data: svc });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: "failed to fetch service" });
  }
});

export default router;
