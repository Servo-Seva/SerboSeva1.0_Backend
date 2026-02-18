import { Request, Response, NextFunction } from "express";
import sql from "../db";
import crypto from "crypto";

export interface BookingService {
  service_id: string;
  service_name: string;
  quantity: number;
  price: number;
  category?: string;
  image_url?: string;
}

export interface DeliveryAddress {
  full_name?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  phone?: string;
}

export interface SlotInfo {
  date: string; // ISO date string
  time: string; // e.g., "09:00-11:00"
  formatted_date?: string;
}

export interface Booking {
  id: string;
  batch_id?: string;
  user_id: string;
  service: BookingService;
  total_amount: number;
  currency: string;
  address_id?: string;
  delivery_address: DeliveryAddress;
  booking_date: string;
  time_slot: string;
  status:
    | "pending"
    | "confirmed"
    | "assigned"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "provider_cancelled";
  provider_id?: string;
  assigned_at?: Date;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  payment_method?: string;
  payment_id?: string;
  promo_code?: string;
  discount_amount: number;
  tip_amount: number;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  customer_notes?: string;
  cancellation_reason?: string;
}

// Parse booking row from database
function parseBooking(row: any): Booking {
  return {
    ...row,
    service:
      typeof row.service === "string" ? JSON.parse(row.service) : row.service,
    delivery_address:
      typeof row.delivery_address === "string"
        ? JSON.parse(row.delivery_address)
        : row.delivery_address,
    // Ensure numeric fields are parsed as numbers (PostgreSQL returns decimals as strings)
    total_amount: parseFloat(row.total_amount) || 0,
    discount_amount: parseFloat(row.discount_amount) || 0,
    tip_amount: parseFloat(row.tip_amount) || 0,
    tax_amount: parseFloat(row.tax_amount) || 0,
    subtotal: parseFloat(row.subtotal) || 0,
    refund_amount: parseFloat(row.refund_amount) || 0,
  };
}

/**
 * Create multiple bookings (one per service with its own slot)
 * POST /api/bookings/batch
 *
 * This is the main endpoint for checkout - creates one booking per service
 */
export const createBatchBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      items, // Array of { service, slot }
      delivery_address,
      address_id,
      payment_method,
      promo_code,
      discount_amount = 0,
      tip_amount = 0,
      customer_notes,
      currency = "INR",
    } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Missing required field: items (array of services with slots)",
      });
    }

    if (!delivery_address) {
      return res.status(400).json({
        error: "Missing required field: delivery_address",
      });
    }

    // Validate delivery address structure
    if (
      !delivery_address.line1 ||
      !delivery_address.city ||
      !delivery_address.state ||
      !delivery_address.pincode
    ) {
      return res.status(400).json({
        error: "Delivery address must include line1, city, state, and pincode",
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.service || !item.slot) {
        return res.status(400).json({
          error: "Each item must have service and slot objects",
        });
      }
      if (
        !item.service.service_id ||
        !item.service.service_name ||
        !item.service.quantity ||
        !item.service.price
      ) {
        return res.status(400).json({
          error:
            "Each service must have service_id, service_name, quantity, and price",
        });
      }
      if (!item.slot.date || !item.slot.time) {
        return res.status(400).json({
          error: "Each slot must have date and time",
        });
      }
    }

    // Generate batch ID to group all bookings from this checkout
    const batchId = crypto.randomUUID();

    // Calculate discount per item (distribute evenly)
    const discountPerItem =
      items.length > 0 ? discount_amount / items.length : 0;
    const tipPerItem = items.length > 0 ? tip_amount / items.length : 0;

    // Use transaction to create all bookings
    const createdBookings = await sql.begin(async (tx) => {
      const bookings: any[] = [];

      for (const item of items) {
        const { service, slot } = item;
        const itemTotal = Math.max(
          0,
          service.price * service.quantity - discountPerItem,
        );

        const [booking] = await tx`
          INSERT INTO bookings (
            batch_id,
            user_id,
            service,
            total_amount,
            currency,
            address_id,
            delivery_address,
            booking_date,
            time_slot,
            payment_method,
            promo_code,
            discount_amount,
            tip_amount,
            customer_notes,
            status,
            payment_status
          ) VALUES (
            ${batchId},
            ${userId},
            ${JSON.stringify(service)},
            ${itemTotal},
            ${currency},
            ${address_id || null},
            ${JSON.stringify(delivery_address)},
            ${slot.date},
            ${slot.time},
            ${payment_method || null},
            ${promo_code || null},
            ${discountPerItem},
            ${tipPerItem},
            ${customer_notes || null},
            'pending',
            'pending'
          )
          RETURNING *
        `;

        bookings.push(booking);
      }

      return bookings;
    });

    const bookings = createdBookings.map(parseBooking);

    res.status(201).json({
      success: true,
      batch_id: batchId,
      bookings_count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Error creating batch bookings:", error);
    next(error);
  }
};

/**
 * Create a single booking
 * POST /api/bookings
 */
export const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      service,
      total_amount,
      currency = "INR",
      address_id,
      delivery_address,
      booking_date,
      time_slot,
      payment_method,
      promo_code,
      discount_amount = 0,
      tip_amount = 0,
      customer_notes,
    } = req.body;

    // Validate required fields
    if (
      !service ||
      !total_amount ||
      !delivery_address ||
      !booking_date ||
      !time_slot
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: service, total_amount, delivery_address, booking_date, time_slot",
      });
    }

    // Validate service structure
    if (
      !service.service_id ||
      !service.service_name ||
      !service.quantity ||
      !service.price
    ) {
      return res.status(400).json({
        error:
          "Service must have service_id, service_name, quantity, and price",
      });
    }

    // Validate delivery address structure
    if (
      !delivery_address.line1 ||
      !delivery_address.city ||
      !delivery_address.state ||
      !delivery_address.pincode
    ) {
      return res.status(400).json({
        error: "Delivery address must include line1, city, state, and pincode",
      });
    }

    const [booking] = await sql`
      INSERT INTO bookings (
        user_id,
        service,
        total_amount,
        currency,
        address_id,
        delivery_address,
        booking_date,
        time_slot,
        payment_method,
        promo_code,
        discount_amount,
        tip_amount,
        customer_notes,
        status,
        payment_status
      ) VALUES (
        ${userId},
        ${JSON.stringify(service)},
        ${total_amount},
        ${currency},
        ${address_id || null},
        ${JSON.stringify(delivery_address)},
        ${booking_date},
        ${time_slot},
        ${payment_method || null},
        ${promo_code || null},
        ${discount_amount},
        ${tip_amount},
        ${customer_notes || null},
        'pending',
        'pending'
      )
      RETURNING *
    `;

    res.status(201).json({
      success: true,
      booking: parseBooking(booking),
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    next(error);
  }
};

