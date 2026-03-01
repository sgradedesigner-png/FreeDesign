import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const PHASE0_RLS_TABLES = [
  'categories',
  'products',
  'product_variants',
  'orders',
  'customization_assets',
  'carts',
  'cart_items',
  'upload_intents',
] as const;

describe('Phase 0 RLS Baseline', () => {
  it('enables RLS on all Phase 0 tables', async () => {
    const missing = await prisma.$queryRaw<{ relname: string }[]>(Prisma.sql`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN (${Prisma.join(PHASE0_RLS_TABLES)})
        AND c.relrowsecurity IS DISTINCT FROM true
      ORDER BY c.relname;
    `);

    expect(missing).toEqual([]);
  });
});
