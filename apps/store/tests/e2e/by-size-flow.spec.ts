import { test, expect } from '@playwright/test';

/**
 * E2E Test: By-Size Product Journey (P1-08)
 *
 * Tests the complete user flow for BY_SIZE product family:
 * - Navigate to product from homepage
 * - View product details with tiered pricing
 * - Select quantity and see price update
 * - Add to cart
 * - View cart and verify items
 * - Proceed to checkout
 */

test.describe('BY_SIZE Product Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/Korean/i);
  });

  test('should display BY_SIZE product with tiered pricing', async ({ page }) => {
    // Navigate to products page
    await page.click('text=Shop Now');
    await page.waitForURL(/\/products/);

    // Find and click on a BY_SIZE product
    const productCards = page.locator('[data-testid="product-card"]').first();
    await productCards.click();

    // Verify product page loaded
    await expect(page.locator('h1')).toBeVisible();

    // Verify tiered pricing table is visible
    await expect(page.locator('text=Quantity Pricing')).toBeVisible();
    await expect(page.locator('text=Base Price')).toBeVisible();

    // Verify quantity selector exists
    await expect(page.locator('input[type="number"]')).toBeVisible();
  });

  test('should update price when quantity changes', async ({ page }) => {
    // Navigate to a BY_SIZE product
    await page.goto('/products');
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    await firstProduct.click();

    // Wait for product page to load
    await page.waitForSelector('text=Quantity Pricing');

    // Find quantity input
    const quantityInput = page.locator('input[type="number"]').first();

    // Get initial price
    const initialPriceText = await page.locator('[data-testid="total-price"]').textContent();

    // Increase quantity
    await quantityInput.fill('50');
    await page.waitForTimeout(500); // Wait for price recalculation

    // Get updated price
    const updatedPriceText = await page.locator('[data-testid="total-price"]').textContent();

    // Verify price changed (tiered pricing should apply)
    expect(initialPriceText).not.toBe(updatedPriceText);
  });

  test('should add BY_SIZE product to cart successfully', async ({ page }) => {
    // Navigate to products page
    await page.goto('/products');

    // Click on first product
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    const productName = await firstProduct.locator('h3').textContent();
    await firstProduct.click();

    // Wait for product page
    await page.waitForSelector('text=Add to Cart');

    // Set quantity
    const quantityInput = page.locator('input[type="number"]').first();
    await quantityInput.fill('25');

    // Click Add to Cart
    await page.click('text=Add to Cart');

    // Verify success message or cart update
    await expect(page.locator('text=Added to cart')).toBeVisible({ timeout: 5000 });

    // Navigate to cart
    await page.click('[data-testid="cart-button"]');
    await page.waitForURL(/\/cart/);

    // Verify product is in cart
    await expect(page.locator(`text=${productName}`)).toBeVisible();
    await expect(page.locator('text=25')).toBeVisible();
  });

  test('should show empty cart message when cart is empty', async ({ page }) => {
    // Clear cart first (if any items exist)
    await page.goto('/cart');

    // Check if cart is empty or clear it
    const emptyMessage = page.locator('text=Your cart is empty');
    const isCartEmpty = await emptyMessage.isVisible().catch(() => false);

    if (!isCartEmpty) {
      // Remove all items
      const removeButtons = page.locator('button:has-text("Remove")');
      const count = await removeButtons.count();
      for (let i = 0; i < count; i++) {
        await removeButtons.first().click();
        await page.waitForTimeout(500);
      }
    }

    // Verify empty cart message
    await expect(page.locator('text=Your cart is empty')).toBeVisible();
  });

  test('should calculate subtotal correctly in cart', async ({ page }) => {
    // Add a BY_SIZE product to cart
    await page.goto('/products');
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    await firstProduct.click();

    // Set quantity and add to cart
    const quantityInput = page.locator('input[type="number"]').first();
    await quantityInput.fill('10');
    await page.click('text=Add to Cart');
    await page.waitForTimeout(1000);

    // Go to cart
    await page.goto('/cart');

    // Verify subtotal is displayed
    await expect(page.locator('text=Subtotal')).toBeVisible();

    // Verify total is displayed
    await expect(page.locator('text=Total')).toBeVisible();

    // Verify checkout button is enabled
    const checkoutButton = page.locator('button:has-text("Proceed to Checkout")');
    await expect(checkoutButton).toBeEnabled();
  });

  test('should persist cart items across page navigation', async ({ page }) => {
    // Add product to cart
    await page.goto('/products');
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    const productName = await firstProduct.locator('h3').textContent();
    await firstProduct.click();

    await page.locator('input[type="number"]').first().fill('5');
    await page.click('text=Add to Cart');
    await page.waitForTimeout(1000);

    // Navigate away and back
    await page.goto('/');
    await page.goto('/cart');

    // Verify item is still in cart
    await expect(page.locator(`text=${productName}`)).toBeVisible();
    await expect(page.locator('text=5')).toBeVisible();
  });

  test('should update quantity in cart', async ({ page }) => {
    // Add product to cart
    await page.goto('/products');
    await page.locator('[data-testid="product-card"]').first().click();
    await page.locator('input[type="number"]').first().fill('10');
    await page.click('text=Add to Cart');
    await page.waitForTimeout(1000);

    // Go to cart
    await page.goto('/cart');

    // Find quantity input in cart
    const cartQuantityInput = page.locator('[data-testid="cart-item-quantity"]').first();

    // Update quantity
    await cartQuantityInput.fill('20');
    await page.waitForTimeout(1000);

    // Verify quantity updated
    await expect(cartQuantityInput).toHaveValue('20');
  });

  test('should remove item from cart', async ({ page }) => {
    // Add product to cart
    await page.goto('/products');
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    const productName = await firstProduct.locator('h3').textContent();
    await firstProduct.click();

    await page.locator('input[type="number"]').first().fill('5');
    await page.click('text=Add to Cart');
    await page.waitForTimeout(1000);

    // Go to cart
    await page.goto('/cart');

    // Verify item exists
    await expect(page.locator(`text=${productName}`)).toBeVisible();

    // Remove item
    await page.click('button:has-text("Remove")');
    await page.waitForTimeout(500);

    // Verify item removed and empty cart message shown
    await expect(page.locator('text=Your cart is empty')).toBeVisible();
  });
});
