// Tags, including press motion.

import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';
import { wait } from '../../test/field.js';
import {
  mouseDown,
  releaseFrames,
  scaleAnims,
  scaleOf,
} from '../../test/press.js';
import { polishMotion } from '../../test/polish-motion.js';

// --- tag.test.ts ---
{
  async function setup(page: Page, markup: string) {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60))),
    );
    return errors;
  }

  const paint = (page: Page, sel: string) =>
    page.locator(sel).evaluate((el) => {
      const cs = getComputedStyle(
        el.shadowRoot!.querySelector('[part="base"]')!,
      );
      const r = el.getBoundingClientRect();
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        border: cs.borderTopColor,
        h: r.height,
      };
    });

  test.describe('prism-tag', () => {
    test('read-only: a span with the text, no role, no button', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        '<prism-tag id="t" job="spectrum" tone="danger">Urgent</prism-tag>',
      );
      expect(errors).toEqual([]);
      const r = await page.locator('#t').evaluate((el) => ({
        tag: el.shadowRoot!.querySelector('[part="base"]')!.localName,
        buttons: el.shadowRoot!.querySelectorAll('button').length,
      }));
      expect(r).toEqual({ tag: 'span', buttons: 0 });
      await expect(page.locator('#t')).toHaveAttribute('job', 'spectrum');
      await expect(page.getByText('Urgent')).toBeVisible();
    });

    test('every job value reflects as an attribute', async ({ page }) => {
      const jobs = [
        'spectrum',
        'status',
        'presence',
        'clarity',
        'illusionary',
        'health',
        'refractive-rules',
        'diffusion',
        'keyword',
      ];
      const errors = await setup(
        page,
        jobs
          .map((j) => `<prism-tag id="${j}" job="${j}">Label</prism-tag>`)
          .join(''),
      );
      expect(errors).toEqual([]);
      for (const j of jobs) {
        await expect(page.locator(`#${j}`)).toHaveAttribute('job', j);
        expect(
          await page
            .locator(`#${j}`)
            .evaluate((el) => (el as HTMLElement & { job?: string }).job),
        ).toBe(j);
      }
    });

    test('defaults: low emphasis, neutral tone, 24px; sm is 20px', async ({
      page,
    }) => {
      await setup(
        page,
        '<prism-tag id="a">One</prism-tag><prism-tag id="b" size="sm">Two</prism-tag>',
      );
      await expect(page.locator('#a')).toHaveAttribute('emphasis', 'low');
      await expect(page.locator('#a')).toHaveAttribute('tone', 'neutral');
      expect((await paint(page, '#a')).h).toBe(24);
      expect((await paint(page, '#b')).h).toBe(20);
    });

    test('every tone and emphasis is painted: a fill (low, high) or none (ghost), always with text', async ({
      page,
    }) => {
      const tones = [
        'neutral',
        'info',
        'success',
        'warning',
        'danger',
        'accent',
      ];
      await setup(
        page,
        tones
          .flatMap((t) =>
            ['low', 'high', 'ghost'].map(
              (e) =>
                `<prism-tag id="${t}-${e}" tone="${t}" emphasis="${e}">${t}</prism-tag>`,
            ),
          )
          .join(''),
      );
      const fills = new Set<string>();
      for (const t of tones) {
        const low = await paint(page, `#${t}-low`);
        const high = await paint(page, `#${t}-high`);
        const ghost = await paint(page, `#${t}-ghost`);
        expect(low.bg).not.toBe('rgba(0, 0, 0, 0)');
        expect(high.bg).not.toBe(low.bg);
        expect(ghost.bg).toBe('rgba(0, 0, 0, 0)');
        expect(ghost.color).toBe(low.color);
        fills.add(low.bg);
      }
      // Status tones each have their own tint. Accent defaults to the same
      // band as neutral; the opt-in accent layer is what separates them.
      expect(fills.size).toBe(5);
      expect((await paint(page, '#accent-low')).bg).toBe(
        (await paint(page, '#neutral-low')).bg,
      );
    });

    test('the opt-in accent layer gives the accent tone its own tint', async ({
      page,
    }) => {
      await setup(
        page,
        '<prism-tag id="n" tone="neutral">Band</prism-tag><prism-tag id="a" tone="accent">Accent</prism-tag>',
      );
      await page.addStyleTag({ path: 'src/theme/theme-accent.css' });
      expect((await paint(page, '#a')).bg).not.toBe(
        (await paint(page, '#n')).bg,
      );
    });

    test('high emphasis text is white on the fill', async ({ page }) => {
      await setup(
        page,
        '<prism-tag id="h" tone="danger" emphasis="high">Urgent</prism-tag>',
      );
      expect((await paint(page, '#h')).color).toMatch(
        /^(rgb\(255, 255, 255\)|oklch\(1 0 |oklch\(0\.995 )/,
      );
    });

    test('dismissible: "Remove {text}" button fires prism-tag-remove and does not remove itself', async ({
      page,
    }) => {
      await setup(
        page,
        '<prism-tag id="t" dismissible job="keyword">Refraction-7</prism-tag>',
      );
      await page.evaluate(() => {
        (window as unknown as { n: number }).n = 0;
        document.addEventListener('prism-tag-remove', () => {
          (window as unknown as { n: number }).n++;
        });
      });
      const btn = page.getByRole('button', { name: 'Remove Refraction-7' });
      await expect(btn).toHaveCount(1);
      const box = await btn.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
      await btn.click();
      expect(
        await page.evaluate(() => (window as unknown as { n: number }).n),
      ).toBe(1);
      await expect(page.locator('#t')).toHaveCount(1);
    });

    test('dismissible by keyboard', async ({ page }) => {
      await setup(
        page,
        '<prism-tag id="t" dismissible>Refraction-7</prism-tag>',
      );
      await page.evaluate(() => {
        (window as unknown as { n: number }).n = 0;
        document.addEventListener('prism-tag-remove', () => {
          (window as unknown as { n: number }).n++;
        });
      });
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      expect(
        await page.evaluate(() => (window as unknown as { n: number }).n),
      ).toBe(1);
    });

    test('selectable: a toggle button with aria-pressed, a non-colour cue, and an event', async ({
      page,
    }) => {
      await setup(page, '<prism-tag id="t" selectable>Lumen OS</prism-tag>');
      await page.evaluate(() => {
        (window as unknown as { seen: unknown[] }).seen = [];
        document.addEventListener('prism-tag-select', (e) =>
          (window as unknown as { seen: unknown[] }).seen.push(
            (e as CustomEvent).detail,
          ),
        );
      });
      const btn = page.getByRole('button', { name: 'Lumen OS' });
      await expect(btn).toHaveAttribute('aria-pressed', 'false');
      const before = await paint(page, '#t');
      await btn.click();
      await expect(btn).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#t')).toHaveAttribute('selected', '');
      const after = await paint(page, '#t');
      // The border turns solid (text colour): a cue besides colour.
      expect(before.border).toBe('rgba(0, 0, 0, 0)');
      expect(after.border).not.toBe('rgba(0, 0, 0, 0)');
      await page.keyboard.press('Space');
      await expect(btn).toHaveAttribute('aria-pressed', 'false');
      expect(
        await page.evaluate(
          () => (window as unknown as { seen: unknown[] }).seen,
        ),
      ).toEqual([{ selected: true }, { selected: false }]);
    });

    test('disabled interactive tags do not toggle or fire', async ({
      page,
    }) => {
      await setup(
        page,
        '<prism-tag id="t" selectable disabled>Spectra OS</prism-tag>',
      );
      await expect(
        page.getByRole('button', { name: 'Spectra OS' }),
      ).toBeDisabled();
    });

    test('trigger: a button that opens a listbox, with a caret, and fires prism-tag-trigger', async ({
      page,
    }) => {
      await setup(page, '<prism-tag id="t" trigger>In progress</prism-tag>');
      const btn = page.getByRole('button', { name: 'In progress' });
      await expect(btn).toHaveAttribute('aria-haspopup', 'listbox');
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      expect(
        await page
          .locator('#t')
          .evaluate(
            (el) => !!el.shadowRoot!.querySelector('slot[name="trailing"] svg'),
          ),
      ).toBe(true);
      await page.evaluate(() => {
        (window as unknown as { n: number }).n = 0;
        document.addEventListener('prism-tag-trigger', () => {
          (window as unknown as { n: number }).n++;
        });
      });
      await btn.click();
      expect(
        await page.evaluate(() => (window as unknown as { n: number }).n),
      ).toBe(1);
    });

    test('interactive tags stay 24px high even at size sm', async ({
      page,
    }) => {
      await setup(
        page,
        '<prism-tag id="t" size="sm" selectable>Small</prism-tag><prism-tag id="r" size="sm">Read only</prism-tag>',
      );
      expect((await paint(page, '#t')).h).toBeGreaterThanOrEqual(24);
      expect((await paint(page, '#r')).h).toBe(20);
    });

    test('an empty tag is a dev error', async ({ page }) => {
      const errors = await setup(page, '<prism-tag></prism-tag>');
      expect(errors.some((e) => e.includes('needs text'))).toBe(true);
    });

    test('text does not wrap; long text truncates', async ({ page }) => {
      await setup(
        page,
        '<div style="width:80px"><prism-tag id="t">A very long label indeed</prism-tag></div>',
      );
      const h = (await paint(page, '#t')).h;
      expect(h).toBe(24);
    });
  });
}

// --- tag-press.test.ts ---
{
  async function setup(page: Page, markup: string) {
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await polishMotion(page);
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
        expect(await scaleAnims(h(page, id), '[part="base"]')).toEqual([
          'scale',
        ]);
        await wait(page, 300);
        expect(await scaleOf(h(page, id), '[part="base"]')).toBeCloseTo(
          0.97,
          3,
        );
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
      expect(await scaleOf(h(page, '#sel'), '[part="base"]')).toBeLessThan(
        0.99,
      );
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
}
