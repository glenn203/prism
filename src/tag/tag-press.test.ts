import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';
import { wait } from '../../test/field.js';
import {
  mouseDown,
  releaseFrames,
  scaleAnims,
  scaleOf,
} from '../../test/press.js';

async function setup(page: Page, markup: string) {
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await wait(page, 600);
}

const TAGS = `
  <prism-tag id="plain">Draft</prism-tag>
  <prism-tag id="sel" selectable>Design</prism-tag>
  <prism-tag id="trig" trigger>Status</prism-tag>
  <prism-tag id="off" selectable disabled>Locked</prism-tag>
  <prism-tag id="dis" dismissible remove-label="Review">Review</prism-tag>`;
const h = (page: Page, id: string) => page.locator(id);

test.describe('tag press', () => {
  for (const id of ['#sel', '#trig'])
    test(`${id} (an interactive tag) squishes by about 3% and eases back without passing 1.0`, async ({
      page,
    }) => {
      await setup(page, TAGS);
      await mouseDown(page, h(page, id));
      expect(await scaleAnims(h(page, id), '[part="base"]')).toEqual(['scale']);
      await wait(page, 300);
      expect(await scaleOf(h(page, id), '[part="base"]')).toBeCloseTo(0.97, 3);
      const { scales } = await releaseFrames(
        page,
        h(page, id),
        '[part="base"]',
      );
      expect(Math.max(...scales)).toBeLessThanOrEqual(1);
      expect(await scaleOf(h(page, id), '[part="base"]')).toBe(1);
    });

  test('a plain label tag, and a disabled tag, never press', async ({
    page,
  }) => {
    await setup(page, TAGS);
    for (const id of ['#plain', '#off']) {
      await mouseDown(page, h(page, id));
      await wait(page, 150);
      expect(await scaleOf(h(page, id), '[part="base"]')).toBe(1);
      expect(await scaleAnims(h(page, id), '[part="base"]')).toEqual([]);
      await page.mouse.up();
    }
  });

  test('the remove button of a dismissible tag presses; the tag itself stays', async ({
    page,
  }) => {
    await setup(page, TAGS);
    const remove = page.getByRole('button', { name: 'Remove Review' });
    await mouseDown(page, remove);
    await wait(page, 300);
    expect(await scaleOf(h(page, '#dis'), '[part="remove"]')).toBeCloseTo(
      0.97,
      3,
    );
    expect(await scaleOf(h(page, '#dis'), '[part="base"]')).toBe(1);
    await page.mouse.up();
  });

  test('Space and Enter give a selectable tag a brief press, and it still toggles', async ({
    page,
  }) => {
    await setup(page, TAGS);
    await h(page, '#sel').evaluate((e) => (e as HTMLElement).focus());
    await page.keyboard.down('Enter');
    await wait(page, 150);
    expect(await scaleOf(h(page, '#sel'), '[part="base"]')).toBeLessThan(0.99);
    await page.keyboard.up('Enter');
    await expect(h(page, '#sel')).toHaveJSProperty('selected', true);
    await wait(page, 500);
    expect(await scaleOf(h(page, '#sel'), '[part="base"]')).toBe(1);
  });

  test('reduced motion: no scale, only the pressed colour', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, TAGS);
    await mouseDown(page, h(page, '#sel'));
    await wait(page, 150);
    expect(await scaleOf(h(page, '#sel'), '[part="base"]')).toBe(1);
    expect(await scaleAnims(h(page, '#sel'), '[part="base"]')).toEqual([]);
    await page.mouse.up();
  });

  test('a tag toggling into selected state does not leave a stuck scale', async ({
    page,
  }) => {
    await setup(page, TAGS);
    await h(page, '#sel').click();
    await wait(page, 600);
    await expect(h(page, '#sel')).toHaveJSProperty('selected', true);
    expect(await scaleOf(h(page, '#sel'), '[part="base"]')).toBe(1);
  });
});
