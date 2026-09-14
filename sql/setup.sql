-- MIDAR CONTROL CENTER - Supabase setup
-- نفّذ هذا الملف مرة واحدة في Supabase SQL Editor.

create extension if not exists pgcrypto;

create sequence if not exists midar_property_seq start 1003;

create or replace function public.generate_midar_reference()
returns text language sql volatile as $$
  select 'MIDAR-' || nextval('midar_property_seq')::text;
$$;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null default public.generate_midar_reference(),
  type text not null check (type in ('land','villa','chalet','investment','commercial')),
  title text not null,
  city text default 'بريدة',
  district text,
  area numeric,
  price numeric not null default 0,
  street text,
  description text,
  map_url text,
  images jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('published','draft','archived')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text not null,
  lead_type text,
  message text,
  source text default 'website',
  status text default 'new',
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

drop trigger if exists trg_properties_updated on public.properties;
create trigger trg_properties_updated before update on public.properties
for each row execute function public.set_updated_at();

alter table public.properties enable row level security;
alter table public.leads enable row level security;

drop policy if exists "Public can read published properties" on public.properties;
create policy "Public can read published properties" on public.properties
for select using (status='published' or auth.role()='authenticated');

drop policy if exists "Authenticated can manage properties" on public.properties;
create policy "Authenticated can manage properties" on public.properties
for all to authenticated using (true) with check (true);

drop policy if exists "Public can create leads" on public.leads;
create policy "Public can create leads" on public.leads
for insert to anon, authenticated with check (true);

drop policy if exists "Authenticated can read leads" on public.leads;
create policy "Authenticated can read leads" on public.leads
for select to authenticated using (true);

insert into storage.buckets (id,name,public)
values ('property-images','property-images',true)
on conflict (id) do update set public=true;

drop policy if exists "Public property images" on storage.objects;
create policy "Public property images" on storage.objects for select
using (bucket_id='property-images');

drop policy if exists "Authenticated upload property images" on storage.objects;
create policy "Authenticated upload property images" on storage.objects for insert to authenticated
with check (bucket_id='property-images');

drop policy if exists "Authenticated update property images" on storage.objects;
create policy "Authenticated update property images" on storage.objects for update to authenticated
using (bucket_id='property-images') with check (bucket_id='property-images');

drop policy if exists "Authenticated delete property images" on storage.objects;
create policy "Authenticated delete property images" on storage.objects for delete to authenticated
using (bucket_id='property-images');

-- Seed current MIDAR offers if they do not exist.
insert into public.properties(reference,type,title,city,district,area,price,street,description,map_url,images,status,featured)
values
('MIDAR-1001','land','أرض سكنية – حي النور، بريدة','بريدة','حي النور',448,336000,'15 م','أرض سكنية في شمال بريدة بحي النور، مناسبة للبناء السكني.','https://maps.app.goo.gl/79MEA7vCVWJdNhFWA','[]'::jsonb,'published',false),
('MIDAR-1002','villa','فيلا فندقية فاخرة – حي الرحاب، بريدة','بريدة','حي الرحاب',370,1900000,'جنوبي 25 م','تشطيب فاخر، بناء شخصي بإشراف هندسي، مصعد، تكييف كامل وواجهة رخام ترافنتينو.','https://maps.app.goo.gl/HjJbaTfY7QN124DE6?g_st=iw','["/properties/midar-1002/villa-1.jpeg","/properties/midar-1002/villa-2.jpeg","/properties/midar-1002/villa-3.jpeg"]'::jsonb,'published',true)
on conflict (reference) do nothing;
