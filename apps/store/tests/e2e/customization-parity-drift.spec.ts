import { test, expect } from '@playwright/test';

type Metrics = {
  view: string;
  placementKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
};

function toleranceForDpr(dpr: number): number {
  return dpr === 1 || dpr === 2 ? 1 : 2;
}

async function readMetrics(page: Parameters<typeof test>[0]['page']): Promise<Metrics> {
  const locator = page.getByTestId('ghost-rect-metrics');
  await expect(locator).toHaveCount(1);
  return locator.evaluate((el) => {
    const node = el as HTMLElement;
    const read = (name: string) => Number(node.dataset[name] || '0');
    return {
      view: node.dataset.view || '',
      placementKey: node.dataset.placementKey || '',
      x: read('x'),
      y: read('y'),
      width: read('width'),
      height: read('height'),
      canvasWidth: read('canvasWidth'),
      canvasHeight: read('canvasHeight'),
    };
  });
}

function assertNear(a: number, b: number, tolerance: number, label: string) {
  const diff = Math.abs(a - b);
  expect(diff, `${label} drift ${diff}px exceeds tolerance ${tolerance}px`).toBeLessThanOrEqual(tolerance);
}

async function switchToView(page: Parameters<typeof test>[0]['page'], view: Metrics['view']) {
  const tab = page.getByTestId(`view-tab-${view}`);
  if ((await tab.count()) === 0) return false;
  await tab.first().click();
  await page.waitForTimeout(150);
  return true;
}

test.describe('Customization parity/drift', () => {
  test('ghost rect has no drift on reload and resize bounce', async ({ page }) => {
    const slug = process.env.PARITY_PRODUCT_SLUG || 'blank-sweatshirt';
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/customize/${slug}`);

    const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
    const tolerance = toleranceForDpr(dpr);

    const baseline = await readMetrics(page);
    expect(baseline.view.length).toBeGreaterThan(0);
    expect(baseline.placementKey.length).toBeGreaterThan(0);

    await page.reload();
    const afterReload = await readMetrics(page);
    assertNear(afterReload.x, baseline.x, tolerance, 'x after reload');
    assertNear(afterReload.y, baseline.y, tolerance, 'y after reload');
    assertNear(afterReload.width, baseline.width, tolerance, 'width after reload');
    assertNear(afterReload.height, baseline.height, tolerance, 'height after reload');

    await page.setViewportSize({ width: 1100, height: 780 });
    await page.waitForTimeout(250);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(250);

    const afterResizeBounce = await readMetrics(page);
    assertNear(afterResizeBounce.x, baseline.x, tolerance, 'x after resize');
    assertNear(afterResizeBounce.y, baseline.y, tolerance, 'y after resize');
    assertNear(afterResizeBounce.width, baseline.width, tolerance, 'width after resize');
    assertNear(afterResizeBounce.height, baseline.height, tolerance, 'height after resize');

    const trackedByView = new Map<Metrics['view'], Metrics>();
    for (const view of ['front', 'back', 'left', 'right'] as const) {
      const switched = await switchToView(page, view);
      if (!switched) continue;
      const metrics = await readMetrics(page);
      if (!metrics.placementKey) continue;
      trackedByView.set(view, metrics);
    }

    await page.setViewportSize({ width: 1200, height: 820 });
    await page.waitForTimeout(250);

    for (const [view, prior] of trackedByView) {
      const switched = await switchToView(page, view);
      if (!switched) continue;
      const current = await readMetrics(page);
      if (current.placementKey !== prior.placementKey) continue;
      assertNear(current.x, prior.x, tolerance, `x after view-switch resize (${view})`);
      assertNear(current.y, prior.y, tolerance, `y after view-switch resize (${view})`);
      assertNear(current.width, prior.width, tolerance, `width after view-switch resize (${view})`);
      assertNear(current.height, prior.height, tolerance, `height after view-switch resize (${view})`);
    }
  });
});
