/**
 * Push Notification Service using Firebase Cloud Messaging (FCM)
 *
 * This service handles all push notifications to service providers
 * including job assignments, updates, and cancellations.
 */

import admin from "../firebaseAdmin";
import sql from "../db";

// ============== TYPES ==============

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface JobNotificationData {
  bookingId: string;
  customerName: string;
  serviceName: string;
  serviceTime: string;
  serviceDate: string;
  address: string;
  price: string;
  status: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationRecord {
  id: string;
  provider_id: string;
  booking_id: string | null;
  type: string;
  title: string;
  body: string;
  data: Record<string, any> | null;
  status: string;
  sent_at: Date | null;
  delivered_at: Date | null;
  error_message: string | null;
  created_at: Date;
}

// ============== FCM TOKEN MANAGEMENT ==============

/**
 * Register or update a provider's FCM token
 */
export async function registerFcmToken(
  providerId: string,
  fcmToken: string,
): Promise<boolean> {
  try {
    const result = await sql`
      UPDATE providers 
      SET fcm_token = ${fcmToken}, updated_at = NOW()
      WHERE id = ${providerId}
      RETURNING id
    `;

    if (result.length === 0) {
      console.error(`Provider not found: ${providerId}`);
      return false;
    }

    console.log(`FCM token registered for provider ${providerId}`);
    return true;
  } catch (error) {
    console.error("Error registering FCM token:", error);
    return false;
  }
}

/**
 * Remove a provider's FCM token (logout or uninstall)
 */
export async function removeFcmToken(providerId: string): Promise<boolean> {
  try {
    await sql`
      UPDATE providers 
      SET fcm_token = NULL, updated_at = NOW()
      WHERE id = ${providerId}
    `;
    console.log(`FCM token removed for provider ${providerId}`);
    return true;
  } catch (error) {
    console.error("Error removing FCM token:", error);
    return false;
  }
}

/**
 * Get a provider's FCM token
 */
export async function getProviderFcmToken(
  providerId: string,
): Promise<string | null> {
  try {
    const result = await sql`
      SELECT fcm_token, notifications_enabled 
      FROM providers 
      WHERE id = ${providerId}
    `;

    if (result.length === 0 || !result[0].notifications_enabled) {
      return null;
    }

    return result[0].fcm_token || null;
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
}

/**
 * Toggle notifications enabled/disabled for a provider
 */
export async function toggleNotifications(
  providerId: string,
  enabled: boolean,
): Promise<boolean> {
  try {
    await sql`
      UPDATE providers 
      SET notifications_enabled = ${enabled}, updated_at = NOW()
      WHERE id = ${providerId}
    `;
    return true;
  } catch (error) {
    console.error("Error toggling notifications:", error);
    return false;
  }
}

// ============== NOTIFICATION SENDING ==============

/**
 * Send a push notification to a single provider
 */
export async function sendPushNotification(
  fcmToken: string,
  payload: NotificationPayload,
): Promise<NotificationResult> {
  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data || {},
      android: {
        priority: "high",
        notification: {
          channelId: "job_assignments",
          priority: "high",
          defaultSound: true,
          defaultVibrateTimings: true,
          clickAction: "OPEN_JOB_DETAILS",
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            sound: "default",
            badge: 1,
            category: "JOB_ASSIGNED",
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`Notification sent successfully: ${response}`);

    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    console.error("Error sending notification:", error);

    // Handle invalid token (uninstalled app, etc.)
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      return {
        success: false,
        error: "Invalid or expired FCM token",
      };
    }

    return {
      success: false,
      error: error.message || "Failed to send notification",
    };
  }
}

/**
 * Send notification to a provider and log it
 */
export async function sendProviderNotification(
  providerId: string,
  bookingId: string | null,
  type: string,
  payload: NotificationPayload,
): Promise<NotificationResult> {
  // Get the provider's FCM token
  const fcmToken = await getProviderFcmToken(providerId);

  // Create notification record
  const notificationRecord = await sql`
    INSERT INTO provider_notifications 
    (provider_id, booking_id, type, title, body, data, status)
    VALUES (
      ${providerId}, 
      ${bookingId}, 
      ${type}, 
      ${payload.title}, 
      ${payload.body}, 
      ${JSON.stringify(payload.data || {})},
      'pending'
    )
    RETURNING id
  `;

  const notificationId = notificationRecord[0].id;

  if (!fcmToken) {
    // No FCM token, can't send push but notification is recorded
    await sql`
      UPDATE provider_notifications 
      SET status = 'failed', error_message = 'No FCM token registered'
      WHERE id = ${notificationId}
    `;

    console.log(
      `No FCM token for provider ${providerId}, notification logged only`,
    );
    return {
      success: false,
      error: "No FCM token registered",
    };
  }

  // Send the notification
  const result = await sendPushNotification(fcmToken, payload);

  // Update notification record
  if (result.success) {
    await sql`
      UPDATE provider_notifications 
      SET status = 'sent', sent_at = NOW()
      WHERE id = ${notificationId}
    `;

    // Update provider's last notification timestamp
    await sql`
      UPDATE providers 
      SET last_notification_at = NOW()
      WHERE id = ${providerId}
    `;
  } else {
    await sql`
      UPDATE provider_notifications 
      SET status = 'failed', error_message = ${result.error || "Unknown error"}
      WHERE id = ${notificationId}
    `;

    // If token is invalid, remove it
    if (
      result.error?.includes("Invalid") ||
      result.error?.includes("expired")
    ) {
      await removeFcmToken(providerId);
    }
  }

  return result;
}

// ============== JOB NOTIFICATION HELPERS ==============

/**
 * Send a "New Job Assigned" notification to a provider
 */
export async function sendJobAssignedNotification(
  providerId: string,
  bookingId: string,
  jobData: JobNotificationData,
): Promise<NotificationResult> {
  const payload: NotificationPayload = {
    title: "🔔 New Job Assigned",
    body: `${jobData.serviceName} at ${jobData.serviceTime}\n📍 ${jobData.address}`,
    data: {
      type: "job_assigned",
      bookingId: jobData.bookingId,
      customerName: jobData.customerName,
      serviceName: jobData.serviceName,
      serviceTime: jobData.serviceTime,
      serviceDate: jobData.serviceDate,
      address: jobData.address,
      price: jobData.price,
      status: "assigned",
      click_action: "OPEN_BOOKING_DETAILS",
    },
  };

  console.log(
    `Sending job assigned notification to provider ${providerId} for booking ${bookingId}`,
  );

  return sendProviderNotification(
    providerId,
    bookingId,
    "job_assigned",
    payload,
  );
}

/**
 * Send a "Job Cancelled" notification to a provider
 */
export async function sendJobCancelledNotification(
  providerId: string,
  bookingId: string,
  jobData: Partial<JobNotificationData>,
): Promise<NotificationResult> {
  const payload: NotificationPayload = {
    title: "❌ Job Cancelled",
    body: `${jobData.serviceName || "Service"} scheduled for ${jobData.serviceDate} at ${jobData.serviceTime} has been cancelled.`,
    data: {
      type: "job_cancelled",
      bookingId: bookingId,
      serviceName: jobData.serviceName || "",
      serviceTime: jobData.serviceTime || "",
      serviceDate: jobData.serviceDate || "",
      click_action: "OPEN_BOOKINGS",
    },
  };

  return sendProviderNotification(
    providerId,
    bookingId,
    "job_cancelled",
    payload,
  );
}

/**
 * Send a "Job Updated" notification to a provider
 */
export async function sendJobUpdatedNotification(
  providerId: string,
  bookingId: string,
  jobData: Partial<JobNotificationData>,
  updateType: string = "updated",
): Promise<NotificationResult> {
  const payload: NotificationPayload = {
    title: "📝 Job Updated",
    body: `${jobData.serviceName || "Service"} has been ${updateType}. Tap to view details.`,
    data: {
      type: "job_updated",
      bookingId: bookingId,
      updateType: updateType,
      serviceName: jobData.serviceName || "",
      serviceTime: jobData.serviceTime || "",
      serviceDate: jobData.serviceDate || "",
      click_action: "OPEN_BOOKING_DETAILS",
    },
  };

  return sendProviderNotification(
    providerId,
    bookingId,
    "job_updated",
    payload,
  );
}

// ============== NOTIFICATION HISTORY ==============

/**
 * Get notification history for a provider
 */
export async function getProviderNotifications(
  providerId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<NotificationRecord[]> {
  const result = await sql`
    SELECT 
      pn.*,
      b.service as booking_service
    FROM provider_notifications pn
    LEFT JOIN bookings b ON b.id = pn.booking_id
    WHERE pn.provider_id = ${providerId}
    ORDER BY pn.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return result as unknown as NotificationRecord[];
}

/**
 * Get unread notification count for a provider
 */
export async function getUnreadNotificationCount(
  providerId: string,
): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count
    FROM provider_notifications
    WHERE provider_id = ${providerId}
    AND delivered_at IS NULL
    AND created_at > NOW() - INTERVAL '7 days'
  `;

  return parseInt(result[0].count, 10);
}

/**
 * Mark notifications as read/delivered
 */
export async function markNotificationsDelivered(
  notificationIds: string[],
): Promise<boolean> {
  try {
    await sql`
      UPDATE provider_notifications 
      SET delivered_at = NOW()
      WHERE id = ANY(${notificationIds}::uuid[])
    `;
    return true;
  } catch (error) {
    console.error("Error marking notifications delivered:", error);
    return false;
  }
}

export default {
  registerFcmToken,
  removeFcmToken,
  getProviderFcmToken,
  toggleNotifications,
  sendPushNotification,
  sendProviderNotification,
  sendJobAssignedNotification,
  sendJobCancelledNotification,
  sendJobUpdatedNotification,
  getProviderNotifications,
  getUnreadNotificationCount,
  markNotificationsDelivered,
};
