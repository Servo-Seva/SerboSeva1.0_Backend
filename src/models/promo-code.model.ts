import sql from "../db";

export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discount_type: "flat" | "percentage";
  discount_value: number;
  min_order_value: number;
  max_discount?: number;
  usage_limit?: number;
  used_count: number;
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePromoCodeInput {
  code: string;
  description?: string;
  discount_type: "flat" | "percentage";
  discount_value: number;
  min_order_value?: number;
  max_discount?: number;
  usage_limit?: number;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
}

export interface UpdatePromoCodeInput {
  code?: string;
  description?: string;
  discount_type?: "flat" | "percentage";
  discount_value?: number;
  min_order_value?: number;
  max_discount?: number;
  usage_limit?: number;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
}

export interface ValidatePromoResult {
  valid: boolean;
  discount: number;
  message: string;
  promo_code?: PromoCode;
}

// Get all promo codes (admin)
export async function getAllPromoCodes(): Promise<PromoCode[]> {
  const result = await sql<
    PromoCode[]
  >`SELECT * FROM promo_codes ORDER BY created_at DESC`;
  return result;
}

// Get active promo codes for display to users
export async function getActivePromoCodes(
  limit: number = 5,
): Promise<
  Pick<
    PromoCode,
    | "code"
    | "description"
    | "discount_type"
    | "discount_value"
    | "min_order_value"
    | "max_discount"
  >[]
> {
  const result = await sql<PromoCode[]>`
    SELECT code, description, discount_type, discount_value, min_order_value, max_discount 
    FROM promo_codes 
    WHERE is_active = true 
      AND (valid_from IS NULL OR valid_from <= NOW())
      AND (valid_until IS NULL OR valid_until > NOW())
      AND (usage_limit IS NULL OR used_count < usage_limit)
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result;
}

// Get promo code by ID
export async function getPromoCodeById(id: string): Promise<PromoCode | null> {
  const [promo] = await sql<
    PromoCode[]
  >`SELECT * FROM promo_codes WHERE id = ${id}`;
  return promo || null;
}

// Get promo code by code
export async function getPromoCodeByCode(
  code: string,
): Promise<PromoCode | null> {
  const upperCode = code.toUpperCase();
  const [promo] = await sql<
    PromoCode[]
  >`SELECT * FROM promo_codes WHERE UPPER(code) = ${upperCode}`;
  return promo || null;
}

// Create promo code
export async function createPromoCode(
  input: CreatePromoCodeInput,
): Promise<PromoCode> {
  const {
    code,
    description,
    discount_type,
    discount_value,
    min_order_value = 0,
    max_discount,
    usage_limit,
    valid_from,
    valid_until,
    is_active = true,
  } = input;

  const upperCode = code.toUpperCase();
  const [promo] = await sql<PromoCode[]>`
    INSERT INTO promo_codes 
    (code, description, discount_type, discount_value, min_order_value, max_discount, usage_limit, valid_from, valid_until, is_active)
    VALUES (${upperCode}, ${description ?? null}, ${discount_type}, ${discount_value}, ${min_order_value}, ${max_discount ?? null}, ${usage_limit ?? null}, COALESCE(${valid_from ?? null}::timestamptz, NOW()), ${valid_until ?? null}, ${is_active})
    RETURNING *
  `;
  return promo;
}

// Update promo code
export async function updatePromoCode(
  id: string,
  input: UpdatePromoCodeInput,
): Promise<PromoCode | null> {
  // First get the existing promo code
  const existing = await getPromoCodeById(id);
  if (!existing) return null;

  // Merge the input with existing values
  const updatedCode =
    input.code !== undefined ? input.code.toUpperCase() : existing.code;
  const updatedDescription =
    input.description !== undefined ? input.description : existing.description;
  const updatedDiscountType =
    input.discount_type !== undefined
      ? input.discount_type
      : existing.discount_type;
  const updatedDiscountValue =
    input.discount_value !== undefined
      ? input.discount_value
      : existing.discount_value;
  const updatedMinOrderValue =
    input.min_order_value !== undefined
      ? input.min_order_value
      : existing.min_order_value;
  const updatedMaxDiscount =
    input.max_discount !== undefined
      ? input.max_discount
      : existing.max_discount;
  const updatedUsageLimit =
    input.usage_limit !== undefined ? input.usage_limit : existing.usage_limit;
  const updatedValidFrom =
    input.valid_from !== undefined ? input.valid_from : existing.valid_from;
  const updatedValidUntil =
    input.valid_until !== undefined ? input.valid_until : existing.valid_until;
  const updatedIsActive =
    input.is_active !== undefined ? input.is_active : existing.is_active;

  const [promo] = await sql<PromoCode[]>`
    UPDATE promo_codes SET
      code = ${updatedCode},
      description = ${updatedDescription ?? null},
      discount_type = ${updatedDiscountType},
      discount_value = ${updatedDiscountValue},
      min_order_value = ${updatedMinOrderValue},
      max_discount = ${updatedMaxDiscount ?? null},
      usage_limit = ${updatedUsageLimit ?? null},
      valid_from = ${updatedValidFrom},
      valid_until = ${updatedValidUntil ?? null},
      is_active = ${updatedIsActive},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return promo || null;
}

