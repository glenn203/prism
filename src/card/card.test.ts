// Shared card: slots, layout, chrome tweaks, targets, and widget cards.

import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mount } from '../../test/fixture.js';

// --- card.test.ts ---
{
  interface Win {
    picked?: string;
    hit?: string;
    hits?: Record<string, boolean>;
  }

  const withTheme = async (page: Page) => {
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
  };
  const settle = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => setTimeout(() => r(), 30)),
        ),
    );
  /** Mounts themed markup and returns the dev errors logged while it settled. */
  async function setup(page: Page, markup: string, width?: number) {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await mount(page, markup);
    await withTheme(page);
    if (width) await page.addStyleTag({ content: `#root{width:${width}px}` });
    await settle(page);
    return errors;
  }
  const BASIC = `
    <prism-card id="c">
      <prism-card-title slot="header" level="3">Onboarding guide</prism-card-title>
      <prism-card-description slot="header">Owner: Design</prism-card-description>
      <p>Body text</p>
      <prism-card-meta slot="footer">Updated 2 min ago</prism-card-meta>
      <prism-card-actions slot="footer">
        <prism-button variant="ghost">Dismiss</prism-button>
        <prism-button variant="secondary">View all</prism-button>
      </prism-card-actions>
    </prism-card>`;
  const hidden = (page: Page, sel: string) =>
    page.locator(sel).evaluate((el) => getComputedStyle(el).display === 'none');
  const box = (page: Page, sel: string) =>
    page.locator(sel).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        r: r.right,
        b: r.bottom,
      };
    });

  test.describe('shared card: slots, name, heading', () => {
    test('three slots render; the title is a real heading and names the card', async ({
      page,
    }) => {
      const errors = await setup(page, BASIC);
      expect(errors).toEqual([]);
      await expect(
        page.getByRole('heading', { level: 3, name: 'Onboarding guide' }),
      ).toHaveCount(1);
      await expect(
        page.getByRole('group', { name: 'Onboarding guide' }),
      ).toHaveCount(1);
      await expect(page.getByText('Body text')).toBeVisible();
      await expect(page.getByText('Updated 2 min ago')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'View all' }),
      ).toBeVisible();
    });

    test('named slot "content" and the default slot both reach the content area', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card><prism-card-title slot="header" level="2">T</prism-card-title><p slot="content" id="a">A</p><p id="b">B</p></prism-card>`,
      );
      const inContent = await page.locator('prism-card').evaluate((el) => {
        const content = el.shadowRoot!.querySelector('[part="content"]')!;
        return [...content.querySelectorAll('slot')].flatMap((s) =>
          s.assignedElements().map((e) => e.id),
        );
      });
      expect(inContent.sort()).toEqual(['a', 'b']);
    });

    test('role: group standalone, none inside an li, listitem inside prism-card-list', async ({
      page,
    }) => {
      await setup(
        page,
        `<ul><li><prism-card id="in-li"><prism-card-title slot="header" level="3">One</prism-card-title></prism-card></li></ul>
         <prism-card id="solo"><prism-card-title slot="header" level="3">Two</prism-card-title></prism-card>`,
      );
      await expect(page.getByRole('group', { name: 'Two' })).toHaveCount(1);
      await expect(page.getByRole('group', { name: 'One' })).toHaveCount(0);
      await expect(page.getByRole('listitem')).toHaveCount(1);
    });

    test('the accessible name follows the title text', async ({ page }) => {
      await setup(page, BASIC);
      await page
        .locator('prism-card-title')
        .evaluate((el) => (el.textContent = 'Renamed'));
      await settle(page);
      await expect(page.getByRole('group', { name: 'Renamed' })).toHaveCount(1);
    });

    test('a card is never a landmark', async ({ page }) => {
      await setup(page, BASIC);
      expect(await page.locator('prism-card').getAttribute('role')).toBe(
        'group',
      );
      await expect(page.getByRole('region')).toHaveCount(0);
      await expect(page.getByRole('banner')).toHaveCount(0);
      await expect(page.getByRole('complementary')).toHaveCount(0);
    });

    test('title level is required: plain text and a dev error without it', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card><prism-card-title slot="header">No level</prism-card-title></prism-card>`,
      );
      await expect(page.getByRole('heading')).toHaveCount(0);
      expect(errors.some((e) => e.includes('needs `level`'))).toBe(true);
    });

    test('every level 2 to 6 renders that heading', async ({ page }) => {
      await setup(
        page,
        [2, 3, 4, 5, 6]
          .map(
            (n) =>
              `<prism-card><prism-card-title slot="header" level="${n}">H${n}</prism-card-title></prism-card>`,
          )
          .join(''),
      );
      for (const n of [2, 3, 4, 5, 6])
        await expect(
          page.getByRole('heading', { level: n, name: `H${n}` }),
        ).toHaveCount(1);
    });

    test('a header without a CardTitle logs an error but still renders', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card><prism-card-description slot="header">Only a description</prism-card-description></prism-card>`,
      );
      expect(errors.some((e) => e.includes('needs a CardTitle'))).toBe(true);
      await expect(page.getByText('Only a description')).toBeVisible();
    });

    test('title clamps at two lines and the component title style applies (14/20/600)', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card style="width:240px"><prism-card-title slot="header" level="3">${'Very long title '.repeat(
          12,
        )}</prism-card-title></prism-card>`,
      );
      const m = await page.locator('prism-card-title').evaluate((el) => {
        const text = el.shadowRoot!.querySelector('[part="text"]')!;
        const h = el.shadowRoot!.querySelector('[part="heading"]')!;
        const cs = getComputedStyle(h);
        return {
          height: text.getBoundingClientRect().height,
          clamp: getComputedStyle(text).webkitLineClamp,
          size: cs.fontSize,
          line: cs.lineHeight,
          weight: cs.fontWeight,
        };
      });
      expect(m.clamp).toBe('2');
      expect(m.height).toBe(40);
      expect([m.size, m.line, m.weight]).toEqual(['14px', '20px', '600']);
    });

    test('description clamps at two lines (12/20/400)', async ({ page }) => {
      await setup(
        page,
        `<prism-card style="width:240px"><prism-card-title slot="header" level="3">T</prism-card-title><prism-card-description slot="header">${'word '.repeat(
          60,
        )}</prism-card-description></prism-card>`,
      );
      const m = await page.locator('prism-card-description').evaluate((el) => {
        const text = el.shadowRoot!.querySelector('[part="text"]')!;
        const cs = getComputedStyle(el);
        return {
          h: text.getBoundingClientRect().height,
          size: cs.fontSize,
          line: cs.lineHeight,
          weight: cs.fontWeight,
        };
      });
      expect(m.h).toBe(40);
      expect([m.size, m.line, m.weight]).toEqual(['12px', '20px', '400']);
    });
  });

  test.describe('header and footer accept only approved parts', () => {
    test('an unapproved header element is hidden with a dev error', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card><prism-card-title slot="header" level="3">T</prism-card-title><div slot="header" id="stray">Stray</div></prism-card>`,
      );
      expect(await hidden(page, '#stray')).toBe(true);
      expect(
        errors.some((e) => e.includes('not an approved header part')),
      ).toBe(true);
      await expect(page.getByText('Stray')).toBeHidden();
    });

    test('one title, one description, one tag, one icon at most', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card><prism-card-title slot="header" level="3" id="t1">A</prism-card-title><prism-card-title slot="header" level="3" id="t2">B</prism-card-title>
          <prism-card-description slot="header" id="d1">x</prism-card-description><prism-card-description slot="header" id="d2">y</prism-card-description>
          <prism-tag slot="header" id="g1">One</prism-tag><prism-tag slot="header" id="g2">Two</prism-tag></prism-card>`,
      );
      expect(await hidden(page, '#t1')).toBe(false);
      for (const id of ['#t2', '#d2', '#g2'])
        expect(await hidden(page, id)).toBe(true);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    test('drag handle and selection control are refused until the card allows them', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card><prism-card-title slot="header" level="3">T</prism-card-title><prism-card-handle slot="header" id="h"></prism-card-handle><prism-card-select slot="header" id="s"></prism-card-select></prism-card>`,
      );
      expect(await hidden(page, '#h')).toBe(true);
      expect(await hidden(page, '#s')).toBe(true);
    });

    test('header actions: two ghost icon buttons are fine, a third and any text button are hidden', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card><prism-card-title slot="header" level="3">T</prism-card-title>
          <prism-card-actions slot="header">
            <prism-icon-button label="Refresh" id="i1">r</prism-icon-button>
            <prism-icon-button label="Export" id="i2">e</prism-icon-button>
            <prism-icon-button label="Third" id="i3">t</prism-icon-button>
            <prism-button id="txt" variant="ghost">Text</prism-button>
          </prism-card-actions></prism-card>`,
      );
      expect(await hidden(page, '#i1')).toBe(false);
      expect(await hidden(page, '#i2')).toBe(false);
      expect(await hidden(page, '#i3')).toBe(true);
      expect(await hidden(page, '#txt')).toBe(true);
      expect(
        errors.some((e) => e.includes('Text buttons are not allowed')),
      ).toBe(true);
    });

    test('header actions: one overflow menu is accepted', async ({ page }) => {
      const errors = await setup(
        page,
        `<prism-card><prism-card-title slot="header" level="3">Guide</prism-card-title>
          <prism-card-actions slot="header"><prism-menu label="More options for Guide"><prism-menu-item>Edit</prism-menu-item></prism-menu></prism-card-actions></prism-card>`,
      );
      expect(errors).toEqual([]);
      await expect(
        page.getByRole('button', { name: 'More options for Guide' }),
      ).toBeVisible();
    });

    test('footer: only meta and actions; a second primary, outline and destructive are hidden', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card><prism-card-title slot="header" level="3">T</prism-card-title>
          <div slot="footer" id="junk">junk</div>
          <prism-card-actions slot="footer">
            <prism-button variant="outline" id="o">Outline</prism-button>
            <prism-button variant="destructive" id="d">Delete</prism-button>
            <prism-button variant="ghost" id="g">Ghost</prism-button>
          </prism-card-actions></prism-card>`,
      );
      expect(await hidden(page, '#junk')).toBe(true);
      expect(await hidden(page, '#o')).toBe(true);
      expect(await hidden(page, '#d')).toBe(true);
      expect(await hidden(page, '#g')).toBe(false);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    test('footer: a primary button needs `standalone`, and only one is allowed', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card id="plain"><prism-card-title slot="header" level="3">A</prism-card-title>
          <prism-card-actions slot="footer"><prism-button id="p0">Go</prism-button></prism-card-actions></prism-card>
         <prism-card id="task" standalone><prism-card-title slot="header" level="3">B</prism-card-title>
          <prism-card-actions slot="footer"><prism-button id="p1">Go</prism-button><prism-button id="p2" variant="primary">Also</prism-button></prism-card-actions></prism-card>`,
      );
      expect(await hidden(page, '#p0')).toBe(true);
      expect(await hidden(page, '#p1')).toBe(false);
      expect(await hidden(page, '#p2')).toBe(true);
      // Toggling `standalone` re-checks the footer.
      await page
        .locator('#plain')
        .evaluate((el) => el.setAttribute('standalone', ''));
      await settle(page);
      expect(await hidden(page, '#p0')).toBe(false);
    });

    test('footer: at most two actions, a "View all" link counts as one', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card><prism-card-title slot="header" level="3">T</prism-card-title>
          <prism-card-actions slot="footer"><prism-button variant="ghost" id="a1">One</prism-button><a href="/all" id="a2">View all</a><prism-button variant="secondary" id="a3">Three</prism-button></prism-card-actions></prism-card>`,
      );
      expect(await hidden(page, '#a2')).toBe(false);
      expect(await hidden(page, '#a3')).toBe(true);
    });

    test('footer layout: meta at the start, actions at the end, medium buttons 8px apart', async ({
      page,
    }) => {
      await setup(page, BASIC, 480);
      const meta = await box(page, 'prism-card-meta');
      const a = await box(page, 'prism-card-actions');
      const card = await box(page, '#c');
      expect(meta.x).toBeLessThan(a.x);
      // Actions end flush with the card's inner edge: 16px padding + 1px border.
      expect(Math.round(card.r - a.r)).toBe(17);
      const [b1, b2] = await page
        .locator('prism-card-actions prism-button')
        .evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            return { x: r.x, r: r.right, h: r.height };
          }),
        );
      expect(Math.round(b2!.x - b1!.r)).toBe(8);
      expect(b1!.h).toBe(36);
      expect(b2!.h).toBe(36);
    });

    test('right-to-left mirrors the footer actions', async ({ page }) => {
      await setup(page, `<div dir="rtl">${BASIC}</div>`, 480);
      const meta = await box(page, 'prism-card-meta');
      const a = await box(page, 'prism-card-actions');
      expect(a.x).toBeLessThan(meta.x);
    });
  });

  test.describe('content-only card button row', () => {
    const ROW = `
      <prism-card id="c" style="width:360px"><p>A short promo message.</p>
        <prism-card-actions id="row">
          <prism-button variant="ghost" id="g">Dismiss</prism-button>
          <prism-button variant="secondary" id="s">Learn more</prism-button>
        </prism-card-actions></prism-card>`;

    test('buttons sit on the right, 8px apart, medium, soft rightmost', async ({
      page,
    }) => {
      const errors = await setup(page, ROW);
      expect(errors).toEqual([]);
      const g = await box(page, '#g');
      const s = await box(page, '#s');
      const card = await box(page, '#c');
      expect(Math.round(s.x - g.r)).toBe(8);
      expect(g.x).toBeLessThan(s.x);
      expect(Math.round(card.r - s.r)).toBe(17);
      expect(g.h).toBe(36);
      expect(await page.locator('#g').getAttribute('size')).toBe('md');
    });

    test('primary, outline and destructive are not allowed in the row', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card><p>Promo</p><prism-card-actions>
          <prism-button id="p">Primary</prism-button>
          <prism-button variant="outline" id="o">Outline</prism-button>
          <prism-button variant="destructive" id="d">Destroy</prism-button>
          <prism-button variant="ghost" id="g">Ghost</prism-button></prism-card-actions></prism-card>`,
      );
      for (const id of ['#p', '#o', '#d'])
        expect(await hidden(page, id)).toBe(true);
      expect(await hidden(page, '#g')).toBe(false);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    test('a wrong DOM order is reported, but soft still lands on the right', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card style="width:360px"><p>Promo</p><prism-card-actions>
          <prism-button variant="secondary" id="s">Soft</prism-button>
          <prism-button variant="ghost" id="g">Ghost</prism-button></prism-card-actions></prism-card>`,
      );
      expect(errors.some((e) => e.includes('ghost button before'))).toBe(true);
      const g = await box(page, '#g');
      const s = await box(page, '#s');
      expect(g.x).toBeLessThan(s.x);
    });

    test('the row wraps onto the next line on the end side and never truncates', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card style="width:200px"><p>Promo</p><prism-card-actions>
          <prism-button variant="ghost" id="g">Remind me later</prism-button>
          <prism-button variant="secondary" id="s">Learn more</prism-button></prism-card-actions></prism-card>`,
      );
      const g = await box(page, '#g');
      const s = await box(page, '#s');
      expect(s.y).toBeGreaterThan(g.y);
      const card = await box(page, 'prism-card');
      expect(Math.round(card.r - s.r)).toBe(17);
      expect(Math.round(card.r - g.r)).toBe(17);
    });

    test('the row sits at the bottom of cards in the same row', async ({
      page,
    }) => {
      await setup(
        page,
        `<div style="display:flex;gap:16px;align-items:stretch;width:760px">
          <prism-card style="flex:1"><p>Short</p><prism-card-actions><prism-button variant="ghost" id="a">A</prism-button></prism-card-actions></prism-card>
          <prism-card style="flex:1"><p>${'Long text. '.repeat(30)}</p><prism-card-actions><prism-button variant="ghost" id="b">B</prism-button></prism-card-actions></prism-card>
        </div>`,
      );
      const a = await box(page, '#a');
      const b = await box(page, '#b');
      expect(Math.round(a.b)).toBe(Math.round(b.b));
    });
  });

  test.describe('layout and elevation', () => {
    test('footers line up at the bottom of cards in a row', async ({
      page,
    }) => {
      await setup(
        page,
        `<div style="display:flex;gap:16px;align-items:stretch;width:760px">
          <prism-card style="flex:1"><prism-card-title slot="header" level="3">Short</prism-card-title><p>One line</p><prism-card-meta slot="footer" id="f1">Footer 1</prism-card-meta></prism-card>
          <prism-card style="flex:1"><prism-card-title slot="header" level="3">Tall</prism-card-title><p>${'More text. '.repeat(30)}</p><prism-card-meta slot="footer" id="f2">Footer 2</prism-card-meta></prism-card>
        </div>`,
      );
      const f1 = await box(page, '#f1');
      const f2 = await box(page, '#f2');
      expect(Math.round(f1.b)).toBe(Math.round(f2.b));
    });

    test('header: gap to the content is 12px; start items 8px apart; actions pinned top end; tag after the title', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card id="c" style="width:420px">
          <svg slot="header" data-prism-card-icon width="16" height="16" id="ic"></svg>
          <prism-card-title slot="header" level="3" id="t">Title</prism-card-title>
          <prism-tag slot="header" id="tag">Urgent</prism-tag>
          <prism-card-description slot="header" id="d">Desc</prism-card-description>
          <prism-card-actions slot="header" id="act"><prism-icon-button label="Refresh">r</prism-icon-button></prism-card-actions>
          <div id="body">Body</div></prism-card>`,
      );
      const ic = await box(page, '#ic');
      const t = await box(page, '#t');
      const tag = await box(page, '#tag');
      const d = await box(page, '#d');
      const act = await box(page, '#act');
      const body = await box(page, '#body');
      expect(Math.round(t.x - ic.r)).toBe(8);
      expect(tag.x).toBeGreaterThan(t.x);
      expect(Math.round(tag.x - t.r)).toBe(8);
      // The icon button is centred on the title's first line.
      expect(Math.round(act.y + act.h / 2)).toBe(Math.round(t.y + t.h / 2));
      expect(d.y).toBeGreaterThanOrEqual(t.b);
      const card = await box(page, '#c');
      expect(Math.round(card.r - act.r)).toBe(17);
      expect(Math.round(body.y - Math.max(d.b, act.b))).toBe(12);
    });

    test('padding follows density: 12 / 16 / 20px', async ({ page }) => {
      await setup(
        page,
        ['compact', 'default', 'comfortable']
          .map(
            (d) =>
              `<div data-prism-density="${d}"><prism-card id="${d}"><p>x</p></prism-card></div>`,
          )
          .join(''),
      );
      const pads = await Promise.all(
        ['compact', 'default', 'comfortable'].map((d) =>
          page
            .locator(`#${d}`)
            .evaluate(
              (el) =>
                getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!)
                  .paddingLeft,
            ),
        ),
      );
      expect(pads).toEqual(['12px', '16px', '20px']);
    });

    test('bordered: 1px border, no shadow. Raised: elevation-hover and a transparent border. Borderless: neither', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card id="b"><p>b</p></prism-card><prism-card id="r" raised><p>r</p></prism-card><prism-card id="f" type="borderless"><p>f</p></prism-card><prism-card id="rf" type="borderless" raised><p>rf</p></prism-card>`,
      );
      const read = (id: string) =>
        page.locator(`#${id}`).evaluate((el) => {
          const cs = getComputedStyle(
            el.shadowRoot!.querySelector('[part="base"]')!,
          );
          const probe = document.createElement('div');
          probe.style.boxShadow = 'var(--prism-elevation-hover)';
          document.body.append(probe);
          const hover = getComputedStyle(probe).boxShadow;
          probe.remove();
          return {
            border: cs.borderTopWidth,
            borderColor: cs.borderTopColor,
            shadow: cs.boxShadow,
            hover,
          };
        });
      const b = await read('b');
      const r = await read('r');
      const f = await read('f');
      const rf = await read('rf');
      expect(b.border).toBe('1px');
      expect(b.shadow).toBe('none');
      expect(r.shadow).toBe(r.hover);
      expect(r.shadow).not.toBe('none');
      expect(r.borderColor).toBe('rgba(0, 0, 0, 0)');
      expect(f.border).toBe('0px');
      expect(f.shadow).toBe('none');
      expect(rf.shadow).toBe('none'); // borderless never has a shadow
    });

    test('forced-colors: raised and bordered cards keep a visible edge', async ({
      page,
    }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await setup(page, `<prism-card id="r" raised><p>r</p></prism-card>`);
      const c = await page
        .locator('#r')
        .evaluate(
          (el) =>
            getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!)
              .borderTopColor,
        );
      expect(c).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('hover is the tint only: no lift, no transform, no shadow change', async ({
      page,
    }) => {
      await setup(page, BASIC);
      const read = () =>
        page.locator('#c').evaluate((el) => {
          const base = el.shadowRoot!.querySelector('[part="base"]')!;
          const cs = getComputedStyle(base);
          const r = el.getBoundingClientRect();
          return {
            transform: cs.transform,
            shadow: cs.boxShadow,
            top: r.top,
            translate: cs.translate,
          };
        });
      const before = await read();
      await page.locator('#c').hover();
      await settle(page);
      expect(await read()).toEqual(before);
      expect(before.transform).toBe('none');
    });

    test('theme never uses the urgent elevation or hover transforms on cards', () => {
      const css = readFileSync('src/theme/theme.css', 'utf8');
      const card = css.slice(css.indexOf('/* ---------- Card'));
      expect(card).not.toMatch(/elevation-urgent/);
      expect(card).not.toMatch(/translate|transform/);
      const src = readFileSync('src/card/card.ts', 'utf8');
      expect(src).not.toMatch(/elevation-urgent|transform:/);
    });

    test('a card never sets its own margin', async ({ page }) => {
      await setup(page, BASIC);
      const m = await page.locator('#c').evaluate((el) => {
        const cs = getComputedStyle(el);
        return [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft];
      });
      expect(m).toEqual(['0px', '0px', '0px', '0px']);
    });
  });

  test.describe('narrow card (†)', () => {
    const NARROW = (w: number) => `
      <prism-card id="c" style="width:${w}px">
        <prism-card-title slot="header" level="3">Guide</prism-card-title>
        <prism-card-actions slot="header">
          <prism-icon-button label="Refresh Guide" id="i1">r</prism-icon-button>
          <prism-icon-button label="Export Guide" id="i2">e</prism-icon-button>
        </prism-card-actions>
        <p>Body</p>
        <prism-card-meta slot="footer">Updated</prism-card-meta>
        <prism-card-actions slot="footer"><prism-button variant="ghost">View all</prism-button></prism-card-actions>
      </prism-card>`;

    test('at 280px or less: state(narrow), icon buttons fold into one overflow menu, footer stacks', async ({
      page,
    }) => {
      await setup(page, NARROW(280));
      expect(
        await page.locator('#c').evaluate((el) => el.matches(':state(narrow)')),
      ).toBe(true);
      await expect(page.locator('#i1')).toBeHidden();
      const menu = page.getByRole('button', {
        name: 'More options for Guide',
      });
      await expect(menu).toBeVisible();
      await menu.click();
      await expect(
        page.getByRole('menuitem', { name: 'Refresh' }),
      ).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: 'Export' }),
      ).toBeVisible();
      const meta = await box(page, 'prism-card-meta');
      const act = await box(page, 'prism-card-actions[slot=footer]');
      expect(act.y).toBeGreaterThan(meta.y);
    });

    test('a folded menu item runs the original button', async ({ page }) => {
      await setup(page, NARROW(260));
      await page
        .locator('#i1')
        .evaluate((el) =>
          el.addEventListener(
            'click',
            () => ((window as unknown as Win).hit = 'refresh'),
          ),
        );
      await page
        .getByRole('button', { name: 'More options for Guide' })
        .click();
      await page.getByRole('menuitem', { name: 'Refresh' }).click();
      expect(await page.evaluate(() => (window as unknown as Win).hit)).toBe(
        'refresh',
      );
    });

    test('wider than 280px: nothing folds', async ({ page }) => {
      await setup(page, NARROW(400));
      expect(
        await page.locator('#c').evaluate((el) => el.matches(':state(narrow)')),
      ).toBe(false);
      await expect(page.locator('#i1')).toBeVisible();
    });

    test('reflows at 320px wide with no sideways scroll', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await setup(page, NARROW(300));
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  });
}

