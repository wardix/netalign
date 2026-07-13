import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  // Navigate to the dev server
  await page.goto('http://localhost:5173');
  // Basic sanity checks
  await expect(page).toHaveURL('http://localhost:5173/');
  // Ensure the page has a non‑empty title
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
});
