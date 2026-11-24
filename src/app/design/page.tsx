import type { Metadata } from "next";
import { Designer } from "@/components/designer/designer";
import { DEFAULT_CONFIG, normalizeConfig } from "@/lib/ring/catalog";
import { loadCatalog } from "@/lib/ring/load-catalog";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Design your ring · The Ring Lab" };

export default async function NewDesignPage() {
  const catalog = await loadCatalog();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Designer
      catalog={catalog}
      initialConfig={normalizeConfig(DEFAULT_CONFIG, catalog)}
      design={null}
      userId={user?.id ?? null}
    />
  );
}
