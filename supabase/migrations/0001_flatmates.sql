-- One row per Flatmate, keyed by their Supabase Auth user.
create table public.flatmates (
  id uuid primary key references auth.users on delete cascade,
  name text not null
);

-- Any logged-in Flatmate can read and write; anonymous visitors get nothing.
alter table public.flatmates enable row level security;
create policy "flatmates: authenticated full access" on public.flatmates
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.flatmates;
