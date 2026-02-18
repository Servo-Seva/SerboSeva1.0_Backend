import sql from "../db";

// ============== TYPES ==============

export interface TimeSlot {
  id: string;
  time: string; // e.g., "09:00 AM"
  time_24h: string; // e.g., "09:00"
  is_available: boolean;
  booked_count?: number;
  max_capacity?: number;
}

export interface SlotAvailability {
  date: string;
  slots: TimeSlot[];
  config?: SlotConfigResponse;
}

export interface SlotConfig {
  id: string;
  service_id?: string | null; // null means global default
  day_of_week?: number | null; // 0-6, null means all days
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  gap_between_slots_minutes?: number;
  max_bookings_per_slot: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SlotConfigResponse extends SlotConfig {
  service_name?: string;
}

export interface BlackoutDate {
  id: string;
  blackout_date: string;
  service_id?: string | null;
  reason?: string;
  created_at?: string;
  created_by?: string;
  service_name?: string;
}

// Default time slots (fallback if no config in DB)
const DEFAULT_TIME_SLOTS = [
  { time: "09:00 AM", time_24h: "09:00" },
  { time: "10:00 AM", time_24h: "10:00" },
  { time: "11:00 AM", time_24h: "11:00" },
  { time: "12:00 PM", time_24h: "12:00" },
  { time: "02:00 PM", time_24h: "14:00" },
  { time: "03:00 PM", time_24h: "15:00" },
  { time: "04:00 PM", time_24h: "16:00" },
  { time: "05:00 PM", time_24h: "17:00" },
  { time: "06:00 PM", time_24h: "18:00" },
];

// Max bookings per slot (can be overridden per service)
const DEFAULT_MAX_BOOKINGS_PER_SLOT = 5;

// ============== HELPER FUNCTIONS ==============

/**
 * Convert 24h time string to 12h AM/PM format
 */
function formatTime12h(time24h: string): string {
  const [hours, minutes] = time24h.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Generate time slots based on configuration
 */
function generateTimeSlotsFromConfig(
  config: SlotConfig,
): Array<{ time: string; time_24h: string }> {
  const slots: Array<{ time: string; time_24h: string }> = [];

  const [startHour, startMin] = config.start_time.split(":").map(Number);
  const [endHour, endMin] = config.end_time.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const duration = config.slot_duration_minutes;
  const gap = config.gap_between_slots_minutes || 0;

  for (
    let mins = startMinutes;
    mins + duration <= endMinutes;
    mins += duration + gap
  ) {
    const hour = Math.floor(mins / 60);
    const min = mins % 60;
    const time24h = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
    const time12h = formatTime12h(time24h);
    slots.push({ time: time12h, time_24h: time24h });
  }

  return slots;
}

// ============== QUERIES ==============

/**
 * Get slot configuration for a specific date and service
 * Prioritizes: service-specific + day-specific > service-specific + all days > global + day-specific > global
 */
async function getEffectiveSlotConfig(
  date: string,
  serviceId?: string,
): Promise<SlotConfig | null> {
  const dayOfWeek = new Date(date).getDay();

  try {
    // Try to get the most specific config first
    // If serviceId is provided, look for that service's config OR global config
    // If no serviceId, only look for global config
    const rows = serviceId
      ? await sql`
          SELECT * FROM slot_configs
          WHERE is_active = true
          AND (service_id = ${serviceId} OR service_id IS NULL)
          AND (day_of_week = ${dayOfWeek} OR day_of_week IS NULL)
          ORDER BY 
            CASE WHEN service_id IS NOT NULL THEN 0 ELSE 1 END,
            CASE WHEN day_of_week IS NOT NULL THEN 0 ELSE 1 END
          LIMIT 1
        `
      : await sql`
          SELECT * FROM slot_configs
          WHERE is_active = true
          AND service_id IS NULL
          AND (day_of_week = ${dayOfWeek} OR day_of_week IS NULL)
          ORDER BY 
            CASE WHEN day_of_week IS NOT NULL THEN 0 ELSE 1 END
          LIMIT 1
        `;

    if (rows.length > 0) {
      return rows[0] as unknown as SlotConfig;
    }
  } catch (err) {
    // Table might not exist yet
    console.log("slot_configs table not found, using defaults");
  }

  return null;
}

/**
 * Check if a date is blacked out
 */
async function isDateBlackedOut(
  date: string,
  serviceId?: string,
): Promise<{ blackedOut: boolean; reason?: string }> {
  try {
    // Check for service-specific blackout or global blackout
    const rows = serviceId
      ? await sql`
          SELECT reason FROM slot_blackout_dates
          WHERE blackout_date = ${date}
          AND (service_id = ${serviceId} OR service_id IS NULL)
          LIMIT 1
        `
      : await sql`
          SELECT reason FROM slot_blackout_dates
          WHERE blackout_date = ${date}
          AND service_id IS NULL
          LIMIT 1
        `;

    if (rows.length > 0) {
      return { blackedOut: true, reason: rows[0].reason };
    }
  } catch (err) {
    // Table might not exist yet
  }

  return { blackedOut: false };
}

/**
 * Get available slots for a specific date and service
 * Checks existing bookings to determine availability
 */
export async function getAvailableSlots(
  date: string,
  serviceId?: string,
  providerId?: string,
): Promise<SlotAvailability> {
  // Check if date is blacked out
  const blackout = await isDateBlackedOut(date, serviceId);
  if (blackout.blackedOut) {
    return {
      date,
      slots: [],
      config: undefined,
    };
  }

  // Get effective slot configuration
  const config = await getEffectiveSlotConfig(date, serviceId);

  // Generate time slots from config or use defaults
  const timeSlotTemplates = config
    ? generateTimeSlotsFromConfig(config)
    : DEFAULT_TIME_SLOTS;

  const maxCapacity =
    config?.max_bookings_per_slot || DEFAULT_MAX_BOOKINGS_PER_SLOT;

  // Get booking counts for each time slot on the given date
  // Note: service column may contain double-encoded JSON (string inside jsonb)
  // Use (service #>> '{}')::jsonb to handle this case
  const bookingCounts = await sql`
    SELECT 
      time_slot,
      COUNT(*) as booking_count
    FROM bookings
    WHERE 
      booking_date = ${date}
      AND status NOT IN ('cancelled', 'completed', 'failed')
      ${
        serviceId
          ? sql`AND (
        CASE 
          WHEN jsonb_typeof(service) = 'string' THEN (service #>> '{}')::jsonb->>'service_id'
          ELSE service->>'service_id'
        END
      ) = ${serviceId}`
          : sql``
      }
      ${providerId ? sql`AND provider_id = ${providerId}` : sql``}
    GROUP BY time_slot
  `;

  // Create a map of booked counts
  const bookedMap = new Map<string, number>();
  for (const row of bookingCounts) {
    bookedMap.set(row.time_slot, parseInt(row.booking_count));
  }

  // Build available slots
  const slots: TimeSlot[] = timeSlotTemplates.map((slot, index) => {
    const bookedCount = bookedMap.get(slot.time) || 0;
    const isAvailable = bookedCount < maxCapacity;

    return {
      id: `slot_${index}`,
      time: slot.time,
      time_24h: slot.time_24h,
      is_available: isAvailable,
      booked_count: bookedCount,
      max_capacity: maxCapacity,
    };
  });

  // Filter out past slots if date is today
  const today = new Date().toISOString().split("T")[0];
  if (date === today) {
    const now = new Date();
    const currentHour = now.getHours();

    slots.forEach((slot) => {
      const [hourStr] = slot.time_24h.split(":");
      const slotHour = parseInt(hourStr);

      // Mark slot as unavailable if it's in the past (with 1 hour buffer)
      if (slotHour <= currentHour + 1) {
        slot.is_available = false;
      }
    });
  }

  return {
    date,
    slots,
    config: config as SlotConfigResponse | undefined,
  };
}

/**
 * Get available slots for multiple dates
 */
export async function getAvailableSlotsRange(
  startDate: string,
  endDate: string,
  serviceId?: string,
  providerId?: string,
): Promise<SlotAvailability[]> {
  const results: SlotAvailability[] = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const availability = await getAvailableSlots(
      dateStr,
      serviceId,
      providerId,
    );
    results.push(availability);
  }

  return results;
}

/**
 * Check if a specific slot is available
 */
export async function isSlotAvailable(
  date: string,
  time: string,
  serviceId?: string,
  providerId?: string,
): Promise<boolean> {
  const availability = await getAvailableSlots(date, serviceId, providerId);
  const slot = availability.slots.find((s) => s.time === time);
  return slot?.is_available ?? false;
}

/**
 * Get slot configuration for a service (for admin management)
 */
export async function getSlotConfig(
  serviceId?: string,
): Promise<SlotConfigResponse[]> {
  try {
    let rows;
    if (serviceId) {
      rows = await sql`
        SELECT sc.*, s.name as service_name
        FROM slot_configs sc
        LEFT JOIN services s ON sc.service_id = s.id
        WHERE 
          sc.is_active = true
          AND (sc.service_id = ${serviceId} OR sc.service_id IS NULL)
        ORDER BY sc.service_id NULLS LAST, sc.day_of_week NULLS LAST
      `;
    } else {
      rows = await sql`
        SELECT sc.*, s.name as service_name
        FROM slot_configs sc
        LEFT JOIN services s ON sc.service_id = s.id
        WHERE sc.is_active = true
        ORDER BY sc.service_id NULLS LAST, sc.day_of_week NULLS LAST
      `;
    }
    return rows as unknown as SlotConfigResponse[];
  } catch {
    // Table might not exist, return empty
    return [];
  }
}

// ============== ADMIN MANAGEMENT FUNCTIONS ==============

/**
 * Get all slot configurations (admin)
 */
export async function getAllSlotConfigs(): Promise<SlotConfigResponse[]> {
  try {
    const rows = await sql`
      SELECT sc.*, s.name as service_name
      FROM slot_configs sc
      LEFT JOIN services s ON sc.service_id = s.id
      ORDER BY 
        CASE WHEN sc.service_id IS NULL THEN 0 ELSE 1 END,
        s.name NULLS FIRST,
        sc.day_of_week NULLS FIRST
    `;
    return rows as unknown as SlotConfigResponse[];
  } catch {
    return [];
  }
}

/**
 * Create a new slot configuration
 */
export async function createSlotConfig(
  config: Partial<SlotConfig>,
): Promise<SlotConfig> {
  const rows = await sql`
    INSERT INTO slot_configs (
      service_id,
      day_of_week,
      start_time,
      end_time,
      slot_duration_minutes,
      gap_between_slots_minutes,
      max_bookings_per_slot,
      is_active
    ) VALUES (
      ${config.service_id || null},
      ${config.day_of_week ?? null},
      ${config.start_time || "09:00"},
      ${config.end_time || "18:00"},
      ${config.slot_duration_minutes || 60},
      ${config.gap_between_slots_minutes || 0},
      ${config.max_bookings_per_slot || 5},
      ${config.is_active !== false}
    )
    RETURNING *
  `;
  return rows[0] as unknown as SlotConfig;
}

/**
 * Update a slot configuration
 */
export async function updateSlotConfig(
  id: string,
  updates: Partial<SlotConfig>,
): Promise<SlotConfig | null> {
  // Handle null/undefined values explicitly
  const serviceId =
    updates.service_id === undefined ? null : updates.service_id || null;
  const dayOfWeek =
    updates.day_of_week === undefined ? null : updates.day_of_week;
  const startTime = updates.start_time || null;
  const endTime = updates.end_time || null;
  const slotDuration = updates.slot_duration_minutes ?? null;
  const gapBetween = updates.gap_between_slots_minutes ?? null;
  const maxBookings = updates.max_bookings_per_slot ?? null;
  const isActive = updates.is_active ?? null;

  const rows = await sql`
    UPDATE slot_configs
    SET
      service_id = COALESCE(${serviceId}, service_id),
      day_of_week = ${dayOfWeek},
      start_time = COALESCE(${startTime}, start_time),
      end_time = COALESCE(${endTime}, end_time),
      slot_duration_minutes = COALESCE(${slotDuration}, slot_duration_minutes),
      gap_between_slots_minutes = COALESCE(${gapBetween}, gap_between_slots_minutes),
      max_bookings_per_slot = COALESCE(${maxBookings}, max_bookings_per_slot),
      is_active = COALESCE(${isActive}, is_active),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows.length > 0 ? (rows[0] as unknown as SlotConfig) : null;
}

/**
 * Delete a slot configuration
 */
export async function deleteSlotConfig(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM slot_configs
    WHERE id = ${id}
    RETURNING id
  `;
  return result.length > 0;
}

/**
 * Get all blackout dates
 */
export async function getAllBlackoutDates(): Promise<BlackoutDate[]> {
  try {
    const rows = await sql`
      SELECT bd.*, s.name as service_name
      FROM slot_blackout_dates bd
      LEFT JOIN services s ON bd.service_id = s.id
      ORDER BY bd.blackout_date DESC
    `;
    return rows as unknown as BlackoutDate[];
  } catch {
    return [];
  }
}

/**
 * Create a blackout date
 */
export async function createBlackoutDate(
  date: string,
  reason?: string,
  serviceId?: string,
  createdBy?: string,
): Promise<BlackoutDate> {
  const rows = await sql`
    INSERT INTO slot_blackout_dates (blackout_date, service_id, reason, created_by)
    VALUES (${date}, ${serviceId || null}, ${reason || null}, ${createdBy || null})
    RETURNING *
  `;
  return rows[0] as unknown as BlackoutDate;
}

/**
 * Delete a blackout date
 */
export async function deleteBlackoutDate(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM slot_blackout_dates
    WHERE id = ${id}
    RETURNING id
  `;
  return result.length > 0;
}

/**
 * Get upcoming blackout dates
 */
export async function getUpcomingBlackoutDates(
  serviceId?: string,
): Promise<BlackoutDate[]> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const rows = await sql`
      SELECT bd.*, s.name as service_name
      FROM slot_blackout_dates bd
      LEFT JOIN services s ON bd.service_id = s.id
      WHERE bd.blackout_date >= ${today}
      ${serviceId ? sql`AND (bd.service_id = ${serviceId} OR bd.service_id IS NULL)` : sql``}
      ORDER BY bd.blackout_date ASC
    `;
    return rows as unknown as BlackoutDate[];
  } catch {
    return [];
  }
}
