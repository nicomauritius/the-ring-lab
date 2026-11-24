import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function DiamondMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 5h14l6 7-13 16L3 12z" />
      <path d="M3 12h26M12 5l-3 7 7 16 7-16-3-7" />
    </svg>
  );
}

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header>
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3 text-ink">
          <DiamondMark className="h-8 w-8 text-navy sm:h-9 sm:w-9" />
          <span className="font-serif text-2xl tracking-tight sm:text-3xl">The Ring Lab</span>
        </Link>
        <div className="flex items-center gap-3 text-sm sm:gap-6 sm:text-base">
          <Link href="/design" className="font-medium hover:text-clay">
            Design
          </Link>
          {user ? (
            <>
              <Link href="/account" className="font-medium hover:text-clay">
                Account
              </Link>
              <form action="/auth/sign-out" method="post">
                <button type="submit" className="text-muted hover:text-ink">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-xl border border-line bg-field px-4 py-2 font-medium shadow-sm hover:border-ink"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
