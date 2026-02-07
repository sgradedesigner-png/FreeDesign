import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminGuard } from '../../supabaseauth';
import { fetchNikeBySku } from '../nike';
import { slugify } from '../../lib/slug';

type NikePrefillResponse = {
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  subtitle?: string;
  variantName: string;
  sku: string;
  priceUsd?: number;
  thumbnailUrl: string | null;
  galleryImages: string[];
  benefits: string[];
  productDetails: string[];
};

export async function adminPrefillRoutes(app: FastifyInstance) {
  // 🔐 Admin guard — all routes
  app.addHook('preHandler', adminGuard);

  // GET /admin/prefill/nike?sku=IO9571-400
  app.get('/nike', async (request, reply) => {
    const schema = z.object({
      sku: z.string().min(1),
    });

    const { sku } = schema.parse(request.query);

    try {
      const nike = await fetchNikeBySku({
        sku,
        marketplace: 'US',
        language: 'en',
      });

      const response: NikePrefillResponse = {
        title: nike.title,
        slug: slugify(nike.title),
        description: nike.description ?? '',
        shortDescription: nike.shortDescription ?? nike.description ?? '',
        subtitle: nike.subtitle || '',
        variantName: nike.colorway,
        sku: nike.sku,
        priceUsd: typeof nike.price_usd === 'number' ? nike.price_usd : undefined,
        thumbnailUrl: nike.thumbnail || null,
        galleryImages: Array.isArray(nike.gallery_images) ? nike.gallery_images : [],
        benefits: Array.isArray(nike.benefits) ? nike.benefits : [],
        productDetails: Array.isArray(nike.productDetails) ? nike.productDetails : [],
      };

      return response;
    } catch (error: any) {
      const message = error?.message || 'Failed to fetch Nike data';
      if (message === 'VARIANT_NOT_FOUND') {
        return reply.status(404).send({ message: `SKU not found: ${sku}` });
      }
      request.log.error(error);
      return reply.status(500).send({ message });
    }
  });
}
