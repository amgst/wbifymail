'use client';
import { useEffect, useState } from 'react';
import Notifications from '../notifications';
import { Avatar, Modal } from './ui';
import { api, errorText, type Settings } from './lib';

export function SettingsDialog({ settings, update, email, onClose, onError }: { settings: Settings; update: (s: Partial<Settings>) => void; email: string; onClose: () => void; onError: (m: string) => void }) {
  const [tab, setTab] = useState<'general' | 'compose' | 'alerts'>('general');
  return (
    <Modal title="Settings" onClose={onClose} wide>
      <div className="tabs" role="tablist">
        {(
          [
            ['general', 'General'],
            ['compose', 'Compose'],
            ['alerts', 'Notifications'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'general' && (
        <div className="settings-grid">
          <Setting label="Theme" hint="Match your system or choose a fixed appearance.">
            <Segmented value={settings.theme} options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} onChange={v => update({ theme: v as Settings['theme'] })} />
          </Setting>
          <Setting label="Density" hint="Compact fits more messages on screen.">
            <Segmented value={settings.density} options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]} onChange={v => update({ density: v as Settings['density'] })} />
          </Setting>
        </div>
      )}
      {tab === 'compose' && (
        <div className="settings-grid">
          <Setting label="Your name" hint={`Recipients see this next to ${email}.`}>
            <input className="input" maxLength={64} value={settings.displayName} onChange={e => update({ displayName: e.target.value.replace(/[<>"@\r\n]/g, '') })} placeholder="e.g. Jane at WBIFY" />
          </Setting>
          <Setting label="Undo send" hint="Time to cancel a message after pressing Send.">
            <select className="input" value={settings.undoSeconds} onChange={e => update({ undoSeconds: Number(e.target.value) })}>
              {[0, 5, 10, 20, 30].map(s => (
                <option key={s} value={s}>
                  {s ? `${s} seconds` : 'Off'}
                </option>
              ))}
            </select>
          </Setting>
          <Setting label="Signature" hint="Added to new messages, replies and forwards.">
            <textarea className="input" rows={5} value={settings.signature} onChange={e => update({ signature: e.target.value.slice(0, 2000) })} placeholder={'Jane Doe\nWBIFY · wbify.com'} />
          </Setting>
        </div>
      )}
      {tab === 'alerts' && (
        <div className="settings-grid">
          <Setting label="Email alerts" hint="Get a notification on this device when new mail arrives.">
            <Notifications onError={onError} />
          </Setting>
        </div>
      )}
    </Modal>
  );
}

function Setting({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="setting">
      <div>
        <b>{label}</b>
        <p className="muted">{hint}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}
function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export const SHORTCUTS: [string, string][] = [
  ['c', 'Compose'],
  ['/', 'Search'],
  ['j / k', 'Older / newer message'],
  ['Enter or o', 'Open message'],
  ['u', 'Back to list'],
  ['x', 'Select message'],
  ['e', 'Archive'],
  ['#', 'Delete'],
  ['s', 'Star / unstar'],
  ['Shift + U', 'Mark as unread'],
  ['Shift + I', 'Mark as read'],
  ['r', 'Reply'],
  ['a', 'Reply all'],
  ['f', 'Forward'],
  ['g then i / s / t / a / d', 'Go to Inbox / Starred / Sent / Archive / Trash'],
  ['Ctrl + Enter', 'Send message'],
  ['Esc', 'Close dialog or composer'],
  ['?', 'Show shortcuts'],
];
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <dl className="shortcuts">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k}>
            <dt>
              {k.split(' ').map((part, i) => (['/', 'or', 'then', '+'].includes(part) && k !== '/' ? <span key={i} className="muted"> {part} </span> : <kbd key={i}>{part}</kbd>))}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

export function AdminPanel({ onError, onInfo }: { onError: (m: string) => void; onInfo: (m: string) => void }) {
  const [mailboxes, setMailboxes] = useState<{ email: string; role: string; created_at?: string; active?: boolean }[] | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await api('/api/mailboxes');
      setMailboxes(r.mailboxes);
    } catch (e) {
      onError(errorText(e));
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/mailboxes', 'POST', { email, password });
      onInfo(`Mailbox ${email} created`);
      setEmail('');
      setPassword('');
      await load();
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="manage">
      <div className="manage-inner">
        <h2>Manage your email accounts</h2>
        <p className="muted">Each mailbox has its own sign-in and private inbox.</p>
        <div className="card">
          <div className="card-head">
            <b>Mailboxes</b>
            <span className="muted">{mailboxes ? mailboxes.length : '…'}</span>
          </div>
          <ul className="accountlist">
            {(mailboxes || []).map(m => (
              <li key={m.email}>
                <Avatar address={m.email} size={34} />
                <div>
                  <b>{m.email}</b>
                  {m.created_at && <small className="muted">Created {new Date(m.created_at).toLocaleDateString()}</small>}
                </div>
                <span className={'badge' + (m.role === 'admin' ? ' accent' : '')}>{m.role}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <div className="card-head">
            <b>Create a mailbox</b>
          </div>
          <form className="gridform" onSubmit={add}>
            <label className="field">
              <span>Email address</span>
              <input type="email" required placeholder="support@wbify.com" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Password (12+ characters)</span>
              <input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            <div>
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create mailbox'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
