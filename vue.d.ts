import type { DefineComponent, ShallowRef } from 'vue';
import type { InboxClient, InboxState } from './client.js';
import type { InboxStatus, LabelOverrides, Locale, Notification } from './types.js';

export { createInboxClient } from './client.js';
export type { InboxClient, InboxClientOptions, InboxState } from './client.js';

interface Props {
  client: InboxClient;
  locale?: Locale;
  labels?: LabelOverrides;
  tabs?: InboxStatus[];
  onSelect?: (n: Notification) => void;
}

export function useInbox(client: InboxClient | (() => InboxClient | null | undefined)): ShallowRef<InboxState | null>;
export const NotificationInbox: DefineComponent<Props>;
export const NotificationBell: DefineComponent<Props & { align?: 'start' | 'end' }>;
