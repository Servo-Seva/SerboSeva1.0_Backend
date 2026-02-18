import sql from "../db";

// ============== TYPES ==============

export type ProviderService = {
  id: string;
  provider_id: string;
  service_id: string;
  status: "active" | "inactive";
  created_at: string;
};

export type ProviderServiceWithDetails = ProviderService & {
  provider_name?: string;
  provider_phone?: string;
  provider_experience?: number;
  provider_status?: string;
  provider_avatar_url?: string;
  service_name?: string;
  service_description?: string;
  service_base_price?: string;
};

export type ProviderForService = {
  id: string;
  provider_id: string;
  provider_name: string;
  provider_phone: string;
  provider_experience: number;
  provider_avatar_url: string | null;
  assignment_status: string;
};

// ============== QUERIES ==============

/**
 * Assign provider to multiple services
 * Prevents duplicates by using ON CONFLICT DO NOTHING
 */
export async function assignProviderToServices(
  providerId: string,
  serviceIds: string[]
): Promise<ProviderService[]> {
  if (serviceIds.length === 0) return [];

  const insertedRows: ProviderService[] = [];

  for (const serviceId of serviceIds) {
    try {
      const rows = await sql`
        INSERT INTO provider_services (provider_id, service_id, status)
        VALUES (${providerId}, ${serviceId}, 'active')
        ON CONFLICT (provider_id, service_id) DO NOTHING
        RETURNING id, provider_id, service_id, status, created_at
      `;
      if (rows.length > 0) {
        insertedRows.push(rows[0] as ProviderService);
      }
    } catch (err) {
      // Skip if service doesn't exist
      console.error(`Failed to assign provider to service ${serviceId}:`, err);
    }
  }

  return insertedRows;
}

/**
 * Update provider service status (enable/disable)
 */
export async function updateProviderServiceStatus(
  id: string,
  status: "active" | "inactive"
): Promise<ProviderService | null> {
  const rows = await sql`
    UPDATE provider_services
    SET status = ${status}
    WHERE id = ${id}
    RETURNING id, provider_id, service_id, status, created_at
  `;
  return rows.length > 0 ? (rows[0] as ProviderService) : null;
}

/**
 * Get provider service by ID
 */
export async function getProviderServiceById(
  id: string
): Promise<ProviderServiceWithDetails | null> {
  const rows = await sql`
    SELECT 
      ps.id, ps.provider_id, ps.service_id, ps.status, ps.created_at,
      p.name as provider_name, p.phone as provider_phone, 
      p.experience as provider_experience, p.status as provider_status,
      p.avatar_url as provider_avatar_url,
      s.name as service_name, s.description as service_description,
      s.base_price as service_base_price
    FROM provider_services ps
    JOIN providers p ON p.id = ps.provider_id
    JOIN services s ON s.id = ps.service_id
    WHERE ps.id = ${id}
  `;
  return rows.length > 0 ? (rows[0] as ProviderServiceWithDetails) : null;
}

/**
 * Get all assignments for a provider
 */
export async function getProviderAssignments(
  providerId: string
): Promise<ProviderServiceWithDetails[]> {
  const rows = await sql`
    SELECT 
      ps.id, ps.provider_id, ps.service_id, ps.status, ps.created_at,
      s.name as service_name, s.description as service_description,
      s.base_price as service_base_price
    FROM provider_services ps
    JOIN services s ON s.id = ps.service_id
    WHERE ps.provider_id = ${providerId}
    ORDER BY ps.created_at DESC
  `;
  return rows.map((r: any) => ({
    id: r.id,
    provider_id: r.provider_id,
    service_id: r.service_id,
    status: r.status,
    created_at: r.created_at,
    service_name: r.service_name,
    service_description: r.service_description,
    service_base_price: r.service_base_price,
  }));
}

/**
 * Get active providers for a service
 * Only returns providers where:
 * - provider_services.status = 'active'
 * - providers.status = 'active'
 */
export async function getActiveProvidersForService(
  serviceId: string
): Promise<ProviderForService[]> {
  const rows = await sql`
    SELECT 
      ps.id,
      ps.provider_id,
      p.name as provider_name,
      p.phone as provider_phone,
      p.experience as provider_experience,
      p.avatar_url as provider_avatar_url,
      ps.status as assignment_status
    FROM provider_services ps
    JOIN providers p ON p.id = ps.provider_id
    WHERE ps.service_id = ${serviceId}
      AND ps.status = 'active'
      AND p.status = 'active'
    ORDER BY p.experience DESC, p.name
  `;

  return rows.map((r: any) => ({
    id: r.id,
    provider_id: r.provider_id,
    provider_name: r.provider_name,
    provider_phone: r.provider_phone,
    provider_experience: Number(r.provider_experience || 0),
    provider_avatar_url: r.provider_avatar_url,
    assignment_status: r.assignment_status,
  }));
}

/**
 * Remove provider from service
 */
export async function removeProviderFromService(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM provider_services WHERE id = ${id}
  `;
  return result.count > 0;
}

/**
 * Check if provider is already assigned to service
 */
export async function isProviderAssignedToService(
  providerId: string,
  serviceId: string
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM provider_services
    WHERE provider_id = ${providerId} AND service_id = ${serviceId}
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Get all provider-service assignments (admin view)
 */
export async function getAllProviderServices(): Promise<
  ProviderServiceWithDetails[]
> {
  const rows = await sql`
    SELECT 
      ps.id, ps.provider_id, ps.service_id, ps.status, ps.created_at,
      p.name as provider_name, p.phone as provider_phone, 
      p.experience as provider_experience, p.status as provider_status,
      p.avatar_url as provider_avatar_url,
      s.name as service_name, s.description as service_description,
      s.base_price as service_base_price
    FROM provider_services ps
    JOIN providers p ON p.id = ps.provider_id
    JOIN services s ON s.id = ps.service_id
    ORDER BY ps.created_at DESC
  `;
  return rows.map((r: any) => ({
    id: r.id,
    provider_id: r.provider_id,
    service_id: r.service_id,
    status: r.status,
    created_at: r.created_at,
    provider_name: r.provider_name,
    provider_phone: r.provider_phone,
    provider_experience: Number(r.provider_experience || 0),
    provider_status: r.provider_status,
    provider_avatar_url: r.provider_avatar_url,
    service_name: r.service_name,
    service_description: r.service_description,
    service_base_price: r.service_base_price,
  }));
}
