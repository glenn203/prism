import { expect, test, type Page } from '@playwright/test';
import { axe } from '../../test/axe.js';
import { mount } from '../../test/fixture.js';
import { maxStep, recordFrames, wait } from '../../test/field.js';
import { polishMotion } from '../../test/polish-motion.js';

async function setup(page: Page, theme = 'light') {
  await mount(
    page,
    `<prism-card-group label="Resources" mode="multi">
      <prism-card id="a" type="selectable" value="a" style="inline-size:300px"><prism-card-select slot="header"></prism-card-select><prism-card-title slot="header" level="3" href="#a">Resource A</prism-card-title><prism-card-description slot="header">Alpha.</prism-card-description></prism-card>
      <prism-card id="b" type="selectable" value="b" selected style="inline-size:300px"><prism-card-select slot="header"></prism-card-select><prism-card-title slot="header" level="3" href="#b">Resource B</prism-card-title><prism-card-description slot="header">Beta.</prism-card-description></prism-card>
    </prism-card-group>`,
  );
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.evaluate(
    (t) => document.documentElement.setAttribute('data-prism-theme', t),
    theme,
  );
  await wait(page, 600);
}

const mark = (id: string) => `#${id} prism-card-select`;
const state = (page: Page, id: string) =>
  page.locator(mark(id)).evaluate((e) => {
    const m = e.shadowRoot!.querySelector('[part="mark"]')!;
    const cs = getComputedStyle(m);
    const input = e.shadowRoot!.querySelector('input')!;
    return {
      offset: parseFloat(cs.strokeDashoffset),
      opacity: Number(cs.opacity),
      anims: m.getAnimations().length,
      appearance: getComputedStyle(input).appearance,
      checked: input.checked,
    };
  });

test.describe('selectable card corner check', () => {
  test('it is still a real, labelled checkbox; the tick is drawn on top', async ({
    page,
  }) => {
    await setup(page);
    const cb = page.getByRole('checkbox', { name: 'Resource A' });
    await expect(cb).not.toBeChecked();
    expect(await state(page, 'a')).toMatchObject({
      offset: 1,
      opacity: 0,
      appearance: 'none',
    });
    expect(await state(page, 'b')).toMatchObject({
      offset: 0,
      opacity: 1,
      anims: 0,
      checked: true,
    });
  });

  test('first paint: a card that starts selected shows its tick with no animation', async ({
    page,
  }) => {
    await setup(page);
    expect((await state(page, 'b')).anims).toBe(0);
  });

  test('ticking draws the tick in over several frames; unticking draws it out; no jumps', async ({
    page,
  }) => {
    await setup(page);
    await polishMotion(page);
    const rows = await recordFrames(
      page.locator(mark('a')),
      1000,
      (root) => {
        const cs = getComputedStyle(root.querySelector('[part="mark"]')!);
        return [parseFloat(cs.strokeDashoffset)];
      },
      [
        { at: 100, run: (h) => h.shadowRoot!.querySelector('input')!.click() },
        { at: 550, run: (h) => h.shadowRoot!.querySelector('input')!.click() },
      ],
    );
    const off = rows.map((r) => r[0]!);
    expect(off[0]).toBe(1);
    expect(Math.min(...off)).toBeLessThan(0.02);
    expect(off.at(-1)).toBeCloseTo(1, 2);
    expect(off.filter((v) => v > 0.05 && v < 0.95).length).toBeGreaterThan(4);
    expect(maxStep(rows)[0]).toBeLessThan(0.34);
  });

  test('reduced motion: the tick is there at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page);
    await page.getByRole('checkbox', { name: 'Resource A' }).click();
    await wait(page, 30);
    expect(await state(page, 'a')).toMatchObject({
      offset: 0,
      opacity: 1,
      anims: 0,
    });
  });

  test('a card taken out of the selection by code is not animated while hidden', async ({
    page,
  }) => {
    await setup(page);
    await page
      .locator('#a')
      .evaluate(
        (e) => ((e as unknown as { selected: boolean }).selected = true),
      );
    await wait(page, 600);
    expect(await state(page, 'a')).toMatchObject({ offset: 0, opacity: 1 });
  });

  test('forced colors: box and tick use system colours', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await setup(page);
    const r = await page.locator(mark('b')).evaluate((e) => {
      const input = e.shadowRoot!.querySelector('input')!;
      const check = e.shadowRoot!.querySelector('[part="check"]')!;
      return {
        bg: getComputedStyle(input).backgroundColor,
        tick: getComputedStyle(check).color,
      };
    });
    expect(r.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(r.bg).not.toBe(r.tick);
  });

  for (const theme of ['light', 'dark'])
    test(`axe (${theme})`, async ({ page }) => {
      await setup(page, theme);
      expect(await axe(page)).toEqual([]);
    });
});
