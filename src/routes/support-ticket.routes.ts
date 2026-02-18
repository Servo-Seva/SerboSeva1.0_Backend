import { Router, Request, Response } from "express";
import sql from "../db";
import { emitToAdmins, emitToProvider } from "../services/socket.service";
import { uploadToSupabase } from "../supabaseStorage";

const router = Router();

/**
 * Create a new support ticket (Provider)
 * POST /api/support-tickets
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      provider_id,
      provider_name,
      provider_phone,
      user_id,
      user_name,
      user_phone,
      user_email,
      category,
      description,
      attachment, // base64 image
      ticket_type, // 'provider' | 'customer'
    } = req.body;

    const type = ticket_type || (provider_id ? "provider" : "customer");

    if (type === "provider" && !provider_id) {
      return res.status(400).json({
        error: "provider_id is required for provider tickets",
      });
    }
    if (type === "customer" && !user_id) {
      return res.status(400).json({
        error: "user_id is required for customer tickets",
      });
    }
    if (!category || !description) {
      return res.status(400).json({
        error: "category and description are required",
      });
    }

    // Upload attachment if provided
    let attachmentUrl = null;
    if (attachment) {
      try {
        const folder =
          type === "customer"
            ? `support-tickets/user-${user_id}`
            : `support-tickets/${provider_id}`;
        attachmentUrl = await uploadToSupabase(
          attachment,
          folder,
          `ticket_${Date.now()}`,
        );
      } catch (uploadError) {
        console.error("Error uploading ticket attachment:", uploadError);
        // Continue without attachment
      }
    }

    // Generate temporary ticket number (will be updated by trigger)
    const tempTicketNumber = `TKT-${Date.now()}`;

    // Create the ticket
    const result = await sql`
      INSERT INTO support_tickets (
        ticket_number,
        provider_id,
        provider_name,
        provider_phone,
        user_id,
        user_name,
        user_phone,
        user_email,
        ticket_type,
        category,
        description,
        attachment_url,
        status,
        priority
      ) VALUES (
        ${tempTicketNumber},
        ${provider_id || null},
        ${provider_name || null},
        ${provider_phone || null},
        ${user_id || null},
        ${user_name || null},
        ${user_phone || null},
        ${user_email || null},
        ${type},
        ${category},
        ${description},
        ${attachmentUrl},
        'open',
        'normal'
      )
      RETURNING *
    `;

    const newTicket = result[0];

    // Update ticket number using the ID
    const ticketNumber = `TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(newTicket.id).padStart(4, "0")}`;
    await sql`
      UPDATE support_tickets 
      SET ticket_number = ${ticketNumber}
      WHERE id = ${newTicket.id}
    `;
    newTicket.ticket_number = ticketNumber;

    // Emit real-time event to admins
    const senderName =
      type === "customer"
        ? user_name || `Customer #${user_id}`
        : provider_name || `Provider #${provider_id}`;
    emitToAdmins("support:new-ticket", {
      ...newTicket,
      message: `New support ticket from ${senderName}`,
    });

    console.log(`✅ New support ticket created: ${ticketNumber}`);

    res.status(201).json({
      success: true,
      ticket: newTicket,
      message: "Support ticket submitted successfully",
    });
  } catch (error) {
    console.error("Error creating support ticket:", error);
    res.status(500).json({ error: "Failed to create support ticket" });
  }
});

/**
 * Get all tickets for a customer
 * GET /api/support-tickets/user/:userId
 */
