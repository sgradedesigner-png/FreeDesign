import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  collectTemplatePrintAreaIds,
  customizationTemplateV1Schema,
  type CustomizationTemplateV1Input,
} from '../src/schemas/layout-template.schema';

type LayoutViewKey = 'front' | 'back' | 'left' | 'right';

type ViewImageEntry = {
  path: string;
  nameHint?: string;
};

const prisma = new PrismaClient();

function argHas(flag: string) {
  return process.argv.includes(flag);
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function sanitizeKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function uniqueEntries(entries: ViewImageEntry[]): ViewImageEntry[] {
  const seen = new Set<string>();
  const out: ViewImageEntry[] = [];
  for (const entry of entries) {
    const path = entry.path?.trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push({ path, nameHint: entry.nameHint });
  }
  return out;
}

function filenameHint(entry: ViewImageEntry): string {
  const raw = entry.path.split('?')[0] ?? entry.path;
  const filename = raw.split('/').pop() || raw;
  return filename.toLowerCase();
}

function pickViewsFromNamedPaths(entries: ViewImageEntry[]): Record<LayoutViewKey, string> {
  const unique = uniqueEntries(entries);
  const used = new Set<string>();
  const result: Partial<Record<LayoutViewKey, string>> = {};

  const matches = (entry: ViewImageEntry, pattern: RegExp) => {
    const filename = filenameHint(entry);
    const hint = entry.nameHint?.trim().toLowerCase() ?? '';
    return pattern.test(filename) || (hint.length > 0 && pattern.test(hint));
  };

  const tryAssign = (view: LayoutViewKey, pattern: RegExp) => {
    if (result[view]) return;
    const candidate = unique.find((entry) => !used.has(entry.path) && matches(entry, pattern));
    if (!candidate) return;
    result[view] = candidate.path;
    used.add(candidate.path);
  };

  tryAssign('front', /(^|[^a-z])(front|frt)([^a-z]|$)/i);
  tryAssign('back', /(^|[^a-z])back([^a-z]|$)/i);
  tryAssign('left', /(^|[^a-z])(leftsleeve|left_sleeve|left-sleeve|leftside|left_side|left-side|left|ls)([^a-z]|$)/i);
  tryAssign('right', /(^|[^a-z])(rightsleeve|right_sleeve|right-sleeve|rightside|right_side|right-side|right|rs)([^a-z]|$)/i);

  const remaining = unique.filter((entry) => !used.has(entry.path));
  (['front', 'back', 'left', 'right'] as LayoutViewKey[]).forEach((view) => {
    if (result[view] || remaining.length === 0) return;
    result[view] = remaining.shift()!.path;
  });

  return {
    front: result.front ?? '',
    back: result.back ?? '',
    left: result.left ?? '',
    right: result.right ?? '',
  };
}

function inferViewFromAreaName(name: string): LayoutViewKey {
  const normalized = name.toLowerCase();
  if (/(^|[^a-z])back([^a-z]|$)/i.test(normalized)) return 'back';
  if (/(left|зүүн)/i.test(normalized)) return 'left';
  if (/(right|баруун)/i.test(normalized)) return 'right';
  return 'front';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function defaultRectForArea(view: LayoutViewKey, widthCm: number, heightCm: number) {
  const aspect = widthCm > 0 && heightCm > 0 ? widthCm / heightCm : 1;
  let w = 0.3;
  let h = 0.3;
  let x = 0.35;
  let y = view === 'back' ? 0.18 : 0.2;

  if (aspect >= 1.8) {
    w = 0.42;
    h = 0.18;
  } else if (aspect <= 0.65) {
    w = 0.18;
    h = 0.42;
  } else if (aspect <= 0.9) {
    w = 0.24;
    h = 0.34;
  }

  if (view === 'left' || view === 'right') {
    w = 0.16;
    h = 0.16;
    x = view === 'left' ? 0.54 : 0.3;
    y = 0.24;
  }

  x = clamp(x, 0, 1 - w);
  y = clamp(y, 0, 1 - h);

  return { x, y, w, h };
}

function toTemplate(metadata: Prisma.JsonValue | null): CustomizationTemplateV1Input | null {
  const parsed = customizationTemplateV1Schema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}

async function main() {
  const apply = argHas('--apply');
  const dryRun = !apply;
  const limitRaw = argValue('--limit');
  const limit = limitRaw ? Math.max(1, Number(limitRaw)) : undefined;
  const onlySlug = argValue('--slug');
  const onlyId = argValue('--id');
  const allFamilies = argHas('--all-families');
  const family = argValue('--family') ?? (allFamilies ? undefined : 'BLANKS');

  const products = await prisma.product.findMany({
    where: {
      ...(family ? { productFamily: family as any } : {}),
      ...(onlySlug ? { slug: onlySlug } : {}),
      ...(onlyId ? { id: onlyId } : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      productFamily: true,
      isCustomizable: true,
      metadata: true,
      variants: {
        orderBy: { sortOrder: 'asc' },
        select: {
          name: true,
          imagePath: true,
          galleryPaths: true,
        },
      },
      printAreas: {
        include: {
          printArea: {
            select: {
              id: true,
              name: true,
              label: true,
              labelEn: true,
              maxWidthCm: true,
              maxHeightCm: true,
              sortOrder: true,
            },
          },
        },
        orderBy: { printArea: { sortOrder: 'asc' } },
      },
    },
    take: limit,
  });

  let scanned = 0;
  let changed = 0;
  let patchedViews = 0;
  let seededPresets = 0;
  let invalidSkipped = 0;

  for (const product of products) {
    scanned += 1;
    const metadata = (product.metadata && typeof product.metadata === 'object'
      ? { ...(product.metadata as Prisma.JsonObject) }
      : {}) as Prisma.JsonObject;

    const existingTemplate = toTemplate(metadata.customizationTemplateV1 as Prisma.JsonValue | null);
    const nextTemplate: CustomizationTemplateV1Input = existingTemplate ?? {
      version: 1,
      views: {},
      presets: [],
    };

    const entries: ViewImageEntry[] = [];
    for (const variant of product.variants) {
      if (variant.imagePath) entries.push({ path: variant.imagePath, nameHint: variant.name });
      for (const path of variant.galleryPaths ?? []) {
        entries.push({ path, nameHint: variant.name });
      }
    }
    const inferredViews = pickViewsFromNamedPaths(entries);

    let productChanged = false;
    for (const view of ['front', 'back', 'left', 'right'] as LayoutViewKey[]) {
      const currentPath = nextTemplate.views?.[view]?.imagePath?.trim();
      const inferredPath = inferredViews[view]?.trim();
      if (currentPath || !inferredPath) continue;
      nextTemplate.views = nextTemplate.views ?? {};
      nextTemplate.views[view] = {
        ...(nextTemplate.views[view] ?? {}),
        imagePath: inferredPath,
      };
      patchedViews += 1;
      productChanged = true;
    }

    if ((nextTemplate.presets?.length ?? 0) === 0 && product.printAreas.length > 0) {
      const defaultsByView = new Set<string>();
      const generated = product.printAreas.map((row, index) => {
        const view = inferViewFromAreaName(row.printArea.name);
        const isDefault = !defaultsByView.has(view) && (row.isDefault || !defaultsByView.has(view));
        if (isDefault) defaultsByView.add(view);
        const keyBase = sanitizeKey(row.printArea.name || row.printArea.label || `preset_${index + 1}`) || `preset_${index + 1}`;

        return {
          id: `backfill_${product.id}_${index + 1}`,
          key: `${view}_${keyBase}`,
          labelMn: row.printArea.label || undefined,
          labelEn: row.printArea.labelEn || row.printArea.label || undefined,
          view,
          rectNorm: defaultRectForArea(view, Number(row.printArea.maxWidthCm), Number(row.printArea.maxHeightCm)),
          printAreaId: row.printArea.id,
          sortOrder: (index + 1) * 10,
          isDefault,
        };
      });
      nextTemplate.presets = generated;
      seededPresets += generated.length;
      productChanged = true;
    }

    if (!productChanged) continue;

    const validated = customizationTemplateV1Schema.safeParse(nextTemplate);
    if (!validated.success) {
      invalidSkipped += 1;
      console.warn(`[skip-invalid] ${product.slug} (${product.id})`, validated.error.issues.map((x) => x.message).join('; '));
      continue;
    }

    metadata.customizationTemplateV1 = validated.data as unknown as Prisma.JsonValue;
    const mergedAreaIds = Array.from(
      new Set([
        ...product.printAreas.map((row) => row.printAreaId),
        ...collectTemplatePrintAreaIds(validated.data),
      ])
    );
    const nextIsCustomizable = mergedAreaIds.length > 0 || validated.data.presets.length > 0;

    changed += 1;
    if (dryRun) {
      console.log(`[dry-run] ${product.slug} (${product.id}) updated: views/presets backfilled`);
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        metadata,
        isCustomizable: nextIsCustomizable,
      },
    });
    console.log(`[apply] ${product.slug} (${product.id}) updated`);
  }

  console.log('\n=== Backfill Summary ===');
  console.log(`mode: ${dryRun ? 'dry-run' : 'apply'}`);
  console.log(`scanned: ${scanned}`);
  console.log(`changed: ${changed}`);
  console.log(`patched views: ${patchedViews}`);
  console.log(`seeded presets: ${seededPresets}`);
  console.log(`invalid skipped: ${invalidSkipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
