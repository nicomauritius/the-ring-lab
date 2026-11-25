import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface SurfaceReport {
  /** Edges used by only one triangle: holes in the surface. */
  openEdges: number;
  /** Edges shared by three or more triangles: surfaces that touch in a way a printer can't resolve. */
  nonManifoldEdges: number;
}

/**
 * Checks that a mesh is a closed surface (watertight), which wax printers need to know
 * what is inside the metal. Vertices at the same spot are welded first, because three.js
 * shapes repeat vertices along seams.
 */
export function checkClosedSurface(geometry: THREE.BufferGeometry, tolerance = 1e-4): SurfaceReport {
  const positionsOnly = new THREE.BufferGeometry();
  positionsOnly.setAttribute("position", geometry.getAttribute("position"));
  if (geometry.index) positionsOnly.setIndex(geometry.index);

  const welded = mergeVertices(positionsOnly, tolerance);
  const index = welded.index;
  const vertexCount = welded.getAttribute("position").count;
  welded.dispose();
  positionsOnly.dispose();
  if (!index) return { openEdges: 0, nonManifoldEdges: 0 };

  const edges = new Map<number, number>();
  const addEdge = (a: number, b: number) => {
    const key = a < b ? a * vertexCount + b : b * vertexCount + a;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  };

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    // Triangles squashed to a line or a point (for example at a sphere's poles) add no surface.
    if (a === b || b === c || a === c) continue;
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }

  let openEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edges.values()) {
    if (count === 1) openEdges++;
    else if (count > 2) nonManifoldEdges++;
  }
  return { openEdges, nonManifoldEdges };
}

/** Checks every metal part under a root object; returns how many parts are not closed. */
export function countOpenMetalParts(root: THREE.Object3D): number {
  let open = 0;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.part !== "metal") return;
    const report = checkClosedSurface(mesh.geometry);
    if (report.openEdges > 0 || report.nonManifoldEdges > 0) open++;
  });
  return open;
}
