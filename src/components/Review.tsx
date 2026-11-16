import { useMemo, useState } from 'react';
import { CONFIDENCE_LABEL, CONFIDENCE_RANK, LEVEL_LABEL, type Card, type Confidence, type Level, type Note } from '../types';
import { Markdown } from './Markdown';

interface Props {
  cards: Card[];
  notes: Note[];
  initialNoteId: string | null;
  onRate: (card: Card, confidence: Confidence) => void;
  onOpenNote: (noteId: string) => void;
}

interface Filter {
  tag: string | null;
  level: Level | null;
  noteId: string | null;
  onlyWeak: boolean;
}

/** 기초 → 면접, 자신감 낮은 카드 → 오래 복습 안 한 카드 순 */
function buildQueue(cards: Card[], f: Filter) {
  return cards
    .filter(
      (c) =>
        (!f.tag || c.tags.includes(f.tag)) &&
        (!f.level || c.level === f.level) &&
        (!f.noteId || c.noteId === f.noteId) &&
        (!f.onlyWeak || c.confidence !== 'high'),
    )
    .sort(
      (a, b) =>
        (a.level === b.level ? 0 : a.level === 'basic' ? -1 : 1) ||
        CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence] ||
        (a.lastReviewedAt ?? '').localeCompare(b.lastReviewedAt ?? ''),
    )
    .map((c) => c.id);
}

export function Review({ cards, notes, initialNoteId, onRate, onOpenNote }: Props) {
  const [filter, setFilter] = useState<Filter>({ tag: null, level: null, noteId: initialNoteId, onlyWeak: false });
  const [queue, setQueue] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [done, setDone] = useState<Record<Confidence, number>>({ low: 0, mid: 0, high: 0 });

  const tags = useMemo(() => [...new Set(cards.flatMap((c) => c.tags))].sort(), [cards]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const noteById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const set = (patch: Partial<Filter>) => setFilter((f) => ({ ...f, ...patch }));

  function start() {
    setQueue(buildQueue(cards, filter));
    setIdx(0);
    setRevealed(false);
    setShowNote(false);
    setDone({ low: 0, mid: 0, high: 0 });
  }

  if (!queue) {
    const count = buildQueue(cards, filter).length;
    const note = filter.noteId ? noteById.get(filter.noteId) : null;
    return (
      <div className="stack review-setup">
        <p>
          질문만 보고 <b>소리 내어 답한 뒤</b> 답을 펼쳐 비교해 보세요. 기초 → 면접, 자신감 낮은 카드부터 나옵니다.
        </p>
        {note && (
          <div className="row notice">
            <span>📖 개념: {note.title}</span>
            <span className="spacer" />
            <button className="link" onClick={() => set({ noteId: null })}>
              해제
            </button>
          </div>
        )}
        <div className="chips">
          <button className={`chip ${filter.level === null ? 'on' : ''}`} onClick={() => set({ level: null })}>
            전체 난이도
          </button>
          {(['basic', 'interview'] as Level[]).map((l) => (
            <button key={l} className={`chip ${filter.level === l ? 'on' : ''}`} onClick={() => set({ level: l })}>
              {LEVEL_LABEL[l]}만
            </button>
          ))}
        </div>
        <div className="chips">
          <button className={`chip ${filter.tag === null ? 'on' : ''}`} onClick={() => set({ tag: null })}>
            전체 태그
          </button>
          {tags.map((t) => (
            <button key={t} className={`chip ${filter.tag === t ? 'on' : ''}`} onClick={() => set({ tag: t })}>
              #{t}
            </button>
          ))}
        </div>
        <label className="row">
          <input type="checkbox" checked={filter.onlyWeak} onChange={(e) => set({ onlyWeak: e.target.checked })} />
          자신감 '상' 카드는 빼기
        </label>
        <button className="primary big" onClick={start} disabled={count === 0}>
          복습 시작 ({count}개)
        </button>
      </div>
    );
  }

  const card = byId.get(queue[idx] ?? '');

  if (!card) {
    return (
      <div className="stack review-setup">
        <h2>복습 끝!</h2>
        <p>
          상 {done.high} · 중 {done.mid} · 하 {done.low}
        </p>
        <button className="primary big" onClick={() => setQueue(null)}>
          처음으로
        </button>
      </div>
    );
  }

  const note = card.noteId ? noteById.get(card.noteId) : undefined;

  function rate(c: Confidence) {
    onRate(card!, c);
    setDone((d) => ({ ...d, [c]: d[c] + 1 }));
    setRevealed(false);
    setShowNote(false);
    setIdx((i) => i + 1);
  }

  return (
    <div className="stack">
      <div className="row">
        <span className="muted small">
          {idx + 1} / {queue.length}
        </span>
        <span className="spacer" />
        <button className="link" onClick={() => setQueue(null)}>
          그만하기
        </button>
      </div>
      <div className="progress">
        <div style={{ width: `${(idx / queue.length) * 100}%` }} />
      </div>

      <div className="review-card">
        <div className="row small">
          <span className={`level ${card.level}`}>{LEVEL_LABEL[card.level]}</span>
          <div className="tags">
            {card.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        </div>
        <h2 className="review-q">{card.question}</h2>

        {!revealed ? (
          <button className="primary big" onClick={() => setRevealed(true)}>
            답 보기
          </button>
        ) : (
          <div className="stack">
            <p className="answer">{card.answer || <span className="muted">(아직 답변이 없어요)</span>}</p>
            {card.followUps.length > 0 && (
              <details>
                <summary>꼬리질문 {card.followUps.length}개</summary>
                <ul className="follow">
                  {card.followUps.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </details>
            )}
            {card.project && (
              <div>
                <h4>내 프로젝트</h4>
                <p className="answer">{card.project}</p>
              </div>
            )}
            {note && (
              <div>
                <div className="row">
                  <button className="link" onClick={() => setShowNote(!showNote)}>
                    📖 개념 다시 보기: {note.title} {showNote ? '▴' : '▾'}
                  </button>
                  <span className="spacer" />
                  <button className="link small" onClick={() => onOpenNote(note.id)}>
                    노트로 이동
                  </button>
                </div>
                {showNote && (
                  <div className="preview-box">
                    <Markdown text={note.body} />
                  </div>
                )}
              </div>
            )}
            <p className="muted small">얼마나 잘 답했나요?</p>
            <div className="rate">
              {(['low', 'mid', 'high'] as Confidence[]).map((c) => (
                <button key={c} className={`conf-${c}`} onClick={() => rate(c)}>
                  {CONFIDENCE_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
