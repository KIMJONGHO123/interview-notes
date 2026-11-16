export type Confidence = 'low' | 'mid' | 'high';
export type Level = 'basic' | 'interview';

export interface Card {
  id: string;
  question: string;
  answer: string;
  followUps: string[];
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

/** 예전 형식(필드 누락) 데이터·JSON 가져오기 보정 */
export function normalizeCard(c: Partial<Card> & { id: string; question: string }): Card {
  return newCard({ ...c, level: c.level ?? 'interview', noteId: c.noteId ?? null });
}
