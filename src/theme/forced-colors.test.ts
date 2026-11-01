import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';

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
    path: ['prism-segment', 'base'],
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
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
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
      node = node?.shadowRoot?.querySelector(`[part="${part}"]`) ?? null;
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