// Delete promo code
export async function deletePromoCode(id: string): Promise<boolean> {
  const result = await sql`DELETE FROM promo_codes WHERE id = ${id}`;
  return result.count > 0;
}

// Validate and apply promo code
export async function validatePromoCode(
  code: string,
  orderTotal: number,
): Promise<ValidatePromoResult> {
  const promo = await getPromoCodeByCode(code);

  if (!promo) {
    return { valid: false, discount: 0, message: "Invalid promo code" };
  }

  if (!promo.is_active) {
    return {
      valid: false,
      discount: 0,
      message: "This promo code is no longer active",
    };
  }

  const now = new Date();
  const validFrom = new Date(promo.valid_from);
  if (now < validFrom) {
    return {
      valid: false,
      discount: 0,
      message: "This promo code is not yet valid",
    };
  }

  if (promo.valid_until) {
    const validUntil = new Date(promo.valid_until);
    if (now > validUntil) {
      return {
        valid: false,
        discount: 0,
        message: "This promo code has expired",
      };
    }
  }

  if (promo.usage_limit && promo.used_count >= promo.usage_limit) {
    return {
      valid: false,
      discount: 0,
      message: "This promo code has reached its usage limit",
    };
  }

  if (orderTotal < promo.min_order_value) {
    return {
      valid: false,
      discount: 0,
      message: `Minimum order value of ₹${promo.min_order_value} required`,
    };
  }

  // Calculate discount
  let discount = 0;
  if (promo.discount_type === "flat") {
    discount = promo.discount_value;
  } else {
    // Percentage
    discount = (orderTotal * promo.discount_value) / 100;
    if (promo.max_discount && discount > promo.max_discount) {
      discount = promo.max_discount;
    }
  }

  // Don't let discount exceed order total
  if (discount > orderTotal) {
    discount = orderTotal;
  }

  return {
    valid: true,
    discount: Math.round(discount * 100) / 100,
    message: `Promo code applied! You save ₹${Math.round(discount * 100) / 100}`,
    promo_code: promo,
  };
}

// Increment usage count when promo is used
export async function incrementPromoUsage(id: string): Promise<void> {
  await sql`UPDATE promo_codes SET used_count = used_count + 1, updated_at = NOW() WHERE id = ${id}`;
}

// Check if promo code exists
export async function promoCodeExists(code: string): Promise<boolean> {
  const upperCode = code.toUpperCase();
  const result =
    await sql`SELECT 1 FROM promo_codes WHERE UPPER(code) = ${upperCode}`;
  return result.length > 0;
}
