import { prisma } from '../lib/prisma';

export type UploadFamilyKey =
  | 'gang_upload'
  | 'uv_gang_upload'
  | 'by_size'
  | 'uv_by_size'
  | 'blanks';

export type UploadConstraints = {
  enabled: boolean;
  maxBytes: number;
  minDpi?: number;
  minWidthPx?: number;
  minHeightPx?: number;
  allowedMimeTypes: Set<string>;
};

type CachedCategory = {
  expiresAt: number;
  data: Map<string, unknown>;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const categoryCache = new Map<string, CachedCategory>();

const DEFAULT_UPLOAD_CONSTRAINTS: Record<UploadFamilyKey, UploadConstraints> = {
  gang_upload: {
    enabled: true,
    allowedMimeTypes: new Set(['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']),
    maxBytes: 50 * 1024 * 1024,
    minDpi: 150,
    minWidthPx: 1200,
  },
  uv_gang_upload: {
    enabled: true,
    allowedMimeTypes: new Set(['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']),
    maxBytes: 50 * 1024 * 1024,
    minDpi: 150,
    minWidthPx: 1200,
  },
  by_size: {
    enabled: true,
    allowedMimeTypes: new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']),
    maxBytes: 20 * 1024 * 1024,
    minWidthPx: 800,
    minHeightPx: 800,
  },
  uv_by_size: {
    enabled: true,
    allowedMimeTypes: new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']),
    maxBytes: 20 * 1024 * 1024,
    minWidthPx: 800,
    minHeightPx: 800,
  },
  blanks: {
    enabled: true,
    allowedMimeTypes: new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']),
    maxBytes: 20 * 1024 * 1024,
    minWidthPx: 800,
    minHeightPx: 800,
  },
};

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function toPositiveInt(value: unknown, fallback?: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return fallback;
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const parsed = value
      .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  }
  return fallback;
}

function normalizeUploadFamily(family: string): UploadFamilyKey | null {
  const normalized = family.trim().toLowerCase() as UploadFamilyKey;
  const validFamilies: UploadFamilyKey[] = [
    'gang_upload',
    'uv_gang_upload',
    'by_size',
    'uv_by_size',
    'blanks',
  ];
  return validFamilies.includes(normalized) ? normalized : null;
}

async function loadCategorySettings(category: string): Promise<Map<string, unknown>> {
  const now = Date.now();
  const cached = categoryCache.get(category);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const rows = await (prisma as any).appSetting.findMany({
    where: { category },
    select: { key: true, value: true },
  });

  const data = new Map<string, unknown>();
  for (const row of rows as Array<{ key: string; value: unknown }>) {
    data.set(row.key, row.value);
  }

  categoryCache.set(category, {
    data,
    expiresAt: now + CACHE_TTL_MS,
  });

  return data;
}

function invalidateCategory(category: string): void {
  categoryCache.delete(category);
}

function buildUploadKey(family: UploadFamilyKey, field: string): string {
  return `upload.${family}.${field}`;
}

export const settingsService = {
  async getSettingsByCategory(category: string): Promise<Array<{ key: string; value: unknown; category: string }>> {
    const rows = await (prisma as any).appSetting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
      select: { key: true, value: true, category: true },
    });

    return rows as Array<{ key: string; value: unknown; category: string }>;
  },

  async getGlobalValidationEnabled(): Promise<boolean> {
    const category = 'upload_validation';
    const values = await loadCategorySettings(category);
    return toBoolean(values.get('upload.validation.enabled'), true);
  },

  async getUploadConstraints(familyInput: string): Promise<UploadConstraints> {
    const family = normalizeUploadFamily(familyInput);
    if (!family) {
      throw new Error(`Unsupported upload family: ${familyInput}`);
    }

    const defaults = DEFAULT_UPLOAD_CONSTRAINTS[family];
    const values = await loadCategorySettings('upload_validation');

    const enabled = toBoolean(values.get(buildUploadKey(family, 'enabled')), defaults.enabled);
    const maxBytes = toPositiveInt(values.get(buildUploadKey(family, 'maxBytes')), defaults.maxBytes) ?? defaults.maxBytes;
    const minDpi = toPositiveInt(values.get(buildUploadKey(family, 'minDpi')), defaults.minDpi);
    const minWidthPx = toPositiveInt(values.get(buildUploadKey(family, 'minWidthPx')), defaults.minWidthPx);
    const minHeightPx = toPositiveInt(values.get(buildUploadKey(family, 'minHeightPx')), defaults.minHeightPx);
    const allowedMimeTypes = new Set(
      toStringArray(values.get(buildUploadKey(family, 'allowedTypes')), Array.from(defaults.allowedMimeTypes))
    );

    return {
      enabled,
      maxBytes,
      minDpi,
      minWidthPx,
      minHeightPx,
      allowedMimeTypes,
    };
  },

  async updateSetting(key: string, value: unknown, updatedBy?: string): Promise<{ key: string; value: unknown; category: string }> {
    const category = key.startsWith('upload.') ? 'upload_validation' : 'general';
    const row = await (prisma as any).appSetting.upsert({
      where: { key },
      update: {
        value,
        category,
        updatedBy: updatedBy ?? null,
      },
      create: {
        key,
        value,
        category,
        updatedBy: updatedBy ?? null,
      },
      select: { key: true, value: true, category: true },
    });

    invalidateCategory(category);
    return row as { key: string; value: unknown; category: string };
  },

  async updateSettingsBatch(
    items: Array<{ key: string; value: unknown }>,
    updatedBy?: string
  ): Promise<Array<{ key: string; value: unknown; category: string }>> {
    if (items.length === 0) return [];

    const touchedCategories = new Set<string>();
    const updated: Array<{ key: string; value: unknown; category: string }> = [];

    for (const item of items) {
      const category = item.key.startsWith('upload.') ? 'upload_validation' : 'general';
      touchedCategories.add(category);
      const row = await (prisma as any).appSetting.upsert({
        where: { key: item.key },
        update: {
          value: item.value,
          category,
          updatedBy: updatedBy ?? null,
        },
        create: {
          key: item.key,
          value: item.value,
          category,
          updatedBy: updatedBy ?? null,
        },
        select: { key: true, value: true, category: true },
      });
      updated.push(row as { key: string; value: unknown; category: string });
    }

    for (const category of touchedCategories) {
      invalidateCategory(category);
    }

    return updated;
  },
};

