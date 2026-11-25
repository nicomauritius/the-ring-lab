"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { findOption } from "@/lib/ring/catalog";
import {
  bandProfile,
  HALO_FRAME_RADIUS_MM,
  HALO_MELEE_MM,
  headDimensions,
  STONE_PROPORTIONS,
  stoneProfile,
  stoneShapeSpec,
  type Point,
} from "@/lib/ring/geometry";
import { innerDiameterMm, stoneDiameterMm } from "@/lib/ring/sizing";
import type { Catalog, RingConfig } from "@/lib/ring/types";

type Vec3 = [number, number, number];

const toVectors = (points: Point[]) => points.map((p) => new THREE.Vector2(p.x, p.y));

/** Disposes a three.js object when it is replaced or unmounted. */
function useDisposable<T extends { dispose: () => void }>(value: T): T {
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

/**
 * The ring in millimetres. The band is revolved around Y, then turned so the finger hole
 * faces the camera (along Z) and the top of the ring points up (+Y).
 */
const METAL = { part: "metal" } as const;
const STONE = { part: "stone" } as const;

export function RingModel({
  config,
  catalog,
  groupRef,
}: {
  config: RingConfig;
  catalog: Catalog;
  groupRef?: React.Ref<THREE.Group>;
}) {
  const metal = findOption(catalog.metals, config.metal);
  const finish = findOption(catalog.finishes, config.finish);
  const stoneType = findOption(catalog.stoneTypes, config.stoneType);
  const setting = findOption(catalog.settings, config.setting);

  const band = useMemo(
    () =>
      bandProfile(
        config.bandProfile,
        innerDiameterMm(config.sizeUs) / 2,
        config.bandThicknessMm,
        config.bandWidthMm,
      ),
    [config.bandProfile, config.sizeUs, config.bandThicknessMm, config.bandWidthMm],
  );

  const bandGeometry = useDisposable(useMemo(() => new THREE.LatheGeometry(toVectors(band.points), 160), [band]));

  const metalMaterial = useDisposable(
    useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: metal.color,
          metalness: 1,
          roughness: finish.roughness,
          side: THREE.DoubleSide,
          envMapIntensity: 1.3,
        }),
      [metal.color, finish.roughness],
    ),
  );

  const stoneMaterial = useDisposable(
    useMemo(
      () =>
        new THREE.MeshPhysicalMaterial({
          color: stoneType.color,
          metalness: 0,
          roughness: 0,
          transmission: 1,
          thickness: 1.5,
          ior: 2.33,
          specularIntensity: 1,
          envMapIntensity: 2.5,
          flatShading: true,
        }),
      [stoneType.color],
    ),
  );

  const diameter = stoneDiameterMm(config.carat);
  const head = { shape: config.stoneShape, baseY: band.topRadius, metal: metalMaterial, stone: stoneMaterial };

  let settingNode: React.ReactNode = null;
  if (setting.needsStone) {
    switch (setting.id) {
      case "solitaire-6":
        settingNode = <Head {...head} diameter={diameter} kind="prong6" />;
        break;
      case "bezel":
        settingNode = <Head {...head} diameter={diameter} kind="bezel" />;
        break;
      case "halo":
        settingNode = <Head {...head} diameter={diameter} kind="prong4" halo />;
        break;
      case "three-stone": {
        const side = diameter * 0.65;
        const lift = band.topRadius + STONE_PROPORTIONS.pavilion * diameter;
        const angle = (diameter * 0.5 * stoneShapeSpec(config.stoneShape).scaleX + side * 0.5 + 0.5) / lift;
        settingNode = (
          <>
            <Head {...head} diameter={diameter} kind="prong4" />
            <group rotation={[0, 0, -angle]}>
              <Head {...head} diameter={side} kind="prong4" />
            </group>
            <group rotation={[0, 0, angle]}>
              <Head {...head} diameter={side} kind="prong4" />
            </group>
          </>
        );
        break;
      }
      default:
        settingNode = <Head {...head} diameter={diameter} kind="prong4" />;
    }
  }

  return (
    <group ref={groupRef}>
      <mesh geometry={bandGeometry} material={metalMaterial} rotation={[-Math.PI / 2, 0, 0]} userData={METAL} />
      {settingNode}
    </group>
  );
}

interface HeadProps {
  diameter: number;
  shape: string;
  kind: "prong4" | "prong6" | "bezel";
  /** Height of the band's outer surface where the head sits. */
  baseY: number;
  metal: THREE.Material;
  stone: THREE.Material;
  halo?: boolean;
}

