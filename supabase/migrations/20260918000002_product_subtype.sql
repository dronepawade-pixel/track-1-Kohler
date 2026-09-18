-- Catalog sub-types (Kohler shop taxonomy). Products link to a subtype only
-- after verification; subtype stays NULL until then — never assumed.

alter table products add column if not exists subtype text;
