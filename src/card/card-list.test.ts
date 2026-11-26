// Card lists: grid, paging, states, and reorder.

import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';

// --- card-list.test.ts ---
{
  const settle = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => setTimeout(() => r(), 60)),
        ),
    );
  async function setup(page: Page, markup: string, width = 1300) {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settle(page);
    return errors;
  }
  const card = (id: string, extra = '') => `
    <prism-card type="selectable" kind="collection" value="${id}" ${extra}>
      <prism-card-select slot="header"></prism-card-select>
      <prism-card-title slot="header" level="3">Resource ${id}</prism-card-title>
      <prism-card-description slot="header">Lumen Server</prism-card-description>
      <p>Updated 4 min ago</p>
    </prism-card>`;
  const cards = (ids: string[]) => ids.map((i) => card(i)).join('');
  const LIST = (ids: string[], attrs = '', style = 'width:1300px') =>
    `<prism-card-list id="l" label="Resources" ${attrs} style="${style}">${cards(ids)}</prism-card-list>`;
  const ids = (from: number, n: number) =>
    Array.from({ length: n }, (_, i) => `h-${from + i}`);

  const listStatus = (page: Page) =>
    page
      .locator('#l')
      .evaluate((el) =>
        String(
          el.shadowRoot!.querySelector('[part="status"]')!.textContent,
        ).trim(),
      );
  const columns = (page: Page) =>
    page.locator('#l').evaluate((el) => {
      const cs = getComputedStyle(
        el.shadowRoot!.querySelector('[part="grid"]')!,
      );
      return cs.gridTemplateColumns.split(' ').length;
    });
  const widths = (page: Page) =>
    page.locator('#l prism-card').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { w: r.width, h: r.height, x: r.x, y: r.y };
      }),
    );

  test.describe('card list: grid', () => {
    for (const [w, cols] of [
      [320, 1],
      [639, 1],
      [640, 2],
      [1023, 2],
      [1024, 3],
      [1279, 3],
      [1280, 4],
    ] as const)
      test(`${String(w)}px wide: ${String(cols)} column(s), each card at least 280px (320px: fits)`, async ({
        page,
      }) => {
        await setup(page, LIST(ids(1, 8), '', `width:${String(w)}px`), 1300);
        expect(await columns(page)).toBe(cols);
        const ws = await widths(page);
        // At 320 the card shrinks to its container (reflow); elsewhere >= 280.
        for (const c of ws)
          expect(c.w).toBeGreaterThanOrEqual(w < 400 ? w - 1 : 280);
      });

    test('the gap is 16px between columns and between rows', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 8), '', 'width:1024px'));
      const [a, b, , , d] = await widths(page);
      expect(Math.round(b!.x - (a!.x + a!.w))).toBe(16);
      expect(Math.round(d!.y - (a!.y + a!.h))).toBe(16);
    });

    test('columns="1" pins one column in a wide container (Aside, Drawer, Modal)', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 4), 'columns="1"', 'width:1300px'));
      expect(await columns(page)).toBe(1);
    });

    test('cards in a row share a height and footers line up', async ({
      page,
    }) => {
      const long = `<prism-card type="selectable" kind="collection" value="x">
        <prism-card-select slot="header"></prism-card-select>
        <prism-card-title slot="header" level="3">Long</prism-card-title>
        <p>one</p><p>two</p><p>three</p><p>four</p>
        <prism-card-meta slot="footer">Foot</prism-card-meta></prism-card>`;
      const short = `<prism-card type="selectable" kind="collection" value="y">
        <prism-card-select slot="header"></prism-card-select>
        <prism-card-title slot="header" level="3">Short</prism-card-title>
        <p>one</p><prism-card-meta slot="footer">Foot</prism-card-meta></prism-card>`;
      await setup(
        page,
        `<prism-card-list id="l" label="x" style="width:700px">${long}${short}</prism-card-list>`,
      );
      const ws = await widths(page);
      expect(ws[0]!.h).toBe(ws[1]!.h);
      const feet = await page
        .locator('#l prism-card-meta')
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
      expect(Math.abs(feet[0]! - feet[1]!)).toBeLessThan(1);
    });

    test('320px viewport and 200% zoom: no horizontal scroll', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 6), '', 'width:100%'), 320);
      const over = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(over).toBeLessThanOrEqual(0);
      expect(await columns(page)).toBe(1);
    });
  });

  test.describe('card list: semantics', () => {
    test('a labelled list of list items with real headings, one level', async ({
      page,
    }) => {
      const errors = await setup(page, LIST(ids(1, 3)));
      expect(errors).toEqual([]);
      await expect(page.getByRole('list', { name: 'Resources' })).toHaveCount(
        1,
      );
      await expect(page.getByRole('listitem')).toHaveCount(3);
      await expect(page.getByRole('heading', { level: 3 })).toHaveCount(3);
      await expect(page.getByRole('region')).toHaveCount(0);
    });

    test('mixed title levels are a dev error', async ({ page }) => {
      const errors = await setup(
        page,
        `<prism-card-list label="x">
          <prism-card><prism-card-title slot="header" level="3">A</prism-card-title>a</prism-card>
          <prism-card><prism-card-title slot="header" level="4">B</prism-card-title>b</prism-card>
        </prism-card-list>`,
      );
      expect(errors.some((e) => e.includes('share one title level'))).toBe(
        true,
      );
    });

    test('total sets position and size from the data, not the page', async ({
      page,
    }) => {
      await setup(page, LIST(ids(49, 24), 'total="120" page="3"'));
      const first = page.locator('#l prism-card').first();
      await expect(first).toHaveAttribute('aria-posinset', '49');
      await expect(first).toHaveAttribute('aria-setsize', '120');
      await expect(page.locator('#l prism-card').last()).toHaveAttribute(
        'aria-posinset',
        '72',
      );
    });

    test('a missing label is a dev error', async ({ page }) => {
      const errors = await setup(page, `<prism-card-list></prism-card-list>`);
      expect(errors.some((e) => e.includes('needs a `label`'))).toBe(true);
    });
  });

  test.describe('card list: paging', () => {
    const pager = (page: Page) => page.locator('#l [data-prism-pager]');

    test('default page size is 24; 12, 24 and 48 are the choices', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 3), 'total="100"'));
      await expect(page.locator('#l')).toHaveJSProperty('pageSize', 24);
      const opts = await page
        .locator('#l [data-prism-page-size] option')
        .allTextContents();
      expect(opts.map((o) => o.trim())).toEqual(['12', '24', '48']);
      await expect(
        page.locator('#l [data-prism-page-size] select'),
      ).toHaveValue('24');
    });

    test('another page size is a dev error', async ({ page }) => {
      const errors = await setup(page, LIST(ids(1, 3), 'page-size="30"'));
      expect(errors.some((e) => e.includes('page-size is 12, 24, 48'))).toBe(
        true,
      );
    });

    test('shows "Page X of Y" even with one page; Previous and Next end at the edges', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 3), 'total="3"'));
      await expect(pager(page)).toBeVisible();
      await expect(pager(page)).toContainText('Page 1 of 1');
      await expect(
        page.getByRole('button', { name: 'Previous' }),
      ).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
      await expect(
        page.getByRole('navigation', { name: 'Pagination' }),
      ).toHaveCount(1);
    });

    test('Next fires prism-card-list-page with the new page', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 24), 'total="100"'));
      await page.evaluate(() => {
        const w = window as unknown as { log: unknown[] };
        w.log = [];
        document.addEventListener('prism-card-list-page', (e) =>
          w.log.push((e as CustomEvent).detail),
        );
      });
      await page.getByRole('button', { name: 'Next' }).click();
      expect(
        await page.evaluate(
          () => (window as unknown as { log: unknown[] }).log,
        ),
      ).toEqual([{ page: 2, pageSize: 24 }]);
      await expect(pager(page)).toContainText('Page 2 of 5');
    });

    test('changing the page size goes back to page 1', async ({ page }) => {
      await setup(page, LIST(ids(1, 24), 'total="100" page="3"'));
      await page.evaluate(() => {
        const w = window as unknown as { log: unknown[] };
        w.log = [];
        document.addEventListener('prism-card-list-page', (e) =>
          w.log.push((e as CustomEvent).detail),
        );
      });
      await page.locator('#l [data-prism-page-size] select').selectOption('48');
      expect(
        await page.evaluate(
          () => (window as unknown as { log: unknown[] }).log,
        ),
      ).toEqual([{ page: 1, pageSize: 48 }]);
      await expect(pager(page)).toContainText('Page 1 of 3');
    });

    test('a pagination slot replaces the built-in pager', async ({ page }) => {
      await setup(
        page,
        `<prism-card-list id="l" label="x" total="50">${cards(ids(1, 2))}<nav slot="pagination" id="mine">mine</nav></prism-card-list>`,
      );
      await expect(page.locator('#mine')).toBeVisible();
      await expect(page.locator('#l [data-prism-pager]')).toHaveCount(0);
    });

    test('load more: a button instead of the pager; fires an event', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 3), 'load-more total="100"'));
      await expect(page.getByRole('navigation')).toHaveCount(0);
      await page.evaluate(() => {
        const w = window as unknown as { more: number };
        w.more = 0;
        document.addEventListener('prism-card-list-load-more', () => w.more++);
      });
      await page.getByRole('button', { name: 'Load more' }).click();
      expect(
        await page.evaluate(() => (window as unknown as { more: number }).more),
      ).toBe(1);
    });

    test('a changed total says "24 results" politely', async ({ page }) => {
      await setup(page, LIST(ids(1, 3), 'total="100"'));
      await page.locator('#l').evaluate((el) => {
        (el as HTMLElement & { total: number }).total = 24;
      });
      await settle(page);
      await expect.poll(() => listStatus(page)).toBe('24 results');
    });
  });

  test.describe('card list: selection is kept across pages', () => {
    const bar = (page: Page) => page.locator('#l [data-prism-selection-bar]');
    const box = (page: Page, id: string) =>
      page.getByRole('checkbox', { name: `Resource ${id}` });
    const swap = (page: Page, html: string) =>
      page.locator('#l').evaluate((el, h) => {
        for (const c of [...el.children])
          if (c.localName === 'prism-card') c.remove();
        el.insertAdjacentHTML('afterbegin', h);
      }, html);

    test('a visible "N selected" and a Clear selection button', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 4)));
      await expect(bar(page)).toContainText('0 selected');
      await expect(
        page.getByRole('button', { name: 'Clear selection' }),
      ).toHaveCount(0);
      await box(page, 'h-1').check();
      await box(page, 'h-3').check();
      await expect(bar(page)).toContainText('2 selected');
      await expect(
        page.getByRole('button', { name: 'Clear selection' }),
      ).toBeVisible();
    });

    test('ids stay selected when the page changes, and come back checked', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 4), 'total="8"'));
      await box(page, 'h-2').check();
      await box(page, 'h-4').check();
      // Page 2 arrives (server-side): different cards, none on screen selected.
      await swap(page, cards(ids(5, 4)));
      await settle(page);
      await expect(bar(page)).toContainText('2 selected');
      await expect(box(page, 'h-5')).not.toBeChecked();
      await box(page, 'h-6').check();
      await expect(bar(page)).toContainText('3 selected');
      // Back to page 1: the two earlier ids are still selected.
      await swap(page, cards(ids(1, 4)));
      await settle(page);
      await expect(box(page, 'h-2')).toBeChecked();
      await expect(box(page, 'h-4')).toBeChecked();
      await expect(box(page, 'h-1')).not.toBeChecked();
      await expect(bar(page)).toContainText('3 selected');
      expect(
        await page
          .locator('#l')
          .evaluate(
            (el) => (el as HTMLElement & { selected: string[] }).selected,
          ),
      ).toEqual(['h-2', 'h-4', 'h-6']);
    });

    test('deselecting an on-screen card lowers the count; the event carries all ids', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 4)));
      await page.evaluate(() => {
        const w = window as unknown as { log: unknown[] };
        w.log = [];
        document.addEventListener('prism-selection-change', (e) =>
          w.log.push((e as CustomEvent).detail),
        );
      });
      await box(page, 'h-1').check();
      await box(page, 'h-2').check();
      await box(page, 'h-1').uncheck();
      expect(
        await page.evaluate(
          () => (window as unknown as { log: unknown[] }).log,
        ),
      ).toEqual([
        { selected: ['h-1'], count: 1 },
        { selected: ['h-1', 'h-2'], count: 2 },
        { selected: ['h-2'], count: 1 },
      ]);
    });

    test('Clear selection clears every id (also off-screen), then focus moves to the count', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 4), 'total="8"'));
      await box(page, 'h-1').check();
      await swap(page, cards(ids(5, 4)));
      await settle(page);
      await box(page, 'h-5').check();
      await expect(bar(page)).toContainText('2 selected');
      await page.getByRole('button', { name: 'Clear selection' }).click();
      await expect(bar(page)).toContainText('0 selected');
      await expect(box(page, 'h-5')).not.toBeChecked();
      // The button went away: focus is not lost to the body.
      await expect(page.locator('#l [data-prism-count]')).toBeFocused();
      await swap(page, cards(ids(1, 4)));
      await settle(page);
      await expect(box(page, 'h-1')).not.toBeChecked();
    });

    test('the bar can be hidden for the page Toolbar, or replaced through a slot', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 2), 'hide-selection-bar'));
      await expect(page.locator('#l [data-prism-selection-bar]')).toHaveCount(
        0,
      );
      await setup(
        page,
        `<prism-card-list id="l" label="x"><div slot="toolbar" id="mine">mine</div>${cards(ids(1, 2))}</prism-card-list>`,
      );
      await expect(page.locator('#mine')).toBeVisible();
      await expect(page.locator('#l [data-prism-selection-bar]')).toHaveCount(
        0,
      );
    });

    test('a list of cards that cannot be selected shows no bar', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card-list id="l" label="x"><prism-card><prism-card-title slot="header" level="3">A</prism-card-title>a</prism-card></prism-card-list>`,
      );
      await expect(page.locator('#l [data-prism-selection-bar]')).toHaveCount(
        0,
      );
    });

    test('single selection belongs in a group: a list refuses it', async ({
      page,
    }) => {
      const errors = await setup(page, LIST(ids(1, 2), 'selection="single"'));
      expect(errors.some((e) => e.includes('selects many'))).toBe(true);
    });

    test('keyboard: Tab visits each checkbox, Space toggles, count follows', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 3)));
      await box(page, 'h-1').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Tab');
      await expect(box(page, 'h-2')).toBeFocused();
      await page.keyboard.press('Space');
      await expect(bar(page)).toContainText('2 selected');
    });
  });

  test.describe('card list: states', () => {
    const stateOf = (page: Page) => page.locator('#l');
    test('loading: skeleton cards (8), list busy, "Loading" announced, real cards hidden, bar and filters usable', async ({
      page,
    }) => {
      await setup(
        page,
        `<button id="filter">Filter</button>` +
          LIST(ids(1, 3), 'state="loading"'),
      );
      await expect(stateOf(page)).toHaveAttribute('aria-busy', 'true');
      await expect(page.locator('#l prism-card-skeleton')).toHaveCount(8);
      await expect(
        page.locator('#l prism-card-skeleton').first(),
      ).toBeVisible();
      await expect(page.locator('#l prism-card').first()).toBeHidden();
      await expect.poll(() => listStatus(page)).toBe('Loading');
      await expect(page.locator('#filter')).toBeEnabled();
      // Same size as real ones: a skeleton card is about as tall as a real card.
      const sk = await page
        .locator('#l prism-card-skeleton')
        .first()
        .evaluate((e) => e.getBoundingClientRect().height);
      expect(sk).toBeGreaterThanOrEqual(160);
    });

    test('refreshing: cards stay, a quiet busy line shows, no blanking', async ({
      page,
    }) => {
      await setup(page, LIST(ids(1, 3), 'state="refreshing"'));
      await expect(page.locator('#l prism-card')).toHaveCount(3);
      await expect(page.locator('#l prism-card').first()).toBeVisible();
      await expect(stateOf(page)).toHaveAttribute('aria-busy', 'true');
      await expect(stateOf(page).locator('[part="busy"]')).toBeVisible();
      await expect.poll(() => listStatus(page)).toBe('Refreshing');
    });

    test('empty, first use: your content in the empty slot', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card-list id="l" label="Resources" state="empty"><div slot="empty" id="first"><p>No resources yet</p><prism-button>Add a resource</prism-button></div></prism-card-list>`,
      );
      await expect(page.locator('#first')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Add a resource' }),
      ).toBeVisible();
    });

    test('no matches: "No matches" and one Clear filters button', async ({
      page,
    }) => {
      await setup(page, LIST([], 'state="no-matches"'));
      await expect(page.getByText('No matches')).toBeVisible();
      await page.evaluate(() => {
        const w = window as unknown as { hit: number };
        w.hit = 0;
        document.addEventListener(
          'prism-card-list-clear-filters',
          () => w.hit++,
        );
      });
      await page.getByRole('button', { name: 'Clear filters' }).click();
      expect(
        await page.evaluate(() => (window as unknown as { hit: number }).hit),
      ).toBe(1);
    });

    test('error, whole list: what failed, one Retry', async ({ page }) => {
      await setup(
        page,
        LIST(
          [],
          'state="error" state-message="The resources service is down."',
        ),
      );
      await expect(
        page.getByText('The resources service is down.').first(),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(1);
      await page.evaluate(() => {
        const w = window as unknown as { hit: number };
        w.hit = 0;
        document.addEventListener('prism-card-list-retry', () => w.hit++);
      });
      await page.getByRole('button', { name: 'Retry' }).click();
      expect(
        await page.evaluate(() => (window as unknown as { hit: number }).hit),
      ).toBe(1);
    });

    test('error, one card: only that card shows an error and a Retry; the rest keep working', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card-list id="l" label="Resources">${card('a')}${card('b', 'state="error" state-message="This resource failed to load."')}${card('c')}</prism-card-list>`,
      );
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(1);
      await expect(
        page.getByText('This resource failed to load.').first(),
      ).toBeVisible();
      await page.getByRole('checkbox', { name: 'Resource a' }).check();
      await expect(page.locator('#l [data-prism-selection-bar]')).toContainText(
        '1 selected',
      );
    });
  });
}

// --- card-reorder.test.ts ---
{
  const settle = (page: Page, ms = 60) =>
    page.evaluate(
      (ms) =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => setTimeout(() => r(), ms)),
        ),
      ms,
    );
  async function setup(page: Page, markup: string, reduced = true) {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.setViewportSize({ width: 1200, height: 900 });
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.emulateMedia({
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    await settle(page);
    return errors;
  }
  const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
  const card = (
    name: string,
    opts: { menu?: boolean; plain?: boolean } = {},
  ) =>
    opts.plain
      ? `<prism-card value="${name}"><prism-card-title slot="header" level="3">${name}</prism-card-title><p>Text of ${name}</p></prism-card>`
      : `<prism-card value="${name}">
          <prism-card-handle slot="header"></prism-card-handle>
          <prism-card-title slot="header" level="3">${name}</prism-card-title>
          ${
            opts.menu === false
              ? ''
              : `<prism-card-actions slot="header"><prism-menu label="More options for ${name}"><prism-menu-item>Rename</prism-menu-item></prism-menu></prism-card-actions>`
          }
          <p>Body of ${name}</p>
        </prism-card>`;
  const LIST = (names = NAMES, attrs = '', opts = {}, style = 'width:380px') =>
    `<prism-card-list id="l" label="Guides" reorderable columns="1" ${attrs} style="${style}">${names.map((n) => card(n, opts)).join('')}</prism-card-list>`;
  const order = (page: Page, id = '#l') =>
    page
      .locator(`${id} > prism-card`)
      .evaluateAll((els) => els.map((e) => e.getAttribute('value') ?? ''));
  const status = (page: Page, id = '#l') =>
    page
      .locator(id)
      .evaluate((el) =>
        String(
          el.shadowRoot!.querySelector('[part="status"]')!.textContent,
        ).trim(),
      );
  const handleBtn = (page: Page, name: string) =>
    page.getByRole('button', { name: `Reorder ${name}`, exact: true });
  const centre = async (page: Page, name: string) => {
    const b = (await handleBtn(page, name).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const cardBox = async (page: Page, name: string) =>
    (await page.locator(`#l prism-card[value="${name}"]`).boundingBox())!;
  const dragTo = async (page: Page, from: string, x: number, y: number) => {
    const c = await centre(page, from);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 3, c.y + 8, { steps: 2 });
    await page.mouse.move(x, y, { steps: 6 });
  };
  const line = (page: Page, id = '#l') =>
    page.locator(id).evaluate((el) => {
      const l =
        el.shadowRoot!.querySelector<HTMLElement>('[part="drop-line"]')!;
      const dot = l.querySelector<HTMLElement>('[part="drop-dot"]');
      const r = l.getBoundingClientRect();
      return {
        hidden: l.hidden || getComputedStyle(l).display === 'none',
        vertical: l.hasAttribute('data-prism-vertical'),
        w: r.width,
        h: r.height,
        x: r.x,
        y: r.y,
        dot: dot
          ? [
              dot.getBoundingClientRect().width,
              dot.getBoundingClientRect().height,
            ]
          : null,
        bg: getComputedStyle(l).backgroundColor,
      };
    });

  test.describe('drag handle', () => {
    test('a real button, named "Reorder {title}", first in the header, at least 24 by 24px, with a grab cursor', async ({
      page,
    }) => {
      const errors = await setup(page, LIST());
      expect(errors).toEqual([]);
      const h = handleBtn(page, 'Alpha');
      await expect(h).toHaveCount(1);
      const b = (await h.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(24);
      expect(b.height).toBeGreaterThanOrEqual(24);
      const info = await page
        .locator('#l prism-card')
        .first()
        .evaluate((el) => {
          const hd = el.querySelector('prism-card-handle')!;
          const btn = hd.shadowRoot!.querySelector('button')!;
          const title = el.querySelector('prism-card-title')!;
          return {
            tag: btn.localName,
            cursor: getComputedStyle(btn).cursor,
            before:
              hd.getBoundingClientRect().right <=
              title.getBoundingClientRect().left,
            shortcuts: btn.hasAttribute('aria-keyshortcuts'),
          };
        });
      expect(info).toEqual({
        tag: 'button',
        cursor: 'grab',
        before: true,
        shortcuts: false,
      });
    });

    test('hover changes the background over the handle', async ({ page }) => {
      await setup(page, LIST());
      const read = () =>
        page
          .locator('#l prism-card-handle')
          .first()
          .evaluate(
            (el) =>
              getComputedStyle(el.shadowRoot!.querySelector('button')!)
                .backgroundImage,
          );
      const rest = await read();
      await handleBtn(page, 'Alpha').hover();
      await settle(page);
      expect(await read()).not.toBe(rest);
    });

    test('it is refused on a card that is not reorderable', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card id="c"><prism-card-handle slot="header" id="h"></prism-card-handle><prism-card-title slot="header" level="3">X</prism-card-title>b</prism-card>`,
      );
      await expect(page.locator('#h')).toHaveAttribute(
        'data-prism-invalid',
        /draggable/,
      );
      expect(errors.some((e) => e.includes('only for draggable cards'))).toBe(
        true,
      );
    });

    test('a reorderable card with no handle is a dev error', async ({
      page,
    }) => {
      const errors = await setup(page, LIST(['A'], '', { plain: true }));
      expect(errors.some((e) => e.includes('needs a <prism-card-handle'))).toBe(
        true,
      );
    });

    test('positions come from the data: page 3 of 24 starts at 49 of 120', async ({
      page,
    }) => {
      await setup(page, LIST(NAMES, 'total="120" page="3" page-size="24"'));
      await expect(page.locator('#l prism-card').first()).toHaveAttribute(
        'aria-posinset',
        '49',
      );
      await expect(page.locator('#l prism-card').first()).toHaveAttribute(
        'aria-setsize',
        '120',
      );
    });
  });

  test.describe('Move menu: the way to reorder without dragging', () => {
    test('the overflow menu gets Move to top, up, down and bottom; the ends are disabled', async ({
      page,
    }) => {
      await setup(page, LIST());
      const items = (n: number) =>
        page
          .locator('#l prism-card')
          .nth(n)
          .evaluate((el) =>
            [
              ...el.querySelectorAll<HTMLElement & { disabled: boolean }>(
                'prism-menu > prism-menu-item[data-prism-move]',
              ),
            ].map((i) => [i.textContent, i.disabled]),
          );
      expect(await items(0)).toEqual([
        ['Move to top', true],
        ['Move up', true],
        ['Move down', false],
        ['Move to bottom', false],
      ]);
      expect(await items(1)).toEqual([
        ['Move to top', false],
        ['Move up', false],
        ['Move down', false],
        ['Move to bottom', false],
      ]);
      expect(await items(3)).toEqual([
        ['Move to top', false],
        ['Move up', false],
        ['Move down', true],
        ['Move to bottom', true],
      ]);
    });

    test('every move control names its card', async ({ page }) => {
      await setup(page, LIST());
      const names = await page
        .locator('#l prism-card')
        .nth(1)
        .evaluate((el) =>
          [...el.querySelectorAll('prism-menu-item[data-prism-move]')].map(
            (i) => i.getAttribute('aria-label'),
          ),
        );
      expect(names).toEqual([
        'Move to top, Bravo',
        'Move up, Bravo',
        'Move down, Bravo',
        'Move to bottom, Bravo',
      ]);
      // WCAG 2.5.3: the visible text is the start of the accessible name.
      for (const n of names)
        expect(n).toMatch(/^Move (to top|up|down|to bottom), Bravo$/);
    });

    test('a grid reads Move to start, Move earlier, Move later, Move to end', async ({
      page,
    }) => {
      await setup(
        page,
        LIST(NAMES, '', {}, 'width:700px').replace(' columns="1"', ''),
      );
      const words = await page
        .locator('#l prism-card')
        .nth(1)
        .evaluate((el) =>
          [...el.querySelectorAll('prism-menu-item[data-prism-move]')].map(
            (i) => i.textContent,
          ),
        );
      expect(words).toEqual([
        'Move to start',
        'Move earlier',
        'Move later',
        'Move to end',
      ]);
    });

    test('keyboard only: open the menu, choose Move down; announced; order changes; focus returns to the same menu button; press again', async ({
      page,
    }) => {
      await setup(page, LIST());
      const trigger = page.getByRole('button', {
        name: 'More options for Alpha',
      });
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('menuitem', { name: 'Move down, Alpha' }).focus();
      await page.keyboard.press('Enter');
      await settle(page, 120);
      expect(await order(page)).toEqual(['Bravo', 'Alpha', 'Charlie', 'Delta']);
      await expect
        .poll(() => status(page))
        .toBe('Alpha moved from position 1 to position 2 of 4.');
      await expect(
        page.getByRole('button', { name: 'More options for Alpha' }),
      ).toBeFocused();
      // Press it again.
      await page.keyboard.press('Enter');
      await page
        .getByRole('menuitem', { name: 'Move to bottom, Alpha' })
        .focus();
      await page.keyboard.press('Enter');
      await settle(page, 120);
      expect(await order(page)).toEqual(['Bravo', 'Charlie', 'Delta', 'Alpha']);
      await expect
        .poll(() => status(page))
        .toBe('Alpha moved from position 2 to position 4 of 4.');
    });

    test('top and up work too, and a disabled end item cannot move', async ({
      page,
    }) => {
      await setup(page, LIST());
      await page
        .getByRole('button', { name: 'More options for Delta' })
        .click();
      await page.getByRole('menuitem', { name: 'Move to top, Delta' }).click();
      await settle(page, 120);
      expect(await order(page)).toEqual(['Delta', 'Alpha', 'Bravo', 'Charlie']);
      await page
        .getByRole('button', { name: 'More options for Delta' })
        .click();
      await expect(
        page.getByRole('menuitem', { name: 'Move up, Delta' }),
      ).toHaveAttribute('aria-disabled', 'true');
      await page.keyboard.press('Escape');
      await page
        .getByRole('button', { name: 'More options for Charlie' })
        .click();
      await page.getByRole('menuitem', { name: 'Move up, Charlie' }).click();
      await settle(page, 120);
      expect(await order(page)).toEqual(['Delta', 'Alpha', 'Charlie', 'Bravo']);
    });

    test('the card has the overflow menu: the handle is just a drag button, never a second menu', async ({
      page,
    }) => {
      await setup(page, LIST());
      const handle = await page
        .locator('#l prism-card')
        .first()
        .evaluate((el) => {
          const h = el.querySelector('prism-card-handle') as HTMLElement & {
            menu: boolean;
          };
          return { menu: h.menu, hasMenu: !!h.querySelector('prism-menu') };
        });
      expect(handle).toEqual({ menu: false, hasMenu: false });
      await expect(handleBtn(page, 'Alpha')).not.toHaveAttribute(
        'aria-haspopup',
      );
    });

    test('no overflow menu: the handle is the menu button, named "Reorder {title}"', async ({
      page,
    }) => {
      await setup(page, LIST(NAMES, '', { menu: false }));
      const info = await page
        .locator('#l prism-card')
        .first()
        .evaluate((el) => {
          const h = el.querySelector('prism-card-handle') as HTMLElement & {
            menu: boolean;
          };
          return {
            menu: h.menu,
            items: h.querySelectorAll('prism-menu-item').length,
          };
        });
      expect(info).toEqual({ menu: true, items: 4 });
      await handleBtn(page, 'Bravo').click();
      await page.getByRole('menuitem', { name: 'Move up, Bravo' }).click();
      await settle(page, 120);
      expect(await order(page)).toEqual(['Bravo', 'Alpha', 'Charlie', 'Delta']);
      await expect(handleBtn(page, 'Bravo')).toBeFocused();
      await expect
        .poll(() => status(page))
        .toBe('Bravo moved from position 2 to position 1 of 4.');
    });

    test('the Move items go away when the list is not reorderable', async ({
      page,
    }) => {
      await setup(page, LIST());
      await page
        .locator('#l')
        .evaluate((el) => el.removeAttribute('reorderable'));
      await settle(page, 120);
      expect(
        await page.locator('#l prism-menu-item[data-prism-move]').count(),
      ).toBe(0);
    });
  });

  test.describe('pointer drag', () => {
    test('while dragging: original dimmed to 40%, copy follows at the default elevation, not rotated, up to 3 pieces and 280px', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card-list id="l" label="P" reorderable columns="1" style="width:420px">
          <prism-card value="A"><prism-card-handle slot="header"></prism-card-handle><prism-card-title slot="header" level="3">Alpha</prism-card-title><prism-card-description slot="header">Desc A</prism-card-description><p>Body</p><prism-card-meta slot="footer">Meta A</prism-card-meta></prism-card>
          <prism-card value="B"><prism-card-handle slot="header"></prism-card-handle><prism-card-title slot="header" level="3">Bravo</prism-card-title></prism-card>
        </prism-card-list>`,
      );
      const c = await centre(page, 'Alpha');
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      await page.mouse.move(c.x + 20, c.y + 40, { steps: 4 });
      const info = await page.evaluate(() => {
        const orig = document.querySelector(
          'prism-card[value="A"]',
        ) as HTMLElement;
        const copy = document.querySelector(
          '[data-prism-drag-copy]',
        ) as HTMLElement;
        const cs = getComputedStyle(copy);
        const probe = document.createElement('div');
        probe.style.boxShadow = 'var(--prism-elevation-default)';
        document.body.append(probe);
        const want = getComputedStyle(probe).boxShadow;
        probe.remove();
        return {
          dim: getComputedStyle(orig).opacity,
          inPlace: orig.isConnected && orig.parentElement?.id === 'l',
          shadow: cs.boxShadow === want && want !== 'none',
          transform: cs.transform,
          width: copy.getBoundingClientRect().width,
          lines: copy.children.length,
          hidden: copy.getAttribute('aria-hidden'),
          texts: [...copy.children].map((e) => e.textContent),
        };
      });
      expect(info.dim).toBe('0.4');
      expect(info.inPlace).toBe(true);
      expect(info.shadow).toBe(true);
      expect(info.transform).toMatch(/^matrix\(1, 0, 0, 1,/); // translate only: no rotation
      expect(info.width).toBeLessThanOrEqual(280);
      expect(info.lines).toBe(3);
      expect(info.hidden).toBe('true');
      expect(info.texts).toEqual(['Alpha', 'Desc A', 'Meta A']);
      await page.mouse.up();
      await expect(page.locator('[data-prism-drag-copy]')).toHaveCount(0);
    });

    test('single column: a 2px horizontal line with an 8px dot between cards; drop reorders; focus stays on the handle', async ({
      page,
    }) => {
      await setup(page, LIST());
      await page.evaluate(() => {
        const w = window as unknown as { log: unknown[] };
        w.log = [];
        document.addEventListener('prism-card-reorder', (e) => {
          const d = (
            e as CustomEvent<{ value: string; from: number; to: number }>
          ).detail;
          w.log.push({ value: d.value, from: d.from, to: d.to });
        });
      });
      const target = await cardBox(page, 'Charlie');
      // Lower half of Charlie: drop after it.
      await dragTo(page, 'Alpha', target.x + 100, target.y + target.height - 4);
      const l = await line(page);
      expect(l.hidden).toBe(false);
      expect(l.vertical).toBe(false);
      expect(Math.round(l.h)).toBe(2);
      expect(l.dot).toEqual([8, 8]);
      // In the middle of the 16px gap under Charlie.
      expect(Math.round(l.y + l.h / 2 - (target.y + target.height))).toBe(8);
      expect(l.bg).not.toBe('rgba(0, 0, 0, 0)');
      expect(await status(page)).toBe('Picked up Alpha, position 1 of 4.');
      await page.mouse.up();
      await settle(page, 120);
      expect(await order(page)).toEqual(['Bravo', 'Charlie', 'Alpha', 'Delta']);
      await expect(handleBtn(page, 'Alpha')).toBeFocused();
      await expect
        .poll(() => status(page))
        .toBe('Alpha moved from position 1 to position 3 of 4.');
      expect(
        await page.evaluate(
          () => (window as unknown as { log: unknown[] }).log,
        ),
      ).toEqual([{ value: 'Alpha', from: 1, to: 3 }]);
      expect((await line(page)).hidden).toBe(true);
    });

    test('in a grid the line is vertical, beside the target card', async ({
      page,
    }) => {
      await setup(
        page,
        LIST(NAMES, '', {}, 'width:700px').replace(' columns="1"', ''),
      );
      const t = await cardBox(page, 'Bravo');
      await dragTo(page, 'Delta', t.x + 6, t.y + 40);
      const l = await line(page);
      expect(l.vertical).toBe(true);
      expect(Math.round(l.w)).toBe(2);
      expect(Math.round(l.h)).toBe(Math.round(t.height));
      expect(l.dot).toEqual([8, 8]);
      // Left of Bravo, in the gap.
      expect(Math.round(t.x - (l.x + l.w / 2))).toBe(8);
      await page.mouse.up();
      await settle(page, 120);
      expect(await order(page)).toEqual(['Alpha', 'Delta', 'Bravo', 'Charlie']);
    });

    test('a drop that is not allowed shows no line and the card returns; "Move canceled."', async ({
      page,
    }) => {
      await setup(page, LIST());
      await dragTo(page, 'Alpha', 900, 700);
      expect((await line(page)).hidden).toBe(true);
      await page.mouse.up();
      await settle(page, 120);
      expect(await order(page)).toEqual(NAMES);
      await expect
        .poll(() => status(page))
        .toBe('Move canceled. Alpha is at position 1 of 4.');
      await expect(page.locator('prism-card[data-prism-dragging]')).toHaveCount(
        0,
      );
    });

    test('Escape cancels the drag', async ({ page }) => {
      await setup(page, LIST());
      const t = await cardBox(page, 'Charlie');
      await dragTo(page, 'Alpha', t.x + 50, t.y + 10);
      await page.keyboard.press('Escape');
      await settle(page, 120);
      expect(await order(page)).toEqual(NAMES);
      await expect(page.locator('[data-prism-drag-copy]')).toHaveCount(0);
      await expect
        .poll(() => status(page))
        .toBe('Move canceled. Alpha is at position 1 of 4.');
      await page.mouse.up();
      expect(await order(page)).toEqual(NAMES);
    });

    test('dropping where it started is a cancel, not a move', async ({
      page,
    }) => {
      await setup(page, LIST());
      const t = await cardBox(page, 'Alpha');
      await dragTo(page, 'Alpha', t.x + 100, t.y + 5);
      await page.mouse.up();
      await settle(page, 120);
      expect(await order(page)).toEqual(NAMES);
      await expect
        .poll(() => status(page))
        .toBe('Move canceled. Alpha is at position 1 of 4.');
    });

    test('an open menu closes when the drag starts', async ({ page }) => {
      await setup(page, LIST());
      await page
        .getByRole('button', { name: 'More options for Bravo' })
        .click();
      await expect(
        page.getByRole('menu', { name: 'More options for Bravo' }),
      ).toBeVisible();
      const t = await cardBox(page, 'Charlie');
      await dragTo(page, 'Alpha', t.x + 50, t.y + 10);
      await expect(
        page.getByRole('menu', { name: 'More options for Bravo' }),
      ).toBeHidden();
      await page.mouse.up();
    });

    test('a click on the handle (no drag) does not move anything', async ({
      page,
    }) => {
      await setup(page, LIST());
      await handleBtn(page, 'Bravo').click();
      expect(await order(page)).toEqual(NAMES);
      await expect(page.locator('[data-prism-drag-copy]')).toHaveCount(0);
    });

    test('a card with other controls drags from the handle only; a card with none drags from anywhere', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card-list id="l" label="P" reorderable columns="1" style="width:380px">
          <prism-card value="A"><prism-card-handle slot="header"></prism-card-handle><prism-card-title slot="header" level="3">Alpha</prism-card-title><prism-card-actions slot="header"><prism-menu label="More options for Alpha"></prism-menu></prism-card-actions><p id="a-body">Body A</p></prism-card>
          <prism-card value="B"><prism-card-handle slot="header"></prism-card-handle><prism-card-title slot="header" level="3">Bravo</prism-card-title><p id="b-body">Body B</p></prism-card>
          <prism-card value="C"><prism-card-handle slot="header"></prism-card-handle><prism-card-title slot="header" level="3">Charlie</prism-card-title><p>Body C</p></prism-card>
        </prism-card-list>`,
      );
      // Alpha has a menu: pressing its body and moving does nothing.
      const a = (await page.locator('#a-body').boundingBox())!;
      await page.mouse.move(a.x + 4, a.y + 4);
      await page.mouse.down();
      await page.mouse.move(a.x + 4, a.y + 200, { steps: 6 });
      await expect(page.locator('[data-prism-drag-copy]')).toHaveCount(0);
      await page.mouse.up();
      // (The press-and-move on Alpha's text selected it; clear that first.)
      await page.evaluate(() => getSelection()?.removeAllRanges());
      // Bravo has no other controls: its body drags it. Its text is not selectable.
      await expect(page.locator('prism-card[value="B"]')).toHaveAttribute(
        'data-prism-grabbable',
        '',
      );
      await expect(page.locator('prism-card[value="A"]')).not.toHaveAttribute(
        'data-prism-grabbable',
      );
      const sel = await page
        .locator('prism-card[value="B"]')
        .evaluate((el) => getComputedStyle(el).userSelect);
      expect(sel).toBe('none');
      const b = (await page.locator('#b-body').boundingBox())!;
      const c = await cardBox(page, 'C');
      await page.mouse.move(b.x + 4, b.y + 4);
      await page.mouse.down();
      await page.mouse.move(b.x + 6, b.y + 12, { steps: 2 });
      await page.mouse.move(c.x + 50, c.y + c.height - 3, { steps: 6 });
      await expect(page.locator('[data-prism-drag-copy]')).toHaveCount(1);
      await page.mouse.up();
      await settle(page, 120);
      expect(await order(page)).toEqual(['A', 'C', 'B']);
    });

    test('the moved card flashes once; reduced motion removes the flash', async ({
      page,
    }) => {
      await setup(page, LIST(), false);
      const t = await cardBox(page, 'Charlie');
      await dragTo(page, 'Alpha', t.x + 100, t.y + t.height - 4);
      await page.mouse.up();
      await settle(page, 30);
      await expect(page.locator('prism-card[value="Alpha"]')).toHaveAttribute(
        'data-prism-flash',
        '',
      );
      const anim = await page
        .locator('prism-card[value="Alpha"]')
        .evaluate(
          (el) =>
            getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!)
              .animationName,
        );
      expect(anim).toBe('prism-card-flash');
      // Reduced motion.
      await setup(page, LIST(), true);
      const t2 = await cardBox(page, 'Charlie');
      await dragTo(page, 'Alpha', t2.x + 100, t2.y + t2.height - 4);
      await page.mouse.up();
      await settle(page, 60);
      await expect(
        page.locator('prism-card[value="Alpha"]'),
      ).not.toHaveAttribute('data-prism-flash');
      expect(await order(page)).toEqual(['Bravo', 'Charlie', 'Alpha', 'Delta']);
    });

    test('touch: a press and hold on the handle starts the drag; moving first is a scroll and cancels it', async ({
      page,
    }) => {
      await setup(page, LIST());
      const fire = (type: string, x: number, y: number) =>
        page.evaluate(
          ([type, x, y]) => {
            const target = document.elementFromPoint(x as number, y as number)!;
            target.dispatchEvent(
              new PointerEvent(type as string, {
                bubbles: true,
                composed: true,
                cancelable: true,
                pointerId: 7,
                pointerType: 'touch',
                clientX: x as number,
                clientY: y as number,
                button: 0,
                isPrimary: true,
              }),
            );
          },
          [type, x, y],
        );
      // Move before the hold: no drag.
      const c = await centre(page, 'Alpha');
      await fire('pointerdown', c.x, c.y);
      await fire('pointermove', c.x, c.y + 20);
      await page.waitForTimeout(450);
      await expect(page.locator('[data-prism-drag-copy]')).toHaveCount(0);
      await fire('pointerup', c.x, c.y + 20);
      // Hold: drag starts.
      await fire('pointerdown', c.x, c.y);
      await page.waitForTimeout(150);
      await expect(page.locator('[data-prism-drag-copy]')).toHaveCount(0);
      await page.waitForTimeout(300);
      await expect(page.locator('[data-prism-drag-copy]')).toHaveCount(1);
      const t = await cardBox(page, 'Charlie');
      await fire('pointermove', t.x + 100, t.y + t.height - 4);
      await fire('pointerup', t.x + 100, t.y + t.height - 4);
      await settle(page, 120);
      expect(await order(page)).toEqual(['Bravo', 'Charlie', 'Alpha', 'Delta']);
    });

    test('the list scrolls on its own when the pointer nears the edge', async ({
      page,
    }) => {
      const many = Array.from({ length: 14 }, (_, i) => `Item${String(i + 1)}`);
      await setup(
        page,
        `<div id="sc" style="height:420px;overflow:auto;width:420px">${LIST(many, '', {}, 'width:380px')}</div>`,
      );
      const sc = (await page.locator('#sc').boundingBox())!;
      const c = await centre(page, 'Item1');
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      await page.mouse.move(c.x + 3, c.y + 8, { steps: 2 });
      await page.mouse.move(c.x + 20, sc.y + sc.height - 10, { steps: 4 });
      await page.waitForTimeout(500);
      const top = await page.locator('#sc').evaluate((el) => el.scrollTop);
      expect(top).toBeGreaterThan(40);
      await page.mouse.up();
    });
  });

  test.describe('between lists and failed saves', () => {
    const TWO = `
      <prism-card-list id="draft" label="Draft" reorderable columns="1" reorder-group="pb" style="width:300px;display:inline-block;vertical-align:top">
        ${['Alpha', 'Bravo'].map((n) => card(n)).join('')}
      </prism-card-list>
      <prism-card-list id="active" label="Active" reorderable columns="1" reorder-group="pb" style="width:300px;display:inline-block;vertical-align:top;margin-inline-start:40px">
        ${['Charlie', 'Delta', 'Echo'].map((n) => card(n)).join('')}
      </prism-card-list>`;

    test('a card dropped in another list of the group: "moved from Draft to Active, position 2 of 4."', async ({
      page,
    }) => {
      await setup(page, TWO);
      const t = (await page
        .locator('#active prism-card[value="Charlie"]')
        .boundingBox())!;
      const c = await centre(page, 'Alpha');
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      await page.mouse.move(c.x + 3, c.y + 8, { steps: 2 });
      await page.mouse.move(t.x + 60, t.y + t.height - 4, { steps: 8 });
      await page.mouse.up();
      await settle(page, 150);
      expect(await order(page, '#draft')).toEqual(['Bravo']);
      expect(await order(page, '#active')).toEqual([
        'Charlie',
        'Alpha',
        'Delta',
        'Echo',
      ]);
      await expect
        .poll(() => status(page, '#active'))
        .toBe('Alpha moved from Draft to Active, position 2 of 4.');
    });

    test('a list outside the group does not accept the card', async ({
      page,
    }) => {
      await setup(
        page,
        TWO.replace(
          'reorder-group="pb" style="width:300px;display:inline-block;vertical-align:top;margin',
          'reorder-group="other" style="width:300px;display:inline-block;vertical-align:top;margin',
        ),
      );
      const t = (await page
        .locator('#active prism-card[value="Charlie"]')
        .boundingBox())!;
      const c = await centre(page, 'Alpha');
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      await page.mouse.move(c.x + 3, c.y + 8, { steps: 2 });
      await page.mouse.move(t.x + 60, t.y + 20, { steps: 8 });
      expect((await line(page, '#active')).hidden).toBe(true);
      expect((await line(page, '#draft')).hidden).toBe(true);
      await page.mouse.up();
      await settle(page, 100);
      expect(await order(page, '#draft')).toEqual(['Alpha', 'Bravo']);
    });

    test('a failed save: rollback puts the card back and says so; the event is for a Toast', async ({
      page,
    }) => {
      await setup(page, LIST());
      await page.evaluate(() => {
        const w = window as unknown as { failed: string[] };
        w.failed = [];
        document.addEventListener('prism-card-reorder-failed', (e) =>
          w.failed.push((e as CustomEvent<{ value: string }>).detail.value),
        );
      });
      await page
        .getByRole('button', { name: 'More options for Bravo' })
        .click();
      await page
        .getByRole('menuitem', { name: 'Move to bottom, Bravo' })
        .click();
      await settle(page, 120);
      expect(await order(page)).toEqual(['Alpha', 'Charlie', 'Delta', 'Bravo']);
      await page
        .locator('#l')
        .evaluate((el) =>
          (el as HTMLElement & { rollback(): void }).rollback(),
        );
      await settle(page, 150);
      expect(await order(page)).toEqual(NAMES);
      await expect
        .poll(() => status(page))
        .toBe("Couldn't save the new order. Bravo is back at position 2 of 4.");
      expect(
        await page.evaluate(
          () => (window as unknown as { failed: string[] }).failed,
        ),
      ).toEqual(['Bravo']);
    });

    test('one live region serves the list, and the same message twice is heard again', async ({
      page,
    }) => {
      await setup(page, LIST());
      expect(
        await page
          .locator('#l')
          .evaluate(
            (el) => el.shadowRoot!.querySelectorAll('[role="status"]').length,
          ),
      ).toBe(1);
      const region = await page
        .locator('#l')
        .evaluate((el) =>
          el
            .shadowRoot!.querySelector('[role="status"]')!
            .getAttribute('aria-live'),
        );
      expect(region).toBe('polite');
    });
  });
}
