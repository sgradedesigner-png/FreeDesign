import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { adminGuard } from '../../supabaseauth';
import { settingsService } from '../../services/settings.service';

const listQuerySchema = z.object({
  category: z.string().optional().default('upload_validation'),
});

const keyParamSchema = z.object({
  key: z.string().min(1),
});

const updateBodySchema = z.object({
  value: z.unknown(),
});

const batchBodySchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1),
      value: z.unknown(),
    })
  ).min(1),
});

const UPDATE_VALIDATION_KEYS = new Set([
  'upload.validation.enabled',
  'upload.debug.showPlacementCoordinates',
  'upload.ui.sizeFinderEnabled',
  'upload.gang_upload.enabled',
  'upload.gang_upload.mockupPreviewEnabled',
  'upload.gang_upload.maxBytes',
  'upload.gang_upload.minDpi',
  'upload.gang_upload.minWidthPx',
  'upload.gang_upload.minHeightPx',
  'upload.gang_upload.allowedTypes',
  'upload.uv_gang_upload.enabled',
  'upload.uv_gang_upload.mockupPreviewEnabled',
  'upload.uv_gang_upload.maxBytes',
  'upload.uv_gang_upload.minDpi',
  'upload.uv_gang_upload.minWidthPx',
  'upload.uv_gang_upload.minHeightPx',
  'upload.uv_gang_upload.allowedTypes',
  'upload.by_size.enabled',
  'upload.by_size.mockupPreviewEnabled',
  'upload.by_size.maxBytes',
  'upload.by_size.minDpi',
  'upload.by_size.minWidthPx',
  'upload.by_size.minHeightPx',
  'upload.by_size.allowedTypes',
  'upload.uv_by_size.enabled',
  'upload.uv_by_size.mockupPreviewEnabled',
  'upload.uv_by_size.maxBytes',
  'upload.uv_by_size.minDpi',
  'upload.uv_by_size.minWidthPx',
  'upload.uv_by_size.minHeightPx',
  'upload.uv_by_size.allowedTypes',
  'upload.blanks.enabled',
  'upload.blanks.mockupPreviewEnabled',
  'upload.blanks.maxBytes',
  'upload.blanks.minDpi',
  'upload.blanks.minWidthPx',
  'upload.blanks.minHeightPx',
  'upload.blanks.allowedTypes',
]);

function ensureAllowedSettingKey(key: string): void {
  if (!UPDATE_VALIDATION_KEYS.has(key)) {
    throw new Error(`Unsupported settings key: ${key}`);
  }
}

export const adminSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', adminGuard);

  fastify.get('/settings', async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const settings = await settingsService.getSettingsByCategory(query.category);
    return reply.send({ settings });
  });

  fastify.put('/settings/:key', async (request, reply) => {
    const params = keyParamSchema.parse(request.params);
    const body = updateBodySchema.parse(request.body);
    const decodedKey = decodeURIComponent(params.key);
    ensureAllowedSettingKey(decodedKey);

    const adminId = ((request as any).user?.sub as string | undefined) ?? undefined;
    const updated = await settingsService.updateSetting(decodedKey, body.value, adminId);
    return reply.send({ setting: updated });
  });

  fastify.put('/settings/batch', async (request, reply) => {
    const body = batchBodySchema.parse(request.body);
    for (const item of body.settings) {
      ensureAllowedSettingKey(item.key);
    }

    const adminId = ((request as any).user?.sub as string | undefined) ?? undefined;
    const updated = await settingsService.updateSettingsBatch(body.settings, adminId);
    return reply.send({ settings: updated });
  });
};
