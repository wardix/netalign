import { test, expect, type Page, type Response } from '@playwright/test';

const topologySelect = (page: Page) => page.locator('.ant-layout-sider .ant-select').first();

function formItem(page: Page, label: string) {
  return page.locator('.ant-layout-sider .ant-form-item').filter({
    has: page.locator('.ant-form-item-label label', { hasText: label }),
  });
}

async function waitForTopologyReady(page: Page) {
  const listResponse = page.waitForResponse(
    response =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/topologies',
  );
  const detailResponse = page.waitForResponse(
    response =>
      response.request().method() === 'GET' &&
      /\/api\/topologies\/[^/]+$/.test(new URL(response.url()).pathname),
  );

  await page.goto('/');
  await listResponse;
  await detailResponse;

  await expect(topologySelect(page)).toContainText('Default Topology', {
    timeout: 15_000,
  });
}

function openDropdownOption(page: Page, label: string | RegExp) {
  return page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .locator('.ant-select-item-option-content')
    .filter({ hasText: label });
}

async function selectFormDropdown(page: Page, fieldLabel: string, optionText: string | RegExp) {
  await formItem(page, fieldLabel).getByRole('combobox').click();
  const option = openDropdownOption(page, optionText).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')).toHaveCount(0);
}

async function clickAndAwaitPost(page: Page, buttonName: string, pathPattern: RegExp): Promise<Response> {
  const responsePromise = page.waitForResponse(
    response =>
      response.request().method() === 'POST' &&
      pathPattern.test(new URL(response.url()).pathname),
  );
  await page.getByRole('button', { name: buttonName }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  return response;
}

test.describe('NetAlign dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await waitForTopologyReady(page);
  });

  test('loads with default topology', async ({ page }) => {
    await expect(page).toHaveTitle(/NetAlign/);
    await expect(page.getByText('NetAlign', { exact: true })).toBeVisible();
  });

  test('adds a subnet node', async ({ page }) => {
    const nodeId = `subnet-e2e-${Date.now()}`;

    await formItem(page, 'Node ID').getByRole('textbox').fill(nodeId);
    await formItem(page, 'Label').getByRole('textbox').fill('E2E Subnet');

    await clickAndAwaitPost(page, 'Add Node', /\/api\/topologies\/[^/]+\/nodes$/);
  });

  test('adds a valid edge using node dropdowns', async ({ page }) => {
    const ts = Date.now();
    const routerId = `router-e2e-${ts}`;
    const routerLabel = `E2E Router ${ts}`;

    await formItem(page, 'Node ID').getByRole('textbox').fill(routerId);
    await formItem(page, 'Label').getByRole('textbox').fill(routerLabel);
    await selectFormDropdown(page, 'Type', /^Router$/);

    await clickAndAwaitPost(page, 'Add Node', /\/api\/topologies\/[^/]+\/nodes$/);

    await selectFormDropdown(page, 'Source', `${routerLabel} (ROUTER)`);
    await expect(formItem(page, 'Target').getByRole('combobox')).toBeEnabled();
    await selectFormDropdown(page, 'Target', 'Subnet-1');

    await clickAndAwaitPost(page, 'Add Edge', /\/api\/topologies\/[^/]+\/edges$/);
  });
});