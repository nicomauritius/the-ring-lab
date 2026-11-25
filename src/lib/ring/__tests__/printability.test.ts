import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG, DEFAULT_CONFIG, LIMITS } from "../catalog";
import { headDimensions, MIN_WIRE_DIAMETER_MM, STONE_SHAPES } from "../geometry";
import { checkPrintability } from "../printability";
import type { RingConfig } from "../types";

const catalog = DEFAULT_CATALOG;

describe("checkPrintability", () => {
  it("passes the default design", () => {
    expect(checkPrintability(DEFAULT_CONFIG, catalog)).toEqual([]);
  });

  // Every option at the extremes of every slider must be castable, or customers hit dead ends.
  it("passes every catalog combination at the slider limits", () => {
    const failures: string[] = [];
    for (const bandProfile of catalog.bandProfiles.map((o) => o.id))
      for (const setting of catalog.settings.map((o) => o.id))
        for (const stoneShape of catalog.stoneShapes.map((o) => o.id))
          for (const carat of [LIMITS.carat.min, LIMITS.carat.max])
            for (const bandThicknessMm of [LIMITS.bandThicknessMm.min, LIMITS.bandThicknessMm.max])
              for (const sizeUs of [LIMITS.sizeUs.min, LIMITS.sizeUs.max]) {
                const config: RingConfig = { ...DEFAULT_CONFIG, bandProfile, setting, stoneShape, carat, bandThicknessMm, sizeUs };
                const issues = checkPrintability(config, catalog);
                if (issues.length) failures.push(`${JSON.stringify(config)}: ${issues.map((i) => i.message).join("; ")}`);
              }
    expect(failures).toEqual([]);
  });

  it("blocks a band thinner than the minimum wall", () => {
    const issues = checkPrintability({ ...DEFAULT_CONFIG, bandProfile: "knife", bandThicknessMm: 1 }, catalog);
    expect(issues.map((i) => i.part)).toContain("band");
  });
});

describe("headDimensions", () => {
  it.each(Object.keys(STONE_SHAPES))("keeps %s prongs castable after stretching", (shape) => {
    const dims = headDimensions(4, shape);
    expect(2 * dims.prongRadius * dims.squeeze).toBeGreaterThanOrEqual(MIN_WIRE_DIAMETER_MM - 1e-9);
  });
});
