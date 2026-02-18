import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware";
import {
  getAvailableSlots,
  getAvailableSlotsRange,
  isSlotAvailable,
  getAllSlotConfigs,
  createSlotConfig,
  updateSlotConfig,
  deleteSlotConfig,
  getAllBlackoutDates,
  createBlackoutDate,
  deleteBlackoutDate,
  getUpcomingBlackoutDates,
} from "../models/slot.model";

const router = Router();

/**
 * @route   GET /slots/available
 * @desc    Get available time slots for a specific date
 * @query   date (required) - ISO date string (YYYY-MM-DD)
 * @query   serviceId (optional) - Filter by service
 * @query   providerId (optional) - Filter by provider
 * @access  Public
 */
router.get("/slots/available", async (req, res) => {
  try {
    const { date, serviceId, providerId } = req.query;

    if (!date || typeof date !== "string") {
      return res.status(400).json({
        error: "Date is required in format YYYY-MM-DD",
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    // Don't allow dates in the past
    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
      return res.status(400).json({
        error: "Cannot fetch slots for past dates",
      });
    }

    const availability = await getAvailableSlots(
      date,
      serviceId as string | undefined,
      providerId as string | undefined,
    );

    res.json(availability);
  } catch (err) {
    console.error("Error fetching available slots:", err);
    res.status(500).json({ error: "Failed to fetch available slots" });
  }
});

/**
 * @route   GET /slots/available/range
 * @desc    Get available time slots for a date range
 * @query   startDate (required) - ISO date string
 * @query   endDate (required) - ISO date string
 * @query   serviceId (optional) - Filter by service
 * @query   providerId (optional) - Filter by provider
 * @access  Public
 */
router.get("/slots/available/range", async (req, res) => {
  try {
    const { startDate, endDate, serviceId, providerId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "startDate and endDate are required",
      });
    }

    // Limit range to 30 days to prevent abuse
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const diffDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays > 30) {
      return res.status(400).json({
        error: "Date range cannot exceed 30 days",
      });
    }

    const availability = await getAvailableSlotsRange(
      startDate as string,
      endDate as string,
      serviceId as string | undefined,
      providerId as string | undefined,
    );

    res.json({ dates: availability });
  } catch (err) {
    console.error("Error fetching slot range:", err);
    res.status(500).json({ error: "Failed to fetch available slots" });
  }
});

/**
 * @route   POST /slots/check
 * @desc    Check if a specific slot is available
 * @body    { date, time, serviceId?, providerId? }
 * @access  Public
 */
router.post("/slots/check", async (req, res) => {
  try {
    const { date, time, serviceId, providerId } = req.body;

    if (!date || !time) {
      return res.status(400).json({
        error: "date and time are required",
      });
    }

    const available = await isSlotAvailable(date, time, serviceId, providerId);

    res.json({
      date,
      time,
      is_available: available,
    });
  } catch (err) {
    console.error("Error checking slot availability:", err);
    res.status(500).json({ error: "Failed to check slot availability" });
  }
});

// ============== ADMIN ROUTES ==============

/**
 * @route   GET /slots/admin/configs
 * @desc    Get all slot configurations (admin only)
 * @access  Admin
 */
router.get(
  "/slots/admin/configs",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const configs = await getAllSlotConfigs();
      res.json({ configs });
    } catch (err) {
      console.error("Error fetching slot configs:", err);
      res.status(500).json({ error: "Failed to fetch slot configurations" });
    }
  },
);

/**
 * @route   POST /slots/admin/configs
 * @desc    Create a new slot configuration
 * @body    { service_id?, day_of_week?, start_time, end_time, slot_duration_minutes, max_bookings_per_slot }
 * @access  Admin
 */
router.post(
  "/slots/admin/configs",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const config = await createSlotConfig(req.body);
      res.status(201).json({ config });
    } catch (err: any) {
      console.error("Error creating slot config:", err);
      if (err.code === "23505") {
        return res
          .status(400)
          .json({
            error: "A configuration for this service/day already exists",
          });
      }
      res.status(500).json({ error: "Failed to create slot configuration" });
    }
  },
);

/**
 * @route   PUT /slots/admin/configs/:id
 * @desc    Update a slot configuration
 * @access  Admin
 */
router.put(
  "/slots/admin/configs/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const config = await updateSlotConfig(id, req.body);

      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }

      res.json({ config });
    } catch (err) {
      console.error("Error updating slot config:", err);
      res.status(500).json({ error: "Failed to update slot configuration" });
    }
  },
);

/**
 * @route   DELETE /slots/admin/configs/:id
 * @desc    Delete a slot configuration
 * @access  Admin
 */
router.delete(
  "/slots/admin/configs/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await deleteSlotConfig(id);

      if (!deleted) {
        return res.status(404).json({ error: "Configuration not found" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting slot config:", err);
      res.status(500).json({ error: "Failed to delete slot configuration" });
    }
  },
);

/**
 * @route   GET /slots/admin/blackouts
 * @desc    Get all blackout dates
 * @access  Admin
 */
router.get(
  "/slots/admin/blackouts",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const blackouts = await getAllBlackoutDates();
      res.json({ blackouts });
    } catch (err) {
      console.error("Error fetching blackout dates:", err);
      res.status(500).json({ error: "Failed to fetch blackout dates" });
    }
  },
);

/**
 * @route   GET /slots/blackouts/upcoming
 * @desc    Get upcoming blackout dates (public - for calendar display)
 * @access  Public
 */
router.get("/slots/blackouts/upcoming", async (req, res) => {
  try {
    const { serviceId } = req.query;
    const blackouts = await getUpcomingBlackoutDates(
      serviceId as string | undefined,
    );
    res.json({ blackouts });
  } catch (err) {
    console.error("Error fetching upcoming blackouts:", err);
    res.status(500).json({ error: "Failed to fetch blackout dates" });
  }
});

/**
 * @route   POST /slots/admin/blackouts
 * @desc    Create a blackout date
 * @body    { date, reason?, service_id? }
 * @access  Admin
 */
router.post(
  "/slots/admin/blackouts",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { date, reason, service_id } = req.body;

      if (!date) {
        return res.status(400).json({ error: "Date is required" });
      }

      const userId = (req as any).user?.uid;
      const blackout = await createBlackoutDate(
        date,
        reason,
        service_id,
        userId,
      );
      res.status(201).json({ blackout });
    } catch (err: any) {
      console.error("Error creating blackout date:", err);
      if (err.code === "23505") {
        return res
          .status(400)
          .json({ error: "This date is already blacked out" });
      }
      res.status(500).json({ error: "Failed to create blackout date" });
    }
  },
);

/**
 * @route   DELETE /slots/admin/blackouts/:id
 * @desc    Delete a blackout date
 * @access  Admin
 */
router.delete(
  "/slots/admin/blackouts/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await deleteBlackoutDate(id);

      if (!deleted) {
        return res.status(404).json({ error: "Blackout date not found" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting blackout date:", err);
      res.status(500).json({ error: "Failed to delete blackout date" });
    }
  },
);

export default router;
