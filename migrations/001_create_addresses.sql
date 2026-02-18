-- Migration: create addresses table

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
