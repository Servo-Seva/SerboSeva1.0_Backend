/**
 * Provider Notification Routes
 *
 * Handles FCM token registration, notification preferences,
 * and notification history for service providers.
 */

import express, { Request, Response } from "express";
import {
  registerFcmToken,
  removeFcmToken,
  toggleNotifications,
  getProviderNotifications,
  getUnreadNotificationCount,
  markNotificationsDelivered,
} from "../services/notification.service";

const router = express.Router();

/**
 * POST /provider/notifications/register-token
 * Register or update FCM token for push notifications
 *
 * Body: { provider_id: string, fcm_token: string }
 */
router.post("/register-token", async (req: Request, res: Response) => {
  try {
    const { provider_id, fcm_token } = req.body;

    if (!provider_id || !fcm_token) {
      return res.status(400).json({
        success: false,
        error: "provider_id and fcm_token are required",
      });
    }

    const success = await registerFcmToken(provider_id, fcm_token);

    if (success) {
      res.json({
        success: true,
        message: "FCM token registered successfully",
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Provider not found",
      });
    }
  } catch (error: any) {
    console.error("Error registering FCM token:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register FCM token",
    });
  }
});

/**
 * DELETE /provider/notifications/remove-token
 * Remove FCM token (on logout or uninstall)
 *
 * Body: { provider_id: string }
 */
router.delete("/remove-token", async (req: Request, res: Response) => {
  try {
    const { provider_id } = req.body;

    if (!provider_id) {
      return res.status(400).json({
        success: false,
        error: "provider_id is required",
      });
    }

    await removeFcmToken(provider_id);

    res.json({
      success: true,
      message: "FCM token removed successfully",
    });
  } catch (error: any) {
    console.error("Error removing FCM token:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove FCM token",
    });
  }
});

/**
 * PATCH /provider/notifications/toggle
 * Enable or disable notifications for a provider
 *
 * Body: { provider_id: string, enabled: boolean }
 */
router.patch("/toggle", async (req: Request, res: Response) => {
  try {
    const { provider_id, enabled } = req.body;

    if (!provider_id || typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "provider_id and enabled (boolean) are required",
      });
    }

    const success = await toggleNotifications(provider_id, enabled);

    if (success) {
      res.json({
        success: true,
        message: `Notifications ${enabled ? "enabled" : "disabled"} successfully`,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to update notification preferences",
      });
    }
  } catch (error: any) {
    console.error("Error toggling notifications:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update notification preferences",
    });
  }
});

/**
 * GET /provider/notifications/:providerId
 * Get notification history for a provider
 *
 * Query params: limit (default 50), offset (default 0)
 */
router.get("/:providerId", async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await getProviderNotifications(
      providerId,
      limit,
      offset,
    );
    const unreadCount = await getUnreadNotificationCount(providerId);

    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        limit,
        offset,
        hasMore: notifications.length === limit,
      },
    });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notifications",
    });
  }
});

/**
 * GET /provider/notifications/:providerId/unread-count
 * Get count of unread notifications
 */
router.get("/:providerId/unread-count", async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const count = await getUnreadNotificationCount(providerId);

    res.json({
      success: true,
      unreadCount: count,
    });
  } catch (error: any) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch unread count",
    });
  }
});

/**
 * POST /provider/notifications/mark-read
 * Mark notifications as delivered/read
 *
 * Body: { notification_ids: string[] }
 */
router.post("/mark-read", async (req: Request, res: Response) => {
  try {
    const { notification_ids } = req.body;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return res.status(400).json({
        success: false,
        error: "notification_ids array is required",
      });
    }

    const success = await markNotificationsDelivered(notification_ids);

    if (success) {
      res.json({
        success: true,
        message: "Notifications marked as read",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to mark notifications as read",
      });
    }
  } catch (error: any) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark notifications as read",
    });
  }
});

export default router;
