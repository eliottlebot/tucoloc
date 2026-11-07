-- The design font has no accented letters: the app saves typed text without accents (src/plain.ts).
-- Run once: removes accents from what was saved before, and from the Flatmates' names.
create extension if not exists unaccent with schema extensions;

update public.flatmates set name = extensions.unaccent(name);
update public.expenses set label = extensions.unaccent(label);
update public.recipes set title = extensions.unaccent(title), text = extensions.unaccent(text);
update public.meal set text = extensions.unaccent(text) where text is not null;
