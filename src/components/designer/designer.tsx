"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { findOption, LIMITS, normalizeConfig } from "@/lib/ring/catalog";
import { estimatePrice, formatUsd } from "@/lib/ring/price";
import { buildSpec, specAsText } from "@/lib/ring/spec";
import type * as THREE from "three";
import { downloadFile, slugify } from "./download";
import { ExportPanel } from "./export-panel";
import { euSize, formatUsSize, innerDiameterMm, US_SIZES } from "@/lib/ring/sizing";
import type { BasicOption, Catalog, RingConfig } from "@/lib/ring/types";

const RingCanvas = dynamic(() => import("./ring-canvas").then((m) => m.RingCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">Loading the 3D preview…</div>
  ),
});

const DRAFT_KEY = "ringlab:draft";
const DEFAULT_NAME = "Untitled ring";

export interface SavedDesign {
  id: string;
  name: string;
  config: RingConfig;
}

interface Props {
  catalog: Catalog;
  initialConfig: RingConfig;
  design: SavedDesign | null;
  userId: string | null;
  /** Admins can download the STL and spec to test with the wax lab. */
  isAdmin?: boolean;
}

// ---------- undo and redo ----------

interface History {
  past: RingConfig[];
  present: RingConfig;
  future: RingConfig[];
  lastKey: string | null;
  lastAt: number;
}

type Action =
  | { type: "set"; patch: Partial<RingConfig>; key: string; at: number }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "load"; config: RingConfig };

function historyReducer(state: History, action: Action): History {
  switch (action.type) {
    case "set": {
      // Dragging a slider sends many changes; fold them into one undo step.
      const fold = action.key === state.lastKey && action.at - state.lastAt < 1000;
      return {
        past: fold ? state.past : [...state.past.slice(-49), state.present],
        present: { ...state.present, ...action.patch },
        future: [],
        lastKey: action.key,
        lastAt: action.at,
      };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
        lastKey: null,
        lastAt: 0,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
        lastKey: null,
        lastAt: 0,
      };
    }
    case "load":
      return { past: [], present: action.config, future: [], lastKey: null, lastAt: 0 };
  }
}

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

// ---------- the designer ----------

