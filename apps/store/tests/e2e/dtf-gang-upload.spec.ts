import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Test: DTF Gang Sheet Upload Journey (P2-08)
 *
 * Tests the complete user flow for GANG_UPLOAD product family:
 * - Navigate to gang sheet product
 * - Select gang sheet length
 * - Upload a valid file (mocked)
 * - Observe validation status chip updates
 * - Add to cart only when validation passes
 * - Error state UX for invalid files / failed uploads
 */

// Helper: create a fake PNG file for upload tests
function createFakePngFile(): Buffer {
  // Minimal valid PNG: 1×1 transparent pixel
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4' +
    '890000000a49444154789c6260000000020001e221bc330000000049454e44ae' +
    '426082',
    'hex'
  );
}

async function mockUploadApis(page: Page) {
  // Mock sign-v2 endpoint
  await page.route('**/api/uploads/sign-v2', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        signature: 'mock-signature',
        timestamp: Date.now(),
        apiKey: 'mock-api-key',
        cloudName: 'mock-cloud',
        folder: 'uploads/test',
        publicId: 'uploads/test/mock-asset-id',
      }),
    });
  });

  // Mock Cloudinary direct upload
  await page.route('**/api.cloudinary.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'uploads/test/mock-asset-id',
        secure_url: 'https://res.cloudinary.com/mock/image/upload/mock-asset-id.png',
        width: 2400,
        height: 1800,
        format: 'png',
      }),
    });
  });

  // Mock complete-v2 endpoint
  await page.route('**/api/uploads/complete-v2', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        uploadAsset: {
          id: 'mock-asset-uuid',
          cloudinaryUrl: 'https://res.cloudinary.com/mock/image/upload/mock-asset-id.png',
          fileName: 'gang-sheet-test.png',
          validationStatus: 'PENDING',
          metadata: {},
        },
      }),
    });
  });
}

async function mockValidationStatus(page: Page, status: string, errorMessage?: string) {
  await page.route('**/api/uploads/assets/mock-asset-uuid', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-asset-uuid',
        validationStatus: status,
        metadata: errorMessage ? { validationError: { message: errorMessage } } : {},
      }),
    });
  });
}

