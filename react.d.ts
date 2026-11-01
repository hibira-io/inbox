import type { ReactElement } from 'react';
import type { InboxClient, InboxClientOptions, InboxState } from './client.js';
import type { InboxStatus, LabelOverrides, Locale, Notification } from './types.js';

export { createInboxClient } from './client.js';
export type { InboxClient, InboxClientOptions, InboxState } from './client.js';

export interface InboxViewProps {
  client: InboxClient;
  locale?: Locale;
  labels?: LabelOverrides;
  /** Called when a notification is clicked; by default the browser follows its url. */
  onSelect?: (n: Notification) => void;
  tabs?: InboxStatus[];
  className?: string;
}

export function useInbox(client: InboxClient): InboxState;
/** Creates a client and destroys it on unmount; null until created. userKey: change it when the signed-in user changes. */
export function useInboxClient(options: InboxClientOptions & { userKey?: string }): InboxClient | null;
export function NotificationInbox(props: InboxViewProps): ReactElement;
export function NotificationBell(props: InboxViewProps & { align?: 'start' | 'end' }): ReactElement;
