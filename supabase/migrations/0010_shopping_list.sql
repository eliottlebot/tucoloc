-- The shared Shopping List: one row per Item; bought_at is null while it is still to buy.
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (trim(name) <> ''),
  added_at timestamptz not null,
  bought_at timestamptz
);

-- Any logged-in Flatmate can read and write; anonymous visitors get nothing.
alter table public.shopping_items enable row level security;
create policy "shopping_items: authenticated full access" on public.shopping_items
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.shopping_items;
