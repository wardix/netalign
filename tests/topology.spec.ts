import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveURL('http://localhost:3000/');
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
});