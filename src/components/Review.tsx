import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_RANK,
  INTERVIEW_TARGET_SEC,
  LEVEL_FULL,
  LEVEL_ORDER,
  formatSec,
  isConcept,
  speakSeconds,
  type Card,
  type Confidence,
  type Level,
  type Note,
} from '../types';
import { FollowUpList } from './FollowUpList';
import { Markdown } from './Markdown';

/** 개념 복습: 기초 → 심화로 깊게 / 면접 연습: 30초 답변 + 꼬리질문 + 타이머 */
export type ReviewMode = 'concept' | 'interview';

/** 꼬리질문 답변 권장 시간 */
const FOLLOW_UP_TARGET_SEC = 20;

interface Props {
  cards: Card[];
  notes: Note[];
  initialNoteId: string | null;
  initialMode: ReviewMode | null;
  onRate: (card: Card, confidence: Confidence) => void;
  onOpenNote: (noteId: string) => void;
}

interface Filter {
  mode: ReviewMode;
  /** 개념 복습에서만: 기초만 / 심화만 */
  level: Level | null;
  tag: string | null;
  noteId: string | null;
  onlyWeak: boolean;
  chainFollowUps: boolean;
  timer: boolean;
}

/** 출제 단위: 본 질문(fu = null) 또는 그 카드의 fu번째 꼬리질문 */
interface Item {
  cardId: string;
  fu: number | null;
}

function buildQueue(cards: Card[], f: Filter): Item[] {
  return cards
    .filter(
      (c) =>
        (f.mode === 'interview' ? c.level === 'interview' : isConcept(c.level)) &&
        (!f.level || c.level === f.level) &&
        (!f.tag || c.tags.includes(f.tag)) &&
        (!f.noteId || c.noteId === f.noteId) &&
        (!f.onlyWeak || c.confidence !== 'high'),
    )
    .sort(
      (a, b) =>
        LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
        CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence] ||
        (a.lastReviewedAt ?? '').localeCompare(b.lastReviewedAt ?? ''),
    )
    .flatMap((c) => [
      { cardId: c.id, fu: null },
      ...(f.mode === 'interview' && f.chainFollowUps ? c.followUps.map((_, i) => ({ cardId: c.id, fu: i })) : []),
    ]);
}

