import { createClient } from "@/lib/supabase/server";
import { catalogFromRows, DEFAULT_CATALOG } from "./catalog";
import type { Catalog, CatalogRow } from "./types";

/** Reads the active catalog from the database, falling back to the built-in catalog. */
export async function loadCatalog(): Promise<Catalog> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("catalog_options")
      .select("id, category, name, params, sort_order")
      .eq("active", true)
      .order("sort_order");
    if (error || !data || data.length === 0) return DEFAULT_CATALOG;
    return catalogFromRows(data as CatalogRow[]);
  } catch {
    return DEFAULT_CATALOG;
  }
}
