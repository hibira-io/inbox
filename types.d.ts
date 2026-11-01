/** One stored notification. */
export interface Notification {
  id: string;
  user_id: string;
  key?: string;
  title: string;
  body?: string;
  /** An http(s) URL or a path on your site. */
  url?: string;
  icon?: string;
  category?: string;
  data?: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
  expires_at: string;
}

/** '' is the inbox (everything not archived). */
export type InboxStatus = '' | 'unread' | 'read' | 'archived' | 'all';

export interface Labels {
  title: string;
  bell: string;
  unreadCount: string;
  tabs: Partial<Record<InboxStatus, string>>;
  markAllRead: string;
  markRead: string;
  markUnread: string;
  archive: string;
  unarchive: string;
  empty: Partial<Record<InboxStatus, string>>;
  loading: string;
  loadMore: string;
  error: string;
  retry: string;
}

export type LabelOverrides = Partial<Omit<Labels, 'tabs' | 'empty'>> & {
  tabs?: Partial<Record<InboxStatus, string>>;
  empty?: Partial<Record<InboxStatus, string>>;
};

export type Locale = 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'th' | 'vi' | (string & {});
