import type {
  BasicOption,
  Catalog,
  CatalogRow,
  FinishOption,
  MetalOption,
  PriceRange,
  RingConfig,
  SettingOption,
  StoneTypeOption,
} from "./types";

/**
 * The launch catalog. It seeds the catalog_options table and is used as a fallback when
 * the database is unreachable. Prices are rough placeholders for the estimate only;
 * the admin should replace them with real figures.
 */
export const DEFAULT_CATALOG: Catalog = {
  metals: [
    { id: "yellow-gold-14k", name: "14k yellow gold", color: "#e3b76a", density: 13.1, pricePerGram: [75, 110] },
    { id: "white-gold-14k", name: "14k white gold", color: "#dedcd6", density: 13.1, pricePerGram: [80, 115] },
    { id: "rose-gold-14k", name: "14k rose gold", color: "#e2a990", density: 13.1, pricePerGram: [75, 110] },
    { id: "yellow-gold-18k", name: "18k yellow gold", color: "#e8bd5a", density: 15.6, pricePerGram: [105, 150] },
    { id: "platinum", name: "Platinum 950", color: "#d6d7d9", density: 20.1, pricePerGram: [65, 100] },
  ],
  finishes: [
    { id: "polished", name: "Polished", roughness: 0.12 },
    { id: "satin", name: "Satin", roughness: 0.38 },
    { id: "brushed", name: "Brushed", roughness: 0.55 },
  ],
  bandProfiles: [
    { id: "comfort", name: "Comfort fit" },
    { id: "flat", name: "Flat" },
    { id: "dome", name: "Half-round" },
    { id: "knife", name: "Knife edge" },
    { id: "square", name: "Square" },
  ],
  settings: [
    { id: "none", name: "Plain band", needsStone: false, laborUsd: [120, 250], metalGrams: 0, extraStoneCarat: 0, sideStoneRatio: 0 },
    { id: "solitaire-4", name: "Solitaire, 4 prongs", needsStone: true, laborUsd: [250, 450], metalGrams: 0.8, extraStoneCarat: 0, sideStoneRatio: 0 },
    { id: "solitaire-6", name: "Solitaire, 6 prongs", needsStone: true, laborUsd: [280, 500], metalGrams: 1, extraStoneCarat: 0, sideStoneRatio: 0 },
    { id: "bezel", name: "Bezel", needsStone: true, laborUsd: [300, 550], metalGrams: 1.4, extraStoneCarat: 0, sideStoneRatio: 0 },
    { id: "halo", name: "Halo", needsStone: true, laborUsd: [550, 950], metalGrams: 1.6, extraStoneCarat: 0.25, sideStoneRatio: 0 },
    { id: "three-stone", name: "Three stone", needsStone: true, laborUsd: [450, 800], metalGrams: 1.8, extraStoneCarat: 0, sideStoneRatio: 0.54 },
  ],
  stoneShapes: [
    { id: "round", name: "Round" },
    { id: "oval", name: "Oval" },
    { id: "princess", name: "Princess" },
    { id: "cushion", name: "Cushion" },
    { id: "emerald", name: "Emerald cut" },
    { id: "marquise", name: "Marquise" },
  ],
  stoneTypes: [
    { id: "lab-diamond", name: "Lab-grown diamond", color: "#ffffff", pricePerCarat: [500, 1200] },
    { id: "natural-diamond", name: "Natural diamond", color: "#ffffff", pricePerCarat: [3500, 8000] },
    { id: "moissanite", name: "Moissanite", color: "#f4fbff", pricePerCarat: [300, 600] },
    { id: "sapphire", name: "Sapphire", color: "#2350c8", pricePerCarat: [400, 1500] },
    { id: "ruby", name: "Ruby", color: "#b3123a", pricePerCarat: [500, 2000] },
    { id: "emerald-stone", name: "Emerald", color: "#1f9d5a", pricePerCarat: [400, 1500] },
    { id: "morganite", name: "Morganite", color: "#f2b8b0", pricePerCarat: [80, 300] },
  ],
};

export const DEFAULT_CONFIG: RingConfig = {
  bandProfile: "comfort",
  bandWidthMm: 4,
  bandThicknessMm: 1.8,
  metal: "yellow-gold-14k",
  finish: "polished",
  sizeUs: 7,
  setting: "solitaire-4",
  stoneShape: "round",
  stoneType: "lab-diamond",
  carat: 1,
  engraving: "",
};

