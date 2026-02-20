import type { ViewName } from '@/types/garment';

function filenameFromPath(path: string): string {
  const raw = (path || '').split('?')[0];
  return (raw.split('/').pop() || raw).toLowerCase();
}

export function detectViewFromPath(path: string): ViewName | null {
  const name = filenameFromPath(path);

  if (/(^|[^a-z])(front|frt)([^a-z]|$)/i.test(name)) return 'front';
  if (/(^|[^a-z])back([^a-z]|$)/i.test(name)) return 'back';
  if (/(^|[^a-z])(leftsleeve|left_sleeve|left-sleeve|leftside|left_side|left-side|left|ls)([^a-z]|$)/i.test(name)) return 'left';
  if (/(^|[^a-z])(rightsleeve|right_sleeve|right-sleeve|rightside|right_side|right-side|right|rs)([^a-z]|$)/i.test(name)) return 'right';

  return null;
}

export function orderGalleryByViews(
  paths: string[],
  viewOrder: ViewName[]
): string[] {
  const unique = Array.from(new Set((paths || []).filter(Boolean)));
  if (unique.length <= 1) return unique;

  const buckets: Record<ViewName, string[]> = {
    front: [],
    back: [],
    left: [],
    right: [],
  };
  const unknown: string[] = [];

  for (const path of unique) {
    const view = detectViewFromPath(path);
    if (view) buckets[view].push(path);
    else unknown.push(path);
  }

  const ordered: string[] = [];
  for (const view of viewOrder) ordered.push(...buckets[view]);
  ordered.push(...unknown);
  return ordered;
}

export function mapGalleryToViews(
  imagePath: string,
  galleryPaths: string[],
  views: ViewName[]
): Partial<Record<ViewName, string>> {
  const result: Partial<Record<ViewName, string>> = {};
  const candidates = Array.from(
    new Set([imagePath, ...(galleryPaths ?? [])].filter(Boolean))
  );
  const used = new Set<string>();

  // Pass 1: assign by filename keyword (front/back/left/right)
  for (const path of candidates) {
    const detected = detectViewFromPath(path);
    if (!detected) continue;
    if (!views.includes(detected)) continue;
    if (result[detected]) continue;
    result[detected] = path;
    used.add(path);
  }

  // Pass 2: fill remaining views from unused images (preserve original order)
  const fallback = candidates.filter((path) => !used.has(path));
  for (const view of views) {
    if (!result[view] && fallback.length > 0) {
      result[view] = fallback.shift();
    }
  }

  if (!result.front && imagePath) {
    result.front = imagePath;
  }

  return result;
}
