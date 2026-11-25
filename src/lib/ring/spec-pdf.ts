import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import type { SpecLine } from "./spec";

export interface SpecPdfInput {
  designName: string;
  designId: string;
  version: number;
  lines: SpecLine[];
  /** PNG thumbnail of the design, if one was saved. */
  previewPng?: Uint8Array | null;
  createdAt?: Date;
}

const INK = rgb(0.18, 0.18, 0.15);
const MUTED = rgb(0.42, 0.4, 0.36);
const LINE = rgb(0.87, 0.85, 0.8);

/** Replaces characters the built-in PDF fonts can't draw (emoji, most non-Latin scripts) with "?". */
export function pdfSafe(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text.replace(/[‘’]/g, "'"))
    .map((ch) => (supported.has(ch.codePointAt(0) ?? 0) ? ch : "?"))
    .join("");
}

/** Splits text into lines that fit a width. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** A one-page US Letter spec sheet sent to the wax lab with the STL. */
export async function buildSpecPdf(input: SpecPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.designName} — specification v${input.version}`);
  pdf.setProducer("The Ring Lab");
  pdf.setCreationDate(input.createdAt ?? new Date());

  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);

  const margin = 54;
  const right = 612 - margin;
  let y = 792 - margin;

  page.drawText("THE RING LAB · MANUFACTURING SPECIFICATION", { x: margin, y, size: 8, font: bold, color: MUTED });
  y -= 34;
  page.drawText(pdfSafe(input.designName, serif), { x: margin, y, size: 26, font: serif, color: INK });
  y -= 22;

  const date = (input.createdAt ?? new Date()).toISOString().slice(0, 10);
  const meta = `Design ${input.designId} · Version ${input.version} · ${date}`;
  page.drawText(meta, { x: margin, y, size: 9, font: regular, color: MUTED });
  y -= 18;
  page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 0.75, color: LINE });
  y -= 18;

  if (input.previewPng) {
    try {
      const image = await pdf.embedPng(input.previewPng);
      const maxW = right - margin;
      const maxH = 230;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, { x: margin + (maxW - w) / 2, y: y - h, width: w, height: h });
      y -= h + 18;
    } catch {
      // An unreadable thumbnail should never stop the spec sheet.
    }
  }

  const labelWidth = 150;
  const valueX = margin + labelWidth;
  const valueWidth = right - valueX;
  const size = 10.5;
  const leading = 15;

  for (const line of input.lines) {
    const valueLines = wrap(pdfSafe(line.value, regular), regular, size, valueWidth);
    page.drawText(pdfSafe(line.label, bold), { x: margin, y, size, font: bold, color: INK });
    valueLines.forEach((text, i) => {
      page.drawText(text, { x: valueX, y: y - i * leading, size, font: regular, color: INK });
    });
    y -= valueLines.length * leading + 5;
    if (y < margin + 40) break; // One page; the spec is far shorter than this in practice.
  }

  page.drawLine({ start: { x: margin, y: margin + 22 }, end: { x: right, y: margin + 22 }, thickness: 0.75, color: LINE });
  page.drawText(
    "All dimensions in millimetres. The STL holds the metal only; stones are set by the jeweler. Questions: reply to the order email.",
    { x: margin, y: margin + 8, size: 7.5, font: regular, color: MUTED },
  );

  return pdf.save();
}
