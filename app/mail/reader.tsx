'use client';
import Icon from '../icons';
import EmailBody from '../email-body';
import { Avatar } from './ui';
import { IconButton } from './message-list';
import { FOLDER_META, fullDate, parseAddress, relative, type Folder, type Mail } from './lib';

type Props = {
  message: Mail;
  folder: Folder;
  me: string;
  position: { index: number; total: number };
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
  onStar: () => void;
  onMarkUnread: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
};

function Addresses({ label, list }: { label: string; list?: string[] }) {
  if (!list?.length) return null;
  return (
    <span className="addrline">
      <span className="muted">{label}</span> {list.map(a => parseAddress(a).email).join(', ')}
    </span>
  );
}

export default function Reader(p: Props) {
  const m = p.message;
  const sender = parseAddress(m.sender);
  const where = (m.folder as Folder) || p.folder;
  const inTrash = where === 'trash';
  const others = [...m.recipients, ...(m.cc || [])].filter(a => parseAddress(a).email.toLowerCase() !== p.me.toLowerCase());
  const canReplyAll = m.direction === 'outgoing' ? m.recipients.length + (m.cc?.length || 0) > 1 : others.length > 0;
  const ago = relative(m.created_at);

  return (
    <article className="readerinner" aria-labelledby="reader-subject">
      <div className="readerhead" role="toolbar" aria-label="Message actions">
        <button type="button" className="icon-btn back" aria-label="Back to list" title="Back to list (u)" onClick={p.onBack}>
          <Icon name="back" size={18} />
        </button>
        {inTrash ? (
          <>
            <IconButton icon="restore" label="Restore" onClick={p.onRestore} />
            <IconButton icon="trash" label="Delete forever" onClick={p.onDeleteForever} />
          </>
        ) : (
          <>
            {where === 'archive' ? <IconButton icon="inbox" label="Move to inbox" onClick={p.onRestore} /> : <IconButton icon="archive" label="Archive (e)" onClick={p.onArchive} />}
            <IconButton icon="trash" label="Delete (#)" onClick={p.onTrash} />
            <IconButton icon="mail" label="Mark as unread (Shift+U)" onClick={p.onMarkUnread} />
          </>
        )}
        <span className="divider" />
        <IconButton icon="print" label="Print" onClick={() => window.print()} />
        <span className="spacer" />
        {p.position.total > 0 && (
          <span className="pager">
            <span className="muted">
              {p.position.index + 1} of {p.position.total}
            </span>
            <IconButton icon="chevronleft" label="Newer (k)" onClick={p.onPrev} disabled={p.position.index <= 0} />
            <IconButton icon="chevronright" label="Older (j)" onClick={p.onNext} disabled={p.position.index >= p.position.total - 1} />
          </span>
        )}
      </div>
      <div className="readerscroll">
        <div className="subjectline">
          <h1 id="reader-subject">{m.subject || '(no subject)'}</h1>
          {where !== p.folder && FOLDER_META[where] && <span className="foldertag">{FOLDER_META[where].label}</span>}
          <button type="button" className={'starbtn large' + (m.is_starred ? ' on' : '')} aria-pressed={!!m.is_starred} aria-label={m.is_starred ? 'Remove star' : 'Star message'} title="Star (s)" onClick={p.onStar}>
            <Icon name="star" size={20} filled={m.is_starred} />
          </button>
        </div>
        <div className="readerfrom">
          <Avatar address={m.sender} size={42} />
          <div className="fromtext">
            <span className="fromline">
              <b>{sender.name}</b>
              {sender.name !== sender.email && <span className="muted">&lt;{sender.email}&gt;</span>}
            </span>
            <Addresses label="to" list={m.recipients} />
            <Addresses label="cc" list={m.cc} />
          </div>
          <time dateTime={m.created_at} title={new Date(m.created_at).toLocaleString()}>
            {fullDate(m.created_at)}
            {ago && <span className="muted"> ({ago})</span>}
          </time>
        </div>
        <EmailBody key={m.id} text={m.body_text} html={m.body_html} />
        {!inTrash && (
          <div className="replybar">
            <button type="button" className="btn" onClick={p.onReply}>
              <Icon name="reply" size={17} />
              Reply
            </button>
            {canReplyAll && (
              <button type="button" className="btn" onClick={p.onReplyAll}>
                <Icon name="replyall" size={17} />
                Reply all
              </button>
            )}
            <button type="button" className="btn" onClick={p.onForward}>
              <Icon name="forward" size={17} />
              Forward
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
