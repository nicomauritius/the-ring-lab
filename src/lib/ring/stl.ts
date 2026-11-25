/** Largest STL the export accepts. A detailed ring is about 2 MB. */
export const MAX_STL_BYTES = 15 * 1024 * 1024;
/** No coordinate of a ring is farther than this from its center, in mm. */
const MAX_COORDINATE_MM = 60;

export type StlCheck = { ok: true; triangles: number } | { ok: false; reason: string };

/**
 * Checks that bytes are a binary STL of a plausible ring: the triangle count matches the
 * file size and every coordinate is a finite number within a ring-sized box (in mm).
 */
export function checkBinaryStl(bytes: ArrayBuffer): StlCheck {
  if (bytes.byteLength > MAX_STL_BYTES) return { ok: false, reason: "The STL file is too large." };
  if (bytes.byteLength < 84) return { ok: false, reason: "The STL file is empty." };

  const view = new DataView(bytes);
  const triangles = view.getUint32(80, true);
  if (triangles === 0) return { ok: false, reason: "The STL file has no triangles." };
  if (bytes.byteLength !== 84 + triangles * 50) return { ok: false, reason: "The STL file is not a binary STL." };

  for (let t = 0; t < triangles; t++) {
    const base = 84 + t * 50 + 12; // Skip the facet normal; check the three vertices.
    for (let k = 0; k < 9; k++) {
      const value = view.getFloat32(base + k * 4, true);
      if (!Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE_MM) {
        return { ok: false, reason: "The STL file has coordinates outside a ring's size." };
      }
    }
  }
  return { ok: true, triangles };
}
