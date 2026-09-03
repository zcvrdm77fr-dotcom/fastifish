import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  const phone = testInfo.project.name.includes('mobile');
  await page.addInitScript(mode => {
    localStorage.setItem('device_view', mode);
    localStorage.setItem('cookie_consent', 'necessary');
  }, phone ? 'phone' : 'desktop');
});

test('fishing map is usable inline before fullscreen', async ({ page }, testInfo) => {
  await page.goto('/');
  const mobile = testInfo.project.name.includes('mobile');
  const navSelector = mobile ? '.mobile-nav-item' : '#navTabs .tab-btn';
  await page.locator(`${navSelector}[data-page="merikartta"]`).click();

  const wrap = page.locator('#seaChartWrap');
  await expect(wrap).toBeVisible();
  await expect(page.locator('#seaChartMap')).toBeVisible();

  await expect.poll(async () => page.locator('#seaChartMap').getAttribute('data-ff-polished')).toBe('1');
  await expect(page.locator('#seaChartMap')).toHaveAttribute('role', 'application');
  await expect(page.locator('#seaChartMap')).toHaveAttribute('tabindex', '0');

  const mapBox = await wrap.boundingBox();
  const overlayBox = await page.locator('#seaChartActivateOverlay').boundingBox();
  expect(mapBox).not.toBeNull();
  expect(overlayBox).not.toBeNull();
  expect(mapBox.height).toBeGreaterThan(mobile ? 450 : 540);
  expect(overlayBox.width).toBeLessThan(mapBox.width * 0.65);
  expect(overlayBox.height).toBeLessThan(mapBox.height * 0.25);

  const draggingEnabled = await page.evaluate(() =>
    typeof seaChartMap !== 'undefined' && Boolean(seaChartMap?.dragging?.enabled?.())
  );
  const touchEnabled = await page.evaluate(() =>
    typeof seaChartMap !== 'undefined' && Boolean(seaChartMap?.touchZoom?.enabled?.())
  );
  expect(draggingEnabled).toBe(true);
  expect(touchEnabled).toBe(true);
});

test('map toolbar stays inside the viewport on mobile', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Mobile layout assertion');
  await page.goto('/');
  await page.locator('.mobile-nav-item[data-page="merikartta"]').click();
  const toolbar = page.locator('#seaChartToolbar');
  await expect(toolbar).toBeVisible();
  const box = await toolbar.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.height).toBeLessThan(viewport.height * 0.4);
});
