import sql from "../db";

export async function findUserByFirebaseUid(firebaseUid: string) {
  const users = await sql`
    select id, firebase_uid, phone, name, email, gender, is_admin, created_at
    from users
    where firebase_uid = ${firebaseUid}
  `;
  return users[0] ?? null;
}

export async function createUser(
  firebaseUid: string,
  phone?: string,
  email?: string,
  name?: string
) {
  const [user] = await sql`
    insert into users (firebase_uid, phone, email, name)
    values (${firebaseUid}, ${phone ?? null}, ${email ?? null}, ${name ?? null})
    returning id, firebase_uid, phone, name, email, gender, is_admin, created_at
  `;
  return user;
}
export async function findUserById(userId: string) {
  const users = await sql`
    select id, phone, name, email, gender, is_admin, created_at
    from users
    where id = ${userId}
  `;

  return users[0] ?? null;
}

export async function updateUser(
  userId: string,
  data: { name?: string; email?: string; phone?: string; gender?: string }
) {
  // Use COALESCE to only update fields that are provided (undefined -> null -> keep existing)
  const [updated] = await sql`
    update users
    set
      name = coalesce(${data.name ?? null}, name),
      email = coalesce(${data.email ?? null}, email),
      phone = coalesce(${data.phone ?? null}, phone),
      gender = coalesce(${data.gender ?? null}, gender)
    where id = ${userId}
    returning id, phone, name, email, gender, created_at
  `;

  return updated ?? null;
}
