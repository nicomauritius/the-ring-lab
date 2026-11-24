import { findOption } from "./catalog";
import { bandProfile, STONE_PROPORTIONS, stoneShapeSpec } from "./geometry";
import { estimatePrice } from "./price";
import { euSize, formatUsSize, innerDiameterMm, stoneDiameterMm } from "./sizing";
import type { Catalog, RingConfig } from "./types";

export interface SpecLine {
  label: string;
  value: string;
}

/** The manufacturing spec sent with the STL: everything a lab or jeweler needs that the mesh doesn't say. */
export function buildSpec(config: RingConfig, catalog: Catalog): SpecLine[] {
  const metal = findOption(catalog.metals, config.metal);
  const finish = findOption(catalog.finishes, config.finish);
  const profile = findOption(catalog.bandProfiles, config.bandProfile);
  const setting = findOption(catalog.settings, config.setting);
  const inner = innerDiameterMm(config.sizeUs);
  const band = bandProfile(config.bandProfile, inner / 2, config.bandThicknessMm, config.bandWidthMm);
  const { metalGrams } = estimatePrice(config, catalog);

  const lines: SpecLine[] = [
    { label: "Ring size", value: `US ${formatUsSize(config.sizeUs)} · EU ${euSize(config.sizeUs)}` },
    { label: "Inner diameter", value: `${inner.toFixed(2)} mm` },
    { label: "Outer diameter", value: `${(band.outerRadius * 2).toFixed(2)} mm` },
    { label: "Band profile", value: profile.name },
    { label: "Band width", value: `${config.bandWidthMm.toFixed(1)} mm` },
    { label: "Band thickness", value: `${config.bandThicknessMm.toFixed(1)} mm` },
    { label: "Metal", value: metal.name },
    { label: "Finish", value: finish.name },
    { label: "Estimated metal weight", value: `${metalGrams.toFixed(1)} g` },
    { label: "Setting", value: setting.name },
  ];

  if (setting.needsStone) {
    const shape = findOption(catalog.stoneShapes, config.stoneShape);
    const stone = findOption(catalog.stoneTypes, config.stoneType);
    const spec = stoneShapeSpec(config.stoneShape);
    const d = stoneDiameterMm(config.carat);
    const width = d * spec.scaleX;
    const length = d * spec.scaleZ;
    const depth = d * (STONE_PROPORTIONS.pavilion + STONE_PROPORTIONS.girdle + STONE_PROPORTIONS.crown);
    lines.push(
      { label: "Center stone", value: `${stone.name}, ${shape.name.toLowerCase()}, ${config.carat.toFixed(2)} ct` },
      {
        label: "Stone size (approx.)",
        value: `${length.toFixed(1)} × ${width.toFixed(1)} × ${depth.toFixed(1)} mm (length × width × depth)`,
      },
    );
    if (setting.sideStoneRatio > 0) {
      lines.push({ label: "Side stones", value: `2 × ${((setting.sideStoneRatio / 2) * config.carat).toFixed(2)} ct` });
    }
    if (setting.extraStoneCarat > 0) {
      lines.push({ label: "Halo stones", value: `about ${setting.extraStoneCarat.toFixed(2)} ct total, 1.3 mm melee` });
    }
  }

  lines.push({ label: "Engraving", value: config.engraving ? `“${config.engraving}”` : "None" });
  lines.push({ label: "STL contents", value: "Metal only, in millimetres. Stones are not included." });
  return lines;
}

export function specAsText(name: string, lines: SpecLine[]): string {
  const width = Math.max(...lines.map((l) => l.label.length));
  return [`The Ring Lab · ${name}`, "", ...lines.map((l) => `${l.label.padEnd(width)}  ${l.value}`), ""].join("\n");
}
