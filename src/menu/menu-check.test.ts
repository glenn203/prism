import { expect, test, type Page } from '@playwright/test';
import { axe } from '../../test/axe.js';
import { mount } from '../../test/fixture.js';
import { maxStep, recordFrames, wait } from '../../test/field.js';
import { polishMotion } from '../../test/polish-motion.js';

const MENU = `
  <prism-menu id="m" label="View options">
    <prism-menu-item id="grid" checkable checked>Show grid</prism-menu-item>
    <prism-menu-item id="rulers" checkable>Show rulers</prism-menu-item>
    <prism-menu-item id="off" checkable disabled>Show guides</prism-menu-item>
    <prism-menu-item id="reset">Reset view</prism-menu-item>
  </prism-menu>`;

async function setup(page: Page, theme = 'light') {
  await mount(page, MENU);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-prism-theme', t);
    (window as unknown as { events: unknown[] }).events = [];
    document.querySelector('#m')!.addEventListener('prism-menu-select', (e) =>
      (window as unknown as { events: unknown[] }).events.push({
        value: (e as CustomEvent<{ value: string }>).detail.value,
        checked: (e as CustomEvent<{ checked: boolean }>).detail.checked,
      }),
    );
  }, theme);
  await wait(page, 500);
}

const open = async (page: Page) => {
  await page.getByRole('button', { name: 'View options' }).click();
  await wait(page, 500);
};
const markOf = (page: Page, id: string) =>
  page.locator(id).evaluate((el) => {
    const m = el.shadowRoot!.querySelector('[part="mark"]')!;
    const cs = getComputedStyle(m);
    return {
      offset: parseFloat(cs.strokeDashoffset),
      opacity: Number(cs.opacity),
      anims: m.getAnimations().length,
    };
  });

