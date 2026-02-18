import sql from "../db";

// ============== TYPES ==============

export type Provider = {
  id: string;
  name: string;
  phone: string;
  experience: number;
  status: "pending" | "active" | "blocked";
  avatar_url: string | null;
  created_at: string;
};

export type ProviderWithServiceCount = Provider & {
  service_count?: number;
};

// ============== QUERIES ==============

/**
 * Create a new provider
 */
export async function createProvider(data: {
  name: string;
  phone: string;
  experience?: number;
  status?: "pending" | "active" | "blocked";
  avatar_url?: string;
}): Promise<Provider> {
  const rows = await sql`
    INSERT INTO providers (name, phone, experience, status, avatar_url)
    VALUES (
      ${data.name},
      ${data.phone},
      ${data.experience || 0},
      ${data.status || "pending"},
      ${data.avatar_url || null}
    )
    RETURNING id, name, phone, experience, status, avatar_url, created_at
  `;
  return rows[0] as Provider;
}

/**
 * Get provider by ID
 */
export async function getProviderById(id: string): Promise<Provider | null> {
  const rows = await sql`
    SELECT id, name, phone, experience, status, avatar_url, created_at
    FROM providers
    WHERE id = ${id}
  `;
  return rows.length > 0 ? (rows[0] as Provider) : null;
}

/**
 * Get provider by phone
 */
export async function getProviderByPhone(
  phone: string,
): Promise<Provider | null> {
  const rows = await sql`
    SELECT id, name, phone, experience, status, avatar_url, created_at
    FROM providers
    WHERE phone = ${phone}
  `;
  return rows.length > 0 ? (rows[0] as Provider) : null;
}

/**
 * Get all providers with optional status filter
 */
export async function getAllProviders(
  status?: "pending" | "active" | "blocked",
): Promise<ProviderWithServiceCount[]> {
  let rows;

  if (status) {
    rows = await sql`
      SELECT 
        p.id, p.name, p.phone, p.experience, p.status,
        COALESCE(
          (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
          p.avatar_url
        ) as avatar_url,
        p.created_at,
        COUNT(ps.id) FILTER (WHERE ps.status = 'active') as service_count
      FROM providers p
      LEFT JOIN provider_services ps ON ps.provider_id = p.id
      WHERE p.status = ${status}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
  } else {
    rows = await sql`
      SELECT 
        p.id, p.name, p.phone, p.experience, p.status,
        COALESCE(
          (SELECT pd.file_url FROM provider_documents pd WHERE pd.provider_id = p.id AND pd.document_type = 'photo' LIMIT 1),
          p.avatar_url
        ) as avatar_url,
        p.created_at,
        COUNT(ps.id) FILTER (WHERE ps.status = 'active') as service_count
      FROM providers p
      LEFT JOIN provider_services ps ON ps.provider_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
  }

  return rows.map((r: any) => ({
    ...r,
    experience: Number(r.experience || 0),
    service_count: Number(r.service_count || 0),
  }));
}

/**
 * Update provider
 */
export async function updateProvider(
  id: string,
  data: {
    name?: string;
    phone?: string;
    experience?: number;
    status?: "pending" | "active" | "blocked";
    avatar_url?: string;
  },
): Promise<Provider | null> {
  const updateObj: Record<string, any> = {};

  if (data.name !== undefined) updateObj.name = data.name;
  if (data.phone !== undefined) updateObj.phone = data.phone;
  if (data.experience !== undefined) updateObj.experience = data.experience;
  if (data.status !== undefined) updateObj.status = data.status;
  if (data.avatar_url !== undefined) updateObj.avatar_url = data.avatar_url;

  if (Object.keys(updateObj).length === 0) return getProviderById(id);

  const rows = await sql`
    UPDATE providers
    SET ${sql(updateObj)}
    WHERE id = ${id}
    RETURNING id, name, phone, experience, status, avatar_url, created_at
  `;

  return rows.length > 0 ? (rows[0] as Provider) : null;
}

/**
 * Delete provider
 */
export async function deleteProvider(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM providers WHERE id = ${id}
  `;
  return result.count > 0;
}

/**
 * Check if provider exists by phone
 */
export async function providerExistsByPhone(phone: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM providers WHERE phone = ${phone} LIMIT 1
  `;
  return rows.length > 0;
}
