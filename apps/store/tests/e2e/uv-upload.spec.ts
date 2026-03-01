import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Test: UV Upload Journey (P2-08)
 *
 * Tests the UV gang sheet upload flow including:
 * - UV disclaimer visibility on UV-family product pages
 * - UV-specific validation constraints (hard surface messaging)
 * - Upload flow matches DTF gang upload structure
 * - Add-to-cart gating by validation status
 * - UV-specific error states
 */

// Minimal 1×1 PNG buffer for file upload tests
function createFakePngFile(): Buffer {
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4' +
      '890000000a49444154789c6260000000020001e221bc330000000049454e44ae' +
      '426082',
    'hex'
  );
}

async function mockUvUploadApis(page: Page) {
  await page.route('**/api/uploads/sign-v2', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        signature: 'mock-uv-signature',
        timestamp: Date.now(),
        apiKey: 'mock-api-key',
        cloudName: 'mock-cloud',
        folder: 'uploads/uv-test',
        publicId: 'uploads/uv-test/mock-uv-asset-id',
      }),
    });
  });

  await page.route('**/api.cloudinary.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: 'uploads/uv-test/mock-uv-asset-id',
        secure_url: 'https://res.cloudinary.com/mock/image/upload/mock-uv-asset-id.png',
        width: 3600,
        height: 2400,
        format: 'png',
      }),
    });
  });

  await page.route('**/api/uploads/complete-v2', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        uploadAsset: {
          id: 'mock-uv-asset-uuid',
          cloudinaryUrl: 'https://res.cloudinary.com/mock/image/upload/mock-uv-asset-id.png',
          fileName: 'uv-gang-sheet-test.png',
          validationStatus: 'PENDING',
          metadata: {},
        },
      }),
    });
  });
}

async function mockUvValidationStatus(page: Page, status: string, errorMessage?: string) {
  await page.route('**/api/uploads/assets/mock-uv-asset-uuid', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-uv-asset-uuid',
        validationStatus: status,
        metadata: errorMessage ? { validationError: { message: errorMessage } } : {},
      }),
    });
  });
}

