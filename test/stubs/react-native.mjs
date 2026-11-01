// Just enough of react-native to render the components into a DOM with
// react-dom: each primitive becomes an element tests can query and click.
import { createElement as h } from 'react';

const strip = ({ style, accessibilityRole, accessibilityLabel, accessibilityState, hitSlop, numberOfLines, ...rest }) => ({
  ...rest,
  role: accessibilityRole,
  'aria-label': accessibilityLabel,
  'aria-selected': accessibilityState?.selected === undefined ? undefined : String(accessibilityState.selected),
});

export const View = ({ children, ...p }) => h('div', strip(p), children);
export const Text = ({ children, ...p }) => h('span', strip(p), children);
export const Image = ({ source, ...p }) => h('img', { ...strip(p), src: source?.uri });
// A press does not reach an enclosing Pressable, as in React Native.
export const Pressable = ({ children, onPress, ...p }) =>
  h('div', { ...strip(p), role: p.accessibilityRole ?? 'button', onClick: (e) => (e.stopPropagation(), onPress?.()) }, children);
export const Modal = ({ visible, children, onRequestClose, animationType, presentationStyle }) => (visible ? h('dialog', { open: true }, children) : null);
export function FlatList({ data, renderItem, keyExtractor, ListEmptyComponent, onEndReached }) {
  if (!data.length) return h('div', { 'data-list': 'empty' }, ListEmptyComponent);
  return h(
    'ul',
    { 'data-list': 'items' },
    data.map((item, index) => h('li', { key: keyExtractor(item) }, renderItem({ item, index }))),
    h('button', { type: 'button', 'data-end': true, onClick: onEndReached }, 'end'),
  );
}
export const StyleSheet = { create: (s) => s, hairlineWidth: 1 };
export const opened = [];
export const Linking = { openURL: async (u) => opened.push(u) };
export const useColorScheme = () => 'light';
