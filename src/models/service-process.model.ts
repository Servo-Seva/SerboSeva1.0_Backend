import sql from "../db";

// ============== TYPES ==============

export interface ServiceProcess {
  id: string;
  service_id: string;
  step_number: number;
  title: string;
  description: string | null;
  icon: string;
  estimated_minutes: number | null;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface CoverPromise {
  id: string;
  service_id: string;
  title: string;
  description: string | null;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ServiceFAQ {
  id: string;
  service_id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ServiceInclude {
  id: string;
  service_id: string;
  item: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ServiceExclude {
  id: string;
  service_id: string;
  item: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ServiceProcessDetails {
  processes: ServiceProcess[];
  coverPromises: CoverPromise[];
  faqs: ServiceFAQ[];
  includes: ServiceInclude[];
  excludes: ServiceExclude[];
}

// ============== PROCESS STEPS QUERIES ==============

/**
 * Get all process steps for a service
 */
export async function getServiceProcesses(
  serviceId: string
): Promise<ServiceProcess[]> {
  const rows = await sql`
    SELECT id, service_id, step_number, title, description, icon, 
           estimated_minutes, is_required, created_at, updated_at
    FROM service_processes
    WHERE service_id = ${serviceId}
    ORDER BY step_number ASC
  `;
  return rows.map((r: any) => ({
    id: r.id,
    service_id: r.service_id,
    step_number: r.step_number,
    title: r.title,
    description: r.description,
    icon: r.icon || "check",
    estimated_minutes: r.estimated_minutes,
    is_required: r.is_required,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

/**
 * Create a new process step
 */
export async function createServiceProcess(data: {
  service_id: string;
  step_number: number;
  title: string;
  description?: string;
  icon?: string;
  estimated_minutes?: number;
  is_required?: boolean;
}): Promise<ServiceProcess> {
  const rows = await sql`
    INSERT INTO service_processes (service_id, step_number, title, description, icon, estimated_minutes, is_required)
    VALUES (
      ${data.service_id},
      ${data.step_number},
      ${data.title},
      ${data.description || null},
      ${data.icon || "check"},
      ${data.estimated_minutes || null},
      ${data.is_required !== false}
    )
    RETURNING *
  `;
  return rows[0] as ServiceProcess;
}

/**
 * Update a process step
 */
export async function updateServiceProcess(
  id: string,
  data: Partial<
    Omit<ServiceProcess, "id" | "service_id" | "created_at" | "updated_at">
  >
): Promise<ServiceProcess | null> {
  const rows = await sql`
    UPDATE service_processes
    SET 
      step_number = COALESCE(${data.step_number ?? null}, step_number),
      title = COALESCE(${data.title ?? null}, title),
      description = COALESCE(${data.description ?? null}, description),
      icon = COALESCE(${data.icon ?? null}, icon),
      estimated_minutes = COALESCE(${
        data.estimated_minutes ?? null
      }, estimated_minutes),
      is_required = COALESCE(${data.is_required ?? null}, is_required),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows.length ? (rows[0] as ServiceProcess) : null;
}

/**
 * Delete a process step
 */
export async function deleteServiceProcess(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM service_processes WHERE id = ${id}
  `;
  return result.count > 0;
}

/**
 * Bulk create/update process steps for a service
 */
export async function upsertServiceProcesses(
  serviceId: string,
  processes: Array<{
    step_number: number;
    title: string;
    description?: string;
    icon?: string;
    estimated_minutes?: number;
    is_required?: boolean;
  }>
): Promise<ServiceProcess[]> {
  // Delete existing processes
  await sql`DELETE FROM service_processes WHERE service_id = ${serviceId}`;

  // Insert new processes
  const results: ServiceProcess[] = [];
  for (const process of processes) {
    const row = await createServiceProcess({
      service_id: serviceId,
      ...process,
    });
    results.push(row);
  }
  return results;
}

// ============== COVER PROMISES QUERIES ==============

/**
 * Get all cover promises for a service
 */
export async function getCoverPromises(
  serviceId: string
): Promise<CoverPromise[]> {
  const rows = await sql`
    SELECT id, service_id, title, description, icon, sort_order, is_active, created_at
    FROM service_cover_promises
    WHERE service_id = ${serviceId} AND is_active = true
    ORDER BY sort_order ASC
  `;
  return rows.map((r: any) => ({
    id: r.id,
    service_id: r.service_id,
    title: r.title,
    description: r.description,
    icon: r.icon || "shield",
    sort_order: r.sort_order || 0,
    is_active: r.is_active,
    created_at: r.created_at,
  }));
}

/**
 * Create a cover promise
 */
export async function createCoverPromise(data: {
  service_id: string;
  title: string;
  description?: string;
  icon?: string;
  sort_order?: number;
}): Promise<CoverPromise> {
  const rows = await sql`
    INSERT INTO service_cover_promises (service_id, title, description, icon, sort_order)
    VALUES (
      ${data.service_id},
      ${data.title},
      ${data.description || null},
      ${data.icon || "shield"},
      ${data.sort_order || 0}
    )
    RETURNING *
  `;
  return rows[0] as CoverPromise;
}

/**
 * Update a cover promise
 */
export async function updateCoverPromise(
  id: string,
  data: Partial<Omit<CoverPromise, "id" | "service_id" | "created_at">>
): Promise<CoverPromise | null> {
  const rows = await sql`
    UPDATE service_cover_promises
    SET 
      title = COALESCE(${data.title ?? null}, title),
      description = COALESCE(${data.description ?? null}, description),
      icon = COALESCE(${data.icon ?? null}, icon),
      sort_order = COALESCE(${data.sort_order ?? null}, sort_order),
      is_active = COALESCE(${data.is_active ?? null}, is_active)
    WHERE id = ${id}
    RETURNING *
  `;
  return rows.length ? (rows[0] as CoverPromise) : null;
}

/**
 * Delete a cover promise
 */
export async function deleteCoverPromise(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM service_cover_promises WHERE id = ${id}
  `;
  return result.count > 0;
}

/**
 * Bulk upsert cover promises
 */
export async function upsertCoverPromises(
  serviceId: string,
  promises: Array<{
    title: string;
    description?: string;
    icon?: string;
    sort_order?: number;
  }>
): Promise<CoverPromise[]> {
  await sql`DELETE FROM service_cover_promises WHERE service_id = ${serviceId}`;

  const results: CoverPromise[] = [];
  for (let i = 0; i < promises.length; i++) {
    const row = await createCoverPromise({
      service_id: serviceId,
      ...promises[i],
      sort_order: promises[i].sort_order ?? i,
    });
    results.push(row);
  }
  return results;
}

// ============== FAQ QUERIES ==============

/**
 * Get all FAQs for a service
 */
export async function getServiceFAQs(serviceId: string): Promise<ServiceFAQ[]> {
  const rows = await sql`
    SELECT id, service_id, question, answer, sort_order, is_active, created_at
    FROM service_faqs
    WHERE service_id = ${serviceId} AND is_active = true
    ORDER BY sort_order ASC
  `;
  return rows.map((r: any) => ({
    id: r.id,
    service_id: r.service_id,
    question: r.question,
    answer: r.answer,
    sort_order: r.sort_order || 0,
    is_active: r.is_active,
    created_at: r.created_at,
  }));
}

/**
 * Create a FAQ
 */
export async function createServiceFAQ(data: {
  service_id: string;
  question: string;
  answer: string;
  sort_order?: number;
}): Promise<ServiceFAQ> {
  const rows = await sql`
    INSERT INTO service_faqs (service_id, question, answer, sort_order)
    VALUES (
      ${data.service_id},
      ${data.question},
      ${data.answer},
      ${data.sort_order || 0}
    )
    RETURNING *
  `;
  return rows[0] as ServiceFAQ;
}

/**
 * Update a FAQ
 */
export async function updateServiceFAQ(
  id: string,
  data: Partial<Omit<ServiceFAQ, "id" | "service_id" | "created_at">>
): Promise<ServiceFAQ | null> {
  const rows = await sql`
    UPDATE service_faqs
    SET 
      question = COALESCE(${data.question ?? null}, question),
      answer = COALESCE(${data.answer ?? null}, answer),
      sort_order = COALESCE(${data.sort_order ?? null}, sort_order),
      is_active = COALESCE(${data.is_active ?? null}, is_active)
    WHERE id = ${id}
    RETURNING *
  `;
  return rows.length ? (rows[0] as ServiceFAQ) : null;
}

/**
 * Delete a FAQ
 */
export async function deleteServiceFAQ(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM service_faqs WHERE id = ${id}
  `;
  return result.count > 0;
}

/**
 * Bulk upsert FAQs
 */
export async function upsertServiceFAQs(
  serviceId: string,
  faqs: Array<{
    question: string;
    answer: string;
    sort_order?: number;
  }>
): Promise<ServiceFAQ[]> {
  await sql`DELETE FROM service_faqs WHERE service_id = ${serviceId}`;

  const results: ServiceFAQ[] = [];
  for (let i = 0; i < faqs.length; i++) {
    const row = await createServiceFAQ({
      service_id: serviceId,
      ...faqs[i],
      sort_order: faqs[i].sort_order ?? i,
    });
    results.push(row);
  }
  return results;
}

// ============== INCLUDES QUERIES ==============

/**
 * Get all includes for a service
 */
export async function getServiceIncludes(
  serviceId: string
): Promise<ServiceInclude[]> {
  const rows = await sql`
    SELECT id, service_id, item, description, sort_order, is_active, created_at
    FROM service_includes
    WHERE service_id = ${serviceId} AND is_active = true
    ORDER BY sort_order ASC
  `;
  return rows.map((r: any) => ({
    id: r.id,
    service_id: r.service_id,
    item: r.item,
    description: r.description,
    sort_order: r.sort_order || 0,
    is_active: r.is_active,
    created_at: r.created_at,
  }));
}

/**
 * Create a service include
 */
export async function createServiceInclude(data: {
  service_id: string;
  item: string;
  description?: string;
  sort_order?: number;
}): Promise<ServiceInclude> {
  const rows = await sql`
    INSERT INTO service_includes (service_id, item, description, sort_order)
    VALUES (
      ${data.service_id},
      ${data.item},
      ${data.description || null},
      ${data.sort_order || 0}
    )
    RETURNING *
  `;
  return rows[0] as ServiceInclude;
}

/**
 * Bulk upsert includes
 */
export async function upsertServiceIncludes(
  serviceId: string,
  includes: Array<{
    item: string;
    description?: string;
    sort_order?: number;
  }>
): Promise<ServiceInclude[]> {
  await sql`DELETE FROM service_includes WHERE service_id = ${serviceId}`;

  const results: ServiceInclude[] = [];
  for (let i = 0; i < includes.length; i++) {
    const row = await createServiceInclude({
      service_id: serviceId,
      ...includes[i],
      sort_order: includes[i].sort_order ?? i,
    });
    results.push(row);
  }
  return results;
}

// ============== EXCLUDES QUERIES ==============

/**
 * Get all excludes for a service
 */
export async function getServiceExcludes(
  serviceId: string
): Promise<ServiceExclude[]> {
  const rows = await sql`
    SELECT id, service_id, item, description, sort_order, is_active, created_at
    FROM service_excludes
    WHERE service_id = ${serviceId} AND is_active = true
    ORDER BY sort_order ASC
  `;
  return rows.map((r: any) => ({
    id: r.id,
    service_id: r.service_id,
    item: r.item,
    description: r.description,
    sort_order: r.sort_order || 0,
    is_active: r.is_active,
    created_at: r.created_at,
  }));
}

/**
 * Create a service exclude
 */
export async function createServiceExclude(data: {
  service_id: string;
  item: string;
  description?: string;
  sort_order?: number;
}): Promise<ServiceExclude> {
  const rows = await sql`
    INSERT INTO service_excludes (service_id, item, description, sort_order)
    VALUES (
      ${data.service_id},
      ${data.item},
      ${data.description || null},
      ${data.sort_order || 0}
    )
    RETURNING *
  `;
  return rows[0] as ServiceExclude;
}

/**
 * Bulk upsert excludes
 */
export async function upsertServiceExcludes(
  serviceId: string,
  excludes: Array<{
    item: string;
    description?: string;
    sort_order?: number;
  }>
): Promise<ServiceExclude[]> {
  await sql`DELETE FROM service_excludes WHERE service_id = ${serviceId}`;

  const results: ServiceExclude[] = [];
  for (let i = 0; i < excludes.length; i++) {
    const row = await createServiceExclude({
      service_id: serviceId,
      ...excludes[i],
      sort_order: excludes[i].sort_order ?? i,
    });
    results.push(row);
  }
  return results;
}

// ============== COMBINED QUERY ==============

/**
 * Get all process details for a service (processes, promises, FAQs, includes, excludes)
 */
export async function getServiceProcessDetails(
  serviceId: string
): Promise<ServiceProcessDetails> {
  const [processes, coverPromises, faqs, includes, excludes] =
    await Promise.all([
      getServiceProcesses(serviceId),
      getCoverPromises(serviceId),
      getServiceFAQs(serviceId),
      getServiceIncludes(serviceId),
      getServiceExcludes(serviceId),
    ]);

  return {
    processes,
    coverPromises,
    faqs,
    includes,
    excludes,
  };
}

/**
 * Bulk update all process details for a service
 */
export async function upsertServiceProcessDetails(
  serviceId: string,
  data: {
    processes?: Array<{
      step_number: number;
      title: string;
      description?: string;
      icon?: string;
      estimated_minutes?: number;
      is_required?: boolean;
    }>;
    coverPromises?: Array<{
      title: string;
      description?: string;
      icon?: string;
    }>;
    faqs?: Array<{
      question: string;
      answer: string;
    }>;
    includes?: Array<{
      item: string;
      description?: string;
    }>;
    excludes?: Array<{
      item: string;
      description?: string;
    }>;
  }
): Promise<ServiceProcessDetails> {
  const results = await Promise.all([
    data.processes
      ? upsertServiceProcesses(serviceId, data.processes)
      : getServiceProcesses(serviceId),
    data.coverPromises
      ? upsertCoverPromises(serviceId, data.coverPromises)
      : getCoverPromises(serviceId),
    data.faqs
      ? upsertServiceFAQs(serviceId, data.faqs)
      : getServiceFAQs(serviceId),
    data.includes
      ? upsertServiceIncludes(serviceId, data.includes)
      : getServiceIncludes(serviceId),
    data.excludes
      ? upsertServiceExcludes(serviceId, data.excludes)
      : getServiceExcludes(serviceId),
  ]);

  return {
    processes: results[0],
    coverPromises: results[1],
    faqs: results[2],
    includes: results[3],
    excludes: results[4],
  };
}
