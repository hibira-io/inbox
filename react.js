// React components for the notification inbox: <NotificationBell> (a bell
// with its unread badge that opens the inbox) and <NotificationInbox> (the
// panel alone, for a page or your own popover). Import
// '@hibira-io/inbox/styles.css' for the default look.

import { createElement, useEffect, useRef, useState } from 'react';
import { createInboxClient } from './client.js';
import { labelsFor } from './locales.js';
import { renderBell, renderInbox } from './view.js';

export { createInboxClient } from './client.js';

const RENAME = {
  class: 'className',
  tabindex: 'tabIndex',
  onKeydown: 'onKeyDown',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
};

function el(tag, props, ...children) {
  const out = {};
  for (const [k, v] of Object.entries(props ?? {})) if (v !== undefined) out[RENAME[k] ?? k] = v;
  const kids = children.flat().filter((c) => c != null && c !== false);
  return createElement(tag, out, ...kids);
}

/** Subscribes to an inbox client's state. */
export function useInbox(client) {
  const [state, setState] = useState(() => client.getState());
  useEffect(() => {
    setState(client.getState());
    return client.subscribe(setState);
  }, [client]);
  return state;
}

/**
 * Creates an inbox client for options (see createInboxClient) and destroys
 * it on unmount. A new client is made when appId, the user (userKey) or the
 * host changes.
 */
export function useInboxClient(options) {
  const [client, setClient] = useState(null);
  const opts = useRef(options);
  opts.current = options;
  useEffect(() => {
    const c = createInboxClient({
      ...opts.current,
      token: typeof opts.current.token === 'function' ? (...a) => opts.current.token(...a) : opts.current.token,
    });
    setClient(c);
    return () => c.destroy();
  }, [options.appId, options.userKey, options.host, options.tokenUrl, options.pusher, typeof options.token === 'string' ? options.token : '']);
  return client;
}

/** The inbox panel. */
export function NotificationInbox({ client, locale, labels, onSelect, tabs, className }) {
  const state = useInbox(client);
  const view = renderInbox(el, state, client, labelsFor(locale, labels), { locale, onSelect, tabs });
  return className ? createElement('div', { className }, view) : view;
}

/** A bell with the unread count that opens the inbox in a popover. */
export function NotificationBell({ client, locale, labels, onSelect, tabs, align = 'end', className }) {
  const state = useInbox(client);
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const t = labelsFor(locale, labels);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => root.current && !root.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const select = (n) => {
    setOpen(false);
    if (onSelect) onSelect(n);
    else if (n.url) window.location.assign(n.url);
  };
  return createElement(
    'div',
    { ref: root, className: `hb-in-root${className ? ` ${className}` : ''}` },
    renderBell(el, { unread: state.unread, open, onToggle: () => setOpen((o) => !o) }, t),
    open
      ? createElement(
          'div',
          { className: `hb-in-popover hb-in-popover--${align}`, role: 'dialog', 'aria-label': t.title },
          renderInbox(el, state, client, t, { locale, onSelect: select, tabs }),
        )
      : null,
  );
}
