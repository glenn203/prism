import { expect, test, type Locator, type Page } from '@playwright/test';
import { anims, drawn, wait } from '../../test/choice.js';
import { axe } from '../../test/axe.js';
import { captureSubmit, mount, submitted } from '../../test/fixture.js';

async function setup(page: Page, markup: string) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  // Styling the page starts colour transitions; let them finish.
  await wait(page, 600);
  return errors;
}

const box = (page: Page, name: string) =>
  page.getByRole('checkbox', { name, exact: true });
const host = (page: Page, id = '#c') => page.locator(id);
const tap = (page: Page, id = '#c') =>
  host(page, id).evaluate((el) => (el as HTMLElement).click());
const size = (loc: Locator, name: string, side: 'width' | 'height') =>
  loc.evaluate(
    (el, [name, side]) =>
      el.shadowRoot!.querySelector(`[part="${name}"]`)!.getBoundingClientRect()[
        side as 'width' | 'height'
      ],
    [name, side],
  );
const part = (loc: Locator, name: string) => size(loc, name, 'width');
const height = (loc: Locator, name: string) => size(loc, name, 'height');

test.describe('prism-checkbox: semantics', () => {
  test('a native input type=checkbox, named by its label, with no role or aria-checked', async ({
    page,
  }) => {
    const errors = await setup(
      page,
      `<prism-checkbox label="Off"></prism-checkbox>
       <prism-checkbox label="On" checked></prism-checkbox>
       <prism-checkbox label="Some" indeterminate></prism-checkbox>`,
    );
    expect(errors).toEqual([]);
    await expect(box(page, 'Off')).not.toBeChecked();
    await expect(box(page, 'On')).toBeChecked();
    await expect(box(page, 'Some')).toBeChecked({ indeterminate: true });
    for (const name of ['Off', 'On', 'Some']) {
      const input = box(page, name);
      expect(await input.evaluate((el) => el.tagName)).toBe('INPUT');
      await expect(input).toHaveAttribute('type', 'checkbox');
      await expect(input).not.toHaveAttribute('role');
      await expect(input).not.toHaveAttribute('aria-checked');
      await expect(input).not.toHaveAttribute('aria-labelledby');
    }
    const label = host(page, 'prism-checkbox').first();
    expect(
      await label.evaluate(
        (el) =>
          el.shadowRoot!.querySelector('label')!.htmlFor ===
          el.shadowRoot!.querySelector('input')!.id,
      ),
    ).toBe(true);
  });

  test('a checked and indeterminate box unchecks on click, as a native one does', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-checkbox id="c" label="C" checked indeterminate></prism-checkbox>',
    );
    await box(page, 'C').click();
    await expect(box(page, 'C')).not.toBeChecked({ indeterminate: false });
    expect(
      await host(page).evaluate((el) => el.hasAttribute('indeterminate')),
    ).toBe(false);
  });

  test('required sets the native required state on the input', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox label="C" required></prism-checkbox>');
    await expect(box(page, 'C')).toHaveJSProperty('required', true);
  });

  test('click, label click and Space toggle; Enter does not', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-checkbox label="Weekly summary"></prism-checkbox>',
    );
    const c = box(page, 'Weekly summary');
    await c.click();
    await expect(c).toBeChecked();
    await page.getByText('Weekly summary').click();
    await expect(c).not.toBeChecked();
    await c.focus();
    await page.keyboard.press('Space');
    await expect(c).toBeChecked();
    await page.keyboard.press('Enter');
    await expect(c).toBeChecked();
  });

  test('fires input and change once per user toggle, not for property changes', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    await page.evaluate(() => {
      const w = window as unknown as { log: string[] };
      w.log = [];
      for (const t of ['input', 'change'])
        document.querySelector('#c')!.addEventListener(t, () => w.log.push(t));
    });
    await box(page, 'C').click();
    await host(page).evaluate(
      (el) => ((el as never as { checked: boolean }).checked = false),
    );
    expect(
      await page.evaluate(() => (window as never as { log: string[] }).log),
    ).toEqual(['input', 'change']);
  });

  test('clicking an indeterminate box checks it and clears indeterminate', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-checkbox id="c" label="C" indeterminate></prism-checkbox>',
    );
    await box(page, 'C').click();
    await expect(box(page, 'C')).toBeChecked();
    expect(
      await host(page).evaluate((el) => el.hasAttribute('indeterminate')),
    ).toBe(false);
    await box(page, 'C').click();
    await expect(box(page, 'C')).not.toBeChecked();
  });

  test('host.click() toggles; :state(checked), :state(indeterminate), :state(selected)', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    const states = () =>
      host(page).evaluate((el) =>
        ['checked', 'indeterminate', 'selected'].map((s) =>
          el.matches(`:state(${s})`),
        ),
      );
    expect(await states()).toEqual([false, false, false]);
    await tap(page);
    expect(await states()).toEqual([true, false, true]);
    await host(page).evaluate(
      (el) =>
        ((el as never as { indeterminate: boolean }).indeterminate = true),
    );
    expect(await states()).toEqual([false, true, true]);
  });

  test('hide-label keeps the name but not the text on screen', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-checkbox id="c" label="Select row" hide-label></prism-checkbox>',
    );
    await expect(box(page, 'Select row')).toBeVisible();
    const w = await host(page).evaluate(
      (el) =>
        el.shadowRoot!.querySelector('[part="label"]')!.getBoundingClientRect()
          .width,
    );
    expect(w).toBeLessThanOrEqual(1);
  });

  test('a missing label is reported', async ({ page }) => {
    const errors = await setup(page, '<prism-checkbox></prism-checkbox>');
    expect(errors.join()).toContain('`label` is required');
  });

  test('description is wired to the control', async ({ page }) => {
    await setup(
      page,
      '<prism-checkbox label="C"><span slot="description">Help text</span></prism-checkbox>',
    );
    await expect(box(page, 'C')).toHaveAccessibleDescription('Help text');
  });
});

