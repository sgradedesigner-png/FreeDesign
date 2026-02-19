#!/usr/bin/env node
/*
  Extract garment bounds from PNG mockups.
  - Detects foreground garment via background-difference mask
  - Applies simple 3x3 closing (dilate then erode)
  - Keeps largest connected component
  - Writes markdown summary for overlay anchors
*/

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const INPUT_CANDIDATES = [
  path.join(ROOT, 'apps', 'admin', 'Blank Print Products'),
  path.join(ROOT, 'admin', 'DTF_Print_Field_Assets'),
  path.join(ROOT, 'apps', 'admin', 'src', 'assets', 'DTF_Print_Field_Assets'),
  path.join(ROOT, 'apps', 'admin', 'DTF_Print_Field_Assets'),
];
const OUTPUT_MD = path.join(ROOT, 'admin', 'ActualGarmentSize.md');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function findInputDir() {
  for (const dir of INPUT_CANDIDATES) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
  }
  return null;
}

function walkPngs(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.png')) out.push(full);
    }
  }
  out.sort((a, b) => {
    const ra = path.relative(dir, a).replace(/\\/g, '/');
    const rb = path.relative(dir, b).replace(/\\/g, '/');
    const da = ra.includes('/') ? ra.split('/').slice(0, -1).join('/') : '';
    const db = rb.includes('/') ? rb.split('/').slice(0, -1).join('/') : '';
    if (da === db) return ra.localeCompare(rb);
    return da.localeCompare(db);
  });
  return out;
}

function avgCorners(raw, width, height, patch = 40) {
  const channels = 4;
  const patches = [
    [0, 0],
    [Math.max(0, width - patch), 0],
    [0, Math.max(0, height - patch)],
    [Math.max(0, width - patch), Math.max(0, height - patch)],
  ];

  let r = 0, g = 0, b = 0, c = 0;
  for (const [sx, sy] of patches) {
    for (let y = sy; y < Math.min(height, sy + patch); y++) {
      for (let x = sx; x < Math.min(width, sx + patch); x++) {
        const i = (y * width + x) * channels;
        r += raw[i];
        g += raw[i + 1];
        b += raw[i + 2];
        c += 1;
      }
    }
  }

  return {
    r: c ? r / c : 0,
    g: c ? g / c : 0,
    b: c ? b / c : 0,
  };
}

function buildMask(raw, width, height, bg, thresh) {
  const channels = 4;
  const n = width * height;
  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * channels;
    const a = raw[i + 3];
    if (a === 0) continue;
    const diff = Math.abs(raw[i] - bg.r) + Math.abs(raw[i + 1] - bg.g) + Math.abs(raw[i + 2] - bg.b);
    if (diff > thresh) mask[p] = 1;
  }
  return mask;
}

function dilate(mask, w, h) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          if (mask[ny * w + nx]) {
            on = 1;
            break;
          }
        }
      }
      out[y * w + x] = on;
    }
  }
  return out;
}

function erode(mask, w, h) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 1;
      for (let dy = -1; dy <= 1 && on; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) {
          on = 0;
          break;
        }
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w || !mask[ny * w + nx]) {
            on = 0;
            break;
          }
        }
      }
      out[y * w + x] = on;
    }
  }
  return out;
}

function closeMask(mask, w, h) {
  return erode(dilate(mask, w, h), w, h);
}

function largestComponent(mask, w, h) {
  const n = w * h;
  const visited = new Uint8Array(n);
  const q = new Int32Array(n);

  let bestArea = 0;
  let bestMinX = 0;
  let bestMinY = 0;
  let bestMaxX = -1;
  let bestMaxY = -1;

  for (let i = 0; i < n; i++) {
    if (!mask[i] || visited[i]) continue;

    let head = 0;
    let tail = 0;
    q[tail++] = i;
    visited[i] = 1;

    let area = 0;
    let minX = w, minY = h, maxX = -1, maxY = -1;

    while (head < tail) {
      const cur = q[head++];
      const y = Math.floor(cur / w);
      const x = cur - y * w;

      area++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      // 4-neighborhood
      const neighbors = [cur - 1, cur + 1, cur - w, cur + w];
      for (const ni of neighbors) {
        if (ni < 0 || ni >= n) continue;
        const ny = Math.floor(ni / w);
        const nx = ni - ny * w;
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        if (!mask[ni] || visited[ni]) continue;
        visited[ni] = 1;
        q[tail++] = ni;
      }
    }

    if (area > bestArea) {
      bestArea = area;
      bestMinX = minX;
      bestMinY = minY;
      bestMaxX = maxX;
      bestMaxY = maxY;
    }
  }

  if (bestArea === 0) return null;
  return {
    minX: bestMinX,
    minY: bestMinY,
    maxX: bestMaxX,
    maxY: bestMaxY,
    area: bestArea,
  };
}

