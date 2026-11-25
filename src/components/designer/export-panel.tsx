"use client";

import { useState } from "react";
import type * as THREE from "three";
import type { ExportResponse } from "@/lib/ring/export";
import { checkPrintability } from "@/lib/ring/printability";
import type { Catalog, RingConfig } from "@/lib/ring/types";

interface Props {
  designId: string;
  config: RingConfig;
  catalog: Catalog;
  /** True when everything on screen is saved to the account. */
  saved: boolean;
  ringRef: React.RefObject<THREE.Group | null>;
}

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "blocked"; message: string; issues: string[] }
  | { kind: "ready"; result: ExportResponse };

/** Checks the design can be cast, then stores and links its STL and spec sheet for this version. */
export function ExportPanel({ designId, config, catalog, saved, ringRef }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function exportFiles() {
    const issues = checkPrintability(config, catalog).map((i) => i.message);
    if (issues.length > 0) {
      setState({ kind: "blocked", message: "This design can't be cast yet.", issues });
      return;
    }
    if (!ringRef.current) return;

    setState({ kind: "working" });
    const [{ countOpenMetalParts }, { exportMetalStl }] = await Promise.all([
      import("@/lib/ring/mesh-check"),
      import("./export-stl"),
    ]);

    if (countOpenMetalParts(ringRef.current) > 0) {
      setState({
        kind: "blocked",
        message: "Part of the 3D model has a gap in its surface, so it can't be printed. Please tell us which design this is.",
        issues: [],
      });
      return;
    }

    const form = new FormData();
    form.set("config", JSON.stringify(config));
    form.set("stl", new Blob([exportMetalStl(ringRef.current)], { type: "model/stl" }), "ring.stl");

    try {
      const response = await fetch(`/api/designs/${designId}/export`, { method: "POST", body: form });
      const body = (await response.json()) as Partial<ExportResponse> & { error?: string; issues?: string[] };
      if (!response.ok || !body.stlUrl || !body.specUrl || !body.version) {
        setState({
          kind: "blocked",
          message: body.error ?? "The files could not be made. Try again.",
          issues: body.issues ?? [],
        });
        return;
      }
      setState({ kind: "ready", result: body as ExportResponse });
    } catch {
      setState({ kind: "blocked", message: "The files could not be made. Check your connection and try again.", issues: [] });
    }
  }

  // Links belong to the version they were made for; any edit makes them stale.
  const stale = state.kind === "ready" && !saved;

  return (
    <section aria-labelledby="export-title" className="flex flex-col gap-3 rounded-xl border border-line px-4 py-3">
      <h2 id="export-title" className="text-xs uppercase tracking-widest text-muted">
        Files for the wax model
      </h2>
      <p className="text-sm text-muted">
        A 3D-printable STL of the metal and a spec sheet, checked for castability and kept for this version of the
        design.
      </p>

      {state.kind === "ready" && !stale ? (
        <div className="flex flex-wrap gap-2">
          <a
            href={state.result.stlUrl}
            className="rounded-full border border-ink px-3 py-1.5 text-sm hover:bg-ink hover:text-paper"
          >
            Download STL (v{state.result.version})
          </a>
          <a href={state.result.specUrl} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-ink">
            Spec sheet PDF
          </a>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={exportFiles}
            disabled={!saved || state.kind === "working"}
            className="rounded-full border border-ink px-3 py-1.5 text-sm hover:bg-ink hover:text-paper disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink"
          >
            {state.kind === "working" ? "Checking and exporting…" : "Check and export files"}
          </button>
          {!saved && <span className="text-xs text-muted">Save your changes first.</span>}
        </div>
      )}

      {state.kind === "blocked" && (
        <div role="alert" className="text-sm text-clay">
          <p>{state.message}</p>
          {state.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {state.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
