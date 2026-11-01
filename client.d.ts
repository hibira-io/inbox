import type { InboxStatus, Notification } from './types.js';

export type { InboxStatus, Notification } from './types.js';

export interface InboxState {
  status: InboxStatus;
  /** The current tab's notifications, newest first. */
  items: Notification[];
  /** Unread, not archived: the number on the bell. */
  unread: number;
  /** Cursor of the next page; '' at the end. */
  next: string;
  loading: boolean;
  loadingMore: boolean;
  error: InboxError | Error | null;
  /** The first page has loaded. */
  ready: boolean;
}

/** The pusher-js parts the client uses. */
export interface PusherLike {
  user?: {
    bind(event: string, callback: (data: any) => void): unknown;
    unbind?(event: string, callback: (data: any) => void): unknown;
  };
  connection?: {
    bind?(event: string, callback: () => void): unknown;
    unbind?(event: string, callback: () => void): unknown;
  };
}

export interface InboxClientOptions {
  /** Your Hibira app ID. */
  appId: string;
  /** The user token, or a function that fetches a fresh one. */
  token?: string | (() => string | Promise<string>);
  /** Instead of token: a URL on your site answering {"token": "..."}. */
  tokenUrl?: string;
  /** A pusher-js instance signed in as the user (pusher.signin()), for live updates. */
  pusher?: PusherLike;
  /** The HTTP API host. Default api.hibira.io. */
  host?: string;
  /** Notifications per page. Default 20. */
  pageSize?: number;
  /** Refresh interval without pusher, in ms. Default 60000; 0 = never. */
  pollInterval?: number;
  fetch?: typeof fetch;
}

export interface InboxClient {
  getState(): InboxState;
  subscribe(listener: (state: InboxState) => void): () => void;
  /** Called with each notification that arrives live. */
  onNotification(listener: (n: Notification) => void): () => void;
  setStatus(status: InboxStatus): void;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  markRead(ids: string[]): Promise<void>;
  markUnread(ids: string[]): Promise<void>;
  archive(ids: string[]): Promise<void>;
  unarchive(ids: string[]): Promise<void>;
  markAllRead(): Promise<void>;
  archiveAll(): Promise<void>;
  destroy(): void;
}

export declare class InboxError extends Error {
  status: number;
}

export function createInboxClient(options: InboxClientOptions): InboxClient;
