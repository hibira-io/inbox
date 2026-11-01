import { createInbox, signUserToken, type SendResult } from '@hibira-io/inbox';
import { createInboxClient, type InboxState, type Notification } from '@hibira-io/inbox/client';
import { NotificationBell, NotificationInbox, useInboxClient } from '@hibira-io/inbox/react';
import { NotificationBell as VueBell } from '@hibira-io/inbox/vue';
import { NotificationBell as NativeBell } from '@hibira-io/inbox/react-native';

const inbox = createInbox({ appId: 'a', key: 'k', secret: 's' });
const sent: Promise<SendResult> = inbox.send({ users: ['ann'], title: 'Hi', push: 'offline', data: { order: 1 } });
void sent;
void inbox.mark('ann', { all: true, read: true });
void inbox.mark('ann', { ids: ['ntf_1'], archived: true });
// @ts-expect-error ids and all together
void inbox.mark('ann', { ids: ['x'], all: true });
const token: string = signUserToken({ secret: 's', userId: 'ann' }) + inbox.userToken('ann', { expiresIn: 60 });

const client = createInboxClient({ appId: 'a', token: async () => token });
const state: InboxState = client.getState();
const first: Notification | undefined = state.items[0];
void first?.read_at;
client.setStatus('archived');
// @ts-expect-error unknown tab
client.setStatus('spam');

void NotificationBell({ client, locale: 'ja', align: 'start', onSelect: (n) => n.url, labels: { tabs: { archived: 'Done' } } });
void NotificationInbox({ client, tabs: ['', 'unread'] });
void useInboxClient;
void VueBell;
void NativeBell({ client, theme: { mode: 'dark', accent: '#f00' } });
