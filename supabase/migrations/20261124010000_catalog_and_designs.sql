-- Configurator catalog, saved ring designs, and private storage for design previews.

-- ---------- catalog_options ----------
create table public.catalog_options (
  id text primary key,
  category text not null check (category in ('metal', 'finish', 'band_profile', 'setting', 'stone_shape', 'stone_type')),
  name text not null,
  params jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catalog_options_category_idx on public.catalog_options (category, sort_order);

alter table public.catalog_options enable row level security;

create policy "Anyone can read active catalog options"
  on public.catalog_options for select
  to anon, authenticated
  using (active or public.is_admin());

create policy "Admins can add catalog options"
  on public.catalog_options for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can change catalog options"
  on public.catalog_options for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can remove catalog options"
  on public.catalog_options for delete
  to authenticated
  using (public.is_admin());

create trigger catalog_options_set_updated_at
  before update on public.catalog_options
  for each row execute function public.set_updated_at();

-- Launch catalog. Prices are rough placeholders for the estimate; replace them in the admin screen.
insert into public.catalog_options (id, category, name, params, sort_order) values
  ('yellow-gold-14k', 'metal', '14k yellow gold', '{"color":"#e3b76a","density":13.1,"pricePerGram":[75,110]}'::jsonb, 10),
  ('white-gold-14k', 'metal', '14k white gold', '{"color":"#dedcd6","density":13.1,"pricePerGram":[80,115]}'::jsonb, 20),
  ('rose-gold-14k', 'metal', '14k rose gold', '{"color":"#e2a990","density":13.1,"pricePerGram":[75,110]}'::jsonb, 30),
  ('yellow-gold-18k', 'metal', '18k yellow gold', '{"color":"#e8bd5a","density":15.6,"pricePerGram":[105,150]}'::jsonb, 40),
  ('platinum', 'metal', 'Platinum 950', '{"color":"#d6d7d9","density":20.1,"pricePerGram":[65,100]}'::jsonb, 50),
  ('polished', 'finish', 'Polished', '{"roughness":0.12}'::jsonb, 10),
  ('satin', 'finish', 'Satin', '{"roughness":0.38}'::jsonb, 20),
  ('brushed', 'finish', 'Brushed', '{"roughness":0.55}'::jsonb, 30),
  ('comfort', 'band_profile', 'Comfort fit', '{}'::jsonb, 10),
  ('flat', 'band_profile', 'Flat', '{}'::jsonb, 20),
  ('dome', 'band_profile', 'Half-round', '{}'::jsonb, 30),
  ('knife', 'band_profile', 'Knife edge', '{}'::jsonb, 40),
  ('square', 'band_profile', 'Square', '{}'::jsonb, 50),
  ('none', 'setting', 'Plain band', '{"needsStone":false,"laborUsd":[120,250],"metalGrams":0,"extraStoneCarat":0,"sideStoneRatio":0}'::jsonb, 10),
  ('solitaire-4', 'setting', 'Solitaire, 4 prongs', '{"needsStone":true,"laborUsd":[250,450],"metalGrams":0.8,"extraStoneCarat":0,"sideStoneRatio":0}'::jsonb, 20),
  ('solitaire-6', 'setting', 'Solitaire, 6 prongs', '{"needsStone":true,"laborUsd":[280,500],"metalGrams":1,"extraStoneCarat":0,"sideStoneRatio":0}'::jsonb, 30),
  ('bezel', 'setting', 'Bezel', '{"needsStone":true,"laborUsd":[300,550],"metalGrams":1.4,"extraStoneCarat":0,"sideStoneRatio":0}'::jsonb, 40),
  ('halo', 'setting', 'Halo', '{"needsStone":true,"laborUsd":[550,950],"metalGrams":1.6,"extraStoneCarat":0.25,"sideStoneRatio":0}'::jsonb, 50),
  ('three-stone', 'setting', 'Three stone', '{"needsStone":true,"laborUsd":[450,800],"metalGrams":1.8,"extraStoneCarat":0,"sideStoneRatio":0.54}'::jsonb, 60),
  ('round', 'stone_shape', 'Round', '{}'::jsonb, 10),
  ('oval', 'stone_shape', 'Oval', '{}'::jsonb, 20),
  ('princess', 'stone_shape', 'Princess', '{}'::jsonb, 30),
  ('cushion', 'stone_shape', 'Cushion', '{}'::jsonb, 40),
  ('emerald', 'stone_shape', 'Emerald cut', '{}'::jsonb, 50),
  ('marquise', 'stone_shape', 'Marquise', '{}'::jsonb, 60),
  ('lab-diamond', 'stone_type', 'Lab-grown diamond', '{"color":"#ffffff","pricePerCarat":[500,1200]}'::jsonb, 10),
  ('natural-diamond', 'stone_type', 'Natural diamond', '{"color":"#ffffff","pricePerCarat":[3500,8000]}'::jsonb, 20),
  ('moissanite', 'stone_type', 'Moissanite', '{"color":"#f4fbff","pricePerCarat":[300,600]}'::jsonb, 30),
  ('sapphire', 'stone_type', 'Sapphire', '{"color":"#2350c8","pricePerCarat":[400,1500]}'::jsonb, 40),
  ('ruby', 'stone_type', 'Ruby', '{"color":"#b3123a","pricePerCarat":[500,2000]}'::jsonb, 50),
  ('emerald-stone', 'stone_type', 'Emerald', '{"color":"#1f9d5a","pricePerCarat":[400,1500]}'::jsonb, 60),
  ('morganite', 'stone_type', 'Morganite', '{"color":"#f2b8b0","pricePerCarat":[80,300]}'::jsonb, 70)
;

-- ---------- designs ----------
create table public.designs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null default 'Untitled ring' check (char_length(name) between 1 and 60),
  config jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'final')),
  version integer not null default 1,
  preview_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index designs_owner_updated_idx on public.designs (owner_id, updated_at desc);

alter table public.designs enable row level security;

create policy "Owners can read their designs"
  on public.designs for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Admins can read all designs"
  on public.designs for select
  to authenticated
  using (public.is_admin());

create policy "Owners can create designs"
  on public.designs for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners can change their designs"
  on public.designs for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners can delete their designs"
  on public.designs for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Bump the version whenever the ring itself changes, so orders can point at an exact version.
create or replace function public.designs_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.owner_id = old.owner_id;
  if new.config is distinct from old.config then
    new.version = old.version + 1;
  end if;
  return new;
end;
$$;

create trigger designs_before_update
  before update on public.designs
  for each row execute function public.designs_before_update();

-- ---------- previews storage bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('previews', 'previews', false, 5242880, array['image/png']);

-- Files live under <user id>/<design id>.png; each user can only touch their own folder.
create policy "Users can read their own previews"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'previews' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own previews"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'previews' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can replace their own previews"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'previews' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'previews' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own previews"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'previews' and (storage.foldername(name))[1] = (select auth.uid())::text);
