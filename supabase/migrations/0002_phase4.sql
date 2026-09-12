-- Fase 4: viajantes e divisão de despesas, checklists, validade de documentos, orçamento e cartão de emergência.

alter table trips add column if not exists budget_base numeric(14,2);
alter table trips add column if not exists emergency jsonb;
alter table expenses add column if not exists split jsonb;   -- { traveler_id: peso }
alter table assets add column if not exists expires_at date;

create table if not exists travelers (
  id         uuid primary key,
  trip_id    uuid not null references trips(id) on delete cascade,
  name       text not null,
  color      text not null default '#38bdf8',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists checklist_items (
  id         uuid primary key,
  trip_id    uuid not null references trips(id) on delete cascade,
  day_id     uuid references trip_days(id) on delete cascade,
  kind       text not null check (kind in ('packing','day','border','vehicle')),
  text       text not null,
  done       boolean not null default false,
  position   numeric not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists checklist_items_trip on checklist_items(trip_id, kind);

do $$
declare t text;
begin
  foreach t in array array['travelers','checklist_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_member on %I', t, t);
    execute format('create policy %I_member on %I for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id))', t, t);
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before insert or update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;
