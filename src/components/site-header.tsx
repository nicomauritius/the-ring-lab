import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-line">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-serif text-xl tracking-tight">
          The Ring Lab
        </Link>
        {user ? (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/account" className="hover:text-clay">
              Account
            </Link>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="text-muted hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/sign-in"
            className="rounded-full border border-ink px-4 py-1.5 text-sm hover:bg-ink hover:text-paper"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
