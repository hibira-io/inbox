// Vue 3 components for the notification inbox: <NotificationBell> (a bell
// with its unread badge that opens the inbox) and <NotificationInbox> (the
// panel alone). Import '@hibira-io/inbox/styles.css' for the default look.

import { defineComponent, h, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { labelsFor } from './locales.js';
import { renderBell, renderInbox } from './view.js';

export { createInboxClient } from './client.js';

function el(tag, props, ...children) {
  const out = {};
  for (const [k, v] of Object.entries(props ?? {})) if (v !== undefined) out[k] = v;
  const kids = children.flat().filter((c) => c != null && c !== false);
  if (tag === 'img' || tag === 'path') return h(tag, out);
  return h(tag, out, kids);
}

/** The client's state as a ref; client may be a value or a getter. */
export function useInbox(client) {
  const state = shallowRef(null);
  let stop = () => {};
  const get = () => (typeof client === 'function' ? client() : client);
  watch(
    get,
    (c) => {
      stop();
      if (!c) return;
      state.value = c.getState();
      stop = c.subscribe((s) => (state.value = s));
    },
    { immediate: true },
  );
  onBeforeUnmount(() => stop());
  return state;
}

const common = {
  client: { type: Object, required: true },
  locale: { type: String, default: undefined },
  labels: { type: Object, default: undefined },
  tabs: { type: Array, default: undefined },
  // @select listener, as a prop so the component can tell whether one is set.
  onSelect: { type: Function, default: undefined },
};

/** The inbox panel. @select(notification) is called on a click; without it a click follows the notification's url. */
export const NotificationInbox = defineComponent({
  name: 'NotificationInbox',
  props: common,
  setup(props) {
    const state = useInbox(() => props.client);
    return () =>
      state.value
        ? renderInbox(el, state.value, props.client, labelsFor(props.locale, props.labels), {
            locale: props.locale,
            tabs: props.tabs,
            onSelect: props.onSelect,
          })
        : null;
  },
});

/** A bell with the unread count that opens the inbox in a popover. */
export const NotificationBell = defineComponent({
  name: 'NotificationBell',
  props: { ...common, align: { type: String, default: 'end' } },
  setup(props) {
    const state = useInbox(() => props.client);
    const open = ref(false);
    const root = ref(null);
    const away = (e) => open.value && root.value && !root.value.contains(e.target) && (open.value = false);
    const esc = (e) => e.key === 'Escape' && (open.value = false);
    onMounted(() => {
      document.addEventListener('pointerdown', away);
      document.addEventListener('keydown', esc);
    });
    onBeforeUnmount(() => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    });
    const select = (n) => {
      open.value = false;
      if (props.onSelect) props.onSelect(n);
      else if (n.url) window.location.assign(n.url);
    };
    return () => {
      if (!state.value) return null;
      const t = labelsFor(props.locale, props.labels);
      return h('div', { ref: root, class: 'hb-in-root' }, [
        renderBell(el, { unread: state.value.unread, open: open.value, onToggle: () => (open.value = !open.value) }, t),
        open.value
          ? h('div', { class: `hb-in-popover hb-in-popover--${props.align}`, role: 'dialog', 'aria-label': t.title }, [
              renderInbox(el, state.value, props.client, t, { locale: props.locale, tabs: props.tabs, onSelect: select }),
            ])
          : null,
      ]);
    };
  },
});
