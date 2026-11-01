import type { ReactElement, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { InboxClient, InboxState } from './client.js';
import type { InboxStatus, LabelOverrides, Locale, Notification } from './types.js';

export { createInboxClient } from './client.js';
export type { InboxClient, InboxClientOptions, InboxState } from './client.js';

export interface InboxTheme {
  mode?: 'light' | 'dark';
  bg?: string;
  unread?: string;
  border?: string;
  ink?: string;
  muted?: string;
  accent?: string;
  badge?: string;
  soft?: string;
}

export interface InboxViewProps {
  client: InboxClient;
  locale?: Locale;
  labels?: LabelOverrides;
  /** Called when a notification is pressed; by default an http(s) url opens with Linking. */
  onSelect?: (n: Notification) => void;
  tabs?: InboxStatus[];
  theme?: InboxTheme;
  style?: StyleProp<ViewStyle>;
}

export function useInbox(client: InboxClient): InboxState;
export function NotificationInbox(props: InboxViewProps): ReactElement;
/** icon replaces the default bell glyph. */
export function NotificationBell(props: InboxViewProps & { icon?: ReactNode }): ReactElement;
