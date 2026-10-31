import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';
import { wait } from '../../test/field.js';
import {
  mouseDown,
  releaseFrames,
  scaleAnims,
  scaleOf,
} from '../../test/press.js';

async function setup(page: Page, markup: string, polish = false) {
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  if (polish) {
    await page.addStyleTag({ path: 'src/theme/polish.css' });
    await page.evaluate(() =>
      (window as unknown as { __enablePolish: () => void }).__enablePolish(),
    );
  }
  await wait(page, 600);
}

const LINK = `<prism-card id="c" type="clickable" style="inline-size:360px">
  <prism-card-title slot="header" level="3" href="#opened">Onboarding guide</prism-card-title>
  <prism-card-description slot="header">Steps for welcoming new members.</prism-card-description>
  <div id="body" style="padding:24px 0">Some content that is not a control.</div>
  <prism-card-actions slot="footer"><prism-button id="nested" variant="ghost">Share Onboarding guide</prism-button></prism-card-actions>
</prism-card>`;
const c = (page: Page) => page.locator('#c');
const body = (page: Page) => page.locator('#body');

test.describe('clickable card press', () => {
  test('presses by at most about 1%, evenly, and eases back without passing 1.0', async ({
    page,
  }) => {
    await setup(page, LINK);
    await mouseDown(page, body(page));
    expect(await scaleAnims(c(page), '[part="base"]')).toEqual(['scale']);
    await wait(page, 300);
    expect(await scaleOf(c(page), '[part="base"]')).toBeCloseTo(0.99, 3);
    const { scales } = await releaseFrames(page, c(page), '[part="base"]');
    expect(Math.max(...scales)).toBeLessThanOrEqual(1);
    expect(await scaleOf(c(page), '[part="base"]')).toBe(1);
  });

  test('a control inside the card keeps its own press; the card stays still', async ({
    page,
  }) => {
    await setup(page, LINK);
    await mouseDown(page, page.locator('#nested'));
    await wait(page, 250);
    expect(await scaleOf(c(page), '[part="base"]')).toBe(1);
    expect(await scaleOf(page.locator('#nested'), 'button')).toBeLessThan(0.99);
    await page.mouse.up();
  });

  test('a plain card and a disabled clickable card do not press', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-card id="p" style="inline-size:300px"><prism-card-title slot="header" level="3">Plain</prism-card-title><p id="pb">Body</p></prism-card>
       <prism-card id="d" type="clickable" disabled style="inline-size:300px"><prism-card-title slot="header" level="3" href="#x">Off</prism-card-title><prism-card-description slot="header">Not now.</prism-card-description><p id="db">Body</p></prism-card>`,
    );
    for (const [id, inner] of [
      ['#p', '#pb'],
      ['#d', '#db'],
    ] as const) {
      await mouseDown(page, page.locator(inner));
      await wait(page, 150);
      expect(await scaleOf(page.locator(id), '[part="base"]')).toBe(1);
      await page.mouse.up();
    }
  });

  test('keyboard: Enter on the title link gives a brief press', async ({
    page,
  }) => {
    await setup(page, LINK);
    await page.keyboard.press('Tab');
    await page.keyboard.down('Enter');
    await wait(page, 150);
    expect(await scaleOf(c(page), '[part="base"]')).toBeLessThan(0.995);
    await page.keyboard.up('Enter');
    await wait(page, 500);
    expect(await scaleOf(c(page), '[part="base"]')).toBe(1);
  });

  test('coexists with the polish tilt: the host keeps its tilt transform while the base scales', async ({
    page,
  }) => {
    await setup(
      page,
      `<div data-prism-polish="tilt" style="padding:40px">${LINK}</div>`,
      true,
    );
    const b = (await body(page).boundingBox())!;
    await page.mouse.move(b.x + b.width - 8, b.y + 8, { steps: 5 });
    await wait(page, 150);
    await page.mouse.down();
    await wait(page, 300);
    const r = await c(page).evaluate((e) => ({
      tilt: getComputedStyle(e).transform,
      scale: getComputedStyle(e.shadowRoot!.querySelector('[part="base"]')!)
        .scale,
      tilting: e.hasAttribute('data-prism-tilting'),
    }));
    expect(r.tilting).toBe(true);
    expect(r.tilt).not.toBe('none');
    expect(parseFloat(r.scale)).toBeCloseTo(0.99, 3);
    await page.mouse.up();
  });

  test('reduced motion: no scale', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, LINK);
    await mouseDown(page, body(page));
    await wait(page, 150);
    expect(await scaleOf(c(page), '[part="base"]')).toBe(1);
    await page.mouse.up();
  });
});

test.describe('choice card and card toggle press', () => {
  test('a choice card presses by about 1% when pressed anywhere on it', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-card-group label="Plan"><prism-card id="k" type="selectable" kind="choice" value="a" style="inline-size:300px"><prism-card-select slot="header"></prism-card-select><prism-card-title slot="header" level="3">Starter</prism-card-title><p id="kb">For one person.</p></prism-card></prism-card-group>`,
    );
    await mouseDown(page, page.locator('#kb'));
    await wait(page, 300);
    expect(await scaleOf(page.locator('#k'), '[part="base"]')).toBeCloseTo(
      0.99,
      3,
    );
    await page.mouse.up();
    await wait(page, 500);
    expect(await scaleOf(page.locator('#k'), '[part="base"]')).toBe(1);
  });

  test('the collapsible card toggle presses like a medium button (2.5%) and still opens', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-card id="w" type="collapsible" style="inline-size:420px"><prism-card-title slot="header" level="3">Advanced settings</prism-card-title><p>Optional detail group.</p></prism-card>`,
    );
    const toggle = page.getByRole('button', { name: 'Advanced settings' });
    await mouseDown(page, toggle);
    await wait(page, 300);
    expect(
      await scaleOf(page.locator('prism-card-title'), '[part="toggle"]'),
    ).toBeCloseTo(0.975, 3);
    await page.mouse.up();
    await wait(page, 400);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      await scaleOf(page.locator('prism-card-title'), '[part="toggle"]'),
    ).toBe(1);
  });
});
