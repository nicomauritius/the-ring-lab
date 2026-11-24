import { findOption } from "./catalog";
import { bandProfile, revolvedVolumeMm3 } from "./geometry";
import { innerDiameterMm } from "./sizing";
import type { Catalog, PriceRange, RingConfig } from "./types";

export interface PriceEstimate {
  range: PriceRange;
  metalGrams: number;
  totalCarat: number;
}

/**
 * A rough price range from the catalog's placeholder prices. The real price comes from
 * jeweler quotes; this only helps customers see how their choices move the cost.
 */
export function estimatePrice(config: RingConfig, catalog: Catalog): PriceEstimate {
  const metal = findOption(catalog.metals, config.metal);
  const setting = findOption(catalog.settings, config.setting);
  const stone = findOption(catalog.stoneTypes, config.stoneType);

  const band = bandProfile(
    config.bandProfile,
    innerDiameterMm(config.sizeUs) / 2,
    config.bandThicknessMm,
    config.bandWidthMm,
  );
  const bandGrams = (revolvedVolumeMm3(band.points) / 1000) * metal.density;
  const metalGrams = bandGrams + setting.metalGrams;

  const totalCarat = setting.needsStone
    ? config.carat + setting.extraStoneCarat + setting.sideStoneRatio * config.carat
    : 0;

  const at = (i: 0 | 1) =>
    metalGrams * metal.pricePerGram[i] + totalCarat * stone.pricePerCarat[i] + setting.laborUsd[i];

  const round = (n: number) => Math.round(n / 10) * 10;
  return { range: [round(at(0)), round(at(1))], metalGrams, totalCarat };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatUsd(amount: number): string {
  return usd.format(amount);
}
