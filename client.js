// Browser and React Native side of the inbox: reads and marks the signed-in
// user's notifications with a user token, and follows live changes through
// pusher-js (pusher.user, after pusher.signin()). Framework components
// (react.js, vue.js, react-native.js) are thin views over this store.

const DEFAULT_HOST = 'api.hibira.io';
const EVENTS = ['inbox.notification', 'inbox.updated', 'inbox.deleted'];

/** Reads a JWT's exp (seconds) without checking it; 0 when unreadable. */
function tokenExpiry(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')) : '';
    return JSON.parse(json).exp ?? 0;
  } catch {
    return 0;
  }
}

class InboxError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'InboxError';
    this.status = status;
  }
}

/**
 * Creates the inbox store for one user.
 *
 * options:
 *   appId      the Hibira app ID (required)
 *   token      the user token: a string, or a function returning one (or a
 *              promise of one), called again before it expires and after a 401
 *   tokenUrl   instead of token: a URL on your site that answers {token}
 *   pusher     a pusher-js instance signed in as the user, for live updates
 *   host       the HTTP API host (default api.hibira.io); may include http://
 *   pageSize   notifications per page (default 20)
 *   pollInterval  milliseconds between refreshes when there is no pusher
 *              (default 60000, 0 = never)
 *   fetch      a fetch implementation (default globalThis.fetch)
 */
