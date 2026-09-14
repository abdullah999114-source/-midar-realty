-- Already applied to the live MIDAR Supabase project.
alter table public.properties
  add column if not exists offer_type text not null default 'sale' check (offer_type in ('sale','rent')),
  add column if not exists deal_status text not null default 'available' check (deal_status in ('available','reserved','sold','rented','inactive')),
  add column if not exists negotiable boolean not null default false,
  add column if not exists frontage text,
  add column if not exists street_width numeric,
  add column if not exists short_description text,
  add column if not exists features jsonb not null default '[]'::jsonb,
  add column if not exists bedrooms integer,
  add column if not exists bathrooms integer,
  add column if not exists property_age integer,
  add column if not exists elevator boolean,
  add column if not exists parking integer,
  add column if not exists primary_image text;
create table if not exists public.property_private (
  property_id uuid primary key references public.properties(id) on delete cascade,
  owner_name text, owner_phone text, internal_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.property_private enable row level security;
