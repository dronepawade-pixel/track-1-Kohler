-- Kohler sells no mirrors: drop the placeholder mirror row from the catalog.
-- The category check in the Phase 1 migration is left untouched (applied
-- migrations are never rewritten); nothing inserts 'Mirrors' any more.

delete from products where sku = 'PENDING-006';