test.describe('prism-checkbox: disabled', () => {
  test('does not toggle, is not focusable and shows :state(disabled)', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-checkbox id="c" label="C" disabled></prism-checkbox>',
    );
    await host(page).click({ force: true });
    await expect(box(page, 'C')).not.toBeChecked();
    await page.keyboard.press('Tab');
    await expect(box(page, 'C')).not.toBeFocused();
    expect(
      await host(page).evaluate((el) => el.matches(':state(disabled)')),
    ).toBe(true);
  });

  test('disabled by an ancestor fieldset; no hover overlay', async ({
    page,
  }) => {
    await setup(
      page,
      '<fieldset disabled><prism-checkbox id="c" label="C"></prism-checkbox></fieldset>',
    );
    expect(
      await host(page).evaluate((el) => el.matches(':state(disabled)')),
    ).toBe(true);
    await host(page).hover({ force: true });
    expect(await overlayAlpha(page)).toBe(0);
  });
});

test.describe('prism-checkbox: forms', () => {
  test('submits value while checked, nothing otherwise', async ({ page }) => {
    await setup(
      page,
      '<form><prism-checkbox id="c" name="digest" value="weekly" label="C"></prism-checkbox></form>',
    );
    await captureSubmit(page);
    const submit = async () => {
      await page.evaluate(() =>
        document.querySelector('form')!.requestSubmit(),
      );
      return submitted(page);
    };
    expect(await submit()).toEqual({});
    await box(page, 'C').click();
    expect(await submit()).toEqual({ digest: 'weekly' });
  });

  test('required: invalid until checked, the error shows after interaction', async ({
    page,
  }) => {
    await setup(
      page,
      `<form><prism-checkbox id="c" name="agree" label="C" required>
        <span slot="error">Tick this to continue.</span></prism-checkbox></form>`,
    );
    expect(
      await host(page).evaluate(
        (el) => (el as never as HTMLInputElement).validity.valueMissing,
      ),
    ).toBe(true);
    const err = host(page).locator('[slot="error"]');
    await expect(err).toBeHidden();
    await host(page).evaluate((el) =>
      (el as never as HTMLInputElement).reportValidity(),
    );
    await expect(err).toBeVisible();
    await expect(box(page, 'C')).toHaveAttribute('aria-invalid', 'true');
    await box(page, 'C').click();
    await expect(err).toBeHidden();
    expect(
      await host(page).evaluate((el) =>
        (el as never as HTMLInputElement).checkValidity(),
      ),
    ).toBe(true);
  });

  test('form reset returns to the starting state', async ({ page }) => {
    await setup(
      page,
      '<form><prism-checkbox id="c" name="a" label="C" checked></prism-checkbox></form>',
    );
    await box(page, 'C').click();
    await expect(box(page, 'C')).not.toBeChecked();
    await page.evaluate(() => document.querySelector('form')!.reset());
    await expect(box(page, 'C')).toBeChecked();
  });
});

