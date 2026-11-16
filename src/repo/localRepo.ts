import { normalizeCard, type Card, type Note } from '../types';
import type { Repository, Store } from './Store';

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
  };
}
