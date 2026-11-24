# The Ring Lab

Design your own ring in 3D, order a wax model, and get quotes from local jewelers to make it.

Built with Next.js (App Router, TypeScript, Tailwind CSS) and Supabase (Postgres, Auth, Storage). Hosted on Vercel.

## Status

**Phase 0: Foundation.** Landing page, sign-in (email/password, Google, Microsoft), user profiles with roles, and role-protected routes. See the coding plan for later phases.

## Run it locally

1. Install Node.js 20 or newer.
2. `npm install`, then commit the generated `package-lock.json`.
3. Copy `.env.example` to `.env.local` and fill in your Supabase URL and anon key.
4. `npm run dev` and open http://localhost:3000.

## Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the SQL in `supabase/migrations/` in order, in the SQL editor (or `supabase db push` with the Supabase CLI).
3. **Authentication → URL Configuration:** set Site URL to your production URL and add these redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://<your-vercel-domain>/auth/callback`
   - `https://*-<your-vercel-team>.vercel.app/auth/callback` for preview deploys
4. **Authentication → Providers:**
   - Email: on, with "Confirm email" on.
   - Google: add a client ID and secret from Google Cloud Console (OAuth client, web application). Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Azure (Microsoft): add an app registration from the Azure portal with the same redirect URI. Use tenant URL `https://login.microsoftonline.com/common` to allow personal and work accounts.
5. Make yourself an admin after signing up once:
   ```sql
   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
   ```

## Deploy to Vercel

1. Import this repo in Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables for Production and Preview.
3. Every pull request gets a preview deploy.

## Roles

| Role | Can open |
| --- | --- |
| Visitor | Landing page, sign-in |
| Customer | `/account` |
| Jeweler | `/account`, `/jeweler` |
| Admin | Everything, including `/admin` |

Roles live in `public.profiles.role`. Users cannot change their own role; only an admin (or the SQL editor) can.
