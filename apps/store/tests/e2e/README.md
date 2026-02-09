# E2E Tests with Playwright

Frontend end-to-end tests for the eCommerce store application.

## 📋 Test Suites

### 1. Checkout Flow (`checkout.spec.ts`)
Tests the complete user journey from browsing to payment:
- ✅ Add product to cart
- ✅ View cart
- ✅ Proceed to checkout
- ✅ Fill shipping information
- ✅ Verify QPay QR code display
- ✅ Validate form inputs
- ✅ Update cart quantities
- ✅ Remove items from cart
- ✅ Handle out-of-stock products

### 2. Payment Timeout (`payment-timeout.spec.ts`)
Tests the 5-minute payment polling timeout behavior:
- ⏱️ 5-minute timeout verification
- 🔄 Continuous polling while pending
- ⏲️ Elapsed time display
- 🔁 Retry payment option
- ❌ Cancel payment functionality
- 🧪 Mocked API for faster testing

**⚠️ Warning:** The full timeout test takes 5+ minutes to complete!

### 3. Error Boundaries (`error-boundaries.spec.ts`)
Tests error handling and graceful degradation:
- 🛡️ Component crash error boundaries
- 📡 Network error handling
- ⚠️ API error responses
- 🔌 Offline mode handling
- 🔄 Retry mechanisms
- 📦 Loading states
- 🚫 404 errors
- 💳 Payment verification errors

## 🚀 Running Tests

### Prerequisites
1. Install dependencies:
   ```bash
   npm install
   ```

2. Ensure backend is running:
   ```bash
   cd ../../backend
   npm run dev
   ```

3. Ensure store frontend is running:
   ```bash
   cd ../apps/store
   npm run dev
   ```

### Run All Tests
```bash
npm run test:e2e
```

### Run Tests with UI Mode (Recommended for Development)
```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode (See Browser)
```bash
npm run test:e2e:headed
```

### Debug Mode
```bash
npm run test:e2e:debug
```

### Run Specific Test File
```bash
npx playwright test checkout.spec.ts
```

### Run Specific Test
```bash
npx playwright test -g "should complete full checkout flow"
```

### View Test Report
```bash
npm run test:e2e:report
```

## 📊 Test Data Requirements

### ⚠️ Important Notes:
1. **Production Data**: Tests run against the actual store, so they may interact with real data
2. **Database State**: Some tests expect products to exist in the database
3. **QPay Integration**: Payment tests use real QPay sandbox API
4. **Test Isolation**: Tests should clean up after themselves, but may leave test orders in the database

### Recommended Setup:
- Use test products with recognizable names (e.g., "Test Product - Do Not Delete")
- Keep at least 1-2 products in the database for tests to use
- Periodically clean up test orders from the database

## 🎯 Test Data Attributes

Tests use `data-testid` attributes to locate elements. Make sure your components include these:

### Cart & Products
- `data-testid="product-card"` - Product cards
- `data-testid="add-to-cart-btn"` - Add to cart button
- `data-testid="cart-icon"` - Cart icon in header
- `data-testid="cart-badge"` - Cart item count badge
- `data-testid="cart-item"` - Individual cart items
- `data-testid="cart-empty"` - Empty cart message
- `data-testid="increase-quantity"` - Increase quantity button
- `data-testid="remove-item"` - Remove item button

### Checkout
- `data-testid="checkout-btn"` - Checkout button
- `data-testid="shipping-name"` - Name input
- `data-testid="shipping-phone"` - Phone input
- `data-testid="shipping-address"` - Address input
- `data-testid="submit-order-btn"` - Submit order button
- `data-testid="checkout-error"` - Checkout error message

### Payment
- `data-testid="qpay-qr-code"` - QPay QR code image
- `data-testid="payment-polling"` - Payment polling indicator
- `data-testid="payment-timeout-message"` - Timeout message
- `data-testid="payment-timer"` - Payment timer (optional)
- `data-testid="retry-payment-btn"` - Retry payment button
- `data-testid="cancel-payment-btn"` - Cancel payment button
- `data-testid="payment-error"` - Payment error message

### Error States
- `data-testid="error-boundary"` - Error boundary UI
- `data-testid="error-retry-btn"` - Generic retry button
- `data-testid="products-error"` - Products loading error
- `data-testid="products-loading"` - Products loading indicator
- `data-testid="retry-products-btn"` - Retry loading products

## 🔧 Configuration

Edit `playwright.config.ts` to customize:
- Browser selection (Chromium, Firefox, WebKit)
- Viewport sizes (Desktop, Mobile)
- Timeouts
- Parallelization
- Retry behavior
- Screenshot/video capture

## 📈 CI/CD Integration

Tests are configured for CI/CD environments:
- Automatic retries on failure (2 retries in CI)
- Sequential execution (no parallel tests)
- HTML report generation
- JSON report for processing

### GitHub Actions Example:
```yaml
- name: Run E2E Tests
  run: |
    cd apps/store
    npm run test:e2e
- name: Upload Test Report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: apps/store/playwright-report/
```

## 🐛 Troubleshooting

### Tests Fail with "Timeout"
- Increase timeout in `playwright.config.ts`
- Check if backend is running
- Check if frontend is running on correct port

### "Element not found" Errors
- Verify `data-testid` attributes exist in components
- Check if element appears after async operation
- Increase `waitForSelector` timeout

### QPay Tests Fail
- Verify QPay sandbox credentials in backend `.env`
- Check backend logs for QPay API errors
- Ensure backend is properly handling QPay requests

### Payment Timeout Test Takes Forever
- Use mocked version: `payment-timeout.spec.ts` has a mocked test suite
- Or skip with: `test.skip()` during development

## 📝 Writing New Tests

1. Create a new `.spec.ts` file in `tests/e2e/`
2. Import Playwright test utilities:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Use `test.describe()` to group related tests
4. Use `test()` for individual test cases
5. Use `test.step()` for clearer test structure
6. Add `data-testid` attributes to elements you need to test

### Example:
```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await test.step('Navigate to page', async () => {
      await page.goto('/my-page');
    });

    await test.step('Interact with element', async () => {
      await page.locator('[data-testid="my-button"]').click();
    });

    await test.step('Verify result', async () => {
      await expect(page.locator('[data-testid="result"]')).toBeVisible();
    });
  });
});
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Tests](https://playwright.dev/docs/debug)
- [Test Generator](https://playwright.dev/docs/codegen)

## ✅ Success Criteria

Tests are considered passing when:
- ✅ All test files pass without errors
- ✅ No timeout errors
- ✅ No flaky tests (tests pass consistently)
- ✅ Critical user flows are covered
- ✅ Error handling is verified

---

**Last Updated:** 2026-02-09
**Test Coverage:** 3 test suites, 20+ test cases
**Status:** ✅ Ready for use
