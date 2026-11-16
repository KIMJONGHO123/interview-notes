export type Confidence = 'low' | 'mid' | 'high';
export type Level = 'basic' | 'interview';

export interface FollowUp {
  q: string;
  a: string;
}

export interface Card {
  id: string;
  question: string;
  answer: string;
  followUps: FollowUp[];
  project: string;
  tags: string[];
  confidence: Confidence;
  /** 기초 = 개념 확인 문제, 면접 = 실제 면접 질문 */
  level: Level;
  /** 연결된 개념 노트 */
  noteId: string | null;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
}

export interface Note {
  id: string;
  title: string;
  /** 마크다운 */
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = { low: '하', mid: '중', high: '상' };
export const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, mid: 1, high: 2 };
export const LEVEL_LABEL: Record<Level, string> = { basic: '기초', interview: '면접' };

const nowIso = () => new Date().toISOString();

export function newCard(partial: Partial<Card> = {}): Card {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    question: '',
    answer: '',
    followUps: [],
    project: '',
    tags: [],
    confidence: 'mid',
    level: 'interview',
    noteId: null,
    createdAt: now,
    updatedAt: now,
    lastReviewedAt: null,
    ...partial,
  };
}

export function newNote(partial: Partial<Note> = {}): Note {
  const now = nowIso();
  return { id: crypto.randomUUID(), title: '', body: '', tags: [], createdAt: now, updatedAt: now, ...partial };
}

/**
 * "질문? (답)" → { q, a }
 * 끝에 있는 괄호 묶음(중첩 괄호 허용)을 답으로 분리. 괄호가 없으면 답은 빈 문자열.
 */
export function splitFollowUp(text: string): FollowUp {
  const s = text.trim();
  if (!/[)）]$/.test(s)) return { q: s, a: '' };
  let depth = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i];
    if (ch === ')' || ch === '）') depth++;
    else if (ch === '(' || ch === '（') {
      depth--;
      if (depth === 0) {
        const q = s.slice(0, i).trim();
        // 질문 부분이 비면(전체가 괄호) 분리하지 않음
        return q ? { q, a: s.slice(i + 1, -1).trim() } : { q: s, a: '' };
      }
    }
  }
  return { q: s, a: '' };
}

/** 예전 문자열 꼬리질문 / 새 객체 꼬리질문 모두 허용 */
export function normalizeFollowUps(raw: unknown): FollowUp[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f): FollowUp | null => {
      if (typeof f === 'string') return splitFollowUp(f);
      if (f && typeof f === 'object' && typeof (f as FollowUp).q === 'string')
        return { q: (f as FollowUp).q, a: typeof (f as FollowUp).a === 'string' ? (f as FollowUp).a : '' };
      return null;
    })
    .filter((f): f is FollowUp => !!f && !!f.q);
}

/** 예전 형식(필드 누락·문자열 꼬리질문) 데이터·JSON 가져오기 보정 */
export function normalizeCard(c: Partial<Card> & { id: string; question: string }): Card {
  return newCard({
    ...c,
    followUps: normalizeFollowUps(c.followUps),
    level: c.level ?? 'interview',
    noteId: c.noteId ?? null,
  });
}
