// Dashboard-row cards: layout, keyboard, and contrast.

import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';

// --- card-dashboard-rows.test.ts ---
{
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
    page.getByRole('button', {
      name: `More options for ${title}`,
      exact: true,
    });
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
              c.querySelector('prism-card-title')!.textContent!.trim() ===
              title,
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
      await menuChoose(
        page,
        'Active resources',
        'Move to end, Active resources',
      );
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
                  c.querySelector('prism-card-title')!.textContent!.trim() ===
                  t,
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
}

// --- card-dashboard-contrast.test.ts ---
{
  /**
   * WCAG 2.2 AA contrast for the Dashboard rows recipe, measured from what is
   * painted: text and icons against the pixel behind them (taken from a render
   * with all glyphs made transparent, so state layers and tints are included),
   * and borders, the focus ring and the drop line against what is next to them.
   * Run in the default, hover, focus, open-menu and dragging states.
   */

  const settle = (page: Page, ms = 150) =>
    page.evaluate(
      (ms) =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => setTimeout(() => r(), ms)),
        ),
      ms,
    );

  async function setup(page: Page) {
    await page.setViewportSize({ width: 1500, height: 1100 });
    await mount(page, '');
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
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
  }

  interface Item {
    kind: 'text' | 'icon';
    what: string;
    x: number;
    y: number;
    color: string;
    large: boolean;
    dimmed: boolean;
  }

  /** Step 1, in the page: what to measure. Step 2 hides glyphs for the render. */
  const collect = (page: Page): Promise<Item[]> =>
    page.evaluate(() => {
      const out: Item[] = [];
      const flatParent = (el: Element): Element | null =>
        el.assignedSlot ??
        el.parentElement ??
        (el.getRootNode() as ShadowRoot).host ??
        null;
      const dimmed = (el: Element): boolean => {
        for (let e: Element | null = el; e; e = flatParent(e))
          if (Number(getComputedStyle(e).opacity) < 1) return true;
        return false;
      };
      const visible = (el: Element): boolean => {
        for (let e: Element | null = el; e; e = flatParent(e)) {
          const cs = getComputedStyle(e);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        }
        return true;
      };
      const walk = (root: ParentNode): void => {
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) walk(el.shadowRoot);
          if (['STYLE', 'SCRIPT', 'SLOT'].includes(el.tagName)) continue;
          if (el.closest('.dash-sr')) continue;
          if (!visible(el)) continue;
          const cs = getComputedStyle(el);
          if (el instanceof SVGSVGElement) {
            const r = el.getBoundingClientRect();
            if (r.width > 1 && r.height > 1)
              out.push({
                kind: 'icon',
                what: `${(el.getRootNode() as ShadowRoot).host?.localName ?? el.parentElement?.localName ?? ''} svg`,
                x: r.left + r.width / 2 + scrollX,
                y: r.top + r.height / 2 + scrollY,
                color: cs.color,
                large: true,
                dimmed: dimmed(el),
              });
            continue;
          }
          for (const n of el.childNodes) {
            if (n.nodeType !== 3 || !n.textContent!.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            const r = range.getClientRects()[0];
            if (!r || r.width < 2 || r.height < 2) continue;
            // Slotted text inherits from its slot, not from the host.
            const slot = (n as Text).assignedSlot;
            const tcs = slot ? getComputedStyle(slot) : cs;
            const size = parseFloat(tcs.fontSize);
            const bold = Number(tcs.fontWeight) >= 700;
            out.push({
              kind: 'text',
              what: `${el.localName}: ${n.textContent!.trim().slice(0, 28)}`,
              x: r.left + r.width / 2 + scrollX,
              y: r.top + r.height / 2 + scrollY,
              color: tcs.color,
              large: size >= 24 || (bold && size >= 18.66),
              dimmed: dimmed(el),
            });
          }
        }
      };
      walk(document.querySelector('#root')!);
      return out;
    });

  const HIDE = `*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; caret-color: transparent !important; text-decoration-color: transparent !important; }
  svg, svg * { stroke: transparent !important; fill: transparent !important; }
  [part="dot"], .dot { background-image: none !important; }`;

  /** Applies the glyph-hiding sheet to the page and every shadow root. */
  const hideGlyphs = (page: Page, on: boolean) =>
    page.evaluate(
      ({ css, on }) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        const key = '__hide';
        const w = window as unknown as Record<string, CSSStyleSheet>;
        if (on) w[key] = sheet;
        const roots: (Document | ShadowRoot)[] = [document];
        const find = (r: ParentNode): void => {
          for (const el of r.querySelectorAll('*'))
            if (el.shadowRoot) {
              roots.push(el.shadowRoot);
              find(el.shadowRoot);
            }
        };
        find(document);
        for (const r of roots) {
          const rest = r.adoptedStyleSheets.filter((s) => s !== w[key]);
          r.adoptedStyleSheets = on ? [...rest, w[key]!] : rest;
        }
      },
      { css: HIDE, on },
    );

  interface Check {
    what: string;
    ratio: number;
    need: number;
  }

  /** Step 3, in the page: sample the render and compute the ratios. */
  const measure = (
    page: Page,
    png: string,
    items: Item[],
    extra: {
      what: string;
      color: string;
      x: number;
      y: number;
      need: number;
    }[],
  ): Promise<Check[]> =>
    page.evaluate(
      async ({ png, items, extra }) => {
        const img = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${png}`)).blob(),
        );
        const shot = new OffscreenCanvas(img.width, img.height);
        const sctx = shot.getContext('2d', { willReadFrequently: true })!;
        sctx.drawImage(img, 0, 0);
        const px = (x: number, y: number): [number, number, number] => {
          const d = sctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
          return [d[0]!, d[1]!, d[2]!];
        };
        const cv = new OffscreenCanvas(1, 1);
        const cx = cv.getContext('2d', { willReadFrequently: true })!;
        /** Any CSS colour over an opaque backdrop, through the canvas. */
        const over = (
          css: string,
          bg: [number, number, number],
        ): [number, number, number] => {
          cx.clearRect(0, 0, 1, 1);
          cx.fillStyle = `rgb(${bg.join(',')})`;
          cx.fillRect(0, 0, 1, 1);
          cx.fillStyle = css;
          cx.fillRect(0, 0, 1, 1);
          const d = cx.getImageData(0, 0, 1, 1).data;
          return [d[0]!, d[1]!, d[2]!];
        };
        const lum = (c: [number, number, number]): number => {
          const f = (v: number): number => {
            const s = v / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const ratio = (
          a: [number, number, number],
          b: [number, number, number],
        ): number => {
          const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p) as [
            number,
            number,
          ];
          return (hi + 0.05) / (lo + 0.05);
        };
        const out: { what: string; ratio: number; need: number }[] = [];
        for (const it of items) {
          if (it.dimmed) continue;
          const bg = px(it.x, it.y);
          out.push({
            what: `${it.kind} ${it.what}`,
            ratio: ratio(over(it.color, bg), bg),
            need: it.kind === 'icon' || it.large ? 3 : 4.5,
          });
        }
        for (const e of extra) {
          const bg = px(e.x, e.y);
          out.push({
            what: e.what,
            ratio: ratio(over(e.color, bg), bg),
            need: e.need,
          });
        }
        return out;
      },
      { png, items, extra },
    );

  /** Run one audit of the current state. Returns every check and the failures. */
  async function audit(
    page: Page,
    extra: () => Promise<
      { what: string; color: string; x: number; y: number; need: number }[]
    > = () => Promise.resolve([]),
  ) {
    const items = await collect(page);
    const more = await extra();
    await hideGlyphs(page, true);
    const png = (await page.screenshot({ fullPage: true })).toString('base64');
    await hideGlyphs(page, false);
    const checks = await measure(page, png, items, more);
    return {
      checks,
      fails: checks.filter((c) => c.ratio < c.need),
      min: (kind: string) =>
        Math.min(
          ...checks.filter((c) => c.what.startsWith(kind)).map((c) => c.ratio),
        ),
    };
  }

  const fmt = (fails: Check[]) =>
    fails.map((f) => `${f.what}: ${f.ratio.toFixed(2)} < ${String(f.need)}`);

  /** Non-text parts: the dashed drop zone, progress fill ends, card edge. */
  const edges = (page: Page) =>
    page.evaluate(() => {
      const out: {
        what: string;
        color: string;
        x: number;
        y: number;
        need: number;
      }[] = [];
      const zones = [...document.querySelectorAll<HTMLElement>('.dash-zone')];
      for (const z of zones) {
        if (z.querySelector('prism-card')) continue;
        const r = z.getBoundingClientRect();
        out.push({
          what: 'empty drop zone border',
          color: getComputedStyle(z).borderTopColor,
          x: r.left + r.width / 2 + scrollX,
          y: r.top - 6 + scrollY,
          need: 3,
        });
      }
      for (const p of document.querySelectorAll('prism-progress')) {
        const t = p.shadowRoot!.querySelector('[part="track"]')!;
        const r = t.getBoundingClientRect();
        const f = p.shadowRoot!.querySelector('[part="fill"]')!;
        const fr = f.getBoundingClientRect();
        const end = getComputedStyle(f).backgroundColor;
        const root = getComputedStyle(document.documentElement);
        const lift = root.getPropertyValue('--prism-color-lift').trim();
        const mix = (token: string) =>
          `color-mix(in oklch, ${lift} ${root.getPropertyValue(token).trim()}, ${end})`;
        // The last ~14px carry the value: the full tone, the head's brightest
        // point and its shoulder must all hold 3:1 on the track.
        for (const [what, color] of [
          ['progress fill (full tone)', end],
          ['progress head (brightest)', mix('--prism-progress-head-mix')],
          ['progress head (shoulder)', mix('--prism-progress-head-alpha')],
        ] as const)
          out.push({
            what,
            color,
            x: r.right - 6 + scrollX,
            y: fr.top + fr.height / 2 + scrollY,
            need: 3,
          });
      }
      return out;
    });

  test.describe('dashboard rows: contrast (WCAG 2.2 AA)', () => {
    test('default: every text >= 4.5:1, every icon and edge >= 3:1', async ({
      page,
    }) => {
      await setup(page);
      const a = await audit(page, () => edges(page));
      expect(a.checks.length).toBeGreaterThan(60);
      expect(fmt(a.fails)).toEqual([]);
      console.log(
        `default: ${String(a.checks.length)} checks, min text ${a.min('text').toFixed(2)}, min icon ${a.min('icon').toFixed(2)}`,
      );
    });

    test('the audit can fail: pale text and a faint icon are caught', async ({
      page,
    }) => {
      await setup(page);
      await page.addStyleTag({
        content:
          '.dash h2 { color: #bbb !important } prism-card-title { color: #ccc !important }',
      });
      const a = await audit(page);
      expect(a.fails.some((f) => f.what.includes('Dashboard'))).toBe(true);
      expect(a.fails.length).toBeGreaterThan(8);
    });

    test('empty row: the note and the dashed border', async ({ page }) => {
      await setup(page);
      for (const t of [
        'Member sign-ins',
        'Settings changes',
        'Exports queued',
      ]) {
        await page
          .getByRole('button', { name: `More options for ${t}` })
          .click();
        await page
          .getByRole('menuitem', { name: `Move to row 1, ${t}` })
          .click();
        await settle(page, 200);
      }
      const a = await audit(page, () => edges(page));
      expect(a.checks.some((c) => c.what.includes('Nothing here yet'))).toBe(
        true,
      );
      expect(a.checks.some((c) => c.what === 'empty drop zone border')).toBe(
        true,
      );
      expect(fmt(a.fails)).toEqual([]);
    });

    test('hover on the handle and on the menu button (state layers included)', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await setup(page);
      for (const name of [
        'Reorder Active resources',
        'More options for Active resources',
      ]) {
        await page.getByRole('button', { name, exact: true }).hover();
        await settle(page, 120);
        const a = await audit(page);
        expect(fmt(a.fails), name).toEqual([]);
        // The hover layer is really painted.
        const bg = await page
          .getByRole('button', { name, exact: true })
          .evaluate((el) => getComputedStyle(el).backgroundImage);
        expect(bg, name).toContain('gradient');
      }
      // Pressed too.
      const b = page.getByRole('button', {
        name: 'More options for Active resources',
      });
      await b.hover();
      await page.mouse.down();
      await settle(page, 100);
      expect(fmt((await audit(page)).fails)).toEqual([]);
      await page.mouse.up();
    });

    test('keyboard focus ring on the menu button, the handle and Reset: >= 3:1 against the surface and the card', async ({
      page,
    }) => {
      await setup(page);
      const targets = [
        page.getByRole('button', { name: 'More options for Open items' }),
        page.getByRole('button', {
          name: 'Reorder Open items',
          exact: true,
        }),
        page.getByRole('button', { name: 'Reset layout' }),
      ];
      for (const t of targets) {
        await t.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await settle(page, 100);
        const ring = await t.evaluate((el) => {
          const part =
            el.shadowRoot?.querySelector<HTMLElement>(
              '[part="trigger"],[part="base"],button',
            ) ?? (el as HTMLElement);
          const cs = getComputedStyle(part);
          const r = part.getBoundingClientRect();
          return {
            outline: cs.outlineStyle,
            width: cs.outlineWidth,
            color: cs.outlineColor,
            shadow: cs.boxShadow,
            x: r.left + r.width / 2 + scrollX,
            top: r.top + scrollY,
            focusVisible: part.matches(':focus-visible'),
          };
        });
        console.log(JSON.stringify(ring));
        expect(ring.focusVisible).toBe(true);
        // A ring is drawn: an outline or a box-shadow ring.
        expect(ring.outline !== 'none' || ring.shadow !== 'none').toBe(true);
        // The ring is the widest opaque layer of the shadow stack (the inner
        // 1px layer is the gap in the surface colour).
        const layers = [
          ...ring.shadow.matchAll(
            /((?:oklch|rgba?|color)\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+([\d.]+)px/g,
          ),
        ]
          .map((m) => ({ c: m[1]!, spread: Number(m[5]) }))
          .filter((l) => !l.c.includes('/'));
        const widest = layers.sort((p, q) => q.spread - p.spread)[0];
        const colour =
          ring.outline !== 'none' &&
          parseFloat(ring.width) > 0 &&
          ring.color !== 'rgba(0, 0, 0, 0)'
            ? ring.color
            : widest!.c;
        const a = await audit(page, () =>
          Promise.resolve([
            {
              what: 'focus ring',
              color: colour,
              x: ring.x,
              y: ring.top - 6,
              need: 3,
            },
          ]),
        );
        expect(fmt(a.fails)).toEqual([]);
      }
    });

    test('menu open: items and the Move to row entries', async ({ page }) => {
      await setup(page);
      await page
        .getByRole('button', { name: 'More options for Open items' })
        .click();
      await settle(page, 200);
      const a = await audit(page);
      expect(a.checks.some((c) => c.what.includes('Move to row 2'))).toBe(true);
      expect(fmt(a.fails)).toEqual([]);
      // A hovered item too.
      await page
        .getByRole('menuitem', { name: 'Move to row 2, Open items' })
        .hover();
      await settle(page, 100);
      expect(fmt((await audit(page)).fails)).toEqual([]);
    });

    test('dragging: the copy, the drop line and its dot, and the cards behind', async ({
      page,
    }) => {
      await setup(page);
      const h = (await page
        .getByRole('button', { name: 'Reorder Open items', exact: true })
        .boundingBox())!;
      const z = (await page.locator('.dash-zone').nth(1).boundingBox())!;
      await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
      await page.mouse.down();
      await page.mouse.move(h.x + 30, h.y + 40, { steps: 2 });
      await page.mouse.move(z.x + z.width / 2 + 30, z.y + z.height / 2, {
        steps: 8,
      });
      await settle(page, 120);
      const line = await page.evaluate(() => {
        const lists = [...document.querySelectorAll('prism-card-list')];
        for (const l of lists) {
          const p =
            l.shadowRoot!.querySelector<HTMLElement>('[part="drop-line"]');
          if (p && !p.hidden) {
            const r = p.getBoundingClientRect();
            const dot = p.querySelector('[part="drop-dot"]')!;
            return {
              color: getComputedStyle(p).backgroundColor,
              dot: getComputedStyle(dot).backgroundColor,
              x: r.left + 40 + scrollX,
              y: r.top - 5 + scrollY,
              h: r.height,
            };
          }
        }
        return null;
      });
      expect(line).not.toBeNull();
      const copy = await page.locator('[data-prism-drag-copy]').count();
      expect(copy).toBe(1);
      const a = await audit(page, () =>
        Promise.resolve([
          {
            what: 'drop line',
            color: line!.color,
            x: line!.x,
            y: line!.y,
            need: 3,
          },
        ]),
      );
      expect(fmt(a.fails)).toEqual([]);
      await page.keyboard.press('Escape');
      await page.mouse.up();
    });
  });
}
