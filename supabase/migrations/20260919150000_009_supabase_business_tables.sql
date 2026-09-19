create table if not exists public.hip_harvests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cross_id uuid not null references public.crosses(id) on delete cascade,
  code text not null,
  harvest_date timestamptz,
  seed_count integer not null default 0 check (seed_count >= 0),
  remarks text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create table if not exists public.greenhouses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  remarks text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.greenhouse_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  greenhouse_id uuid not null references public.greenhouses(id) on delete cascade,
  name text not null,
  capacity integer check (capacity is null or capacity >= 0),
  remarks text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sowing_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hip_harvest_id uuid not null references public.hip_harvests(id) on delete cascade,
  code text not null,
  sowing_date timestamptz not null default now(),
  harvest_date timestamptz,
  seed_count integer not null default 0 check (seed_count >= 0),
  table_id uuid references public.greenhouse_tables(id) on delete set null,
  remarks text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create table if not exists public.seedlings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  batch_id uuid not null references public.sowing_batches(id) on delete cascade,
  code text not null,
  seedling_index integer not null check (seedling_index > 0),
  status text not null default 'observing' check (status in ('observing', 'discarded', 'selected')),
  remarks text not null default '',
  seedling_code text,
  evaluation_status text,
  free_notes text,
  is_promoted_to_variety boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists hip_harvests_cross_id_idx on public.hip_harvests(cross_id);
create index if not exists greenhouse_tables_greenhouse_id_idx on public.greenhouse_tables(greenhouse_id);
create index if not exists sowing_batches_hip_harvest_id_idx on public.sowing_batches(hip_harvest_id);
create index if not exists sowing_batches_table_id_idx on public.sowing_batches(table_id);
create index if not exists seedlings_batch_id_idx on public.seedlings(batch_id);

alter table public.crosses enable row level security;
alter table public.hip_harvests enable row level security;
alter table public.sowing_batches enable row level security;
alter table public.seedlings enable row level security;
alter table public.greenhouses enable row level security;
alter table public.greenhouse_tables enable row level security;

do $$
declare t text;
begin
  foreach t in array array['crosses','hip_harvests','sowing_batches','seedlings','greenhouses','greenhouse_tables'] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_owner_all', t);
  end loop;
end $$;

grant select, insert, update, delete on public.crosses, public.hip_harvests, public.sowing_batches, public.seedlings, public.greenhouses, public.greenhouse_tables to authenticated;

notify pgrst, 'reload schema';
