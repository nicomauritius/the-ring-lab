-- Exported manufacturing files: one STL and one spec PDF per design version.
-- Files are never replaced, so a wax order can always point at exactly what was sent to the lab.

create table public.design_files (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('stl', 'spec_pdf')),
  design_version integer not null check (design_version > 0),
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (design_id, kind, design_version)
);

create index design_files_design_idx on public.design_files (design_id, design_version desc);

alter table public.design_files enable row level security;

create policy "Owners can read their design files"
  on public.design_files for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Admins can read all design files"
  on public.design_files for select
  to authenticated
  using (public.is_admin());

-- Only for a design the user owns, and only at that design's current version.
create policy "Owners can record files for their current design version"
  on public.design_files for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.designs d
      where d.id = design_id
        and d.owner_id = (select auth.uid())
        and d.version = design_version
    )
  );

-- No update or delete policies: rows are permanent (they go when the design is deleted).

-- ---------- stl and specs storage buckets ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('stl', 'stl', false, 15728640, array['model/stl']),
  ('specs', 'specs', false, 5242880, array['application/pdf']);

-- Files live under <user id>/<design id>/v<version>.<ext>. Users read and add files in their
-- own folder; nobody can overwrite or delete them through the API. Admins can read everything.
create policy "Users can read their own STL and spec files"
  on storage.objects for select
  to authenticated
  using (bucket_id in ('stl', 'specs') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Admins can read all STL and spec files"
  on storage.objects for select
  to authenticated
  using (bucket_id in ('stl', 'specs') and public.is_admin());

create policy "Users can add STL and spec files to their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('stl', 'specs') and (storage.foldername(name))[1] = (select auth.uid())::text);
