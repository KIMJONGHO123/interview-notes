import { normalizeCard, normalizeMindMap, type Card, type MindMap, type Note } from '../types';
import type { Repository, Store } from './Store';
import { cardBytes, mindmapBytes, noteBytes } from '../lib/limits';

class LocalRepository<T extends { id: string }> implements Repository<T> {
  private readonly key: string;
  private readonly normalize: (raw: T) => T;

  constructor(key: string, normalize: (raw: T) => T = (x) => x) {
    this.key = key;
    this.normalize = normalize;
  }

  private read(): T[] {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as T[]).map(this.normalize) : [];
    } catch {
      return [];
    }
  }

  private write(items: T[]) {
    localStorage.setItem(this.key, JSON.stringify(items));
  }

  async list() {
    return this.read();
  }

  async upsertMany(items: T[]) {
    const map = new Map(this.read().map((x) => [x.id, x]));
    for (const x of items) map.set(x.id, x);
    this.write([...map.values()]);
  }

  async remove(id: string) {
    this.write(this.read().filter((x) => x.id !== id));
  }
}

export function createLocalStore(): Store {
  return {
    kind: 'local',
    cards: new LocalRepository<Card>('study-cards:v1', normalizeCard),
    notes: new LocalRepository<Note>('study-notes:v1'),
    mindmaps: new LocalRepository<MindMap>('study-mindmaps:v1', normalizeMindMap),
    async usage() {
      const [cards, notes, maps] = await Promise.all([this.cards.list(), this.notes.list(), this.mindmaps.list()]);
      return (
        cards.reduce((s, c) => s + cardBytes(c), 0) +
        notes.reduce((s, n) => s + noteBytes(n), 0) +
        maps.reduce((s, m) => s + mindmapBytes(m), 0)
      );
    },
  };
}
