import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { signUserToken } from '../index.js';
import { SECRET, fakeServer, tick } from './fake.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://app.test/' });
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'SVGElement', 'Element', 'MutationObserver']) {
  Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { createInboxClient } = await import('../client.js');

async function world() {
  const srv = fakeServer();
  srv.add('ann', 'Invoice paid', { body: 'Acme paid #1042', category: 'billing' });
  srv.add('ann', 'New comment', { url: '/posts/7' });
  const client = createInboxClient({ appId: 'a', token: signUserToken({ secret: SECRET, userId: 'ann' }), pusher: srv.pusher, fetch: srv.fetch });
  await tick();
  return { srv, client };
}

const click = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const byLabel = (root, label) => [...root.querySelectorAll('[aria-label]')].filter((e) => e.getAttribute('aria-label') === label);

test('React bell: badge, open, read on click, mark all, live arrivals', async () => {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = React;
  const { NotificationBell } = await import('../react.js');
  const { srv, client } = await world();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const selected = [];
  await act(async () => root.render(React.createElement(NotificationBell, { client, onSelect: (n) => selected.push(n.title) })));
  const bell = host.querySelector('.hb-in-bell');
  assert.equal(host.querySelector('.hb-in-badge').textContent, '2');
  assert.equal(bell.getAttribute('aria-label'), 'Notifications, 2 unread');
  await act(async () => click(bell));
  const items = host.querySelectorAll('.hb-in-item');
  assert.equal(items.length, 2);
  assert.equal(items[0].querySelector('.hb-in-title').textContent, 'New comment');
  await act(async () => {
    click(items[1]);
    await tick();
  });
  assert.deepEqual(selected, ['Invoice paid']);
  assert.equal(host.querySelector('.hb-in-popover'), null, 'closes after a choice');
  assert.equal(host.querySelector('.hb-in-badge').textContent, '1');

  await act(async () => click(bell));
  await act(async () => {
    click(byLabel(host, 'Mark all as read')[0]);
    await tick();
  });
  assert.equal(host.querySelector('.hb-in-badge'), null);
  assert.equal(host.querySelectorAll('.hb-in-item--unread').length, 0);

  await act(async () => srv.send('ann', 'Deploy finished'));
  assert.equal(host.querySelector('.hb-in-badge').textContent, '1');
  assert.equal(host.querySelector('.hb-in-item .hb-in-title').textContent, 'Deploy finished');

  // Escape closes; archive moves an item out of the inbox tab.
  await act(async () => {
    click(byLabel(host.querySelector('.hb-in-item'), 'Archive')[0]);
    await tick();
  });
  assert.equal(host.querySelectorAll('.hb-in-item').length, 2);
  await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' })));
  assert.equal(host.querySelector('.hb-in-popover'), null);
  await act(async () => root.unmount());
  client.destroy();
});

test('React inbox: tabs, empty state', async () => {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = React;
  const { NotificationInbox } = await import('../react.js');
  const { client } = await world();
  const host = document.createElement('div');
  const root = createRoot(host);
  await act(async () => root.render(React.createElement(NotificationInbox, { client, locale: 'ja' })));
  assert.equal(host.querySelector('.hb-in-heading').textContent, '通知');
  const tabs = host.querySelectorAll('.hb-in-tab');
  assert.deepEqual([...tabs].map((t) => t.getAttribute('aria-selected')), ['true', 'false', 'false']);
  await act(async () => {
    click(tabs[2]);
    await tick();
  });
  assert.equal(host.querySelector('.hb-in-state--empty p').textContent, 'アーカイブした通知はありません。');
  await act(async () => root.unmount());
  client.destroy();
});

test('Vue bell and inbox', async () => {
  const { createApp, h, nextTick } = await import('vue');
  const { NotificationBell } = await import('../vue.js');
  const { srv, client } = await world();
  const host = document.createElement('div');
  document.body.append(host);
  const selected = [];
  const app = createApp({ render: () => h(NotificationBell, { client, locale: 'zh-TW', onSelect: (n) => selected.push(n.title) }) });
  app.mount(host);
  await nextTick();
  assert.equal(host.querySelector('.hb-in-badge').textContent, '2');
  click(host.querySelector('.hb-in-bell'));
  await nextTick();
  assert.equal(host.querySelector('.hb-in-heading').textContent, '通知');
  click(host.querySelectorAll('.hb-in-item')[0]);
  await tick();
  await nextTick();
  assert.deepEqual(selected, ['New comment']);
  assert.equal(host.querySelector('.hb-in-badge').textContent, '1');
  srv.send('ann', '新訂單');
  await nextTick();
  assert.equal(host.querySelector('.hb-in-badge').textContent, '2');
  app.unmount();
  client.destroy();
});

test('React Native bell and inbox', async () => {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = React;
  const { NotificationBell } = await import('../react-native.js');
  const { opened } = await import('react-native');
  const { client } = await world();
  const host = document.createElement('div');
  const root = createRoot(host);
  await act(async () => root.render(React.createElement(NotificationBell, { client })));
  const bell = byLabel(host, 'Notifications, 2 unread')[0];
  assert.ok(bell);
  await act(async () => click(bell));
  assert.ok(host.querySelector('dialog'));
  const rows = host.querySelectorAll('[data-list=items] > li');
  assert.equal(rows.length, 2);
  await act(async () => {
    click(byLabel(rows[1], 'Mark as read')[0]);
    await tick();
  });
  assert.equal(client.getState().unread, 1);
  await act(async () => {
    click(byLabel(host, 'Close')[0]);
  });
  assert.equal(host.querySelector('dialog'), null);
  assert.deepEqual(opened, [], 'a relative url is not opened with Linking');
  await act(async () => root.unmount());
  client.destroy();
});
