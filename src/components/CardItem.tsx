import { useState } from 'react';
import { CONFIDENCE_LABEL, LEVEL_LABEL, type Card } from '../types';
import { FollowUpList } from './FollowUpList';

interface Props {
  card: Card;
  noteTitle?: string;
  onEdit: (card: Card) => void;
  onOpenNote?: (noteId: string) => void;
}

export function CardItem({ card: c, noteTitle, onEdit, onOpenNote }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <li className="card">
      <div className="card-head" onClick={() => setOpen(!open)}>
        <span className={`badge conf-${c.confidence}`} title="자신감">
          {CONFIDENCE_LABEL[c.confidence]}
        </span>
        <span className="q">
          {c.level === 'basic' && <span className="level">{LEVEL_LABEL.basic}</span>}
          {c.question}
        </span>
        <span className="caret">{open ? '▴' : '▾'}</span>
      </div>
      {open && (
        <div className="card-body">
          {c.answer && <p className="answer">{c.answer}</p>}
          {c.followUps.length > 0 && <FollowUpList items={c.followUps} />}
          {c.project && (
            <div>
              <h4>내 프로젝트</h4>
              <p className="answer">{c.project}</p>
            </div>
          )}
          <div className="row">
            <div className="tags">
              {c.tags.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </div>
            <span className="spacer" />
            {c.noteId && noteTitle && onOpenNote && (
              <button className="link" onClick={() => onOpenNote(c.noteId!)}>
                📖 {noteTitle}
              </button>
            )}
            <button onClick={() => onEdit(c)}>수정</button>
          </div>
        </div>
      )}
    </li>
  );
}
