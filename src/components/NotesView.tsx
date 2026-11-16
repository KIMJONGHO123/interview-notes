import { useMemo, useState } from 'react';
import { CONFIDENCE_RANK, type Card, type Note } from '../types';
import { CardItem } from './CardItem';
import { Markdown } from './Markdown';

interface Props {
  notes: Note[];
  cards: Card[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onEditCard: (card: Card) => void;
  onNewCard: (noteId: string) => void;
  onReview: (noteId: string) => void;
}

export function NotesView(props: Props) {
  const { notes, cards, selectedId } = props;
  const selected = notes.find((n) => n.id === selectedId);
  return selected ? <NoteDetail note={selected} {...props} /> : <NoteList {...props} cards={cards} />;
}

function NoteList({ notes, cards, onSelect, onNew }: Props) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);

  const tags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);
  const stats = useMemo(() => {
    const m = new Map<string, { total: number; weak: number }>();
    for (const c of cards) {
      if (!c.noteId) continue;
      const s = m.get(c.noteId) ?? { total: 0, weak: 0 };
      s.total += 1;
      if (c.confidence === 'low') s.weak += 1;
      m.set(c.noteId, s);
    }
    return m;
  }, [cards]);

  const q = query.trim().toLowerCase();
  const shown = notes.filter(
    (n) => (!tag || n.tags.includes(tag)) && (!q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)),
  );

  return (
    <div className="stack">
      <div className="row">
        <input className="grow" placeholder="개념 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="primary" onClick={onNew}>
          + 새 개념
        </button>
      </div>
      {tags.length > 0 && (
        <div className="chips">
          {tags.map((t) => (
            <button key={t} className={`chip ${tag === t ? 'on' : ''}`} onClick={() => setTag(tag === t ? null : t)}>
              #{t}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 && (
        <div className="empty stack">
          <p>아직 개념 노트가 없어요.</p>
          <p className="small">
            <b>개념 노트</b>로 기초를 먼저 이해하고 → <b>기초 카드</b>로 확인하고 → <b>면접 카드</b>로 말하는 연습을 하세요.
          </p>
          <div>
            <button className="primary" onClick={onNew}>
              첫 개념 만들기
            </button>
          </div>
        </div>
      )}

      <ul className="notes">
        {shown.map((n) => {
          const s = stats.get(n.id);
          return (
            <li key={n.id} className="note-item" onClick={() => onSelect(n.id)}>
              <div className="note-title">{n.title}</div>
              <div className="row small">
                <div className="tags">
                  {n.tags.map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </div>
                <span className="spacer" />
                {s ? (
                  <span className="muted">
                    카드 {s.total}
                    {s.weak > 0 && <span className="weak"> · 약함 {s.weak}</span>}
                  </span>
                ) : (
                  <span className="muted">카드 없음</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NoteDetail({ note, cards, onSelect, onEdit, onDelete, onEditCard, onNewCard, onReview }: Props & { note: Note }) {
  const linked = useMemo(
    () =>
      cards
        .filter((c) => c.noteId === note.id)
        .sort((a, b) => (a.level === b.level ? CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence] : a.level === 'basic' ? -1 : 1)),
    [cards, note.id],
  );
  const basic = linked.filter((c) => c.level === 'basic');
  const interview = linked.filter((c) => c.level === 'interview');

  return (
    <div className="stack">
      <div className="row">
        <button className="link" onClick={() => onSelect(null)}>
          ← 개념 목록
        </button>
        <span className="spacer" />
        <button onClick={() => onEdit(note)}>수정</button>
        <button className="danger" onClick={() => onDelete(note)}>
          삭제
        </button>
      </div>

      <article className="note-article">
        <h2>{note.title}</h2>
        {note.tags.length > 0 && (
          <div className="tags">
            {note.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        )}
        <Markdown text={note.body} />
      </article>

      <section className="stack">
        <div className="row">
          <h3>이 개념의 카드 {linked.length}개</h3>
          <span className="spacer" />
          <button onClick={() => onNewCard(note.id)}>+ 카드</button>
          <button className="primary" onClick={() => onReview(note.id)} disabled={linked.length === 0}>
            이 개념 복습
          </button>
        </div>
        {basic.length > 0 && (
          <>
            <h4>기초 확인 문제</h4>
            <ul className="cards">
              {basic.map((c) => (
                <CardItem key={c.id} card={c} onEdit={onEditCard} />
              ))}
            </ul>
          </>
        )}
        {interview.length > 0 && (
          <>
            <h4>면접 질문</h4>
            <ul className="cards">
              {interview.map((c) => (
                <CardItem key={c.id} card={c} onEdit={onEditCard} />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
