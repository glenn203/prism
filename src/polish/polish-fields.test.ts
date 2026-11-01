import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';

async function setup(page: Page, markup: string) {
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.addStyleTag({ path: 'src/theme/polish.css' });
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __enablePolish?: unknown })
        .__enablePolish === 'function',
  );
  await page.evaluate(() =>
    (
      window as unknown as { __enablePolish: () => () => void }
    ).__enablePolish(),
  );
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60))),
  );
}

const FIELDS = `<div data-prism-polish style="padding:40px;display:grid;gap:24px;max-inline-size:320px">
  <prism-text-input id="t" label="Name" floating></prism-text-input>
  <prism-select id="s" label="Fruit"><prism-option value="a">Apricot</prism-option></prism-select>
</div>`;

/** Opacity of the light ring, after its fade has finished. */
const ring = async (page: Page, id: string, part: string) => {
  await page.evaluate(() => new Promise((r) => setTimeout(r, 240)));
  return page
    .locator(id)
    .evaluate(
      (el, part) =>
        Number(
          getComputedStyle(
            el.shadowRoot!.querySelector(`[part="${part}"]`)!,
            '::after',
          ).opacity,
        ),
      part,
    );
};

test('polish on: a text input shows the light ring on hover and while focused, not otherwise', async ({
  page,
}) => {
  await setup(page, FIELDS);
  expect(await ring(page, '#t', 'control')).toBe(0);
  await page.locator('#t').hover();
  expect(await ring(page, '#t', 'control')).toBe(1);
  await page.mouse.move(0, 0);
  expect(await ring(page, '#t', 'control')).toBe(0);
  await page.getByRole('textbox', { name: 'Name' }).focus();
  expect(await ring(page, '#t', 'control')).toBe(1);
});

test('polish on: the select trigger shows it on hover, focus and while open', async ({
  page,
}) => {
  await setup(page, FIELDS);
  expect(await ring(page, '#s', 'trigger')).toBe(0);
  await page.locator('#s').hover();
  expect(await ring(page, '#s', 'trigger')).toBe(1);
  await page.mouse.move(0, 0);
  await page.getByRole('combobox', { name: 'Fruit' }).focus();
  expect(await ring(page, '#s', 'trigger')).toBe(1);
});

test('the light follows the pointer: it is measured on the control, not on the label above', async ({
  page,
}) => {
  await setup(page, FIELDS.replace(' floating', ''));
  const box = await page.locator('#t').evaluate((el) => {
    const r = el
      .shadowRoot!.querySelector('[part="control"]')!
      .getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
  await page.mouse.move(box.x + 30, box.y + 12);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const pos = await page.locator('#t').evaluate((el) => {
    const s = (el as HTMLElement).style;
    return [
      parseFloat(s.getPropertyValue('--x')),
      parseFloat(s.getPropertyValue('--y')),
    ];
  });
  expect(pos[0]).toBeCloseTo(30, 0);
  expect(pos[1]).toBeCloseTo(12, 0);
});

test('off without the attribute, and not drawn on disabled or invalid fields', async ({
  page,
}) => {
  await setup(
    page,
    `<div style="padding:40px;display:grid;gap:24px;max-inline-size:320px">
      <prism-text-input id="t" label="Name"></prism-text-input>
    </div>`,
  );
  await page.locator('#t').hover();
  expect(await ring(page, '#t', 'control')).toBe(0);
  await setup(
    page,
    `<div data-prism-polish style="padding:40px;display:grid;gap:24px;max-inline-size:320px">
      <prism-text-input id="d" label="Off" disabled></prism-text-input>
      <prism-text-input id="r" label="Req" required><span slot="error">Needed.</span></prism-text-input>
    </div>`,
  );
  const shown = (id: string) =>
    page
      .locator(id)
      .evaluate(
        (el) =>
          getComputedStyle(
            el.shadowRoot!.querySelector('[part="control"]')!,
            '::after',
          ).display,
      );
  await page.locator('#d').hover({ force: true });
  expect(await shown('#d')).toBe('none');
  await page
    .locator('#r')
    .evaluate((e) =>
      (e as HTMLElement & { reportValidity(): boolean }).reportValidity(),
    );
  await page.locator('#r').hover();
  expect(await shown('#r')).toBe('none');
});

test('forced colors: no light-following ring', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await setup(page, FIELDS);
  await page.locator('#t').hover();
  const d = await page.locator('#t').evaluate((el) => {
    const c = el.shadowRoot!.querySelector('[part="control"]')!;
    return getComputedStyle(c, '::after').display;
  });
  expect(d).toBe('none');
});
