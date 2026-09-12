-- Turism — esquema inicial (docs/02). Postgres (Supabase). Todas as linhas sincronizáveis têm id (UUID v7 do cliente),
-- updated_at e deleted_at (soft delete), para last-writer-wins e reconciliação offline.

create extension if not exists "pgcrypto";

create table if not exists trips (
  id             uuid primary key,
  owner_id       uuid not null default auth.uid() references auth.users(id),
  title          text not null,
  start_date     date,
  end_date       date,
  base_currency  char(3) not null default 'BRL',
  status         text not null default 'planning' check (status in ('planning','active','done')),
  cover_asset_id uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create table if not exists trip_members (
  trip_id  uuid references trips(id) on delete cascade,
  user_id  uuid references auth.users(id) on delete cascade,
  role     text not null default 'editor' check (role in ('owner','editor','viewer')),
  primary key (trip_id, user_id)
);

create table if not exists trip_days (
  id                  uuid primary key,
  trip_id             uuid not null references trips(id) on delete cascade,
  day_index           int  not null,
  date                date,
  timezone            text not null default 'America/Sao_Paulo',
  title               text,
  narrative           text,
  logistics_notes     text,
  expected_km         numeric(8,1),
  expected_travel_min int,
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index if not exists trip_days_trip on trip_days(trip_id, day_index);

create table if not exists activities (
  id         uuid primary key,
  trip_id    uuid not null references trips(id) on delete cascade,
  day_id     uuid not null references trip_days(id) on delete cascade,
  position   numeric not null,
  type       text not null default 'other',
  title      text not null,
  start_time time,
  end_time   time,
  place_name text,
  lat        double precision,
  lng        double precision,
  notes      text,
  status     text not null default 'planned' check (status in ('planned','done','skipped')),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists activities_day on activities(day_id, position);

create table if not exists assets (
  id           uuid primary key,
  trip_id      uuid not null references trips(id) on delete cascade,
  kind         text not null check (kind in ('document','photo','audio','link')),
  category     text not null default 'other',
  title        text not null,
  storage_path text,
  url          text,
  mime         text,
  size_bytes   bigint,
  sha256       text,
  sensitive    boolean not null default false,
  critical     boolean not null default false,
  ocr          jsonb,
  ocr_status   text not null default 'none' check (ocr_status in ('none','pending','done','failed')),
  captured_at  timestamptz,
  attribution  text,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists assets_trip on assets(trip_id);

create table if not exists asset_days (
  id         text primary key,          -- `${asset_id}:${day_id}`
  asset_id   uuid not null references assets(id) on delete cascade,
  day_id     uuid not null references trip_days(id) on delete cascade,
  trip_id    uuid not null references trips(id) on delete cascade,
  priority   int not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists asset_days_day on asset_days(day_id);

create table if not exists fx_rates (
  id       text primary key,            -- `${base}:${quote}:${date}`
  base     char(3) not null,
  quote    char(3) not null,
  date     date    not null,
  rate     numeric(18,8) not null,
  provider text    not null
);

create table if not exists expenses (
  id               uuid primary key,
  trip_id          uuid not null references trips(id) on delete cascade,
  day_id           uuid references trip_days(id),
  category         text not null,
  amount           numeric(14,2) not null,
  currency         char(3) not null,
  fx_rate          numeric(18,8) not null,
  fx_rate_date     date not null,
  amount_base      numeric(14,2) not null,
  paid_by          uuid,
  payment_method   text,
  merchant         text,
  receipt_asset_id uuid references assets(id),
  source           text not null default 'manual' check (source in ('manual','ocr_online','ocr_offline')),
  ocr_confidence   numeric(3,2),
  notes            text,
  spent_at         timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists expenses_trip on expenses(trip_id, spent_at);

create table if not exists ai_jobs (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid references trips(id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  type       text not null,
  status     text not null default 'queued' check (status in ('queued','running','done','failed')),
  input      jsonb not null,
  output     jsonb,
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_suggestions (
  id         uuid primary key,
  trip_id    uuid not null references trips(id) on delete cascade,
  day_id     uuid references trip_days(id),
  kind       text not null,
  payload    jsonb not null,
  reason     text,
  status     text not null default 'proposed' check (status in ('proposed','accepted','dismissed')),
  updated_at timestamptz not null default now()
);

-- Dono vira membro automaticamente
create or replace function trips_add_owner() returns trigger language plpgsql security definer as $$
begin
  insert into trip_members(trip_id, user_id, role) values (new.id, new.owner_id, 'owner') on conflict do nothing;
  return new;
end $$;
drop trigger if exists trips_add_owner_t on trips;
create trigger trips_add_owner_t after insert on trips for each row execute function trips_add_owner();

-- updated_at do servidor nunca fica atrás do cliente (clock skew)
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  if new.updated_at is null or new.updated_at < now() - interval '5 minutes' then new.updated_at := now(); end if;
  return new;
end $$;

-- RLS: tudo passa por trip_members
create or replace function is_trip_member(t uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from trip_members m where m.trip_id = t and m.user_id = auth.uid());
$$;

alter table trips enable row level security;
create policy trips_select on trips for select using (is_trip_member(id) or owner_id = auth.uid());
create policy trips_insert on trips for insert with check (owner_id = auth.uid());
create policy trips_update on trips for update using (is_trip_member(id));
create policy trips_delete on trips for delete using (owner_id = auth.uid());

alter table trip_members enable row level security;
create policy members_select on trip_members for select using (is_trip_member(trip_id));
create policy members_manage on trip_members for all using (exists (select 1 from trips t where t.id = trip_id and t.owner_id = auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['trip_days','activities','assets','asset_days','expenses','ai_jobs','ai_suggestions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_member on %I', t, t);
    execute format('create policy %I_member on %I for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id))', t, t);
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before insert or update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

alter table fx_rates enable row level security;
create policy fx_read on fx_rates for select using (auth.role() = 'authenticated');

-- Storage: bucket privado, caminho `${trip_id}/${asset_id}`
insert into storage.buckets (id, name, public) values ('assets', 'assets', false) on conflict do nothing;
create policy assets_storage_rw on storage.objects for all
  using (bucket_id = 'assets' and is_trip_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'assets' and is_trip_member(((storage.foldername(name))[1])::uuid));

-- Câmbio: atualização periódica (pg_cron chama a Edge Function fx-refresh)
-- select cron.schedule('fx-refresh', '0 */6 * * *', $$ select net.http_post(url := current_setting('app.functions_url') || '/fx-refresh', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb) $$);
