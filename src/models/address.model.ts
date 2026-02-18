import sql from "../db";

export type Address = {
  id: string;
  user_id: string;
  country: string;
  state: string;
  full_name: string;
  mobile_number: string;
  flat_building: string;
  area_locality: string;
  line1?: string | null; // legacy, auto-composed
  landmark?: string | null;
  pincode: string;
  city: string;
  alt_phone?: string | null;
  address_type?: string | null; // 'home' | 'work'
  is_primary?: boolean;
  created_at: string;
};

// Ensure addresses table exists. Idempotent.
export async function ensureAddressesTable() {
  // create extension if available
  try {
    await sql`
      create extension if not exists pgcrypto;
    `;
  } catch (e) {
    // ignore if not permitted
  }

  await sql`
    create table if not exists addresses (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      country text not null,
      state text not null,
      full_name text not null,
      mobile_number text not null,
      line1 text not null,
      landmark text,
      pincode text not null,
      city text not null,
      is_primary boolean default false,
      created_at timestamptz default now()
    );
  `;
}

export async function createAddress(
  userId: string,
  data: Omit<Address, "id" | "user_id" | "created_at"> & {
    is_primary?: boolean;
  },
) {
  await ensureAddressesTable();

  // Check for duplicate address (same user, flat_building, area_locality, pincode, city)
  const fb = data.flat_building || "";
  const al = data.area_locality || "";
  const composedLine1 = [fb, al].filter(Boolean).join(", ");
  const [existing] = await sql`
    select * from addresses
    where user_id = ${userId}
      and lower(trim(coalesce(flat_building,''))) = lower(trim(${fb}))
      and lower(trim(coalesce(area_locality,''))) = lower(trim(${al}))
      and trim(pincode) = trim(${data.pincode})
      and lower(trim(city)) = lower(trim(${data.city}))
    limit 1
  `;
  if (existing) {
    return existing as Address;
  }

  // If is_primary is requested, we need to unset other primaries. Use a transaction.
  if (data.is_primary) {
    const address = await sql.begin(async (tx) => {
      await tx`
        update addresses
        set is_primary = false
        where user_id = ${userId} and is_primary = true
      `;

      const [a] = await tx`
        insert into addresses
          (user_id, country, state, full_name, mobile_number, flat_building, area_locality, line1, landmark, pincode, city, alt_phone, address_type, is_primary)
        values (
          ${userId},
          ${data.country},
          ${data.state},
          ${data.full_name},
          ${data.mobile_number},
          ${fb},
          ${al},
          ${composedLine1},
          ${data.landmark ?? null},
          ${data.pincode},
          ${data.city},
          ${data.alt_phone ?? null},
          ${data.address_type ?? "home"},
          true
        )
        returning *
      `;

      return a;
    });

    return address as Address;
  }

  const [address] = await sql`
    insert into addresses
      (user_id, country, state, full_name, mobile_number, flat_building, area_locality, line1, landmark, pincode, city, alt_phone, address_type)
    values (
      ${userId},
      ${data.country},
      ${data.state},
      ${data.full_name},
      ${data.mobile_number},
      ${fb},
      ${al},
      ${composedLine1},
      ${data.landmark ?? null},
      ${data.pincode},
      ${data.city},
      ${data.alt_phone ?? null},
      ${data.address_type ?? "home"}
    )
    returning *
  `;

  return address as Address;
}

export async function findAddressesByUser(userId: string) {
  const rows = await sql`
    select id, user_id, country, state, full_name, mobile_number, flat_building, area_locality, line1, landmark, pincode, city, alt_phone, address_type, is_primary, created_at
    from addresses
    where user_id = ${userId}
    order by is_primary desc, created_at desc
  `;

  return rows as unknown as Address[];
}

export async function findAddressById(addressId: string) {
  const [addr] = await sql`
    select id, user_id, country, state, full_name, mobile_number, flat_building, area_locality, line1, landmark, pincode, city, alt_phone, address_type, is_primary, created_at
    from addresses
    where id = ${addressId}
  `;
  return addr as Address | null;
}

export async function updateAddress(
  addressId: string,
  data: Partial<Omit<Address, "id" | "user_id" | "created_at">>,
) {
  // If is_primary is being set to true, unset other primaries for the user (in a transaction)
  if (data.is_primary === true) {
    const updated = await sql.begin(async (tx) => {
      // find user_id for address
      const [row] = await tx`
        select user_id
        from addresses
        where id = ${addressId}
      `;

      const userId = row?.user_id;
      if (!userId) return null;

      await tx`
        update addresses
        set is_primary = false
        where user_id = ${userId} and is_primary = true
      `;

      const [u] = await tx`
        update addresses
        set
          country = coalesce(${data.country ?? null}, country),
          state = coalesce(${data.state ?? null}, state),
          full_name = coalesce(${data.full_name ?? null}, full_name),
          mobile_number = coalesce(${data.mobile_number ?? null}, mobile_number),
          flat_building = coalesce(${data.flat_building ?? null}, flat_building),
          area_locality = coalesce(${data.area_locality ?? null}, area_locality),
          line1 = coalesce(${data.line1 ?? null}, line1),
          landmark = coalesce(${data.landmark ?? null}, landmark),
          pincode = coalesce(${data.pincode ?? null}, pincode),
          city = coalesce(${data.city ?? null}, city),
          alt_phone = coalesce(${data.alt_phone ?? null}, alt_phone),
          address_type = coalesce(${data.address_type ?? null}, address_type),
          is_primary = true
        where id = ${addressId}
        returning *
      `;

      return u;
    });

    return updated as Address | null;
  }

  const [updated] = await sql`
    update addresses
    set
      country = coalesce(${data.country ?? null}, country),
      state = coalesce(${data.state ?? null}, state),
      full_name = coalesce(${data.full_name ?? null}, full_name),
      mobile_number = coalesce(${data.mobile_number ?? null}, mobile_number),
      flat_building = coalesce(${data.flat_building ?? null}, flat_building),
      area_locality = coalesce(${data.area_locality ?? null}, area_locality),
      line1 = coalesce(${data.line1 ?? null}, line1),
      landmark = coalesce(${data.landmark ?? null}, landmark),
      pincode = coalesce(${data.pincode ?? null}, pincode),
      city = coalesce(${data.city ?? null}, city),
      alt_phone = coalesce(${data.alt_phone ?? null}, alt_phone),
      address_type = coalesce(${data.address_type ?? null}, address_type)
    where id = ${addressId}
    returning *
  `;

  return updated as Address | null;
}

export async function setPrimaryAddress(userId: string, addressId: string) {
  const updated = await sql.begin(async (tx) => {
    await tx`
      update addresses
      set is_primary = false
      where user_id = ${userId} and is_primary = true
    `;

    const [u] = await tx`
      update addresses
      set is_primary = true
      where id = ${addressId} and user_id = ${userId}
      returning *
    `;

    return u;
  });

  return updated as Address | null;
}

export async function deleteAddress(addressId: string) {
  await sql`
    delete from addresses
    where id = ${addressId}
  `;
}
