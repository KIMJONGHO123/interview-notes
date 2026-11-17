import type { Card, MindMap, Note } from '../types';

/** 저장소 추상화: 화면 코드는 이 인터페이스만 사용 */
export interface Repository<T> {
  list(): Promise<T[]>;
  upsertMany(items: T[]): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface Store {
  readonly kind: 'local' | 'supabase';
  cards: Repository<Card>;
  notes: Repository<Note>;
  mindmaps: Repository<MindMap>;
  /** 내 저장 사용량 (바이트) */
  usage(): Promise<number>;
}