export function Designer({ catalog, initialConfig, design, userId, isAdmin = false }: Props) {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialConfig,
    future: [],
    lastKey: null,
    lastAt: 0,
  });
  const config = history.present;
  const [name, setName] = useState(design?.name ?? DEFAULT_NAME);
  const [designId, setDesignId] = useState<string | null>(design?.id ?? null);
  const [status, setStatus] = useState<SaveStatus>(design ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(Boolean(design));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ringRef = useRef<THREE.Group>(null);
  const lastSaved = useRef(design ? JSON.stringify({ name: design.name, config: design.config }) : "");

  const set = useCallback(
    (patch: Partial<RingConfig>, key = Object.keys(patch).join(",")) =>
      dispatch({ type: "set", patch, key, at: Date.now() }),
    [],
  );

  // Restore an unsaved draft from this browser (for example after signing up mid-design).
  useEffect(() => {
    if (design) return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { name?: unknown; config?: unknown };
        dispatch({ type: "load", config: normalizeConfig(draft.config, catalog) });
        if (typeof draft.name === "string" && draft.name.trim()) setName(draft.name);
      }
    } catch {
      // Storage blocked or draft unreadable: start fresh.
    }
    setDraftLoaded(true);
  }, [design, catalog]);

  // Keep a draft in this browser until the design is saved to the account.
  useEffect(() => {
    if (designId || !draftLoaded) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, config }));
      } catch {
        // Storage blocked: the design still works, it just isn't remembered.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [config, name, designId, draftLoaded]);

  // Autosave changes to a design that already exists in the account.
  useEffect(() => {
    if (!userId || !designId) return;
    const snapshot = JSON.stringify({ name, config });
    if (snapshot === lastSaved.current) return;
    setStatus("unsaved");
    const timer = window.setTimeout(async () => {
      setStatus("saving");
      const supabase = createClient();
      const { error } = await supabase.from("designs").update({ name, config }).eq("id", designId);
      if (error) {
        setStatus("error");
        setError(error.message);
        return;
      }
      lastSaved.current = snapshot;
      setError(null);
      setStatus("saved");
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [config, name, designId, userId]);

  async function uploadThumbnail(id: string) {
    const source = canvasRef.current;
    if (!source || !userId) return;
    const width = 600;
    const height = Math.round((source.height / source.width) * width) || width;
    const small = document.createElement("canvas");
    small.width = width;
    small.height = height;
    small.getContext("2d")?.drawImage(source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => small.toBlob(resolve, "image/png"));
    if (!blob) return;
    const supabase = createClient();
    const path = `${userId}/${id}.png`;
    const { error } = await supabase.storage
      .from("previews")
      .upload(path, blob, { upsert: true, contentType: "image/png" });
    if (!error) await supabase.from("designs").update({ preview_path: path }).eq("id", id);
  }

  async function save() {
    if (!userId) return;
    setStatus("saving");
    setError(null);
    const supabase = createClient();
    let id = designId;

    if (id) {
      const { error } = await supabase.from("designs").update({ name, config }).eq("id", id);
      if (error) {
        setStatus("error");
        setError(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from("designs").insert({ name, config }).select("id").single();
      if (error || !data) {
        setStatus("error");
        setError(error?.message ?? "The design could not be saved. Try again.");
        return;
      }
      id = String(data.id);
    }

    await uploadThumbnail(id);
    lastSaved.current = JSON.stringify({ name, config });
    setStatus("saved");

    if (!designId) {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to clean up.
      }
      setDesignId(id);
      window.history.replaceState(null, "", `/design/${id}`);
    }
  }

  // Keyboard shortcuts for undo and redo.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setting = findOption(catalog.settings, config.setting);
  const estimate = useMemo(() => estimatePrice(config, catalog), [config, catalog]);
  const spec = useMemo(() => buildSpec(config, catalog), [config, catalog]);

  async function downloadStl() {
    if (!ringRef.current) return;
    const { exportMetalStl } = await import("./export-stl");
    downloadFile(exportMetalStl(ringRef.current), `${slugify(name)}.stl`, "model/stl");
  }

  function downloadSpec() {
    downloadFile(specAsText(name, spec), `${slugify(name)}-spec.txt`, "text/plain");
  }

  const statusText: Record<SaveStatus, string> = {
    idle: "",
    unsaved: "Unsaved changes",
    saving: "Saving…",
    saved: "Saved",
    error: "Not saved",
  };

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <section
        aria-label="3D preview"
        className="relative h-[55vh] min-h-[320px] border-b border-line lg:h-auto lg:min-h-0 lg:flex-1 lg:border-b-0 lg:border-r"
      >
        <RingCanvas
          config={config}
          catalog={catalog}
          groupRef={ringRef}
          onCanvas={(el) => (canvasRef.current = el)}
        />
        <div className="pointer-events-none absolute bottom-3 left-4 text-xs text-muted">
          Drag to turn · scroll or pinch to zoom
        </div>
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: "undo" })}
            disabled={history.past.length === 0}
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "redo" })}
            disabled={history.future.length === 0}
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Redo
          </button>
        </div>
      </section>

      <aside className="flex w-full flex-col lg:w-[420px] lg:overflow-y-auto">
        <div className="flex flex-col gap-8 px-4 py-6 sm:px-6">
          <label htmlFor="design-name" className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-muted">Design name</span>
            <input
              id="design-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              className="border-b border-line bg-transparent py-1 font-serif text-3xl tracking-tight focus:border-ink focus:outline-none"
            />
          </label>

          <Group title="Band">
            <Choices
              label="Profile"
              options={catalog.bandProfiles}
              value={config.bandProfile}
              onChange={(id) => set({ bandProfile: id })}
            />
            <Slider
              id="band-width"
              label="Width"
              value={config.bandWidthMm}
              {...LIMITS.bandWidthMm}
              format={(v) => `${v.toFixed(1)} mm`}
              onChange={(v) => set({ bandWidthMm: v })}
            />
            <Slider
              id="band-thickness"
              label="Thickness"
              value={config.bandThicknessMm}
              {...LIMITS.bandThicknessMm}
              format={(v) => `${v.toFixed(1)} mm`}
              onChange={(v) => set({ bandThicknessMm: v })}
            />
          </Group>

          <Group title="Metal">
            <Choices
              label="Metal"
              options={catalog.metals}
              value={config.metal}
              swatch={(o) => findOption(catalog.metals, o.id).color}
              onChange={(id) => set({ metal: id })}
            />
            <Choices
              label="Finish"
              options={catalog.finishes}
              value={config.finish}
              onChange={(id) => set({ finish: id })}
            />
          </Group>

          <Group title="Size">
            <label htmlFor="ring-size" className="flex items-center justify-between gap-4 text-sm">
              <span>US size</span>
              <select
                id="ring-size"
                value={config.sizeUs}
                onChange={(e) => set({ sizeUs: Number(e.target.value) })}
                className="rounded-lg border border-line bg-field px-3 py-2"
              >
                {US_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {formatUsSize(s)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted">
              EU {euSize(config.sizeUs)} · inner diameter {innerDiameterMm(config.sizeUs).toFixed(1)} mm
            </p>
          </Group>

          <Group title="Setting">
            <Choices
              label="Style"
              options={catalog.settings}
              value={config.setting}
              onChange={(id) => set({ setting: id })}
            />
          </Group>

          {setting.needsStone && (
            <Group title="Stone">
              <Choices
                label="Shape"
                options={catalog.stoneShapes}
                value={config.stoneShape}
                onChange={(id) => set({ stoneShape: id })}
              />
              <Choices
                label="Stone"
                options={catalog.stoneTypes}
                value={config.stoneType}
                swatch={(o) => findOption(catalog.stoneTypes, o.id).color}
                onChange={(id) => set({ stoneType: id })}
              />
              <Slider
                id="carat"
                label="Center stone"
                value={config.carat}
                {...LIMITS.carat}
                format={(v) => `${v.toFixed(2)} ct`}
                onChange={(v) => set({ carat: v })}
              />
            </Group>
          )}

          <Group title="Engraving">
            <label htmlFor="engraving" className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Inside the band, up to {LIMITS.engravingMaxLength} characters</span>
              <input
                id="engraving"
                value={config.engraving}
                maxLength={LIMITS.engravingMaxLength}
                placeholder="e.g. Always · 06.12.2027"
                onChange={(e) => set({ engraving: e.target.value }, "engraving")}
                className="rounded-lg border border-line bg-field px-3 py-2 placeholder:text-muted focus:border-ink focus:outline-none"
              />
            </label>
            <p className="text-xs text-muted">The engraving goes on the spec sheet; it isn&apos;t drawn in the preview.</p>
          </Group>

          <details className="group rounded-xl border border-line px-4 py-3">
            <summary className="cursor-pointer list-none text-xs uppercase tracking-widest text-muted">
              Specifications
            </summary>
            <dl className="mt-3 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              {spec.map((line) => (
                <div key={line.label} className="contents">
                  <dt className="text-muted">{line.label}</dt>
                  <dd className="min-w-0 break-words tabular-nums">{line.value}</dd>
                </div>
              ))}
            </dl>
            {isAdmin && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                <span className="w-full text-xs text-muted">Admin only: files for testing with the wax lab</span>
                <button
                  type="button"
                  onClick={downloadStl}
                  className="rounded-full border border-ink px-3 py-1.5 text-sm hover:bg-ink hover:text-paper"
                >
                  Download STL
                </button>
                <button
                  type="button"
                  onClick={downloadSpec}
                  className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-ink"
                >
                  Download spec
                </button>
              </div>
            )}
          </details>

          {userId && designId && (
            <ExportPanel
              designId={designId}
              config={config}
              catalog={catalog}
              saved={status === "saved"}
              ringRef={ringRef}
            />
          )}
        </div>

        <div className="sticky bottom-0 mt-auto border-t border-line bg-paper px-4 py-4 sm:px-6">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-xs uppercase tracking-widest text-muted">Rough estimate</span>
            <span className="font-serif text-2xl tabular-nums">
              {formatUsd(estimate.range[0])}–{formatUsd(estimate.range[1])}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            About {estimate.metalGrams.toFixed(1)} g of metal
            {estimate.totalCarat > 0 ? ` and ${estimate.totalCarat.toFixed(2)} ct of stones` : ""}. Jewelers send the
            real price.
          </p>

          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="text-sm text-muted" role="status">
              {statusText[status]}
            </span>
            {userId ? (
              <button
                type="button"
                onClick={save}
                disabled={status === "saving"}
                className="rounded-full bg-ink px-5 py-2.5 text-paper hover:opacity-90 disabled:opacity-50"
              >
                {designId ? "Save" : "Save design"}
              </button>
            ) : (
              <Link
                href={`/sign-in?next=${encodeURIComponent("/design")}`}
                className="rounded-full bg-ink px-5 py-2.5 text-paper hover:opacity-90"
              >
                Sign in to save
              </Link>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-clay">
              {error}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

// ---------- small building blocks ----------

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 text-xs uppercase tracking-widest text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function Choices<T extends BasicOption>({
  label,
  options,
  value,
  onChange,
  swatch,
}: {
  label: string;
  options: T[];
  value: string;
  onChange: (id: string) => void;
  swatch?: (option: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              selected ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
            }`}
          >
            {swatch && (
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-full border border-line"
                style={{ background: swatch(option) }}
              />
            )}
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted">{format(value)}</span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[var(--clay)]"
      />
    </label>
  );
}