/**
 * Get all bookings for the authenticated user
 * GET /api/bookings
 */
export const getUserBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { status, batch_id, limit = 50, offset = 0 } = req.query;

    // Build base query with LEFT JOIN to get review info and provider info
    let result;

    if (status && batch_id) {
      result = await sql`
        SELECT b.*, 
               r.id as review_id, 
               r.rating as review_rating, 
               r.review_text as review_text,
               p.name as provider_name,
               p.phone as provider_phone,
               p.email as provider_email,
               COALESCE(
                 (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
                 p.avatar_url
               ) as provider_photo
        FROM bookings b
        LEFT JOIN service_reviews r ON r.booking_id = b.id::text AND r.user_id = b.user_id::uuid
        LEFT JOIN providers p ON b.provider_id = p.id
        WHERE b.user_id = ${userId}
          AND b.status = ${status as string}
          AND b.batch_id = ${batch_id as string}
        ORDER BY b.created_at DESC
        LIMIT ${Number(limit)}
        OFFSET ${Number(offset)}
      `;
    } else if (status) {
      result = await sql`
        SELECT b.*, 
               r.id as review_id, 
               r.rating as review_rating, 
               r.review_text as review_text,
               p.name as provider_name,
               p.phone as provider_phone,
               p.email as provider_email,
               COALESCE(
                 (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
                 p.avatar_url
               ) as provider_photo
        FROM bookings b
        LEFT JOIN service_reviews r ON r.booking_id = b.id::text AND r.user_id = b.user_id::uuid
        LEFT JOIN providers p ON b.provider_id = p.id
        WHERE b.user_id = ${userId}
          AND b.status = ${status as string}
        ORDER BY b.created_at DESC
        LIMIT ${Number(limit)}
        OFFSET ${Number(offset)}
      `;
    } else if (batch_id) {
      result = await sql`
        SELECT b.*, 
               r.id as review_id, 
               r.rating as review_rating, 
               r.review_text as review_text,
               p.name as provider_name,
               p.phone as provider_phone,
               p.email as provider_email,
               COALESCE(
                 (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
                 p.avatar_url
               ) as provider_photo
        FROM bookings b
        LEFT JOIN service_reviews r ON r.booking_id = b.id::text AND r.user_id = b.user_id::uuid
        LEFT JOIN providers p ON b.provider_id = p.id
        WHERE b.user_id = ${userId}
          AND b.batch_id = ${batch_id as string}
        ORDER BY b.created_at DESC
        LIMIT ${Number(limit)}
        OFFSET ${Number(offset)}
      `;
    } else {
      result = await sql`
        SELECT b.*, 
               r.id as review_id, 
               r.rating as review_rating, 
               r.review_text as review_text,
               p.name as provider_name,
               p.phone as provider_phone,
               p.email as provider_email,
               COALESCE(
                 (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
                 p.avatar_url
               ) as provider_photo
        FROM bookings b
        LEFT JOIN service_reviews r ON r.booking_id = b.id::text AND r.user_id = b.user_id::uuid
        LEFT JOIN providers p ON b.provider_id = p.id
        WHERE b.user_id = ${userId}
        ORDER BY b.created_at DESC
        LIMIT ${Number(limit)}
        OFFSET ${Number(offset)}
      `;
    }

    const bookings = result.map((row: any) => {
      const booking = parseBooking(row);
      // Add review info to booking
      const bookingWithReview: any = {
        ...booking,
        review: row.review_id
          ? {
              id: row.review_id,
              rating: row.review_rating,
              review_text: row.review_text,
            }
          : null,
      };

      // Add provider info if assigned
      if (row.provider_id) {
        bookingWithReview.provider = {
          id: row.provider_id,
          name: row.provider_name,
          phone: row.provider_phone,
          email: row.provider_email,
          photo_url: row.provider_photo,
        };
      }

      return bookingWithReview;
    });

    res.json({ success: true, bookings });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    next(error);
  }
};

