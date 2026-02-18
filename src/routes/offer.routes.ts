import { Router, Request, Response } from "express";
import {
  getActiveOffers,
  getAllOffers,
  getOfferById,
  getOfferWithServices,
  createOffer,
  updateOffer,
  deleteOffer,
  toggleOfferStatus,
  reorderOffers,
  getFeaturedDeals,
} from "../models/offer.model";

const router = Router();

// ============== PUBLIC ROUTES ==============

// GET /api/offers - Get all active offers (public)
router.get("/offers", async (req: Request, res: Response) => {
  try {
    const offers = await getActiveOffers();
    res.json({ offers });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({ error: "Failed to fetch offers" });
  }
});

// GET /api/featured-deals - Get services with discounts (public)
router.get("/featured-deals", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 6;
    const deals = await getFeaturedDeals(limit);
    res.json({ success: true, data: deals });
  } catch (error) {
    console.error("Error fetching featured deals:", error);
    res.status(500).json({ success: false, error: "Failed to fetch featured deals" });
  }
});

// GET /api/offers/:id - Get offer by ID (public)
router.get("/offers/:id", async (req: Request, res: Response) => {
  try {
    const offer = await getOfferById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }
    res.json({ offer });
  } catch (error) {
    console.error("Error fetching offer:", error);
    res.status(500).json({ error: "Failed to fetch offer" });
  }
});

// GET /api/offers/:id/details - Get offer with related services (public)
router.get("/offers/:id/details", async (req: Request, res: Response) => {
  try {
    const result = await getOfferWithServices(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Offer not found" });
    }
    res.json({ success: true, offer: result.offer, services: result.services });
  } catch (error) {
    console.error("Error fetching offer details:", error);
    res.status(500).json({ error: "Failed to fetch offer details" });
  }
});

// ============== ADMIN ROUTES ==============

// GET /api/admin/offers - Get all offers including inactive (admin)
router.get("/admin/offers", async (req: Request, res: Response) => {
  try {
    const offers = await getAllOffers();
    res.json({ offers });
  } catch (error) {
    console.error("Error fetching all offers:", error);
    res.status(500).json({ error: "Failed to fetch offers" });
  }
});

// POST /api/admin/offers - Create new offer (admin)
router.post("/admin/offers", async (req: Request, res: Response) => {
  try {
    const {
      title,
      subtitle,
      image_url,
      bg_color,
      text_color,
      link_to,
      is_active,
      display_order,
      start_date,
      end_date,
    } = req.body;

    if (!title || !subtitle || !image_url) {
      return res
        .status(400)
        .json({ error: "Title, subtitle, and image_url are required" });
    }

    const offer = await createOffer({
      title,
      subtitle,
      image_url,
      bg_color,
      text_color,
      link_to,
      is_active,
      display_order,
      start_date,
      end_date,
    });

    res.status(201).json({ offer });
  } catch (error) {
    console.error("Error creating offer:", error);
    res.status(500).json({ error: "Failed to create offer" });
  }
});

// PUT /api/admin/offers/:id - Update offer (admin)
router.put("/admin/offers/:id", async (req: Request, res: Response) => {
  try {
    const offer = await updateOffer(req.params.id, req.body);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }
    res.json({ offer });
  } catch (error) {
    console.error("Error updating offer:", error);
    res.status(500).json({ error: "Failed to update offer" });
  }
});

// DELETE /api/admin/offers/:id - Delete offer (admin)
router.delete("/admin/offers/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await deleteOffer(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Offer not found" });
    }
    res.json({ success: true, message: "Offer deleted successfully" });
  } catch (error) {
    console.error("Error deleting offer:", error);
    res.status(500).json({ error: "Failed to delete offer" });
  }
});

// POST /api/admin/offers/:id/toggle - Toggle offer active status (admin)
router.post("/admin/offers/:id/toggle", async (req: Request, res: Response) => {
  try {
    const offer = await toggleOfferStatus(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }
    res.json({ offer });
  } catch (error) {
    console.error("Error toggling offer status:", error);
    res.status(500).json({ error: "Failed to toggle offer status" });
  }
});

// POST /api/admin/offers/reorder - Reorder offers (admin)
router.post("/admin/offers/reorder", async (req: Request, res: Response) => {
  try {
    const { orderMap } = req.body;

    if (!Array.isArray(orderMap)) {
      return res
        .status(400)
        .json({ error: "orderMap must be an array of { id, order }" });
    }

    await reorderOffers(orderMap);
    res.json({ success: true, message: "Offers reordered successfully" });
  } catch (error) {
    console.error("Error reordering offers:", error);
    res.status(500).json({ error: "Failed to reorder offers" });
  }
});

export default router;
