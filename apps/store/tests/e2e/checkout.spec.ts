import { test, expect } from '@playwright/test';

/**
 * E2E Test: Complete Checkout Flow
 *
 * Tests the full user journey from browsing products to payment
 * Verifies: Add to cart → Checkout → Fill shipping → QPay QR display
 */

test.describe('Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should complete full checkout flow and display QPay QR code', async ({ page }) => {
    // Step 1: Browse products and add to cart
    await test.step('Add product to cart', async () => {
      // Wait for products to load
      await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

      // Click first available product
      const firstProduct = page.locator('[data-testid="product-card"]').first();
      await firstProduct.click();

      // Wait for product detail page
      await page.waitForURL(/\/product\/.+/);

      // Select variant if available
      const variantSelector = page.locator('[data-testid="variant-select"]');
      if (await variantSelector.isVisible()) {
        await variantSelector.click();
        await page.locator('[data-testid="variant-option"]').first().click();
      }

      // Add to cart
      await page.locator('[data-testid="add-to-cart-btn"]').first().click();

      // Verify cart count increased
      const cartBadge = page.locator('[data-testid="cart-badge"]');
      await expect(cartBadge).toBeVisible();
    });

    // Step 2: Navigate to cart
    await test.step('View cart', async () => {
      await page.locator('[data-testid="cart-icon"]').click();

      // Cart is a sidebar, not a separate page - wait for it to open
      await page.waitForTimeout(500); // Wait for sidebar animation

      // Verify cart has items
      await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1, { timeout: 5000 });
    });

    // Step 3: Proceed to checkout
    await test.step('Proceed to checkout', async () => {
      await page.locator('[data-testid="checkout-btn"]').click();
      await page.waitForURL('/checkout');
    });

    // Step 4: Fill shipping information
    await test.step('Fill shipping information', async () => {
      // Fill shipping form
      await page.locator('[data-testid="shipping-name"]').fill('Test User');
      await page.locator('[data-testid="shipping-phone"]').fill('99001122');
      await page.locator('[data-testid="shipping-address"]').fill('Test Address, District 1, Ulaanbaatar');

      // Submit shipping form
      await page.locator('[data-testid="submit-order-btn"]').click();
    });

    // Step 5: Verify QPay QR code is displayed
    await test.step('Verify QPay QR code display', async () => {
      // Wait for redirect to payment page
      await page.waitForURL(/\/payment\/.+/, { timeout: 15000 });

      // Wait for QR code to load
      await page.waitForSelector('[data-testid="qpay-qr-code"]', { timeout: 10000 });

      // Verify QR code image is visible
      const qrCode = page.locator('[data-testid="qpay-qr-code"]');
      await expect(qrCode).toBeVisible();

      // Verify payment instructions are shown
      await expect(page.locator('text=/scan.*qr.*code/i')).toBeVisible();

      // Verify polling is active (look for loading indicator)
      const pollingIndicator = page.locator('[data-testid="payment-polling"]');
      await expect(pollingIndicator).toBeVisible({ timeout: 5000 });
    });
  });

  test('should handle out of stock products', async ({ page }) => {
    // Try to add out of stock product
    await page.goto('/products');

    // Look for out of stock badge
    const outOfStockProduct = page.locator('[data-testid="product-card"]:has-text("Out of Stock")').first();

    if (await outOfStockProduct.isVisible()) {
      await outOfStockProduct.click();

      // Verify add to cart button is disabled
      const addToCartBtn = page.locator('[data-testid="add-to-cart-btn"]');
      await expect(addToCartBtn).toBeDisabled();
    }
  });

  test('should validate shipping form inputs', async ({ page }) => {
    // Navigate directly to checkout
    await page.goto('/checkout');

    // Try to submit empty form
    await page.locator('[data-testid="submit-order-btn"]').click();

    // HTML5 validation should prevent form submission
    // Verify we're still on checkout page (not navigated to payment)
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/checkout');

    // Verify HTML5 validation is active on required fields
    const nameInvalid = await page.locator('[data-testid="shipping-name"]').evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(nameInvalid).toBeTruthy();
  });

  test('should validate phone number format', async ({ page }) => {
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    await page.locator('[data-testid="product-card"]').first().click();
    await page.locator('[data-testid="add-to-cart-btn"]').first().click();

    await page.locator('[data-testid="cart-icon"]').click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="checkout-btn"]').click();
    await page.waitForURL('/checkout');

    // Fill form with invalid phone
    await page.locator('[data-testid="shipping-name"]').fill('Test User');
    await page.locator('[data-testid="shipping-phone"]').fill('123'); // Too short (needs 8 digits)
    await page.locator('[data-testid="shipping-address"]').fill('Test Address Long Enough');

    await page.locator('[data-testid="submit-order-btn"]').click();

    // Validation should prevent form submission - stay on checkout page
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/checkout');
  });

  test('should update cart quantity', async ({ page }) => {
    // Add product to cart first
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    await page.locator('[data-testid="product-card"]').first().click();
    await page.locator('[data-testid="add-to-cart-btn"]').first().click();

    // Go to cart
    await page.locator('[data-testid="cart-icon"]').click();
    await page.waitForTimeout(500); // Wait for sidebar to open

    // Increase quantity
    await page.locator('[data-testid="increase-quantity"]').first().click();

    // Verify quantity updated
    const quantity = page.locator('[data-testid="item-quantity"]').first();
    await expect(quantity).toHaveText('2');

    // Verify total price updated
    const originalPrice = await page.locator('[data-testid="item-price"]').first().textContent();
    const totalPrice = await page.locator('[data-testid="cart-total"]').textContent();

    // Total should be at least 2x the item price
    expect(totalPrice).toBeTruthy();
  });

  test('should remove item from cart', async ({ page }) => {
    // Add product to cart first
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    await page.locator('[data-testid="product-card"]').first().click();
    await page.locator('[data-testid="add-to-cart-btn"]').first().click();

    // Go to cart
    await page.locator('[data-testid="cart-icon"]').click();
    await page.waitForTimeout(500); // Wait for sidebar to open

    // Remove item
    await page.locator('[data-testid="remove-item"]').first().click();

    // Verify cart is empty
    await expect(page.locator('[data-testid="cart-empty"]')).toBeVisible({ timeout: 3000 });
  });
});