/** A stone and the metal that holds it, sitting on top of the band. */
function Head({ diameter: d, shape, kind, baseY, metal, stone, halo }: HeadProps) {
  const spec = stoneShapeSpec(shape);
  const p = STONE_PROPORTIONS;
  const pavilion = p.pavilion * d;
  const girdle = p.girdle * d;
  const crown = p.crown * d;

  const seatY = kind === "bezel" ? baseY + pavilion * 0.75 : baseY + pavilion + 0.4;
  const base = baseY - seatY - 0.3; // band surface, in the head's local space
  const { prongRadius, galleryRadius, bezelWall } = headDimensions(d, shape);

  const stoneGeometry = useDisposable(
    useMemo(() => new THREE.LatheGeometry(toVectors(stoneProfile(d)), spec.segments), [d, spec.segments]),
  );

  const bezelTop = girdle + crown * 0.3;
  const bezelSegments = spec.segments <= 8 ? spec.segments : 48;
  const bezelGeometry = useDisposable(
    useMemo(() => {
      // A solid cup wall: outer face up, inner face down, so the wall has real thickness for casting.
      const top = d / 2 + 0.4;
      const bottom = d * 0.32;
      return new THREE.LatheGeometry(
        [
          new THREE.Vector2(bottom, base),
          new THREE.Vector2(top, bezelTop),
          new THREE.Vector2(top - bezelWall, bezelTop),
          new THREE.Vector2(bottom - bezelWall, base),
          new THREE.Vector2(bottom, base),
        ],
        bezelSegments,
      );
    }, [d, base, bezelTop, bezelSegments, bezelWall]),
  );

  let mount: React.ReactNode;
  if (kind === "bezel") {
    mount = (
      <mesh geometry={bezelGeometry} material={metal} rotation={[0, spec.rotation, 0]} userData={METAL} />
    );
  } else {
    const count = kind === "prong6" ? 6 : 4;
    const offset = count === 4 ? Math.PI / 4 : 0;
    mount = (
      <>
        {Array.from({ length: count }, (_, i) => {
          const a = offset + (i * 2 * Math.PI) / count;
          const c = Math.cos(a);
          const s = Math.sin(a);
          const from: Vec3 = [c * d * 0.22, base, s * d * 0.22];
          const mid: Vec3 = [c * d * 0.52, 0, s * d * 0.52];
          const tip: Vec3 = [c * d * 0.48, girdle + crown * 0.45, s * d * 0.48];
          return (
            <group key={i}>
              <Strut from={from} to={mid} radius={prongRadius} material={metal} />
              <Strut from={mid} to={tip} radius={prongRadius} material={metal} />
              <mesh material={metal} position={mid} userData={METAL}>
                <sphereGeometry args={[prongRadius, 12, 8]} />
              </mesh>
              <mesh material={metal} position={tip} userData={METAL}>
                <sphereGeometry args={[prongRadius * 1.15, 12, 8]} />
              </mesh>
            </group>
          );
        })}
        <mesh material={metal} position={[0, -pavilion * 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} userData={METAL}>
          <torusGeometry args={[d * 0.3, galleryRadius, 10, 48]} />
        </mesh>
      </>
    );
  }

  return (
    <>
      <group position={[0, seatY, 0]} scale={[spec.scaleX, 1, spec.scaleZ]}>
        <mesh geometry={stoneGeometry} material={stone} rotation={[0, spec.rotation, 0]} userData={STONE} />
        {mount}
      </group>
      {halo && (
        <Halo
          y={seatY + girdle}
          radiusX={(d / 2) * spec.scaleX + 0.85}
          radiusZ={(d / 2) * spec.scaleZ + 0.85}
          metal={metal}
          stone={stone}
        />
      )}
    </>
  );
}

/** A cylinder between two points. */
function Strut({ from, to, radius, material }: { from: Vec3; to: Vec3; radius: number; material: THREE.Material }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = new THREE.Vector3().subVectors(b, a);
    const len = direction.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    return { position: center, quaternion: q, length: len };
  }, [from, to]);

  return (
    <mesh material={material} position={position} quaternion={quaternion} userData={METAL}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
    </mesh>
  );
}

/** A ring of small stones around the center stone, on a thin metal frame. */
function Halo({
  y,
  radiusX,
  radiusZ,
  metal,
  stone,
}: {
  y: number;
  radiusX: number;
  radiusZ: number;
  metal: THREE.Material;
  stone: THREE.Material;
}) {
  const { positions, frame, meleeGeometry } = useMemo(() => {
    const perimeter = Math.PI * (3 * (radiusX + radiusZ) - Math.sqrt((3 * radiusX + radiusZ) * (radiusX + 3 * radiusZ)));
    const count = Math.max(10, Math.round(perimeter / (HALO_MELEE_MM * 1.1)));
    const pts: Vec3[] = Array.from({ length: count }, (_, i) => {
      const a = (i * 2 * Math.PI) / count;
      return [Math.cos(a) * radiusX, y, Math.sin(a) * radiusZ];
    });
    const path = new THREE.CatmullRomCurve3(
      Array.from({ length: 64 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 64;
        return new THREE.Vector3(Math.cos(a) * radiusX, y - HALO_MELEE_MM * 0.45, Math.sin(a) * radiusZ);
      }),
      true,
    );
    return {
      positions: pts,
      frame: new THREE.TubeGeometry(path, 128, HALO_FRAME_RADIUS_MM, 10, true),
      meleeGeometry: new THREE.LatheGeometry(toVectors(stoneProfile(HALO_MELEE_MM)), 8),
    };
  }, [y, radiusX, radiusZ]);

  useDisposable(frame);
  useDisposable(meleeGeometry);

  return (
    <group>
      <mesh geometry={frame} material={metal} userData={METAL} />
      {positions.map((pos, i) => (
        <mesh key={i} geometry={meleeGeometry} material={stone} position={pos} userData={STONE} />
      ))}
    </group>
  );
}