// --- card-tweaks.test.ts ---
{
  const settle = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => setTimeout(() => r(), 80)),
        ),
    );
  async function setup(page: Page, markup: string, width = 1000) {
    await page.setViewportSize({ width, height: 800 });
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settle(page);
  }

  /** Heights and widths of every control target found inside `#root`. */
  const targets = (page: Page) =>
    page.evaluate(() => {
      const out: Record<
        string,
        { w: number; h: number; size: string | null }[]
      > = {};
      const add = (key: string, el: Element, size: string | null) => {
        const r = el.getBoundingClientRect();
        (out[key] ??= []).push({ w: r.width, h: r.height, size });
      };
      const walk = (root: ParentNode) => {
        for (const el of root.querySelectorAll('prism-icon-button'))
          add(
            el.parentElement?.localName === 'prism-menu' ||
              (el.getRootNode() as ShadowRoot).host?.localName === 'prism-menu'
              ? 'menu-trigger'
              : 'icon-button',
            el,
            el.getAttribute('size'),
          );
        for (const el of root.querySelectorAll('*'))
          if (el.shadowRoot) walk(el.shadowRoot);
      };
      walk(document.querySelector('#root')!);
      return out;
    });

  const HEADER_CARD = (id = 'c', width = 420) => `
    <prism-card id="${id}" style="width:${width}px">
      <prism-card-title slot="header" level="3">Resource lumen-board-01</prism-card-title>
      <prism-card-actions slot="header" id="${id}-act">
        <prism-icon-button label="Refresh Resource lumen-board-01">R</prism-icon-button>
        <prism-icon-button label="Export Resource lumen-board-01">E</prism-icon-button>
      </prism-card-actions>
      <p>Body</p>
    </prism-card>`;

  test.describe('widget error Retry', () => {
    test('is a soft (secondary) button, small', async ({ page }) => {
      await setup(
        page,
        `<prism-card id="w" type="widget" state="error" state-message="Timed out." style="width:360px">
          <prism-card-title slot="header" level="3">Items</prism-card-title>
          <prism-card-metric label="Items">1</prism-card-metric>
        </prism-card>`,
      );
      const retry = page.getByRole('button', { name: 'Retry' });
      await expect(retry).toHaveCount(1);
      const btn = page.locator('#w prism-button');
      await expect(btn).toHaveAttribute('variant', 'secondary');
      await expect(btn).toHaveAttribute('size', 'sm');
      // Painted as the soft variant: a tinted fill, no border.
      const paint = await btn.evaluate((el) => {
        const cs = getComputedStyle(
          el.shadowRoot!.querySelector('[part="base"]')!,
        );
        return {
          border: cs.borderTopColor,
          fill: cs.backgroundColor,
          h: el.getBoundingClientRect().height,
        };
      });
      expect(paint.border).toBe('rgba(0, 0, 0, 0)');
      expect(paint.fill).not.toBe('rgba(0, 0, 0, 0)');
      expect(paint.h).toBeGreaterThanOrEqual(24);
      // No dev error: the guard does not touch the generated control.
      await expect(page.locator('#w')).not.toHaveAttribute(
        'data-prism-invalid',
      );
      expect(
        await page
          .locator('#w')
          .evaluate((el) => el.matches(':state(invalid)')),
      ).toBe(false);
    });

    test('outline is still refused in a footer', async ({ page }) => {
      await setup(
        page,
        `<prism-card id="c"><p>x</p><prism-card-meta slot="footer">m</prism-card-meta>
          <prism-card-actions slot="footer"><prism-button variant="outline" id="o">Out</prism-button></prism-card-actions></prism-card>`,
      );
      await expect(page.locator('#o')).toHaveAttribute(
        'data-prism-invalid',
        /outline button is not allowed/,
      );
    });
  });

  test.describe('widget footer View all', () => {
    const FOOT = (type: string) => `
      <prism-card id="c" ${type} style="width:360px">
        <prism-card-title slot="header" level="3">Items</prism-card-title>
        <p>Body</p>
        <prism-card-meta slot="footer">Updated 2 min ago</prism-card-meta>
        <prism-card-actions slot="footer"><prism-button id="v" variant="ghost">View all</prism-button></prism-card-actions>
      </prism-card>`;

    test('is ghost and small in a widget footer, and the guard allows it', async ({
      page,
    }) => {
      await setup(page, FOOT('type="widget"'));
      const v = page.locator('#v');
      await expect(v).toHaveAttribute('variant', 'ghost');
      await expect(v).toHaveAttribute('size', 'sm');
      await expect(v).not.toHaveAttribute('data-prism-invalid');
      const h = await v.evaluate((el) => el.getBoundingClientRect().height);
      expect(h).toBeGreaterThanOrEqual(24);
      expect(h).toBeLessThan(40);
    });

    test('other card footers stay medium', async ({ page }) => {
      await setup(page, FOOT(''));
      await expect(page.locator('#v')).toHaveAttribute('size', 'md');
    });

    test('a widget footer still refuses outline', async ({ page }) => {
      await setup(
        page,
        FOOT('type="widget"').replace('variant="ghost"', 'variant="outline"'),
      );
      await expect(page.locator('#v')).toHaveAttribute(
        'data-prism-invalid',
        /outline button is not allowed/,
      );
    });
  });

  test.describe('header actions', () => {
    test('icon buttons are 8px apart', async ({ page }) => {
      await setup(page, HEADER_CARD());
      const gap = await page.evaluate(() => {
        const [a, b] = [
          ...document.querySelectorAll('#c prism-icon-button'),
        ].map((e) => e.getBoundingClientRect()) as [DOMRect, DOMRect];
        return b.left - a.right;
      });
      expect(Math.round(gap)).toBe(8);
      expect(
        await page
          .locator('#c-act')
          .evaluate((el) => getComputedStyle(el).columnGap),
      ).toBe('8px');
    });

    test('an icon button beside a menu trigger is 8px apart too', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card id="c" type="widget" style="width:420px">
          <prism-card-title slot="header" level="3">Items</prism-card-title>
          <prism-card-actions slot="header">
            <prism-icon-button label="Refresh Items">R</prism-icon-button>
            <prism-menu label="More options for Items"><prism-menu-item>Configure</prism-menu-item></prism-menu>
          </prism-card-actions>
          <prism-card-metric label="Items">1</prism-card-metric>
        </prism-card>`,
      );
      const gap = await page.evaluate(() => {
        const a = document
          .querySelector('#c prism-icon-button')!
          .getBoundingClientRect();
        const b = document
          .querySelector('#c prism-menu')!
          .getBoundingClientRect();
        return b.left - a.right;
      });
      expect(Math.round(gap)).toBe(8);
    });
  });

  test.describe('icon buttons inside a card are small', () => {
    test('header buttons, a menu trigger and the folded overflow menu are size sm', async ({
      page,
    }) => {
      await setup(
        page,
        HEADER_CARD('a') +
          `<prism-card id="b" style="width:420px">
            <prism-card-title slot="header" level="3">Other</prism-card-title>
            <prism-card-actions slot="header"><prism-menu label="More options for Other"><prism-menu-item>One</prism-menu-item></prism-menu></prism-card-actions>
            <p>x</p></prism-card>` +
          HEADER_CARD('narrow', 260),
      );
      // size is set by the card, not written by the author
      for (const sel of [
        '#a prism-icon-button',
        '#b prism-menu',
        '#narrow prism-menu',
      ])
        for (const el of await page.locator(sel).all())
          await expect(el).toHaveAttribute('size', 'sm');
      const t = await targets(page);
      for (const k of Object.keys(t))
        // The folded header buttons are display:none in the narrow card.
        for (const e of t[k]!.filter((x) => x.w > 0)) {
          expect(e.size).toBe('sm');
          expect(e.w).toBeGreaterThanOrEqual(24);
          expect(e.h).toBeGreaterThanOrEqual(24);
        }
      expect(t['menu-trigger']?.length).toBeGreaterThanOrEqual(2);
    });

    test('the handle used as the menu button is small too', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card-list id="l" label="Guides" reorderable columns="1" style="width:420px">
          <prism-card value="a"><prism-card-handle slot="header"></prism-card-handle>
            <prism-card-title slot="header" level="3">Alpha</prism-card-title><p>x</p></prism-card>
          <prism-card value="b"><prism-card-handle slot="header"></prism-card-handle>
            <prism-card-title slot="header" level="3">Bravo</prism-card-title><p>x</p></prism-card>
        </prism-card-list>`,
      );
      const t = await targets(page);
      expect(t['menu-trigger']?.length).toBe(2);
      for (const e of t['menu-trigger']!) {
        expect(e.size).toBe('sm');
        expect(e.w).toBeGreaterThanOrEqual(24);
        expect(e.h).toBeGreaterThanOrEqual(24);
      }
    });

    test('small stays at or above 24px in every density: 24 / 32 / 40', async ({
      page,
    }) => {
      await setup(
        page,
        ['compact', 'default', 'comfortable']
          .map(
            (d) =>
              `<div data-prism-density="${d}" id="d-${d}">${HEADER_CARD(d)}</div>`,
          )
          .join(''),
      );
      const sizes = await page.evaluate(() =>
        ['compact', 'default', 'comfortable'].map((d) => {
          const r = document
            .querySelector(`#${d} prism-icon-button`)!
            .getBoundingClientRect();
          return [Math.round(r.width), Math.round(r.height)];
        }),
      );
      expect(sizes).toEqual([
        [24, 24],
        [32, 32],
        [40, 40],
      ]);
    });

    test('the button is centred on the title line, and a late button is resized', async ({
      page,
    }) => {
      await setup(page, HEADER_CARD());
      const off = await page.evaluate(() => {
        const t = document
          .querySelector('#c prism-card-title')!
          .getBoundingClientRect();
        const b = document
          .querySelector('#c prism-icon-button')!
          .getBoundingClientRect();
        return Math.abs(b.top + b.height / 2 - (t.top + t.height / 2));
      });
      expect(off).toBeLessThanOrEqual(1);
      await page.evaluate(() => {
        const b = document.createElement('prism-icon-button');
        b.setAttribute('label', 'Added later');
        b.id = 'late';
        document.querySelector('#c p')!.after(b);
      });
      await settle(page);
      await expect(page.locator('#late')).toHaveAttribute('size', 'sm');
    });
  });

  test.describe('card list: list role on an inner wrapper', () => {
    const LIST = (attrs = '') => `
      <prism-card-list id="l" label="Resources" ${attrs} style="width:900px">
        ${['a', 'b', 'c']
          .map(
            (
              v,
            ) => `<prism-card type="selectable" kind="collection" value="${v}">
              <prism-card-select slot="header"></prism-card-select>
              <prism-card-title slot="header" level="3">Resource ${v}</prism-card-title><p>x</p></prism-card>`,
          )
          .join('')}
      </prism-card-list>`;

    test('the card list has no role; the wrapper is the named list around the cards', async ({
      page,
    }) => {
      await setup(page, LIST('total="30" page-size="12"'));
      const r = await page.locator('#l').evaluate((el) => {
        const list = el.shadowRoot!.querySelector('[role="list"]')!;
        const slot = list.querySelector('slot')!;
        return {
          hostRole: el.getAttribute('role'),
          hostLabel: el.getAttribute('aria-label'),
          listLabel: list.getAttribute('aria-label'),
          lists: el.shadowRoot!.querySelectorAll('[role="list"]').length,
          assigned: slot.assignedElements().length,
          statusInList: !!list.querySelector('[role="status"]'),
          pagerInList:
            !!list.closest('[part="pager"]') || !!list.querySelector('nav'),
          toolbarInList: !!list.querySelector('[part="toolbar"]'),
          status: el.shadowRoot!.querySelector('[role="status"]') !== null,
          pager: el.shadowRoot!.querySelector('[part="pager"]') !== null,
        };
      });
      expect(r.hostRole).toBeNull();
      expect(r.hostLabel).toBeNull();
      expect(r.listLabel).toBe('Resources');
      expect(r.lists).toBe(1);
      expect(r.assigned).toBe(3);
      expect(r.statusInList).toBe(false);
      expect(r.pagerInList).toBe(false);
      expect(r.toolbarInList).toBe(false);
      expect(r.status).toBe(true);
      expect(r.pager).toBe(true);
      await expect(page.getByRole('list', { name: 'Resources' })).toHaveCount(
        1,
      );
      await expect(page.getByRole('listitem')).toHaveCount(3);
    });

    test('position and size stay on the list items, from the data', async ({
      page,
    }) => {
      await setup(page, LIST('total="30" page-size="12" page="2"'));
      const pos = await page.evaluate(() =>
        [...document.querySelectorAll('#l prism-card')].map((c) => [
          c.getAttribute('role'),
          c.getAttribute('aria-posinset'),
          c.getAttribute('aria-setsize'),
        ]),
      );
      expect(pos).toEqual([
        ['listitem', '13', '30'],
        ['listitem', '14', '30'],
        ['listitem', '15', '30'],
      ]);
    });

    test('loading, empty and error states are not a list', async ({ page }) => {
      await setup(
        page,
        `<prism-card-list id="a" label="Loading" state="loading" skeleton-count="2"></prism-card-list>
         <prism-card-list id="b" label="Empty" state="empty"></prism-card-list>
         <prism-card-list id="c" label="Broken" state="error"></prism-card-list>`,
      );
      for (const id of ['a', 'b', 'c'])
        expect(
          await page
            .locator(`#${id}`)
            .evaluate(
              (el) => el.shadowRoot!.querySelectorAll('[role="list"]').length,
            ),
        ).toBe(0);
    });
  });

  test('a card in the list empty slot is a group, not a list item without a list', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-card-list id="l" label="Saved" state="empty">
        <prism-card id="e" slot="empty"><h3>Nothing</h3><p>Add one.</p></prism-card>
      </prism-card-list>`,
    );
    await expect(page.locator('#e')).toHaveAttribute('role', 'group');
  });
}

// --- card-targets.test.ts ---
{
  const settle = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => setTimeout(() => r(), 60)),
        ),
    );

  async function setup(page: Page, markup: string) {
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settle(page);
  }

  const sizeOf = (page: Page, selector: string, part?: string) =>
    page.locator(selector).evaluate((el, part) => {
      const target = part
        ? el.shadowRoot!.querySelector<HTMLElement>(`[part="${part}"]`)
        : el;
      const r = target!.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }, part);

  test('collapsible title toggle is at least 24 by 24px', async ({ page }) => {
    await setup(
      page,
      `<prism-card type="collapsible" style="width:360px">
        <prism-card-title slot="header" level="3">Lens schedule</prism-card-title>
        <p>Closed content.</p>
      </prism-card>`,
    );
    const box = await sizeOf(page, 'prism-card-title', 'toggle');
    expect(box.w).toBeGreaterThanOrEqual(24);
    expect(box.h).toBeGreaterThanOrEqual(24);
  });

  test('unstretched collection title link is at least 24 by 24px', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-card type="selectable" kind="collection" style="width:360px">
        <prism-card-title slot="header" level="3" href="#prism">Prism filter</prism-card-title>
      </prism-card>`,
    );
    const title = page.locator('prism-card-title');
    expect(await title.getAttribute('stretch')).toBeNull();
    const box = await sizeOf(page, 'prism-card-title', 'link');
    expect(box.w).toBeGreaterThanOrEqual(24);
    expect(box.h).toBeGreaterThanOrEqual(24);
  });

  test('stretched clickable title uses the card as the target', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-card id="c" type="clickable" style="width:360px">
        <prism-card-title slot="header" level="3" href="#prism">Onboarding guide</prism-card-title>
      </prism-card>`,
    );
    const title = page.locator('prism-card-title');
    await expect(title).toHaveAttribute('stretch', '');
    const sizes = await page.evaluate(() => {
      const card = document.querySelector('#c')!;
      const link = card
        .querySelector('prism-card-title')!
        .shadowRoot!.querySelector('[part="link"]')!;
      const cr = card.getBoundingClientRect();
      const after = getComputedStyle(link, '::after');
      return {
        cardW: cr.width,
        cardH: cr.height,
        pos: after.position,
        top: after.top,
        right: after.right,
        bottom: after.bottom,
        left: after.left,
      };
    });
    expect(sizes.cardW).toBeGreaterThanOrEqual(24);
    expect(sizes.cardH).toBeGreaterThanOrEqual(24);
    expect(sizes.pos).toBe('absolute');
    expect(sizes.top).toBe('0px');
    expect(sizes.right).toBe('0px');
    expect(sizes.bottom).toBe('0px');
    expect(sizes.left).toBe('0px');
  });

  test('page-size select is at least 24 by 24px at default density', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-card-list id="l" label="Resources" total="48" page-size="24" style="width:640px">
        <prism-card type="selectable" kind="collection" value="a">
          <prism-card-title slot="header" level="3">Resource a</prism-card-title>
        </prism-card>
      </prism-card-list>`,
    );
    const box = await page
      .locator('[data-prism-page-size] select')
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
    expect(box.w).toBeGreaterThanOrEqual(24);
    expect(box.h).toBeGreaterThanOrEqual(24);
  });

  test('story time-range selects are at least 24 by 24px', async ({ page }) => {
    await setup(
      page,
      `<label>Time range
        <select data-prism-select>
          <option>Last 24 hours</option>
          <option>Last 7 days</option>
        </select>
      </label>`,
    );
    const box = await page.locator('[data-prism-select]').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    expect(box.w).toBeGreaterThanOrEqual(24);
    expect(box.h).toBeGreaterThanOrEqual(24);
  });
}

