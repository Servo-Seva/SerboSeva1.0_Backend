import sql from "../db";

// ============== TYPES ==============

export type ServiceV2 = {
  id: string;
  subcategory_id: string | null;
  name: string;
  description: string | null;
  base_price: string | null;
  price: string | null;
  is_active: boolean;
  created_at: string;
  avg_rating?: number;
  reviews_count?: number;
  duration_minutes?: number;
  thumbnail_url?: string | null;
  currency?: string | null;
};

export type ServiceWithSubcategory = ServiceV2 & {
  subcategory_name?: string;
  subcategory_icon?: string;
  category_id?: string;
  category_name?: string;
};

// ============== QUERIES ==============

/**
 * Create a new service under a subcategory
 */
export async function createServiceV2(data: {
  subcategory_id: string;
  name: string;
  description?: string;
  base_price?: number;
  duration_minutes?: number;
  thumbnail_url?: string;
}): Promise<ServiceV2> {
  const rows = await sql`
    INSERT INTO services (subcategory_id, name, description, base_price, price, duration_minutes, thumbnail_url, is_active)
    VALUES (
      ${data.subcategory_id},
      ${data.name},
      ${data.description || null},
      ${data.base_price || null},
      ${data.base_price || null},
      ${data.duration_minutes || null},
      ${data.thumbnail_url || null},
      true
    )
    RETURNING id, subcategory_id, name, description, base_price, price, is_active, created_at, duration_minutes, thumbnail_url
  `;
  return rows[0] as ServiceV2;
}

/**
 * Get services by subcategory ID
 */
export async function getServicesBySubcategoryId(
  subcategoryId: string
): Promise<ServiceV2[]> {
  const rows = await sql`
    SELECT 
      id, subcategory_id, name, description, base_price, price, is_active, 
      created_at, avg_rating, reviews_count, duration_minutes, thumbnail_url, currency
    FROM services
    WHERE subcategory_id = ${subcategoryId} AND is_active = true
    ORDER BY name
  `;

  return rows.map((r: any) => ({
    id: r.id,
    subcategory_id: r.subcategory_id,
    name: r.name,
    description: r.description,
    base_price: r.base_price ? String(r.base_price) : null,
    price: r.price ? String(r.price) : null,
    is_active: !!r.is_active,
    created_at: r.created_at,
    avg_rating: r.avg_rating ? Number(r.avg_rating) : 0,
    reviews_count: r.reviews_count ? Number(r.reviews_count) : 0,
    duration_minutes: r.duration_minutes ? Number(r.duration_minutes) : 0,
    thumbnail_url: r.thumbnail_url || null,
    currency: r.currency || null,
  }));
}

/**
 * Get service by ID with subcategory and category info
 */
export async function getServiceByIdWithDetails(
  serviceId: string
): Promise<ServiceWithSubcategory | null> {
  const rows = await sql`
    SELECT 
      s.id, s.subcategory_id, s.name, s.description, s.base_price, s.price, 
      s.is_active, s.created_at, s.avg_rating, s.reviews_count, 
      s.duration_minutes, s.thumbnail_url, s.currency,
      sc.name as subcategory_name, sc.icon as subcategory_icon,
      sc.category_id, c.name as category_name
    FROM services s
    LEFT JOIN subcategories sc ON sc.id = s.subcategory_id
    LEFT JOIN categories c ON c.id = sc.category_id
    WHERE s.id = ${serviceId}
  `;

  if (rows.length === 0) return null;

  const r: any = rows[0];
  return {
    id: r.id,
    subcategory_id: r.subcategory_id,
    name: r.name,
    description: r.description,
    base_price: r.base_price ? String(r.base_price) : null,
    price: r.price ? String(r.price) : null,
    is_active: !!r.is_active,
    created_at: r.created_at,
    avg_rating: r.avg_rating ? Number(r.avg_rating) : 0,
    reviews_count: r.reviews_count ? Number(r.reviews_count) : 0,
    duration_minutes: r.duration_minutes ? Number(r.duration_minutes) : 0,
    thumbnail_url: r.thumbnail_url || null,
    currency: r.currency || null,
    subcategory_name: r.subcategory_name,
    subcategory_icon: r.subcategory_icon,
    category_id: r.category_id,
    category_name: r.category_name,
  };
}

/**
 * Get all services (admin view)
 */
export async function getAllServicesV2(): Promise<ServiceWithSubcategory[]> {
  const rows = await sql`
    SELECT 
      s.id, s.subcategory_id, s.name, s.description, s.base_price, s.price, 
      s.is_active, s.created_at, s.avg_rating, s.reviews_count, 
      s.duration_minutes, s.thumbnail_url, s.currency,
      sc.name as subcategory_name, sc.icon as subcategory_icon,
      sc.category_id, c.name as category_name
    FROM services s
    LEFT JOIN subcategories sc ON sc.id = s.subcategory_id
    LEFT JOIN categories c ON c.id = sc.category_id
    ORDER BY c.name, sc.name, s.name
  `;

  return rows.map((r: any) => ({
    id: r.id,
    subcategory_id: r.subcategory_id,
    name: r.name,
    description: r.description,
    base_price: r.base_price ? String(r.base_price) : null,
    price: r.price ? String(r.price) : null,
    is_active: !!r.is_active,
    created_at: r.created_at,
    avg_rating: r.avg_rating ? Number(r.avg_rating) : 0,
    reviews_count: r.reviews_count ? Number(r.reviews_count) : 0,
    duration_minutes: r.duration_minutes ? Number(r.duration_minutes) : 0,
    thumbnail_url: r.thumbnail_url || null,
    currency: r.currency || null,
    subcategory_name: r.subcategory_name,
    subcategory_icon: r.subcategory_icon,
    category_id: r.category_id,
    category_name: r.category_name,
  }));
}

/**
 * Update service
 */
export async function updateServiceV2(
  id: string,
  data: {
    subcategory_id?: string;
    name?: string;
    description?: string;
    base_price?: number;
    is_active?: boolean;
    duration_minutes?: number;
    thumbnail_url?: string;
  }
): Promise<ServiceV2 | null> {
  const updateObj: Record<string, any> = {};

  if (data.subcategory_id !== undefined)
    updateObj.subcategory_id = data.subcategory_id;
  if (data.name !== undefined) updateObj.name = data.name;
  if (data.description !== undefined) updateObj.description = data.description;
  if (data.base_price !== undefined) {
    updateObj.base_price = data.base_price;
    updateObj.price = data.base_price;
  }
  if (data.is_active !== undefined) updateObj.is_active = data.is_active;
  if (data.duration_minutes !== undefined)
    updateObj.duration_minutes = data.duration_minutes;
  if (data.thumbnail_url !== undefined)
    updateObj.thumbnail_url = data.thumbnail_url || null; // Convert empty string to null

  if (Object.keys(updateObj).length === 0) return null;

  const rows = await sql`
    UPDATE services
    SET ${sql(updateObj)}
    WHERE id = ${id}
    RETURNING id, subcategory_id, name, description, base_price, price, is_active, created_at, duration_minutes, thumbnail_url
  `;

  return rows.length > 0 ? (rows[0] as ServiceV2) : null;
}

/**
 * Delete service
 */
export async function deleteServiceV2(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM services WHERE id = ${id}
  `;
  return result.count > 0;
}
