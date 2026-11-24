import type { Metadata } from "next";

export const metadata: Metadata = { title: "Jeweler · The Ring Lab" };

// Access is limited to jewelers and admins by the middleware.
export default function JewelerPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="font-serif text-5xl tracking-tight">Jeweler workspace</h1>
      <p className="mt-4 text-muted">Quote requests from customers near you will appear here in Phase 3.</p>
    </main>
  );
}
