// src/three/zones/zoneDetector.js - БҮРЭН ЗАСВАРЛАСАН
import * as THREE from 'three';

/**
 * Build print zone data from mesh geometry
 * @param {THREE.Mesh} mesh - Print zone mesh
 * @param {string} side - Zone identifier (front, back, left_arm, right_arm)
 * @param {Object} opts - Options {uvAttr: string}
 * @returns {Object} Zone data with UV bounds and outline
 */
export function buildPrintZoneFromMesh(mesh, side = 'front', opts = {}) {
  if (!mesh || !mesh.geometry) return null;

  const geom = mesh.geometry;

  // ✅ UV attribute санаачлах
  const uvAttr = opts.uvAttr || (geom.attributes.uv ? "uv" : (geom.attributes.uv2 ? "uv2" : "uv"));
  const uv = geom.attributes?.[uvAttr];

  if (!uv) {
    console.warn(`[zoneDetector] No ${uvAttr} for zone ${side} on mesh ${mesh.name}`);
    return null;
  }

  // 1. Quantile-based bounds (wrap-around fix-тэй)
  const us = [];
  const vs = [];
  
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    us.push(u);
    vs.push(v);
  }

  if (us.length === 0) {
    console.warn(`[zoneDetector] No valid UVs for ${side}`);
    return null;
  }

  us.sort((a, b) => a - b);
  vs.sort((a, b) => a - b);

  const quantile = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * (arr.length - 1))))];

  let uMin = quantile(us, 0.01);
  let uMax = quantile(us, 0.99);
  let vMin = quantile(vs, 0.01);
  let vMax = quantile(vs, 0.99);

  // UV wrap fix (0.0 ↔ 1.0 transition)
  if ((uMax - uMin) > 0.7) {
    const us2 = us.map(u => (u < 0.5 ? u + 1 : u)).sort((a, b) => a - b);
    uMin = quantile(us2, 0.02);
    uMax = quantile(us2, 0.98);
    uMin = (uMin > 1 ? uMin - 1 : uMin);
    uMax = (uMax > 1 ? uMax - 1 : uMax);
  }

  // ✅ 2. Build polygon outline (Vanilla JS логик)
  const outline = buildUVOutlineFromMesh(mesh, uvAttr);

  // ✅ 3. Outline олдвол bounds-ийг outline-аас авах
  if (outline && outline.length > 0) {
    const outUs = outline.map(p => p.u);
    const outVs = outline.map(p => p.v);
    
    uMin = Math.min(...outUs);
    uMax = Math.max(...outUs);
    vMin = Math.min(...outVs);
    vMax = Math.max(...outVs);
  }

  // ✅ 4. Blocker outline (Шар гурвалжинг арилгахын тулд null болгосон)
  // Хуучин код: const blockerOutline = detectBlockerOutline(geom, uv, { uMin, uMax, vMin, vMax }, outline);
  const blockerOutline = null; 

  // ✅ 5. Correction rotation
  const correctionRad = getCorrectionRotation(side);

  return {
    key: side,
    side,
    uMin, uMax, vMin, vMax,
    
    // ✅ Polygon outline (NOT rectangle)
    outline,
    blockerOutline,
    
    // ✅ Aliases (for compatibility)
    poly: outline,
    points: outline,
    
    uvAttr,
    correctionRad,
    mesh,
    name: mesh.name || side,
  };
}

/**
 * ✅ Build UV outline from mesh boundary (Vanilla JS логик)
 * @param {THREE.Mesh} mesh - Mesh
 * @param {string} uvAttr - UV attribute name
 * @returns {Array|null} Outline points [{u, v}, ...]
 */
