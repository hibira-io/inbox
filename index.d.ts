import type { InboxStatus, Notification } from './types.js';

export type { InboxStatus, Notification } from './types.js';

export interface InboxOptions {
  appId: string;
  key: string;
  secret: string;
  /** The HTTP API host. Default api.hibira.io; may include http:// for a local server. */
  host?: string;
  fetch?: typeof fetch;
}

export interface SendInput {
  /** 1 to 1,000 user IDs. */
  users: string[];
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  category?: string;
  /** Idempotency key: a user who already has it does not get the notification again. */
  key?: string;
  data?: Record<string, unknown>;
  /** Push to users with no open connection (default), always, or never. */
  push?: 'offline' | 'always' | 'never';
}

export interface SendResult {
  notifications: { user_id: string; id: string; new: boolean }[];
  push?: { users: number; error?: string };
}

export interface Page {
  notifications: Notification[];
  next: string;
  unread: number;
}

export type MarkInput = ({ ids: string[]; all?: never } | { all: true; ids?: never }) & { read?: boolean; archived?: boolean };

export interface Inbox {
  send(input: SendInput): Promise<SendResult>;
  list(userId: string, query?: { status?: InboxStatus; limit?: number; before?: string }): Promise<Page>;
  mark(userId: string, change: MarkInput): Promise<{ changed: string[]; unread: number }>;
  delete(userId: string, id?: string): Promise<{ deleted: string[]; unread: number }>;
  /** A user token for the frontend. expiresIn in seconds (default 1 day, at most 30 days). */
  userToken(userId: string, options?: { expiresIn?: number }): string;
}

export declare class InboxError extends Error {
  status: number;
}

export function createInbox(options: InboxOptions): Inbox;

export function signUserToken(options: { secret: string; userId: string; expiresIn?: number; now?: number }): string;
