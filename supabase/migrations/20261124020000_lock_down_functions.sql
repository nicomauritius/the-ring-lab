-- The sign-up trigger function must never be called through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- is_admin() is needed by signed-in users' row-level security checks, but not by visitors.
-- It only tells the caller whether they themselves are an admin.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Visitors read the catalog without calling is_admin().
drop policy "Anyone can read active catalog options" on public.catalog_options;

create policy "Visitors can read active catalog options"
  on public.catalog_options for select
  to anon
  using (active);

create policy "Signed-in users can read active catalog options"
  on public.catalog_options for select
  to authenticated
  using (active or public.is_admin());
