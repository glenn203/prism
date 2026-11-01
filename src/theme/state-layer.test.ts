import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mount } from '../../test/fixture.js';
import { needsBaseSelect } from '../../test/select.js';
import { expected, near, painted, PCT } from '../../test/paint.js';

const withTheme = async (page: Page) => {
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
};
const MARKUP = `
  <prism-button id="solid" type="button">Save</prism-button>
  <prism-button id="outline" variant="outline" type="button">Cancel</prism-button>
  <prism-button id="off" type="button" disabled>Off</prism-button>
  <prism-button id="off-outline" variant="outline" type="button" disabled>Off</prism-button>
  <prism-password-input label="Password" value="pw"></prism-password-input>
  <prism-test-row id="row">Row</prism-test-row>
  <prism-test-row id="row-sel" selected>Selected row</prism-test-row>
  <prism-test-row id="row-off" disabled>Disabled row</prism-test-row>
  <p id="away" style="margin-top:40px">away</p>`;

/** Computed style of a host's part. */
const partStyle = (host: Locator, part: string, prop: string) =>
  host.evaluate(
    (el, [part, prop]: [string, string]) =>
      getComputedStyle(
        el.shadowRoot!.querySelector(`[part~="${part}"]`)!,
      ).getPropertyValue(prop),
    [part, prop] as [string, string],
  );
/** What the browser computes for an expression (probe element). */
const probe = (page: Page, expr: string) =>
  page.evaluate((expr) => {
    const p = document.createElement('div');
    p.style.backgroundColor = expr;
    document.body.append(p);
    const v = getComputedStyle(p).backgroundColor;
    p.remove();
    return v;
  }, expr);
const SOLID = [
  'var(--prism-color-accent)',
  'var(--prism-color-on-accent)',
] as const;
const VEIL = ['transparent', 'var(--prism-color-text)'] as const;

const expectPaint = async (
  page: Page,
  host: Locator,
  part: string,
  [bg, on]: readonly [string, string],
  state: keyof typeof PCT,
) => {
  const got = await painted(host, part);
  const want = await expected(page, bg, on, PCT[state]);
  expect(near(got, want), `${state}: ${got.join()} vs ${want.join()}`).toBe(
    true,
  );
};

async function setup(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mount(page, MARKUP);
  await withTheme(page);
}

