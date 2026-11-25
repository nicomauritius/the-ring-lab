import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { bandProfile, HALO_FRAME_RADIUS_MM } from "../geometry";
import { checkClosedSurface } from "../mesh-check";

const closed = { openEdges: 0, nonManifoldEdges: 0 };
const lathe = (points: { x: number; y: number }[], segments: number) =>
  new THREE.LatheGeometry(
    points.map((p) => new THREE.Vector2(p.x, p.y)),
    segments,
  );

describe("checkClosedSurface", () => {
  it.each(["comfort", "flat", "dome", "knife", "square"])("finds the %s band closed", (profile) => {
    const band = bandProfile(profile, 8.6, 1.4, 4);
    expect(checkClosedSurface(lathe(band.points, 160))).toEqual(closed);
  });

  it.each([4, 8, 48])("finds a bezel wall with %i sides closed", (segments) => {
    const wall = [
      { x: 1.3, y: -2 },
      { x: 2.4, y: 0.5 },
      { x: 1.6, y: 0.5 },
      { x: 0.5, y: -2 },
      { x: 1.3, y: -2 },
    ];
    expect(checkClosedSurface(lathe(wall, segments))).toEqual(closed);
  });

  it("finds the parts used for prongs, galleries and halos closed", () => {
    const path = new THREE.CatmullRomCurve3(
      Array.from({ length: 64 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 64;
        return new THREE.Vector3(Math.cos(a) * 4, 0, Math.sin(a) * 5);
      }),
      true,
    );
    const parts = [
      new THREE.CylinderGeometry(0.45, 0.45, 3, 12),
      new THREE.SphereGeometry(0.45, 12, 8),
      new THREE.TorusGeometry(1.5, 0.45, 10, 48),
      new THREE.TubeGeometry(path, 128, HALO_FRAME_RADIUS_MM, 10, true),
    ];
    for (const part of parts) expect(checkClosedSurface(part)).toEqual(closed);
  });

  it("reports holes in an open surface", () => {
    const report = checkClosedSurface(new THREE.CylinderGeometry(1, 1, 2, 12, 1, true));
    expect(report.openEdges).toBe(24);
  });

  it("reports a single flat triangle as open", () => {
    expect(checkClosedSurface(new THREE.PlaneGeometry(1, 1)).openEdges).toBe(4);
  });
});
