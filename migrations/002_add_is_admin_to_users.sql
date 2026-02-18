-- Migration: add is_admin flag to users
alter table users
  add column if not exists is_admin boolean default false;
