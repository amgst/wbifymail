'use client';
import { useState } from 'react';
import Icon from '../icons';
import { api, errorText } from './lib';

export default function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('admin@wbify.com');
  const [password, setPassword] = useState('');
  const [setup, setSetup] = useState(false);
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(null);

  function failure(e: unknown) {
    setMessage({ text: (e as Error).name === 'TimeoutError' ? 'Request timed out. Try signing in; account creation may have completed.' : errorText(e) });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (setup) {
        await api('/api/setup', 'POST', { setupSecret: secret, password });
        setSetup(false);
        setSecret('');
        setPassword('');
        setMessage({ text: 'Admin account created. You can sign in now.', ok: true });
      } else {
        await api('/api/auth', 'POST', { email, password });
        setPassword('');
        onSignedIn();
      }
    } catch (err) {
      failure(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth-brand" aria-hidden="true">
        <div className="brand">
          <span className="brandmark">W</span>
          <span>WBIFY Mail</span>
        </div>
        <div className="auth-pitch">
          <h2>Business email that stays out of your way.</h2>
          <ul>
            <li><Icon name="shield" size={18} /> Sanitized HTML and blocked trackers by default</li>
            <li><Icon name="bell" size={18} /> Instant push alerts on desktop and mobile</li>
            <li><Icon name="keyboard" size={18} /> Keyboard shortcuts for every action</li>
          </ul>
        </div>
        <small>© {new Date().getFullYear()} wbify.com</small>
      </section>
      <section className="auth-form">
        <div className="authcard">
          <div className="brand mobile-only">
            <span className="brandmark">W</span>
            <span>WBIFY Mail</span>
          </div>
          <h1>{setup ? 'Set up your workspace' : 'Sign in'}</h1>
          <p className="muted">{setup ? 'Create the administrator account for your domain.' : 'Use your wbify.com mailbox address.'}</p>
          <form onSubmit={submit}>
            {!setup && (
              <label className="field">
                <span>Email address</span>
                <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
              </label>
            )}
            {setup && (
              <label className="field">
                <span>Setup secret</span>
                <input type="password" required value={secret} onChange={e => setSecret(e.target.value)} placeholder="From your server environment" />
              </label>
            )}
            <label className="field">
              <span>{setup ? 'New admin password (12+ characters)' : 'Password'}</span>
              <input
                type="password"
                autoComplete={setup ? 'new-password' : 'current-password'}
                minLength={setup ? 12 : undefined}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </label>
            {message && (
              <div className={'inline-alert ' + (message.ok ? 'success' : 'error')} role="alert">
                {message.text}
              </div>
            )}
            <button className="btn primary block" type="submit" disabled={busy}>
              {busy ? (setup ? 'Creating account…' : 'Signing in…') : setup ? 'Create admin account' : 'Sign in'}
            </button>
          </form>
          <button
            className="linkbtn"
            disabled={busy}
            onClick={() => {
              setSetup(!setup);
              setMessage(null);
            }}
          >
            {setup ? 'Back to sign in' : 'First time? Set up admin'}
          </button>
        </div>
      </section>
    </main>
  );
}
