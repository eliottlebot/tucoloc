-- Money one Flatmate (payer) spent for some Flatmates (participants), split equally in the app.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  label text not null check (trim(label) <> ''),
  amount_cents integer not null check (amount_cents > 0),
  date date not null,
  payer_id uuid not null references public.flatmates,
  participant_ids uuid[] not null check (cardinality(participant_ids) > 0),
  creator_id uuid not null references public.flatmates,
  created_at timestamptz not null
);

-- Any logged-in Flatmate can read and write; anonymous visitors get nothing.
alter table public.expenses enable row level security;
create policy "expenses: authenticated full access" on public.expenses
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.expenses;
