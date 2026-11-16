import { useMemo, useRef, useState } from 'react';
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
  chainFollowUps: boolean;
}

/** 출제 단위: 본 질문(fu = null) 또는 그 카드의 fu번째 꼬리질문 */
interface Item {
  cardId: string;
  fu: number | null;
}

/** 기초 → 면접, 자신감 낮은 카드 → 오래 복습 안 한 카드 순. 꼬리질문은 본 질문 바로 뒤에 */
function buildQueue(cards: Card[], f: Filter): Item[] {
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
    .flatMap((c) => [
      { cardId: c.id, fu: null },
      ...(f.chainFollowUps ? c.followUps.map((_, i) => ({ cardId: c.id, fu: i })) : []),
    ]);
}

export function Review({ cards, notes, initialNoteId, onRate, onOpenNote }: Props) {
  const [filter, setFilter] = useState<Filter>({
    tag: null,
    level: null,
    noteId: initialNoteId,
    onlyWeak: false,
    chainFollowUps: true,
  });
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [done, setDone] = useState<Record<Confidence, number>>({ low: 0, mid: 0, high: 0 });
  /** 이번 세션에서 카드별 가장 낮은 평가 (꼬리질문에서 막히면 카드 자신감도 내려감) */
  const sessionMin = useRef(new Map<string, Confidence>());

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
    sessionMin.current = new Map();
  }

  if (!queue) {
    const q = buildQueue(cards, filter);
    const mainCount = q.filter((i) => i.fu === null).length;
    const fuCount = q.length - mainCount;
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
          <input type="checkbox" checked={filter.chainFollowUps} onChange={(e) => set({ chainFollowUps: e.target.checked })} />
          꼬리질문 이어서 출제 <span className="muted small">(실제 면접처럼 본 질문 뒤에 이어서 나옴)</span>
        </label>
        <label className="row">
          <input type="checkbox" checked={filter.onlyWeak} onChange={(e) => set({ onlyWeak: e.target.checked })} />
          자신감 '상' 카드는 빼기
        </label>
        <button className="primary big" onClick={start} disabled={mainCount === 0}>
          복습 시작 (질문 {mainCount}개{fuCount > 0 ? ` + 꼬리 ${fuCount}개` : ''})
        </button>
      </div>
    );
  }

  const item = queue[idx];
  const card = item ? byId.get(item.cardId) : undefined;
  const followUp = card && item.fu !== null ? card.followUps[item.fu] : undefined;

  if (!item || !card || (item.fu !== null && !followUp)) {
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
  const isFollowUp = item.fu !== null;

  function rate(c: Confidence) {
    const prev = sessionMin.current.get(card!.id);
    if (!prev || CONFIDENCE_RANK[c] < CONFIDENCE_RANK[prev]) {
      sessionMin.current.set(card!.id, c);
      onRate(card!, c);
    }
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
          {isFollowUp && (
            <span className="fu-badge">
              ↳ 꼬리질문 {item.fu! + 1}/{card.followUps.length}
            </span>
          )}
          <div className="tags">
            {card.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        </div>

        {isFollowUp && <div className="review-parent">{card.question}</div>}
        <h2 className="review-q">{isFollowUp ? followUp!.q : card.question}</h2>

        {!revealed ? (
          <button className="primary big" onClick={() => setRevealed(true)}>
            답 보기
          </button>
        ) : (
          <div className="stack">
            {isFollowUp ? (
              <p className="answer">{followUp!.a || <span className="muted">(아직 답이 없어요. 카드 탭에서 추가해 보세요)</span>}</p>
            ) : (
              <>
                <p className="answer">{card.answer || <span className="muted">(아직 답변이 없어요)</span>}</p>
                {card.project && (
                  <div>
                    <h4>내 프로젝트</h4>
                    <p className="answer">{card.project}</p>
                  </div>
                )}
              </>
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
