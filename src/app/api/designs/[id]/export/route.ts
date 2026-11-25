import { NextResponse } from "next/server";
import { slugify } from "@/components/designer/download";
import { normalizeConfig } from "@/lib/ring/catalog";
import type { ExportResponse } from "@/lib/ring/export";
import { loadCatalog } from "@/lib/ring/load-catalog";
import { checkPrintability } from "@/lib/ring/printability";
import { buildSpec } from "@/lib/ring/spec";
import { buildSpecPdf } from "@/lib/ring/spec-pdf";
import { checkBinaryStl } from "@/lib/ring/stl";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** How long download links stay valid, in seconds. */
const LINK_SECONDS = 10 * 60;

function fail(status: number, error: string, issues?: string[]) {
  return NextResponse.json({ error, issues }, { status });
}

const alreadyExists = (error: { message?: string; statusCode?: string } | null) =>
  Boolean(error && (error.statusCode === "409" || /exists|duplicate/i.test(error.message ?? "")));

/**
 * Saves the STL (made in the browser from the 3D model) and a server-made spec PDF for the
 * design's current version, then returns short-lived download links. Calling it again for the
 * same version reuses the files already stored.
 *
 * Body: multipart form with `stl` (binary STL file) and `config` (the design JSON the browser
 * exported, which must match what is saved).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return fail(404, "Design not found.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "Sign in to export your design.");

  const { data: design } = await supabase
    .from("designs")
    .select("id, owner_id, name, config, version, preview_path")
    .eq("id", id)
    .maybeSingle();
  if (!design) return fail(404, "Design not found.");
  if (design.owner_id !== user.id) return fail(403, "Only the owner of a design can export it.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "The upload could not be read. Try again.");
  }

  const catalog = await loadCatalog();
  const saved = normalizeConfig(design.config, catalog);
  let sent: unknown;
  try {
    sent = JSON.parse(String(form.get("config") ?? ""));
  } catch {
    return fail(400, "The design details are missing.");
  }
  if (JSON.stringify(normalizeConfig(sent, catalog)) !== JSON.stringify(saved)) {
    return fail(409, "Your latest changes aren't saved yet. Save, then export again.");
  }

  const issues = checkPrintability(saved, catalog);
  if (issues.length > 0) {
    return fail(422, "This design can't be cast yet.", issues.map((i) => i.message));
  }

  const version = Number(design.version);
  const folder = `${user.id}/${id}`;
  const stlPath = `${folder}/v${version}.stl`;
  const specPath = `${folder}/v${version}.pdf`;

  const { data: existing } = await supabase
    .from("design_files")
    .select("kind")
    .eq("design_id", id)
    .eq("design_version", version);
  const have = new Set((existing ?? []).map((row) => String(row.kind)));

  if (!have.has("stl")) {
    const file = form.get("stl");
    if (!(file instanceof Blob)) return fail(400, "The STL file is missing.");
    const bytes = await file.arrayBuffer();
    const check = checkBinaryStl(bytes);
    if (!check.ok) return fail(400, check.reason);

    const { error } = await supabase.storage.from("stl").upload(stlPath, bytes, { contentType: "model/stl" });
    if (error && !alreadyExists(error)) return fail(500, "The STL could not be stored. Try again.");
  }

  if (!have.has("spec_pdf")) {
    let previewPng: Uint8Array | null = null;
    if (design.preview_path) {
      const { data } = await supabase.storage.from("previews").download(String(design.preview_path));
      if (data) previewPng = new Uint8Array(await data.arrayBuffer());
    }
    const pdf = await buildSpecPdf({
      designName: String(design.name),
      designId: id,
      version,
      lines: buildSpec(saved, catalog),
      previewPng,
    });
    const { error } = await supabase.storage
      .from("specs")
      .upload(specPath, pdf, { contentType: "application/pdf" });
    if (error && !alreadyExists(error)) return fail(500, "The spec sheet could not be stored. Try again.");
  }

  const rows = [
    { kind: "stl", storage_path: stlPath },
    { kind: "spec_pdf", storage_path: specPath },
  ]
    .filter((row) => !have.has(row.kind))
    .map((row) => ({ ...row, design_id: id, owner_id: user.id, design_version: version }));
  if (rows.length > 0) {
    const { error } = await supabase
      .from("design_files")
      .upsert(rows, { onConflict: "design_id,kind,design_version", ignoreDuplicates: true });
    // A failure here means the design changed version mid-export (the insert policy checks it).
    if (error) return fail(409, "The design changed while exporting. Export again.");
  }

  const base = `${slugify(String(design.name))}-v${version}`;
  const [stlLink, specLink] = await Promise.all([
    supabase.storage.from("stl").createSignedUrl(stlPath, LINK_SECONDS, { download: `${base}.stl` }),
    supabase.storage.from("specs").createSignedUrl(specPath, LINK_SECONDS, { download: `${base}-spec.pdf` }),
  ]);
  if (!stlLink.data || !specLink.data) return fail(500, "The download links could not be made. Try again.");

  const body: ExportResponse = { version, stlUrl: stlLink.data.signedUrl, specUrl: specLink.data.signedUrl };
  return NextResponse.json(body);
}
