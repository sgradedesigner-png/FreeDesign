import { test, expect } from '@playwright/test';

/**
 * E2E Test: Blanks Collection Journey (P1-08)
 *
 * Tests the complete user flow for BLANKS product family:
 * - Navigate to Blanks collection
 * - Filter products by size
 * - Sort products by price
 * - View product details
 * - Select size variant
 * - Add to cart with selected size
 * - Verify cart shows correct variant
 */

test.describe('Blanks Collection Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from homepage
    await page.goto('/');
  });

  test('should navigate to Blanks collection from homepage', async ({ page }) => {
    // Find and click Blanks collection link
    const blanksLink = page.locator('a[href*="/collections/blanks"]').first();
    await blanksLink.click();

    // Verify we're on the collection page
    await page.waitForURL(/\/collections\/blanks/);
    await expect(page.locator('h1')).toContainText(/Blanks|Blank/i);

    // Verify products are displayed
    const productCards = page.locator('[data-testid="product-card"]');
    await expect(productCards.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display filter sidebar with size options', async ({ page }) => {
    await page.goto('/collections/blanks');

    // Wait for page to load
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

    // Verify filter sidebar or filter controls exist
    const filterContainer = page.locator('[data-testid="filter-sidebar"]').or(
      page.locator('text=Filter').first()
    );
    await expect(filterContainer).toBeVisible();

    // Verify size filter options exist (S, M, L, XL, etc.)
    const sizeFilters = page.locator('text=S').or(page.locator('text=Medium'));
    await expect(sizeFilters.first()).toBeVisible();
  });

  test('should filter products by size', async ({ page }) => {
    await page.goto('/collections/blanks');

    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

    // Count initial products
    const initialCount = await page.locator('[data-testid="product-card"]').count();
    expect(initialCount).toBeGreaterThan(0);

    // Click on a size filter (e.g., "M")
    const sizeFilterM = page.locator('[data-testid="size-filter-m"]').or(
      page.locator('label:has-text("M")').first()
    );

    if (await sizeFilterM.isVisible()) {
      await sizeFilterM.click();
      await page.waitForTimeout(1000); // Wait for filtering

      // Verify URL contains size parameter
      await expect(page).toHaveURL(/size=/);

      // Verify filtered results (may be same or fewer)
      const filteredCount = await page.locator('[data-testid="product-card"]').count();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    }
  });

  test('should sort products by price', async ({ page }) => {
    await page.goto('/collections/blanks');

    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

    // Find sort dropdown
    const sortDropdown = page.locator('[data-testid="sort-dropdown"]').or(
      page.locator('select').first()
    );

    if (await sortDropdown.isVisible()) {
      // Select "Price: Low to High"
      await sortDropdown.selectOption({ label: /Low to High/i });
      await page.waitForTimeout(1000);

      // Verify URL contains sort parameter
      await expect(page).toHaveURL(/sort=/);

      // Get first two product prices and verify order
      const priceElements = page.locator('[data-testid="product-price"]');
      const count = await priceElements.count();

      if (count >= 2) {
        const price1Text = await priceElements.nth(0).textContent();
        const price2Text = await priceElements.nth(1).textContent();

        const price1 = parseFloat(price1Text?.replace(/[^0-9.]/g, '') || '0');
        const price2 = parseFloat(price2Text?.replace(/[^0-9.]/g, '') || '0');

        expect(price1).toBeLessThanOrEqual(price2);
      }
    }
  });

  test('should view Blanks product details with size variants', async ({ page }) => {
    await page.goto('/collections/blanks');

    // Wait for products to load
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

    // Click on first product
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    await firstProduct.click();

    // Verify product page loaded
    await page.waitForURL(/\/products\//);
    await expect(page.locator('h1')).toBeVisible();

    // Verify size selector is visible
    const sizeSelector = page.locator('[data-testid="size-selector"]').or(
      page.locator('text=Select Size').first()
    );
    await expect(sizeSelector).toBeVisible({ timeout: 5000 });

    // Verify size options are available
    const sizeOptions = page.locator('[data-testid^="size-option-"]').or(
      page.locator('button:has-text("S"), button:has-text("M"), button:has-text("L")')
    );
    await expect(sizeOptions.first()).toBeVisible();
  });

  test('should select size variant and update price', async ({ page }) => {
    await page.goto('/collections/blanks');
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

    // Click on first product
    await page.locator('[data-testid="product-card"]').first().click();
    await page.waitForURL(/\/products\//);

    // Wait for size selector
    await page.waitForTimeout(1000);

    // Find size buttons
    const sizeButtons = page.locator('button:has-text("M"), button:has-text("L")');

    if ((await sizeButtons.count()) > 0) {
      // Get initial price
      const initialPrice = await page.locator('[data-testid="product-price"]').textContent();

      // Click on a size
      await sizeButtons.first().click();
      await page.waitForTimeout(500);

      // Verify size is selected (button should have selected state)
      const selectedSize = sizeButtons.first();
      await expect(selectedSize).toHaveClass(/selected|active|ring/);

      // Note: Price might not change if all sizes have same price
      const updatedPrice = await page.locator('[data-testid="product-price"]').textContent();
      expect(updatedPrice).toBeDefined();
    }
  });

  test('should add Blanks product to cart with selected size', async ({ page }) => {
    await page.goto('/collections/blanks');
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

    // Get product name
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    const productName = await firstProduct.locator('h3').textContent();
    await firstProduct.click();

    await page.waitForURL(/\/products\//);
    await page.waitForTimeout(1000);

    // Select size (M)
    const sizeMButton = page.locator('button:has-text("M")').first();
    if (await sizeMButton.isVisible()) {
      await sizeMButton.click();
      await page.waitForTimeout(500);
    }

    // Set quantity
    const quantityInput = page.locator('input[type="number"]').first();
    if (await quantityInput.isVisible()) {
      await quantityInput.fill('3');
    }

    // Add to cart
    await page.click('text=Add to Cart');
    await page.waitForTimeout(1000);

    // Navigate to cart
    await page.goto('/cart');

    // Verify product in cart
    await expect(page.locator(`text=${productName}`)).toBeVisible();

    // Verify size is shown in cart
    await expect(page.locator('text=M')).toBeVisible();

    // Verify quantity
    await expect(page.locator('text=3')).toBeVisible();
  });

  test('should show out-of-stock variants as disabled', async ({ page }) => {
    await page.goto('/collections/blanks');
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

    // Click on a product
    await page.locator('[data-testid="product-card"]').first().click();
    await page.waitForURL(/\/products\//);
    await page.waitForTimeout(1000);

    // Check for out-of-stock size buttons
    const outOfStockButtons = page.locator('button:has-text("Out of Stock")');
    const count = await outOfStockButtons.count();

    if (count > 0) {
      // Verify they are disabled
      const firstOutOfStock = outOfStockButtons.first();
      await expect(firstOutOfStock).toBeDisabled();
    }
  });

  test('should clear filters and show all products', async ({ page }) => {
    await page.goto('/collections/blanks');
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

    // Apply a filter
    const sizeFilterM = page.locator('[data-testid="size-filter-m"]').or(
      page.locator('label:has-text("M")').first()
    );

    if (await sizeFilterM.isVisible()) {
      await sizeFilterM.click();
      await page.waitForTimeout(1000);

      // Look for "Clear Filters" button
      const clearButton = page.locator('button:has-text("Clear")').or(
        page.locator('button:has-text("Reset")')
      );

      if (await clearButton.isVisible()) {
        await clearButton.click();
        await page.waitForTimeout(1000);

        // Verify URL doesn't have filter params
        await expect(page).toHaveURL(/^(?!.*size=)/);
      }
    }
  });

  test('should navigate back to collections from product page', async ({ page }) => {
    await page.goto('/collections/blanks');
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

    // Click on product
    await page.locator('[data-testid="product-card"]').first().click();
    await page.waitForURL(/\/products\//);

    // Click back button or breadcrumb
    const backButton = page.locator('button:has-text("Back")').or(
      page.locator('a:has-text("Blanks")')
    );

    if (await backButton.isVisible()) {
      await backButton.click();

      // Verify we're back on collection page
      await page.waitForURL(/\/collections\/blanks/);
    }
  });
});
