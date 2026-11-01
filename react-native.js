// React Native components for the notification inbox: <NotificationBell>
// opens the inbox in a modal sheet, <NotificationInbox> is the list alone
// (for a screen of its own). They use the same client as the web
// components; pass the pusher-js instance you sign in with
// (@hibira-io/react-native) for live updates.

import { createElement as h, useEffect, useState } from 'react';
import { FlatList, Image, Linking, Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { labelsFor, format } from './locales.js';
import { ago, badgeText } from './view.js';

export { createInboxClient } from './client.js';

/** Subscribes to an inbox client's state. */
export function useInbox(client) {
  const [state, setState] = useState(() => client.getState());
  useEffect(() => {
    setState(client.getState());
    return client.subscribe(setState);
  }, [client]);
  return state;
}

const light = { bg: '#ffffff', unread: '#f4f8ff', border: '#e6e4df', ink: '#111110', muted: '#6f6d66', accent: '#0d74ce', badge: '#e5484d', soft: '#eceae6' };
const dark = { bg: '#191918', unread: '#15202e', border: '#31302e', ink: '#eeeeec', muted: '#a09f9a', accent: '#70b8ff', badge: '#e5484d', soft: '#2a2a28' };

function usePalette(theme) {
  const scheme = useColorScheme();
  const base = (theme?.mode ?? scheme) === 'dark' ? dark : light;
  return theme ? { ...base, ...theme } : base;
}

function follow(n, onSelect) {
  if (onSelect) onSelect(n);
  else if (n.url && /^https?:\/\//.test(n.url)) Linking.openURL(n.url).catch(() => {});
}

function Row({ n, client, t, c, locale, onSelect }) {
  const unread = !n.read_at && !n.archived_at;
  const press = () => {
    if (unread) client.markRead([n.id]).catch(() => {});
    follow(n, onSelect);
  };
  const act = (label, run) =>
    h(Pressable, { key: label, accessibilityRole: 'button', accessibilityLabel: label, onPress: () => run().catch(() => {}), hitSlop: 6, style: s.act },
      h(Text, { style: [s.actText, { color: c.accent }] }, label));
  return h(
    Pressable,
    { onPress: press, accessibilityRole: 'button', style: [s.row, { backgroundColor: unread ? c.unread : c.bg, borderBottomColor: c.border }] },
    unread ? h(View, { style: [s.dot, { backgroundColor: c.accent }] }) : null,
    n.icon
      ? h(Image, { source: { uri: n.icon }, style: [s.avatar, { backgroundColor: c.soft }] })
      : h(View, { style: [s.avatar, { backgroundColor: c.soft }] }, h(Text, { style: [s.initial, { color: c.muted }] }, [...String(n.category || n.title || '?')][0].toUpperCase())),
    h(
      View,
      { style: s.text },
      h(Text, { style: [s.title, { color: c.ink, fontWeight: unread ? '600' : '500' }] }, n.title),
      n.body ? h(Text, { style: [s.body, { color: c.muted }], numberOfLines: 2 }, n.body) : null,
      h(
        View,
        { style: s.meta },
        h(Text, { style: [s.time, { color: c.muted }] }, ago(n.created_at, locale)),
        n.archived_at
          ? act(t.unarchive, () => client.unarchive([n.id]))
          : [
              unread ? act(t.markRead, () => client.markRead([n.id])) : act(t.markUnread, () => client.markUnread([n.id])),
              act(t.archive, () => client.archive([n.id])),
            ],
      ),
    ),
  );
}

/** The inbox list with its tabs. */
export function NotificationInbox({ client, locale, labels, onSelect, tabs = ['', 'unread', 'archived'], theme, style }) {
  const state = useInbox(client);
  const c = usePalette(theme);
  const t = labelsFor(locale, labels);
  let empty;
  if (state.error && !state.items.length) {
    empty = h(View, { style: s.state }, h(Text, { style: { color: c.muted } }, t.error),
      h(Pressable, { onPress: () => client.refresh(), style: [s.button, { borderColor: c.border }] }, h(Text, { style: { color: c.ink } }, t.retry)));
  } else if (state.loading && !state.items.length) {
    empty = h(View, { style: s.state }, h(Text, { style: { color: c.muted } }, t.loading));
  } else {
    empty = h(View, { style: s.state }, h(Text, { style: { color: c.muted } }, t.empty[state.status] ?? t.empty['']));
  }
  return h(
    View,
    { style: [s.panel, { backgroundColor: c.bg }, style] },
    h(
      View,
      { style: s.head },
      h(Text, { style: [s.heading, { color: c.ink }], accessibilityRole: 'header' }, t.title),
      state.unread > 0
        ? h(Pressable, { onPress: () => client.markAllRead().catch(() => {}), accessibilityRole: 'button', hitSlop: 6 }, h(Text, { style: [s.actText, { color: c.accent }] }, t.markAllRead))
        : null,
    ),
    h(
      View,
      { style: [s.tabs, { borderBottomColor: c.border }], accessibilityRole: 'tablist' },
      tabs.map((st) =>
        h(
          Pressable,
          { key: st || 'inbox', onPress: () => client.setStatus(st), accessibilityRole: 'tab', accessibilityState: { selected: state.status === st },
            style: [s.tab, state.status === st && { borderBottomColor: c.ink }] },
          h(Text, { style: { color: state.status === st ? c.ink : c.muted, fontWeight: '500' } },
            t.tabs[st] ?? st, st === '' && state.unread > 0 ? `  ${badgeText(state.unread)}` : ''),
        ),
      ),
    ),
    h(FlatList, {
      data: state.items,
      keyExtractor: (n) => n.id,
      renderItem: ({ item }) => h(Row, { n: item, client, t, c, locale, onSelect }),
      ListEmptyComponent: empty,
      onEndReached: () => client.loadMore(),
      onEndReachedThreshold: 0.5,
      refreshing: state.loading && state.items.length > 0,
      onRefresh: () => client.refresh(),
      contentContainerStyle: state.items.length ? undefined : s.fill,
    }),
  );
}

/** A bell with the unread count that opens the inbox in a modal sheet. */
export function NotificationBell({ client, locale, labels, onSelect, tabs, theme, icon, style }) {
  const state = useInbox(client);
  const c = usePalette(theme);
  const t = labelsFor(locale, labels);
  const [open, setOpen] = useState(false);
  const label = state.unread > 0 ? `${t.bell}, ${format(t.unreadCount, { count: state.unread })}` : t.bell;
  return h(
    View,
    { style },
    h(
      Pressable,
      { onPress: () => setOpen(true), accessibilityRole: 'button', accessibilityLabel: label, hitSlop: 8, style: s.bell },
      icon ?? h(Text, { style: { fontSize: 20, color: c.ink } }, '\u{1F514}'),
      state.unread > 0 ? h(View, { style: [s.badge, { backgroundColor: c.badge, borderColor: c.bg }] }, h(Text, { style: s.badgeText }, badgeText(state.unread))) : null,
    ),
    h(
      Modal,
      { visible: open, animationType: 'slide', presentationStyle: 'pageSheet', onRequestClose: () => setOpen(false) },
      h(NotificationInbox, {
        client, locale, labels, tabs, theme,
        style: s.fill,
        onSelect: (n) => {
          setOpen(false);
          follow(n, onSelect);
        },
      }),
      h(Pressable, { onPress: () => setOpen(false), accessibilityRole: 'button', accessibilityLabel: 'Close', style: s.close, hitSlop: 8 },
        h(Text, { style: { fontSize: 22, color: c.muted } }, '×')),
    ),
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  panel: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, paddingRight: 52 },
  heading: { fontSize: 18, fontWeight: '600' },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12, paddingLeft: 22, paddingRight: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { position: 'absolute', left: 8, top: 26, width: 7, height: 7, borderRadius: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '600' },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 15 },
  body: { fontSize: 14, marginTop: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  time: { fontSize: 12, marginRight: 'auto' },
  act: { paddingVertical: 2 },
  actText: { fontSize: 13, fontWeight: '500' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  button: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  close: { position: 'absolute', top: 12, right: 14, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
