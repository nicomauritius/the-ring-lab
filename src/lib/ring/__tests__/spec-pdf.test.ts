import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG, DEFAULT_CONFIG } from "../catalog";
import { buildSpec } from "../spec";
import { buildSpecPdf, pdfSafe } from "../spec-pdf";

describe("buildSpecPdf", () => {
  it("makes a one-page PDF even with an engraving the fonts can't draw", async () => {
    const lines = buildSpec({ ...DEFAULT_CONFIG, engraving: "Toujours ❤ 永远 · ¼" }, DEFAULT_CATALOG);
    const bytes = await buildSpecPdf({ designName: "Léa’s ring 💍", designId: "abc", version: 3, lines });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toContain("v3");
  });

  it("keeps Latin-1 characters and replaces the rest", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(pdfSafe("Café × ¼ ❤", font)).toBe("Café × ¼ ?");
  });
});
