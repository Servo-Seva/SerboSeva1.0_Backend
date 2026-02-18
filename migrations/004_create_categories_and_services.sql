-- Create categories, services and mapping table
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists category_services (
  category_id uuid references categories(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  primary key (category_id, service_id)
);

-- optional indexes for faster counts/queries
create index if not exists idx_services_is_active on services(is_active);
create index if not exists idx_category_services_category on category_services(category_id);
