import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account · The Ring Lab" };

const roleLabels: Record<string, string> = {
  customer: "Customer",
  jeweler: "Jeweler",
  admin: "Admin",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/account");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, created_at")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="font-serif text-5xl tracking-tight">
        {profile?.full_name ? `Hi, ${profile.full_name.split(" ")[0]}` : "Your account"}
      </h1>
      <dl className="mt-10 grid grid-cols-[8rem_1fr] gap-x-6 gap-y-4 border-t border-line pt-6 text-sm">
        <dt className="text-muted">Email</dt>
        <dd className="min-w-0 break-words">{user.email}</dd>
        <dt className="text-muted">Role</dt>
        <dd>{roleLabels[profile?.role ?? ""] ?? "Not set"}</dd>
        <dt className="text-muted">Member since</dt>
        <dd>
          {profile?.created_at
            ? new Date(profile.created_at).toLocaleDateString("en-US", { dateStyle: "long" })
            : "—"}
        </dd>
      </dl>
      <p className="mt-10 text-muted">Your saved ring designs will appear here once the designer is ready.</p>
    </main>
  );
}
