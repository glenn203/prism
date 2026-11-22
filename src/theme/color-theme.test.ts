import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';
import { painted } from '../../test/paint.js';

/** Computed colour of `property: var(--prism-<name>)` on the element. */
const paint = (page: Page, selector: string, name: string) =>
  page.evaluate(
    ([selector, name]) => {
      const el = document.querySelector<HTMLElement>(selector)!;
      const probe = document.createElement('i');
      probe.style.backgroundColor = `var(--prism-${name})`;
      el.append(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    },
    [selector, name] as const,
  );

/** What the browser computes for a literal colour (same serialisation). */
const literal = (page: Page, value: string) =>
  page.evaluate((value) => {
    const probe = document.createElement('i');
    probe.style.backgroundColor = value;
    document.body.append(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  }, value);

const setup = async (page: Page) => {
  await mount(
    page,
    `<div id="light"></div>
     <div id="dark" data-prism-theme="dark"><div id="inner" data-prism-theme="light"></div></div>
     <div id="auto" data-prism-theme="auto"></div>`,
  );
  await page.addStyleTag({ url: '/src/tokens/tokens.css' });
  await page.addStyleTag({ url: '/src/theme/theme.css' });
};

test('light is the default, dark is opt-in, and a light scope inside dark restores light', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' }); // the system must not matter
  await setup(page);
  const bg = (sel: string) => paint(page, sel, 'color-bg');
  const white = await literal(page, 'oklch(0.995 0.002 255)');
  expect(await bg('#light')).toBe(white);
  expect(await bg('#dark')).toBe(await literal(page, 'oklch(0.155 0.01 255)'));
  expect(await bg('#inner')).toBe(white);
});

test('auto follows the system colour scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await setup(page);
  expect(await paint(page, '#auto', 'color-bg')).toBe(
    await literal(page, 'oklch(0.995 0.002 255)'),
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await paint(page, '#auto', 'color-bg')).toBe(
    await paint(page, '#dark', 'color-bg'),
  );
});

test('everything built from a themed role follows it: halo, elevation, mist, color-scheme', async ({
  page,
}) => {
  await setup(page);
  const read = (sel: string, name: string) =>
    page.evaluate(
      ([sel, name]) =>
        getComputedStyle(document.querySelector(sel)!).getPropertyValue(name),
      [sel, name] as const,
    );
  for (const name of [
    '--prism-focus-halo',
    '--prism-elevation-default',
    '--prism-gradient-mist',
    '--prism-color-accent',
  ])
    expect(await read('#dark', name), name).not.toBe(
      await read('#light', name),
    );
  expect(await read('#dark', 'color-scheme')).toBe('dark');
  expect(await read('#light', 'color-scheme')).toBe('light');
});

test('primary button: near-white text on near-black in light, ink on near-white in dark', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // no colour transition mid-read
  await mount(
    page,
    `<div id="l"><prism-button type="button">Go</prism-button></div>
     <div id="d" data-prism-theme="dark"><prism-button type="button">Go</prism-button></div>`,
  );
  await page.addStyleTag({ url: '/src/tokens/tokens.css' });
  await page.addStyleTag({ url: '/src/theme/theme.css' });
  const style = (sel: string) =>
    page.evaluate((sel) => {
      const base = document
        .querySelector(`${sel} prism-button`)!
        .shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const s = getComputedStyle(base);
      return { bg: s.backgroundColor, fg: s.color };
    }, sel);
  const [light, dark] = [await style('#l'), await style('#d')];
  expect(light.fg).toBe(await literal(page, 'oklch(0.995 0.002 255)')); // near-white
  expect(light.bg).toBe(await literal(page, 'oklch(0.2 0.011 255)')); // near-black
  expect(dark.fg).toBe(await literal(page, 'oklch(0.155 0.01 255)')); // ink
  expect(dark.bg).toBe(await literal(page, 'oklch(0.985 0.004 255)')); // near-white
});

test('the opt-in accent layer restores the spectral accent on a primary button', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mount(
    page,
    `<div id="l"><prism-button type="button">Go</prism-button></div>`,
  );
  await page.addStyleTag({ url: '/src/tokens/tokens.css' });
  await page.addStyleTag({ url: '/src/theme/theme.css' });
  await page.addStyleTag({ url: '/src/theme/theme-accent.css' });
  const fill = await painted(page.locator('#l prism-button'), 'base');
  expect(fill[2]! - fill[1]!).toBeGreaterThan(100); // violet: blue far above green
});