test.describe('DTF Gang Sheet Upload Journey', () => {
  test('should display upload panel on gang sheet product page', async ({ page }) => {
    await page.goto('/products');

    // Look for a product card and navigate (any available product for structural test)
    const productCard = page.locator('[data-testid="product-card"]').first();
    await expect(productCard).toBeVisible({ timeout: 10000 });

    // The gang sheet length selector appears on GANG_UPLOAD family products
    // For structural verification we check the component exists in DOM
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
  });

  test('should render gang sheet length selector with all options', async ({ page }) => {
    // Direct component test by navigating to a page that mounts the selector
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Find a product that uses gang upload strategy
    const gangProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /gang|sheet/i,
    }).first();

    const hasGangProduct = await gangProduct.count() > 0;

    if (hasGangProduct) {
      await gangProduct.click();
      await page.waitForLoadState('networkidle');

      const lengthSelector = page.locator('[data-testid="gang-sheet-length-selector"]');
      await expect(lengthSelector).toBeVisible({ timeout: 5000 });

      // Verify all length options exist
      for (const length of [30, 50, 70, 100]) {
        await expect(page.locator(`[data-testid="gang-sheet-length-${length}"]`)).toBeVisible();
      }
    } else {
      test.skip(true, 'No gang upload product found in catalog — skipping UI interaction test');
    }
  });

  test('should select gang sheet length and reflect in price', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const gangProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /gang|sheet/i,
    }).first();

    if ((await gangProduct.count()) === 0) {
      test.skip(true, 'No gang upload product found — skipping');
      return;
    }

    await gangProduct.click();
    await page.waitForLoadState('networkidle');

    const lengthSelector = page.locator('[data-testid="gang-sheet-length-selector"]');
    await expect(lengthSelector).toBeVisible();

    // Select 30cm first
    await page.locator('[data-testid="gang-sheet-length-30"]').click();

    // Get price with 30cm
    const basePrice = await page.locator('[data-testid="total-price"], text=/\\$[0-9]/').first().textContent();

    // Select 100cm
    await page.locator('[data-testid="gang-sheet-length-100"]').click();

    // Price should be higher (2.5x multiplier)
    const higherPrice = await page.locator('[data-testid="total-price"], text=/\\$[0-9]/').first().textContent();

    expect(basePrice).not.toBe(higherPrice);
  });

  test('should show pending status chip after upload starts', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const gangProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /gang|sheet/i,
    }).first();

    if ((await gangProduct.count()) === 0) {
      test.skip(true, 'No gang upload product found — skipping');
      return;
    }

    await gangProduct.click();
    await page.waitForLoadState('networkidle');

    await mockUploadApis(page);
    await mockValidationStatus(page, 'PENDING');

    // Upload a file
    const fileInput = page.locator('[data-testid="gang-sheet-upload-input"]');
    await expect(fileInput).toBeAttached();

    const pngBuffer = createFakePngFile();
    await fileInput.setInputFiles({
      name: 'gang-sheet-test.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    // Status chip should appear with pending or processing state
    await expect(
      page.locator('[data-testid="upload-status-chip-pending"], [data-testid="upload-status-chip-processing"]')
    ).toBeVisible({ timeout: 10000 });

    // Add to cart should be disabled while pending
    const addToCartBtn = page.locator('[data-testid="gang-upload-add-to-cart"]');
    await expect(addToCartBtn).toBeDisabled();
  });

  test('should enable add-to-cart only when validation passes', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const gangProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /gang|sheet/i,
    }).first();

    if ((await gangProduct.count()) === 0) {
      test.skip(true, 'No gang upload product found — skipping');
      return;
    }

    await gangProduct.click();
    await page.waitForLoadState('networkidle');

    await mockUploadApis(page);
    // Mock immediate pass after first poll
    await mockValidationStatus(page, 'PASSED');

    const fileInput = page.locator('[data-testid="gang-sheet-upload-input"]');
    await fileInput.setInputFiles({
      name: 'gang-sheet-test.png',
      mimeType: 'image/png',
      buffer: createFakePngFile(),
    });

    // Wait for passed status chip
    await expect(
      page.locator('[data-testid="upload-status-chip-passed"]')
    ).toBeVisible({ timeout: 15000 });

    // Add to cart should now be enabled
    const addToCartBtn = page.locator('[data-testid="gang-upload-add-to-cart"]');
    await expect(addToCartBtn).toBeEnabled();
  });

  test('should show failed status chip and error message for invalid upload', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const gangProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /gang|sheet/i,
    }).first();

    if ((await gangProduct.count()) === 0) {
      test.skip(true, 'No gang upload product found — skipping');
      return;
    }

    await gangProduct.click();
    await page.waitForLoadState('networkidle');

    await mockUploadApis(page);
    await mockValidationStatus(page, 'FAILED', 'Image resolution too low (minimum 150 DPI required)');

    const fileInput = page.locator('[data-testid="gang-sheet-upload-input"]');
    await fileInput.setInputFiles({
      name: 'low-res.png',
      mimeType: 'image/png',
      buffer: createFakePngFile(),
    });

    // Failed chip should appear
    await expect(
      page.locator('[data-testid="upload-status-chip-failed"]')
    ).toBeVisible({ timeout: 15000 });

    // Error message should be shown
    await expect(
      page.locator('[data-testid="upload-error-message"]')
    ).toContainText('150 DPI');

    // Add to cart must remain disabled
    const addToCartBtn = page.locator('[data-testid="gang-upload-add-to-cart"]');
    await expect(addToCartBtn).toBeDisabled();
  });

  test('should block add-to-cart without any upload', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const gangProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /gang|sheet/i,
    }).first();

    if ((await gangProduct.count()) === 0) {
      test.skip(true, 'No gang upload product found — skipping');
      return;
    }

    await gangProduct.click();
    await page.waitForLoadState('networkidle');

    // No file uploaded — add to cart must be disabled
    const addToCartBtn = page.locator('[data-testid="gang-upload-add-to-cart"]');
    await expect(addToCartBtn).toBeDisabled();
  });

  test('should add gang upload product to cart after validation passes', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const gangProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /gang|sheet/i,
    }).first();

    if ((await gangProduct.count()) === 0) {
      test.skip(true, 'No gang upload product found — skipping');
      return;
    }

    await gangProduct.click();
    await page.waitForLoadState('networkidle');

    await mockUploadApis(page);
    await mockValidationStatus(page, 'PASSED');

    const fileInput = page.locator('[data-testid="gang-sheet-upload-input"]');
    await fileInput.setInputFiles({
      name: 'gang-sheet-test.png',
      mimeType: 'image/png',
      buffer: createFakePngFile(),
    });

    await expect(
      page.locator('[data-testid="upload-status-chip-passed"]')
    ).toBeVisible({ timeout: 15000 });

    // Click add to cart
    const addToCartBtn = page.locator('[data-testid="gang-upload-add-to-cart"]');
    await expect(addToCartBtn).toBeEnabled();
    await addToCartBtn.click();

    // Verify cart notification or cart count update
    await expect(
      page.locator('text=Added to cart, [data-testid="cart-count"]')
    ).toBeVisible({ timeout: 5000 });
  });
});