/**
 * Get bookings grouped by batch
 * GET /api/bookings/batches
 */
export const getUserBookingBatches = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { limit = 20, offset = 0 } = req.query;

    const result = await sql`
      SELECT 
        batch_id,
        json_agg(
          json_build_object(
            'id', id,
            'service', service,
            'total_amount', total_amount,
            'booking_date', booking_date,
            'time_slot', time_slot,
            'status', status,
            'payment_status', payment_status
          ) ORDER BY booking_date, time_slot
        ) as bookings,
        MIN(created_at) as created_at,
        SUM(total_amount) as batch_total,
        COUNT(*) as services_count
      FROM bookings
      WHERE user_id = ${userId} AND batch_id IS NOT NULL
      GROUP BY batch_id
      ORDER BY MIN(created_at) DESC
      LIMIT ${Number(limit)}
      OFFSET ${Number(offset)}
    `;

    const batches = result.map((batch: any) => ({
      ...batch,
      bookings: batch.bookings.map((b: any) => ({
        ...b,
        service:
          typeof b.service === "string" ? JSON.parse(b.service) : b.service,
      })),
    }));

    res.json({ success: true, batches });
  } catch (error) {
    console.error("Error fetching booking batches:", error);
    next(error);
  }
};

/**
 * Get a specific booking by ID
 * GET /api/bookings/:id
 */
export const getBookingById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const result = await sql`
      SELECT * FROM bookings
      WHERE id = ${id} AND user_id = ${userId}
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({
      success: true,
      booking: parseBooking(result[0]),
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    next(error);
  }
};

/**
 * Update booking status
 * PATCH /api/bookings/:id/status
 */
export const updateBookingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { status, cancellation_reason } = req.body;

    const validStatuses = [
      "pending",
      "confirmed",
      "assigned",
      "in_progress",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Check if booking exists and belongs to user
    const checkResult = await sql`
      SELECT * FROM bookings WHERE id = ${id} AND user_id = ${userId}
    `;

    if (checkResult.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    let result;

    if (status === "cancelled") {
      result = await sql`
        UPDATE bookings
        SET status = ${status}, 
            cancelled_at = NOW(), 
            cancellation_reason = ${cancellation_reason || "Cancelled by user"},
            updated_at = NOW()
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;
    } else if (status === "completed") {
      result = await sql`
        UPDATE bookings
        SET status = ${status}, 
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;
    } else {
      result = await sql`
        UPDATE bookings
        SET status = ${status}, 
            updated_at = NOW()
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;
    }

    res.json({
      success: true,
      booking: parseBooking(result[0]),
    });
  } catch (error) {
    console.error("Error updating booking status:", error);
    next(error);
  }
};

/**
 * Update payment status for all bookings in a batch
 * PATCH /api/bookings/batch/:batchId/payment
 */
export const updateBatchPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { batchId } = req.params;
    const { payment_status, payment_id, payment_method } = req.body;

    const validPaymentStatuses = ["pending", "paid", "failed", "refunded"];
    if (!validPaymentStatuses.includes(payment_status)) {
      return res.status(400).json({ error: "Invalid payment status" });
    }

    const result = await sql`
      UPDATE bookings
      SET payment_status = ${payment_status}, 
          payment_id = ${payment_id || null}, 
          payment_method = ${payment_method || null}, 
          updated_at = NOW()
      WHERE batch_id = ${batchId} AND user_id = ${userId}
      RETURNING *
    `;

    if (result.length === 0) {
      return res
        .status(404)
        .json({ error: "No bookings found for this batch" });
    }

    const bookings = result.map(parseBooking);

    res.json({
      success: true,
      updated_count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Error updating batch payment status:", error);
    next(error);
  }
};

