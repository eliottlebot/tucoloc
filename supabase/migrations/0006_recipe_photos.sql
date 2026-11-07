-- An optional photo per Recipe, stored in a private bucket: only logged-in Flatmates can read or write it.
alter table public.recipes add column photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', false, 10 * 1024 * 1024, array['image/*']);

create policy "recipe photos: authenticated read" on storage.objects
  for select to authenticated using (bucket_id = 'recipe-photos');
create policy "recipe photos: authenticated upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'recipe-photos');
