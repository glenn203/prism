import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';

const heights = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-prism-probe]')].map(
      (el) => {
        const target = el.shadowRoot!.querySelector<HTMLElement>(
          el.localName === 'prism-button' ? '[part="base"]' : '[part="input"]',
        )!;
        return target.getBoundingClientRect().height;
      },
    ),
  );

const grid = (size: string) =>
  ['compact', 'default', 'comfortable']
    .map(
      (d) =>
        `<div data-prism-density="${d}"><prism-button data-prism-probe size="${size}">B</prism-button><prism-text-field data-prism-probe size="${size}" label="F"></prism-text-field></div>`,
    )
    .join('');

const withTokens = async (page: Page, markup: string) => {
  await mount(page, markup);
  await page.addStyleTag({ url: '/src/tokens/tokens.css' });
};

test('md height is 24/36/48 in compact/default/comfortable', async ({
  page,
}) => {
  await withTokens(page, grid('md'));
  expect(await heights(page)).toEqual([24, 24, 36, 36, 48, 48]);
});

test('sm height is 24/32/40 in compact/default/comfortable', async ({
  page,
}) => {
  await withTokens(page, grid('sm'));
  expect(await heights(page)).toEqual([24, 24, 32, 32, 40, 40]);
});

test('lg height is 32/44/56 in compact/default/comfortable', async ({
  page,
}) => {
  await withTokens(page, grid('lg'));
  expect(await heights(page)).toEqual([32, 32, 44, 44, 56, 56]);
});

test('nested density overrides the ancestor', async ({ page }) => {
  await withTokens(
    page,
    `<div data-prism-density="comfortable"><prism-button data-prism-probe>A</prism-button><section data-prism-density="compact"><prism-button data-prism-probe>B</prism-button></section></div>`,
  );
  expect(await heights(page)).toEqual([48, 24]);
});

test('works without tokens.css (default-density fallbacks)', async ({
  page,
}) => {
  await mount(
    page,
    `<prism-button data-prism-probe size="sm">A</prism-button><prism-button data-prism-probe>B</prism-button><prism-text-field data-prism-probe size="lg" label="F"></prism-text-field>`,
  );
  expect(await heights(page)).toEqual([32, 36, 44]);
});

test('size reflects and defaults to md', async ({ page }) => {
  await mount(page, `<prism-button>A</prism-button>`);
  expect(await page.locator('prism-button').getAttribute('size')).toBe('md');
});

test('theme: label and description sit outside the focus ring', async ({
  page,
}) => {
  await mount(
    page,
    `<prism-text-field label="Email"><span slot="description">Help</span></prism-text-field>`,
  );
  await page.addStyleTag({ url: '/src/tokens/tokens.css' });
  await page.addStyleTag({ url: '/src/theme/theme.css' });
  const gaps = await page.evaluate(() => {
    const root = document.querySelector('prism-text-field')!.shadowRoot!;
    const box = (p: string) =>
      root.querySelector(`[part="${p}"]`)!.getBoundingClientRect();
    return [
      box('input').top - box('label').bottom,
      box('description').top - box('input').bottom,
    ];
  });
  // Mock spec: 2px label gap, 4px description gap.
  expect(gaps).toEqual([2, 4]);
  for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(2);
});
