export type PriceRange = [number, number];

export type CatalogCategory = "metal" | "finish" | "band_profile" | "setting" | "stone_shape" | "stone_type";

export interface BasicOption {
  id: string;
  name: string;
}

export interface MetalOption extends BasicOption {
  /** Hex color used for the 3D material. */
  color: string;
  /** Density in g/cm³, used to estimate weight. */
  density: number;
  /** Rough price per gram in USD, low and high. */
  pricePerGram: PriceRange;
}

export interface FinishOption extends BasicOption {
  /** 0 = mirror polish, 1 = fully matte. */
  roughness: number;
}

export interface SettingOption extends BasicOption {
  needsStone: boolean;
  /** Rough labor cost in USD, low and high. */
  laborUsd: PriceRange;
  /** Extra metal for the head, in grams. */
  metalGrams: number;
  /** Fixed extra carats (for example halo stones). */
  extraStoneCarat: number;
  /** Extra carats as a share of the center stone (for example side stones). */
  sideStoneRatio: number;
}

export interface StoneTypeOption extends BasicOption {
  color: string;
  /** Rough price per carat in USD, low and high. */
  pricePerCarat: PriceRange;
}

export interface Catalog {
  metals: MetalOption[];
  finishes: FinishOption[];
  bandProfiles: BasicOption[];
  settings: SettingOption[];
  stoneShapes: BasicOption[];
  stoneTypes: StoneTypeOption[];
}

/** Everything a customer chooses. Saved as JSON in designs.config. */
export interface RingConfig {
  bandProfile: string;
  bandWidthMm: number;
  bandThicknessMm: number;
  metal: string;
  finish: string;
  sizeUs: number;
  setting: string;
  stoneShape: string;
  stoneType: string;
  carat: number;
  engraving: string;
}

export interface CatalogRow {
  id: string;
  category: string;
  name: string;
  params: unknown;
  sort_order?: number | null;
}
