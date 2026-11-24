import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

/**
 * Builds a binary STL of the metal parts only (no stones), in millimetres,
 * with every part placed exactly where it sits in the preview.
 */
export function exportMetalStl(root: THREE.Object3D): ArrayBuffer {
  root.updateMatrixWorld(true);
  const parts = new THREE.Group();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.part !== "metal") return;
    const copy = new THREE.Mesh(mesh.geometry);
    copy.matrixAutoUpdate = false;
    copy.matrix.copy(mesh.matrixWorld);
    parts.add(copy);
  });

  parts.updateMatrixWorld(true);
  const result = new STLExporter().parse(parts, { binary: true }) as DataView;
  return result.buffer as ArrayBuffer;
}
