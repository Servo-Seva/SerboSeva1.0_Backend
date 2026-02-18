import sql from "../db";

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  created_at: string;
  service_count?: number;
};

export type Service = {
  id: string;
  name: string;
  description?: string | null;
  base_price?: string | null;
  price?: string | null;
  is_active: boolean;
  created_at: string;
  avg_rating?: number;
  reviews_count?: number;
  duration_minutes?: number;
  thumbnail_url?: string | null;
  currency?: string | null;
};

export async function ensureCategoriesTables() {
  // migrations should normally create these; this is a safety-net when called from APIs
  await sql`create extension if not exists pgcrypto`;
  await sql`
    create table if not exists categories (
      id uuid primary key default gen_random_uuid(),
      name text not null unique,
      description text,
      image_url text,
      created_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists services (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      description text,
      price numeric,
      is_active boolean default true,
      created_at timestamptz default now()
    )
  `;

  await sql`
    create table if not exists category_services (
      category_id uuid references categories(id) on delete cascade,
      service_id uuid references services(id) on delete cascade,
      primary key (category_id, service_id)
    )
  `;
}

export async function listCategoriesWithCounts(): Promise<Category[]> {
  // ensure tables exist as a precaution
  await ensureCategoriesTables();

  const rows = await sql`
    select c.id, c.name, c.description, c.image_url, c.created_at,
      coalesce(count(s.id) filter (where s.is_active), 0) as service_count
    from categories c
    left join category_services cs on cs.category_id = c.id
    left join services s on s.id = cs.service_id
    group by c.id
    order by c.name
  `;

  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    image_url: r.image_url,
    created_at: r.created_at,
    service_count: Number(r.service_count || 0),
  }));
}

export async function getServicesByCategory(
  categoryId: string,
): Promise<Service[]> {
  await ensureCategoriesTables();

  const rows = await sql`
    select s.id, s.name, s.description, s.price, s.is_active, s.created_at
    from services s
    join category_services cs on cs.service_id = s.id
    where cs.category_id = ${categoryId} and s.is_active = true
    order by s.name
  `;

  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
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

export async function getServiceById(
  serviceId: string,
): Promise<Service | null> {
  try {
    const rows = await sql`
      select id, name, description, base_price, price, is_active, created_at, avg_rating, reviews_count, duration_minutes, thumbnail_url, currency
      from services where id = ${serviceId}
    `;
    if (rows.length === 0) return null;
    const r: any = rows[0];
    return {
      id: r.id,
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
    };
  } catch (err) {
    console.warn(
      "getServiceById full query failed, falling back to basic columns",
      err,
    );
    // Fallback: select only basic columns
    const rows = await sql`
      select id, name, description, price, is_active, created_at from services where id = ${serviceId}
    `;
    if (rows.length === 0) return null;
    const r: any = rows[0];
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price ? String(r.price) : null,
      is_active: !!r.is_active,
      created_at: r.created_at,
      avg_rating: 0,
      reviews_count: 0,
    };
  }
}

export async function getPopularServices(limit = 10): Promise<Service[]> {
  try {
    const rows = await sql`
      select 
        s.id, s.name, s.description, s.base_price, s.price, s.is_active, s.created_at, 
        s.avg_rating, s.reviews_count, s.duration_minutes, s.thumbnail_url, s.currency,
        sub.id as subcategory_id, sub.name as subcategory_name,
        c.id as category_id, c.name as category_name
      from services s
      left join subcategories sub on s.subcategory_id = sub.id
      left join categories c on sub.category_id = c.id
      where s.is_active = true
      order by s.reviews_count desc, s.avg_rating desc
      limit ${limit}
    `;
    return rows.map((r: any) => ({
      id: r.id,
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
      subcategory_id: r.subcategory_id || null,
      subcategory_name: r.subcategory_name || null,
      category_id: r.category_id || null,
      category_name: r.category_name || null,
    }));
  } catch (err) {
    console.warn(
      "Optimized getPopularServices failed (likely missing columns), falling back to simple query",
      err,
    );
    // Fallback if migrations haven't run: select only basic columns that definitely exist
    try {
      const rows = await sql`
        select id, name, description, price, is_active, created_at
        from services
        where is_active = true
        limit ${limit}
      `;
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        price: r.price ? String(r.price) : null,
        is_active: !!r.is_active,
        created_at: r.created_at,
        avg_rating: 4.5, // Default mock rating
        reviews_count: 0,
        duration_minutes: 60,
        thumbnail_url: null,
        currency: "INR",
      }));
    } catch (fallbackErr) {
      console.error("Even fallback getPopularServices failed:", fallbackErr);
      return [];
    }
  }
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const rows = await sql`
    select id, name, description, created_at from categories where id = ${id}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    created_at: r.created_at,
  };
}

export async function createCategory(name: string, description?: string) {
  const desc = typeof description === "undefined" ? null : description;
  const rows = await sql`
    insert into categories (name, description) values (${name}, ${desc}) returning id, name, description, created_at
  `;
  return rows[0];
}

export async function createService(
  name: string,
  description?: string,
  price?: number,
) {
  const desc = typeof description === "undefined" ? null : description;
  const p = typeof price === "undefined" ? null : price;
  const rows = await sql`
    insert into services (name, description, price) values (${name}, ${desc}, ${p}) returning id, name, description, price, is_active, created_at
  `;
  return rows[0];
}

export async function mapServiceToCategory(
  categoryId: string,
  serviceId: string,
) {
  await sql`
    insert into category_services (category_id, service_id) values (${categoryId}, ${serviceId}) on conflict do nothing
  `;
}
