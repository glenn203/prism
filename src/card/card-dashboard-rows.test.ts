import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';

const settle = (page: Page, ms = 100) =>
  page.evaluate(
    (ms) =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => setTimeout(() => r(), ms)),
      ),
    ms,
  );

async function setup(page: Page, reduced = true) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setViewportSize({ width: 1500, height: 1100 });
  await mount(page, '');
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.emulateMedia({
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await page.evaluate(async () => {
    const path = '/src/card/dashboard-rows.recipe.ts';
    const m = (await import(/* @vite-ignore */ path)) as {
      createDashboardRows(): HTMLElement;
    };
    document.querySelector('#root')!.append(m.createDashboardRows());
    const els = [...document.querySelectorAll('#root *')] as (HTMLElement & {
      updateComplete?: Promise<unknown>;
    })[];
    await Promise.all(els.map((e) => e.updateComplete ?? Promise.resolve()));
  });
  await settle(page, 250);
  return errors;
}

/** The titles in each row, in order. */
const rows = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('prism-card-list')].map((l) =>
      [...l.querySelectorAll(':scope > prism-card')].map((c) =>
        c.querySelector('prism-card-title')!.textContent!.trim(),
      ),
    ),
  );
const counts = async (page: Page) => (await rows(page)).map((r) => r.length);
/** Live text of the card list's own region for a row, and the recipe's region. */
const listStatus = (page: Page, row: number) =>
  page.evaluate(
    (row) =>
      document
        .querySelectorAll('prism-card-list')
        [row - 1]!.shadowRoot!.querySelector('[part="status"]')!
        .textContent!.trim(),
    row,
  );
const dashStatus = (page: Page) =>
  page.evaluate(() =>
    document.querySelector('[data-prism-dash-status]')!.textContent!.trim(),
  );
const trigger = (page: Page, title: string) =>
  page.getByRole('button', { name: `More options for ${title}`, exact: true });
/** Row geometry: each card's left and width against the row's width. */
const geometry = (page: Page, row: number) =>
  page.evaluate((row) => {
    const list = document.querySelectorAll('prism-card-list')[row - 1]!;
    const grid = list.shadowRoot!.querySelector('[part="grid"]')!;
    const g = grid.getBoundingClientRect();
    return {
      grid: { left: g.left, width: g.width },
      cards: [...list.querySelectorAll(':scope > prism-card')].map((c) => {
        const r = c.getBoundingClientRect();
        return { left: r.left, width: r.width, right: r.right };
      }),
    };
  }, row);

const expectFills = async (page: Page, row: number) => {
  const { grid, cards } = await geometry(page, row);
  if (!cards.length) return;
  // Equal widths, and the row is filled edge to edge.
  const w = cards[0]!.width;
  for (const c of cards) expect(Math.abs(c.width - w)).toBeLessThan(1.5);
  expect(Math.abs(cards[0]!.left - grid.left)).toBeLessThan(1.5);
  expect(
    Math.abs(cards[cards.length - 1]!.right - (grid.left + grid.width)),
  ).toBeLessThan(1.5);
};

/** Keyboard only: open a card's menu and choose one item by its name. */
async function menuChoose(page: Page, title: string, item: string) {
  await trigger(page, title).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: item, exact: true }).focus();
  await page.keyboard.press('Enter');
  await settle(page, 200);
}

const dragTo = async (page: Page, title: string, x: number, y: number) => {
  const b = (await page
    .getByRole('button', { name: `Reorder ${title}`, exact: true })
    .boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 3, b.y + b.height / 2 + 8, {
    steps: 2,
  });
  await page.mouse.move(x, y, { steps: 8 });
};

