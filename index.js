// Server side of the inbox (Node 18+, Bun, Deno): send notifications,
// read and change any user's feed, and sign the user tokens your frontend
// needs. Requests are signed like every Hibira (Pusher-compatible) HTTP API
// call, with the app key and secret. Never ship this file to a browser.

import { createHash, createHmac } from 'node:crypto';

const DEFAULT_HOST = 'api.hibira.io';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export class InboxError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'InboxError';
    this.status = status;
  }
}

/**
 * Signs a user token (HS256 JWT, {sub, exp}) for the inbox's client routes.
 * expiresIn is in seconds (default one day, at most 30 days).
 */
export function signUserToken({ secret, userId, expiresIn = 86400, now = Date.now() }) {
  if (!secret || !userId) throw new Error('signUserToken: secret and userId are required');
  const exp = Math.floor(now / 1000) + Math.min(expiresIn, 30 * 86400);
  const input = `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url(JSON.stringify({ sub: String(userId), exp }))}`;
  return `${input}.${b64url(createHmac('sha256', secret).update(input).digest())}`;
}

/**
 * The inbox API for one app.
 *
 * options: appId, key, secret (from your Hibira app page), host (default
 * api.hibira.io; may include http:// for a local server), fetch.
 */
export function createInbox(options = {}) {
  const { appId, key, secret } = options;
  if (!appId || !key || !secret) throw new Error('createInbox: appId, key and secret are required');
  const doFetch = options.fetch ?? ((...a) => globalThis.fetch(...a));
  const host = options.host ?? DEFAULT_HOST;
  const origin = /^https?:\/\//.test(host) ? host : `https://${host}`;

  async function call(method, path, body, query = {}) {
    const fullPath = `/apps/${encodeURIComponent(appId)}/inbox${path}`;
    const text = body === undefined ? '' : JSON.stringify(body);
    const params = { ...query, auth_key: key, auth_timestamp: String(Math.floor(Date.now() / 1000)), auth_version: '1.0' };
    if (text) params.body_md5 = createHash('md5').update(text).digest('hex');
    for (const k of Object.keys(params)) if (params[k] === undefined || params[k] === '') delete params[k];
    const qs = Object.keys(params)
      .sort()
      .map((k) => `${k.toLowerCase()}=${params[k]}`)
      .join('&');
    const sig = createHmac('sha256', secret).update(`${method}\n${decodeURIComponent(fullPath)}\n${qs}`).digest('hex');
    const search = new URLSearchParams({ ...params, auth_signature: sig });
    const res = await doFetch(`${origin}${fullPath}?${search}`, {
      method,
      headers: text ? { 'Content-Type': 'application/json' } : {},
      body: text || undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) throw new InboxError(res.status, data?.error ?? `inbox request failed (${res.status})`);
    return data;
  }

  const user = (id) => `/users/${encodeURIComponent(id)}/notifications`;

  return {
    /**
     * Sends a notification to users: { users, title, body?, url?, icon?,
     * category?, key?, data?, push? ('offline' | 'always' | 'never') }.
     */
    send(notification) {
      return call('POST', '/notifications', notification);
    },
    /** A page of a user's feed: { status?, limit?, before? }. */
    list(userId, { status, limit, before } = {}) {
      return call('GET', user(userId), undefined, { status, limit: limit && String(limit), before });
    },
    /** Marks a user's notifications: { ids | all, read?, archived? }. */
    mark(userId, change) {
      return call('POST', `${user(userId)}/mark`, change);
    },
    /** Deletes one notification, or all of the user's when id is omitted. */
    delete(userId, id) {
      return call('DELETE', id ? `${user(userId)}/${encodeURIComponent(id)}` : user(userId));
    },
    /** A user token for userId, for the frontend (see signUserToken). */
    userToken(userId, { expiresIn } = {}) {
      return signUserToken({ secret, userId, expiresIn });
    },
  };
}