test.describe('prism-checkbox: shape', () => {
  test('a 24px minimum hit area around a 16, 20 or 24px box', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-checkbox id="sm" label="a" size="sm"></prism-checkbox>
       <prism-checkbox id="md" label="b"></prism-checkbox>
       <prism-checkbox id="lg" label="c" size="lg"></prism-checkbox>`,
    );
    for (const [id, boxPx] of [
      ['#sm', 16],
      ['#md', 20],
      ['#lg', 24],
    ] as const) {
      expect(await part(host(page, id), 'box')).toBe(boxPx);
      expect(await part(host(page, id), 'base')).toBeGreaterThanOrEqual(24);
      expect(await height(host(page, id), 'base')).toBeGreaterThanOrEqual(24);
    }
  });

  test('rest pose: nothing drawn when off; a check when on; a dash when indeterminate', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-checkbox id="off" label="a"></prism-checkbox>
       <prism-checkbox id="on" label="b" checked></prism-checkbox>
       <prism-checkbox id="mixed" label="c" indeterminate></prism-checkbox>`,
    );
    const off = await drawn(host(page, '#off'));
    expect(off.fill!.o).toBe(0);
    expect(off.arms!.map((a) => a.o)).toEqual([0, 0]);
    const on = await drawn(host(page, '#on'));
    expect(on.fill!.s).toBe(1);
    expect(on.arms!.map((a) => Math.round(a.len * 10) / 10)).toEqual([
      4.8, 9.7,
    ]);
    const mixed = await drawn(host(page, '#mixed'));
    expect(mixed.fill!.s).toBe(1);
    // Flat and level: one arm left, one right, through the centre.
    expect(mixed.arms!.map((a) => Math.round(a.angle))).toEqual([180, 0]);
    expect(mixed.arms!.map((a) => a.len)).toEqual([5, 5]);
  });
});

