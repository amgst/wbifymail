export type User = { id: string; email: string; role: string };
export type Folder = 'inbox' | 'starred' | 'sent' | 'archive' | 'trash';
export type Mail = {
  id: string;
  sender: string;
  recipients: string[];
  cc?: string[];
  subject: string;
  body_text: string;
  body_html?: string | null;
  body_html_version?: number;
  created_at: string;
  is_read: boolean;
  is_starred?: boolean;
  folder?: string;
  direction: string;
};
export type Draft = { to: string; cc: string; bcc: string; subject: string; body: string; showCc?: boolean };
export type Settings = {
  theme: 'system' | 'light' | 'dark';
  density: 'comfortable' | 'compact';
  undoSeconds: number;
  displayName: string;
  signature: string;
  readingPane: boolean;
};
export const defaultSettings: Settings = { theme: 'system', density: 'comfortable', undoSeconds: 5, displayName: '', signature: '', readingPane: true };

export const FOLDER_META: Record<Folder, { label: string; icon: string; empty: string; hint: string }> = {
  inbox: { label: 'Inbox', icon: 'inbox', empty: 'Your inbox is clear', hint: 'New email will appear here as soon as it arrives.' },
  starred: { label: 'Starred', icon: 'star', empty: 'No starred messages', hint: 'Star important messages to find them quickly here.' },
  sent: { label: 'Sent', icon: 'sent', empty: 'Nothing sent yet', hint: 'Messages you send will be kept here.' },
  archive: { label: 'Archive', icon: 'archive', empty: 'Archive is empty', hint: 'Archive messages to clear your inbox without deleting them.' },
  trash: { label: 'Trash', icon: 'trash', empty: 'Trash is empty', hint: 'Deleted messages stay here until you empty the trash.' },
};

async function syncBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) await nav.setAppBadge?.(count);
    else await nav.clearAppBadge?.();
  } catch {}
}
export { syncBadge };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api(url: string, method = 'GET', body?: unknown): Promise<any> {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  const text = await r.text();
  let data;
  try {
    data = text.trim() ? JSON.parse(text) : null;
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${r.status}). Refresh the page and try again.`);
  }
  if (!data || typeof data !== 'object') throw new Error(`The server returned an empty or invalid response (HTTP ${r.status}). Refresh the page and try again.`);
  if (!r.ok) throw new Error((data.error || `Request failed (HTTP ${r.status})`) + (data.requestId ? ` [${data.stage || 'request'}; ref ${data.requestId}]` : ''));
  if (typeof data.unreadCount === 'number') await syncBadge(data.unreadCount);
  return data;
}

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

/** Splits `"Jane Doe" <jane@x.com>` into name and address. */
export function parseAddress(value: string) {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value || '');
  if (match) {
    const email = match[2].trim();
    return { name: match[1].trim() || email, email };
  }
  const email = (value || '').trim();
  return { name: email, email };
}
export function shortName(value: string) {
  const { name, email } = parseAddress(value);
  return name === email ? email.split('@')[0] : name;
}

const palette = ['#5b5bd6', '#0e8a6a', '#c2410c', '#be185d', '#0369a1', '#7c3aed', '#a16207', '#15803d', '#b91c1c', '#4338ca'];
export function avatarColor(seed: string) {
  let h = 0;
  for (const c of seed.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
export function initials(value: string) {
  const name = shortName(value).replace(/[^\p{L}\p{N}\s.]/gu, ' ').trim();
  const parts = name.split(/[\s.]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
export function listDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
export function fullDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function relative(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : '';
}
export function dateGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000;
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'Earlier this week';
  if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) return 'Earlier this month';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function snippet(text: string) {
  return (text || '').replace(/^>.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function withPrefix(prefix: string, subject: string) {
  return new RegExp('^' + prefix + ':', 'i').test(subject.trim()) ? subject : `${prefix}: ${subject || '(no subject)'}`;
}
function quote(m: Mail) {
  const lines = (m.body_text || '').split(/\r?\n/).map(l => '> ' + l).join('\n');
  return `\n\nOn ${fullDate(m.created_at)}, ${m.sender} wrote:\n${lines}`;
}
export function replyDraft(m: Mail, me: string, all: boolean, signature: string): Draft {
  const self = me.toLowerCase();
  const outgoing = m.direction === 'outgoing';
  const primary = outgoing ? m.recipients : [parseAddress(m.sender).email];
  const others = all ? [...(outgoing ? [] : m.recipients), ...(m.cc || [])].map(a => parseAddress(a).email) : [];
  const cc = [...new Set(others.filter(a => a.toLowerCase() !== self && !primary.includes(a)))];
  return { to: primary.join(', '), cc: cc.join(', '), bcc: '', showCc: cc.length > 0, subject: withPrefix('Re', m.subject), body: sig(signature) + quote(m) };
}
export function forwardDraft(m: Mail, signature: string): Draft {
  const header = [
    '---------- Forwarded message ---------',
    `From: ${m.sender}`,
    `Date: ${fullDate(m.created_at)}`,
    `Subject: ${m.subject}`,
    `To: ${m.recipients.join(', ')}`,
    ...(m.cc?.length ? [`Cc: ${m.cc.join(', ')}`] : []),
  ].join('\n');
  return { to: '', cc: '', bcc: '', subject: withPrefix('Fwd', m.subject), body: sig(signature) + '\n\n' + header + '\n\n' + (m.body_text || '') };
}
export function sig(signature: string) {
  return signature.trim() ? `\n\n-- \n${signature.trim()}` : '';
}
export const emptyDraft = (signature: string): Draft => ({ to: '', cc: '', bcc: '', subject: '', body: sig(signature) });

export function splitAddresses(value: string) {
  return value.split(/[,;\s]+/).map(v => v.trim()).filter(Boolean);
}
export function invalidAddresses(value: string) {
  return splitAddresses(value).filter(v => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v));
}

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
export function writeStore(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
