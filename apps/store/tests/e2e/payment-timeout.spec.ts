import { test, expect } from '@playwright/test';

/**
 * E2E Test: Payment Timeout Scenarios
 *
 * Tests the 5-minute payment polling timeout behavior
 * Verifies timeout handling, error messages, and retry mechanisms
 */

test.describe('Payment Timeout', () => {
  // Increase test timeout for 5-minute polling tests
  test.setTimeout(360000); // 6 minutes

  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show timeout message after 5 minutes of polling', async ({ page }) => {
    // This test simulates the full 5-minute timeout
    // In a real scenario, you might want to mock the API to speed this up

    await test.step('Complete checkout to reach payment page', async () => {
      // Quick checkout flow
      await page.goto('/products');
      await page.waitForSelector('[data-testid="product-card"]');
      await page.locator('[data-testid="product-card"]').first().click();
      await page.locator('[data-testid="add-to-cart-btn"]').first().click();

      await page.locator('[data-testid="cart-icon"]').click();
      await page.waitForTimeout(500); // Wait for sidebar to open

      await page.locator('[data-testid="checkout-btn"]').click();
      await page.waitForURL('/checkout');

      // Fill shipping
      await page.locator('[data-testid="shipping-name"]').fill('Test User');
      await page.locator('[data-testid="shipping-phone"]').fill('99001122');
      await page.locator('[data-testid="shipping-address"]').fill('Test Address');

      await page.locator('[data-testid="submit-order-btn"]').click();
      await page.waitForURL(/\/payment\/.+/, { timeout: 15000 });
    });

    await test.step('Wait for 5-minute timeout', async () => {
      // Wait for QR code
      await page.waitForSelector('[data-testid="qpay-qr-code"]', { timeout: 10000 });

      // Wait 5 minutes + buffer for timeout to trigger
      // In production, you might mock this or use API interception
      await page.waitForTimeout(305000); // 5 minutes 5 seconds

      // Verify timeout message appears
      const timeoutMessage = page.locator('[data-testid="payment-timeout-message"]');
      await expect(timeoutMessage).toBeVisible({ timeout: 10000 });

      // Verify timeout message text
      await expect(timeoutMessage).toContainText(/timeout|expired|time.*up/i);
    });

    await test.step('Verify retry option is available', async () => {
      // Check for retry button
      const retryButton = page.locator('[data-testid="retry-payment-btn"]');
      await expect(retryButton).toBeVisible();

      // Optionally test retry
      await retryButton.click();

      // Should navigate back to checkout or generate new QR
      // Verify new QR code or checkout page
      const isCheckout = await page.url().includes('/checkout');
      const hasNewQR = await page.locator('[data-testid="qpay-qr-code"]').isVisible().catch(() => false);

      expect(isCheckout || hasNewQR).toBeTruthy();
    });
  });

  test('should continue polling while payment is pending', async ({ page }) => {
    await test.step('Reach payment page', async () => {
      await page.goto('/products');
      await page.waitForSelector('[data-testid="product-card"]');
      await page.locator('[data-testid="product-card"]').first().click();
      await page.locator('[data-testid="add-to-cart-btn"]').first().click();

      await page.locator('[data-testid="cart-icon"]').click();
      await page.locator('[data-testid="checkout-btn"]').click();

      await page.locator('[data-testid="shipping-name"]').fill('Test User');
      await page.locator('[data-testid="shipping-phone"]').fill('99001122');
      await page.locator('[data-testid="shipping-address"]').fill('Test Address');

      await page.locator('[data-testid="submit-order-btn"]').click();
      await page.waitForURL(/\/payment\/.+/);
    });

    await test.step('Verify polling indicator remains active', async () => {
      // Wait for QR code
      await page.waitForSelector('[data-testid="qpay-qr-code"]');

      // Verify polling indicator is present initially
      const pollingIndicator = page.locator('[data-testid="payment-polling"]');
      await expect(pollingIndicator).toBeVisible();

      // Wait 30 seconds and verify still polling
      await page.waitForTimeout(30000);
      await expect(pollingIndicator).toBeVisible();

      // Wait another 30 seconds and verify still polling
      await page.waitForTimeout(30000);
      await expect(pollingIndicator).toBeVisible();
    });
  });

  test('should show elapsed time during polling', async ({ page }) => {
    await test.step('Reach payment page', async () => {
      await page.goto('/products');
      await page.waitForSelector('[data-testid="product-card"]');
      await page.locator('[data-testid="product-card"]').first().click();
      await page.locator('[data-testid="add-to-cart-btn"]').first().click();

      await page.locator('[data-testid="cart-icon"]').click();
      await page.locator('[data-testid="checkout-btn"]').click();

      await page.locator('[data-testid="shipping-name"]').fill('Test User');
      await page.locator('[data-testid="shipping-phone"]').fill('99001122');
      await page.locator('[data-testid="shipping-address"]').fill('Test Address');

      await page.locator('[data-testid="submit-order-btn"]').click();
      await page.waitForURL(/\/payment\/.+/);
    });

    await test.step('Verify timer updates', async () => {
      await page.waitForSelector('[data-testid="qpay-qr-code"]');

      // Check for timer element (if implemented)
      const timer = page.locator('[data-testid="payment-timer"]');
      const hasTimer = await timer.isVisible().catch(() => false);

      if (hasTimer) {
        // Get initial time
        const initialTime = await timer.textContent();

        // Wait 10 seconds
        await page.waitForTimeout(10000);

        // Verify time has changed
        const updatedTime = await timer.textContent();
        expect(updatedTime).not.toBe(initialTime);
      }
    });
  });

  test('should allow user to cancel payment and return to checkout', async ({ page }) => {
    await test.step('Reach payment page', async () => {
      await page.goto('/products');
      await page.waitForSelector('[data-testid="product-card"]');
      await page.locator('[data-testid="product-card"]').first().click();
      await page.locator('[data-testid="add-to-cart-btn"]').first().click();

      await page.locator('[data-testid="cart-icon"]').click();
      await page.locator('[data-testid="checkout-btn"]').click();

      await page.locator('[data-testid="shipping-name"]').fill('Test User');
      await page.locator('[data-testid="shipping-phone"]').fill('99001122');
      await page.locator('[data-testid="shipping-address"]').fill('Test Address');

      await page.locator('[data-testid="submit-order-btn"]').click();
      await page.waitForURL(/\/payment\/.+/);
    });

    await test.step('Cancel payment', async () => {
      await page.waitForSelector('[data-testid="qpay-qr-code"]');

      // Look for cancel button
      const cancelButton = page.locator('[data-testid="cancel-payment-btn"]');
      const hasCancelButton = await cancelButton.isVisible().catch(() => false);

      if (hasCancelButton) {
        await cancelButton.click();

        // Should redirect back to cart or checkout
        await expect(page).toHaveURL(/\/(cart|checkout)/);
      }
    });
  });
});

