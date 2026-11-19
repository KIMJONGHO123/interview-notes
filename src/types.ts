export type Confidence = 'low' | 'mid' | 'high';
/** 개념 카드: basic(기초) · advanced(심화) / 면접 카드: interview */
export type Level = 'basic' | 'advanced' | 'interview';

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
export const LEVEL_LABEL: Record<Level, string> = { basic: '기초', advanced: '심화', interview: '면접' };
export const LEVEL_FULL: Record<Level, string> = { basic: '📘 개념 · 기초', advanced: '📗 개념 · 심화', interview: '🎤 면접' };
export const LEVEL_SHORT: Record<Level, string> = { basic: '📘 기초', advanced: '📗 심화', interview: '🎤 면접' };
export const LEVEL_ORDER: Record<Level, number> = { basic: 0, advanced: 1, interview: 2 };
export const isConcept = (l: Level) => l !== 'interview';

/** 말하기 시간(초) 추정: 공백·기호 제외 글자를 초당 6자로 계산 (면접 답변 속도 기준) */
export const SPEAK_CHARS_PER_SEC = 6;
export const speakSeconds = (text: string) =>
  Math.round(text.replace(/[\s.,!?·()[\]"'`~-]/g, '').length / SPEAK_CHARS_PER_SEC);
/** 면접 답변 권장 시간 */
export const INTERVIEW_TARGET_SEC = 30;
export const formatSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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

// ─────────────────────────────── 마인드맵
export interface MindNode {
  id: string;
  /** null 이면 가운데 핵심 노드 */
  parentId: string | null;
  label: string;
  /** 연결된 개념 노트 */
  noteId?: string | null;
  /** 하위 가지 접기 */
  collapsed?: boolean;
}

export interface MindMap {
  id: string;
  /** 핵심 노드의 이름과 같음 */
  title: string;
  nodes: MindNode[];
  createdAt: string;
  updatedAt: string;
}

/** 노드용 짧은 id (용량 절약) */
export function shortId() {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('');
}

export function newMindMap(title: string): MindMap {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    title,
    nodes: [{ id: shortId(), parentId: null, label: title }],
    createdAt: now,
    updatedAt: now,
  };
}

/** 핵심 노드가 없거나 형식이 깨진 데이터 보정 */
export function normalizeMindMap(m: MindMap): MindMap {
  const nodes = Array.isArray(m.nodes) ? m.nodes.filter((n) => n && typeof n.id === 'string') : [];
  if (!nodes.some((n) => n.parentId === null)) nodes.unshift({ id: shortId(), parentId: null, label: m.title || '핵심 단어' });
  return { ...m, nodes };
}