test.describe('prism-checkbox: motion', () => {
  test('nothing animates on first paint, checked, unchecked or indeterminate', async ({
    page,
  }) => {
    await mount(
      page,
      `<prism-checkbox id="a" label="a"></prism-checkbox>
       <prism-checkbox id="b" label="b" checked></prism-checkbox>
       <prism-checkbox id="d" label="d" indeterminate></prism-checkbox>`,
    );
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    for (const id of ['#a', '#b', '#d'])
      expect(await anims(host(page, id))).toEqual([]);
  });

  test('a change from code moves the same way as a click', async ({ page }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    await host(page).evaluate(
      (el) => ((el as never as { checked: boolean }).checked = true),
    );
    const byCode = await anims(host(page));
    await wait(page, 700);
    await host(page).evaluate(
      (el) => ((el as never as { checked: boolean }).checked = false),
    );
    await wait(page, 700);
    await tap(page);
    const byClick = await anims(host(page));
    expect(byCode.length).toBe(5);
    expect(
      byClick.map((a) => [a.target, a.pseudo, a.duration, a.props]),
    ).toEqual(byCode.map((a) => [a.target, a.pseudo, a.duration, a.props]));
  });

  test('every layer shares one clock and only transform, opacity and the check stroke move', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    await tap(page);
    const run = await anims(host(page));
    expect(new Set(run.map((a) => a.duration)).size).toBe(1);
    expect(new Set(run.map((a) => a.start)).size).toBe(1);
    const props = new Set(run.flatMap((a) => a.props));
    expect([...props].sort()).toEqual([
      'opacity',
      'strokeDashoffset',
      'transform',
    ]);
    // No colour or size is animated by a transition either.
    expect(
      await host(page).evaluate(
        (el) =>
          el
            .shadowRoot!.querySelector('[part="container"]')!
            .getAnimations({ subtree: true })
            .filter((a) => a instanceof CSSTransition).length,
      ),
    ).toBe(0);
  });

  test('checking and unchecking take about the same time, 300-500ms, and hand back to the stylesheet', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    await tap(page);
    const on = (await anims(host(page)))[0]!.duration;
    await wait(page, 700);
    expect(await anims(host(page))).toEqual([]);
    await tap(page);
    const off = (await anims(host(page)))[0]!.duration;
    expect(on).toBeGreaterThanOrEqual(300);
    expect(on).toBeLessThanOrEqual(500);
    expect(Math.abs(on - off)).toBeLessThan(120);
  });

  test('checking: the fill grows from the centre, then the check draws in with a tiny overshoot', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    await tap(page);
    const dur = (await anims(host(page)))[0]!.duration;
    const frames = [];
    for (let t = 0; t <= dur; t += 4) frames.push(await drawn(host(page), t));
    const fill = frames.map((f) => f.fill!.s);
    const long = frames.map((f) => f.arms![1]!.len);
    const short = frames.map((f) => f.arms![0]!.len);
    expect(fill[0]).toBeLessThan(0.1);
    expect(fill.at(-1)).toBe(1);
    // Fill leads: half full before the long arm has drawn a third of its length.
    const halfFill = fill.findIndex((s) => s >= 0.5);
    expect(long[halfFill]!).toBeLessThan(9.65 / 3);
    // The short arm finishes drawing before the long one does.
    expect(short.findIndex((l) => l >= 4.8)).toBeLessThan(
      long.findIndex((l) => l >= 9.65),
    );
    // Overshoot: the long arm runs past its length by under 10%, then settles.
    const peak = Math.max(...long);
    expect(peak).toBeGreaterThan(9.65 * 1.005);
    expect(peak).toBeLessThan(9.65 * 1.1);
    expect(long.at(-1)).toBeCloseTo(9.65, 2);
  });

  test('the box pops: squishes down, then past rest and back', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    await tap(page);
    const dur = (await anims(host(page)))[0]!.duration;
    const sy = [];
    for (let t = 0; t <= dur; t += 4) sy.push((await drawn(host(page), t)).sy);
    expect(Math.max(...sy)).toBeGreaterThan(1.03);
    expect(Math.max(...sy)).toBeLessThan(1.1);
    expect(sy.at(-1)).toBe(1);
  });

  test('every frame is continuous: no step or change of step jumps', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    for (let round = 0; round < 2; round++) {
      await tap(page);
      const dur = (await anims(host(page)))[0]!.duration;
      const series: Record<string, number[]> = {
        fill: [],
        long: [],
        short: [],
        sy: [],
      };
      for (let t = 0; t <= dur; t += 2) {
        const f = await drawn(host(page), t);
        series.fill!.push(f.fill!.s);
        series.long!.push(f.arms![1]!.len);
        series.short!.push(f.arms![0]!.len);
        series.sy!.push(f.sy);
      }
      // Largest allowed move per 2ms step.
      const limit = { fill: 0.06, long: 0.5, short: 0.5, sy: 0.01 };
      for (const [k, v] of Object.entries(series)) {
        const step = v.slice(1).map((n, i) => n - v[i]!);
        expect(Math.max(...step.map(Math.abs)), `${k} step`).toBeLessThan(
          limit[k as keyof typeof limit],
        );
        const jerk = step.slice(1).map((n, i) => n - step[i]!);
        expect(Math.max(...jerk.map(Math.abs)), `${k} jerk`).toBeLessThan(
          limit[k as keyof typeof limit] / 2.5,
        );
      }
      await wait(page, 700);
    }
  });

  test('turning round mid-move carries on from where it is: no snap', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    for (const at of [40, 90, 150, 230, 300]) {
      await tap(page);
      const ahead = await drawn(host(page), at + 16.7);
      await drawn(host(page), at);
      await tap(page); // turn round
      const after = await drawn(host(page), 0);
      expect(Math.abs(after.fill!.s - ahead.fill!.s)).toBeLessThan(0.03);
      expect(Math.abs(after.sy - ahead.sy)).toBeLessThan(0.01);
      for (const i of [0, 1])
        expect(
          Math.abs(after.arms![i]!.len - ahead.arms![i]!.len),
        ).toBeLessThan(0.3);
      await wait(page, 700);
    }
  });

  test('rapid taps always end at rest, in the right state, with nothing left running', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    for (let i = 0; i < 9; i++) {
      await tap(page);
      await wait(page, 55);
    }
    await wait(page, 800);
    await expect(box(page, 'C')).toBeChecked();
    expect(await anims(host(page))).toEqual([]);
    const f = await drawn(host(page));
    expect(f.fill!.s).toBe(1);
    expect(f.arms![1]!.len).toBeCloseTo(9.65, 2);
    expect(f.sy).toBe(1);
  });

  test('the end of the move is exactly the stylesheet rest pose: no jump on hand-over', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    for (let round = 0; round < 3; round++) {
      await tap(page);
      const dur = (await anims(host(page)))[0]!.duration;
      const last = await drawn(host(page), dur - 0.01);
      await host(page).evaluate((el) =>
        el
          .shadowRoot!.querySelector('[part="container"]')!
          .getAnimations({ subtree: true })
          .forEach((a) => a.finish()),
      );
      await wait(page, 100);
      expect(await anims(host(page))).toEqual([]);
      const rest = await drawn(host(page));
      expect(last.fill!.s).toBeCloseTo(rest.fill!.s, 2);
      expect(last.arms![1]!.len).toBeCloseTo(rest.arms![1]!.len, 1);
      expect(last.sy).toBeCloseTo(rest.sy, 3);
    }
  });

  test('indeterminate and check turn into each other without a jump', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-checkbox id="c" label="C" indeterminate></prism-checkbox>',
    );
    await tap(page); // dash to check
    const dur = (await anims(host(page)))[0]!.duration;
    const frames = [];
    for (let t = 0; t <= dur; t += 2) frames.push(await drawn(host(page), t));
    const mid = frames[Math.round(frames.length / 4)]!;
    // Part way: the corner has moved and the arms have turned from flat.
    const midAngle = (mid.arms![0]!.angle + 360) % 360;
    expect(midAngle).toBeGreaterThan(182);
    expect(midAngle).toBeLessThan(223);
    for (const i of [0, 1]) {
      const len = frames.map((f) => f.arms![i]!.len);
      const step = len.slice(1).map((n, k) => n - len[k]!);
      expect(Math.max(...step.map(Math.abs))).toBeLessThan(0.5);
    }
    // The fill stays full the whole way: it never flickers through empty.
    expect(Math.min(...frames.map((f) => f.fill!.s))).toBeGreaterThan(0.95);
    await wait(page, 600);
    await host(page).evaluate(
      (el) =>
        ((el as never as { indeterminate: boolean }).indeterminate = true),
    );
    const back = await drawn(host(page), 0);
    expect((back.arms![0]!.angle + 360) % 360).toBeGreaterThan(215); // starts from the check
    await host(page).evaluate((el) =>
      el
        .shadowRoot!.querySelector('[part="container"]')!
        .getAnimations({ subtree: true })
        .forEach((a) => a.finish()),
    );
    await wait(page, 100);
    expect(
      (await drawn(host(page))).arms!.map((a) => Math.round(a.angle)),
    ).toEqual([180, 0]);
  });

  test('press squishes the box, letting go outside does nothing', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    const b = (await box(page, 'C').boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await wait(page, 300);
    const held = await drawn(host(page));
    expect(held.sy).toBeCloseTo(0.88, 2);
    expect(held.sx).toBeCloseTo(0.94, 2);
    await page.mouse.move(b.x + 200, b.y + 200);
    await page.mouse.up();
    await wait(page, 700);
    await expect(box(page, 'C')).not.toBeChecked();
    expect((await drawn(host(page))).sy).toBe(1);
  });

  test('Space squishes too, and the toggle lands on release', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    await box(page, 'C').focus();
    await page.keyboard.down('Space');
    await wait(page, 300);
    expect((await drawn(host(page))).sy).toBeCloseTo(0.88, 2);
    await page.keyboard.up('Space');
    await expect(box(page, 'C')).toBeChecked();
    await wait(page, 700);
    expect((await drawn(host(page))).sy).toBe(1);
  });

  test('a mouse tap toggles once and the release is part of the same move', async ({
    page,
  }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    await box(page, 'C').click();
    expect((await anims(host(page))).length).toBe(5);
    expect(new Set((await anims(host(page))).map((a) => a.start)).size).toBe(1);
    await wait(page, 700);
    await expect(box(page, 'C')).toBeChecked();
  });

  test('reduced motion: no animation, the state changes at once, colour fades over 120ms', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    await box(page, 'C').click();
    expect(await anims(host(page))).toEqual([]);
    const r = await host(page).evaluate((el) => {
      const q = (p: string) => el.shadowRoot!.querySelector(`[part="${p}"]`)!;
      const cs = (n: Element, pe?: string) => getComputedStyle(n, pe);
      return {
        fillProps: cs(q('fill')).transitionProperty,
        fillMs: parseFloat(cs(q('fill')).transitionDuration) * 1000,
        glint: cs(q('box'), '::before').display,
        checked: (q('base') as HTMLInputElement).checked,
      };
    });
    expect(r).toEqual({
      fillProps: 'opacity',
      fillMs: 120,
      glint: 'none',
      checked: true,
    });
    // Press does not squish.
    const b = (await box(page, 'C').boundingBox())!;
    await page.mouse.move(b.x + 10, b.y + 10);
    await page.mouse.down();
    await wait(page, 100);
    expect((await drawn(host(page))).sy).toBe(1);
    await page.mouse.up();
  });

  test('forced colors: the fill and mark use system colours', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await setup(
      page,
      '<prism-checkbox id="c" label="C" checked></prism-checkbox>',
    );
    const r = await host(page).evaluate((el) => {
      const q = (p: string) => el.shadowRoot!.querySelector(`[part="${p}"]`)!;
      const probe = (c: string) => {
        const d = document.createElement('i');
        d.style.color = c;
        document.body.append(d);
        const v = getComputedStyle(d).color;
        d.remove();
        return v;
      };
      return {
        fill: getComputedStyle(q('fill')).backgroundColor,
        mark: getComputedStyle(q('mark')).color,
        hl: probe('Highlight'),
        hlt: probe('HighlightText'),
      };
    });
    expect(r.fill).toBe(r.hl);
    expect(r.mark).toBe(r.hlt);
  });
});

