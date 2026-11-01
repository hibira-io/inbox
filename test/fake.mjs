// An in-memory stand-in for the Hibira inbox HTTP API and pusher-js, so the
// client and components run without a server.
import { createHmac } from 'node:crypto';

export const SECRET = 'test-secret-0123456789';

function verify(auth) {
  const token = auth?.replace(/^Bearer /, '');
  if (!token) return null;
  const [h, c, sig] = token.split('.');
  const want = createHmac('sha256', SECRET).update(`${h}.${c}`).digest('base64url');
  if (want !== sig) return null;
  const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
  return claims.exp > Date.now() / 1000 ? claims.sub : null;
}

let seq = 0;
export function makeNotification(user, title, extra = {}) {
  seq++;
  return {
    id: `ntf_${String(Date.now().toString(16)).padStart(12, '0')}${String(seq).padStart(8, '0')}`,
    user_id: user,
    title,
    created_at: new Date(Date.now() - (1000 - seq) * 1000).toISOString(),
    read_at: null,
    archived_at: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    ...extra,
  };
}

export function fakeServer() {
  const feeds = new Map();
  const user = new Map();
  const calls = [];
  const pusher = {
    user: {
      bind: (e, fn) => user.set(e, [...(user.get(e) ?? []), fn]),
      unbind: (e, fn) => user.set(e, (user.get(e) ?? []).filter((f) => f !== fn)),
    },
    connection: { bind() {}, unbind() {} },
    emit: (e, d) => (user.get(e) ?? []).forEach((fn) => fn(d)),
    bound: () => [...user.values()].reduce((n, l) => n + l.length, 0),
  };
  const feed = (u) => {
    if (!feeds.has(u)) feeds.set(u, []);
    return feeds.get(u);
  };
  const unread = (u) => feed(u).filter((n) => !n.read_at && !n.archived_at).length;
  const fits = (n, s) =>
    s === 'unread' ? !n.read_at && !n.archived_at : s === 'archived' ? !!n.archived_at : s === 'read' ? n.read_at && !n.archived_at : s === 'all' ? true : !n.archived_at;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  async function fetch(url, init = {}) {
    const u = new URL(url);
    calls.push({ method: init.method ?? 'GET', path: u.pathname + u.search });
    const who = verify(init.headers?.Authorization);
    if (!who) return json(401, { error: 'invalid user token signature' });
    const list = feed(who);
    if (u.pathname.endsWith('/notifications') && (init.method ?? 'GET') === 'GET') {
      const status = u.searchParams.get('status') ?? '';
      const limit = Number(u.searchParams.get('limit') ?? 20);
      const before = u.searchParams.get('before');
      const rows = [...list].sort((a, b) => (a.id < b.id ? 1 : -1)).filter((n) => fits(n, status) && (!before || n.id < before));
      const page = rows.slice(0, limit);
      return json(200, { notifications: page, next: rows.length > limit ? page[page.length - 1].id : '', unread: unread(who) });
    }
    if (u.pathname.endsWith('/notifications/mark')) {
      const b = JSON.parse(init.body);
      const changed = [];
      for (const n of list) {
        if (!b.all && !b.ids.includes(n.id)) continue;
        let c = false;
        if (b.read !== undefined && !!n.read_at !== b.read) {
          n.read_at = b.read ? new Date().toISOString() : null;
          c = true;
        }
        if (b.archived !== undefined && !!n.archived_at !== b.archived) {
          n.archived_at = b.archived ? new Date().toISOString() : null;
          c = true;
        }
        if (c) changed.push(n.id);
      }
      return json(200, { changed, unread: unread(who) });
    }
    return json(404, { error: 'not found' });
  }

  return {
    fetch,
    pusher,
    calls,
    feed,
    add(u, title, extra) {
      const n = makeNotification(u, title, extra);
      feed(u).push(n);
      return n;
    },
    /** Adds and announces a notification, as a send does. */
    send(u, title, extra) {
      const n = this.add(u, title, extra);
      pusher.emit('inbox.notification', { notification: n });
      return n;
    },
  };
}

export const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
