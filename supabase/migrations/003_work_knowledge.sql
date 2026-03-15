create table work_knowledge (
  id          uuid        primary key default gen_random_uuid(),
  category    text        not null,  -- 'process', 'system', 'contact', 'policy', 'project', etc.
  item        text        not null,  -- 'Onboarding', 'CRM', 'John Smith', 'Expense Policy'
  key         text        not null,  -- 'steps', 'login_url', 'email', 'limit'
  value       text        not null,  -- the actual fact/value
  notes       text,                  -- any extra context
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index work_knowledge_category_idx on work_knowledge (category);
create index work_knowledge_item_idx on work_knowledge (item);
create index work_knowledge_created_at_idx on work_knowledge (created_at desc);

-- Reuse update_updated_at() trigger function from 002_household_knowledge.sql
create trigger work_knowledge_updated_at
  before update on work_knowledge
  for each row execute function update_updated_at();

-- Duplicate memory detection via pgvector cosine similarity
create or replace function find_duplicate_memories(
  similarity_threshold float default 0.85,
  max_pairs int default 30
)
returns table(
  id1         uuid,
  content1    text,
  created_at1 timestamptz,
  id2         uuid,
  content2    text,
  created_at2 timestamptz,
  similarity  float
)
language sql as $$
  select
    a.id,
    a.content,
    a.created_at,
    b.id,
    b.content,
    b.created_at,
    1 - (a.embedding <=> b.embedding) as similarity
  from memories a, memories b
  where a.id < b.id
    and 1 - (a.embedding <=> b.embedding) > similarity_threshold
  order by similarity desc
  limit max_pairs;
$$;
