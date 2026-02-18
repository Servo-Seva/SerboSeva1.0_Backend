-- Add extra fields to services for UI (rating, reviews count, duration, thumbnail, currency)
alter table services
  add column if not exists avg_rating numeric default 0,
  add column if not exists reviews_count integer default 0,
  add column if not exists duration_minutes integer default 60,
  add column if not exists thumbnail_url text,
  add column if not exists currency text default 'INR';

create index if not exists idx_services_reviews_count on services(reviews_count desc);
create index if not exists idx_services_avg_rating on services(avg_rating desc);