// ---- state layer ----

/** Alpha of the state overlay drawn above the fill (0 when none). */
const overlayAlpha = (page: Page, id = '#c') =>
  host(page, id).evaluate((el) => {
    const box = el.shadowRoot!.querySelector('[part="box"]')!;
    const ctx = document
      .createElement('canvas')
      .getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(box, '::after').backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data[3]! / 255;
  });

test.describe('prism-checkbox: state layer (shared 6 / 11 / 15% overlays)', () => {
  test('off: rest none, hover 6%, pressed 12%', async ({ page }) => {
    await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
    expect(await overlayAlpha(page)).toBe(0);
    await box(page, 'C').hover();
    expect(await overlayAlpha(page)).toBeCloseTo(0.06, 2);
    await page.mouse.down();
    expect(await overlayAlpha(page)).toBeCloseTo(0.12, 2);
    await page.mouse.up();
  });

  test('on or indeterminate: selected 11% at rest, selected and hovered 15%', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-checkbox id="c" label="C" checked></prism-checkbox>
       <prism-checkbox id="m" label="M" indeterminate></prism-checkbox>`,
    );
    expect(await overlayAlpha(page)).toBeCloseTo(0.11, 2);
    expect(await overlayAlpha(page, '#m')).toBeCloseTo(0.11, 2);
    await box(page, 'C').hover();
    expect(await overlayAlpha(page)).toBeCloseTo(0.15, 2);
    await box(page, 'M').hover();
    expect(await overlayAlpha(page, '#m')).toBeCloseTo(0.15, 2);
  });
});

// ---- contrast ----

type RGB = [number, number, number];
const lum = ([r, g, b]: RGB) => {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

/** What the eye sees, as sRGB: page, edge, fill under its overlay, mark. */
async function looks(page: Page, state: 'rest' | 'hover' | 'pressed') {
  if (state !== 'rest') {
    await box(page, 'C').hover();
    if (state === 'pressed') await page.mouse.down();
  }
  const out = await host(page).evaluate((el) => {
    const q = (p: string) => el.shadowRoot!.querySelector(`[part="${p}"]`)!;
    const ctx = document
      .createElement('canvas')
      .getContext('2d', { willReadFrequently: true })!;
    const px = (layers: string[]): number[] => {
      ctx.clearRect(0, 0, 1, 1);
      for (const c of layers) {
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
      }
      return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const cs = (n: Element, pe?: string) => getComputedStyle(n, pe);
    const bg = cs(el.parentElement!).backgroundColor;
    const overlay = cs(q('box'), '::after').backgroundColor;
    const on = (q('base') as HTMLInputElement).checked;
    const face = on
      ? cs(q('fill')).backgroundColor
      : cs(q('box')).backgroundColor;
    return {
      bg: px([bg]),
      edge: px([bg, cs(q('edge')).borderTopColor]),
      face: px([bg, face, overlay]),
      mark: px([bg, face, overlay, cs(q('mark')).color]),
      on,
    };
  });
  if (state === 'pressed') await page.mouse.up();
  return out;
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`prism-checkbox: AA contrast (${theme})`, () => {
    for (const checked of [false, true]) {
      for (const state of ['rest', 'hover', 'pressed'] as const) {
        test(`${checked ? 'on' : 'off'}, ${state}: edge or fill vs page >= 3:1, mark vs fill >= 3:1`, async ({
          page,
        }) => {
          await setup(
            page,
            `<div data-prism-theme="${theme}" style="background:var(--prism-color-bg);padding:24px"><prism-checkbox id="c" label="C" ${checked ? 'checked' : ''}></prism-checkbox></div>`,
          );
          const l = await looks(page, state);
          expect(l.on).toBe(checked);
          expect(
            ratio((checked ? l.face : l.edge) as RGB, l.bg as RGB),
          ).toBeGreaterThanOrEqual(3);
          if (checked)
            expect(ratio(l.mark as RGB, l.face as RGB)).toBeGreaterThanOrEqual(
              3,
            );
        });
      }
    }

    test('the invalid edge is 3:1 on the page and label text is 4.5:1', async ({
      page,
    }) => {
      await setup(
        page,
        `<div data-prism-theme="${theme}" style="background:var(--prism-color-bg);padding:24px"><prism-checkbox id="c" label="C" required><span slot="error">Tick it.</span></prism-checkbox></div>`,
      );
      await host(page).evaluate((el) =>
        (el as never as HTMLInputElement).reportValidity(),
      );
      const r = await host(page).evaluate((el) => {
        const ctx = document
          .createElement('canvas')
          .getContext('2d', { willReadFrequently: true })!;
        const px = (c: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        };
        const q = (p: string) =>
          getComputedStyle(el.shadowRoot!.querySelector(`[part="${p}"]`)!);
        return {
          bg: px(getComputedStyle(el.parentElement!).backgroundColor),
          edge: px(q('edge').borderTopColor),
          label: px(q('label').color),
          error: px(q('error').color),
          description: px(q('description').color),
        };
      });
      expect(ratio(r.edge as RGB, r.bg as RGB)).toBeGreaterThanOrEqual(3);
      for (const k of ['label', 'error', 'description'] as const)
        expect(ratio(r[k] as RGB, r.bg as RGB), k).toBeGreaterThanOrEqual(4.5);
    });
  });
}

test('focus ring shows on keyboard focus', async ({ page }) => {
  await setup(page, '<prism-checkbox id="c" label="C"></prism-checkbox>');
  await page.keyboard.press('Tab');
  const sh = await host(page).evaluate(
    (el) =>
      getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!)
        .boxShadow,
  );
  expect(sh).not.toMatch(/^(0px 0px 0px 0px [^,]+(, )?)+$/);
});

// ---- axe ----

const ALL = `
  <prism-checkbox label="Off"></prism-checkbox>
  <prism-checkbox label="On" checked><span slot="description">Sent every Monday morning.</span></prism-checkbox>
  <prism-checkbox label="Some" indeterminate></prism-checkbox>
  <prism-checkbox label="Small" size="sm"></prism-checkbox>
  <prism-checkbox label="Large" size="lg" checked></prism-checkbox>
  <prism-checkbox label="Disabled off" disabled></prism-checkbox>
  <prism-checkbox label="Disabled on" checked disabled></prism-checkbox>
  <prism-checkbox label="Hidden label" hide-label></prism-checkbox>
  <prism-checkbox id="req" label="Required" required><span slot="error">Tick this to continue.</span></prism-checkbox>`;

for (const theme of ['light', 'dark']) {
  test(`axe: no WCAG A/AA violations (${theme})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(
      page,
      `<div data-prism-theme="${theme}" style="background:var(--prism-color-bg);color:var(--prism-color-text);padding:16px">${ALL}</div>`,
    );
    await page.evaluate(() =>
      (
        document.querySelector('#req') as never as HTMLInputElement
      ).reportValidity(),
    );
    expect(await axe(page)).toEqual([]);
  });
}
