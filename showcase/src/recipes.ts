import { html, type TemplateResult } from 'lit';
import { iconRefresh } from './icons.js';

let uid = 0;

const group = (
  heading: string,
  inner: TemplateResult | Node,
  width = 'none',
) => {
  const id = `recipe-h-${++uid}`;
  return html`<section
    class="section"
    aria-labelledby=${id}
    style="max-inline-size:${width}"
  >
    <h2 id=${id}>${heading}</h2>
    ${inner}
  </section>`;
};

const facts = (rows: [string, string][], label: string) =>
  html`<prism-description-list label=${label}>
    ${rows.map(
      ([k, v]) =>
        html`<prism-description-list-item label=${k}
          >${v}</prism-description-list-item
        >`,
    )}
  </prism-description-list>`;

const listOf = (attrs: Record<string, string | true>, cards: string) => {
  const list = document.createElement('prism-card-list');
  for (const [k, v] of Object.entries(attrs))
    list.setAttribute(k, v === true ? '' : v);
  list.innerHTML = cards;
  return list;
};

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

export const resourceOverview = () =>
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
      <prism-card-title slot="header" level="3" href="#resource-lumen-board-01"
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
  );

export const kpiDashboard = () =>
  html`<section
    data-prism-time-range="Last 24 hours"
    aria-labelledby="kpi-h"
    class="recipe-grid"
  >
    <h2 id="kpi-h" class="recipe-heading">Activity overview</h2>
    <label class="recipe-toolbar"
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
  </section>`;

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

export const pricingPlans = () =>
  group(
    'Choose a plan',
    html`<prism-card-group selection="single" label="Plan" class="pricing-grid">
      ${PLANS.map(
        ([v, name, price, items]) =>
          html`<prism-card
            type="selectable"
            kind="choice"
            value=${v}
            ?selected=${v === 'team'}
          >
            <prism-card-select slot="header"></prism-card-select>
            <prism-card-title slot="header" level="3">${name}</prism-card-title>
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
  );

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

export const integrationCatalog = () =>
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
  );

export const userProfile = () =>
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
  );

export const settingsGroups = () =>
  group(
    'Settings',
    html`<div style="display:grid;gap:16px">
      <prism-card type="collapsible" open>
        <prism-card-title slot="header" level="3">Profile</prism-card-title>
        <div style="display:grid;gap:16px">
          <prism-text-input
            label="Display name"
            value="Iris Vale"
          ></prism-text-input>
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
        <div style="display:grid;gap:8px">
          <prism-checkbox label="New urgent items" checked></prism-checkbox>
          <prism-checkbox label="Weekly summary"></prism-checkbox>
          <prism-checkbox label="Product news"></prism-checkbox>
        </div>
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
  );

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

export const kanbanBoard = () => {
  const board = document.createElement('section');
  board.setAttribute('aria-label', 'Project tasks');
  board.className = 'kanban-board';
  let n = 0;
  for (const [column, cards] of Object.entries(TASKS)) {
    const id = `kanban-h-${++n}`;
    const section = document.createElement('section');
    section.setAttribute('aria-labelledby', id);
    const h = document.createElement('h2');
    h.id = id;
    h.textContent = column;
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
};

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

export const activityFeed = () =>
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
      <prism-card-meta slot="footer">Showing the last 5 events</prism-card-meta>
      <prism-card-actions slot="footer">
        <prism-button variant="ghost"
          >Unread <prism-badge count="12"></prism-badge
        ></prism-button>
      </prism-card-actions>
    </prism-card>`,
    '460px',
  );

export const recipes = [
  resourceOverview,
  kpiDashboard,
  pricingPlans,
  integrationCatalog,
  userProfile,
  settingsGroups,
  kanbanBoard,
  activityFeed,
];