test.describe('dashboard rows: layout', () => {
  test('3 rows of 3, no dev errors, every row is a labelled list and fills its width', async ({
    page,
  }) => {
    const errors = await setup(page);
    expect(errors).toEqual([]);
    expect(await counts(page)).toEqual([3, 3, 3]);
    for (const n of [1, 2, 3]) {
      await expectFills(page, n);
      await expect(
        page.getByRole('list', { name: `Row ${String(n)}` }),
      ).toHaveCount(1);
      await expect(
        page.getByRole('heading', { name: `Row ${String(n)}`, level: 2 }),
      ).toHaveCount(1);
    }
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(9);
  });

  test('a drag to another row makes it 4 and the source 2; every row stays full width with equal columns', async ({
    page,
  }) => {
    await setup(page);
    const z = (await page.locator('.dash-zone').nth(1).boundingBox())!;
    // Drop on the right half of the last card of row 2.
    await dragTo(page, 'Open items', z.x + z.width - 40, z.y + z.height / 2);
    await page.mouse.up();
    await settle(page, 250);
    expect(await counts(page)).toEqual([2, 4, 3]);
    for (const n of [1, 2, 3]) await expectFills(page, n);
    expect(await listStatus(page, 2)).toMatch(
      /^Open items moved from Row 1 to Row 2, position \d of 4\.$/,
    );
  });

  test('one card fills the row; an empty row is a visible drop target and takes a drag', async ({
    page,
  }) => {
    await setup(page);
    // Empty row 3 and leave row 1 with one card, by keyboard.
    for (const t of ['Member sign-ins', 'Settings changes', 'Exports queued'])
      await menuChoose(page, t, `Move to row 1, ${t}`);
    expect(await counts(page)).toEqual([6, 3, 0]);
    // Row 3 is empty: dashed, at least 100px tall, with its note, and no empty list role.
    const zone = await page.evaluate(() => {
      const z = document.querySelectorAll('.dash-zone')[2]!;
      const r = z.getBoundingClientRect();
      const cs = getComputedStyle(z);
      const note = z.querySelector('.dash-empty')!;
      return {
        h: r.height,
        border: cs.borderTopStyle,
        note: getComputedStyle(note).display,
        text: note.textContent!.trim(),
      };
    });
    expect(zone.h).toBeGreaterThanOrEqual(100);
    expect(zone.border).toBe('dashed');
    expect(zone.note).toBe('flex');
    expect(zone.text).toMatch(/^Nothing here yet/);
    await expect(page.getByRole('list', { name: 'Row 3' })).toHaveCount(0);
    // Drag a card from row 2 into the empty row.
    const z = (await page.locator('.dash-zone').nth(2).boundingBox())!;
    await dragTo(page, 'Urgent items', z.x + z.width / 2, z.y + z.height / 2);
    await page.mouse.up();
    await settle(page, 250);
    expect(await counts(page)).toEqual([6, 2, 1]);
    // One card: it fills the row.
    await expectFills(page, 3);
    const g = await geometry(page, 3);
    expect(g.cards[0]!.width).toBeGreaterThan(g.grid.width - 2);
    expect(await listStatus(page, 3)).toBe(
      'Urgent items moved from Row 2 to Row 3, position 1 of 1.',
    );
    await expect(page.getByRole('list', { name: 'Row 3' })).toHaveCount(1);
  });
});

