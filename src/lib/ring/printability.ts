import { findOption } from "./catalog";
import {
  bandProfile,
  HALO_FRAME_RADIUS_MM,
  headDimensions,
  MIN_BEZEL_WALL_MM,
  MIN_WIRE_DIAMETER_MM,
} from "./geometry";
import { innerDiameterMm, stoneDiameterMm } from "./sizing";
import type { Catalog, RingConfig } from "./types";

/** Thinnest band wall that casts and wears well, in mm. */
export const MIN_BAND_WALL_MM = 1.2;

export interface PrintIssue {
  part: "band" | "prongs" | "bezel" | "halo";
  message: string;
}

// Rounding in the geometry should not fail a design that sits exactly on a limit.
const EPSILON = 1e-6;

const mm = (value: number) => `${value.toFixed(2)} mm`;

/**
 * Checks the measurements that decide whether a ring can be printed in wax and cast.
 * Pure arithmetic on the design, so it runs the same in the browser and on the server.
 * An empty list means the design is fine.
 */
export function checkPrintability(config: RingConfig, catalog: Catalog): PrintIssue[] {
  const issues: PrintIssue[] = [];
  const setting = findOption(catalog.settings, config.setting);
  const profile = findOption(catalog.bandProfiles, config.bandProfile);

  const band = bandProfile(
    config.bandProfile,
    innerDiameterMm(config.sizeUs) / 2,
    config.bandThicknessMm,
    config.bandWidthMm,
  );
  if (band.minWallMm < MIN_BAND_WALL_MM - EPSILON) {
    issues.push({
      part: "band",
      message: `The ${profile.name.toLowerCase()} band is ${mm(band.minWallMm)} thick at its thinnest; it needs at least ${mm(MIN_BAND_WALL_MM)}. Make the band thicker.`,
    });
  }

  if (!setting.needsStone) return issues;

  const heads: { label: string; diameter: number }[] = [{ label: "center stone", diameter: stoneDiameterMm(config.carat) }];
  if (setting.id === "three-stone") heads.push({ label: "side stones", diameter: stoneDiameterMm(config.carat) * 0.65 });

  for (const head of heads) {
    const dims = headDimensions(head.diameter, config.stoneShape);
    if (setting.id === "bezel") {
      const wall = dims.bezelWall * dims.squeeze;
      if (wall < MIN_BEZEL_WALL_MM - EPSILON) {
        issues.push({
          part: "bezel",
          message: `The bezel wall is ${mm(wall)}; it needs at least ${mm(MIN_BEZEL_WALL_MM)}.`,
        });
      }
      // The bezel cup narrows towards the band; its wall must not close up the opening.
      if (head.diameter * 0.32 - dims.bezelWall <= 0) {
        issues.push({ part: "bezel", message: "The stone is too small for a bezel this thick. Choose a larger stone." });
      }
    } else {
      const prong = 2 * dims.prongRadius * dims.squeeze;
      const gallery = 2 * dims.galleryRadius * dims.squeeze;
      const thinnest = Math.min(prong, gallery);
      if (thinnest < MIN_WIRE_DIAMETER_MM - EPSILON) {
        issues.push({
          part: "prongs",
          message: `The prongs on the ${head.label} are ${mm(thinnest)} thick; they need at least ${mm(MIN_WIRE_DIAMETER_MM)}.`,
        });
      }
    }
  }

  if (setting.id === "halo" && 2 * HALO_FRAME_RADIUS_MM < MIN_WIRE_DIAMETER_MM - EPSILON) {
    issues.push({
      part: "halo",
      message: `The halo frame is ${mm(2 * HALO_FRAME_RADIUS_MM)} thick; it needs at least ${mm(MIN_WIRE_DIAMETER_MM)}.`,
    });
  }

  return issues;
}
