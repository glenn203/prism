import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';

interface Win {
  picked?: string;
  hit?: string;
  hits?: Record<string, boolean>;
}

const MENU = `
  <button id="before">before</button>
  <prism-menu id="m" label="More options for Onboarding guide">
    <prism-menu-item id="top">Move to top</prism-menu-item>
    <prism-menu-item id="up" disabled>Move up</prism-menu-item>
    <prism-menu-item id="down">Move down</prism-menu-item>
    <prism-menu-item id="bottom">Move to bottom</prism-menu-item>
  </prism-menu>
  <button id="after">after</button>`;

const setup = async (page: Page) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await mount(page, MENU);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.evaluate(() => {
    document.getElementById('m')!.addEventListener('prism-menu-select', (e) => {
      (window as unknown as Win).picked = (
        e as CustomEvent<{ value: string }>
      ).detail.value;
    });
  });
  return errors;
};
const trigger = (page: Page) =>
  page.getByRole('button', { name: 'More options for Onboarding guide' });
const activeId = (page: Page) =>
  page.evaluate(() => document.activeElement?.id ?? '');
const isOpen = (page: Page) =>
  page
    .locator('#m')
    .evaluate((el) => (el as unknown as { open: boolean }).open);

test('menu button semantics: haspopup, expanded, named menu, items', async ({
  page,
}) => {
  await setup(page);
  const t = trigger(page);
  await expect(t).toHaveAttribute('aria-haspopup', 'menu');
  await expect(t).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('menu')).toHaveCount(0); // closed: not in the tree
  await t.click();
  await expect(t).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('menu', { name: 'More options for Onboarding guide' }),
  ).toBeVisible();
  await expect(page.getByRole('menuitem')).toHaveCount(4);
  await expect(page.getByRole('menuitem', { name: 'Move up' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

test('click opens on the first enabled item', async ({ page }) => {
  await setup(page);
  await trigger(page).click();
  expect(await activeId(page)).toBe('top');
});

test('ArrowDown opens on first, ArrowUp opens on last', async ({ page }) => {
  await setup(page);
  await trigger(page).focus();
  await page.keyboard.press('ArrowDown');
  expect(await activeId(page)).toBe('top');
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowUp');
  expect(await activeId(page)).toBe('bottom');
});

test('arrows wrap and skip disabled items; Home and End jump', async ({
  page,
}) => {
  await setup(page);
  await trigger(page).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect(await activeId(page)).toBe('down'); // skipped disabled "up"
  await page.keyboard.press('ArrowDown');
  expect(await activeId(page)).toBe('bottom');
  await page.keyboard.press('ArrowDown');
  expect(await activeId(page)).toBe('top'); // wraps
  await page.keyboard.press('ArrowUp');
  expect(await activeId(page)).toBe('bottom'); // wraps back
  await page.keyboard.press('Home');
  expect(await activeId(page)).toBe('top');
  await page.keyboard.press('End');
  expect(await activeId(page)).toBe('bottom');
});

test('type-ahead moves to the matching item', async ({ page }) => {
  await setup(page);
  await trigger(page).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.type('move d');
  expect(await activeId(page)).toBe('down');
});

test('Escape closes and returns focus to the button', async ({ page }) => {
  await setup(page);
  await trigger(page).click();
  await page.keyboard.press('Escape');
  expect(await isOpen(page)).toBe(false);
  await expect(trigger(page)).toBeFocused();
});

test('Enter and Space activate, emit prism-menu-select, close and return focus', async ({
  page,
}) => {
  await setup(page);
  await trigger(page).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as unknown as Win).picked)).toBe(
    'Move down',
  );
  expect(await isOpen(page)).toBe(false);
  await expect(trigger(page)).toBeFocused();
  await trigger(page).click();
  await page.keyboard.press('End');
  await page.keyboard.press(' ');
  expect(await page.evaluate(() => (window as unknown as Win).picked)).toBe(
    'Move to bottom',
  );
});

test('a disabled item cannot be activated by pointer or key', async ({
  page,
}) => {
  await setup(page);
  await trigger(page).click();
  await page.getByRole('menuitem', { name: 'Move up' }).click({ force: true });
  expect(
    await page.evaluate(() => (window as unknown as Win).picked),
  ).toBeUndefined();
});

test('pointer click on an item activates it', async ({ page }) => {
  await setup(page);
  await trigger(page).click();
  await page.getByRole('menuitem', { name: 'Move to top' }).click();
  expect(await page.evaluate(() => (window as unknown as Win).picked)).toBe(
    'Move to top',
  );
  expect(await isOpen(page)).toBe(false);
});

test('Tab closes the menu and moves on; no focus trap', async ({ page }) => {
  await setup(page);
  await trigger(page).click();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
  expect(await isOpen(page)).toBe(false);
  expect(await activeId(page)).not.toBe('top');
});

test('outside click closes without stealing focus', async ({ page }) => {
  await setup(page);
  await trigger(page).click();
  await page.locator('#after').click();
  expect(await isOpen(page)).toBe(false);
  await expect(page.locator('#after')).toBeFocused();
});

test('the popup is in the top layer, aligned to the button end, inside the viewport', async ({
  page,
}) => {
  await setup(page);
  await page.locator('#m').evaluate((el) => {
    (el as HTMLElement).style.marginInlineStart = '12rem';
  });
  await trigger(page).click();
  const r = await page.locator('#m').evaluate((el) => {
    const pop = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
    const t = el.shadowRoot!.querySelector('[part="trigger"]')!;
    const p = pop.getBoundingClientRect();
    const b = t.getBoundingClientRect();
    return {
      open: pop.matches(':popover-open'),
      top: p.top - b.bottom,
      right: Math.round(p.right - b.right),
      inView: p.left >= 0 && p.right <= innerWidth && p.bottom <= innerHeight,
    };
  });
  expect(r.open).toBe(true);
  expect(r.top).toBeGreaterThanOrEqual(3);
  expect(r.top).toBeLessThanOrEqual(5);
  expect(Math.abs(r.right)).toBeLessThanOrEqual(1);
  expect(r.inView).toBe(true);
});

test('a missing label is a dev error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await mount(
    page,
    `<prism-menu><prism-menu-item>A</prism-menu-item></prism-menu>`,
  );
  await page.waitForTimeout(50);
  expect(errors.some((e) => e.includes('`label` is required'))).toBe(true);
});
