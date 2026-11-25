import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { describe, expect, it } from "vitest";
import { checkBinaryStl } from "../stl";

function stlOf(mesh: THREE.Mesh): ArrayBuffer {
  const view = new STLExporter().parse(mesh, { binary: true }) as DataView;
  return view.buffer as ArrayBuffer;
}

describe("checkBinaryStl", () => {
  it("accepts a ring-sized binary STL", () => {
    const result = checkBinaryStl(stlOf(new THREE.Mesh(new THREE.TorusGeometry(9, 1, 8, 32))));
    expect(result).toEqual({ ok: true, triangles: 8 * 32 * 2 });
  });

  it("rejects text, truncated files and files too big for a ring", () => {
    expect(checkBinaryStl(new TextEncoder().encode("solid ring\nendsolid ring\n").buffer as ArrayBuffer).ok).toBe(false);
    const good = stlOf(new THREE.Mesh(new THREE.TorusGeometry(9, 1, 8, 32)));
    expect(checkBinaryStl(good.slice(0, good.byteLength - 10)).ok).toBe(false);
    expect(checkBinaryStl(stlOf(new THREE.Mesh(new THREE.TorusGeometry(200, 1, 8, 32)))).ok).toBe(false);
  });
});
