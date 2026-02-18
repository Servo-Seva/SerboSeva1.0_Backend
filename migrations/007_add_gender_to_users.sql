-- Migration: add gender to users
alter table users
  add column if not exists gender text;