function buildUVOutlineFromMesh(mesh, uvAttr = 'uv') {
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  const uv = geom.attributes[uvAttr];
  const index = geom.index;

  if (!pos || !uv || !index) {
    console.warn('[buildUVOutlineFromMesh] Missing position/uv/index');
    return null;
  }

  // 1) Count triangle edges
  const edgeCount = new Map();
  const keyEdge = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

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

  // 2) Collect boundary edges (count === 1)
  const boundary = [];
  for (const [k, c] of edgeCount.entries()) {
    if (c === 1) {
      const [a, b] = k.split('_').map(Number);
      boundary.push([a, b]);
    }
  }
  
  if (boundary.length < 3) {
    console.warn('[buildUVOutlineFromMesh] Not enough boundary edges:', boundary.length);
    return null;
  }

  // 3) Build adjacency map
  const adj = new Map();
  const addAdj = (a, b) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push(b);
  };
  
  boundary.forEach(([a, b]) => {
    addAdj(a, b);
    addAdj(b, a);
  });

  // 4) Walk to form a loop
  const start = boundary[0][0];
  const loop = [start];
  let curr = start;
  let prev = null;

  for (let guard = 0; guard < 10000; guard++) {
    const nbrs = adj.get(curr) || [];
    const next = (nbrs[0] === prev) ? nbrs[1] : nbrs[0];
    
    if (next == null) break;
    if (next === start) break;
    
    loop.push(next);
    prev = curr;
    curr = next;
  }

  // 5) Convert indices -> UV points
  const pts = loop.map((vi) => ({ 
    u: uv.getX(vi), 
    v: uv.getY(vi)
  }));

  if (pts.length < 3) {
    console.warn('[buildUVOutlineFromMesh] Loop too short:', pts.length);
    return null;
  }

  return pts;
}

/**
 * Detect blocker outline (neck, armholes) - (NOT USED ANYMORE)
 */
function detectBlockerOutline(geom, uv, bounds, mainOutline) {
  const threshold = bounds.vMax - (bounds.vMax - bounds.vMin) * 0.15;
  
  const blockerPoints = [];
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    
    if (v > threshold) {
      blockerPoints.push({ u, v });
    }
  }

  if (blockerPoints.length < 3) return null;

  const uVals = blockerPoints.map(p => p.u);
  const vVals = blockerPoints.map(p => p.v);
  
  const bMin = Math.min(...uVals);
  const bMax = Math.max(...uVals);
  
  const uCenter = (bMin + bMax) / 2;
  const neckDepth = (bounds.vMax - bounds.vMin) * 0.12;
  
  return [
    { u: bMin, v: bounds.vMax },
    { u: uCenter, v: bounds.vMax - neckDepth },
    { u: bMax, v: bounds.vMax },
  ];
}

/**
 * Get rotation correction for specific zones
 * @param {string} side - Zone key
 * @returns {number} Rotation in radians
 */
function getCorrectionRotation(side) {
  const corrections = {
    front: 0,
    // ✅ ЗАСВАР: Ар тал доошоо харж байсныг зассан (Math.PI -> 0)
    back: 0, 
    left_arm: THREE.MathUtils.degToRad(10),   // 10° clockwise
    right_arm: THREE.MathUtils.degToRad(-10), // 10° counter-clockwise
  };
  return corrections[side] || 0;
}

/**
 * Check if UV point is inside print zone
 */
export function isUVInsidePrintZone(uv, zone, pad = 0) {
  if (!zone || !uv) return false;
  
  return (
    uv.x >= zone.uMin + pad &&
    uv.x <= zone.uMax - pad &&
    uv.y >= zone.vMin + pad &&
    uv.y <= zone.vMax - pad
  );
}

/**
 * Get zone at UV coordinates
 */
export function getZoneAtUV(uv, zones) {
  for (const [key, zone] of Object.entries(zones)) {
    if (isUVInsidePrintZone(uv, zone)) {
      return key;
    }
  }
  return null;
}

/**
 * Convert UV coordinates to zone-local coordinates (0-1)
 */
export function uvToZoneLocal(uv, zone) {
  if (!zone) return { u: 0, v: 0 };
  
  const u = (uv.x - zone.uMin) / Math.max(1e-6, zone.uMax - zone.uMin);
  const v = (uv.y - zone.vMin) / Math.max(1e-6, zone.vMax - zone.vMin);
  
  return { 
    u: Math.max(0, Math.min(1, u)), 
    v: Math.max(0, Math.min(1, v)) 
  };
}

/**
 * Convert zone-local coordinates to absolute UV
 */
export function zoneLocalToUV(local, zone) {
  if (!zone) return { x: 0, y: 0 };
  
  const x = zone.uMin + local.u * (zone.uMax - zone.uMin);
  const y = zone.vMin + local.v * (zone.vMax - zone.vMin);
  
  return { x, y };
}