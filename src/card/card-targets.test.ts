import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => setTimeout(() => r(), 60)),
      ),
  );

async function setup(page: Page, markup: string) {
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settle(page);
}

const sizeOf = (page: Page, selector: string, part?: string) =>
  page.locator(selector).evaluate((el, part) => {
    const target = part
      ? el.shadowRoot!.querySelector<HTMLElement>(`[part="${part}"]`)
      : el;
    const r = target!.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }, part);

test('collapsible title toggle is at least 24 by 24px', async ({ page }) => {
  await setup(
    page,
    `<prism-card type="collapsible" style="width:360px">
      <prism-card-title slot="header" level="3">Lens schedule</prism-card-title>
      <p>Closed content.</p>
    </prism-card>`,
  );
  const box = await sizeOf(page, 'prism-card-title', 'toggle');
  expect(box.w).toBeGreaterThanOrEqual(24);
  expect(box.h).toBeGreaterThanOrEqual(24);
});

test('unstretched collection title link is at least 24 by 24px', async ({
  page,
}) => {
  await setup(
    page,
    `<prism-card type="selectable" kind="collection" style="width:360px">
      <prism-card-title slot="header" level="3" href="#prism">Prism filter</prism-card-title>
    </prism-card>`,
  );
  const title = page.locator('prism-card-title');
  expect(await title.getAttribute('stretch')).toBeNull();
  const box = await sizeOf(page, 'prism-card-title', 'link');
  expect(box.w).toBeGreaterThanOrEqual(24);
  expect(box.h).toBeGreaterThanOrEqual(24);
});

test('stretched clickable title uses the card as the target', async ({
  page,
}) => {
  await setup(
    page,
    `<prism-card id="c" type="clickable" style="width:360px">
      <prism-card-title slot="header" level="3" href="#prism">Onboarding guide</prism-card-title>
    </prism-card>`,
  );
  const title = page.locator('prism-card-title');
  await expect(title).toHaveAttribute('stretch', '');
  const sizes = await page.evaluate(() => {
    const card = document.querySelector('#c')!;
    const link = card
      .querySelector('prism-card-title')!
      .shadowRoot!.querySelector('[part="link"]')!;
    const cr = card.getBoundingClientRect();
    const after = getComputedStyle(link, '::after');
    return {
      cardW: cr.width,
      cardH: cr.height,
      pos: after.position,
      top: after.top,
      right: after.right,
      bottom: after.bottom,
      left: after.left,
    };
  });
  expect(sizes.cardW).toBeGreaterThanOrEqual(24);
  expect(sizes.cardH).toBeGreaterThanOrEqual(24);
  expect(sizes.pos).toBe('absolute');
  expect(sizes.top).toBe('0px');
  expect(sizes.right).toBe('0px');
  expect(sizes.bottom).toBe('0px');
  expect(sizes.left).toBe('0px');
});

test('page-size select is at least 24 by 24px at default density', async ({
  page,
}) => {
  await setup(
    page,
    `<prism-card-list id="l" label="Resources" total="48" page-size="24" style="width:640px">
      <prism-card type="selectable" kind="collection" value="a">
        <prism-card-title slot="header" level="3">Resource a</prism-card-title>
      </prism-card>
    </prism-card-list>`,
  );
  const box = await page
    .locator('[data-prism-page-size] select')
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
  expect(box.w).toBeGreaterThanOrEqual(24);
  expect(box.h).toBeGreaterThanOrEqual(24);
});

test('story time-range selects are at least 24 by 24px', async ({ page }) => {
  await setup(
    page,
    `<label>Time range
      <select data-prism-select>
        <option>Last 24 hours</option>
        <option>Last 7 days</option>
      </select>
    </label>`,
  );
  const box = await page.locator('[data-prism-select]').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  expect(box.w).toBeGreaterThanOrEqual(24);
  expect(box.h).toBeGreaterThanOrEqual(24);
});
