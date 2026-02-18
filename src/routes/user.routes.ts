import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { findUserById } from "../models/user.model";
import { updateUser } from "../models/user.model";

const router = Router();

/**
 * GET /me
 * Returns logged-in user
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const user = await findUserById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

/**
 * PATCH /me
 * Update profile fields: name, email, phone, gender
 */
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { name, email, phone, gender } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      gender?: string;
    };

    // Basic validation
    const updates: any = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Invalid name" });
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (
        typeof email !== "string" ||
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
      ) {
        return res.status(400).json({ message: "Invalid email" });
      }
      updates.email = email.toLowerCase().trim();
    }

    if (phone !== undefined) {
      if (typeof phone !== "string" || phone.trim().length < 10) {
        return res.status(400).json({ message: "Invalid phone number" });
      }
      updates.phone = phone.trim();
    }

    if (gender !== undefined) {
      const allowed = ["Male", "Female", "Other"];
      if (typeof gender !== "string" || !allowed.includes(gender)) {
        return res.status(400).json({ message: "Invalid gender" });
      }
      updates.gender = gender;
    }

    const updated = await updateUser(userId, updates);
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update user" });
  }
});

export default router;
