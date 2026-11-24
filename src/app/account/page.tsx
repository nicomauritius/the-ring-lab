import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteDesign, duplicateDesign } from "./actions";

export const metadata: Metadata = { title: "Account · The Ring Lab" };

const roleLabels: Record<string, string> = {
  customer: "Customer",
  jeweler: "Jeweler",
  admin: "Admin",
};

interface DesignRow {
  id: string;
  name: string;
  updated_at: string;
  preview_path: string | null;
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/account");

  const [{ data: profile }, { data: designRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, role, created_at").eq("id", user.id).single(),
    supabase.from("designs").select("id, name, updated_at, preview_path").order("updated_at", { ascending: false }),
  ]);

  const designs = (designRows ?? []) as DesignRow[];
  const paths = designs.map((d) => d.preview_path).filter((p): p is string => Boolean(p));
  const previews = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("previews").createSignedUrls(paths, 3600);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) previews.set(item.path, item.signedUrl);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="font-serif text-5xl tracking-tight">
        {profile?.full_name ? `Hi, ${String(profile.full_name).split(" ")[0]}` : "Your account"}
      </h1>

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-serif text-3xl tracking-tight">Your designs</h2>
          <Link href="/design" className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper hover:opacity-90">
            New design
          </Link>
        </div>

        {designs.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <p className="font-serif text-2xl">No designs yet</p>
            <p className="mt-2 text-muted">Start a ring in the designer and press Save design to keep it here.</p>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {designs.map((design) => {
              const preview = design.preview_path ? previews.get(design.preview_path) : undefined;
              return (
                <li key={design.id} className="flex flex-col overflow-hidden rounded-2xl border border-line">
                  <Link href={`/design/${design.id}`} className="block aspect-[4/3] bg-field">
                    {preview ? (
                      // Signed URLs expire, so a plain img avoids caching them in the image optimizer.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt={`Preview of ${design.name}`} className="h-full w-full object-contain" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-sm text-muted">No preview yet</span>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col gap-1 px-4 py-3">
                    <Link href={`/design/${design.id}`} className="font-medium hover:text-clay">
                      {design.name}
                    </Link>
                    <span className="text-xs text-muted">
                      Edited {new Date(design.updated_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </span>
                    <div className="mt-2 flex gap-4 text-sm">
                      <form action={duplicateDesign}>
                        <input type="hidden" name="id" value={design.id} />
                        <button type="submit" className="text-muted hover:text-ink">
                          Duplicate
                        </button>
                      </form>
                      <DeleteButton id={design.id} name={design.name} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-3xl tracking-tight">Details</h2>
        <dl className="mt-6 grid grid-cols-[8rem_1fr] gap-x-6 gap-y-4 border-t border-line pt-6 text-sm">
          <dt className="text-muted">Email</dt>
          <dd className="min-w-0 break-words">{user.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd>{roleLabels[String(profile?.role ?? "")] ?? "Not set"}</dd>
          <dt className="text-muted">Member since</dt>
          <dd>
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString("en-US", { dateStyle: "long" })
              : "—"}
          </dd>
        </dl>
      </section>
    </main>
  );
}

/** Two-step delete without a browser dialog: the first click reveals the confirm button. */
function DeleteButton({ id, name }: { id: string; name: string }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-muted hover:text-clay">Delete</summary>
      <form action={deleteDesign} className="mt-2">
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="text-clay underline underline-offset-4" aria-label={`Delete ${name} for good`}>
          Delete for good
        </button>
      </form>
    </details>
  );
}