// --- card-widget.test.ts ---
{
  const settle = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => setTimeout(() => r(), 40)),
        ),
    );
  async function setup(page: Page, markup: string) {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settle(page);
    return errors;
  }
  const WIDGET = (attrs = '', body = '') => `
    <section id="page" data-prism-time-range="Last 24 hours">
      <prism-card id="w" type="widget" ${attrs} style="width:360px">
        <prism-card-title slot="header" level="3">Items over time</prism-card-title>
        <prism-card-description slot="header">Aperture Labs</prism-card-description>
        <prism-card-actions slot="header">
          <prism-icon-button label="Refresh Items over time">R</prism-icon-button>
          <prism-menu label="More options for Items over time">
            <prism-menu-item>Configure</prism-menu-item>
            <prism-menu-item>Export</prism-menu-item>
            <prism-menu-item>Remove</prism-menu-item>
          </prism-menu>
        </prism-card-actions>
        ${body || '<prism-card-metric label="Items">1,284</prism-card-metric>'}
        <prism-card-meta slot="footer">Updated 2 min ago</prism-card-meta>
        <prism-card-actions slot="footer">
          <prism-button variant="ghost" size="sm">View all</prism-button>
        </prism-card-actions>
      </prism-card>
    </section>`;
  const range = (page: Page) =>
    page.locator('#w').evaluate((el) => {
      const c = el as HTMLElement & {
        effectiveRange: string;
        rangeOverridden: boolean;
      };
      const part = c.shadowRoot!.querySelector<HTMLElement>('[part="range"]')!;
      return {
        effective: c.effectiveRange,
        overridden: c.rangeOverridden,
        shown: !part.hidden,
        text: part.hidden
          ? ''
          : [
              part.textContent,
              ...[...part.querySelectorAll('slot')].flatMap((sl) =>
                sl.assignedNodes({ flatten: true }).map((n) => n.textContent),
              ),
            ]
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim(),
      };
    });

  test.describe('widget card', () => {
    test('is a labelled group with a real heading, not a landmark', async ({
      page,
    }) => {
      const errors = await setup(page, WIDGET());
      expect(errors).toEqual([]);
      await expect(page.locator('#w')).toHaveAttribute('role', 'group');
      await expect(page.locator('#w')).toHaveAttribute(
        'aria-label',
        'Items over time',
      );
      await expect(
        page.getByRole('heading', { level: 3, name: 'Items over time' }),
      ).toHaveCount(1);
      await expect(page.getByRole('region')).toHaveCount(0);
    });

    test('header: scope description, refresh and overflow; footer: Updated and View all', async ({
      page,
    }) => {
      const errors = await setup(page, WIDGET());
      expect(errors).toEqual([]);
      await expect(
        page.getByRole('button', { name: 'Refresh Items over time' }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', {
          name: 'More options for Items over time',
        }),
      ).toBeVisible();
      await expect(page.getByText('Aperture Labs')).toBeVisible();
      await expect(page.getByText('Updated 2 min ago')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'View all' }),
      ).toBeVisible();
    });

    test('metric: PROPOSED 28/36/600 with tabular figures; label under it', async ({
      page,
    }) => {
      await setup(page, WIDGET());
      const m = await page.locator('prism-card-metric').evaluate((el) => {
        const v = el.shadowRoot!.querySelector('[part="value"]')!;
        const l = el.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
        const cs = getComputedStyle(v);
        const vb = v.getBoundingClientRect();
        const lb = l.getBoundingClientRect();
        return {
          size: cs.fontSize,
          line: cs.lineHeight,
          weight: cs.fontWeight,
          tabular: cs.fontVariantNumeric,
          labelBelow: lb.top >= vb.bottom - 0.5,
          label: l.textContent,
        };
      });
      expect(m).toMatchObject({
        size: '28px',
        line: '36px',
        weight: '600',
        tabular: expect.stringContaining('tabular-nums'),
        labelBelow: true,
        label: 'Items',
      });
    });

    test('the metric style is private: no Display style, no token edit', async ({
      page,
    }) => {
      await setup(page, WIDGET());
      const family = await page
        .locator('prism-card-metric')
        .evaluate((el) =>
          getComputedStyle(
            el.shadowRoot!.querySelector('[part="value"]')!,
          ).getPropertyValue('--_metric-font-size'),
        );
      expect(family).not.toBe('');
    });
  });

  test.describe('widget time range: page level with a per-widget override', () => {
    test('follows the page attribute; nothing is marked overridden', async ({
      page,
    }) => {
      await setup(page, WIDGET());
      expect(await range(page)).toEqual({
        effective: 'Last 24 hours',
        overridden: false,
        shown: false,
        text: '',
      });
    });

    test('a page change reaches the widget and fires prism-card-range', async ({
      page,
    }) => {
      await setup(page, WIDGET());
      await page.evaluate(() => {
        const w = window as unknown as { seen: unknown[] };
        w.seen = [];
        document.addEventListener('prism-card-range', (e) =>
          w.seen.push((e as CustomEvent).detail),
        );
        document
          .querySelector('#page')!
          .setAttribute('data-prism-time-range', 'Last 7 days');
      });
      await settle(page);
      expect((await range(page)).effective).toBe('Last 7 days');
      expect(
        await page.evaluate(
          () => (window as unknown as { seen: unknown[] }).seen,
        ),
      ).toEqual([{ range: 'Last 7 days', overridden: false }]);
    });

    test('its own range wins, is shown in the header and says "Overridden" in text', async ({
      page,
    }) => {
      await setup(page, WIDGET('range="Last 30 days"'));
      const r = await range(page);
      expect(r).toEqual({
        effective: 'Last 30 days',
        overridden: true,
        shown: true,
        text: 'Last 30 days Overridden',
      });
      // A page change does not move an overridden widget.
      await page.evaluate(() =>
        document
          .querySelector('#page')!
          .setAttribute('data-prism-time-range', 'Last 7 days'),
      );
      await settle(page);
      expect((await range(page)).effective).toBe('Last 30 days');
    });

    test('the override cue is not colour alone: the flag is a Tag with a fill and the word', async ({
      page,
    }) => {
      await setup(page, WIDGET('range="Last 30 days"'));
      const flag = await page.locator('#w').evaluate((el) => {
        const f = el.querySelector('prism-tag')!;
        const cs = getComputedStyle(
          f.shadowRoot!.querySelector('[part="base"]')!,
        );
        return {
          text: f.textContent,
          tag: f.localName,
          border: cs.borderTopWidth,
          fill: cs.backgroundColor,
        };
      });
      // A Tag: the word plus a filled box, so the override is never colour alone.
      expect(flag.text).toBe('Overridden');
      expect(flag.tag).toBe('prism-tag');
      expect(flag.border).toBe('1px');
      expect(flag.fill).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('removing the override returns to the page range and fires the event', async ({
      page,
    }) => {
      await setup(page, WIDGET('range="Last 30 days"'));
      await page.evaluate(() => {
        const w = window as unknown as { seen: unknown[] };
        w.seen = [];
        document.addEventListener('prism-card-range', (e) =>
          w.seen.push((e as CustomEvent).detail),
        );
        document.querySelector('#w')!.removeAttribute('range');
      });
      await settle(page);
      expect((await range(page)).overridden).toBe(false);
      expect(
        await page.evaluate(
          () => (window as unknown as { seen: unknown[] }).seen,
        ),
      ).toEqual([{ range: 'Last 24 hours', overridden: false }]);
    });

    test('a TimeRangeInput in the header without an override is a dev error; a third action is rejected', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card type="widget"><prism-card-title slot="header" level="3">X</prism-card-title>
          <prism-card-actions slot="header"><prism-time-range-input></prism-time-range-input></prism-card-actions>
          body</prism-card>`,
      );
      expect(errors.some((e) => e.includes('only when it overrides'))).toBe(
        true,
      );
    });

    test('a TimeRangeInput is accepted on a widget and refused on other cards', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card type="widget" range="Last 7 days"><prism-card-title slot="header" level="3">A</prism-card-title>
          <prism-card-actions slot="header"><prism-time-range-input id="ok"></prism-time-range-input></prism-card-actions>x</prism-card>
         <prism-card><prism-card-title slot="header" level="3">B</prism-card-title>
          <prism-card-actions slot="header"><prism-time-range-input id="no"></prism-time-range-input></prism-card-actions>x</prism-card>`,
      );
      await expect(page.locator('#ok')).not.toHaveAttribute(
        'data-prism-invalid',
      );
      await expect(page.locator('#no')).toHaveAttribute(
        'data-prism-invalid',
        /widget/,
      );
      expect(errors.some((e) => e.includes('only for widget cards'))).toBe(
        true,
      );
    });

    test('no resize: a widget has no resize handle or Resize hook', async ({
      page,
    }) => {
      await setup(page, WIDGET());
      await expect(page.locator('#w')).not.toHaveAttribute('resizable');
      await expect(page.getByText('Resize', { exact: false })).toHaveCount(0);
    });
  });

  test.describe('widget states stay inside the widget', () => {
    test('loading: a skeleton replaces the content, header and footer stay, busy and "Loading"', async ({
      page,
    }) => {
      const errors = await setup(page, WIDGET('state="loading"'));
      expect(errors).toEqual([]);
      await expect(page.locator('#w')).toHaveAttribute('aria-busy', 'true');
      await expect(page.locator('prism-card-metric')).toBeHidden();
      await expect(page.locator('prism-card-skeleton')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Items over time' }),
      ).toBeVisible();
      await expect(page.getByText('Updated 2 min ago')).toBeVisible();
      await expect(page.locator('#w').locator('[part="status"]')).toHaveText(
        'Loading',
      );
      // Decorative: hidden from assistive technology.
      await expect(page.locator('prism-card-skeleton')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });

    test('error: says what failed, one Retry, only this widget; Retry fires and the content returns', async ({
      page,
    }) => {
      await setup(
        page,
        WIDGET('state="error" state-message="Items service timed out."') +
          '<prism-card id="other" type="widget"><prism-card-title slot="header" level="3">Other</prism-card-title><prism-card-metric>7</prism-card-metric></prism-card>',
      );
      await expect(page.locator('#w [data-prism-card-state] p')).toHaveText(
        'Items service timed out.',
      );
      await expect(page.locator('#w').locator('[part="status"]')).toHaveText(
        'Items service timed out.',
      );
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(1);
      await expect(page.locator('#other prism-card-metric')).toBeVisible();
      await page.evaluate(() => {
        const w = window as unknown as { retried: number };
        w.retried = 0;
        document.addEventListener('prism-card-retry', () => w.retried++);
      });
      await page.getByRole('button', { name: 'Retry' }).click();
      expect(
        await page.evaluate(
          () => (window as unknown as { retried: number }).retried,
        ),
      ).toBe(1);
      await page.locator('#w').evaluate((el) => el.removeAttribute('state'));
      await settle(page);
      await expect(page.locator('#w prism-card-metric')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
    });

    test('empty: "No data for this range" and a Change range button', async ({
      page,
    }) => {
      await setup(page, WIDGET('state="empty"'));
      await expect(page.locator('#w [data-prism-card-state] p')).toHaveText(
        'No data for this range',
      );
      await page.evaluate(() => {
        const w = window as unknown as { hits: number };
        w.hits = 0;
        document.addEventListener('prism-card-change-range', () => w.hits++);
      });
      await page.getByRole('button', { name: 'Change range' }).click();
      expect(
        await page.evaluate(() => (window as unknown as { hits: number }).hits),
      ).toBe(1);
    });

    test('narrow: header actions still fold into the overflow menu', async ({
      page,
    }) => {
      await setup(page, WIDGET().replace('width:360px', 'width:260px'));
      await expect(page.locator('#w')).toHaveAttribute('role', 'group');
      const narrow = await page
        .locator('#w')
        .evaluate((el) => el.matches(':state(narrow)'));
      expect(narrow).toBe(true);
    });
  });
}
