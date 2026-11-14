'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../icons';
import MailSound from '../mail-sound';
import { restoreAlerts } from '../notifications';
import MessageList, { IconButton, type BulkAction } from './message-list';
import Reader from './reader';
import Composer from './composer';
import { AdminPanel, SettingsDialog, ShortcutsDialog } from './panels';
import { Avatar, Confirm, Toasts, type ConfirmRequest, type Toast } from './ui';
import {
  FOLDER_META, api, defaultSettings, emptyDraft, errorText, forwardDraft, readStore, replyDraft, splitAddresses, syncBadge, writeStore,
  type Draft, type Folder, type Mail, type Settings, type User,
} from './lib';

type ComposeState = { draft: Draft; title: string; focus: 'to' | 'body' };
type MoveTarget = 'archive' | 'trash' | 'restore' | 'inbox';
const FOLDERS: Folder[] = ['inbox', 'starred', 'sent', 'archive', 'trash'];
const narrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;

export default function MailApp({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const draftKey = 'wbify:draft:' + user.id;
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [folder, setFolder] = useState<Folder>('inbox');
  const [messages, setMessages] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [view, setView] = useState<'mail' | 'admin'>('mail');
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [dialog, setDialog] = useState<'settings' | 'shortcuts' | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef(folder);
  folderRef.current = folder;

  // ---------- settings & theme ----------
  useEffect(() => setSettings(readStore('wbify:settings', defaultSettings)), []);
  function updateSettings(change: Partial<Settings>) {
    setSettings(s => {
      const next = { ...s, ...change };
      writeStore('wbify:settings', next);
      return next;
    });
  }
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);

  // ---------- toasts ----------
  const toastId = useRef(0);
  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);
  const toast = useCallback((text: string, opts: Omit<Toast, 'id' | 'text'> = {}) => {
    const id = ++toastId.current;
    setToasts(t => [...t.slice(-3), { id, text, ...opts }]);
    return id;
  }, []);
  const fail = useCallback((e: unknown) => toast(typeof e === 'string' ? e : errorText(e), { tone: 'error' }), [toast]);

  // ---------- loading ----------
  const load = useCallback(
    async (name: Folder = folderRef.current, quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const r = await api('/api/messages?folder=' + name);
        if (folderRef.current !== name) return;
        setMessages(r.messages);
        if (typeof r.unreadCount === 'number') setUnread(r.unreadCount);
        const ids = new Set((r.messages as Mail[]).map(m => m.id));
        setChecked(c => new Set([...c].filter(id => ids.has(id))));
      } catch (e) {
        if (!quiet) fail(e);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [fail],
  );
  useEffect(() => {
    void load('inbox');
  }, [load]);

  // Background refresh while visible; also respond to notification clicks.
  useEffect(() => {
    let busy = false;
    async function refresh() {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      await load(folderRef.current, true);
      busy = false;
    }
    const timer = setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    document.addEventListener('visibilitychange', clearAlerts);
    restoreAlerts().then(clearAlerts).catch(() => {});
    // Opened from a notification: /?m=<message id>
    const linked = new URLSearchParams(location.search).get('m');
    if (linked) {
      history.replaceState(null, '', '/');
      void openById(linked);
    }
    function fromWorker(event: MessageEvent) {
      if (event.data?.type === 'OPEN_INBOX') go('inbox');
      if (event.data?.type === 'OPEN_MESSAGE' && typeof event.data.id === 'string') void openById(event.data.id);
      if (event.data?.type === 'NEW_EMAIL' && folderRef.current === 'inbox') void refresh();
    }
    navigator.serviceWorker?.addEventListener('message', fromWorker);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      document.removeEventListener('visibilitychange', clearAlerts);
      navigator.serviceWorker?.removeEventListener('message', fromWorker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // ---------- derived ----------
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter(m => {
      if (unreadOnly && m.is_read) return false;
      if (!q) return true;
      return [m.sender, m.subject, m.body_text, ...m.recipients, ...(m.cc || [])].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [messages, query, unreadOnly]);
  const selected = messages.find(m => m.id === selectedId) || null;
  const index = selected ? visible.findIndex(m => m.id === selected.id) : -1;

  // ---------- navigation ----------
  function go(next: Folder) {
    setView('mail');
    setDrawer(false);
    setSelectedId(null);
    setFocusId(null);
    setChecked(new Set());
    setUnreadOnly(false);
    if (next !== folderRef.current) {
      setMessages([]);
      folderRef.current = next;
      setFolder(next);
    }
    void load(next);
  }

  /** Seen in the app, so system alerts for new mail are no longer needed. */
  function clearAlerts() {
    if (document.visibilityState !== 'visible' || folderRef.current !== 'inbox') return;
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_ALERTS' });
  }
  async function openById(id: string) {
    if (!/^[0-9a-f]{64}$/i.test(id)) return;
    if (folderRef.current !== 'inbox') go('inbox');
    setView('mail');
    try {
      const r = await api('/api/messages/' + id);
      const m: Mail = { ...r.message, id };
      setMessages(list => (list.some(x => x.id === id) ? list : [m, ...list]));
      void openMail(m);
      clearAlerts();
    } catch (e) {
      fail(e);
    }
  }

  function patchLocal(ids: string[], change: Partial<Mail>) {
    setMessages(list => list.map(m => (ids.includes(m.id) ? { ...m, ...change } : m)));
  }

  async function openMail(m: Mail) {
    setSelectedId(m.id);
    setFocusId(m.id);
    if (m.direction === 'incoming' && m.body_html_version !== 2) {
      api('/api/messages/' + m.id)
        .then(r => patchLocal([m.id], { ...r.message, is_read: true }))
        .catch(fail);
    }
    if (!m.is_read) {
      patchLocal([m.id], { is_read: true });
      setUnread(n => Math.max(0, n - (m.folder === 'inbox' || folder === 'inbox' ? 1 : 0)));
      try {
        const r = await api('/api/messages', 'PATCH', { ids: [m.id], read: true });
        setUnread(r.unreadCount);
      } catch {}
    }
  }

  /** Remove messages from the current view, choosing what to show next. */
  function removeLocal(ids: string[]) {
    if (selectedId && ids.includes(selectedId)) {
      const rest = visible.filter(m => !ids.includes(m.id));
      const pos = Math.min(index, rest.length - 1);
      const next = !narrow() && pos >= 0 ? rest[pos] : null;
      setSelectedId(null);
      setFocusId(next?.id || null);
      if (next) void openMail(next);
    }
    setMessages(list => list.filter(m => !ids.includes(m.id)));
    setChecked(new Set());
  }

  async function flags(ids: string[], change: { read?: boolean; starred?: boolean }) {
    if (!ids.length) return;
    const local: Partial<Mail> = {};
    if (change.read !== undefined) local.is_read = change.read;
    if (change.starred !== undefined) local.is_starred = change.starred;
    if (folder === 'starred' && change.starred === false) removeLocal(ids);
    else patchLocal(ids, local);
    try {
      const r = await api('/api/messages', 'PATCH', { ids, ...change });
      setUnread(r.unreadCount);
    } catch (e) {
      fail(e);
      void load(folder, true);
    }
  }

  async function move(ids: string[], target: MoveTarget, verb: string) {
    if (!ids.length) return;
    const originals = messages.filter(m => ids.includes(m.id)).map(m => ({ id: m.id, from: (m.folder as Folder) || folder }));
    removeLocal(ids);
    try {
      const r = await api('/api/messages', 'PATCH', { ids, folder: target });
      setUnread(r.unreadCount);
      const label = `${ids.length === 1 ? 'Message' : ids.length + ' messages'} ${verb}`;
      toast(label, { action: { label: 'Undo', run: () => void undoMove(originals) } });
    } catch (e) {
      fail(e);
      void load(folder, true);
    }
  }
  async function undoMove(originals: { id: string; from: Folder }[]) {
    const groups = new Map<MoveTarget, string[]>();
    for (const o of originals) {
      const t: MoveTarget = o.from === 'archive' ? 'archive' : o.from === 'trash' ? 'trash' : 'restore';
      groups.set(t, [...(groups.get(t) || []), o.id]);
    }
    try {
      for (const [target, ids] of groups) await api('/api/messages', 'PATCH', { ids, folder: target });
      toast('Action undone');
    } catch (e) {
      fail(e);
    }
    void load(folderRef.current, true);
  }
  function deleteForever(ids: string[]) {
    if (!ids.length) return;
    setConfirm({
      title: ids.length === 1 ? 'Delete this message forever?' : `Delete ${ids.length} messages forever?`,
      message: 'This permanently removes the message from WBIFY Mail. It can’t be undone.',
      confirm: 'Delete forever',
      danger: true,
      run: async () => {
        removeLocal(ids);
        try {
          await api('/api/messages', 'DELETE', { ids });
          toast(ids.length === 1 ? 'Message deleted forever' : `${ids.length} messages deleted forever`);
        } catch (e) {
          fail(e);
          void load(folder, true);
        }
      },
    });
  }
  function emptyTrash() {
    setConfirm({
      title: 'Empty trash?',
      message: `All ${messages.length} message${messages.length === 1 ? '' : 's'} in Trash will be permanently deleted.`,
      confirm: 'Empty trash',
      danger: true,
      run: async () => {
        removeLocal(messages.map(m => m.id));
        try {
          const r = await api('/api/messages', 'DELETE', { emptyTrash: true });
          toast(`Trash emptied (${r.deleted} deleted)`);
          void load('trash', true);
        } catch (e) {
          fail(e);
          void load('trash', true);
        }
      },
    });
  }
  function bulk(action: BulkAction) {
    const ids = [...checked];
    switch (action) {
      case 'archive': return void move(ids, 'archive', 'archived');
      case 'trash': return void move(ids, 'trash', 'moved to Trash');
      case 'restore': return void move(ids, 'restore', folder === 'archive' ? 'moved to Inbox' : 'restored');
      case 'delete': return deleteForever(ids);
      case 'read': return void flags(ids, { read: true }).then(() => setChecked(new Set()));
      case 'unread': return void flags(ids, { read: false }).then(() => setChecked(new Set()));
      case 'star': return void flags(ids, { starred: true });
      case 'unstar': return void flags(ids, { starred: false });
    }
  }

  // ---------- compose & sending ----------
  function openCompose(next: ComposeState) {
    if (compose && (compose.draft.to || compose.draft.body.trim() !== emptyDraft(settings.signature).body.trim())) {
      setConfirm({
        title: 'Replace current draft?',
        message: 'You already have a message open. Starting a new one will discard it.',
        confirm: 'Discard and continue',
        danger: true,
        run: () => setCompose(next),
      });
      return;
    }
    setCompose(next);
    setDrawer(false);
  }
  function newMessage() {
    const saved = readStore<Draft | null>(draftKey, null);
    if (compose) return;
    openCompose({ draft: saved && (saved.to || saved.subject || saved.body) ? saved : emptyDraft(settings.signature), title: 'New message', focus: 'to' });
  }
  function reply(m: Mail, all: boolean) {
    openCompose({ draft: replyDraft(m, user.email, all, settings.signature), title: all ? 'Reply all' : 'Reply', focus: 'body' });
  }
  function forward(m: Mail) {
    openCompose({ draft: forwardDraft(m, settings.signature), title: 'Forward', focus: 'to' });
  }
  function changeDraft(d: Draft) {
    setCompose(c => (c ? { ...c, draft: d } : c));
    writeStore(draftKey, d);
  }
  function discardDraft() {
    writeStore(draftKey, null);
    setCompose(null);
    toast('Draft discarded');
  }

  const pending = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  function send(d: Draft) {
    if (!d.subject.trim()) {
      setConfirm({ title: 'Send without a subject?', message: 'Your message has no subject. Recipients may overlook it.', confirm: 'Send anyway', run: () => queueSend({ ...d, subject: '(no subject)' }) });
      return;
    }
    queueSend(d);
  }
  function queueSend(d: Draft) {
    const title = compose?.title || 'New message';
    setCompose(null);
    const delay = settings.undoSeconds * 1000;
    const id = toast(delay ? `Sending in ${settings.undoSeconds}s…` : 'Sending…', {
      duration: delay ? delay : 30000,
      action: delay
        ? {
            label: 'Undo',
            run: () => {
              clearTimeout(pending.current.get(id));
              pending.current.delete(id);
              setCompose({ draft: d, title, focus: 'body' });
              toast('Sending cancelled');
            },
          }
        : undefined,
    });
    const deliver = async () => {
      pending.current.delete(id);
      dismiss(id);
      try {
        const r = await api('/api/send', 'POST', {
          to: splitAddresses(d.to),
          cc: splitAddresses(d.cc),
          bcc: splitAddresses(d.bcc),
          subject: d.subject,
          body: d.body,
          fromName: settings.displayName.trim() || undefined,
        });
        writeStore(draftKey, null);
        if (r.warning) toast(r.warning, { tone: 'error' });
        else toast('Message sent', { action: { label: 'View', run: () => go('sent') } });
        if (folderRef.current === 'sent') void load('sent', true);
      } catch (e) {
        setCompose({ draft: d, title, focus: 'body' });
        fail((e as Error).name === 'TimeoutError' ? 'Sending timed out. Check Resend logs before retrying; the message may have been accepted.' : e);
      }
    };
    pending.current.set(id, setTimeout(deliver, delay));
  }

  // ---------- sign out ----------
  async function signOut() {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (sub) {
          await api('/api/push', 'DELETE', { endpoint: sub.endpoint }).catch(() => {});
          await sub.unsubscribe();
        }
      }
      await api('/api/auth', 'DELETE');
      await syncBadge(0);
      onSignedOut();
    } catch (e) {
      fail(e);
    }
  }

  // ---------- keyboard shortcuts ----------
  const keyState = useRef({ g: 0 });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (t.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) {
        if (e.key === 'Escape' && t === searchRef.current) {
          setQuery('');
          t.blur();
        }
        return;
      }
      if (dialog || confirm) return;
      const current = visible.find(m => m.id === (selectedId || focusId)) || null;
      const pos = current ? visible.indexOf(current) : -1;
      const step = (d: number) => {
        const next = visible[Math.max(0, Math.min(visible.length - 1, pos + d))] || visible[0];
        if (!next) return;
        if (selectedId) void openMail(next);
        else setFocusId(next.id);
      };
      if (keyState.current.g && Date.now() - keyState.current.g < 1500) {
        keyState.current.g = 0;
        const map: Record<string, Folder> = { i: 'inbox', s: 'starred', t: 'sent', a: 'archive', d: 'trash' };
        if (map[e.key]) {
          e.preventDefault();
          go(map[e.key]);
        }
        return;
      }
      const ids = current ? [current.id] : [];
      const handled = (() => {
        switch (e.key) {
          case 'g': keyState.current.g = Date.now(); return true;
          case 'c': newMessage(); return true;
          case '/': searchRef.current?.focus(); return true;
          case '?': setDialog('shortcuts'); return true;
          case 'j': case 'ArrowDown': step(1); return true;
          case 'k': case 'ArrowUp': step(-1); return true;
          case 'Enter': case 'o': if (current) void openMail(current); return !!current;
          case 'u': case 'Escape': if (selectedId) { setSelectedId(null); return true; } if (checked.size) { setChecked(new Set()); return true; } return false;
          case 'x': if (current) { const n = new Set(checked); if (n.has(current.id)) n.delete(current.id); else n.add(current.id); setChecked(n); } return true;
        }
        const targets = checked.size ? [...checked] : ids;
        if (!targets.length) return false;
        switch (e.key) {
          case 'e': if (folder !== 'archive' && folder !== 'trash') void move(targets, 'archive', 'archived'); return true;
          case '#': case 'Delete': if (folder === 'trash') deleteForever(targets); else void move(targets, 'trash', 'moved to Trash'); return true;
          case 's': { const anyOff = messages.some(m => targets.includes(m.id) && !m.is_starred); void flags(targets, { starred: anyOff }); return true; }
          case 'U': void flags(targets, { read: false }); if (selectedId) setSelectedId(null); return true;
          case 'I': void flags(targets, { read: true }); return true;
          case 'r': if (current) reply(current, false); return !!current;
          case 'a': if (current) reply(current, true); return !!current;
          case 'f': if (current) forward(current); return !!current;
        }
        return false;
      })();
      if (handled) e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // ---------- render ----------
  const meta = FOLDER_META[folder];
  const reading = view === 'mail' && !!selected;
  return (
    <div className={'shell' + (reading ? ' is-reading' : '') + (drawer ? ' drawer-open' : '') + (compose ? ' is-composing' : '')} data-density={settings.density}>
      <MailSound key={user.id} />
      <div className="drawer-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />
      <aside className="sidebar" aria-label="Mail folders">
        <header className="brand">
          <span className="brandmark">W</span>
          <span>WBIFY Mail</span>
        </header>
        <button className="composebtn" onClick={newMessage}>
          <Icon name="pencil" size={18} />
          <span>Compose email</span>
        </button>
        <nav>
          {FOLDERS.map(key => (
            <button key={key} className={view === 'mail' && folder === key ? 'active' : ''} aria-current={view === 'mail' && folder === key ? 'page' : undefined} onClick={() => go(key)}>
              <Icon name={FOLDER_META[key].icon} size={18} />
              <span>{FOLDER_META[key].label}</span>
              {key === 'inbox' && unread > 0 && <em aria-label={`${unread} unread`}>{unread > 999 ? '999+' : unread}</em>}
            </button>
          ))}
          {user.role === 'admin' && (
            <>
              <div className="navlabel">Workspace</div>
              <button className={view === 'admin' ? 'active' : ''} onClick={() => { setView('admin'); setSelectedId(null); setDrawer(false); }}>
                <Icon name="users" size={18} />
                <span>Manage accounts</span>
              </button>
            </>
          )}
        </nav>
        <div className="sidefoot">
          <button className="navlink" onClick={() => { setDialog('settings'); setDrawer(false); }}>
            <Icon name="settings" size={18} />
            <span>Settings</span>
          </button>
          <button className="navlink" onClick={() => { setDialog('shortcuts'); setDrawer(false); }}>
            <Icon name="keyboard" size={18} />
            <span>Shortcuts</span>
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <IconButton icon="menu" label="Open menu" className="menu-btn" onClick={() => setDrawer(true)} />
          <h2 className="topbar-title">{view === 'admin' ? 'Accounts' : meta.label}</h2>
          {view === 'mail' && (
            <div className="search">
              <Icon name="search" size={18} />
              <input
                ref={searchRef}
                type="search"
                placeholder={`Search ${meta.label.toLowerCase()}`}
                aria-label="Search mail"
                value={query}
                onChange={e => { setQuery(e.target.value); setFocusId(null); }}
              />
              {query ? (
                <button type="button" className="icon-btn small" aria-label="Clear search" onClick={() => setQuery('')}>
                  <Icon name="close" size={16} />
                </button>
              ) : (
                <kbd className="desktop-only">/</kbd>
              )}
            </div>
          )}
          <div className="topright">
            <div className="usermenu">
              <button type="button" className="userbtn" aria-label="Account menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                <Avatar address={(settings.displayName ? `${settings.displayName} <${user.email}>` : user.email)} size={34} />
              </button>
              {menu && (
                <>
                  <div className="menu-scrim" onClick={() => setMenu(false)} />
                  <div className="popover" role="menu">
                    <div className="popover-id">
                      <Avatar address={(settings.displayName ? `${settings.displayName} <${user.email}>` : user.email)} size={40} />
                      <div>
                        <b>{settings.displayName || user.email.split('@')[0]}</b>
                        <span className="muted">{user.email}</span>
                      </div>
                    </div>
                    <button role="menuitem" onClick={() => { setMenu(false); setDialog('settings'); }}>
                      <Icon name="settings" size={17} /> Settings
                    </button>
                    <button role="menuitem" onClick={() => { setMenu(false); setDialog('shortcuts'); }}>
                      <Icon name="keyboard" size={17} /> Keyboard shortcuts
                    </button>
                    <button role="menuitem" onClick={signOut}>
                      <Icon name="logout" size={17} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {view === 'admin' ? (
          <AdminPanel onError={fail} onInfo={t => toast(t)} />
        ) : (
          <div className={'mailcontent' + (selected ? ' has-selection' : '')}>
            <MessageList
              folder={folder}
              messages={visible}
              total={messages.length}
              loading={loading}
              query={query.trim()}
              unreadOnly={unreadOnly}
              setUnreadOnly={setUnreadOnly}
              selectedId={selectedId}
              focusId={focusId}
              checked={checked}
              setChecked={setChecked}
              onOpen={openMail}
              onStar={m => void flags([m.id], { starred: !m.is_starred })}
              onBulk={bulk}
              onRefresh={() => void load(folder)}
              onEmptyTrash={emptyTrash}
            />
            <section className="reader" aria-label="Reading pane">
              {selected ? (
                <Reader
                  message={selected}
                  folder={folder}
                  me={user.email}
                  position={{ index, total: visible.length }}
                  onBack={() => setSelectedId(null)}
                  onPrev={() => index > 0 && void openMail(visible[index - 1])}
                  onNext={() => index < visible.length - 1 && void openMail(visible[index + 1])}
                  onArchive={() => void move([selected.id], 'archive', 'archived')}
                  onTrash={() => void move([selected.id], 'trash', 'moved to Trash')}
                  onRestore={() => void move([selected.id], 'restore', selected.folder === 'archive' ? 'moved to Inbox' : 'restored')}
                  onDeleteForever={() => deleteForever([selected.id])}
                  onStar={() => void flags([selected.id], { starred: !selected.is_starred })}
                  onMarkUnread={() => { void flags([selected.id], { read: false }); setSelectedId(null); }}
                  onReply={() => reply(selected, false)}
                  onReplyAll={() => reply(selected, true)}
                  onForward={() => forward(selected)}
                />
              ) : (
                <div className="readerempty">
                  <div className="emptyicon">
                    <Icon name="mail" size={28} />
                  </div>
                  <h3>{checked.size ? `${checked.size} selected` : 'No message selected'}</h3>
                  <p>{checked.size ? 'Use the toolbar above the list to act on them.' : 'Choose a message to read it here.'}</p>
                  <p className="muted hint desktop-only">
                    Press <kbd>?</kbd> for keyboard shortcuts
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <button className="fab" aria-label="Compose email" onClick={newMessage}>
        <Icon name="pencil" size={22} />
      </button>

      {compose && (
        <Composer
          key={compose.title + compose.focus}
          from={settings.displayName ? `${settings.displayName} <${user.email}>` : user.email}
          draft={compose.draft}
          title={compose.title}
          focus={compose.focus}
          onChange={changeDraft}
          onSend={send}
          onDiscard={discardDraft}
          onClose={() => setCompose(null)}
        />
      )}
      {dialog === 'settings' && <SettingsDialog settings={settings} update={updateSettings} email={user.email} onClose={() => setDialog(null)} onError={fail} />}
      {dialog === 'shortcuts' && <ShortcutsDialog onClose={() => setDialog(null)} />}
      {confirm && <Confirm request={confirm} onClose={() => setConfirm(null)} />}
      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
