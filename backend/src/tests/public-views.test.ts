import { describe, it, expect } from 'vitest';
import { prisma } from '../lib/prisma';

async function roleExists(roleName: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = ${roleName}) AS exists;
  `;

  return Boolean(rows?.[0]?.exists);
}

describe('Phase 0 Public Views', () => {
  it('views exist and do not expose unpublished products', async () => {
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        slug: 'test-category',
      },
    });

    const published = await prisma.product.create({
      data: {
        title: 'Published Product',
        slug: 'published-product',
        categoryId: category.id,
        is_published: true,
      },
      select: { id: true },
    });

    await prisma.product.create({
      data: {
        title: 'Draft Product',
        slug: 'draft-product',
        categoryId: category.id,
        is_published: false,
      },
      select: { id: true },
    });

    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM public.v_products_public_list
      ORDER BY id;
    `;

    expect(rows.map((r) => r.id)).toContain(published.id);
    expect(rows.map((r) => r.id)).toHaveLength(1);
  });

  it('anon/authenticated roles are granted view access and denied base table access (if roles exist)', async () => {
    const anon = await roleExists('anon');
    const authenticated = await roleExists('authenticated');

    if (anon) {
      const canReadView = await prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT has_table_privilege('anon', 'public.v_products_public_list', 'SELECT') AS ok;
      `;
      const canReadTable = await prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT has_table_privilege('anon', 'public.products', 'SELECT') AS ok;
      `;

      expect(Boolean(canReadView?.[0]?.ok)).toBe(true);
      expect(Boolean(canReadTable?.[0]?.ok)).toBe(false);
    }

    if (authenticated) {
      const canReadView = await prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT has_table_privilege('authenticated', 'public.v_products_public_list', 'SELECT') AS ok;
      `;
      const canReadTable = await prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT has_table_privilege('authenticated', 'public.products', 'SELECT') AS ok;
      `;

      expect(Boolean(canReadView?.[0]?.ok)).toBe(true);
      expect(Boolean(canReadTable?.[0]?.ok)).toBe(false);
    }
  });
});
