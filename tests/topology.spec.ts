import { test, expect, type Page, type Response } from '@playwright/test';

const topologySelect = (page: Page) => page.locator('.ant-layout-sider .ant-select').first();

function formItem(page: Page, label: string) {
  return page.locator('.ant-layout-sider .ant-form-item').filter({
    has: page.locator('.ant-form-item-label label', { hasText: label }),
  });
}

async function waitForTopologyReady(page: Page) {
  // Default UI locale is Indonesian; reset any EN leftover from prior tests (localStorage).
  await page.addInitScript(() => {
    localStorage.setItem('netalign-locale', 'id');
  });

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

function optionSearchText(optionText: string | RegExp): string {
  if (typeof optionText === 'string') {
    return optionText.replace(/\s*\(.*\)$/, '');
  }
  return optionText.source
    .replace(/^\^|\$$/g, '')
    .replace(/\\ /g, ' ')
    .replace(/\\([()])/g, '$1')
    .replace(/\\/g, '')
    .replace(/\s*\(.*\)$/, '');
}

async function selectFormDropdown(page: Page, fieldLabel: string, optionText: string | RegExp) {
  const combobox = formItem(page, fieldLabel).getByRole('combobox');
  await combobox.click();

  // Searchable selects (edge source/target) support typing to filter virtualized options.
  const isSearchable = await combobox.evaluate(el => {
    const input = el as HTMLInputElement;
    return !input.readOnly && !input.disabled;
  });
  if (isSearchable) {
    const search = optionSearchText(optionText);
    if (search) {
      await combobox.pressSequentially(search, { delay: 20 });
    }
  }

  const option = openDropdownOption(page, optionText).first();
  await expect(option).toBeVisible({ timeout: 10_000 });
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

async function addNode(
  page: Page,
  opts: { id: string; label: string; type?: 'Subnet' | 'Router' | 'Instans' | 'Instance' },
) {
  await formItem(page, /ID Node|Node ID/).getByRole('textbox').fill(opts.id);
  await formItem(page, /^Label$/).getByRole('textbox').fill(opts.label);
  if (opts.type) {
    await selectFormDropdown(page, /^Tipe$|^Type$/, new RegExp(`^${opts.type}$`));
  }
  await clickAndAwaitPost(page, /Tambah Node|Add Node/, /\/api\/topologies\/[^/]+\/nodes$/);
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

    await formItem(page, 'ID Node').getByRole('textbox').fill(nodeId);
    await formItem(page, 'Label').getByRole('textbox').fill('E2E Subnet');

    await clickAndAwaitPost(page, 'Tambah Node', /\/api\/topologies\/[^/]+\/nodes$/);
  });

  test('adds a valid edge using node dropdowns', async ({ page }) => {
    const ts = Date.now();
    const routerId = `router-e2e-${ts}`;
    const routerLabel = `E2E Router ${ts}`;

    await formItem(page, 'ID Node').getByRole('textbox').fill(routerId);
    await formItem(page, 'Label').getByRole('textbox').fill(routerLabel);
    await selectFormDropdown(page, 'Tipe', /^Router$/);

    await clickAndAwaitPost(page, 'Tambah Node', /\/api\/topologies\/[^/]+\/nodes$/);

    await selectFormDropdown(page, 'Sumber', `${routerLabel} (ROUTER)`);
    await expect(formItem(page, 'Target').getByRole('combobox')).toBeEnabled();
    await selectFormDropdown(page, 'Target', /Subnet-1/);

    await clickAndAwaitPost(page, 'Tambah Edge', /\/api\/topologies\/[^/]+\/edges$/);
  });

  test('toggles locale to English', async ({ page }) => {
    await page.locator('.ant-layout-header .ant-select').click();
    await page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content')
      .filter({ hasText: /^EN$/ })
      .click();

    await expect(page.getByText('Topologies', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Node' })).toBeVisible();
  });

  test('blocks deleting the protected default topology', async ({ page }) => {
    // Topology manager delete (first Hapus in the sider).
    await page.locator('.ant-layout-sider').getByRole('button', { name: 'Hapus', exact: true }).first().click();

    const modal = page.locator('.ant-modal-confirm').filter({ hasText: 'Dilindungi' });
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Topologi default tidak dapat dihapus.')).toBeVisible();
    await modal.getByRole('button', { name: 'OK' }).click();

    await expect(topologySelect(page)).toContainText('Default Topology');
  });

  test('router edge targets only allow subnets', async ({ page }) => {
    const ts = Date.now();
    const routerA = `router-a-${ts}`;
    const routerB = `router-b-${ts}`;
    const labelA = `RouterA${ts}`;
    const labelB = `RouterB${ts}`;

    await addNode(page, { id: routerA, label: labelA, type: 'Router' });
    await addNode(page, { id: routerB, label: labelB, type: 'Router' });

    await selectFormDropdown(page, 'Sumber', `${labelA} (ROUTER)`);
    const targetBox = formItem(page, 'Target').getByRole('combobox');
    await expect(targetBox).toBeEnabled();
    await targetBox.click();
    await targetBox.pressSequentially('Subnet-1', { delay: 20 });

    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    await expect(
      dropdown.locator('.ant-select-item-option-content').filter({ hasText: /Subnet-1/ }),
    ).toBeVisible();
    await expect(
      dropdown.locator('.ant-select-item-option-content').filter({ hasText: labelB }),
    ).toHaveCount(0);

    await page.keyboard.press('Escape');
  });

  test('auto-layout button issues batch position update', async ({ page }) => {
    const positionsPromise = page.waitForResponse(
      response =>
        response.request().method() === 'PUT' &&
        /\/api\/topologies\/[^/]+\/nodes\/positions$/.test(new URL(response.url()).pathname),
    );

    await page.getByRole('button', { name: 'Auto-layout' }).click();
    const response = await positionsPromise;
    expect(response.status()).toBe(200);
  });

  test('collapses sidebar panel while graph stays visible', async ({ page }) => {
    await expect(page.getByTestId('topology-sidebar-sider')).toBeVisible();
    await expect(page.locator('.ant-layout-content')).toBeVisible();

    await page.getByRole('button', { name: 'Sembunyikan' }).click();
    await expect(page.getByRole('button', { name: 'Panel' })).toBeVisible();
    // Zero-width collapsed sider: panels not interactable; canvas still present.
    await expect(page.locator('.ant-layout-content')).toBeVisible();

    await page.getByRole('button', { name: 'Panel' }).click();
    await expect(page.getByRole('button', { name: 'Sembunyikan' })).toBeVisible();
    await expect(page.locator('.ant-layout-sider .ant-select').first()).toBeVisible();
  });

  test('empty topology shows guided wizard and sample scaffold', async ({ page }) => {
    await page.getByRole('button', { name: 'Baru' }).click();
    const nameInput = page.locator('.ant-modal-confirm .ant-form-item').filter({
      has: page.locator('label', { hasText: 'Nama' }),
    }).getByRole('textbox');
    await nameInput.fill(`Empty E2E ${Date.now()}`);

    const createPromise = page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/topologies',
    );
    await page.locator('.ant-modal-confirm').getByRole('button', { name: 'Buat' }).click();
    expect((await createPromise).status()).toBe(201);

    await expect(page.getByTestId('empty-topology-guide')).toBeVisible();
    await expect(page.getByText('Mulai topologi baru')).toBeVisible();

    const nodePosts: Promise<Response>[] = [];
    for (let i = 0; i < 3; i++) {
      nodePosts.push(
        page.waitForResponse(
          response =>
            response.request().method() === 'POST' &&
            /\/api\/topologies\/[^/]+\/nodes$/.test(new URL(response.url()).pathname),
        ),
      );
    }
    await page.getByRole('button', { name: /Buat contoh/ }).click();
    for (const p of nodePosts) {
      expect((await p).status()).toBe(201);
    }

    await expect(page.getByTestId('empty-topology-guide')).toHaveCount(0);
  });
});
