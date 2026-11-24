import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Designer } from "@/components/designer/designer";
import { normalizeConfig } from "@/lib/ring/catalog";
import { loadCatalog } from "@/lib/ring/load-catalog";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your ring · The Ring Lab" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/design/${id}`)}`);

  // Row-level security only returns the user's own designs.
  const { data: row } = await supabase.from("designs").select("id, name, config").eq("id", id).maybeSingle();
  if (!row) notFound();

  const catalog = await loadCatalog();
  const config = normalizeConfig(row.config, catalog);

  return (
    <Designer
      catalog={catalog}
      initialConfig={config}
      design={{ id: String(row.id), name: String(row.name), config }}
      userId={user.id}
    />
  );
}
