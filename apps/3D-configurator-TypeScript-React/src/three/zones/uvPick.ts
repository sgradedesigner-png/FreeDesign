// src/three/zones/uvPick.ts
import * as THREE from 'three';

/** Barycentric coordinates */
interface Barycentric {
  u: number;
  v: number;
  w: number;
}

/** UV pick result */
export interface UVPickResult {
  object: THREE.Mesh;
  point: THREE.Vector3;
  pointLocal: THREE.Vector3;
  uv: THREE.Vector2;
  barycentric: Barycentric;
  face: { normal: THREE.Vector3 };
  normalWorld: THREE.Vector3 | null;
  _nearestFallback?: boolean;
}

/** UV pick options */
export interface UVPickOptions {
  uvAttr?: string;
  wantWorldNormal?: boolean;
}

function barycentricFromUV(
  ua: THREE.Vector2,
  ub: THREE.Vector2,
  uc: THREE.Vector2,
  p: THREE.Vector2,
  eps = 1e-6
): Barycentric | null {
  const v0 = new THREE.Vector2().subVectors(ub, ua);
  const v1 = new THREE.Vector2().subVectors(uc, ua);
  const v2 = new THREE.Vector2().subVectors(p, ua);

  const d00 = v0.dot(v0);
  const d01 = v0.dot(v1);
  const d11 = v1.dot(v1);
  const d20 = v2.dot(v0);
  const d21 = v2.dot(v1);

  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < eps) return null;

  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  const u = 1 - v - w;

  const tol = 2e-5;
  if (u >= -tol && v >= -tol && w >= -tol) return { u, v, w };
  return null;
}

function closestPointOnUVTriangle(
  ua: THREE.Vector2,
  ub: THREE.Vector2,
  uc: THREE.Vector2,
  p: THREE.Vector2
): { bc: Barycentric; dist2: number } {
  const v0 = new THREE.Vector2().subVectors(ub, ua);
  const v1 = new THREE.Vector2().subVectors(uc, ua);
  const v2 = new THREE.Vector2().subVectors(p, ua);

  const d00 = v0.dot(v0);
  const d01 = v0.dot(v1);
  const d11 = v1.dot(v1);
  const d20 = v2.dot(v0);
  const d21 = v2.dot(v1);

  const denom = d00 * d11 - d01 * d01;
  if (denom <= 1e-12) {
    return { bc: { u: 1, v: 0, w: 0 }, dist2: Infinity };
  }

  let v = (d11 * d20 - d01 * d21) / denom;
  let w = (d00 * d21 - d01 * d20) / denom;
  let u = 1 - v - w;

  // Clamp to triangle
  if (u < 0 || v < 0 || w < 0) {
    u = Math.max(0, u);
    v = Math.max(0, v);
    w = Math.max(0, w);
    const s = u + v + w || 1;
    u /= s;
    v /= s;
    w /= s;
  }

  const q = new THREE.Vector2()
    .addScaledVector(ua, u)
    .addScaledVector(ub, v)
    .addScaledVector(uc, w);

  const dist2 = q.distanceToSquared(p);
  return { bc: { u, v, w }, dist2 };
}

