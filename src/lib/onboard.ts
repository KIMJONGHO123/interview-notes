import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Store } from '../repo/Store';
import { createDemoStore, endDemo } from './demo';
import { buildStarter } from './starter';
import { track } from './track';

/** 관리자 계정: 기본 문제 세트를 넣지 않음 */
const ADMIN_USER_IDS = new Set(['6a20eee7-2ee0-413a-8543-930f013131db']);

/** user_metadata 에 남기는 표시 (한 번만 기본 세트를 넣으려고) */
const FLAG = 'onboarded_v1';

export interface OnboardResult {
  movedNotes: number;
  movedCards: number;
  starterNotes: number;
  starterCards: number;
}

const running = new Map<string, Promise<OnboardResult | null>>();

/**
 * 로그인 직후 한 번 실행.
 * 1) 둘러보기에서 쓰던 자료가 있으면 계정으로 옮김 (같은 제목의 개념·마인드맵은 건너뜀)
 * 2) 처음 들어온 빈 계정이면 기본 CS 면접 문제 세트를 넣음 (관리자 제외)
 */
export function onboard(db: SupabaseClient, store: Store, user: User): Promise<OnboardResult | null> {
  let p = running.get(user.id);
  if (!p) {
    p = run(db, store, user);
    running.set(user.id, p);
  }
  return p;
}

async function run(db: SupabaseClient, store: Store, user: User): Promise<OnboardResult | null> {
  const demo = createDemoStore();
  const [demoNotes, demoCards, demoMaps] = await Promise.all([demo.notes.list(), demo.cards.list(), demo.mindmaps.list()]);
  const hasDemo = demoNotes.length + demoCards.length + demoMaps.length > 0;
  const firstTime = !user.user_metadata?.[FLAG];
  if (!hasDemo && !firstTime) return null;

  const [notes, cards, maps] = await Promise.all([store.notes.list(), store.cards.list(), store.mindmaps.list()]);
  const wasEmpty = notes.length === 0 && cards.length === 0;
  const titles = new Set(notes.map((n) => n.title));
  const result: OnboardResult = { movedNotes: 0, movedCards: 0, starterNotes: 0, starterCards: 0 };

  // 1) 둘러보기 자료 옮기기 (노트를 먼저 저장해야 카드의 note_id 가 유효)
  if (hasDemo) {
    const moveNotes = demoNotes.filter((n) => !titles.has(n.title));
    const kept = new Set(moveNotes.map((n) => n.id));
    const moveCards = demoCards.filter((c) => !c.noteId || kept.has(c.noteId));
    const mapTitles = new Set(maps.map((m) => m.title));
    const moveMaps = demoMaps
      .filter((m) => !mapTitles.has(m.title))
      .map((m) => ({ ...m, nodes: m.nodes.map((n) => (n.noteId && !kept.has(n.noteId) ? { ...n, noteId: null } : n)) }));
    if (moveNotes.length) await store.notes.upsertMany(moveNotes);
    if (moveCards.length) await store.cards.upsertMany(moveCards);
    if (moveMaps.length) await store.mindmaps.upsertMany(moveMaps);
    moveNotes.forEach((n) => titles.add(n.title));
    result.movedNotes = moveNotes.length;
    result.movedCards = moveCards.length;
  }

  // 2) 기본 문제 세트
  if (firstTime && wasEmpty && !ADMIN_USER_IDS.has(user.id)) {
    const starter = buildStarter(titles);
    await store.notes.upsertMany(starter.notes);
    await store.cards.upsertMany(starter.cards);
    result.starterNotes = starter.notes.length;
    result.starterCards = starter.cards.length;
  }

  if (firstTime) await db.auth.updateUser({ data: { [FLAG]: true } }).catch(() => {});
  if (result.starterNotes || result.movedNotes || result.movedCards)
    track('onboarded', `${hasDemo ? 'demo' : 'new'}:${user.app_metadata?.provider ?? ''}`);
  if (hasDemo) endDemo();
  return result;
}
