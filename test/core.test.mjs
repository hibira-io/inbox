import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { createInbox, signUserToken } from '../index.js';
import { createInboxClient } from '../client.js';
import { labelsFor, format } from '../locales.js';
import { SECRET, fakeServer, tick } from './fake.mjs';

const token = (u = 'ann', s = 3600) => signUserToken({ secret: SECRET, userId: u, expiresIn: s });

test('signUserToken: HS256 JWT with sub and exp, capped at 30 days', () => {
  const t = signUserToken({ secret: 's', userId: 42, expiresIn: 99 * 86400, now: 1_800_000_000_000 });
  const [h, c, sig] = t.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'HS256', typ: 'JWT' });
  assert.deepEqual(JSON.parse(Buffer.from(c, 'base64url')), { sub: '42', exp: 1_800_000_000 + 30 * 86400 });
  assert.equal(sig, createHmac('sha256', 's').update(`${h}.${c}`).digest('base64url'));
});

test('server: requests are signed like the Pusher HTTP API', async () => {
  const seen = [];
  const inbox = createInbox({
    appId: 'app1',
    key: 'key1',
    secret: 'sec',
    host: 'http://localhost:6001',
    fetch: async (url, init) => {
      seen.push({ url: new URL(url), init });
      return new Response('{"notifications":[]}', { status: 201 });
    },
  });
  await inbox.send({ users: ['ann'], title: 'Hi' });
  const { url, init } = seen[0];
  assert.equal(url.origin + url.pathname, 'http://localhost:6001/apps/app1/inbox/notifications');
  assert.equal(init.method, 'POST');
  const q = Object.fromEntries(url.searchParams);
  assert.equal(q.body_md5, createHash('md5').update(init.body).digest('hex'));
  const canon = Object.keys(q)
    .filter((k) => k !== 'auth_signature')
    .sort()
    .map((k) => `${k}=${q[k]}`)
    .join('&');
  assert.equal(q.auth_signature, createHmac('sha256', 'sec').update(`POST\n/apps/app1/inbox/notifications\n${canon}`).digest('hex'));

  await inbox.list('ann b', { status: 'unread', limit: 5 });
  assert.equal(seen[1].url.pathname, '/apps/app1/inbox/users/ann%20b/notifications');
  assert.equal(seen[1].url.searchParams.get('status'), 'unread');
  assert.equal(seen[1].url.searchParams.get('body_md5'), null);

  const failing = createInbox({ appId: 'a', key: 'k', secret: 's', fetch: async () => new Response('{"error":"nope"}', { status: 400 }) });
  await assert.rejects(failing.send({ users: [], title: '' }), { name: 'InboxError', status: 400, message: 'nope' });
});

test('client: loads, marks optimistically, follows live events', async () => {
  const srv = fakeServer();
  srv.add('ann', 'Old');
  const two = srv.add('ann', 'Newer');
  const c = createInboxClient({ appId: 'app1', token: token(), pusher: srv.pusher, fetch: srv.fetch, host: 'http://x' });
  const seen = [];
  c.subscribe((s) => seen.push(s));
  await tick();
  let s = c.getState();
  assert.equal(s.ready, true);
  assert.deepEqual(s.items.map((n) => n.title), ['Newer', 'Old']);
  assert.equal(s.unread, 2);

  const p = c.markRead([two.id]);
  assert.equal(c.getState().unread, 1, 'optimistic');
  await p;
  assert.equal(c.getState().items[0].read_at !== null, true);

  // A notification sent while open, then another tab marking all read.
  const arrived = [];
  c.onNotification((n) => arrived.push(n.title));
  srv.send('ann', 'Fresh');
  s = c.getState();
  assert.deepEqual(s.items.map((n) => n.title), ['Fresh', 'Newer', 'Old']);
  assert.equal(s.unread, 2);
  assert.deepEqual(arrived, ['Fresh']);
  srv.pusher.emit('inbox.updated', { ids: s.items.map((n) => n.id), read: true, unread: 0 });
  assert.equal(c.getState().unread, 0);
  assert.ok(c.getState().items.every((n) => n.read_at));

  // Archive leaves the inbox tab; the archived tab shows it.
  await c.archive([two.id]);
  assert.deepEqual(c.getState().items.map((n) => n.title), ['Fresh', 'Old']);
  c.setStatus('archived');
  await tick();
  assert.deepEqual(c.getState().items.map((n) => n.title), ['Newer']);
  await c.unarchive([two.id]);
  assert.deepEqual(c.getState().items, []);

  srv.pusher.emit('inbox.deleted', { ids: [two.id], unread: 0 });
  c.destroy();
  assert.equal(srv.pusher.bound(), 0);
});

test('client: pages, mark all read, rollback on failure', async () => {
  const srv = fakeServer();
  for (let i = 0; i < 5; i++) srv.add('bo', `n${i}`);
  const c = createInboxClient({ appId: 'a', token: token('bo'), fetch: srv.fetch, pageSize: 2, pollInterval: 0 });
  await tick();
  assert.deepEqual(c.getState().items.map((n) => n.title), ['n4', 'n3']);
  await c.loadMore();
  await c.loadMore();
  assert.deepEqual(c.getState().items.map((n) => n.title), ['n4', 'n3', 'n2', 'n1', 'n0']);
  assert.equal(c.getState().next, '');
  await c.markAllRead();
  assert.equal(c.getState().unread, 0);

  const broken = createInboxClient({ appId: 'a', token: token('bo'), pollInterval: 0, fetch: async (url, init) => (init.method === 'POST' ? new Response('{"error":"down"}', { status: 503 }) : srv.fetch(url, init)) });
  await tick();
  const before = broken.getState().items;
  await assert.rejects(broken.markUnread([before[0].id]), { status: 503 });
  assert.equal(broken.getState().items, before);
  assert.equal(broken.getState().error.message, 'down');
  c.destroy();
  broken.destroy();
});

test('client: refreshes an expired or rejected token', async () => {
  const srv = fakeServer();
  srv.add('cy', 'Hello');
  let calls = 0;
  const c = createInboxClient({
    appId: 'a',
    pollInterval: 0,
    fetch: srv.fetch,
    token: async () => (++calls === 1 ? signUserToken({ secret: 'wrong-secret', userId: 'cy' }) : token('cy')),
  });
  await tick(20);
  assert.equal(calls, 2);
  assert.equal(c.getState().items.length, 1);
  c.destroy();

  let urlCalls = 0;
  const viaUrl = createInboxClient({
    appId: 'a',
    pollInterval: 0,
    tokenUrl: '/api/inbox-token',
    fetch: async (url, init) => {
      if (url === '/api/inbox-token') {
        urlCalls++;
        return new Response(JSON.stringify({ token: token('cy', 10) }));
      }
      return srv.fetch(url, init);
    },
  });
  await tick(20);
  assert.equal(viaUrl.getState().items.length, 1);
  await viaUrl.refresh();
  assert.equal(urlCalls, 2, 'a token about to expire is fetched again');
  viaUrl.destroy();
});

test('locales', () => {
  assert.equal(labelsFor('zh-Hant-TW').title, '通知');
  assert.equal(labelsFor('zh-CN').tabs[''], '收件箱');
  assert.equal(labelsFor('ja-JP').markAllRead, 'すべて既読にする');
  assert.equal(labelsFor('xx').title, 'Notifications');
  assert.equal(labelsFor('en', { tabs: { archived: 'Done' } }).tabs[''], 'Inbox');
  assert.equal(format('{count} unread', { count: 3 }), '3 unread');
});
