import { expect, test, type Page } from '@playwright/test';

const MOCK_DATE = '2026-02-01T00:00:00.000Z';

function buildBackendProduct(prefix: string, index: number) {
  const id = `${prefix.toLowerCase()}-${index}`;
  return {
    id,
    title: `${prefix} Product ${index}`,
    slug: `${prefix.toLowerCase()}-product-${index}`,
    subtitle: `${prefix} Subtitle ${index}`,
    description: `${prefix} Description ${index}`,
    basePrice: 10000 + index,
    categoryId: 'cat-1',
    category: {
      id: 'cat-1',
      name: 'Mock Category',
      slug: 'mock-category',
    },
    variants: [
      {
        id: `${id}-variant-1`,
        productId: id,
        name: 'Default',
        sku: `${id}-sku`,
        price: 10000 + index,
        originalPrice: null,
        sizes: ['M'],
        imagePath: '',
        galleryPaths: [],
        stock: 50,
        isAvailable: true,
        sortOrder: 0,
        createdAt: MOCK_DATE,
        updatedAt: MOCK_DATE,
      },
    ],
    rating: 4.8,
    reviews: 99,
    features: ['Mock feature'],
    benefits: ['Mock benefit'],
    productDetails: ['Mock detail'],
    shortDescription: 'Mock short description',
    createdAt: MOCK_DATE,
    updatedAt: MOCK_DATE,
  };
}

async function mockHomeApi(page: Page) {
  const categories = Array.from({ length: 8 }, (_, index) => ({
    id: `cat-${index + 1}`,
    name: `Category ${index + 1}`,
    slug: `category-${index + 1}`,
    productCount: 12 + index,
  }));

  const trending = Array.from({ length: 8 }, (_, index) => buildBackendProduct('Trending', index + 1));
  const newArrivals = Array.from({ length: 8 }, (_, index) => buildBackendProduct('New', index + 1));

  await page.route('**/api/products/categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(categories),
    });
  });

  await page.route('**/api/products/trending', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(trending),
    });
  });

  await page.route('**/api/products/new-arrivals', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(newArrivals),
    });
  });
}

test.describe('Home mobile product feed', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders tab + swipe feed with 4 preview items and correct CTA routes', async ({ page }) => {
    await mockHomeApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="home-mobile-feed"]')).toBeVisible();
    await expect(page.locator('[data-testid="home-trending-desktop"]')).toBeHidden();
    await expect(page.locator('[data-testid="home-new-arrivals-desktop"]')).toBeHidden();

    const railCards = page.locator('[data-testid="home-mobile-rail"] [data-testid="product-card"]');
    await expect(page.locator('[data-testid="home-mobile-tab-trending"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(railCards).toHaveCount(4);
    await expect(page.locator('[data-testid="home-mobile-feed-cta"]')).toHaveAttribute('href', '/products');

    await page.locator('[data-testid="home-mobile-tab-new"]').click();
    await expect(page.locator('[data-testid="home-mobile-tab-new"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(railCards).toHaveCount(4);
    await expect(page.locator('[data-testid="home-mobile-rail"]')).toContainText('New Product 1');
    await expect(page.locator('[data-testid="home-mobile-feed-cta"]')).toHaveAttribute('href', '/products?filter=new');

    await page.locator('[data-testid="home-mobile-feed-cta"]').click();
    await expect(page).toHaveURL(/\/products\?filter=new$/);
    await page.goBack();
    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="home-mobile-tab-new"]').click();
    await page.locator('[data-testid="home-mobile-rail"]').evaluate((element) => {
      element.scrollTo({ left: element.scrollWidth, behavior: 'auto' });
      element.dispatchEvent(new Event('scroll'));
    });
    await expect(page.locator('[data-testid="home-mobile-dot-3"]')).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('Home desktop regression for product sections', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('keeps original desktop trending/new arrival sections visible', async ({ page }) => {
    await mockHomeApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="home-mobile-feed"]')).toBeHidden();
    await expect(page.locator('[data-testid="home-trending-desktop"]')).toBeVisible();
    await expect(page.locator('[data-testid="home-new-arrivals-desktop"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="home-trending-desktop"] [data-testid="product-card"]')
    ).toHaveCount(8);
    await expect(
      page.locator('[data-testid="home-new-arrivals-desktop"] [data-testid="product-card"]')
    ).toHaveCount(8);
  });
});
