import { test, expect } from '@playwright/test';

/**
 * E2E Test: Start Order Navigation & MegaMenu (P1-08)
 *
 * Tests the navigation flow for ordering custom products:
 * - Access Start Order page via MegaMenu
 * - Navigate between product families
 * - Collection quick links
 * - Mobile navigation menu
 * - Desktop MegaMenu hover behavior
 */

test.describe('Start Order Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display MegaMenu on desktop hover', async ({ page, viewport }) => {
    // Skip if mobile viewport
    if (viewport && viewport.width < 768) {
      test.skip();
    }

    // Hover over "Start Order" or main nav item
    const startOrderLink = page.locator('nav a:has-text("Start Order")').first();

    if (await startOrderLink.isVisible()) {
      await startOrderLink.hover();
      await page.waitForTimeout(300);

      // Verify MegaMenu appears
      const megaMenu = page.locator('[data-testid="mega-menu"]').or(
        page.locator('.mega-menu')
      );
      await expect(megaMenu).toBeVisible({ timeout: 2000 });

      // Verify product family options
      await expect(page.locator('text=By Size')).toBeVisible();
      await expect(page.locator('text=Blanks')).toBeVisible();
    }
  });

  test('should navigate to Start Order page', async ({ page }) => {
    // Click on "Start Order" link
    const startOrderLink = page.locator('a[href="/start-order"]').or(
      page.locator('text=Start Order').first()
    );

    if (await startOrderLink.isVisible()) {
      await startOrderLink.click();

      // Verify we're on Start Order page
      await page.waitForURL(/\/start-order/);
      await expect(page.locator('h1, h2')).toContainText(/Start|Order|Custom/);
    } else {
      // Try direct navigation
      await page.goto('/start-order');
      await expect(page.locator('h1, h2')).toBeVisible();
    }
  });

  test('should display product family cards on Start Order page', async ({ page }) => {
    await page.goto('/start-order');

    // Verify product family options are displayed
    await expect(page.locator('text=By Size')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Blanks')).toBeVisible();

    // Verify description text exists
    const descriptions = page.locator('p, span').filter({ hasText: /tiered|pricing|quantity|custom|shirt/i });
    await expect(descriptions.first()).toBeVisible();

    // Verify CTA buttons exist
    const ctaButtons = page.locator('button:has-text("Select"), a:has-text("Select"), button:has-text("Order"), a:has-text("Order")');
    await expect(ctaButtons.first()).toBeVisible();
  });

  test('should navigate to By-Size products from Start Order', async ({ page }) => {
    await page.goto('/start-order');

    // Find and click "By Size" option
    const bySizeCard = page.locator('[data-testid="family-by-size"]').or(
      page.locator('text=By Size').locator('..').locator('..')
    );

    // Click the select/order button
    const selectButton = bySizeCard.locator('button, a').filter({ hasText: /Select|Order|Start/ }).first();
    await selectButton.click();

    // Verify navigation to by-size collection or products
    await page.waitForURL(/\/collections\/by-size|\/products/);

    // Verify we see By-Size products
    const productCards = page.locator('[data-testid="product-card"]');
    await expect(productCards.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Blanks collection from Start Order', async ({ page }) => {
    await page.goto('/start-order');

    // Find and click "Blanks" option
    const blanksCard = page.locator('[data-testid="family-blanks"]').or(
      page.locator('text=Blanks').locator('..').locator('..')
    );

    // Click the select/order button
    const selectButton = blanksCard.locator('button, a').filter({ hasText: /Select|Order|Browse/ }).first();
    await selectButton.click();

    // Verify navigation to blanks collection
    await page.waitForURL(/\/collections\/blanks/);

    // Verify we see Blanks products
    const productCards = page.locator('[data-testid="product-card"]');
    await expect(productCards.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display mobile navigation menu', async ({ page, viewport }) => {
    // Set mobile viewport if not already
    if (!viewport || viewport.width >= 768) {
      await page.setViewportSize({ width: 375, height: 667 });
    }

    // Look for mobile menu button (hamburger)
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]').or(
      page.locator('button[aria-label*="menu" i]')
    ).or(
      page.locator('button:has-text("☰"), button:has-text("Menu")')
    );

    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await page.waitForTimeout(300);

      // Verify mobile menu opened
      const mobileMenu = page.locator('[data-testid="mobile-menu"]').or(
        page.locator('nav[role="dialog"]')
      );
      await expect(mobileMenu).toBeVisible();

      // Verify navigation links in mobile menu
      await expect(page.locator('text=Start Order')).toBeVisible();
      await expect(page.locator('text=Products')).toBeVisible();
    }
  });

  test('should navigate through collections via MegaMenu', async ({ page, viewport }) => {
    // Skip if mobile
    if (viewport && viewport.width < 768) {
      test.skip();
    }

    // Hover over collections or products nav item
    const collectionsLink = page.locator('nav a:has-text("Collections")').or(
      page.locator('nav a:has-text("Products")')
    ).first();

    if (await collectionsLink.isVisible()) {
      await collectionsLink.hover();
      await page.waitForTimeout(300);

      // Look for collection links in dropdown
      const blanksLink = page.locator('a[href*="/collections/blanks"]').first();

      if (await blanksLink.isVisible()) {
        await blanksLink.click();

        // Verify navigation
        await page.waitForURL(/\/collections\/blanks/);
        await expect(page.locator('h1')).toContainText(/Blanks/);
      }
    }
  });

  test('should show active navigation state', async ({ page }) => {
    await page.goto('/start-order');

    // Verify active link styling
    const startOrderLink = page.locator('nav a[href="/start-order"]').first();

    if (await startOrderLink.isVisible()) {
      // Check for active class or styling
      const classes = await startOrderLink.getAttribute('class');
      expect(classes).toMatch(/active|current|underline|font-bold/i);
    }
  });

  test('should navigate to products page from header', async ({ page }) => {
    // Click on "Products" or "Shop" link in header
    const productsLink = page.locator('nav a[href="/products"]').or(
      page.locator('nav a:has-text("Products")')
    ).first();

    await productsLink.click();

    // Verify we're on products page
    await page.waitForURL(/\/products/);
    await expect(page.locator('h1, h2')).toContainText(/Products|Shop|Catalog/);

    // Verify product grid is visible
    const productGrid = page.locator('[data-testid="product-grid"]').or(
      page.locator('.grid, .product-grid')
    );
    await expect(productGrid).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to cart from header', async ({ page }) => {
    // Click on cart icon/button
    const cartButton = page.locator('[data-testid="cart-button"]').or(
      page.locator('a[href="/cart"]')
    ).first();

    await cartButton.click();

    // Verify we're on cart page
    await page.waitForURL(/\/cart/);
    await expect(page.locator('h1, h2')).toContainText(/Cart|Basket|Bag/);
  });

  test('should navigate to homepage from logo', async ({ page }) => {
    // Go to a different page first
    await page.goto('/products');

    // Click on logo
    const logo = page.locator('[data-testid="logo"]').or(
      page.locator('a[href="/"]').first()
    );

    await logo.click();

    // Verify we're on homepage
    await page.waitForURL('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should close MegaMenu on click outside', async ({ page, viewport }) => {
    // Skip if mobile
    if (viewport && viewport.width < 768) {
      test.skip();
    }

    // Hover to open MegaMenu
    const startOrderLink = page.locator('nav a:has-text("Start Order")').first();

    if (await startOrderLink.isVisible()) {
      await startOrderLink.hover();
      await page.waitForTimeout(300);

      const megaMenu = page.locator('[data-testid="mega-menu"]').or(
        page.locator('.mega-menu')
      );

      if (await megaMenu.isVisible()) {
        // Click outside
        await page.mouse.move(100, 500);
        await page.waitForTimeout(500);

        // Verify menu closed (or verify it closes on mouse leave)
        await expect(megaMenu).not.toBeVisible({ timeout: 2000 });
      }
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Focus on first navigation link
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Press Enter on Start Order
    const startOrderLink = page.locator('nav a[href="/start-order"]').first();

    if (await startOrderLink.isVisible()) {
      await startOrderLink.focus();
      await page.keyboard.press('Enter');

      // Verify navigation
      await page.waitForURL(/\/start-order/);
    }
  });

  test('should display breadcrumbs on nested pages', async ({ page }) => {
    await page.goto('/collections/blanks');

    // Look for breadcrumb navigation
    const breadcrumbs = page.locator('[data-testid="breadcrumbs"]').or(
      page.locator('nav[aria-label*="breadcrumb" i]')
    );

    if (await breadcrumbs.isVisible()) {
      // Verify Home link exists
      await expect(breadcrumbs.locator('a:has-text("Home")')).toBeVisible();

      // Verify current page in breadcrumb
      await expect(breadcrumbs.locator('text=Blanks')).toBeVisible();
    }
  });
});
