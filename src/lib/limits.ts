import type { Card, Note } from '../types';

/**
 * 사용자당 저장 한도. DB(supabase/schema.sql 의 storage_limit_bytes)와 같은 값이어야 함.
 * 2.8MB = 2.8 * 1024 * 1024
 */
export const STORAGE_LIMIT_BYTES = 2_936_012;

/** 한 번에 붙여넣어 추가할 수 있는 카드 수 */
export const MAX_IMPORT_CARDS = 200;

/** DB check 제약과 같은 값 (글자 수) */
export const LIMITS = {
  noteTitle: 200,
  noteBody: 50_000,
  cardQuestion: 1_000,
  cardAnswer: 5_000,
  cardProject: 3_000,
  followUps: 10,
  tags: 10,
};

const enc = new TextEncoder();
const bytes = (s: string) => enc.encode(s).length;

/** DB의 note_bytes / card_bytes 와 같은 방식으로 계산 (로컬 모드용) */
export const noteBytes = (n: Note) => bytes(n.title) + bytes(n.body) + bytes(n.tags.join(','));
export const cardBytes = (c: Card) =>
  bytes(c.question) + bytes(c.answer) + bytes(c.project) + bytes(JSON.stringify(c.followUps)) + bytes(c.tags.join(','));

export function formatMB(b: number) {
  return `${(b / 1024 / 1024).toFixed(b < 100 * 1024 ? 2 : 1)}MB`;
}

/** Supabase/DB 오류를 사용자에게 보여줄 문장으로 */
export function friendlyError(e: unknown): string {
  const err = e as { message?: string; code?: string; details?: string };
  const msg = err?.message ?? String(e);
  if (msg.includes('STORAGE_LIMIT'))
    return `저장 공간 한도(${formatMB(STORAGE_LIMIT_BYTES)})를 넘어서 저장하지 못했어요. 필요 없는 노트나 카드를 정리한 뒤 다시 시도해 주세요.`;
  if (err?.code === '23514' || msg.includes('violates check constraint')) {
    if (msg.includes('body_len')) return `노트 본문은 ${LIMITS.noteBody.toLocaleString()}자까지 저장할 수 있어요.`;
    if (msg.includes('title_len')) return `노트 제목은 ${LIMITS.noteTitle}자까지 저장할 수 있어요.`;
    if (msg.includes('question_len')) return `질문은 ${LIMITS.cardQuestion.toLocaleString()}자까지 저장할 수 있어요.`;
    if (msg.includes('answer_len')) return `답변은 ${LIMITS.cardAnswer.toLocaleString()}자까지 저장할 수 있어요.`;
    if (msg.includes('project_len')) return `"내 프로젝트" 칸은 ${LIMITS.cardProject.toLocaleString()}자까지 저장할 수 있어요.`;
    if (msg.includes('follow_ups_len')) return `꼬리질문은 카드당 ${LIMITS.followUps}개까지 저장할 수 있어요.`;
    if (msg.includes('tags_len')) return `태그는 ${LIMITS.tags}개까지 붙일 수 있어요.`;
    return '입력한 내용이 너무 길어서 저장하지 못했어요.';
  }
  if (msg.includes('Failed to fetch')) return '네트워크 연결을 확인해 주세요.';
  return msg;
}
