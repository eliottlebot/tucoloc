-- The two Rooms, fixed. A Room is occupied when flatmate_id is set, free when it is null.
create table public.rooms (
  id text primary key check (id in ('wc', 'salle-de-bain')),
  flatmate_id uuid references public.flatmates,
  since timestamptz,
  check ((flatmate_id is null) = (since is null))
);

insert into public.rooms (id) values ('wc'), ('salle-de-bain');

-- Any logged-in Flatmate can read and write; anonymous visitors get nothing.
alter table public.rooms enable row level security;
create policy "rooms: authenticated full access" on public.rooms
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.rooms;
