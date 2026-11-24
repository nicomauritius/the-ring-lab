"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function duplicateDesign(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data: original } = await supabase.from("designs").select("name, config").eq("id", id).maybeSingle();
  if (!original) return;
  const name = `${String(original.name).slice(0, 53)} (copy)`;
  await supabase.from("designs").insert({ name, config: original.config });
  revalidatePath("/account");
}

export async function deleteDesign(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data: design } = await supabase.from("designs").select("preview_path").eq("id", id).maybeSingle();
  if (!design) return;
  await supabase.from("designs").delete().eq("id", id);
  if (design.preview_path) {
    await supabase.storage.from("previews").remove([String(design.preview_path)]);
  }
  revalidatePath("/account");
}