function detectBounds(raw, width, height) {
  const bg = avgCorners(raw, width, height, 40);
  const tries = [80, 60, 40, 100, 140];
  const n = width * height;

  let best = null;

  for (const t of tries) {
    let mask = buildMask(raw, width, height, bg, t);
    mask = closeMask(mask, width, height);
    const comp = largestComponent(mask, width, height);
    if (!comp) continue;

    const ratio = comp.area / n;
    const candidate = { ...comp, ratio, thresh: t };

    if (!best) {
      best = candidate;
    } else {
      const bestValid = best.ratio >= 0.005 && best.ratio <= 0.95;
      const curValid = ratio >= 0.005 && ratio <= 0.95;
      if ((curValid && !bestValid) || (curValid === bestValid && comp.area > best.area)) {
        best = candidate;
      }
    }
  }

  return best;
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function toRow(rel, imgW, imgH, b) {
  const widthPx = b.maxX - b.minX + 1;
  const heightPx = b.maxY - b.minY + 1;

  const centerX = b.minX + widthPx / 2;
  const centerY = b.minY + heightPx / 2;

  const safeW = widthPx * 0.9;
  const safeH = heightPx * 0.9;
  const safeMinX = centerX - safeW / 2;
  const safeMinY = centerY - safeH / 2;
  const safeMaxX = centerX + safeW / 2;
  const safeMaxY = centerY + safeH / 2;

  return {
    file: rel,
    imgPx: `${imgW}x${imgH}`,
    boxPx: `(${b.minX},${b.minY})-(${b.maxX},${b.maxY})`,
    boxWh: `${widthPx}x${heightPx}`,
    center: `(${fmt(centerX)},${fmt(centerY)})`,
    safeFrame: `(${fmt(safeMinX)},${fmt(safeMinY)})-(${fmt(safeMaxX)},${fmt(safeMaxY)})`,
    folder: rel.includes('/') ? rel.split('/')[0] : 'root',
  };
}

function buildMarkdown(rows, sourceDir) {
  const lines = [];
  lines.push('# Actual Garment Size Report');
  lines.push('');
  lines.push('This report is generated from PNG mockup assets by detecting garment foreground pixels, keeping the largest connected component, and extracting box/anchor geometry for frontend overlays.');
  lines.push('');
  lines.push(`Source directory: \`${path.relative(ROOT, sourceDir).replace(/\\/g, '/')}\``);
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push('');

  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.folder)) groups.set(row.folder, []);
    groups.get(row.folder).push(row);
  }

  for (const folder of [...groups.keys()].sort((a, b) => a.localeCompare(b))) {
    lines.push(`## ${folder}`);
    lines.push('');
    lines.push('| file | imgPx | boxPx | boxWxH | center | safeFrame |');
    lines.push('|---|---|---|---|---|---|');

    for (const r of groups.get(folder)) {
      lines.push(`| \`${r.file}\` | ${r.imgPx} | ${r.boxPx} | ${r.boxWh} | ${r.center} | ${r.safeFrame} |`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const inputDir = findInputDir();
  if (!inputDir) {
    console.error('ERROR: DTF_Print_Field_Assets directory not found.');
    process.exit(1);
  }

  const files = walkPngs(inputDir);
  if (files.length === 0) {
    console.error(`ERROR: No PNG files found under ${inputDir}`);
    process.exit(1);
  }

  const rows = [];

  for (const file of files) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = detectBounds(data, info.width, info.height);

    if (!b) {
      console.error(`ERROR: Failed to detect garment bounds in ${file}`);
      process.exit(1);
    }

    const rel = path.relative(inputDir, file).replace(/\\/g, '/');
    rows.push(toRow(rel, info.width, info.height, b));
  }

  ensureDir(path.dirname(OUTPUT_MD));
  const md = buildMarkdown(rows, inputDir);
  fs.writeFileSync(OUTPUT_MD, md, 'utf8');

  console.log(`Processed ${rows.length} image(s).`);
  console.log(`Wrote markdown report: ${path.relative(ROOT, OUTPUT_MD).replace(/\\/g, '/')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