export function Review({ cards, notes, initialNoteId, initialMode, onRate, onOpenNote }: Props) {
  const [filter, setFilter] = useState<Filter>({
    mode: initialMode ?? 'concept',
    level: null,
    tag: null,
    noteId: initialNoteId,
    onlyWeak: false,
    chainFollowUps: true,
    timer: true,
  });
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [done, setDone] = useState<Record<Confidence, number>>({ low: 0, mid: 0, high: 0 });
  /** 이번 세션에서 카드별 가장 낮은 평가 (꼬리질문에서 막히면 카드 자신감도 내려감) */
  const sessionMin = useRef(new Map<string, Confidence>());

  // 타이머: 질문이 나온 순간부터 "답 보기"를 누를 때까지
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [spent, setSpent] = useState<number | null>(null);
  const times = useRef<number[]>([]);

  const tags = useMemo(() => [...new Set(cards.flatMap((c) => c.tags))].sort(), [cards]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const noteById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const set = (patch: Partial<Filter>) => setFilter((f) => ({ ...f, ...patch }));
  const interviewMode = filter.mode === 'interview';
  const timing = interviewMode && filter.timer && queue !== null && !revealed;

  useEffect(() => {
    if (!timing) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [timing]);

  const startItem = () => {
    const t = Date.now();
    setStartedAt(t);
    setNow(t);
    setSpent(null);
    setRevealed(false);
    setShowNote(false);
  };

  function start() {
    setQueue(buildQueue(cards, filter));
    setIdx(0);
    setDone({ low: 0, mid: 0, high: 0 });
    sessionMin.current = new Map();
    times.current = [];
    startItem();
  }

  // ───────────── 시작 화면
  if (!queue) {
    const q = buildQueue(cards, filter);
    const mainCount = q.filter((i) => i.fu === null).length;
    const fuCount = q.length - mainCount;
    const note = filter.noteId ? noteById.get(filter.noteId) : null;
    const conceptTotal = cards.filter((c) => isConcept(c.level)).length;
    const interviewTotal = cards.filter((c) => c.level === 'interview').length;
    return (
      <div className="stack review-setup">
        <div className="mode-pick">
          <button className={!interviewMode ? 'on' : ''} onClick={() => set({ mode: 'concept', level: null })}>
            <b>📘 개념 복습</b>
            <span className="muted small">기초 → 심화 순서로 깊게 이해했는지 확인 · {conceptTotal}개</span>
          </button>
          <button className={interviewMode ? 'on' : ''} onClick={() => set({ mode: 'interview', level: null })}>
            <b>🎤 면접 연습</b>
            <span className="muted small">30초 안에 말하고, 꼬리질문까지 이어서 · {interviewTotal}개</span>
          </button>
        </div>

        {note && (
          <div className="row notice">
            <span>📖 개념: {note.title}</span>
            <span className="spacer" />
            <button className="link" onClick={() => set({ noteId: null })}>
              해제
            </button>
          </div>
        )}

        {!interviewMode && (
          <div className="chips">
            {([null, 'basic', 'advanced'] as (Level | null)[]).map((l) => (
              <button key={l ?? 'all'} className={`chip ${filter.level === l ? 'on' : ''}`} onClick={() => set({ level: l })}>
                {l === null ? '기초 + 심화' : l === 'basic' ? '기초만' : '심화만'}
              </button>
            ))}
          </div>
        )}

        {tags.length > 0 && (
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
        )}

        {interviewMode && (
          <>
            <label className="row">
              <input type="checkbox" checked={filter.timer} onChange={(e) => set({ timer: e.target.checked })} />
              ⏱ 타이머 <span className="muted small">(질문 {INTERVIEW_TARGET_SEC}초 · 꼬리질문 {FOLLOW_UP_TARGET_SEC}초 권장)</span>
            </label>
            <label className="row">
              <input type="checkbox" checked={filter.chainFollowUps} onChange={(e) => set({ chainFollowUps: e.target.checked })} />
              꼬리질문 이어서 출제
            </label>
          </>
        )}
        <label className="row">
          <input type="checkbox" checked={filter.onlyWeak} onChange={(e) => set({ onlyWeak: e.target.checked })} />
          자신감 '상' 카드는 빼기
        </label>

        <p className="muted small">
          {interviewMode
            ? '실제 면접처럼 소리 내어 답한 뒤 답을 펼쳐 비교해 보세요.'
            : '질문을 보고 떠올린 뒤 답을 펼쳐 확인하세요. 기초부터, 자신감 낮은 카드부터 나와요.'}
        </p>
        <button className="primary big" onClick={start} disabled={mainCount === 0}>
          {interviewMode ? '🎤 면접 연습' : '📘 개념 복습'} 시작 ({mainCount}개{fuCount > 0 ? ` + 꼬리 ${fuCount}개` : ''})
        </button>
      </div>
    );
  }

  const item = queue[idx];
  const card = item ? byId.get(item.cardId) : undefined;
  const followUp = card && item.fu !== null ? card.followUps[item.fu] : undefined;

  // ───────────── 끝
  if (!item || !card || (item.fu !== null && !followUp)) {
    const avg = times.current.length ? Math.round(times.current.reduce((s, t) => s + t, 0) / times.current.length) : null;
    return (
      <div className="stack review-setup">
        <h2>{interviewMode ? '면접 연습 끝!' : '복습 끝!'}</h2>
        <p>
          상 {done.high} · 중 {done.mid} · 하 {done.low}
        </p>
        {avg !== null && (
          <p className="muted">
            ⏱ 평균 답변 시간 {formatSec(avg)} (질문 {times.current.length}개)
          </p>
        )}
        <button className="primary big" onClick={() => setQueue(null)}>
          처음으로
        </button>
      </div>
    );
  }

  const note = card.noteId ? noteById.get(card.noteId) : undefined;
  const isFollowUp = item.fu !== null;
  const target = isFollowUp ? FOLLOW_UP_TARGET_SEC : INTERVIEW_TARGET_SEC;
  const elapsed = spent ?? Math.max(0, Math.floor((now - startedAt) / 1000));
  const timerState = elapsed > target * 1.5 ? 'over' : elapsed > target ? 'warn' : 'ok';
  const showTimer = interviewMode && filter.timer;

  function reveal() {
    if (showTimer) {
      const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setSpent(s);
      times.current.push(s);
    }
    setRevealed(true);
  }

  function rate(c: Confidence) {
    const prev = sessionMin.current.get(card!.id);
    if (!prev || CONFIDENCE_RANK[c] < CONFIDENCE_RANK[prev]) {
      sessionMin.current.set(card!.id, c);
      onRate(card!, c);
    }
    setDone((d) => ({ ...d, [c]: d[c] + 1 }));
    setIdx((i) => i + 1);
    startItem();
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
          <span className={`level ${card.level}`}>{LEVEL_FULL[card.level]}</span>
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

        {showTimer && (
          <div className={`timer ${timerState}`}>
            <span className="timer-num">⏱ {formatSec(elapsed)}</span>
            <div className="timer-bar">
              <div style={{ width: `${Math.min(100, (elapsed / (target * 1.5)) * 100)}%` }} />
              <i style={{ left: '66.7%' }} title={`${target}초`} />
            </div>
            <span className="muted small">목표 {formatSec(target)}</span>
          </div>
        )}

        {!revealed ? (
          <button className="primary big" onClick={reveal}>
            {showTimer ? '다 말했어요 · 답 보기' : '답 보기'}
          </button>
        ) : (
          <div className="stack">
            {showTimer && spent !== null && (
              <p className={`small timer-result ${timerState}`}>
                {timerState === 'ok'
                  ? `👍 ${formatSec(spent)} - 시간 안에 답했어요.`
                  : timerState === 'warn'
                    ? `⚠️ ${formatSec(spent)} - 조금 길어요. 결론부터 말해 보세요.`
                    : `⏰ ${formatSec(spent)} - 너무 길어요. 핵심 한두 문장만 남겨 보세요.`}
              </p>
            )}

            {isFollowUp ? (
              <p className="answer">{followUp!.a || <span className="muted">(아직 답이 없어요. 카드 탭에서 추가해 보세요)</span>}</p>
            ) : (
              <>
                <p className="answer">{card.answer || <span className="muted">(아직 답변이 없어요)</span>}</p>
                {interviewMode && card.answer && (
                  <p className="muted small">🗣 모범 답변 예상 시간 약 {formatSec(speakSeconds(card.answer))}</p>
                )}
                {!interviewMode && card.followUps.length > 0 && <FollowUpList items={card.followUps} />}
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
