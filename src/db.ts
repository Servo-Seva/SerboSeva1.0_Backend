import postgres from "postgres";
import fs from "fs";
import path from "path";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
});

export default sql;

// 🔍 Explicit DB connection check
export async function connectDB() {
  await sql`select 1`;
  // apply migrations on connect
  await applyMigrations();
}

async function ensureMigrationsTable() {
  await sql`
    create table if not exists migrations_applied (
      id serial primary key,
      filename text unique not null,
      applied_at timestamptz default now()
    )
  `;
}

async function applyMigrations() {
  const migrationsDir = path.join(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  await ensureMigrationsTable();

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const already = await sql`
      select 1 from migrations_applied where filename = ${file}
    `;
    if (already.length > 0) continue;

    const sqlText = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    // execute migration
    await sql.begin(async (tx) => {
      await tx.unsafe(sqlText);
      await tx`
        insert into migrations_applied (filename) values (${file})
      `;
    });
  }
}
