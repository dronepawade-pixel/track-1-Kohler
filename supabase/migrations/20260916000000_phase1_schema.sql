-- Phase 1 schema: profiles, verified product catalog, saved designs.
-- Data rule: unknown specs stay NULL. Never invent SKUs, prices, dimensions.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists products (
  sku text primary key,
  name text not null,
  category text not null check (category in ('Showers','Bathtubs','Basins','Smart Toilets','Faucets','Mirrors')),
  collection text,
  region text default 'IN',
  finish text,
  dimensions text,
  price_inr integer check (price_inr is null or price_inr >= 0),
  official_url text,
  image_urls text[] default '{}',
  source text default 'studiokohler.com',
  verified_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists design_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null default 'Untitled bathroom',
  room_length_m numeric, room_width_m numeric, room_height_m numeric,
  budget_inr integer,
  style text,
  requirements text,
  is_public boolean default false,
  created_at timestamptz default now()
);

create table if not exists design_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references design_projects(id) on delete cascade,
  version_no integer not null default 1,
  layout_json jsonb not null default '{}',
  created_at timestamptz default now(),
  unique(project_id, version_no)
);

create table if not exists design_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references design_versions(id) on delete cascade,
  sku text references products(sku),
  x_m numeric, y_m numeric, rotation_deg integer default 0,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table products enable row level security;
alter table design_projects enable row level security;
alter table design_versions enable row level security;
alter table design_items enable row level security;

drop policy if exists "products readable by all" on products;
create policy "products readable by all" on products for select using (true);

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own projects" on design_projects;
create policy "own projects" on design_projects for all
  using (auth.uid() = owner_id or is_public) with check (auth.uid() = owner_id);

drop policy if exists "versions via project" on design_versions;
create policy "versions via project" on design_versions for all
  using (exists (select 1 from design_projects p where p.id = project_id and (p.owner_id = auth.uid() or p.is_public)))
  with check (exists (select 1 from design_projects p where p.id = project_id and p.owner_id = auth.uid()));

drop policy if exists "items via project" on design_items;
create policy "items via project" on design_items for all
  using (exists (select 1 from design_versions v join design_projects p on p.id = v.project_id where v.id = version_id and (p.owner_id = auth.uid() or p.is_public)))
  with check (exists (select 1 from design_versions v join design_projects p on p.id = v.project_id where v.id = version_id and p.owner_id = auth.uid()));

-- Seed: structure placeholders only — real rows arrive via studiokohler.com verification.
insert into products (sku, name, category) values
  ('PENDING-001','Rainshower — verification pending','Showers'),
  ('PENDING-002','Freestanding bathtub — verification pending','Bathtubs'),
  ('PENDING-003','Vessel basin — verification pending','Basins'),
  ('PENDING-004','Wall-hung smart toilet — verification pending','Smart Toilets'),
  ('PENDING-005','Single-control faucet — verification pending','Faucets'),
  ('PENDING-006','Lighted mirror — verification pending','Mirrors')
on conflict (sku) do nothing;