export function createInboxClient(options = {}) {
  const { appId, pusher, pageSize = 20 } = options;
  if (!appId) throw new Error('createInboxClient: appId is required');
  if (!options.token && !options.tokenUrl) throw new Error('createInboxClient: token or tokenUrl is required');
  const doFetch = options.fetch ?? ((...a) => globalThis.fetch(...a));
  const host = options.host ?? DEFAULT_HOST;
  const base = `${/^https?:\/\//.test(host) ? host : `https://${host}`}/apps/${encodeURIComponent(appId)}/inbox/me`;
  const pollInterval = options.pollInterval ?? 60000;

  let token = null;
  let tokenExp = 0;
  let pendingToken = null;

  async function fetchToken() {
    if (typeof options.token === 'string') return options.token;
    if (typeof options.token === 'function') return options.token();
    const res = await doFetch(options.tokenUrl, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new InboxError(res.status, `token endpoint answered ${res.status}`);
    const body = await res.json();
    return body.token;
  }

  async function getToken(force = false) {
    const now = Date.now() / 1000;
    if (!force && token && (tokenExp === 0 || tokenExp - now > 30)) return token;
    if (!pendingToken) {
      pendingToken = Promise.resolve(fetchToken())
        .then((t) => {
          token = t;
          tokenExp = tokenExpiry(t);
          return t;
        })
        .finally(() => (pendingToken = null));
    }
    return pendingToken;
  }

  async function call(method, path, body, retried = false) {
    const t = await getToken(retried);
    const res = await doFetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && !retried && typeof options.token !== 'string') return call(method, path, body, true);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) throw new InboxError(res.status, data?.error ?? `inbox request failed (${res.status})`);
    return data;
  }

  let state = { status: '', items: [], unread: 0, next: '', loading: true, loadingMore: false, error: null, ready: false };
  const listeners = new Set();
  const set = (patch) => {
    state = { ...state, ...patch };
    for (const fn of listeners) fn(state);
  };
  let generation = 0;

  async function load() {
    const gen = ++generation;
    set({ loading: true, error: null });
    const q = new URLSearchParams({ limit: String(pageSize) });
    if (state.status) q.set('status', state.status);
    try {
      const page = await call('GET', `/notifications?${q}`);
      if (gen !== generation) return;
      set({ items: page.notifications, next: page.next, unread: page.unread, loading: false, ready: true });
    } catch (err) {
      if (gen === generation) set({ loading: false, error: err });
    }
  }

  async function loadMore() {
    if (!state.next || state.loadingMore) return;
    const gen = generation;
    set({ loadingMore: true });
    const q = new URLSearchParams({ limit: String(pageSize), before: state.next });
    if (state.status) q.set('status', state.status);
    try {
      const page = await call('GET', `/notifications?${q}`);
      if (gen !== generation) return;
      const have = new Set(state.items.map((n) => n.id));
      set({ items: [...state.items, ...page.notifications.filter((n) => !have.has(n.id))], next: page.next, unread: page.unread, loadingMore: false });
    } catch (err) {
      if (gen === generation) set({ loadingMore: false, error: err });
    }
  }

  /** Whether n belongs on the current tab. */
  function fits(n) {
    switch (state.status) {
      case 'unread':
        return !n.read_at && !n.archived_at;
      case 'read':
        return !!n.read_at && !n.archived_at;
      case 'archived':
        return !!n.archived_at;
      case 'all':
        return true;
      default:
        return !n.archived_at;
    }
  }

  /** Applies a change locally (optimistic, and from events). */
  function applyChange(ids, change, unread) {
    const want = ids === 'all' ? null : new Set(ids);
    const now = new Date().toISOString();
    const items = state.items
      .map((n) => {
        if (want && !want.has(n.id)) return n;
        const out = { ...n };
        if (change.read !== undefined) out.read_at = change.read ? (n.read_at ?? now) : null;
        if (change.archived !== undefined) out.archived_at = change.archived ? (n.archived_at ?? now) : null;
        return out;
      })
      .filter(fits);
    let count = unread;
    if (count === undefined) {
      count = state.unread;
      for (const n of state.items) {
        if (want && !want.has(n.id)) continue;
        const was = !n.read_at && !n.archived_at;
        const read = change.read !== undefined ? change.read : !!n.read_at;
        const archived = change.archived !== undefined ? change.archived : !!n.archived_at;
        const is = !read && !archived;
        count += (is ? 1 : 0) - (was ? 1 : 0);
      }
      if (ids === 'all' && change.read === true) count = 0;
      count = Math.max(0, count);
    }
    set({ items, unread: count });
  }

  async function mark(ids, change) {
    const all = ids === 'all';
    if (!all && !ids.length) return;
    const before = state;
    applyChange(ids, change);
    try {
      const res = await call('POST', '/notifications/mark', { ...(all ? { all: true } : { ids }), ...change });
      set({ unread: res.unread });
    } catch (err) {
      set({ items: before.items, unread: before.unread, error: err });
      throw err;
    }
  }

  const handlers = {
    'inbox.notification': (data) => {
      const n = data?.notification;
      if (!n || state.items.some((o) => o.id === n.id)) return;
      set({ items: fits(n) ? [n, ...state.items] : state.items, unread: state.unread + (n.read_at || n.archived_at ? 0 : 1) });
      for (const fn of arrivals) fn(n);
    },
    'inbox.updated': (data) => {
      if (!data?.ids) return;
      const change = {};
      if (data.read !== undefined) change.read = data.read;
      if (data.archived !== undefined) change.archived = data.archived;
      applyChange(data.ids, change, data.unread);
    },
    'inbox.deleted': (data) => {
      if (!data?.ids) return;
      const gone = new Set(data.ids);
      set({ items: state.items.filter((n) => !gone.has(n.id)), unread: data.unread ?? state.unread });
    },
  };
  const arrivals = new Set();

  let timer = null;
  const onConnected = () => load();
  if (pusher?.user) {
    for (const e of EVENTS) pusher.user.bind(e, handlers[e]);
    pusher.connection?.bind?.('connected', onConnected);
  } else if (pollInterval > 0 && typeof setInterval === 'function') {
    timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') load();
    }, pollInterval);
  }
  load();

  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Calls fn with each notification that arrives live. */
    onNotification(fn) {
      arrivals.add(fn);
      return () => arrivals.delete(fn);
    },
    /** Shows another tab: '' (inbox), 'unread', 'read', 'archived' or 'all'. */
    setStatus(status) {
      if (status === state.status) return;
      set({ status, items: [], next: '' });
      load();
    },
    refresh: load,
    loadMore,
    markRead: (ids) => mark(ids, { read: true }),
    markUnread: (ids) => mark(ids, { read: false }),
    archive: (ids) => mark(ids, { archived: true }),
    unarchive: (ids) => mark(ids, { archived: false }),
    markAllRead: () => mark('all', { read: true }),
    archiveAll: () => mark('all', { archived: true }),
    destroy() {
      generation++;
      listeners.clear();
      arrivals.clear();
      if (timer) clearInterval(timer);
      if (pusher?.user) for (const e of EVENTS) pusher.user.unbind?.(e, handlers[e]);
      pusher?.connection?.unbind?.('connected', onConnected);
    },
  };
}

export { InboxError };