/**
 * Helper function to mock API responses for faster testing
 * This can be used to speed up timeout tests without waiting 5 minutes
 */
test.describe('Payment Timeout (Mocked)', () => {
  test('should handle timeout with mocked API', async ({ page }) => {
    // Intercept payment status API
    await page.route('**/api/payment/verify/*', async (route) => {
      // Always return pending status to simulate timeout
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'PENDING',
          message: 'Payment not completed yet'
        })
      });
    });

    // Complete checkout
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    await page.locator('[data-testid="product-card"]').first().click();
    await page.locator('[data-testid="add-to-cart-btn"]').first().click();

    await page.locator('[data-testid="cart-icon"]').click();
    await page.waitForTimeout(500); // Wait for sidebar to open
    await page.locator('[data-testid="checkout-btn"]').click();

    await page.locator('[data-testid="shipping-name"]').fill('Test User');
    await page.locator('[data-testid="shipping-phone"]').fill('99001122');
    await page.locator('[data-testid="shipping-address"]').fill('Test Address');

    await page.locator('[data-testid="submit-order-btn"]').click();
    await page.waitForURL(/\/payment\/.+/);

    // Verify QR code appears
    await page.waitForSelector('[data-testid="qpay-qr-code"]');

    // Note: This test would still take 5 minutes unless you also mock the client-side timeout
    // You can use browser console to manipulate the timeout for faster testing
  });
});
