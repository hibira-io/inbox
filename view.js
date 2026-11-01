// Markup of the bell and the inbox panel, written once against a tiny
// element helper so React (createElement) and Vue (h) render the same
// thing: el(tag, { class, onClick, ... }, ...children).

import { format } from './locales.js';

const ICONS = {
  bell: 'M10 3a5 5 0 0 0-5 5v3l-1.5 2.5h13L15 11V8a5 5 0 0 0-5-5zM8 16a2 2 0 0 0 4 0',
  checks: 'M2.5 10.5l3.5 3.5 7-8M9 13.5l.5.5 7.5-8',
  circle: 'M10 6.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  archive: 'M3 5h14v3H3zM4.5 8v7.5h11V8M8 11h4',
  unarchive: 'M3 5h14v3H3zM4.5 8v7.5h11V8M10 15v-5M8 12l2-2 2 2',
};

export function icon(el, name, size = 18) {
  return el(
    'svg',
    { class: 'hb-in-icon', viewBox: '0 0 20 20', width: size, height: size, 'aria-hidden': 'true', fill: 'none' },
    el('path', {
      d: ICONS[name],
      stroke: 'currentColor',
      'stroke-width': 1.6,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
}

/** "3m", "2h", "Yesterday"…, in the user's language. */
export function ago(iso, locale) {
  if (!iso) return '';
  const s = Math.round((Date.parse(iso) - Date.now()) / 1000);
  const steps = [
    [60, 'second', 1],
    [3600, 'minute', 60],
    [86400, 'hour', 3600],
    [86400 * 7, 'day', 86400],
    [Infinity, 'week', 86400 * 7],
  ];
  try {
    const rtf = new Intl.RelativeTimeFormat(locale || undefined, { numeric: 'auto', style: 'short' });
    for (const [limit, unit, div] of steps) if (Math.abs(s) < limit) return rtf.format(Math.round(s / div), unit);
  } catch {
    return '';
  }
  return '';
}

/** The count shown on a badge: 1–99, then "99+". */
export function badgeText(n) {
  return n > 99 ? '99+' : String(n);
}

function initial(n) {
  const s = String(n.category || n.title || '?').trim();
  return [...s][0]?.toUpperCase() ?? '?';
}

function action(el, name, label, onClick) {
  return el(
    'button',
    {
      type: 'button',
      class: 'hb-in-action',
      'aria-label': label,
      'data-tip': label,
      onClick: (e) => {
        e.stopPropagation();
        onClick();
      },
    },
    icon(el, name, 16),
  );
}

function item(el, n, client, t, opts) {
  const unread = !n.read_at && !n.archived_at;
  const open = () => {
    if (unread) client.markRead([n.id]).catch(() => {});
    if (opts.onSelect) opts.onSelect(n);
    else if (n.url && typeof window !== 'undefined') window.location.assign(n.url);
  };
  return el(
    'li',
    {
      key: n.id,
      class: `hb-in-item${unread ? ' hb-in-item--unread' : ''}`,
      role: 'button',
      tabindex: 0,
      'data-id': n.id,
      onClick: open,
      onKeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      },
    },
    n.icon
      ? el('img', { class: 'hb-in-avatar', src: n.icon, alt: '', loading: 'lazy' })
      : el('span', { class: 'hb-in-avatar', 'aria-hidden': 'true' }, initial(n)),
    el(
      'div',
      { class: 'hb-in-text' },
      el('div', { class: 'hb-in-title' }, n.title),
      n.body ? el('div', { class: 'hb-in-body' }, n.body) : null,
      el('time', { class: 'hb-in-time', dateTime: n.created_at, title: new Date(n.created_at).toLocaleString(opts.locale || undefined) }, ago(n.created_at, opts.locale)),
    ),
    el(
      'div',
      { class: 'hb-in-actions' },
      n.archived_at
        ? action(el, 'unarchive', t.unarchive, () => client.unarchive([n.id]).catch(() => {}))
        : [
            unread
              ? action(el, 'checks', t.markRead, () => client.markRead([n.id]).catch(() => {}))
              : action(el, 'circle', t.markUnread, () => client.markUnread([n.id]).catch(() => {})),
            action(el, 'archive', t.archive, () => client.archive([n.id]).catch(() => {})),
          ],
    ),
    unread ? el('span', { class: 'hb-in-dot', 'aria-hidden': 'true' }) : null,
  );
}

/** The inbox panel: header, tabs, list. */
export function renderInbox(el, state, client, t, opts = {}) {
  const tabs = opts.tabs ?? ['', 'unread', 'archived'];
  let body;
  if (state.error && !state.items.length) {
    body = el(
      'div',
      { class: 'hb-in-state' },
      el('p', {}, t.error),
      el('button', { type: 'button', class: 'hb-in-button', onClick: () => client.refresh() }, t.retry),
    );
  } else if (state.loading && !state.items.length) {
    body = el(
      'ul',
      { class: 'hb-in-list', 'aria-busy': 'true', 'aria-label': t.loading },
      [0, 1, 2].map((i) =>
        el('li', { key: i, class: 'hb-in-item hb-in-item--skeleton' }, el('span', { class: 'hb-in-avatar' }), el('div', { class: 'hb-in-text' }, el('span', { class: 'hb-in-line' }), el('span', { class: 'hb-in-line hb-in-line--short' }))),
      ),
    );
  } else if (!state.items.length) {
    body = el('div', { class: 'hb-in-state hb-in-state--empty' }, icon(el, 'bell', 28), el('p', {}, t.empty[state.status] ?? t.empty['']));
  } else {
    body = el(
      'ul',
      { class: 'hb-in-list' },
      state.items.map((n) => item(el, n, client, t, opts)),
      state.next
        ? el(
            'li',
            { key: '_more', class: 'hb-in-more' },
            el('button', { type: 'button', class: 'hb-in-button', disabled: state.loadingMore, onClick: () => client.loadMore() }, state.loadingMore ? t.loading : t.loadMore),
          )
        : null,
    );
  }
  return el(
    'section',
    { class: 'hb-in', 'aria-label': t.title },
    el(
      'header',
      { class: 'hb-in-head' },
      el('h2', { class: 'hb-in-heading' }, t.title),
      state.unread > 0 ? action(el, 'checks', t.markAllRead, () => client.markAllRead().catch(() => {})) : null,
    ),
    el(
      'div',
      { class: 'hb-in-tabs', role: 'tablist' },
      tabs.map((s) =>
        el(
          'button',
          {
            key: s || 'inbox',
            type: 'button',
            role: 'tab',
            class: `hb-in-tab${state.status === s ? ' hb-in-tab--on' : ''}`,
            'aria-selected': state.status === s ? 'true' : 'false',
            onClick: () => client.setStatus(s),
          },
          t.tabs[s] ?? s,
          s === '' && state.unread > 0 ? el('span', { class: 'hb-in-count' }, badgeText(state.unread)) : null,
        ),
      ),
    ),
    body,
  );
}

/** The bell button with its unread badge. */
export function renderBell(el, { unread, open, onToggle }, t) {
  const label = unread > 0 ? `${t.bell}, ${format(t.unreadCount, { count: unread })}` : t.bell;
  return el(
    'button',
    { type: 'button', class: 'hb-in-bell', 'aria-label': label, 'aria-haspopup': 'dialog', 'aria-expanded': open ? 'true' : 'false', onClick: onToggle },
    icon(el, 'bell', 20),
    unread > 0 ? el('span', { class: 'hb-in-badge', 'aria-hidden': 'true' }, badgeText(unread)) : null,
  );
}
