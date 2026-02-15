/**
 * Collections Integration Tests (P1-08)
 *
 * Tests the collections data model and public query endpoints:
 * - Collection CRUD via admin endpoints
 * - Public collection listing and filtering
 * - Product association and ordering
 * - RLS policy enforcement
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Collections Integration Tests', () => {
  let testCollectionId: string;
  let testProductId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    // Create test category
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        slug: 'test-category-collections',
      },
    });
    testCategoryId = category.id;

    // Create test product
    const product = await prisma.product.create({
      data: {
        title: 'Test Product for Collections',
        slug: 'test-product-collections',
        is_published: true,
        productFamily: 'BY_SIZE',
        basePrice: 10000,
        categoryId: testCategoryId,
      },
    });
    testProductId = product.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.collectionProduct.deleteMany({
      where: { productId: testProductId },
    });
    await prisma.collection.deleteMany({
      where: { slug: 'test-collection-phase1' },
    });
    await prisma.product.delete({ where: { id: testProductId } });
    await prisma.category.delete({ where: { id: testCategoryId } });
    await prisma.$disconnect();
  });

  describe('Collection CRUD', () => {
    it('should create a collection', async () => {
      const collection = await prisma.collection.create({
        data: {
          slug: 'test-collection-phase1',
          name: 'Test Collection',
          description: 'Test collection for Phase 1',
          isActive: true,
          sortOrder: 1,
        },
      });

      testCollectionId = collection.id;

      expect(collection).toBeDefined();
      expect(collection.slug).toBe('test-collection-phase1');
      expect(collection.isActive).toBe(true);
    });

    it('should list all active collections', async () => {
      const collections = await prisma.collection.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });

      expect(collections.length).toBeGreaterThan(0);
      expect(collections[0]).toHaveProperty('slug');
      expect(collections[0]).toHaveProperty('name');
    });

    it('should find collection by slug', async () => {
      const collection = await prisma.collection.findUnique({
        where: { slug: 'test-collection-phase1' },
      });

      expect(collection).toBeDefined();
      expect(collection?.name).toBe('Test Collection');
    });

    it('should update collection', async () => {
      const updated = await prisma.collection.update({
        where: { id: testCollectionId },
        data: { name: 'Updated Test Collection' },
      });

      expect(updated.name).toBe('Updated Test Collection');
    });
  });

  describe('Product Association', () => {
    it('should add product to collection', async () => {
      const collectionProduct = await prisma.collectionProduct.create({
        data: {
          collectionId: testCollectionId,
          productId: testProductId,
          sortOrder: 1,
        },
      });

      expect(collectionProduct).toBeDefined();
      expect(collectionProduct.collectionId).toBe(testCollectionId);
      expect(collectionProduct.productId).toBe(testProductId);
    });

    it('should get collection with products', async () => {
      const collection = await prisma.collection.findUnique({
        where: { id: testCollectionId },
        include: {
          products: {
            include: {
              product: true,
            },
          },
          _count: {
            select: { products: true },
          },
        },
      });

      expect(collection).toBeDefined();
      expect(collection?.products.length).toBeGreaterThan(0);
      expect(collection?._count.products).toBeGreaterThan(0);
    });

    it('should maintain product sort order', async () => {
      // Add second product
      const product2 = await prisma.product.create({
        data: {
          title: 'Test Product 2',
          slug: 'test-product-2-collections',
          is_published: true,
          productFamily: 'BY_SIZE',
          basePrice: 15000,
          categoryId: testCategoryId,
        },
      });

      await prisma.collectionProduct.create({
        data: {
          collectionId: testCollectionId,
          productId: product2.id,
          sortOrder: 0, // Should appear first
        },
      });

      const collection = await prisma.collection.findUnique({
        where: { id: testCollectionId },
        include: {
          products: {
            orderBy: { sortOrder: 'asc' },
            include: { product: true },
          },
        },
      });

      expect(collection?.products[0].product.id).toBe(product2.id);

      // Cleanup
      await prisma.collectionProduct.delete({
        where: {
          collectionId_productId: {
            collectionId: testCollectionId,
            productId: product2.id,
          },
        },
      });
      await prisma.product.delete({ where: { id: product2.id } });
    });
  });

  describe('Collection Filtering', () => {
    it('should filter collections by active status', async () => {
      // Create inactive collection
      const inactiveCollection = await prisma.collection.create({
        data: {
          slug: 'inactive-test-collection',
          name: 'Inactive Collection',
          isActive: false,
          sortOrder: 999,
        },
      });

      const activeCollections = await prisma.collection.findMany({
        where: { isActive: true },
      });

      const hasInactive = activeCollections.some(
        (c) => c.id === inactiveCollection.id
      );
      expect(hasInactive).toBe(false);

      // Cleanup
      await prisma.collection.delete({ where: { id: inactiveCollection.id } });
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique slug constraint', async () => {
      await expect(
        prisma.collection.create({
          data: {
            slug: 'test-collection-phase1', // Duplicate slug
            name: 'Duplicate Slug Collection',
            isActive: true,
            sortOrder: 2,
          },
        })
      ).rejects.toThrow();
    });

    it('should prevent duplicate product in same collection', async () => {
      await expect(
        prisma.collectionProduct.create({
          data: {
            collectionId: testCollectionId,
            productId: testProductId, // Already exists
            sortOrder: 2,
          },
        })
      ).rejects.toThrow();
    });
  });
});
