'use client';
import { useEffect, useRef } from 'react';
import Icon from '../icons';
import { Avatar } from './ui';
import { FOLDER_META, dateGroup, listDate, parseAddress, snippet, type Folder, type Mail } from './lib';

export type BulkAction = 'archive' | 'trash' | 'restore' | 'delete' | 'read' | 'unread' | 'star' | 'unstar';

type Props = {
  folder: Folder;
  messages: Mail[];
  total: number;
  loading: boolean;
  query: string;
  unreadOnly: boolean;
  setUnreadOnly: (v: boolean) => void;
  selectedId: string | null;
  focusId: string | null;
  checked: Set<string>;
  setChecked: (s: Set<string>) => void;
  onOpen: (m: Mail) => void;
  onStar: (m: Mail) => void;
  onBulk: (action: BulkAction) => void;
  onRefresh: () => void;
  onEmptyTrash: () => void;
};

export default function MessageList(p: Props) {
  const meta = FOLDER_META[p.folder];
  const selectAll = useRef<HTMLInputElement>(null);
  const allChecked = p.messages.length > 0 && p.messages.every(m => p.checked.has(m.id));
  const someChecked = p.checked.size > 0;
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);
  useEffect(() => {
    if (p.focusId) document.getElementById('row-' + p.focusId)?.scrollIntoView({ block: 'nearest' });
  }, [p.focusId]);

  const checkedMail = p.messages.filter(m => p.checked.has(m.id));
  const anyUnread = checkedMail.some(m => !m.is_read);
  const anyUnstarred = checkedMail.some(m => !m.is_starred);
  const trash = p.folder === 'trash';

  function toggle(id: string) {
    const next = new Set(p.checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    p.setChecked(next);
  }

  let lastGroup = '';
  return (
    <section className="maillist" aria-label={meta.label}>
      <div className="listhead">
        <input
          ref={selectAll}
          type="checkbox"
          className="check"
          aria-label="Select all messages"
          checked={allChecked}
          disabled={!p.messages.length}
          onChange={() => p.setChecked(allChecked ? new Set() : new Set(p.messages.map(m => m.id)))}
        />
        {someChecked ? (
          <div className="bulkbar" role="toolbar" aria-label="Selected messages">
            <span className="bulkcount">{p.checked.size} selected</span>
            {trash ? (
              <>
                <IconButton icon="restore" label="Restore" onClick={() => p.onBulk('restore')} />
                <IconButton icon="trash" label="Delete forever" onClick={() => p.onBulk('delete')} />
              </>
            ) : (
              <>
                {p.folder !== 'archive' && <IconButton icon="archive" label="Archive" onClick={() => p.onBulk('archive')} />}
                {p.folder === 'archive' && <IconButton icon="inbox" label="Move to inbox" onClick={() => p.onBulk('restore')} />}
                <IconButton icon="trash" label="Delete" onClick={() => p.onBulk('trash')} />
                <IconButton icon={anyUnread ? 'mailopen' : 'mail'} label={anyUnread ? 'Mark as read' : 'Mark as unread'} onClick={() => p.onBulk(anyUnread ? 'read' : 'unread')} />
                <IconButton icon="star" label={anyUnstarred ? 'Star' : 'Remove star'} onClick={() => p.onBulk(anyUnstarred ? 'star' : 'unstar')} />
              </>
            )}
          </div>
        ) : (
          <div className="listtitle">
            <strong>{p.query ? 'Search results' : meta.label}</strong>
            <small>
              {p.query || p.unreadOnly ? `${p.messages.length} of ${p.total}` : p.total} {p.total === 1 ? 'message' : 'messages'}
            </small>
          </div>
        )}
        <div className="listtools">
          {p.folder !== 'sent' && !someChecked && (
            <button type="button" className={'chip' + (p.unreadOnly ? ' on' : '')} aria-pressed={p.unreadOnly} onClick={() => p.setUnreadOnly(!p.unreadOnly)}>
              Unread
            </button>
          )}
          {trash && p.total > 0 && !someChecked && (
            <button type="button" className="chip danger" onClick={p.onEmptyTrash}>
              Empty trash
            </button>
          )}
          <IconButton icon="refresh" label="Refresh messages" onClick={p.onRefresh} spin={p.loading} />
        </div>
      </div>
      <div className="listscroll">
        {p.loading && p.total === 0 ? (
          <Skeleton />
        ) : p.messages.length === 0 ? (
          <div className="empty">
            <div className="emptyicon">
              <Icon name={p.query ? 'search' : meta.icon} size={28} />
            </div>
            <h3>{p.query ? 'No matching messages' : p.unreadOnly ? 'No unread messages' : meta.empty}</h3>
            <p>{p.query ? `Nothing in ${meta.label} matches “${p.query}”.` : p.unreadOnly ? 'You’re all caught up.' : meta.hint}</p>
          </div>
        ) : (
          <ul role="list">
            {p.messages.map(m => {
              const group = dateGroup(m.created_at);
              const showGroup = group !== lastGroup;
              lastGroup = group;
              const outgoing = m.direction === 'outgoing';
              const who = outgoing ? 'To: ' + (m.recipients.map(r => parseAddress(r).name).join(', ') || '(no recipient)') : parseAddress(m.sender).name;
              return (
                <li key={m.id}>
                  {showGroup && <div className="groupLabel">{group}</div>}
                  <div
                    id={'row-' + m.id}
                    className={
                      'mailrow' +
                      (p.selectedId === m.id ? ' picked' : '') +
                      (p.focusId === m.id ? ' focused' : '') +
                      (!m.is_read ? ' unread' : '') +
                      (p.checked.has(m.id) ? ' checked' : '')
                    }
                  >
                    <div className="rowcontrols">
                      <input type="checkbox" className="check" aria-label={'Select: ' + (m.subject || '(no subject)')} checked={p.checked.has(m.id)} onChange={() => toggle(m.id)} />
                      <button
                        type="button"
                        className={'starbtn' + (m.is_starred ? ' on' : '')}
                        aria-pressed={!!m.is_starred}
                        aria-label={m.is_starred ? 'Starred' : 'Not starred'}
                        title={m.is_starred ? 'Remove star' : 'Star'}
                        onClick={() => p.onStar(m)}
                      >
                        <Icon name="star" size={17} filled={m.is_starred} />
                      </button>
                    </div>
                    <button type="button" className="mailopen" onClick={() => p.onOpen(m)}>
                      <Avatar address={outgoing ? m.recipients[0] || '?' : m.sender} size={38} />
                      <span className="msgmeta">
                        <span className="msgfirst">
                          <b className="who">{who}</b>
                          {p.folder === 'starred' || p.query ? m.folder && m.folder !== 'inbox' && <span className="foldertag">{FOLDER_META[m.folder as Folder]?.label || m.folder}</span> : null}
                          <time dateTime={m.created_at}>{listDate(m.created_at)}</time>
                        </span>
                        <span className="subject">{m.subject || '(no subject)'}</span>
                        <span className="snippet">{snippet(m.body_text)}</span>
                      </span>
                      {!m.is_read && <span className="sr-only">Unread</span>}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export function IconButton({ icon, label, onClick, spin, className, disabled, filled }: { icon: string; label: string; onClick: () => void; spin?: boolean; className?: string; disabled?: boolean; filled?: boolean }) {
  return (
    <button type="button" className={'icon-btn' + (spin ? ' spinning' : '') + (className ? ' ' + className : '')} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={18} filled={filled} />
    </button>
  );
}

function Skeleton() {
  return (
    <div aria-label="Loading messages" role="status">
      {Array.from({ length: 7 }, (_, i) => (
        <div className="mailrow skeleton" key={i}>
          <span className="sk sk-avatar" />
          <span className="msgmeta">
            <span className="sk" style={{ width: '40%' }} />
            <span className="sk" style={{ width: '75%' }} />
            <span className="sk" style={{ width: '90%' }} />
          </span>
        </div>
      ))}
    </div>
  );
}
