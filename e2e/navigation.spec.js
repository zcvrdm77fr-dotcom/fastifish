import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  const phone = testInfo.project.name.includes('mobile');
  await page.addInitScript(mode => {
    localStorage.setItem('device_view', mode);
    localStorage.setItem('cookie_consent', 'necessary');
  }, phone ? 'phone' : 'desktop');
});

test('primary navigation and fishing score copy stay consistent', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'FastFishing', exact: true })).toBeVisible();
  await expect(page.getByText('7 vuorokauden kalakeliennuste', { exact: true })).toBeVisible();
  await expect(page.getByText('7 vuorokauden syöntiennuste', { exact: true })).toHaveCount(0);

  const mobile = testInfo.project.name.includes('mobile');
  const navSelector = mobile ? '.mobile-nav-item' : '#navTabs .tab-btn';
  const catches = page.locator(`${navSelector}[data-page="feedi"]`);
  await expect(catches).toBeVisible();
  await catches.click();
  await expect(page.locator('#feedi')).toHaveClass(/active/);

  const guides = page.locator(`${navSelector}[data-page="oppaat"]`);
  await expect(guides).toBeVisible();
  await guides.click();
  await expect(page.locator('#oppaat')).toHaveClass(/active/);
});

test('first-party assets and interactions have no console-level runtime failures', async ({ page }, testInfo) => {
  const failures = [];
  const baseOrigin = 'http://127.0.0.1:4173';
  page.on('pageerror', error => failures.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => {
    if (request.url().startsWith(baseOrigin)) failures.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`);
  });

  await page.goto('/');
  const mobile = testInfo.project.name.includes('mobile');
  const navSelector = mobile ? '.mobile-nav-item' : '#navTabs .tab-btn';
  await page.locator(`${navSelector}[data-page="merikartta"]`).click();
  await expect.poll(() => failures).toEqual([]);
});

test('unknown routes render the custom 404 with a real 404 status', async ({ page }) => {
  const response = await page.goto('/sivua-ei-ole');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Sivua ei löytynyt' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Avaa kalakelimittari' })).toHaveAttribute('href', '/');
});
