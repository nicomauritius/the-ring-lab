import type { Metadata } from "next";
import { safeNext } from "@/lib/supabase/env";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · The Ring Lab" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <h1 className="font-serif text-5xl tracking-tight">Welcome</h1>
      <p className="mt-3 text-muted">Sign in to save your ring designs and order wax models.</p>
      {error === "callback" && (
        <p role="alert" className="mt-6 rounded-lg border border-clay px-4 py-3 text-sm">
          That sign-in link didn&apos;t work. It may have expired or been opened in another browser. Try again below.
        </p>
      )}
      <SignInForm next={safeNext(next)} />
    </main>
  );
}
