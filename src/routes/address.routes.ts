import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  createAddress,
  findAddressesByUser,
  findAddressById,
  updateAddress,
  deleteAddress,
  setPrimaryAddress,
} from "../models/address.model";

const router = Router();

// GET /me/addresses - list user's addresses
router.get("/me/addresses", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const addresses = await findAddressesByUser(userId);
    res.json({ addresses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch addresses" });
  }
});

// POST /me/addresses - add new address
router.post("/me/addresses", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const {
      country,
      state,
      full_name,
      mobile_number,
      flat_building,
      area_locality,
      line1,
      landmark,
      pincode,
      city,
      alt_phone,
      address_type,
    } = req.body as any;
    console.log(req.body);

    // Basic validation
    if (
      !country ||
      !state ||
      !full_name ||
      !mobile_number ||
      !flat_building ||
      !area_locality ||
      !pincode ||
      !city
    ) {
      return res
        .status(400)
        .json({ message: "Missing required address fields" });
    }

    const { is_primary } = req.body as any;

    if (is_primary !== undefined && typeof is_primary !== "boolean") {
      return res.status(400).json({ message: "is_primary must be a boolean" });
    }

    const address = await createAddress(userId, {
      country,
      state,
      full_name,
      mobile_number,
      flat_building,
      area_locality,
      line1: line1 || [flat_building, area_locality].filter(Boolean).join(", "),
      landmark,
      pincode,
      city,
      alt_phone,
      address_type: address_type || "home",
      is_primary,
    });

    res.status(201).json({ address });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create address" });
  }
});

// PATCH /me/addresses/:id - update address
router.patch("/me/addresses/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const addressId = req.params.id;

    const existing = await findAddressById(addressId);
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ message: "Address not found" });
    }

    const data = req.body as any;
    const updated = await updateAddress(addressId, data);
    res.json({ address: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update address" });
  }
});

// DELETE /me/addresses/:id - delete address
router.delete("/me/addresses/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const addressId = req.params.id;

    const existing = await findAddressById(addressId);
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ message: "Address not found" });
    }

    await deleteAddress(addressId);
    res.json({ message: "Address deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete address" });
  }
});

// POST /me/addresses/:id/primary - set address as primary
router.post("/me/addresses/:id/primary", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const addressId = req.params.id;

    const existing = await findAddressById(addressId);
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ message: "Address not found" });
    }

    const updated = await setPrimaryAddress(userId, addressId);
    res.json({ address: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to set primary address" });
  }
});

export default router;