test.describe('checkable menu items', () => {
  test('roles and state: menuitemcheckbox with aria-checked; plain items stay menuitem', async ({
    page,
  }) => {
    await setup(page);
    await open(page);
    await expect(
      page.getByRole('menuitemcheckbox', { name: 'Show grid' }),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByRole('menuitemcheckbox', { name: 'Show rulers' }),
    ).toHaveAttribute('aria-checked', 'false');
    await expect(
      page.getByRole('menuitem', { name: 'Reset view' }),
    ).toHaveCount(1);
  });

  test('activating flips it, reports `checked`, and keeps the menu open; a plain item still closes it', async ({
    page,
  }) => {
    await setup(page);
    await open(page);
    await page.getByRole('menuitemcheckbox', { name: 'Show rulers' }).click();
    await expect(
      page.getByRole('menuitemcheckbox', { name: 'Show rulers' }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      await page
        .locator('#m')
        .evaluate((e) => (e as unknown as { open: boolean }).open),
    ).toBe(true);
    await page.getByRole('menuitemcheckbox', { name: 'Show grid' }).click();
    await page.getByRole('menuitem', { name: 'Reset view' }).click();
    expect(
      await page
        .locator('#m')
        .evaluate((e) => (e as unknown as { open: boolean }).open),
    ).toBe(false);
    expect(
      await page.evaluate(
        () => (window as unknown as { events: unknown[] }).events,
      ),
    ).toEqual([
      { value: 'Show rulers', checked: true },
      { value: 'Show grid', checked: false },
      { value: 'Reset view', checked: false },
    ]);
  });

  test('Space and Enter flip the focused item; a disabled one does nothing', async ({
    page,
  }) => {
    await setup(page);
    await page.getByRole('button', { name: 'View options' }).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await expect(page.locator('#rulers')).toHaveJSProperty('checked', true);
    await page.keyboard.press('Enter');
    await expect(page.locator('#rulers')).toHaveJSProperty('checked', false);
    await page.locator('#off').evaluate((e) => (e as HTMLElement).click());
    await expect(page.locator('#off')).toHaveJSProperty('checked', false);
  });

  test('the tick draws itself in and out on springs: stroke and opacity only, no jumps', async ({
    page,
  }) => {
    await setup(page);
    await polishMotion(page);
    await open(page);
    const rows = await recordFrames(
      page.locator('#rulers'),
      1000,
      (root) => {
        const cs = getComputedStyle(root.querySelector('[part="mark"]')!);
        return [parseFloat(cs.strokeDashoffset), Number(cs.opacity)];
      },
      [
        { at: 100, run: (h) => h.click() },
        { at: 550, run: (h) => h.click() },
      ],
    );
    const off = rows.map((r) => r[0]!);
    expect(off[0]).toBe(1);
    expect(Math.min(...off)).toBeLessThan(0.02);
    expect(off.at(-1)).toBeCloseTo(1, 2);
    // Never past either end, and never more than a third of the stroke per frame.
    expect(Math.max(...off)).toBeLessThanOrEqual(1);
    expect(Math.min(...off)).toBeGreaterThanOrEqual(0);
    expect(maxStep(rows)[0]).toBeLessThan(0.34);
    // Draws over several frames, not in one.
    expect(off.filter((v) => v > 0.05 && v < 0.95).length).toBeGreaterThan(4);
    const anim = await page.locator('#rulers').evaluate(async (h) => {
      (h as HTMLElement).click();
      await new Promise((r) => requestAnimationFrame(r));
      return h
        .shadowRoot!.querySelector('[part="mark"]')!
        .getAnimations()
        .flatMap((a) =>
          Object.keys((a.effect as KeyframeEffect).getKeyframes()[0]!).filter(
            (k) =>
              !['offset', 'easing', 'composite', 'computedOffset'].includes(k),
          ),
        );
    });
    expect([...new Set(anim)].sort()).toEqual(['opacity', 'strokeDashoffset']);
  });

  test('first open: a checked item already shows its full tick, nothing animates', async ({
    page,
  }) => {
    await setup(page);
    await open(page);
    expect(await markOf(page, '#grid')).toEqual({
      offset: 0,
      opacity: 1,
      anims: 0,
    });
    expect(await markOf(page, '#rulers')).toEqual({
      offset: 1,
      opacity: 0,
      anims: 0,
    });
  });

  test('a change from code while the menu is closed does not animate', async ({
    page,
  }) => {
    await setup(page);
    await page
      .locator('#rulers')
      .evaluate((e) => ((e as unknown as { checked: boolean }).checked = true));
    await wait(page, 100);
    await open(page);
    expect(await markOf(page, '#rulers')).toEqual({
      offset: 0,
      opacity: 1,
      anims: 0,
    });
  });

  test('reduced motion: the tick appears at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page);
    await open(page);
    await page.getByRole('menuitemcheckbox', { name: 'Show rulers' }).click();
    await wait(page, 20);
    expect(await markOf(page, '#rulers')).toEqual({
      offset: 0,
      opacity: 1,
      anims: 0,
    });
  });

  test('labels share one edge: plain items keep room for the tick', async ({
    page,
  }) => {
    await setup(page);
    await open(page);
    const x = (id: string) =>
      page.locator(id).evaluate(
        (e) =>
          e.getBoundingClientRect().x +
          (e.shadowRoot!.querySelector('slot')!.assignedNodes()[0]
            ? (() => {
                const r = document.createRange();
                r.selectNodeContents(e);
                return (
                  r.getBoundingClientRect().x - e.getBoundingClientRect().x
                );
              })()
            : 0),
      );
    expect(Math.abs((await x('#reset')) - (await x('#rulers')))).toBeLessThan(
      1,
    );
  });

  for (const theme of ['light', 'dark'])
    test(`axe: open menu with ticked and plain items (${theme})`, async ({
      page,
    }) => {
      await setup(page, theme);
      await open(page);
      expect(await axe(page)).toEqual([]);
    });
});
