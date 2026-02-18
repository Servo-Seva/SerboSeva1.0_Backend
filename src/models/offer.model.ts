import sql from "../db";

export interface Offer {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  bg_color: string;
  text_color: string;
  link_to: string;
  is_active: boolean;
  display_order: number;
  category_id?: string;
  start_date?: Date;
  end_date?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface OfferResponse {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  bgColor: string;
  textColor: string;
  linkTo: string;
  isActive: boolean;
  displayOrder: number;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
}

export interface ServiceResponse {
  id: string;
  name: string;
  description?: string;
  price: string;
  basePrice: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  avgRating?: number;
  reviewsCount?: number;
  subcategoryName?: string;
  categoryName?: string;
}

// Transform database record to API response format
function transformOffer(offer: Offer): OfferResponse {
  return {
    id: offer.id,
    title: offer.title,
    subtitle: offer.subtitle,
    image: offer.image_url,
    bgColor: offer.bg_color,
    textColor: offer.text_color,
    linkTo: offer.link_to,
    isActive: offer.is_active,
    displayOrder: offer.display_order,
    categoryId: offer.category_id,
    startDate: offer.start_date?.toISOString(),
    endDate: offer.end_date?.toISOString(),
    createdAt: offer.created_at?.toISOString(),
  };
}

// Get all active offers (for public API)
export async function getActiveOffers(): Promise<OfferResponse[]> {
  const now = new Date().toISOString();

  const offers = await sql<Offer[]>`
    SELECT * FROM offers 
    WHERE is_active = true
      AND (start_date IS NULL OR start_date <= ${now})
      AND (end_date IS NULL OR end_date >= ${now})
    ORDER BY display_order ASC
  `;

  return offers.map(transformOffer);
}

// Get all offers (for admin)
export async function getAllOffers(): Promise<OfferResponse[]> {
  const offers = await sql<Offer[]>`
    SELECT * FROM offers 
    ORDER BY display_order ASC
  `;

  return offers.map(transformOffer);
}

// Get offer by ID
export async function getOfferById(id: string): Promise<OfferResponse | null> {
  const offers = await sql<Offer[]>`
    SELECT * FROM offers WHERE id = ${id}
  `;

  if (offers.length === 0) return null;
  return transformOffer(offers[0]);
}

// Create new offer (admin)
export async function createOffer(data: {
  title: string;
  subtitle: string;
  image_url: string;
  bg_color?: string;
  text_color?: string;
  link_to?: string;
  is_active?: boolean;
  display_order?: number;
  start_date?: string;
  end_date?: string;
}): Promise<OfferResponse> {
  const offers = await sql<Offer[]>`
    INSERT INTO offers (
      title, 
      subtitle, 
      image_url, 
      bg_color, 
      text_color, 
      link_to, 
      is_active, 
      display_order,
      start_date,
      end_date
    ) VALUES (
      ${data.title},
      ${data.subtitle},
      ${data.image_url},
      ${data.bg_color || "bg-gradient-to-br from-slate-100 to-slate-50"},
      ${data.text_color || "text-gray-900"},
      ${data.link_to || "/services"},
      ${data.is_active ?? true},
      ${data.display_order ?? 0},
      ${data.start_date || null},
      ${data.end_date || null}
    )
    RETURNING *
  `;

  return transformOffer(offers[0]);
}

// Update offer (admin)
export async function updateOffer(
  id: string,
  data: Partial<{
    title: string;
    subtitle: string;
    image_url: string;
    bg_color: string;
    text_color: string;
    link_to: string;
    is_active: boolean;
    display_order: number;
    start_date: string | null;
    end_date: string | null;
  }>,
): Promise<OfferResponse | null> {
  const offers = await sql<Offer[]>`
    UPDATE offers SET
      title = COALESCE(${data.title ?? null}, title),
      subtitle = COALESCE(${data.subtitle ?? null}, subtitle),
      image_url = COALESCE(${data.image_url ?? null}, image_url),
      bg_color = COALESCE(${data.bg_color ?? null}, bg_color),
      text_color = COALESCE(${data.text_color ?? null}, text_color),
      link_to = COALESCE(${data.link_to ?? null}, link_to),
      is_active = COALESCE(${data.is_active ?? null}, is_active),
      display_order = COALESCE(${data.display_order ?? null}, display_order),
      start_date = ${data.start_date === null ? null : (data.start_date ?? null)},
      end_date = ${data.end_date === null ? null : (data.end_date ?? null)},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (offers.length === 0) return null;
  return transformOffer(offers[0]);
}

// Delete offer (admin)
export async function deleteOffer(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM offers WHERE id = ${id}
  `;

  return result.count > 0;
}

// Toggle offer active status
export async function toggleOfferStatus(
  id: string,
): Promise<OfferResponse | null> {
  const offers = await sql<Offer[]>`
    UPDATE offers SET
      is_active = NOT is_active,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (offers.length === 0) return null;
  return transformOffer(offers[0]);
}

// Reorder offers
export async function reorderOffers(
  orderMap: { id: string; order: number }[],
): Promise<void> {
  await sql.begin(async (tx) => {
    for (const item of orderMap) {
      await tx`
        UPDATE offers SET display_order = ${item.order}, updated_at = NOW()
        WHERE id = ${item.id}
      `;
    }
  });
}

// Get offer with related services by category
export async function getOfferWithServices(
  offerId: string,
): Promise<{ offer: OfferResponse; services: ServiceResponse[] } | null> {
  // First get the offer
  const offers = await sql<Offer[]>`
    SELECT * FROM offers WHERE id = ${offerId}
  `;

  if (offers.length === 0) return null;
  const offer = transformOffer(offers[0]);

  // First, try to get services linked via offer_services table
  let services: ServiceResponse[] = [];

  const linkedServices = await sql<any[]>`
    SELECT 
      s.id,
      s.name,
      s.description,
      s.price,
      s.base_price,
      s.thumbnail_url,
      s.duration_minutes,
      s.avg_rating,
      s.reviews_count,
      sub.name as subcategory_name,
      c.name as category_name,
      os.discount_percent
    FROM offer_services os
    JOIN services s ON os.service_id = s.id
    LEFT JOIN subcategories sub ON s.subcategory_id = sub.id
    LEFT JOIN categories c ON sub.category_id = c.id
    WHERE os.offer_id = ${offerId}
      AND s.is_active = true
    ORDER BY os.discount_percent DESC, s.avg_rating DESC NULLS LAST
  `;

  if (linkedServices.length > 0) {
    // Use the linked services
    services = linkedServices.map((s) => {
      // Apply offer-specific discount if present
      const originalPrice =
        parseFloat(s.base_price) || parseFloat(s.price) || 0;
      const discountPercent = s.discount_percent || 0;
      const discountedPrice =
        discountPercent > 0
          ? originalPrice * (1 - discountPercent / 100)
          : parseFloat(s.price) || 0;

      return {
        id: s.id,
        name: s.name,
        description: s.description,
        price: discountedPrice.toFixed(2),
        basePrice: originalPrice.toFixed(2),
        thumbnailUrl: s.thumbnail_url,
        durationMinutes: s.duration_minutes,
        avgRating: s.avg_rating ? parseFloat(s.avg_rating) : undefined,
        reviewsCount: s.reviews_count,
        subcategoryName: s.subcategory_name,
        categoryName: s.category_name,
      };
    });
  } else if (offers[0].category_id) {
    // Fallback: If offer has a category_id, fetch services from that category
    const dbServices = await sql<any[]>`
      SELECT 
        s.id,
        s.name,
        s.description,
        s.price,
        s.base_price,
        s.thumbnail_url,
        s.duration_minutes,
        s.avg_rating,
        s.reviews_count,
        sub.name as subcategory_name,
        c.name as category_name
      FROM services s
      LEFT JOIN subcategories sub ON s.subcategory_id = sub.id
      LEFT JOIN categories c ON sub.category_id = c.id
      WHERE c.id = ${offers[0].category_id}
        AND s.is_active = true
      ORDER BY s.created_at DESC
      LIMIT 12
    `;

    services = dbServices.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price?.toString() || s.base_price?.toString() || "0",
      basePrice: s.base_price?.toString() || "0",
      thumbnailUrl: s.thumbnail_url,
      durationMinutes: s.duration_minutes,
      avgRating: s.avg_rating ? parseFloat(s.avg_rating) : undefined,
      reviewsCount: s.reviews_count,
      subcategoryName: s.subcategory_name,
      categoryName: s.category_name,
    }));
  } else {
    // Fallback: If no category_id and no linked services, return popular/featured services
    const dbServices = await sql<any[]>`
      SELECT 
        s.id,
        s.name,
        s.description,
        s.price,
        s.base_price,
        s.thumbnail_url,
        s.duration_minutes,
        s.avg_rating,
        s.reviews_count,
        sub.name as subcategory_name,
        c.name as category_name
      FROM services s
      LEFT JOIN subcategories sub ON s.subcategory_id = sub.id
      LEFT JOIN categories c ON sub.category_id = c.id
      WHERE s.is_active = true
      ORDER BY s.avg_rating DESC NULLS LAST, s.reviews_count DESC NULLS LAST
      LIMIT 12
    `;

    services = dbServices.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price?.toString() || s.base_price?.toString() || "0",
      basePrice: s.base_price?.toString() || "0",
      thumbnailUrl: s.thumbnail_url,
      durationMinutes: s.duration_minutes,
      avgRating: s.avg_rating ? parseFloat(s.avg_rating) : undefined,
      reviewsCount: s.reviews_count,
      subcategoryName: s.subcategory_name,
      categoryName: s.category_name,
    }));
  }

  return { offer, services };
}

// Featured Deal response type with tag info
export interface FeaturedDealResponse extends ServiceResponse {
  discountPercent: number;
  tag: string;
  tagColor: string;
}

// Get featured deals from the featured_deals table
export async function getFeaturedDeals(limit = 6): Promise<FeaturedDealResponse[]> {
  const deals = await sql<any[]>`
    SELECT 
      s.id,
      s.name,
      s.description,
      s.price,
      s.base_price,
      s.thumbnail_url,
      s.duration_minutes,
      s.avg_rating,
      s.reviews_count,
      sub.name as subcategory_name,
      c.name as category_name,
      fd.discount_percent,
      fd.tag,
      fd.tag_color
    FROM featured_deals fd
    JOIN services s ON fd.service_id = s.id
    LEFT JOIN subcategories sub ON s.subcategory_id = sub.id
    LEFT JOIN categories c ON sub.category_id = c.id
    WHERE fd.is_active = true
      AND s.is_active = true
      AND (fd.start_date IS NULL OR fd.start_date <= NOW())
      AND (fd.end_date IS NULL OR fd.end_date >= NOW())
    ORDER BY fd.display_order ASC, fd.discount_percent DESC
    LIMIT ${limit}
  `;

  return deals.map((s) => {
    const originalPrice = parseFloat(s.base_price) || parseFloat(s.price) || 0;
    const discountPercent = s.discount_percent || 0;
    const discountedPrice = discountPercent > 0 
      ? originalPrice * (1 - discountPercent / 100)
      : parseFloat(s.price) || 0;

    return {
      id: s.id,
      name: s.name,
      description: s.description,
      price: discountedPrice.toFixed(2),
      basePrice: originalPrice.toFixed(2),
      thumbnailUrl: s.thumbnail_url,
      durationMinutes: s.duration_minutes,
      avgRating: s.avg_rating ? parseFloat(s.avg_rating) : undefined,
      reviewsCount: s.reviews_count,
      subcategoryName: s.subcategory_name,
      categoryName: s.category_name,
      discountPercent: discountPercent,
      tag: s.tag || `${discountPercent}% OFF`,
      tagColor: s.tag_color || 'bg-blue-500',
    };
  });
}
