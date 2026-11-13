'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from '../icons';
import { invalidAddresses, type Draft } from './lib';

type Props = {
  from: string;
  draft: Draft;
  title: string;
  focus: 'to' | 'body';
  onChange: (d: Draft) => void;
  onSend: (d: Draft) => void;
  onDiscard: () => void;
  onClose: () => void;
};

export default function Composer(p: Props) {
  const d = p.draft;
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<boolean | null>(null);
  const firstRender = useRef(true);
  const toRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const showCc = d.showCc || !!d.cc || !!d.bcc;

  useEffect(() => {
    if (p.focus === 'body' && bodyRef.current) {
      bodyRef.current.focus();
      bodyRef.current.setSelectionRange(0, 0);
      bodyRef.current.scrollTop = 0;
    } else toRef.current?.focus();
  }, [p.focus]);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaved(false);
    const t = setTimeout(() => setSaved(true), 800);
    return () => clearTimeout(t);
  }, [d]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setError('');
    p.onChange({ ...d, [key]: value });
  }
  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const bad = [...invalidAddresses(d.to), ...invalidAddresses(d.cc), ...invalidAddresses(d.bcc)];
    if (!d.to.trim()) return setError('Add at least one recipient.');
    if (bad.length) return setError(`Check ${bad.length === 1 ? 'this address' : 'these addresses'}: ${bad.join(', ')}`);
    if (!d.body.trim()) return setError('Write a message before sending.');
    p.onSend(d);
  }
  function keys(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      p.onClose();
    }
  }

  return (
    <section className={'composer editor' + (minimized ? ' minimized' : '') + (expanded ? ' expanded' : '')} role="dialog" aria-label={p.title} onKeyDown={keys}>
      <header className="composer-head" onClick={() => minimized && setMinimized(false)}>
        <strong>{p.title}</strong>
        <span className="composer-actions">
          <button type="button" className="icon-btn small desktop-only" aria-label={minimized ? 'Restore' : 'Minimize'} title={minimized ? 'Restore' : 'Minimize'} onClick={e => { e.stopPropagation(); setMinimized(!minimized); }}>
            <Icon name="minimize" size={16} />
          </button>
          <button type="button" className="icon-btn small desktop-only" aria-label={expanded ? 'Exit full screen' : 'Full screen'} title={expanded ? 'Exit full screen' : 'Full screen'} onClick={e => { e.stopPropagation(); setExpanded(!expanded); setMinimized(false); }}>
            <Icon name="expand" size={16} />
          </button>
          <button type="button" className="icon-btn small" aria-label="Close compose" title="Save draft and close (Esc)" onClick={e => { e.stopPropagation(); p.onClose(); }}>
            <Icon name="close" size={16} />
          </button>
        </span>
      </header>
      {!minimized && (
        <form onSubmit={submit} noValidate>
          <div className="fieldrow">
            <span>From</span>
            <strong className="fromvalue">{p.from}</strong>
          </div>
          <div className="fieldrow">
            <label htmlFor="compose-to">To</label>
            <input id="compose-to" ref={toRef} type="text" inputMode="email" autoComplete="email" value={d.to} onChange={e => set('to', e.target.value)} placeholder="name@example.com, …" />
            {!showCc && (
              <button type="button" className="linkbtn" onClick={() => set('showCc', true)}>
                Cc/Bcc
              </button>
            )}
          </div>
          {showCc && (
            <>
              <div className="fieldrow">
                <label htmlFor="compose-cc">Cc</label>
                <input id="compose-cc" type="text" inputMode="email" value={d.cc} onChange={e => set('cc', e.target.value)} />
              </div>
              <div className="fieldrow">
                <label htmlFor="compose-bcc">Bcc</label>
                <input id="compose-bcc" type="text" inputMode="email" value={d.bcc} onChange={e => set('bcc', e.target.value)} />
              </div>
            </>
          )}
          <div className="fieldrow">
            <label htmlFor="compose-subject">Subject</label>
            <input id="compose-subject" maxLength={300} value={d.subject} onChange={e => set('subject', e.target.value)} />
          </div>
          <textarea ref={bodyRef} aria-label="Message body" value={d.body} onChange={e => set('body', e.target.value)} placeholder="Write your message…" />
          {error && (
            <div className="inline-alert error" role="alert">
              {error}
            </div>
          )}
          <div className="editorbottom">
            <button className="btn primary" type="submit" title="Send (Ctrl+Enter)">
              <Icon name="sent" size={16} />
              Send
            </button>
            <small className="muted" aria-live="polite">{saved === null ? 'Ctrl+Enter to send' : saved ? 'Draft saved' : 'Saving…'}</small>
            <span className="spacer" />
            <button type="button" className="icon-btn" aria-label="Discard draft" title="Discard draft" onClick={p.onDiscard}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
