import { createLocalStore, localKeys } from '../repo/localRepo';
import type { Store } from '../repo/Store';
import { newNote, shortId, type MindMap, type MindNode } from '../types';
import { parseCards, splitNote } from './parse';
import { SAMPLE_CONCEPT } from './samples';

/** 로그인 없이 둘러보기: 예시 자료를 이 브라우저(localStorage)에만 저장 */
const FLAG = 'study-demo';
const NS = 'demo';

export function isDemo() {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

export const createDemoStore = (): Store => createLocalStore(NS, 'demo');

/** 둘러보기 자료와 표시를 모두 지움 */
export function endDemo() {
  try {
    for (const k of [...localKeys(NS), FLAG]) localStorage.removeItem(k);
  } catch {
    /* 저장소를 못 쓰는 브라우저면 지울 것도 없음 */
  }
}

/** 예시 노트·카드·마인드맵을 새로 채우고 둘러보기 시작 */
export async function startDemo() {
  endDemo();
  const store = createDemoStore();
  const tags = ['트랜잭션', 'DB'];
  const { title, body, cardText } = splitNote(SAMPLE_CONCEPT);
  const note = newNote({ title, body, tags });
  const cards = parseCards(cardText, { noteId: note.id }).map((c) => ({ ...c, tags: [...new Set([...c.tags, ...tags])] }));

  const root: MindNode = { id: shortId(), parentId: null, label: '트랜잭션', noteId: note.id };
  const nodes: MindNode[] = [root];
  const branch = (label: string, leaves: string[]) => {
    const b: MindNode = { id: shortId(), parentId: root.id, label };
    nodes.push(b, ...leaves.map((l) => ({ id: shortId(), parentId: b.id, label: l })));
  };
  branch('ACID', ['원자성', '일관성', '격리성', '지속성']);
  branch('격리 수준', ['Read Committed', 'Repeatable Read', 'Serializable']);
  branch('동시성 제어', ['MVCC', '락']);
  branch('장애 복구', ['WAL', 'Redo / Undo']);
  const now = new Date().toISOString();
  const map: MindMap = { id: crypto.randomUUID(), title: '트랜잭션', nodes, createdAt: now, updatedAt: now };

  await store.notes.upsertMany([note]);
  await store.cards.upsertMany(cards);
  await store.mindmaps.upsertMany([map]);
  try {
    localStorage.setItem(FLAG, '1');
  } catch {
    /* 새로고침하면 로그인 화면으로 돌아감 */
  }
}
