-- Nutrition values of a Recipe, in whole grams per portion; null when not given.
alter table public.recipes
  add column proteins_g integer check (proteins_g >= 0),
  add column carbs_g integer check (carbs_g >= 0),
  add column fats_g integer check (fats_g >= 0);
