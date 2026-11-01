// Labels for the bundled components. Pass `locale` to pick one, or `labels`
// to override single strings.

const en = {
  title: 'Notifications',
  bell: 'Notifications',
  unreadCount: '{count} unread',
  tabs: { '': 'Inbox', unread: 'Unread', archived: 'Archived' },
  markAllRead: 'Mark all as read',
  markRead: 'Mark as read',
  markUnread: 'Mark as unread',
  archive: 'Archive',
  unarchive: 'Move to inbox',
  empty: { '': 'You are all caught up.', unread: 'No unread notifications.', archived: 'Nothing archived.' },
  loading: 'Loading…',
  loadMore: 'Show older',
  error: 'Could not load notifications.',
  retry: 'Try again',
};

const zhTW = {
  title: '通知',
  bell: '通知',
  unreadCount: '{count} 則未讀',
  tabs: { '': '收件匣', unread: '未讀', archived: '已封存' },
  markAllRead: '全部標為已讀',
  markRead: '標為已讀',
  markUnread: '標為未讀',
  archive: '封存',
  unarchive: '移回收件匣',
  empty: { '': '目前沒有新通知。', unread: '沒有未讀通知。', archived: '沒有封存的通知。' },
  loading: '載入中…',
  loadMore: '顯示較舊的通知',
  error: '無法載入通知。',
  retry: '重試',
};

const zhCN = {
  title: '通知',
  bell: '通知',
  unreadCount: '{count} 条未读',
  tabs: { '': '收件箱', unread: '未读', archived: '已归档' },
  markAllRead: '全部标为已读',
  markRead: '标为已读',
  markUnread: '标为未读',
  archive: '归档',
  unarchive: '移回收件箱',
  empty: { '': '暂时没有新通知。', unread: '没有未读通知。', archived: '没有归档的通知。' },
  loading: '加载中…',
  loadMore: '显示更早的通知',
  error: '无法加载通知。',
  retry: '重试',
};

const ja = {
  title: '通知',
  bell: '通知',
  unreadCount: '未読 {count} 件',
  tabs: { '': '受信箱', unread: '未読', archived: 'アーカイブ' },
  markAllRead: 'すべて既読にする',
  markRead: '既読にする',
  markUnread: '未読にする',
  archive: 'アーカイブ',
  unarchive: '受信箱に戻す',
  empty: { '': '新しい通知はありません。', unread: '未読の通知はありません。', archived: 'アーカイブした通知はありません。' },
  loading: '読み込み中…',
  loadMore: '以前の通知を表示',
  error: '通知を読み込めませんでした。',
  retry: '再試行',
};

const ko = {
  title: '알림',
  bell: '알림',
  unreadCount: '읽지 않음 {count}개',
  tabs: { '': '받은 알림', unread: '읽지 않음', archived: '보관됨' },
  markAllRead: '모두 읽음으로 표시',
  markRead: '읽음으로 표시',
  markUnread: '읽지 않음으로 표시',
  archive: '보관',
  unarchive: '받은 알림으로 이동',
  empty: { '': '새 알림이 없습니다.', unread: '읽지 않은 알림이 없습니다.', archived: '보관된 알림이 없습니다.' },
  loading: '불러오는 중…',
  loadMore: '이전 알림 보기',
  error: '알림을 불러오지 못했습니다.',
  retry: '다시 시도',
};

const th = {
  title: 'การแจ้งเตือน',
  bell: 'การแจ้งเตือน',
  unreadCount: 'ยังไม่อ่าน {count} รายการ',
  tabs: { '': 'กล่องข้อความ', unread: 'ยังไม่อ่าน', archived: 'เก็บถาวร' },
  markAllRead: 'ทำเครื่องหมายว่าอ่านทั้งหมด',
  markRead: 'ทำเครื่องหมายว่าอ่านแล้ว',
  markUnread: 'ทำเครื่องหมายว่ายังไม่อ่าน',
  archive: 'เก็บถาวร',
  unarchive: 'ย้ายกลับกล่องข้อความ',
  empty: { '': 'ไม่มีการแจ้งเตือนใหม่', unread: 'ไม่มีการแจ้งเตือนที่ยังไม่อ่าน', archived: 'ไม่มีรายการที่เก็บถาวร' },
  loading: 'กำลังโหลด…',
  loadMore: 'แสดงรายการก่อนหน้า',
  error: 'โหลดการแจ้งเตือนไม่ได้',
  retry: 'ลองอีกครั้ง',
};

const vi = {
  title: 'Thông báo',
  bell: 'Thông báo',
  unreadCount: '{count} chưa đọc',
  tabs: { '': 'Hộp thư', unread: 'Chưa đọc', archived: 'Đã lưu trữ' },
  markAllRead: 'Đánh dấu tất cả là đã đọc',
  markRead: 'Đánh dấu đã đọc',
  markUnread: 'Đánh dấu chưa đọc',
  archive: 'Lưu trữ',
  unarchive: 'Chuyển về hộp thư',
  empty: { '': 'Bạn đã xem hết thông báo.', unread: 'Không có thông báo chưa đọc.', archived: 'Chưa có thông báo lưu trữ.' },
  loading: 'Đang tải…',
  loadMore: 'Xem thông báo cũ hơn',
  error: 'Không tải được thông báo.',
  retry: 'Thử lại',
};

export const locales = { en, 'zh-TW': zhTW, 'zh-CN': zhCN, ja, ko, th, vi };

/** The labels for locale (a BCP 47 tag; falls back by language, then English), with overrides merged in. */
export function labelsFor(locale, overrides) {
  let base = en;
  if (locale) {
    const tag = String(locale);
    const lang = tag.split('-')[0].toLowerCase();
    if (locales[tag]) base = locales[tag];
    else if (lang === 'zh') base = /hans|cn|sg/i.test(tag) ? zhCN : zhTW;
    else if (locales[lang]) base = locales[lang];
  }
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    tabs: { ...base.tabs, ...overrides.tabs },
    empty: { ...base.empty, ...overrides.empty },
  };
}

/** Replaces {name} placeholders. */
export function format(text, values) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (values[k] === undefined ? m : String(values[k])));
}
