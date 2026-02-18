/**
 * Socket.io Service for Real-time Updates
 *
 * Provides real-time communication for:
 * - Provider dashboard updates (new bookings, status changes)
 * - Admin dashboard updates
 * - Booking status updates to users
 */

import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import sql from "../db";

let io: SocketServer | null = null;

// Track connected providers by their ID
const connectedProviders: Map<string, Set<string>> = new Map();
// Track connected admins
const connectedAdmins: Set<string> = new Set();
// Track connected users (customers) by their user ID
const connectedUsers: Map<string, Set<string>> = new Map();

/**
 * Initialize Socket.io server
 */
export function initSocketServer(
  httpServer: HttpServer,
  corsOrigins: string[],
): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Handle provider authentication/join
    socket.on("provider:join", async (providerId: string) => {
      if (!providerId) return;

      console.log(`👤 Provider ${providerId} joined`);

      // Add socket to provider's room
      socket.join(`provider:${providerId}`);

      // Track connected provider
      if (!connectedProviders.has(providerId)) {
        connectedProviders.set(providerId, new Set());
      }
      connectedProviders.get(providerId)?.add(socket.id);

      // Send initial data to provider
      try {
        const bookings = await getProviderAssignedBookings(providerId);
        socket.emit("provider:bookings", bookings);
      } catch (error) {
        console.error("Error fetching provider bookings:", error);
      }
    });

    // Handle admin join
    socket.on("admin:join", () => {
      console.log(`🛡️ Admin joined: ${socket.id}`);
      socket.join("admin");
      connectedAdmins.add(socket.id);
    });

    // Handle user (customer) join - for real-time booking updates
    socket.on("user:join", (userId: string) => {
      if (!userId) return;

      console.log(`👤 User ${userId} joined for real-time updates`);

      // Add socket to user's room
      socket.join(`user:${userId}`);

      // Track connected user
      if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set());
      }
      connectedUsers.get(userId)?.add(socket.id);
    });

    // Handle user joining a specific booking room for live updates
    socket.on("booking:subscribe", (bookingId: string) => {
      if (!bookingId) return;
      console.log(`📖 Socket ${socket.id} subscribed to booking ${bookingId}`);
      socket.join(`booking:${bookingId}`);
    });

    // Handle user unsubscribing from booking updates
    socket.on("booking:unsubscribe", (bookingId: string) => {
      if (!bookingId) return;
      console.log(
        `📖 Socket ${socket.id} unsubscribed from booking ${bookingId}`,
      );
      socket.leave(`booking:${bookingId}`);
    });

    // Handle user leaving
    socket.on("user:leave", (userId: string) => {
      if (userId) {
        socket.leave(`user:${userId}`);
        connectedUsers.get(userId)?.delete(socket.id);
        if (connectedUsers.get(userId)?.size === 0) {
          connectedUsers.delete(userId);
        }
      }
    });

    // Handle provider leaving
    socket.on("provider:leave", (providerId: string) => {
      if (providerId) {
        socket.leave(`provider:${providerId}`);
        connectedProviders.get(providerId)?.delete(socket.id);
        if (connectedProviders.get(providerId)?.size === 0) {
          connectedProviders.delete(providerId);
        }
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);

      // Remove from admin list
      connectedAdmins.delete(socket.id);

      // Remove from provider tracking
      for (const [providerId, sockets] of connectedProviders) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            connectedProviders.delete(providerId);
          }
        }
      }

      // Remove from user tracking
      for (const [userId, sockets] of connectedUsers) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            connectedUsers.delete(userId);
          }
        }
      }
    });

    // Handle provider booking status update request
    socket.on(
      "provider:update-booking-status",
      async (data: {
        bookingId: string;
        providerId: string;
        status: string;
      }) => {
        try {
          // Update booking status in database
          const result = await sql`
          UPDATE bookings 
          SET status = ${data.status}, updated_at = NOW()
          WHERE id = ${data.bookingId} AND provider_id = ${data.providerId}
          RETURNING *
        `;

          if (result.length > 0) {
            // Notify provider
            emitToProvider(data.providerId, "booking:updated", result[0]);

            // Notify admins
            emitToAdmins("booking:updated", result[0]);

            console.log(
              `✅ Booking ${data.bookingId} updated to ${data.status}`,
            );
          }
        } catch (error) {
          console.error("Error updating booking status:", error);
          socket.emit("error", { message: "Failed to update booking status" });
        }
      },
    );

    // Handle provider requesting their bookings refresh
    socket.on("provider:refresh-bookings", async (providerId: string) => {
      try {
        const bookings = await getProviderAssignedBookings(providerId);
        socket.emit("provider:bookings", bookings);
      } catch (error) {
        console.error("Error refreshing provider bookings:", error);
      }
    });
  });

  console.log("🔌 Socket.io server initialized");
  return io;
}