export const LIMITS = {
  bandWidthMm: { min: 2, max: 8, step: 0.5 },
  bandThicknessMm: { min: 1.4, max: 2.4, step: 0.1 },
  sizeUs: { min: 3, max: 13, step: 0.25 },
  carat: { min: 0.25, max: 3, step: 0.05 },
  engravingMaxLength: 30,
} as const;

// ---------- reading catalog rows from the database ----------

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function range(value: unknown, fallback: PriceRange): PriceRange {
  if (Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === "number" && Number.isFinite(v))) {
    return [value[0] as number, value[1] as number];
  }
  return fallback;
}

/** Builds a catalog from catalog_options rows; any empty category falls back to the default. */
export function catalogFromRows(rows: CatalogRow[]): Catalog {
  const sorted = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const out: Catalog = { metals: [], finishes: [], bandProfiles: [], settings: [], stoneShapes: [], stoneTypes: [] };

  for (const row of sorted) {
    const p = asRecord(row.params);
    const base: BasicOption = { id: row.id, name: row.name };
    switch (row.category) {
      case "metal":
        out.metals.push({
          ...base,
          color: str(p.color, "#d4af37"),
          density: num(p.density, 13.1),
          pricePerGram: range(p.pricePerGram, [75, 110]),
        } satisfies MetalOption);
        break;
      case "finish":
        out.finishes.push({ ...base, roughness: num(p.roughness, 0.15) } satisfies FinishOption);
        break;
      case "band_profile":
        out.bandProfiles.push(base);
        break;
      case "setting":
        out.settings.push({
          ...base,
          needsStone: p.needsStone !== false,
          laborUsd: range(p.laborUsd, [250, 500]),
          metalGrams: num(p.metalGrams, 0),
          extraStoneCarat: num(p.extraStoneCarat, 0),
          sideStoneRatio: num(p.sideStoneRatio, 0),
        } satisfies SettingOption);
        break;
      case "stone_shape":
        out.stoneShapes.push(base);
        break;
      case "stone_type":
        out.stoneTypes.push({
          ...base,
          color: str(p.color, "#ffffff"),
          pricePerCarat: range(p.pricePerCarat, [500, 1200]),
        } satisfies StoneTypeOption);
        break;
    }
  }

  return {
    metals: out.metals.length ? out.metals : DEFAULT_CATALOG.metals,
    finishes: out.finishes.length ? out.finishes : DEFAULT_CATALOG.finishes,
    bandProfiles: out.bandProfiles.length ? out.bandProfiles : DEFAULT_CATALOG.bandProfiles,
    settings: out.settings.length ? out.settings : DEFAULT_CATALOG.settings,
    stoneShapes: out.stoneShapes.length ? out.stoneShapes : DEFAULT_CATALOG.stoneShapes,
    stoneTypes: out.stoneTypes.length ? out.stoneTypes : DEFAULT_CATALOG.stoneTypes,
  };
}

// ---------- making any saved or stored config safe to use ----------

function clamp(value: number, min: number, max: number, step: number): number {
  const stepped = Math.round((value - min) / step) * step + min;
  return Math.min(max, Math.max(min, Number(stepped.toFixed(4))));
}

/** Fills gaps with defaults, drops unknown options and keeps numbers in range. */
export function normalizeConfig(raw: unknown, catalog: Catalog): RingConfig {
  const r = asRecord(raw);

  const pick = (key: keyof RingConfig, options: BasicOption[]): string => {
    const value = r[key];
    if (typeof value === "string" && options.some((o) => o.id === value)) return value;
    const fallback = DEFAULT_CONFIG[key];
    return options.find((o) => o.id === fallback)?.id ?? options[0].id;
  };

  const number = (key: "bandWidthMm" | "bandThicknessMm" | "sizeUs" | "carat"): number => {
    const { min, max, step } = LIMITS[key];
    const value = r[key];
    return typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max, step) : DEFAULT_CONFIG[key];
  };

  const engraving = typeof r.engraving === "string" ? r.engraving.slice(0, LIMITS.engravingMaxLength) : "";

  return {
    bandProfile: pick("bandProfile", catalog.bandProfiles),
    bandWidthMm: number("bandWidthMm"),
    bandThicknessMm: number("bandThicknessMm"),
    metal: pick("metal", catalog.metals),
    finish: pick("finish", catalog.finishes),
    sizeUs: number("sizeUs"),
    setting: pick("setting", catalog.settings),
    stoneShape: pick("stoneShape", catalog.stoneShapes),
    stoneType: pick("stoneType", catalog.stoneTypes),
    carat: number("carat"),
    engraving,
  };
}

export function findOption<T extends BasicOption>(options: T[], id: string): T {
  return options.find((o) => o.id === id) ?? options[0];
}
