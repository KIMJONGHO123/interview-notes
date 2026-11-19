import { useMemo, useState } from 'react';
import { CONFIDENCE_LABEL, isConcept, type Card, type Confidence, type Level, type Note } from '../types';
import { CardItem } from './CardItem';

/** 카드 종류 필터: 개념 전체 / 기초 / 심화 / 면접 */
type KindFilter = 'concept' | Level;
const KIND_CHIPS: [KindFilter, string][] = [
  ['concept', '📘 개념 전체'],
  ['basic', '기초'],
  ['advanced', '심화'],
  ['interview', '🎤 면접'],
];
const matchKind = (f: KindFilter | null, l: Level) => !f || (f === 'concept' ? isConcept(l) : f === l);

interface Props {
  cards: Card[];
  notes: Note[];
  onEdit: (card: Card) => void;
  onNew: () => void;
  onOpenNote: (noteId: string) => void;
}

export function CardList({ cards, notes, onEdit, onNew, onOpenNote }: Props) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [conf, setConf] = useState<Confidence | null>(null);
  const [level, setLevel] = useState<KindFilter | null>(null);

  const noteTitle = useMemo(() => new Map(notes.map((n) => [n.id, n.title])), [notes]);

  const allTags = useMemo(() => {
    const count = new Map<string, number>();
    cards.forEach((c) => c.tags.forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter(
      (c) =>
        (!tag || c.tags.includes(tag)) &&
        (!conf || c.confidence === conf) &&
        matchKind(level, c.level) &&
        (!q || [c.question, c.answer, c.project, ...c.followUps.flatMap((f) => [f.q, f.a])].some((s) => s.toLowerCase().includes(q))),
    );
  }, [cards, query, tag, conf, level]);

  return (
    <div className="stack">
      <div className="row">
        <input className="grow" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="primary" onClick={onNew}>
          + 새 카드
        </button>
      </div>

      <div className="chips">
        {KIND_CHIPS.map(([k, label]) => (
          <button key={k} className={`chip ${level === k ? 'on' : ''}`} onClick={() => setLevel(level === k ? null : k)}>
            {label}
          </button>
        ))}
        <span className="divider" />
        {(['low', 'mid', 'high'] as Confidence[]).map((c) => (
          <button key={c} className={`chip conf-${c} ${conf === c ? 'on' : ''}`} onClick={() => setConf(conf === c ? null : c)}>
            자신감 {CONFIDENCE_LABEL[c]}
          </button>
        ))}
        <span className="divider" />
        {allTags.map(([t, n]) => (
          <button key={t} className={`chip ${tag === t ? 'on' : ''}`} onClick={() => setTag(tag === t ? null : t)}>
            #{t} <span className="muted">{n}</span>
          </button>
        ))}
      </div>

      <p className="muted small">
        {shown.length} / {cards.length}개
      </p>

      {shown.length === 0 && <p className="empty">카드가 없어요. "개념" 탭에서 노트를 만들거나 "가져오기"로 붙여넣어 보세요.</p>}

      <ul className="cards">
        {shown.map((c) => (
          <CardItem
            key={c.id}
            card={c}
            noteTitle={c.noteId ? noteTitle.get(c.noteId) : undefined}
            onEdit={onEdit}
            onOpenNote={onOpenNote}
          />
        ))}
      </ul>
    </div>
  );
}