/**
 * Get Socket.io instance
 */
export function getIO(): SocketServer | null {
  return io;
}

/**
 * Emit event to a specific provider
 */
export function emitToProvider(
  providerId: string,
  event: string,
  data: any,
): void {
  if (io) {
    io.to(`provider:${providerId}`).emit(event, data);
    console.log(`📤 Emitted ${event} to provider ${providerId}`);
  }
}

/**
 * Emit event to all admins
 */
export function emitToAdmins(event: string, data: any): void {
  if (io) {
    io.to("admin").emit(event, data);
    console.log(`📤 Emitted ${event} to all admins`);
  }
}

/**
 * Emit event to a specific user (customer)
 */
export function emitToUser(userId: string, event: string, data: any): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
    console.log(`📤 Emitted ${event} to user ${userId}`);
  }
}

/**
 * Emit event to all subscribers of a specific booking
 */
export function emitToBooking(
  bookingId: string,
  event: string,
  data: any,
): void {
  if (io) {
    io.to(`booking:${bookingId}`).emit(event, data);
    console.log(`📤 Emitted ${event} to booking ${bookingId} subscribers`);
  }
}

/**
 * Notify user of booking status change
 */
export function notifyUserBookingUpdate(
  userId: string,
  bookingId: string,
  booking: any,
): void {
  const data = {
    bookingId,
    booking,
    timestamp: new Date().toISOString(),
  };

  // Emit to user's room
  emitToUser(userId, "booking:status-updated", data);

  // Also emit to booking room (for anyone viewing that booking)
  emitToBooking(bookingId, "booking:status-updated", data);
}

/**
 * Emit event to all connected clients
 */
export function emitToAll(event: string, data: any): void {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Check if a provider is currently connected
 */
export function isProviderConnected(providerId: string): boolean {
  return (
    connectedProviders.has(providerId) &&
    (connectedProviders.get(providerId)?.size || 0) > 0
  );
}

/**
 * Get count of connected providers
 */
export function getConnectedProviderCount(): number {
  return connectedProviders.size;
}

/**
 * Notify provider of new job assignment (called from admin routes)
 */
export function notifyProviderNewJob(providerId: string, booking: any): void {
  emitToProvider(providerId, "job:assigned", {
    booking,
    message: "New job assigned to you!",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Notify provider of job cancellation
 */
export function notifyProviderJobCancelled(
  providerId: string,
  bookingId: string,
  reason?: string,
): void {
  emitToProvider(providerId, "job:cancelled", {
    bookingId,
    reason: reason || "Job was cancelled by customer or admin",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Notify provider of job update
 */
export function notifyProviderJobUpdate(
  providerId: string,
  booking: any,
  updateType: string,
): void {
  emitToProvider(providerId, "job:updated", {
    booking,
    updateType,
    timestamp: new Date().toISOString(),
  });
}

// ============== HELPER FUNCTIONS ==============

/**
 * Get all assigned bookings for a provider
 */
async function getProviderAssignedBookings(providerId: string): Promise<any[]> {
  const result = await sql`
    SELECT 
      b.id,
      b.user_id,
      b.service,
      b.delivery_address,
      b.booking_date,
      b.time_slot,
      b.status,
      b.total_amount,
      b.assigned_at,
      b.created_at,
      b.updated_at,
      u.name as customer_name,
      u.phone as customer_phone
    FROM bookings b
    LEFT JOIN users u ON u.id::text = b.user_id
    WHERE b.provider_id = ${providerId}::uuid
    AND b.status IN ('assigned', 'confirmed', 'in_progress')
    ORDER BY b.booking_date ASC, b.time_slot ASC
  `;

  return result.map((booking: any) => ({
    ...booking,
    service:
      typeof booking.service === "string"
        ? JSON.parse(booking.service)
        : booking.service,
    delivery_address:
      typeof booking.delivery_address === "string"
        ? JSON.parse(booking.delivery_address)
        : booking.delivery_address,
  }));
}

export default {
  initSocketServer,
  getIO,
  emitToProvider,
  emitToAdmins,
  emitToUser,
  emitToBooking,
  emitToAll,
  isProviderConnected,
  getConnectedProviderCount,
  notifyProviderNewJob,
  notifyProviderJobCancelled,
  notifyProviderJobUpdate,
  notifyUserBookingUpdate,
};