test.describe('dashboard rows: keyboard only', () => {
  test('Move to row N lists every other row and not the current one', async ({
    page,
  }) => {
    await setup(page);
    const items = (title: string) =>
      page.evaluate((title) => {
        const c = [...document.querySelectorAll('prism-card')].find(
          (c) =>
            c.querySelector('prism-card-title')!.textContent!.trim() === title,
        )!;
        return [
          ...c.querySelectorAll(
            ':scope > prism-card-actions > prism-menu > prism-menu-item',
          ),
        ].map((i) => i.getAttribute('aria-label') ?? i.textContent!.trim());
      }, title);
    const a = await items('Open items');
    expect(a).toContain('Move to row 2, Open items');
    expect(a).toContain('Move to row 3, Open items');
    expect(a).not.toContain('Move to row 1, Open items');
    // The Move items come before the row items.
    expect(a.findIndex((n) => n.startsWith('Move to start'))).toBeLessThan(
      a.findIndex((n) => n.startsWith('Move to row 2')),
    );
    const b = await items('Storage used');
    expect(b).not.toContain('Move to row 2, Storage used');
    expect(b).toContain('Move to row 1, Storage used');
  });

  test('every kind of move works from the keyboard; focus stays on the card menu button; each move is announced', async ({
    page,
  }) => {
    await setup(page);
    // Within the row: later, to end, earlier, to start.
    await menuChoose(page, 'Open items', 'Move later, Open items');
    expect((await rows(page))[0]).toEqual([
      'Active resources',
      'Open items',
      'Setup coverage',
    ]);
    expect(await listStatus(page, 1)).toBe(
      'Open items moved from position 1 to position 2 of 3.',
    );
    await expect(trigger(page, 'Open items')).toBeFocused();

    await menuChoose(page, 'Open items', 'Move to end, Open items');
    expect((await rows(page))[0]![2]).toBe('Open items');
    expect(await listStatus(page, 1)).toBe(
      'Open items moved from position 2 to position 3 of 3.',
    );
    await expect(trigger(page, 'Open items')).toBeFocused();

    await menuChoose(page, 'Open items', 'Move earlier, Open items');
    expect((await rows(page))[0]![1]).toBe('Open items');
    await expect(trigger(page, 'Open items')).toBeFocused();

    await menuChoose(page, 'Open items', 'Move to start, Open items');
    expect((await rows(page))[0]![0]).toBe('Open items');
    expect(await listStatus(page, 1)).toBe(
      'Open items moved from position 2 to position 1 of 3.',
    );
    await expect(trigger(page, 'Open items')).toBeFocused();

    // To another row.
    await menuChoose(page, 'Open items', 'Move to row 2, Open items');
    expect(await counts(page)).toEqual([2, 4, 3]);
    expect((await rows(page))[1]![3]).toBe('Open items');
    expect(await listStatus(page, 2)).toBe(
      'Open items moved from Row 1 to Row 2, position 4 of 4.',
    );
    await expect(trigger(page, 'Open items')).toBeFocused();
    for (const n of [1, 2, 3]) await expectFills(page, n);

    // The menu is current: no Move to row 2 now, but row 1 and 3; press again.
    await menuChoose(page, 'Open items', 'Move to row 3, Open items');
    expect(await counts(page)).toEqual([2, 3, 4]);
    expect(await listStatus(page, 3)).toBe(
      'Open items moved from Row 2 to Row 3, position 4 of 4.',
    );
    await expect(trigger(page, 'Open items')).toBeFocused();
    // Back to row 1, and the card is still reachable by Tab from its own handle.
    await menuChoose(page, 'Open items', 'Move to row 1, Open items');
    expect(await counts(page)).toEqual([3, 3, 3]);
    await expect(trigger(page, 'Open items')).toBeFocused();
  });

  test('moving the last card out of a row leaves an empty drop zone and the focus on the moved card', async ({
    page,
  }) => {
    await setup(page);
    for (const t of ['Open items', 'Active resources'])
      await menuChoose(page, t, `Move to row 2, ${t}`);
    await menuChoose(page, 'Setup coverage', 'Move to row 2, Setup coverage');
    expect(await counts(page)).toEqual([0, 6, 3]);
    await expect(trigger(page, 'Setup coverage')).toBeFocused();
    // Row 1 is a valid target for a keyboard move.
    await menuChoose(page, 'Storage used', 'Move to row 1, Storage used');
    expect(await counts(page)).toEqual([1, 5, 3]);
    await expectFills(page, 1);
    expect(await listStatus(page, 1)).toBe(
      'Storage used moved from Row 2 to Row 1, position 1 of 1.',
    );
    await expect(trigger(page, 'Storage used')).toBeFocused();
  });

  test('the drag handle is a focusable button, the menu is reachable by Tab, and Escape closes it with focus kept', async ({
    page,
  }) => {
    await setup(page);
    await trigger(page, 'Open items').focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('menuitem', { name: 'Move to row 2, Open items' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger(page, 'Open items')).toBeFocused();
    await expect(
      page.getByRole('menuitem', { name: 'Move to row 2, Open items' }),
    ).toHaveCount(0);
  });
});

test.describe('dashboard rows: reset', () => {
  test('Reset layout (by keyboard) restores 3 x 3 in the first order, says so in the live region, and keeps focus on the button', async ({
    page,
  }) => {
    await setup(page);
    const first = await rows(page);
    await menuChoose(page, 'Open items', 'Move to row 3, Open items');
    await menuChoose(page, 'Active resources', 'Move to end, Active resources');
    await menuChoose(page, 'Storage used', 'Move to row 1, Storage used');
    expect(await counts(page)).toEqual([3, 2, 4]);
    const reset = page.getByRole('button', { name: 'Reset layout' });
    await reset.focus();
    await page.keyboard.press('Enter');
    await settle(page, 250);
    expect(await rows(page)).toEqual(first);
    expect(await counts(page)).toEqual([3, 3, 3]);
    expect(await dashStatus(page)).toBe(
      'Layout reset. Three rows of three cards.',
    );
    await expect(reset).toBeFocused();
    for (const n of [1, 2, 3]) await expectFills(page, n);
    // The menus are right for the restored rows and keep working.
    await menuChoose(page, 'Open items', 'Move to row 2, Open items');
    expect(await counts(page)).toEqual([2, 4, 3]);
    await expect(
      page.getByRole('menuitem', { name: 'Move to row 1, Open items' }),
    ).toHaveCount(0);
  });

  test('Reset after an emptied row fills it again', async ({ page }) => {
    await setup(page);
    for (const t of ['Member sign-ins', 'Settings changes', 'Exports queued'])
      await menuChoose(page, t, `Move to row 1, ${t}`);
    expect(await counts(page)).toEqual([6, 3, 0]);
    await page.getByRole('button', { name: 'Reset layout' }).click();
    await settle(page, 250);
    expect(await counts(page)).toEqual([3, 3, 3]);
    await expect(page.getByRole('list', { name: 'Row 3' })).toHaveCount(1);
  });
});

test.describe('dashboard rows: announcements', () => {
  test('a drag says "Picked up", then the move, in the row lists own polite live regions', async ({
    page,
  }) => {
    await setup(page);
    const regions = await page.evaluate(() =>
      [...document.querySelectorAll('prism-card-list')].map((l) => {
        const s = l.shadowRoot!.querySelector('[part="status"]')!;
        return [s.getAttribute('role'), s.getAttribute('aria-live')];
      }),
    );
    expect(regions).toEqual([
      ['status', 'polite'],
      ['status', 'polite'],
      ['status', 'polite'],
    ]);
    const dash = await page.evaluate(() => {
      const s = document.querySelector('[data-prism-dash-status]')!;
      return [s.getAttribute('role'), s.getAttribute('aria-live')];
    });
    expect(dash).toEqual(['status', 'polite']);
    const z = (await page.locator('.dash-zone').nth(1).boundingBox())!;
    await dragTo(page, 'Open items', z.x + 40, z.y + z.height / 2);
    expect(await listStatus(page, 1)).toBe(
      'Picked up Open items, position 1 of 3.',
    );
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await settle(page, 200);
    expect(await listStatus(page, 1)).toBe(
      'Move canceled. Open items is at position 1 of 3.',
    );
    expect(await counts(page)).toEqual([3, 3, 3]);
  });

  test('while dragging, the dimmed original is inert (a placeholder); it is live again after a drop and after a cancel; focus returns to its handle', async ({
    page,
  }) => {
    await setup(page);
    const inert = (t: string) =>
      page.evaluate(
        (t) =>
          [...document.querySelectorAll('prism-card')]
            .find(
              (c) =>
                c.querySelector('prism-card-title')!.textContent!.trim() === t,
            )!
            .hasAttribute('inert'),
        t,
      );
    const z = (await page.locator('.dash-zone').nth(1).boundingBox())!;
    await dragTo(page, 'Open items', z.x + z.width - 40, z.y + z.height / 2);
    expect(await inert('Open items')).toBe(true);
    expect(await inert('Active resources')).toBe(false);
    await page.mouse.up();
    await settle(page, 250);
    expect(await inert('Open items')).toBe(false);
    await expect(
      page.getByRole('button', {
        name: 'Reorder Open items',
        exact: true,
      }),
    ).toBeFocused();
    // Cancel with Escape.
    await dragTo(page, 'Active resources', z.x + 40, z.y + z.height / 2);
    expect(await inert('Active resources')).toBe(true);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await settle(page, 250);
    expect(await inert('Active resources')).toBe(false);
    await expect(
      page.getByRole('button', {
        name: 'Reorder Active resources',
        exact: true,
      }),
    ).toBeFocused();
  });
});