router.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const tickets = await sql`
      SELECT * FROM support_tickets
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    res.json({ tickets });
  } catch (error) {
    console.error("Error fetching customer tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

/**
 * Get all tickets for a provider
 * GET /api/support-tickets/provider/:providerId
 */
router.get("/provider/:providerId", async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;

    const tickets = await sql`
      SELECT * FROM support_tickets
      WHERE provider_id = ${providerId}
      ORDER BY created_at DESC
    `;

    res.json({ tickets });
  } catch (error) {
    console.error("Error fetching provider tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

/**
 * Get all tickets (Admin)
 * GET /api/support-tickets
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let tickets;
    let totalCount;

    if (status && priority) {
      tickets = await sql`
        SELECT * FROM support_tickets
        WHERE status = ${status as string} AND priority = ${priority as string}
        ORDER BY 
          CASE priority 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            WHEN 'low' THEN 4 
          END,
          created_at DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
      totalCount = await sql`
        SELECT COUNT(*) as count FROM support_tickets
        WHERE status = ${status as string} AND priority = ${priority as string}
      `;
    } else if (status) {
      tickets = await sql`
        SELECT * FROM support_tickets
        WHERE status = ${status as string}
        ORDER BY 
          CASE priority 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            WHEN 'low' THEN 4 
          END,
          created_at DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
      totalCount = await sql`
        SELECT COUNT(*) as count FROM support_tickets
        WHERE status = ${status as string}
      `;
    } else if (priority) {
      tickets = await sql`
        SELECT * FROM support_tickets
        WHERE priority = ${priority as string}
        ORDER BY created_at DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
      totalCount = await sql`
        SELECT COUNT(*) as count FROM support_tickets
        WHERE priority = ${priority as string}
      `;
    } else {
      tickets = await sql`
        SELECT * FROM support_tickets
        ORDER BY 
          CASE status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,
          CASE priority 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            WHEN 'low' THEN 4 
          END,
          created_at DESC
        LIMIT ${Number(limit)} OFFSET ${offset}
      `;
      totalCount = await sql`
        SELECT COUNT(*) as count FROM support_tickets
      `;
    }

    // Get counts by status
    const statusCounts = await sql`
      SELECT status, COUNT(*) as count 
      FROM support_tickets 
      GROUP BY status
    `;

    res.json({
      tickets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(totalCount[0]?.count || 0),
        totalPages: Math.ceil(
          Number(totalCount[0]?.count || 0) / Number(limit),
        ),
      },
      statusCounts: statusCounts.reduce(
        (acc, row) => {
          acc[row.status] = Number(row.count);
          return acc;
        },
        {} as Record<string, number>,
      ),
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

/**
 * Update ticket status/priority (Admin)
 * PATCH /api/support-tickets/:ticketId
 */
router.patch("/:ticketId", async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const { status, priority, admin_notes, resolved_by } = req.body;

    const updates: any = { updated_at: new Date() };
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (admin_notes !== undefined) updates.admin_notes = admin_notes;
    if (resolved_by) updates.resolved_by = resolved_by;

    // If status is resolved or closed, set resolved_at
    if (status === "resolved" || status === "closed") {
      updates.resolved_at = new Date();
    }

    const result = await sql`
      UPDATE support_tickets
      SET 
        status = COALESCE(${status || null}, status),
        priority = COALESCE(${priority || null}, priority),
        admin_notes = COALESCE(${admin_notes || null}, admin_notes),
        resolved_by = COALESCE(${resolved_by || null}, resolved_by),
        resolved_at = ${updates.resolved_at || null},
        updated_at = NOW()
      WHERE id = ${ticketId}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const updatedTicket = result[0];

    // Notify provider about ticket update
    if (updatedTicket.provider_id) {
      emitToProvider(
        String(updatedTicket.provider_id),
        "support:ticket-updated",
        {
          ticket: updatedTicket,
          message: `Your support ticket #${updatedTicket.ticket_number} has been updated to: ${status || updatedTicket.status}`,
        },
      );
    }

    // Notify admins about the update
    emitToAdmins("support:ticket-updated", updatedTicket);

    res.json({
      success: true,
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("Error updating ticket:", error);
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

/**
 * Get single ticket by ID
 * GET /api/support-tickets/:ticketId
 */
router.get("/:ticketId", async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;

    const result = await sql`
      SELECT * FROM support_tickets
      WHERE id = ${ticketId}
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({ ticket: result[0] });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

/**
 * Delete ticket (Admin only)
 * DELETE /api/support-tickets/:ticketId
 */
router.delete("/:ticketId", async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;

    const result = await sql`
      DELETE FROM support_tickets
      WHERE id = ${ticketId}
      RETURNING id, ticket_number
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({
      success: true,
      message: `Ticket ${result[0].ticket_number} deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

export default router;
