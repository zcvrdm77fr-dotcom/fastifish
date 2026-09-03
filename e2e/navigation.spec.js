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
