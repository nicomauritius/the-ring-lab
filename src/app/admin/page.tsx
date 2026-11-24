import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin · The Ring Lab" };

// Access is limited to admins by the middleware.
export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="font-serif text-5xl tracking-tight">Admin</h1>
      <p className="mt-4 text-muted">
        Jeweler approvals, the configurator catalog and wax orders will be managed here.
      </p>
    </main>
  );
}
