import sql from "../db";

// ============== TYPES ==============

export type Subcategory = {
  id: string;
  category_id: string;
  name: string;
  icon: string | null;
  image_url: string | null;
  created_at: string;
};

export type SubcategoryWithCategory = Subcategory & {
  category_name?: string;
};

// ============== QUERIES ==============

/**
 * Create a new subcategory
 */
export async function createSubcategory(
  categoryId: string,
  name: string,
  icon?: string,
  image_url?: string,
): Promise<Subcategory> {
  const rows = await sql`
    INSERT INTO subcategories (category_id, name, icon, image_url)
    VALUES (${categoryId}, ${name}, ${icon || null}, ${image_url || null})
    RETURNING id, category_id, name, icon, image_url, created_at
  `;
  return rows[0] as Subcategory;
}

/**
 * Get all subcategories for a category
 */
export async function getSubcategoriesByCategoryId(
  categoryId: string,
): Promise<Subcategory[]> {
  const rows = await sql`
    SELECT id, category_id, name, icon, image_url, created_at
    FROM subcategories
    WHERE category_id = ${categoryId}
    ORDER BY name
  `;
  return rows.map((r: any) => ({
    id: r.id,
    category_id: r.category_id,
    name: r.name,
    icon: r.icon,
    image_url: r.image_url,
    created_at: r.created_at,
  }));
}

/**
 * Get subcategory by ID
 */
export async function getSubcategoryById(
  id: string,
): Promise<Subcategory | null> {
  const rows = await sql`
    SELECT id, category_id, name, icon, image_url, created_at
    FROM subcategories
    WHERE id = ${id}
  `;
  return rows.length > 0 ? (rows[0] as Subcategory) : null;
}

/**
 * Get all subcategories with category name
 */
export async function getAllSubcategories(): Promise<
  SubcategoryWithCategory[]
> {
  const rows = await sql`
    SELECT s.id, s.category_id, s.name, s.icon, s.image_url, s.created_at, c.name as category_name
    FROM subcategories s
    JOIN categories c ON c.id = s.category_id
    ORDER BY c.name, s.name
  `;
  return rows.map((r: any) => ({
    id: r.id,
    category_id: r.category_id,
    name: r.name,
    icon: r.icon,
    image_url: r.image_url,
    created_at: r.created_at,
    category_name: r.category_name,
  }));
}

/**
 * Update subcategory
 */
export async function updateSubcategory(
  id: string,
  data: {
    name?: string;
    icon?: string;
    image_url?: string;
    category_id?: string;
  },
): Promise<Subcategory | null> {
  const updates: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    updates.push("name");
    values.push(data.name);
  }
  if (data.icon !== undefined) {
    updates.push("icon");
    values.push(data.icon);
  }
  if (data.image_url !== undefined) {
    updates.push("image_url");
    values.push(data.image_url);
  }
  if (data.category_id !== undefined) {
    updates.push("category_id");
    values.push(data.category_id);
  }

  if (updates.length === 0) return getSubcategoryById(id);

  // Build dynamic update query
  const rows = await sql`
    UPDATE subcategories
    SET ${sql(
      updates.reduce(
        (acc, key, i) => {
          acc[key] = values[i];
          return acc;
        },
        {} as Record<string, any>,
      ),
    )}
    WHERE id = ${id}
    RETURNING id, category_id, name, icon, image_url, created_at
  `;

  return rows.length > 0 ? (rows[0] as Subcategory) : null;
}

/**
 * Delete subcategory
 */
export async function deleteSubcategory(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM subcategories WHERE id = ${id}
  `;
  return result.count > 0;
}

/**
 * Check if subcategory exists by name in category
 */
export async function subcategoryExistsByName(
  categoryId: string,
  name: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM subcategories
    WHERE category_id = ${categoryId} AND LOWER(name) = LOWER(${name})
    LIMIT 1
  `;
  return rows.length > 0;
}
