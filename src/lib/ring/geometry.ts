/**
 * Pure geometry for the ring, in millimetres. No three.js here so it can run anywhere.
 * Profiles are drawn in the (x = distance from the ring's axis, y = along the axis) plane
 * and revolved around the axis to make the band or a stone.
 */

export interface Point {
  x: number;
  y: number;
}

export interface BandShape {
  /** Closed cross-section, first point repeated at the end. */
  points: Point[];
  /** Outer radius at the top centre of the band, where a setting sits. */
  topRadius: number;
  /** Largest outer radius anywhere on the band. */
  outerRadius: number;
  /** Thinnest radial wall across the middle half of the band's width, in mm. */
  minWallMm: number;
}

type ProfileFn = { inner: (u: number) => number; outer: (u: number) => number };

/** Each function returns a multiple of the band thickness, for u from -1 (one edge) to 1 (other edge). */
const PROFILES: Record<string, ProfileFn> = {
  flat: { inner: (u) => 0.04 * u ** 8, outer: (u) => 1 - 0.18 * u ** 8 },
  comfort: { inner: (u) => 0.3 * u * u, outer: (u) => 1 - 0.15 * u ** 4 },
  dome: { inner: (u) => 0.03 * u ** 8, outer: (u) => 0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - u * u)) },
  knife: { inner: () => 0, outer: (u) => 0.45 + 0.85 * (1 - Math.abs(u)) },
  square: { inner: () => 0, outer: () => 1.15 },
};

export function bandProfile(profileId: string, innerRadius: number, thickness: number, width: number): BandShape {
  const fn = PROFILES[profileId] ?? PROFILES.comfort;
  const steps = 40;
  const points: Point[] = [];
  let outerRadius = 0;
  let minWallMm = Infinity;

  for (let i = 0; i <= steps; i++) {
    const u = -1 + (2 * i) / steps;
    const x = innerRadius + thickness * fn.outer(u);
    outerRadius = Math.max(outerRadius, x);
    // The edges of rounded and knife-edge profiles taper by design, so only the middle half counts.
    if (Math.abs(u) <= 0.5) minWallMm = Math.min(minWallMm, thickness * (fn.outer(u) - fn.inner(u)));
    points.push({ x, y: (u * width) / 2 });
  }
  for (let i = steps; i >= 0; i--) {
    const u = -1 + (2 * i) / steps;
    points.push({ x: innerRadius + thickness * fn.inner(u), y: (u * width) / 2 });
  }
  points.push({ ...points[0] });

  return { points, topRadius: innerRadius + thickness * fn.outer(0), outerRadius, minWallMm };
}

/** Volume of a closed profile revolved around the y axis (Pappus's theorem), in mm³. */
export function revolvedVolumeMm3(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const cross = a.x * b.y - b.x * a.y;
    sum += (a.x + b.x) * cross;
  }
  return Math.abs((2 * Math.PI * sum) / 6);
}

/** Proportions of a stone, as multiples of its girdle diameter. */
export const STONE_PROPORTIONS = { pavilion: 0.43, girdle: 0.02, crown: 0.16, tableRadius: 0.28 };

/** Half-profile of a brilliant-style stone from culet to table; girdle bottom sits at y = 0. */
export function stoneProfile(diameter: number): Point[] {
  const p = STONE_PROPORTIONS;
  const d = diameter;
  return [
    { x: 0, y: -p.pavilion * d },
    { x: d / 2, y: 0 },
    { x: d / 2, y: p.girdle * d },
    { x: p.tableRadius * d, y: (p.girdle + p.crown) * d },
    { x: 0, y: (p.girdle + p.crown) * d },
  ];
}

export interface StoneShapeSpec {
  /** Number of sides when revolved: few sides give square or octagonal outlines. */
  segments: number;
  /** Rotation around the stone's axis, in radians. */
  rotation: number;
  /** Stretch across the finger. */
  scaleX: number;
  /** Stretch along the finger. */
  scaleZ: number;
}

export const STONE_SHAPES: Record<string, StoneShapeSpec> = {
  round: { segments: 16, rotation: 0, scaleX: 1, scaleZ: 1 },
  oval: { segments: 16, rotation: 0, scaleX: 0.88, scaleZ: 1.3 },
  princess: { segments: 4, rotation: Math.PI / 4, scaleX: 1.15, scaleZ: 1.15 },
  cushion: { segments: 8, rotation: Math.PI / 8, scaleX: 1, scaleZ: 1 },
  emerald: { segments: 8, rotation: Math.PI / 8, scaleX: 0.9, scaleZ: 1.3 },
  marquise: { segments: 16, rotation: 0, scaleX: 0.72, scaleZ: 1.75 },
};

export function stoneShapeSpec(shapeId: string): StoneShapeSpec {
  return STONE_SHAPES[shapeId] ?? STONE_SHAPES.round;
}

// ---------- metal around the stone ----------

/** Thinnest prong or gallery wire a wax print and casting hold reliably, in mm. */
export const MIN_WIRE_DIAMETER_MM = 0.9;
/** Thinnest bezel wall that casts cleanly, in mm. */
export const MIN_BEZEL_WALL_MM = 0.8;
/** Size of the small halo stones, in mm. */
export const HALO_MELEE_MM = 1.3;
/** Radius of the tube that carries the halo stones, in mm. */
export const HALO_FRAME_RADIUS_MM = HALO_MELEE_MM * 0.42;

export interface HeadDimensions {
  /** Prong wire radius before the head is stretched to the stone's shape. */
  prongRadius: number;
  /** Radius of the gallery ring under the stone, before stretching. */
  galleryRadius: number;
  /** Bezel wall thickness before stretching. */
  bezelWall: number;
  /** The smallest stretch applied to the head (below 1 for long shapes such as marquise). */
  squeeze: number;
}

/**
 * Metal sizes for a head holding a stone of this girdle diameter and shape. The head is
 * stretched to the stone's outline, which thins the metal across the narrow side, so the
 * sizes are made larger up front to stay castable after stretching.
 */
export function headDimensions(diameter: number, shapeId: string): HeadDimensions {
  const spec = stoneShapeSpec(shapeId);
  const squeeze = Math.min(1, spec.scaleX, spec.scaleZ);
  const minRadius = MIN_WIRE_DIAMETER_MM / 2 / squeeze;
  return {
    prongRadius: Math.max(minRadius, diameter * 0.06),
    galleryRadius: Math.max(minRadius, diameter * 0.04),
    bezelWall: MIN_BEZEL_WALL_MM / squeeze,
    squeeze,
  };
}
