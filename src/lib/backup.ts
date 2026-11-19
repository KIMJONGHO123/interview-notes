import { normalizeCard, normalizeMindMap, type Card, type MindMap, type Note } from '../types';

export interface Backup {
  notes: Note[];
  cards: Card[];
  mindmaps: MindMap[];
}

/** 백업 파일 다운로드 (v3: 노트·카드·마인드맵) */
export function downloadBackup({ notes, cards, mindmaps }: Backup, prefix = 'interview-notes') {
  const data = { version: 3, exportedAt: new Date().toISOString(), notes, cards, mindmaps };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object';

/** v1: 카드 배열 / v2: { notes, cards } / v3: { notes, cards, mindmaps } */
export function parseBackup(text: string): Backup {
  const data: unknown = JSON.parse(text);
  const pick = (key: string): unknown[] => {
    if (Array.isArray(data)) return key === 'cards' ? data : [];
    const v = isObj(data) ? data[key] : undefined;
    return Array.isArray(v) ? v : [];
  };
  const notes = pick('notes')
    .filter((n): n is Note => isObj(n) && typeof n.id === 'string' && typeof n.title === 'string')
    .map((n) => ({ ...n, body: typeof n.body === 'string' ? n.body : '', tags: Array.isArray(n.tags) ? n.tags : [] }));
  const cards = pick('cards')
    .filter((c): c is Card => isObj(c) && typeof c.id === 'string' && typeof c.question === 'string')
    .map(normalizeCard);
  const mindmaps = pick('mindmaps')
    .filter((m): m is MindMap => isObj(m) && typeof m.id === 'string' && typeof m.title === 'string')
    .map(normalizeMindMap);
  return { notes, cards, mindmaps };
}

/**
 * 가져오기 전 id 정리.
 * - 내 자료에 이미 있는 id → 그대로 (덮어쓰기 = 내 백업 복원)
 * - 없는 id → 새 id (다른 사람이 공유한 파일도 내 자료로 추가됨)
 * 노트 id가 바뀌면 카드·마인드맵 노드의 노트 연결도 같이 바꾸고, 어디에도 없는 노트 연결은 끊음.
 */
export function prepareImport(backup: Backup, mine: Backup): Backup {
  const myNotes = new Set(mine.notes.map((n) => n.id));
  const myCards = new Set(mine.cards.map((c) => c.id));
  const myMaps = new Set(mine.mindmaps.map((m) => m.id));
  const now = new Date().toISOString();

  const noteIdMap = new Map<string, string>();
  const notes = backup.notes.map((n) => {
    const id = myNotes.has(n.id) ? n.id : crypto.randomUUID();
    noteIdMap.set(n.id, id);
    return { ...n, id, updatedAt: now };
  });
  const linkNote = (noteId: string | null | undefined) =>
    !noteId ? null : (noteIdMap.get(noteId) ?? (myNotes.has(noteId) ? noteId : null));

  const cards = backup.cards.map((c) => ({
    ...c,
    id: myCards.has(c.id) ? c.id : crypto.randomUUID(),
    noteId: linkNote(c.noteId),
    updatedAt: now,
  }));
  const mindmaps = backup.mindmaps.map((m) => ({
    ...m,
    id: myMaps.has(m.id) ? m.id : crypto.randomUUID(),
    nodes: m.nodes.map((node) => ({ ...node, noteId: linkNote(node.noteId) })),
    updatedAt: now,
  }));
  return { notes, cards, mindmaps };
}
