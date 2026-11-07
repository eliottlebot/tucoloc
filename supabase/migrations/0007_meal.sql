-- Tonight's Meal: one shared row, a Recipe or free text. Whether it is still tonight's is worked out in the app.
create table public.meal (
  id boolean primary key default true check (id),
  -- Deleting the Recipe empties the Meal.
  recipe_id uuid references public.recipes on delete cascade,
  text text check (trim(text) <> ''),
  set_by uuid not null references public.flatmates,
  set_at timestamptz not null,
  check ((recipe_id is null) <> (text is null))
);

-- Any logged-in Flatmate can read and write; anonymous visitors get nothing.
alter table public.meal enable row level security;
create policy "meal: authenticated full access" on public.meal
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.meal;