test.describe('UV Upload Journey', () => {
  test('should display UV disclaimer on UV gang sheet product page', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const uvProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /uv|hard surface/i,
    }).first();

    if ((await uvProduct.count()) === 0) {
      test.skip(true, 'No UV product found in catalog — skipping disclaimer test');
      return;
    }

    await uvProduct.click();
    await page.waitForLoadState('networkidle');

    // UV disclaimer should be visible
    await expect(
      page.locator('text=UV Printing - For Hard Surfaces Only, text=UV хэвлэл')
    ).toBeVisible({ timeout: 5000 });

    // Should list suitable hard surfaces
    await expect(
      page.locator('text=Phone cases, text=Suitable for')
    ).toBeVisible();

    // Should warn about fabric
    await expect(
      page.locator('text=NOT suitable for, text=Тохироомжгүй')
    ).toBeVisible();
  });

  test('should NOT show UV disclaimer on DTF gang sheet product', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const dtfProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /gang|sheet/i,
      hasNotText: /uv/i,
    }).first();

    if ((await dtfProduct.count()) === 0) {
      test.skip(true, 'No DTF gang product found — skipping');
      return;
    }

    await dtfProduct.click();
    await page.waitForLoadState('networkidle');

    // UV disclaimer should NOT appear on DTF products
    await expect(
      page.locator('text=UV Printing - For Hard Surfaces Only')
    ).not.toBeVisible();
  });

  test('should show gang sheet length selector on UV gang upload product', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const uvProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /uv/i,
    }).first();

    if ((await uvProduct.count()) === 0) {
      test.skip(true, 'No UV product found — skipping');
      return;
    }

    await uvProduct.click();
    await page.waitForLoadState('networkidle');

    const lengthSelector = page.locator('[data-testid="gang-sheet-length-selector"]');
    await expect(lengthSelector).toBeVisible({ timeout: 5000 });

    // All length options should be present (same as DTF)
    for (const length of [30, 50, 70, 100]) {
      await expect(page.locator(`[data-testid="gang-sheet-length-${length}"]`)).toBeVisible();
    }
  });

  test('should show pending status chip after UV file upload starts', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const uvProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /uv/i,
    }).first();

    if ((await uvProduct.count()) === 0) {
      test.skip(true, 'No UV product found — skipping');
      return;
    }

    await uvProduct.click();
    await page.waitForLoadState('networkidle');

    await mockUvUploadApis(page);
    await mockUvValidationStatus(page, 'PENDING');

    const fileInput = page.locator('[data-testid="gang-sheet-upload-input"]');
    await expect(fileInput).toBeAttached();

    await fileInput.setInputFiles({
      name: 'uv-gang-sheet-test.png',
      mimeType: 'image/png',
      buffer: createFakePngFile(),
    });

    // Status chip should show pending or processing
    await expect(
      page.locator(
        '[data-testid="upload-status-chip-pending"], [data-testid="upload-status-chip-processing"]'
      )
    ).toBeVisible({ timeout: 10000 });

    // Add to cart disabled while pending
    const addToCartBtn = page.locator('[data-testid="gang-upload-add-to-cart"]');
    await expect(addToCartBtn).toBeDisabled();
  });

  test('should enable add-to-cart after UV validation passes', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const uvProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /uv/i,
    }).first();

    if ((await uvProduct.count()) === 0) {
      test.skip(true, 'No UV product found — skipping');
      return;
    }

    await uvProduct.click();
    await page.waitForLoadState('networkidle');

    await mockUvUploadApis(page);
    await mockUvValidationStatus(page, 'PASSED');

    const fileInput = page.locator('[data-testid="gang-sheet-upload-input"]');
    await fileInput.setInputFiles({
      name: 'uv-gang-sheet-test.png',
      mimeType: 'image/png',
      buffer: createFakePngFile(),
    });

    // Wait for passed status
    await expect(
      page.locator('[data-testid="upload-status-chip-passed"]')
    ).toBeVisible({ timeout: 15000 });

    // Add to cart should now be enabled
    const addToCartBtn = page.locator('[data-testid="gang-upload-add-to-cart"]');
    await expect(addToCartBtn).toBeEnabled();
  });

  test('should show failed status and error for UV-specific constraint violation', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const uvProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /uv/i,
    }).first();

    if ((await uvProduct.count()) === 0) {
      test.skip(true, 'No UV product found — skipping');
      return;
    }

    await uvProduct.click();
    await page.waitForLoadState('networkidle');

    await mockUvUploadApis(page);
    await mockUvValidationStatus(
      page,
      'FAILED',
      'File too large for UV transfer (maximum 50MB)'
    );

    const fileInput = page.locator('[data-testid="gang-sheet-upload-input"]');
    await fileInput.setInputFiles({
      name: 'oversized-uv.png',
      mimeType: 'image/png',
      buffer: createFakePngFile(),
    });

    // Failed chip appears
    await expect(
      page.locator('[data-testid="upload-status-chip-failed"]')
    ).toBeVisible({ timeout: 15000 });

    // Error message with UV constraint info
    await expect(
      page.locator('[data-testid="upload-error-message"]')
    ).toContainText('50MB');

    // Add to cart must remain blocked
    const addToCartBtn = page.locator('[data-testid="gang-upload-add-to-cart"]');
    await expect(addToCartBtn).toBeDisabled();
  });

  test('should block UV add-to-cart without upload', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const uvProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /uv/i,
    }).first();

    if ((await uvProduct.count()) === 0) {
      test.skip(true, 'No UV product found — skipping');
      return;
    }

    await uvProduct.click();
    await page.waitForLoadState('networkidle');

    // No upload → add to cart disabled
    const addToCartBtn = page.locator('[data-testid="gang-upload-add-to-cart"]');
    await expect(addToCartBtn).toBeDisabled();
  });

  test('should add UV product to cart after validation passes', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const uvProduct = page.locator('[data-testid="product-card"]').filter({
      hasText: /uv/i,
    }).first();

    if ((await uvProduct.count()) === 0) {
      test.skip(true, 'No UV product found — skipping');
      return;
    }

    await uvProduct.click();
    await page.waitForLoadState('networkidle');

    await mockUvUploadApis(page);
    await mockUvValidationStatus(page, 'PASSED');

    const fileInput = page.locator('[data-testid="gang-sheet-upload-input"]');
    await fileInput.setInputFiles({
      name: 'uv-gang-sheet-test.png',
      mimeType: 'image/png',
      buffer: createFakePngFile(),
    });

    await expect(
      page.locator('[data-testid="upload-status-chip-passed"]')
    ).toBeVisible({ timeout: 15000 });

    const addToCartBtn = page.locator('[data-testid="gang-upload-add-to-cart"]');
    await expect(addToCartBtn).toBeEnabled();
    await addToCartBtn.click();

    // Cart should update
    await expect(
      page.locator('text=Added to cart, [data-testid="cart-count"]')
    ).toBeVisible({ timeout: 5000 });
  });
});
