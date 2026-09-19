-- Catalog asset columns for the AI bundle + auto-layout pipeline.
-- Mirrors docs/AI_IMPLEMENTATION.md §REQUIREMENTS.1. NULL = Unknown/pending,
-- never invented. style_tags are LOCAL matching tags, not official taxonomy.
-- Applied migrations are never rewritten, so the Phase 1 category check is
-- dropped + recreated with Vanities included.

alter table products add column if not exists width_mm integer
  check (width_mm is null or width_mm > 0);
alter table products add column if not exists depth_mm integer
  check (depth_mm is null or depth_mm > 0);
alter table products add column if not exists height_mm integer
  check (height_mm is null or height_mm > 0);
alter table products add column if not exists style_tags text[] default '{}';
alter table products add column if not exists model_glb_url text;
alter table products add column if not exists footprint_svg text;
alter table products add column if not exists dwg_url text;

alter table products drop constraint if exists products_category_check;
alter table products add constraint products_category_check
  check (category in ('Showers','Bathtubs','Basins','Smart Toilets','Faucets','Mirrors','Vanities'));
