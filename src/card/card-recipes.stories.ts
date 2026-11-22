import type { Meta, StoryObj } from '@storybook/web-components';
import { html, render, svg, type TemplateResult } from 'lit';
import './define.js';
import '../button/define.js';
import '../select/define.js';
import '../option/define.js';
import '../text-field/define.js';
import '../tag/define.js';
import '../badge/define.js';
import '../avatar/define.js';
import '../progress/define.js';
import '../running-indicator/define.js';
import '../switch/define.js';
import '../description-list/define.js';
import { iconRefresh } from '../internal/icons.js';
import { createDashboardRows } from './dashboard-rows.recipe.js';

/**
 * Card recipes: whole screens' worth of cards assembled from the card parts and
 * the library's own Tag, Badge, Avatar, Progress, Description list, Button, Select and
 * Text field. No inline stand-ins; nothing here defines an element. Every name, number and date is made up.
 *
 * Rules every recipe follows:
 * - Each card title is a real heading. Cards sit under an h2 for their group,
 *   so the cards are h3.
 * - Every icon-only control has a label that names its card.
 * - Priority and status are always written as words, never colour alone.
 * - Footers hold meta and at most two actions, and at most one primary, only on
 *   a standalone task card.
 */

const meta: Meta = {
  title: 'Card recipes',
  parameters: { layout: 'padded' },
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj;

// ---- small helpers, local to these stories ----

let uid = 0;
/** A group of cards under its own h2, so the cards' h3 titles nest correctly. */
const group = (
  heading: string,
  inner: TemplateResult | Node,
  width = 'none',
) => {
  const id = `recipe-h-${++uid}`;
  return html`<section aria-labelledby=${id} style="max-inline-size:${width}">
    <h2
      id=${id}
      style="margin:0 0 16px;font:600 20px/28px var(--prism-font-family-sans);color:var(--prism-color-text)"
    >
      ${heading}
    </h2>
    ${inner}
  </section>`;
};

/** Key facts: label and value pairs, aligned in two columns (Description list). */
const facts = (rows: [string, string][], label: string) =>
  html`<prism-description-list label=${label}>
    ${rows.map(
      ([k, v]) =>
        html`<prism-description-list-item label=${k}
          >${v}</prism-description-list-item
        >`,
    )}
  </prism-description-list>`;

const dot = (shape: 'circle' | 'square' | 'tri') =>
  html`<svg
    slot="header"
    data-prism-card-icon
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    ${
      shape === 'circle'
        ? svg`<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" />`
        : shape === 'square'
          ? svg`<rect
              x="2.5"
              y="2.5"
              width="11"
              height="11"
              fill="none"
              stroke="currentColor"
            />`
          : svg`<path d="M8 2 14 14H2Z" fill="none" stroke="currentColor" />`
    }
  </svg>`;

/** Reorderable lists move their cards in the DOM, so build them as HTML strings. */
const listOf = (attrs: Record<string, string | true>, cards: string) => {
  const list = document.createElement('prism-card-list');
  for (const [k, v] of Object.entries(attrs))
    list.setAttribute(k, v === true ? '' : v);
  list.innerHTML = cards;
  return list;
};

// ---------------------------------------------------------------------------
// 1. Resource overview
// ---------------------------------------------------------------------------

/**
 * One resource at a glance. A clickable card: the title is the one link, the
 * overflow menu keeps working above it. The status is a word, with a Tag.
 */
export const ResourceOverview: Story = {
  render: () =>
    group(
      'Resources',
      html`<prism-card type="clickable" raised>
        <prism-running-indicator
          slot="header"
          data-prism-card-icon
          size="sm"
          tone="success"
          label="lumen-board-01 is online"
        ></prism-running-indicator>
        <prism-card-title
          slot="header"
          level="3"
          href="#resource-lumen-board-01"
          >lumen-board-01</prism-card-title
        >
        <prism-tag slot="header" job="health" tone="success" emphasis="ghost"
          >Online</prism-tag
        >
        <prism-card-description slot="header"
          >Lumen Board 9, Aurora Bay</prism-card-description
        >
        <prism-card-actions slot="header">
          <prism-menu label="More options for lumen-board-01">
            <prism-menu-item>Refresh</prism-menu-item>
            <prism-menu-item>Pause</prism-menu-item>
            <prism-menu-item>Export details</prism-menu-item>
          </prism-menu>
        </prism-card-actions>
        ${facts(
          [
            ['Workspace', 'Aperture Labs'],
            ['Version', '7.14.2'],
            ['Region', 'Aurora Bay'],
            ['Open items', '2'],
            ['Profile', 'Standard'],
          ],
          'lumen-board-01 details',
        )}
        <prism-progress
          label="Storage used"
          value="72"
          show-value
          tone="warning"
          style="margin-block-start:12px"
        ></prism-progress>
        <prism-card-meta slot="footer">Updated 4 min ago</prism-card-meta>
      </prism-card>`,
      '420px',
    ),
};

// ---------------------------------------------------------------------------
// 2. Resource grid
// ---------------------------------------------------------------------------

const HEALTH_TONE: Record<string, string> = {
  Online: 'success',
  Offline: 'danger',
  'Needs update': 'warning',
};
const RESOURCES_GRID: [string, string, string, string][] = [
  ['prism-panel-07', 'Aurora OS 15', 'Online', 'Updated 2 min ago'],
  ['prism-panel-12', 'Lumen OS 11', 'Online', 'Seen 9 min ago'],
  ['spectra-board-02', 'Spectra OS 6.8', 'Offline', 'Seen 3 days ago'],
  ['lumen-board-02', 'Spectra OS 6.8', 'Online', 'Seen 1 min ago'],
  ['halo-panel-21', 'Lumen OS 10', 'Needs update', 'Seen 1 hour ago'],
  ['halo-panel-05', 'Halo Mobile 15', 'Online', 'Seen 14 min ago'],
];

/**
 * Many resources in the card list: one to four columns from the list's own width,
 * never narrower than 280px, 16px apart. Each card is a link.
 */
export const ResourceGrid: Story = {
  render: () =>
    group(
      'Resources',
      listOf(
        { label: 'Resources' },
        RESOURCES_GRID.map(
          ([name, os, status, seen]) => `<prism-card type="clickable">
            <prism-card-title slot="header" level="3" href="#${name}">${name}</prism-card-title>
            <prism-tag slot="header" job="health" tone="${HEALTH_TONE[status]}">${status}</prism-tag>
            <prism-card-description slot="header">${os}</prism-card-description>
            <prism-card-meta slot="footer">${seen}</prism-card-meta>
          </prism-card>`,
        ).join(''),
      ),
    ),
};

// ---------------------------------------------------------------------------
// 3. Open items with priority
// ---------------------------------------------------------------------------

const PRIORITY_TONE: Record<string, string> = {
  Urgent: 'danger',
  High: 'danger',
  Normal: 'neutral',
  Low: 'info',
};
const OPEN_ITEMS: [string, string, string, string][] = [
  [
    'Urgent',
    'Lumen Bloom export failed',
    'prism-panel-07',
    'A render job stopped before it finished.',
  ],
  [
    'High',
    'Prism Shard upload stalled',
    'halo-panel-21',
    'A file upload paused and did not resume.',
  ],
  [
    'Normal',
    'Unusual usage spike',
    'Iris Vale',
    'Storage use is higher than in the last 90 days.',
  ],
  [
    'Low',
    'Refraction-7 update available',
    'lumen-board-02',
    'A newer version is ready to install.',
  ],
];

/**
 * Item cards. Priority is a Tag with the word in it (never colour alone) and
 * is the first thing after the title. The footer has meta and two actions, no
 * primary.
 */
export const OpenItems: Story = {
  render: () =>
    group(
      'Open items',
      html`<div style="display:grid;gap:16px">
        ${OPEN_ITEMS.map(
          ([level, title, who, text]) =>
            html`<prism-card>
              <prism-card-title slot="header" level="3"
                >${title}</prism-card-title
              >
              <prism-tag
                slot="header"
                job="spectrum"
                tone=${PRIORITY_TONE[level] ?? 'neutral'}
                emphasis=${level === 'Urgent' ? 'high' : 'low'}
                >${level}</prism-tag
              >
              <prism-card-description slot="header"
                >${who}</prism-card-description
              >
              <p style="margin:0">${text}</p>
              <prism-card-meta slot="footer">Opened 12 min ago</prism-card-meta>
              <prism-card-actions slot="footer">
                <prism-button variant="ghost">Dismiss</prism-button>
                <prism-button variant="secondary">Review</prism-button>
              </prism-card-actions>
            </prism-card>`,
        )}
      </div>`,
      '520px',
    ),
};

// ---------------------------------------------------------------------------
// 4. KPI widget dashboard
// ---------------------------------------------------------------------------

const kpi = (
  title: string,
  label: string,
  value: string,
  extra: {
    range?: string;
    state?: string;
    message?: string;
    live?: boolean;
  } = {},
) =>
  html`<prism-card
    type="widget"
    range=${extra.range ?? ''}
    state=${extra.state ?? ''}
    state-message=${extra.message ?? ''}
  >
    <prism-card-title slot="header" level="3">${title}</prism-card-title>
    ${
      extra.live
        ? html`<prism-badge
            slot="header"
            job="status"
            status="live"
          ></prism-badge>`
        : ''
    }
    <prism-card-actions slot="header">
      <prism-icon-button label="Refresh ${title}"
        >${iconRefresh()}</prism-icon-button
      >
      <prism-menu label="More options for ${title}">
        <prism-menu-item>Configure</prism-menu-item>
        <prism-menu-item>Export</prism-menu-item>
      </prism-menu>
    </prism-card-actions>
    <prism-card-metric label=${label}>${value}</prism-card-metric>
    <prism-card-meta slot="footer">Updated 2 min ago</prism-card-meta>
    <prism-card-actions slot="footer">
      <prism-button variant="ghost" size="sm">View all</prism-button>
    </prism-card-actions>
  </prism-card>`;

/**
 * A dashboard of widgets. The select sets the page's time range, every widget
 * follows it, and "Feedback notes" overrides it with its own range. The last
 * widget shows the loading state.
 */
export const KpiDashboard: Story = {
  render: () =>
    html`<section
      data-prism-time-range="Last 24 hours"
      aria-labelledby="kpi-h"
      style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));max-inline-size:960px"
    >
      <h2
        id="kpi-h"
        style="grid-column:1/-1;margin:0;font:600 20px/28px var(--prism-font-family-sans)"
      >
        Activity overview
      </h2>
      <label style="grid-column:1/-1;font:14px var(--prism-font-family-sans)"
        >Time range
        <select
          data-prism-select
          @change=${(e: Event) =>
            (e.target as HTMLElement)
              .closest('section')
              ?.setAttribute(
                'data-prism-time-range',
                (e.target as HTMLSelectElement).value,
              )}
        >
          <option>Last 24 hours</option>
          <option>Last 7 days</option>
          <option>Last 30 days</option>
        </select>
      </label>
      ${kpi('Items', 'Items', '1,284', { live: true })}
      ${kpi('Resources to review', 'Resources', '37')}
      ${kpi('Feedback notes', 'Notes', '212', { range: 'Last 30 days' })}
      ${kpi('Mean time to resolve', 'Minutes', '18', { state: 'loading' })}
    </section>`,
};

// ---------------------------------------------------------------------------
// 5. Pricing / plan choice
// ---------------------------------------------------------------------------

const PLANS: [string, string, string, string[]][] = [
  [
    'free',
    'Starter',
    '$0 per month',
    ['1 workspace', '3 members', 'Community help'],
  ],
  [
    'team',
    'Team',
    '$12 per member per month',
    ['Unlimited workspaces', 'Shared dashboards', 'Email help'],
  ],
  [
    'ent',
    'Enterprise',
    'Talk to sales',
    ['Team directory sync', 'Activity log export', 'Named contact'],
  ],
];

/**
 * Choice cards in a radio group: pick one plan. Click anywhere on a card, or
 * use the arrow keys. The price is text in the description, and the "Most
 * popular" note is a Tag.
 */
export const PricingPlans: Story = {
  render: () =>
    group(
      'Choose a plan',
      html`<prism-card-group
        selection="single"
        label="Plan"
        style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))"
      >
        ${PLANS.map(
          ([v, name, price, items]) =>
            html`<prism-card
              type="selectable"
              kind="choice"
              value=${v}
              ?selected=${v === 'team'}
            >
              <prism-card-select slot="header"></prism-card-select>
              <prism-card-title slot="header" level="3"
                >${name}</prism-card-title
              >
              ${
                v === 'team'
                  ? html`<prism-tag slot="header" tone="accent"
                      >Most popular</prism-tag
                    >`
                  : ''
              }
              <prism-card-description slot="header"
                >${price}</prism-card-description
              >
              <ul style="margin:0;padding-inline-start:20px">
                ${items.map((i) => html`<li>${i}</li>`)}
              </ul>
            </prism-card>`,
        )}
      </prism-card-group>`,
      '900px',
    ),
};

// ---------------------------------------------------------------------------
// 6. Integration catalog
// ---------------------------------------------------------------------------

const APPS: [string, string, string, string, 'circle' | 'square' | 'tri'][] = [
  [
    'Calendar sync',
    'Productivity',
    'Connected',
    'Show events beside updates.',
    'circle',
  ],
  [
    'Chat notifications',
    'Messaging',
    'Connected',
    'Post new items to a channel.',
    'square',
  ],
  [
    'Ticket tracker',
    'Workflow',
    'Available',
    'Open a ticket from any item.',
    'tri',
  ],
  [
    'Cloud storage',
    'Storage',
    'Available',
    'Save exported reports to a bucket.',
    'circle',
  ],
  [
    'Team directory',
    'Directory',
    'Beta',
    'Sync groups from your directory.',
    'square',
  ],
  [
    'Status page',
    'Communication',
    'Available',
    'Share status updates publicly.',
    'tri',
  ],
];

const APP_TONE: Record<string, string> = {
  Connected: 'success',
  Available: 'neutral',
  Beta: 'info',
};
const shapeSvg = (s: 'circle' | 'square' | 'tri') =>
  `<svg slot="header" data-prism-card-icon width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${
    s === 'circle'
      ? '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor"/>'
      : s === 'square'
        ? '<rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor"/>'
        : '<path d="M8 2 14 14H2Z" fill="none" stroke="currentColor"/>'
  }</svg>`;

/** A catalog in the card list. The state is a Tag in words, the category is footer meta. */
export const IntegrationCatalog: Story = {
  render: () =>
    group(
      'Integrations',
      listOf(
        { label: 'Integrations' },
        APPS.map(
          ([name, cat, status, text, shape]) => `<prism-card type="clickable">
            ${shapeSvg(shape)}
            <prism-card-title slot="header" level="3" href="#${name.toLowerCase().replace(/ /g, '-')}">${name}</prism-card-title>
            <prism-tag slot="header" job="${status === 'Beta' ? 'keyword' : 'presence'}" tone="${APP_TONE[status]}">${status}</prism-tag>
            <p style="margin:0">${text}</p>
            <prism-card-meta slot="footer">${cat}</prism-card-meta>
          </prism-card>`,
        ).join(''),
      ),
    ),
};

// ---------------------------------------------------------------------------
// 7. User / profile
// ---------------------------------------------------------------------------

/** A person. The avatar is decorative (the name is the title), actions are text buttons. */
export const UserProfile: Story = {
  render: () =>
    group(
      'Team',
      html`<prism-card>
        <prism-avatar
          slot="header"
          name="Iris Vale"
          size="sm"
          decorative
        ></prism-avatar>
        <prism-card-title slot="header" level="3">Iris Vale</prism-card-title>
        <prism-tag slot="header" job="keyword">Admin</prism-tag>
        <prism-card-description slot="header"
          >Product designer, Halo Harbor</prism-card-description
        >
        ${facts(
          [
            ['Email', 'iris.vale@example.com'],
            ['Workspace', 'Halo Studio'],
            ['Team', 'Optics'],
            ['Joined', 'March 2024'],
          ],
          'Iris Vale details',
        )}
        <prism-card-meta slot="footer">Active today</prism-card-meta>
        <prism-card-actions slot="footer">
          <prism-button variant="ghost">Message</prism-button>
          <prism-button variant="secondary">View profile</prism-button>
        </prism-card-actions>
      </prism-card>`,
      '420px',
    ),
};

// ---------------------------------------------------------------------------
// 8. Onboarding and marketing (content-only)
// ---------------------------------------------------------------------------

const promo = (heading: string, text: string, later: string, go: string) =>
  html`<prism-card>
    <h3 style="margin:0 0 4px;font:600 16px/24px var(--prism-font-family-sans)">
      ${heading}
    </h3>
    <p style="margin:0">${text}</p>
    <prism-card-actions>
      <prism-button variant="ghost">${later}</prism-button>
      <prism-button variant="secondary">${go}</prism-button>
    </prism-card-actions>
  </prism-card>`;

/**
 * Content-only cards: no header, no footer. The heading is the first thing in
 * the content. Buttons sit at the end, 8px apart: ghost, then soft.
 */
export const OnboardingAndMarketing: Story = {
  render: () =>
    group(
      'Get started',
      html`<div
        style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))"
      >
        ${promo(
          'Add a profile photo',
          'A photo helps your team recognize you in lists and comments.',
          'Later',
          'Set up',
        )}
        ${promo(
          'Invite your team',
          'Share dashboards and updates. It takes a minute.',
          'Skip',
          'Invite',
        )}
        ${promo(
          'What is new in Lumen Console 3.2',
          'Faster search, a calmer dashboard and better keyboard support.',
          'Dismiss',
          'Read more',
        )}
        <prism-card>
          <h3
            style="margin:0 0 12px;font:600 16px/24px var(--prism-font-family-sans)"
          >
            Finish setting up
          </h3>
          <prism-progress
            label="Setup progress"
            value="3"
            max="5"
            value-text="3 of 5 steps"
            show-value
          ></prism-progress>
          <prism-card-actions>
            <prism-button variant="secondary">Continue</prism-button>
          </prism-card-actions>
        </prism-card>
      </div>`,
      '960px',
    ),
};

// ---------------------------------------------------------------------------
// 9. Collapsible settings groups
// ---------------------------------------------------------------------------

/**
 * Settings in collapsible cards. The title row is the toggle. A group people
 * need on first view is open. Each form control has a visible label.
 */
export const SettingsGroups: Story = {
  render: () =>
    group(
      'Settings',
      html`<div style="display:grid;gap:16px">
        <prism-card type="collapsible" open>
          <prism-card-title slot="header" level="3">Profile</prism-card-title>
          <div style="display:grid;gap:16px">
            <prism-text-field
              label="Display name"
              value="Iris Vale"
            ></prism-text-field>
            <prism-select label="Language" value="en">
              <prism-option value="en">English</prism-option>
              <prism-option value="pt">Portuguese</prism-option>
              <prism-option value="de">German</prism-option>
            </prism-select>
          </div>
          <prism-card-actions slot="footer">
            <prism-button variant="ghost">Reset</prism-button>
            <prism-button variant="secondary">Save</prism-button>
          </prism-card-actions>
        </prism-card>
        <prism-card type="collapsible">
          <prism-card-title slot="header" level="3"
            >Notifications</prism-card-title
          >
          <fieldset style="margin:0;padding:0;border:0;display:grid;gap:8px">
            <legend style="padding:0;margin-block-end:8px">
              Email me about
            </legend>
            <label><input type="checkbox" checked /> New urgent items</label>
            <label><input type="checkbox" /> Weekly summary</label>
            <label><input type="checkbox" /> Product news</label>
          </fieldset>
        </prism-card>
        <prism-card type="collapsible">
          <prism-card-title slot="header" level="3"
            >Data retention</prism-card-title
          >
          <prism-select label="Keep items for" value="90">
            <prism-option value="30">30 days</prism-option>
            <prism-option value="90">90 days</prism-option>
            <prism-option value="365">1 year</prism-option>
          </prism-select>
          <prism-card-meta slot="footer">Changed 2 weeks ago</prism-card-meta>
        </prism-card>
      </div>`,
      '520px',
    ),
};

// ---------------------------------------------------------------------------
// 10. Kanban columns (reorder-group)
// ---------------------------------------------------------------------------

const TASKS: Record<string, [string, string, string, string][]> = {
  'To do': [
    ['Review layout rules', 'Quill M.', 'High', 'Due Nov 4'],
    ['Update gallery panels', 'Rowan T.', 'Normal', 'Due Nov 6'],
    ['Update handbook', 'Iris V.', 'Low', 'Due Nov 12'],
  ],
  'In progress': [
    ['Review usage spike', 'Iris V.', 'High', 'Due Nov 1'],
    ['Rename shared folders', 'Rowan T.', 'Normal', 'Due Nov 3'],
  ],
  Done: [['Publish the style guide', 'Quill M.', 'Normal', 'Done Oct 27']],
};

/**
 * Columns are three card lists in one `reorder-group`, so a card can be dragged
 * between them. Without a mouse: open the "Reorder {title}" button and use Move
 * to top, up, down or bottom. (To move between columns by keyboard, an app would
 * add its own menu items; this recipe only reorders within a column.) Each move
 * is announced with the column names.
 */
export const KanbanBoard: Story = {
  render: () => {
    const board = document.createElement('section');
    board.setAttribute('aria-label', 'Project tasks');
    board.style.cssText =
      'display:grid;gap:24px;grid-template-columns:repeat(3,minmax(0,300px));align-items:start';
    let n = 0;
    for (const [column, cards] of Object.entries(TASKS)) {
      const id = `kanban-h-${++n}`;
      const section = document.createElement('section');
      section.setAttribute('aria-labelledby', id);
      const h = document.createElement('h2');
      h.id = id;
      h.textContent = column;
      h.style.cssText =
        'margin:0 0 12px;font:600 16px/24px var(--prism-font-family-sans)';
      section.append(
        h,
        listOf(
          {
            label: column,
            reorderable: true,
            'reorder-group': 'project-tasks',
            columns: '1',
          },
          cards
            .map(
              ([title, who, pri, due]) => `<prism-card value="${title}">
                <prism-card-handle slot="header"></prism-card-handle>
                <prism-card-title slot="header" level="3">${title}</prism-card-title>
                <prism-tag slot="header" job="keyword" tone="${pri === 'High' ? 'danger' : 'neutral'}">${pri}</prism-tag>
                <prism-card-description slot="header">${who}</prism-card-description>
                <prism-card-meta slot="footer">${due}</prism-card-meta>
              </prism-card>`,
            )
            .join(''),
        ),
      );
      board.append(section);
    }
    return board;
  },
};

// ---------------------------------------------------------------------------
// 11. Selectable report list with a count
// ---------------------------------------------------------------------------

const REPORTS: [string, string, string][] = [
  ['Weekly items', 'Every Monday', 'Oct 27'],
  ['Resource coverage', 'Every month', 'Oct 1'],
  ['Usage trends', 'Every Friday', 'Oct 24'],
  ['Member sign-ins', 'Every day', 'Oct 28'],
  ['Settings changes', 'On demand', 'Oct 15'],
];

/**
 * A list of collection cards. Only the checkbox selects; the title stays a link.
 * "N selected" and "Clear selection" appear above the list on their own, and a
 * polite message says the count as it changes.
 */
export const SelectableReportList: Story = {
  render: () =>
    group(
      'Reports',
      listOf(
        { label: 'Reports', columns: '1' },
        REPORTS.map(
          (
            [name, when, last],
            i,
          ) => `<prism-card type="selectable" kind="collection" value="r${i}" ${i === 1 ? 'selected' : ''}>
            <prism-card-select slot="header"></prism-card-select>
            <prism-card-title slot="header" level="3" href="#report-${i}">${name}</prism-card-title>
            <prism-card-description slot="header">${when}</prism-card-description>
            <prism-card-meta slot="footer">Last run ${last}</prism-card-meta>
          </prism-card>`,
        ).join(''),
      ),
      '520px',
    ),
};

// ---------------------------------------------------------------------------
// 12. Empty states
// ---------------------------------------------------------------------------

/**
 * Two empty states. First use: the list's `empty` slot holds a short title, one
 * sentence and one button. A quiet one: a plain card that says what is missing
 * and what changes it.
 */
export const EmptyState: Story = {
  render: () => {
    const list = listOf(
      { label: 'Saved searches', state: 'empty', columns: '1' },
      `<prism-card slot="empty">
        <h3 style="margin:0 0 4px;font:600 16px/24px var(--prism-font-family-sans)">No saved searches yet</h3>
        <p style="margin:0">Save a search to run it again with one click.</p>
        <prism-card-actions><prism-button variant="secondary">New search</prism-button></prism-card-actions>
      </prism-card>`,
    );
    return html`<div style="display:grid;gap:32px;max-inline-size:520px">
      ${group('Saved searches', list)}
      ${group(
        'Items',
        html`<prism-card type="borderless">
          <prism-card-title slot="header" level="3"
            >No items in this period</prism-card-title
          >
          <p style="margin:0">
            Nothing matched in the last 24 hours. Try a longer time range.
          </p>
          <prism-card-actions slot="footer">
            <prism-button variant="ghost">Last 7 days</prism-button>
          </prism-card-actions>
        </prism-card>`,
      )}
    </div>`;
  },
};

// ---------------------------------------------------------------------------
// 13. Activity feed
// ---------------------------------------------------------------------------

const ACTIVITY: [string, string, string][] = [
  ['2026-10-29T09:41', '9:41 AM', 'Iris Vale paused prism-panel-07.'],
  [
    '2026-10-29T09:12',
    '9:12 AM',
    'Profile "Standard" was updated by Rowan Thorne.',
  ],
  [
    '2026-10-29T08:55',
    '8:55 AM',
    'An urgent item was opened on spectra-board-02.',
  ],
  [
    '2026-10-28T17:30',
    'Yesterday, 5:30 PM',
    'Weekly items report was sent to 4 people.',
  ],
  [
    '2026-10-28T14:02',
    'Yesterday, 2:02 PM',
    'Quill Mercer signed in from Halo Harbor.',
  ],
];

/** A feed is an ordered list inside one card, newest first, each entry with its time. */
export const ActivityFeed: Story = {
  render: () =>
    group(
      'Today',
      html`<prism-card>
        <prism-card-title slot="header" level="3"
          >Recent activity</prism-card-title
        >
        <prism-card-actions slot="header">
          <prism-icon-button label="Refresh Recent activity"
            >${iconRefresh()}</prism-icon-button
          >
        </prism-card-actions>
        <ol style="margin:0;padding:0;list-style:none;display:grid;gap:12px">
          ${ACTIVITY.map(
            ([iso, text, what]) =>
              html`<li>
                <time
                  datetime=${iso}
                  style="display:block;color:var(--prism-color-text-muted)"
                  >${text}</time
                >${what}
              </li>`,
          )}
        </ol>
        <prism-card-meta slot="footer"
          >Showing the last 5 events</prism-card-meta
        >
        <prism-card-actions slot="footer">
          <prism-button variant="ghost"
            >Unread <prism-badge count="12"></prism-badge
          ></prism-button>
        </prism-card-actions>
      </prism-card>`,
      '460px',
    ),
};

// ---------------------------------------------------------------------------
// 14. Standalone task
// ---------------------------------------------------------------------------

/** The one place a primary button belongs: a standalone task card with one next step. */
export const ProjectTask: Story = {
  render: () =>
    group(
      'Needs you',
      html`<prism-card standalone raised>
        <prism-card-title slot="header" level="3"
          >Review the Lumen Bloom update</prism-card-title
        >
        <prism-tag slot="header" job="spectrum" tone="danger" emphasis="high"
          >Urgent</prism-tag
        >
        <prism-card-description slot="header"
          >prism-panel-07</prism-card-description
        >
        <p style="margin:0">
          The export was paused. Confirm the files look right before it
          restarts.
        </p>
        <prism-card-meta slot="footer">Opened 12 min ago</prism-card-meta>
        <prism-card-actions slot="footer">
          <prism-button variant="ghost">Snooze</prism-button>
          <prism-button>Start review</prism-button>
        </prism-card-actions>
      </prism-card>`,
      '460px',
    ),
};

// ---------------------------------------------------------------------------
// 13. Dashboard rows (reorder-group across rows)
// ---------------------------------------------------------------------------

/**
 * Three rows of three widget cards. Each row is its own drop zone in one
 * `reorder-group`. Drag a card to another row and that row takes four while the
 * source keeps two. Every row shares its width equally, whatever it holds: one
 * card fills the row, and an empty row stays a dashed drop target.
 *
 * Without a mouse, open "More options for {card}" and use Move earlier, later,
 * to start or to end, or **Move to row N** (every row but the card's own).
 * Focus stays on that menu button, and each move is announced with the row
 * names. **Reset layout** puts the cards back in 3 x 3 and says so.
 */
export const DashboardRows: Story = {
  render: () => createDashboardRows(),
};

// ---------------------------------------------------------------------------
// 15. Running job
// ---------------------------------------------------------------------------

/**
 * A card for a job that is running now. While it runs, a small Running
 * indicator sits in the header ahead of the title (it is a status region, so
 * screen readers hear "Running"), the Tag says "In progress" and a Progress bar
 * shows the amount done. A Switch inside the card sets whether to notify you
 * when it finishes; it takes effect at once, so the card has no Save button.
 * **Stop** ends the job: the indicator goes, the Tag says "Stopped" and the
 * action becomes **Run again**. Under reduced motion the indicator's ring
 * holds still. The words, not the motion, carry the status.
 */
export const RunningJob: Story = {
  render: () => {
    const host = document.createElement('div');
    let running = true;
    let notify = true;
    const draw = () =>
      render(
        group(
          'Exports',
          html`<prism-card standalone raised>
            ${
              running
                ? html`<prism-running-indicator
                    slot="header"
                    data-prism-card-icon
                    size="sm"
                    label="Export running"
                  ></prism-running-indicator>`
                : dot('circle')
            }
            <prism-card-title slot="header" level="3"
              >Lumen Bloom export</prism-card-title
            >
            <prism-tag
              slot="header"
              job="status"
              tone=${running ? 'accent' : 'neutral'}
              >${running ? 'In progress' : 'Stopped'}</prism-tag
            >
            <prism-card-description slot="header"
              >Preview render for 12 panels</prism-card-description
            >
            <prism-progress
              label="Panels rendered"
              value="7"
              max="12"
              value-text="7 of 12 panels"
              show-value
              tone=${running ? 'accent' : 'neutral'}
            ></prism-progress>
            <prism-switch
              label="Notify me when it finishes"
              size="sm"
              style="margin-block-start:16px"
              ?checked=${notify}
              @change=${(e: Event) => {
                notify = (e.target as HTMLInputElement & { checked: boolean })
                  .checked;
              }}
            ></prism-switch>
            <prism-card-meta slot="footer"
              >${running ? 'Started 2 min ago' : 'Stopped 1 min ago'}</prism-card-meta
            >
            <prism-card-actions slot="footer">
              <prism-button
                variant="secondary"
                @click=${() => {
                  running = !running;
                  draw();
                }}
                >${running ? 'Stop' : 'Run again'}</prism-button
              >
            </prism-card-actions>
          </prism-card>`,
          '460px',
        ),
        host,
      );
    draw();
    return host;
  },
};
