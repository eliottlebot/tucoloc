-- A dish any Flatmate can add and edit: title, free text, optional link.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (trim(title) <> ''),
  text text not null default '',
  link text check (link ~ '^https?://'),
  creator_id uuid not null references public.flatmates
);

-- Any logged-in Flatmate can read and write; anonymous visitors get nothing.
alter table public.recipes enable row level security;
create policy "recipes: authenticated full access" on public.recipes
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.recipes;
