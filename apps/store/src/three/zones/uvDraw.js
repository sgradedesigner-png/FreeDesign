// src/three/zones/uvDraw.js
// ✅ REACT руу шилжүүлсэн

/**
 * Draw mesh UV coordinates on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {THREE.Mesh} mesh - Mesh to draw
 * @param {Object} opts - Options {canvasW, canvasH, stroke, fill, lineWidth}
 */
export function drawMeshUV(ctx, mesh, {
  canvasW,
  canvasH,
  stroke = null,
  fill = 'rgba(120,170,255,0.18)',
  lineWidth = 1
} = {}) {
  if (!mesh?.geometry) return;

  const geom = mesh.geometry;
  const uv = geom.attributes.uv || geom.attributes.uv2;
  const pos = geom.attributes.position;
  
  if (!pos || !uv) return;

  const index = geom.index ? geom.index.array : null;
  const triCount = index ? index.length / 3 : pos.count / 3;

  ctx.save();
  ctx.fillStyle = fill;

  // Draw all triangles
  ctx.beginPath();
  for (let i = 0; i < triCount; i++) {
    const ia = index ? index[i * 3] : i * 3;
    const ib = index ? index[i * 3 + 1] : i * 3 + 1;
    const ic = index ? index[i * 3 + 2] : i * 3 + 2;

    const ax = uv.getX(ia) * canvasW;
    const ay = (1 - uv.getY(ia)) * canvasH;
    const bx = uv.getX(ib) * canvasW;
    const by = (1 - uv.getY(ib)) * canvasH;
    const cx = uv.getX(ic) * canvasW;
    const cy = (1 - uv.getY(ic)) * canvasH;

    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
  }

  ctx.fill();

  // Draw stroke if specified
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw zone outline on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} outline - Array of {u, v} points
 * @param {Object} opts - Options {canvasW, canvasH, stroke, lineWidth, fill}
 */
export function drawZoneOutline(ctx, outline, {
  canvasW,
  canvasH,
  stroke = '#00ff00',
  lineWidth = 2,
  fill = null
} = {}) {
  if (!outline || outline.length < 3) return;

  ctx.save();
  ctx.beginPath();

  const first = outline[0];
  ctx.moveTo(first.u * canvasW, (1 - first.v) * canvasH);

  for (let i = 1; i < outline.length; i++) {
    const p = outline[i];
    ctx.lineTo(p.u * canvasW, (1 - p.v) * canvasH);
  }

  ctx.closePath();

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw UV grid on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} opts - Options {canvasW, canvasH, divisions, stroke, lineWidth}
 */
export function drawUVGrid(ctx, {
  canvasW,
  canvasH,
  divisions = 10,
  stroke = 'rgba(0,0,0,0.1)',
  lineWidth = 1
} = {}) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;

  // Vertical lines
  for (let i = 0; i <= divisions; i++) {
    const x = (i / divisions) * canvasW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasH);
    ctx.stroke();
  }

  // Horizontal lines
  for (let i = 0; i <= divisions; i++) {
    const y = (i / divisions) * canvasH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasW, y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw UV point marker
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} uv - {x, y} UV coordinates
 * @param {Object} opts - Options {canvasW, canvasH, color, radius}
 */
export function drawUVPoint(ctx, uv, {
  canvasW,
  canvasH,
  color = '#ff0000',
  radius = 5
} = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(
    uv.x * canvasW,
    (1 - uv.y) * canvasH,
    radius,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}