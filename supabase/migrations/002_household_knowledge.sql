create table household_knowledge (
  id          uuid        primary key default gen_random_uuid(),
  category    text        not null,  -- 'paint', 'appliance', 'vehicle', 'kids', 'network', 'contacts', etc.
  item        text        not null,  -- 'Living Room', 'Dishwasher', 'Honda CRV'
  key         text        not null,  -- 'color', 'model', 'wifi_password', 'shoe_size'
  value       text        not null,  -- 'Benjamin Moore Hail Navy', 'Bosch SHX78', etc.
  notes       text,                  -- any extra context
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index household_knowledge_category_idx on household_knowledge (category);
create index household_knowledge_item_idx on household_knowledge (item);
create index household_knowledge_created_at_idx on household_knowledge (created_at desc);

-- Auto-update updated_at on row changes
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger household_knowledge_updated_at
  before update on household_knowledge
  for each row execute function update_updated_at();