test('button (solid): accent fill stays put; hover/pressed paint the on-colour overlay; transparent border shows it', async ({
  page,
}) => {
  await setup(page);
  const b = page.locator('#solid');
  const rest = await partStyle(b, 'base', 'background-color');
  expect(rest).toBe(await probe(page, SOLID[0]));
  await expectPaint(page, b, 'base', SOLID, 'rest');
  await b.hover();
  expect(await partStyle(b, 'base', 'background-color')).toBe(rest);
  expect(await partStyle(b, 'base', 'background-image')).toMatch(
    /^linear-gradient\(/,
  );
  await expectPaint(page, b, 'base', SOLID, 'hover');
  // Border follows the fill by being transparent over the border-box overlay.
  expect(await partStyle(b, 'base', 'border-top-color')).toBe(
    'rgba(0, 0, 0, 0)',
  );
  expect(await partStyle(b, 'base', 'background-clip')).toBe('border-box');
  await page.mouse.down();
  await expectPaint(page, b, 'base', SOLID, 'pressed');
  await page.mouse.up();
});

test('outline: transparent rest, veil on hover/pressed, border unchanged, same focus ring', async ({
  page,
}) => {
  await setup(page);
  const o = page.locator('#outline');
  const border = await partStyle(o, 'base', 'border-top-color');
  expect(border).toBe(await probe(page, 'var(--prism-color-border-strong)'));
  expect(await partStyle(o, 'base', 'background-color')).toBe(
    'rgba(0, 0, 0, 0)',
  );
  await o.hover();
  await expectPaint(page, o, 'base', VEIL, 'hover');
  expect(await partStyle(o, 'base', 'border-top-color')).toBe(border);
  await page.mouse.down();
  await expectPaint(page, o, 'base', VEIL, 'pressed');
  expect(await partStyle(o, 'base', 'border-top-color')).toBe(border);
  await page.mouse.up();
  // Focus ring identical for solid and outline (keyboard focus).
  await page.mouse.move(0, 0);
  await page.locator('#solid').focus();
  await page.keyboard.press('Tab'); // → outline
  const ringOutline = await partStyle(o, 'base', 'box-shadow');
  await page.keyboard.press('Shift+Tab'); // → solid
  const ringSolid = await partStyle(
    page.locator('#solid'),
    'base',
    'box-shadow',
  );
  expect(ringOutline).toBe(ringSolid);
  expect(ringSolid).toMatch(/4px/);
});

test('overlay colour is the on-colour at the state % alpha (srgb)', async ({
  page,
}) => {
  await setup(page);
  await page.locator('#outline').hover();
  const img = await partStyle(
    page.locator('#outline'),
    'base',
    'background-image',
  );
  const want = await probe(
    page,
    'color-mix(in srgb, var(--prism-color-text) var(--prism-state-hover), transparent)',
  );
  expect(img).toBe(`linear-gradient(${want}, ${want})`);
});

test('disabled: no hover or pressed change (button, outline, generic row)', async ({
  page,
}) => {
  await setup(page);
  for (const id of ['#off', '#off-outline', '#row-off']) {
    const el = page.locator(id);
    const rest = await painted(el, 'base');
    await el.hover({ force: true });
    expect(await painted(el, 'base'), id).toEqual(rest);
    await page.mouse.down();
    expect(await painted(el, 'base'), id).toEqual(rest);
    await page.mouse.up();
    await page.mouse.move(0, 0);
  }
});

test('icon button (password toggle): veil on hover/pressed, selected (revealed) fill', async ({
  page,
}) => {
  await setup(page);
  const host = page.locator('prism-password-input');
  const toggle = host.getByRole('button', { name: 'Show password' });
  expect(await partStyle(host, 'toggle', 'background-color')).toBe(
    'rgba(0, 0, 0, 0)',
  );
  await toggle.hover();
  await expectPaint(page, host, 'toggle', VEIL, 'hover');
  await toggle.click(); // aria-pressed=true → selected (+hover)
  await page.mouse.move(0, 0);
  await expectPaint(page, host, 'toggle', VEIL, 'selected');
});

test('generic consumer (test row): selected and selected+hover, non-colour cue present', async ({
  page,
}) => {
  await setup(page);
  await page.addStyleTag({
    content: `prism-test-row::part(base){--_bg:var(--prism-color-bg);--_on:var(--prism-color-text)}`,
  });
  const sel = page.locator('#row-sel');
  const bg = 'var(--prism-color-bg)';
  const on = 'var(--prism-color-text)';
  await expectPaint(page, sel, 'base', [bg, on], 'selected');
  await sel.hover();
  await expectPaint(page, sel, 'base', [bg, on], 'selected+hover');
  await expect(sel).toContainText('✓'); // selected is never colour-only
  const row = page.locator('#row');
  await row.hover();
  await expectPaint(page, row, 'base', [bg, on], 'hover');
});

test('option: hover and keyboard focus use the hover fill, the chosen one the pressed fill, with a check mark', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mount(
    page,
    `<prism-select label="Fruit" value="apricot"><prism-option value="apricot">Apricot</prism-option><prism-option value="pear">Pear</prism-option></prism-select>`,
  );
  await withTheme(page);
  await needsBaseSelect(page);
  const box = page.getByRole('combobox');
  await box.click();
  const fill = (name: string) =>
    page.getByRole('option', { name }).evaluate((el) => {
      const probe = (v: string) => {
        const p = document.createElement('div');
        p.style.backgroundColor = `var(--prism-color-${v})`;
        document.body.append(p);
        const c = getComputedStyle(p).backgroundColor;
        p.remove();
        return c;
      };
      return {
        bg: getComputedStyle(el).backgroundColor,
        hover: probe('surface-hover'),
        pressed: probe('surface-pressed'),
        check: getComputedStyle(el, '::checkmark').visibility,
      };
    });
  await page.getByRole('option', { name: 'Pear' }).hover();
  const pear = await fill('Pear');
  expect(pear.bg).toBe(pear.hover);
  await page.mouse.move(0, 0);
  const apricot = await fill('Apricot');
  expect(apricot.bg).toBe(apricot.pressed);
  expect(apricot.check).toBe('visible');
});

test('hover is gated by @media (hover: hover): touch devices get no sticky hover', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await setup(page);
  const b = page.locator('#solid');
  const rest = await painted(b, 'base');
  expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(
    false,
  );
  await b.hover();
  expect(await painted(b, 'base')).toEqual(rest);
  await ctx.close();
  const src = readFileSync('src/internal/state-layer.ts', 'utf8');
  expect(src).toMatch(/@media \(hover: hover\) \{[\s\S]*:hover/);
});

test('fallback: color-mix() unsupported paths exist (utility + tokens)', () => {
  const util = readFileSync('src/internal/state-layer.ts', 'utf8');
  expect(util).toMatch(
    /@supports not \(color: color-mix\(in srgb, red, blue\)\)/,
  );
  for (const v of ['--_bg-hover', '--_bg-pressed', '--_bg-selected'])
    expect(util).toContain(v);
  const theme = readFileSync('src/theme/theme.css', 'utf8');
  for (const v of ['--_bg-hover', '--_bg-pressed', '--_bg-selected'])
    expect(theme).toContain(v);
  const tokens = readFileSync('src/tokens/tokens.css', 'utf8');
  expect(tokens).toMatch(
    /@supports not \(color: color-mix\(in oklch, red, blue\)\)/,
  );
});