function pickOnGeometryByUV(
  geometry: THREE.BufferGeometry,
  mesh: THREE.Mesh,
  targetUV: THREE.Vector2,
  opts: UVPickOptions = {}
): UVPickResult | null {
  const uvAttrName =
    opts.uvAttr ||
    (geometry.attributes.uv ? 'uv' : geometry.attributes.uv2 ? 'uv2' : null);
  const uv = uvAttrName
    ? (geometry.attributes[uvAttrName] as THREE.BufferAttribute)
    : null;
  const pos = geometry.attributes.position as THREE.BufferAttribute;

  if (!pos || !uv || uv.itemSize !== 2) return null;

  const index = geometry.index;
  const indexArray = index?.array as Uint16Array | Uint32Array | null;
  const triCount = indexArray ? indexArray.length / 3 : pos.count / 3;

  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const pc = new THREE.Vector3();
  const ua = new THREE.Vector2();
  const ub = new THREE.Vector2();
  const uc = new THREE.Vector2();

  const wantWorldNormal = !!opts.wantWorldNormal;
  const normalMatrix = wantWorldNormal
    ? new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
    : null;

  // First pass: exact hit
  for (let i = 0; i < triCount; i++) {
    const ia = indexArray ? indexArray[i * 3] : i * 3;
    const ib = indexArray ? indexArray[i * 3 + 1] : i * 3 + 1;
    const ic = indexArray ? indexArray[i * 3 + 2] : i * 3 + 2;

    ua.set(uv.getX(ia), uv.getY(ia));
    ub.set(uv.getX(ib), uv.getY(ib));
    uc.set(uv.getX(ic), uv.getY(ic));

    // Quick bbox check
    const minU = Math.min(ua.x, ub.x, uc.x) - 2e-5;
    const maxU = Math.max(ua.x, ub.x, uc.x) + 2e-5;
    const minV = Math.min(ua.y, ub.y, uc.y) - 2e-5;
    const maxV = Math.max(ua.y, ub.y, uc.y) + 2e-5;
    const u = targetUV.x;
    const v = targetUV.y;
    if (u < minU || u > maxU || v < minV || v > maxV) continue;

    const bc = barycentricFromUV(ua, ub, uc, targetUV);
    if (!bc) continue;

    pa.set(pos.getX(ia), pos.getY(ia), pos.getZ(ia));
    pb.set(pos.getX(ib), pos.getY(ib), pos.getZ(ib));
    pc.set(pos.getX(ic), pos.getY(ic), pos.getZ(ic));

    const pLocal = new THREE.Vector3()
      .addScaledVector(pa, bc.u)
      .addScaledVector(pb, bc.v)
      .addScaledVector(pc, bc.w);

    const nLocal = new THREE.Vector3()
      .subVectors(pb, pa)
      .cross(new THREE.Vector3().subVectors(pc, pa))
      .normalize();

    const pWorld = pLocal.clone().applyMatrix4(mesh.matrixWorld);
    let nWorld: THREE.Vector3 | null = null;
    if (wantWorldNormal && normalMatrix) {
      nWorld = nLocal.clone().applyMatrix3(normalMatrix).normalize();
    }

    return {
      object: mesh,
      point: pWorld,
      pointLocal: pLocal,
      uv: targetUV.clone(),
      barycentric: bc,
      face: { normal: nLocal },
      normalWorld: nWorld,
    };
  }

  // Second pass: nearest triangle fallback
  let best = {
    dist2: Infinity,
    bc: null as Barycentric | null,
    ia: 0,
    ib: 0,
    ic: 0,
  };

  for (let i = 0; i < triCount; i++) {
    const ia = indexArray ? indexArray[i * 3] : i * 3;
    const ib = indexArray ? indexArray[i * 3 + 1] : i * 3 + 1;
    const ic = indexArray ? indexArray[i * 3 + 2] : i * 3 + 2;

    ua.set(uv.getX(ia), uv.getY(ia));
    ub.set(uv.getX(ib), uv.getY(ib));
    uc.set(uv.getX(ic), uv.getY(ic));

    const { bc, dist2 } = closestPointOnUVTriangle(ua, ub, uc, targetUV);
    if (dist2 < best.dist2) {
      best = { dist2, bc, ia, ib, ic };
    }
  }

  if (best.bc) {
    const { ia, ib, ic, bc } = best;

    pa.set(pos.getX(ia), pos.getY(ia), pos.getZ(ia));
    pb.set(pos.getX(ib), pos.getY(ib), pos.getZ(ib));
    pc.set(pos.getX(ic), pos.getY(ic), pos.getZ(ic));

    const pLocal = new THREE.Vector3()
      .addScaledVector(pa, bc.u)
      .addScaledVector(pb, bc.v)
      .addScaledVector(pc, bc.w);

    const nLocal = new THREE.Vector3()
      .subVectors(pb, pa)
      .cross(new THREE.Vector3().subVectors(pc, pa))
      .normalize();

    const pWorld = pLocal.clone().applyMatrix4(mesh.matrixWorld);
    let nWorld: THREE.Vector3 | null = null;
    if (wantWorldNormal && normalMatrix) {
      nWorld = nLocal.clone().applyMatrix3(normalMatrix).normalize();
    }

    return {
      object: mesh,
      point: pWorld,
      pointLocal: pLocal,
      uv: targetUV.clone(),
      barycentric: bc,
      face: { normal: nLocal },
      normalWorld: nWorld,
      _nearestFallback: true,
    };
  }

  return null;
}

/**
 * Pick 3D point on mesh by UV coordinates
 */
export function pickOnMeshByUV(
  mesh: THREE.Object3D,
  targetUV: THREE.Vector2,
  opts: UVPickOptions = {}
): UVPickResult | null {
  let hit: UVPickResult | null = null;

  // Try specified UV channel
  mesh.traverse((o) => {
    if (hit) return;
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    hit = pickOnGeometryByUV(m.geometry, m, targetUV, {
      uvAttr: opts.uvAttr || 'uv',
      wantWorldNormal: opts.wantWorldNormal,
    });
  });

  if (hit) return hit;

  // Fallback to uv2
  if (!opts.uvAttr) {
    mesh.traverse((o) => {
      if (hit) return;
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.attributes?.uv2) return;
      hit = pickOnGeometryByUV(m.geometry, m, targetUV, {
        uvAttr: 'uv2',
        wantWorldNormal: opts.wantWorldNormal,
      });
    });
  }

  return hit;
}
