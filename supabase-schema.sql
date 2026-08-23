-- Study Time Tracker — Daily Study Calendar schema
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- Scope: this table backs ONLY the new binary Daily Study Calendar on the
-- Dashboard (green = marked, red = unmarked). The existing hour-based Study
-- Time Tracker page is intentionally left on localStorage for this phase —
-- see the chat summary for why.

create table if not exists public.calendar_marks (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  mark_date   date        not null,
  marked      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, mark_date)
);

-- Row Level Security: every policy below is scoped to auth.uid(), so a
-- signed-in user can only ever read or write their own rows. There is no
-- way for one account to see another account's marks through this table.
alter table public.calendar_marks enable row level security;

-- Postgres has no "CREATE POLICY IF NOT EXISTS", so each policy is dropped
-- first. This makes the whole script safe to run more than once, even if
-- an earlier run got partway through.
drop policy if exists "select_own_marks" on public.calendar_marks;
create policy "select_own_marks"
  on public.calendar_marks for select
  using (auth.uid() = user_id);

drop policy if exists "insert_own_marks" on public.calendar_marks;
create policy "insert_own_marks"
  on public.calendar_marks for insert
  with check (auth.uid() = user_id);

drop policy if exists "update_own_marks" on public.calendar_marks;
create policy "update_own_marks"
  on public.calendar_marks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete_own_marks" on public.calendar_marks;
create policy "delete_own_marks"
  on public.calendar_marks for delete
  using (auth.uid() = user_id);

-- Keep updated_at current on every change.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_calendar_marks_updated_at on public.calendar_marks;
create trigger trg_calendar_marks_updated_at
  before update on public.calendar_marks
  for each row execute function public.set_updated_at();
