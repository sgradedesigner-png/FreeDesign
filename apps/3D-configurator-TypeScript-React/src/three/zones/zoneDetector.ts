// src/three/zones/zoneDetector.ts
import * as THREE from 'three';
import type { ZoneKey, ZoneRect, UVPoint } from '../../types/zone';

/**
 * Build UV outline from mesh boundary edges
 */
function buildUVOutlineFromMesh(mesh: THREE.Mesh): UVPoint[] | null {
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  const index = geom.index;

  if (!pos || !uv || !index) return null;

  // Count triangle edges
  const edgeCount = new Map<string, number>();
  const keyEdge = (a: number, b: number): string =>
    a < b ? `${a}_${b}` : `${b}_${a}`;

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    const e1 = keyEdge(a, b);
    const e2 = keyEdge(b, c);
    const e3 = keyEdge(c, a);
    edgeCount.set(e1, (edgeCount.get(e1) || 0) + 1);
    edgeCount.set(e2, (edgeCount.get(e2) || 0) + 1);
    edgeCount.set(e3, (edgeCount.get(e3) || 0) + 1);
  }

  // Collect boundary edges (edges shared by only one triangle)
  const boundary: [number, number][] = [];
  for (const [k, c] of edgeCount.entries()) {
    if (c === 1) {
      const [a, b] = k.split('_').map(Number);
      boundary.push([a, b]);
    }
  }
  if (boundary.length < 3) return null;

  // Build adjacency
  const adj = new Map<number, number[]>();
  const addAdj = (a: number, b: number): void => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  };
  boundary.forEach(([a, b]) => {
    addAdj(a, b);
    addAdj(b, a);
  });

  // Walk to form a loop
  const start = boundary[0][0];
  const loop: number[] = [start];
  let curr = start;
  let prev: number | null = null;

  for (let guard = 0; guard < 10000; guard++) {
    const nbrs = adj.get(curr) || [];
    const next = nbrs[0] === prev ? nbrs[1] : nbrs[0];
    if (next == null) break;
    if (next === start) break;
    loop.push(next);
    prev = curr;
    curr = next;
  }

  // Convert indices to UV points
  const pts: UVPoint[] = loop.map((vi) => ({
    u: uv.getX(vi),
    v: uv.getY(vi),
  }));

  return pts.length >= 3 ? pts : null;
}

/**
 * Build print zone rect from mesh UV coordinates
 */
export function buildPrintZoneFromMesh(
  mesh: THREE.Mesh | null,
  side: ZoneKey = 'front'
): ZoneRect {
  const geom = mesh?.geometry;
  const uv = geom?.attributes?.uv as THREE.BufferAttribute | undefined;

  // Fallback if no UV
  if (!uv) {
    return {
      uMin: 0.25,
      uMax: 0.75,
      vMin: 0.2,
      vMax: 0.85,
      outline: null,
      name: 'fallback',
      side,
      correctionRad: 0,
    };
  }

  const us: number[] = [];
  const vs: number[] = [];
  for (let i = 0; i < uv.count; i++) {
    us.push(uv.getX(i));
    vs.push(uv.getY(i));
  }

  us.sort((a, b) => a - b);
  vs.sort((a, b) => a - b);

  const q = (arr: number[], p: number): number =>
    arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * (arr.length - 1))))];

  // Initial calculation
  let uMin = q(us, 0.01);
  let uMax = q(us, 0.99);
  let vMin = q(vs, 0.01);
  let vMax = q(vs, 0.99);

  // UV wrap fix
  if (uMax - uMin > 0.7) {
    const us2 = us.map((u) => (u < 0.5 ? u + 1 : u)).sort((a, b) => a - b);
    uMin = q(us2, 0.02);
    uMax = q(us2, 0.98);
    uMin = uMin > 1 ? uMin - 1 : uMin;
    uMax = uMax > 1 ? uMax - 1 : uMax;
  }

  // Build outline
  const outline = mesh ? buildUVOutlineFromMesh(mesh) : null;

  // Match green box to outline
  if (outline && outline.length > 0) {
    const outUs = outline.map((p) => p.u);
    const outVs = outline.map((p) => p.v);

    uMin = Math.min(...outUs);
    uMax = Math.max(...outUs);
    vMin = Math.min(...outVs);
    vMax = Math.max(...outVs);
  }

  // Correction angle for arms (to make artwork appear upright on angled sleeves)
  // These values were tuned to match the T-shirt model's sleeve angles
  let correctionRad = 0;
  if (side === 'right_arm') {
    correctionRad = THREE.MathUtils.degToRad(-25);
  } else if (side === 'left_arm') {
    correctionRad = THREE.MathUtils.degToRad(25);
  }

  return {
    uMin,
    uMax,
    vMin,
    vMax,
    outline,
    name: mesh?.name || side,
    side,
    correctionRad,
  };
}

/**
 * Check if UV point is inside print zone
 */
export function isUVInsidePrintZone(
  uv: { x: number; y: number } | null,
  zone: ZoneRect | null,
  pad = 0
): boolean {
  if (!uv || !zone) return false;
  const { x: u, y: v } = uv;
  return (
    u >= zone.uMin + pad &&
    u <= zone.uMax - pad &&
    v >= zone.vMin + pad &&
    v <= zone.vMax - pad
  );
}
