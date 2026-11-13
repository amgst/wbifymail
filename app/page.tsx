'use client';
import { useCallback, useEffect, useState } from 'react';
import Login from './mail/login';
import MailApp from './mail/mail-app';
import { api, errorText, type User } from './mail/lib';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const check = useCallback(async () => {
    try {
      const r = await api('/api/auth');
      setUser(r.user);
      setError('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void check();
  }, [check]);

  if (loading)
    return (
      <div className="splash" role="status">
        <span className="brandmark large">W</span>
        <span className="muted">Loading WBIFY Mail…</span>
      </div>
    );
  if (!user)
    return (
      <>
        {error && <div className="inline-alert error floating" role="alert">{error}</div>}
        <Login onSignedIn={check} />
      </>
    );
  return <MailApp key={user.id} user={user} onSignedOut={() => setUser(null)} />;
}
