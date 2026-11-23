// Theme colours, forced-colors, and state layers.

import { expect, test, type Page, type Locator } from '@playwright/test';
import { mount } from '../../test/fixture.js';
import { painted, expected, near, PCT } from '../../test/paint.js';
import { readFileSync } from 'node:fs';
import { needsBaseSelect } from '../../test/select.js';

// --- color-theme.test.ts ---
{
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
    expect(await bg('#dark')).toBe(
      await literal(page, 'oklch(0.155 0.01 255)'),
    );
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
}

// --- forced-colors.test.ts ---
{
  /**
   * In forced-colors mode a transparent outline is painted in the text colour,
   * so a control that rests with one wears a stray second border. Each control
   * must rest with no outline and draw one (the only focus indicator there,
   * since shadows are dropped) while focused.
   *
   * `path` walks from a light-DOM selector through shadow-root parts.
   */
  const CASES: { name: string; markup: string; path: string[] }[] = [
    {
      name: 'segmented control segment',
      markup:
        '<prism-segmented-control label="Range" value="a"><prism-segment value="a">Day</prism-segment><prism-segment value="b">Week</prism-segment></prism-segmented-control>',
      path: ['prism-segmented-control', 'base'],
    },
    {
      name: 'button',
      markup: '<prism-button>Go</prism-button>',
      path: ['prism-button', 'base'],
    },
    {
      name: 'outline button',
      markup: '<prism-button variant="outline">Go</prism-button>',
      path: ['prism-button', 'base'],
    },
    {
      name: 'icon button',
      markup: '<prism-icon-button label="Add">+</prism-icon-button>',
      path: ['prism-icon-button', 'base'],
    },
    {
      name: 'menu trigger',
      markup:
        '<prism-menu label="More"><prism-menu-item>One</prism-menu-item></prism-menu>',
      path: ['prism-menu', 'trigger', 'base'],
    },
    {
      name: 'text input',
      markup: '<prism-text-input label="A"></prism-text-input>',
      path: ['prism-text-input', 'input'],
    },
    {
      name: 'floating text input',
      markup: '<prism-text-input label="A" floating></prism-text-input>',
      path: ['prism-text-input', 'input'],
    },
    {
      name: 'password input',
      markup: '<prism-password-input label="A"></prism-password-input>',
      path: ['prism-password-input', 'input'],
    },
    {
      name: 'search input',
      markup: '<prism-search-input label="A"></prism-search-input>',
      path: ['prism-search-input', 'input'],
    },
    {
      name: 'text area',
      markup: '<prism-text-area label="A"></prism-text-area>',
      path: ['prism-text-area', 'input'],
    },
    {
      name: 'select',
      markup:
        '<prism-select label="A"><prism-option value="a">A</prism-option></prism-select>',
      path: ['prism-select', 'trigger'],
    },
    {
      name: 'switch',
      markup: '<prism-switch label="A"></prism-switch>',
      path: ['prism-switch', 'base'],
    },
    {
      name: 'checkbox',
      markup: '<prism-checkbox label="A"></prism-checkbox>',
      path: ['prism-checkbox', 'base'],
    },
    {
      name: 'radio',
      markup:
        '<prism-radio-group label="G" value="a"><prism-radio value="a" label="A"></prism-radio></prism-radio-group>',
      path: ['prism-radio-group', 'base'],
    },
    {
      name: 'dismissible tag',
      markup: '<prism-tag dismissible>Tag</prism-tag>',
      path: ['prism-tag', 'remove'],
    },
    {
      name: 'selectable tag',
      markup: '<prism-tag selectable>Tag</prism-tag>',
      path: ['prism-tag', 'base'],
    },
    {
      name: 'collapsible card toggle',
      markup:
        '<prism-card type="collapsible"><prism-card-title slot="header" level="3">T</prism-card-title><p>b</p></prism-card>',
      path: ['prism-card-title', 'toggle'],
    },
    {
      name: 'card handle',
      markup:
        '<prism-card-list label="G" reorderable columns="1"><prism-card value="a"><prism-card-handle slot="header"></prism-card-handle><prism-card-title slot="header" level="3">T</prism-card-title><prism-card-actions slot="header"><prism-menu label="More options for T"><prism-menu-item>Rename</prism-menu-item></prism-menu></prism-card-actions><p>b</p></prism-card></prism-card-list>',
      path: ['prism-card-handle', 'base'],
    },
  ];

  async function setup(page: Page, markup: string) {
    await page.emulateMedia({
      forcedColors: 'active',
      reducedMotion: 'reduce',
    });
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60))),
    );
  }

  /** Computed outline of the part at the end of `path`. */
  const outline = (page: Page, path: string[]) =>
    page.evaluate((path) => {
      let node: Element | null = document.querySelector(path[0]!);
      for (const part of path.slice(1))
        node = node?.shadowRoot?.querySelector(`[part~="${part}"]`) ?? null;
      if (!node) return null;
      const cs = getComputedStyle(node);
      return {
        style: cs.outlineStyle,
        width: cs.outlineWidth,
        color: cs.outlineColor,
      };
    }, path);

  for (const c of CASES) {
    test(`forced colors: ${c.name} has no stray outline at rest and outlines itself when focused`, async ({
      page,
    }) => {
      await setup(page, c.markup);
      const rest = await outline(page, c.path);
      expect(rest, 'part not found').not.toBeNull();
      expect(rest!.style).toBe('none');
      // Focus it the way a keyboard user would.
      await page.keyboard.press('Tab');
      if (
        await page.evaluate(
          () =>
            !document.activeElement || document.activeElement === document.body,
        )
      )
        await page.keyboard.press('Tab');
      // Some parts sit behind another stop (a card handle, a menu): walk on until the part has it.
      let focused = await outline(page, c.path);
      for (let i = 0; i < 4 && focused!.style === 'none'; i++) {
        await page.keyboard.press('Tab');
        focused = await outline(page, c.path);
      }
      expect(focused!.style).toBe('solid');
      expect(parseFloat(focused!.width)).toBeGreaterThanOrEqual(2);
      expect(focused!.color).not.toBe('rgba(0, 0, 0, 0)');
    });
  }

  test('forced colors: a disabled select is drawn in the disabled system colour', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-select label="A" value="a" disabled><prism-option value="a">A</prism-option></prism-select><prism-select label="B" value="a"><prism-option value="a">A</prism-option></prism-select>',
    );
    const colours = await page.evaluate(() =>
      [...document.querySelectorAll('prism-select')].map((s) => {
        const t = getComputedStyle(
          s.shadowRoot!.querySelector('[part="trigger"]')!,
        );
        return { border: t.borderTopColor, text: t.color };
      }),
    );
    expect(colours[0]!.border).not.toBe(colours[1]!.border);
    expect(colours[0]!.text).not.toBe(colours[1]!.text);
  });
}

// --- state-layer.test.ts ---
{
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
    expect(
      await page.evaluate(() => matchMedia('(hover: hover)').matches),
    ).toBe(false);
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
}
