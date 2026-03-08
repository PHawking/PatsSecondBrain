create extension if not exists vector;

create table memories (
  id          uuid        primary key default gen_random_uuid(),
  content     text        not null,
  embedding   vector(1536),
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

-- Cosine similarity index (IVFFlat for speed at scale)
create index memories_embedding_idx
  on memories using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index memories_created_at_idx on memories (created_at desc);

-- RPC function for semantic search via cosine similarity
create or replace function match_memories(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (id uuid, content text, metadata jsonb, similarity float, created_at timestamptz)
language sql stable as $$
  select id, content, metadata,
         1 - (embedding <=> query_embedding) as similarity,
         created_at
  from memories
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
