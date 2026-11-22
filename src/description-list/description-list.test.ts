import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';

async function setup(page: Page, markup: string) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60))),
  );
  return errors;
}

const LIST = (
  attrs = '',
) => `<div style="width:360px"><prism-description-list id="d" label="Resource details" ${attrs}>
  <prism-description-list-item label="OS">Lumen Board 9</prism-description-list-item>
  <prism-description-list-item label="Version">7.14.2</prism-description-list-item>
  <prism-description-list-item label="IP address"><prism-tag>192.0.2.42</prism-tag></prism-description-list-item>
</prism-description-list></div>`;

test.describe('prism-description-list', () => {
  test('a named description list; each label is a term and each value a definition', async ({
    page,
  }) => {
    const errors = await setup(page, LIST());
    expect(errors).toEqual([]);
    const list = page.locator('prism-description-list#d');
    await expect(list.locator('dl')).toHaveAccessibleName('Resource details');
    await expect(page.getByRole('term')).toHaveCount(3);
    await expect(page.getByRole('definition')).toHaveCount(3);
    await expect(page.getByRole('term').first()).toHaveText('OS');
    await expect(page.getByRole('list')).toHaveCount(0);
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  test('horizontal: labels share one column so values line up', async ({
    page,
  }) => {
    await setup(page, LIST());
    const xs = await page.evaluate(() =>
      [...document.querySelectorAll('prism-description-list-item')].map(
        (i) =>
          i.shadowRoot!.querySelector('[part="value"]')!.getBoundingClientRect()
            .left,
      ),
    );
    expect(new Set(xs.map(Math.round)).size).toBe(1);
  });

  test('vertical: the label sits above its value', async ({ page }) => {
    await setup(page, LIST('orientation="vertical"'));
    const r = await page.evaluate(() => {
      const i = document.querySelector('prism-description-list-item')!;
      const l = i
        .shadowRoot!.querySelector('[part="label"]')!
        .getBoundingClientRect();
      const v = i
        .shadowRoot!.querySelector('[part="value"]')!
        .getBoundingClientRect();
      return {
        above: l.bottom <= v.top + 1,
        sameX: Math.round(l.left) === Math.round(v.left),
      };
    });
    expect(r).toEqual({ above: true, sameX: true });
  });

  test('a value can hold other components', async ({ page }) => {
    await setup(page, LIST());
    await expect(
      page.locator('prism-description-list-item prism-tag'),
    ).toBeVisible();
  });

  test('an item with no label is a dev error', async ({ page }) => {
    const errors = await setup(
      page,
      '<prism-description-list label="x"><prism-description-list-item>v</prism-description-list-item></prism-description-list>',
    );
    expect(errors.some((e) => e.includes('`label` is required'))).toBe(true);
  });
});
