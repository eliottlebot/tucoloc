-- The Flatmates paid each other back; every Expense created before created_at is settled (worked out in the app).
-- transfers: the suggested transfers at that moment, as [{ "from_id", "to_id", "amount_cents" }].
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null,
  creator_id uuid not null references public.flatmates,
  transfers jsonb not null check (jsonb_typeof(transfers) = 'array')
);

-- Any logged-in Flatmate can read and write; anonymous visitors get nothing.
alter table public.settlements enable row level security;
create policy "settlements: authenticated full access" on public.settlements
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.settlements;