/**
 * Update payment status for single booking
 * PATCH /api/bookings/:id/payment
 */
export const updatePaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { payment_status, payment_id, payment_method } = req.body;

    const validPaymentStatuses = ["pending", "paid", "failed", "refunded"];
    if (!validPaymentStatuses.includes(payment_status)) {
      return res.status(400).json({ error: "Invalid payment status" });
    }

    const result = await sql`
      UPDATE bookings
      SET payment_status = ${payment_status}, 
          payment_id = ${payment_id || null}, 
          payment_method = ${payment_method || null}, 
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({
      success: true,
      booking: parseBooking(result[0]),
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    next(error);
  }
};

/**
 * Cancel a single booking
 * DELETE /api/bookings/:id
 */
export const cancelBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const result = await sql`
      UPDATE bookings
      SET status = 'cancelled', 
          cancelled_at = NOW(), 
          cancellation_reason = ${cancellation_reason || "Cancelled by user"}, 
          updated_at = NOW()
      WHERE id = ${id} 
        AND user_id = ${userId} 
        AND status NOT IN ('completed', 'cancelled')
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({
        error:
          "Booking not found or cannot be cancelled (already completed or cancelled)",
      });
    }

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking: parseBooking(result[0]),
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    next(error);
  }
};

/**
 * Cancel all bookings in a batch
 * DELETE /api/bookings/batch/:batchId
 */
export const cancelBatchBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { batchId } = req.params;
    const { cancellation_reason } = req.body;

    const result = await sql`
      UPDATE bookings
      SET status = 'cancelled', 
          cancelled_at = NOW(), 
          cancellation_reason = ${cancellation_reason || "Cancelled by user"}, 
          updated_at = NOW()
      WHERE batch_id = ${batchId} 
        AND user_id = ${userId} 
        AND status NOT IN ('completed', 'cancelled')
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({
        error: "No cancellable bookings found for this batch",
      });
    }

    const bookings = result.map(parseBooking);

    res.json({
      success: true,
      message: `${bookings.length} booking(s) cancelled successfully`,
      cancelled_count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Error cancelling batch bookings:", error);
    next(error);
  }
};

/**
 * Reschedule a booking
 * PATCH /api/bookings/:id/reschedule
 */
export const updateBookingAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { delivery_address } = req.body;

    if (
      !delivery_address ||
      !delivery_address.line1 ||
      !delivery_address.city ||
      !delivery_address.state ||
      !delivery_address.pincode
    ) {
      return res.status(400).json({
        error: "Missing required address fields: line1, city, state, pincode",
      });
    }

    // Check if booking exists and can be updated (only pending/confirmed)
    const checkResult = await sql`
      SELECT * FROM bookings 
      WHERE id = ${id} AND user_id = ${userId} AND status IN ('pending', 'confirmed')
    `;

    if (checkResult.length === 0) {
      return res.status(404).json({
        error:
          "Booking not found or address cannot be changed (only pending/confirmed bookings)",
      });
    }

    const result = await sql`
      UPDATE bookings
      SET delivery_address = ${JSON.stringify(delivery_address)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    res.json({
      success: true,
      message: "Booking address updated successfully",
      booking: parseBooking(result[0]),
    });
  } catch (error) {
    console.error("Error updating booking address:", error);
    next(error);
  }
};

export const rescheduleBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { booking_date, time_slot } = req.body;

    if (!booking_date || !time_slot) {
      return res.status(400).json({
        error: "Missing required fields: booking_date, time_slot",
      });
    }

    // Check if booking exists and can be rescheduled
    const checkResult = await sql`
      SELECT * FROM bookings 
      WHERE id = ${id} AND user_id = ${userId} AND status IN ('pending', 'confirmed')
    `;

    if (checkResult.length === 0) {
      return res.status(404).json({
        error:
          "Booking not found or cannot be rescheduled (only pending/confirmed bookings can be rescheduled)",
      });
    }

    const result = await sql`
      UPDATE bookings
      SET booking_date = ${booking_date}, 
          time_slot = ${time_slot}, 
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    res.json({
      success: true,
      message: "Booking rescheduled successfully",
      booking: parseBooking(result[0]),
    });
  } catch (error) {
    console.error("Error rescheduling booking:", error);
    next(error);
  }
};
