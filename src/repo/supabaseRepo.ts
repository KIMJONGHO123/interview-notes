import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeFollowUps, type Card, type Confidence, type FollowUp, type Level, type Note } from '../types';
import type { Repository, Store } from './Store';

interface CardRow {
  id: string;
  question: string;
  answer: string;
  /** jsonb: [{ q, a }] (예전 데이터는 문자열일 수 있음) */
  follow_ups: FollowUp[] | string[];
  project: string;
  tags: string[];
  confidence: Confidence;
  level: Level;
  note_id: string | null;
  created_at: string;
  updated_at: string;
  last_reviewed_at: string | null;
}

interface NoteRow {
  id: string;
  title: string;
  body: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// user_id 는 DB 기본값 auth.uid() 로 채워지므로 보내지 않음
const cardMapper = {
  from: (r: CardRow): Card => ({
    id: r.id,
    question: r.question,
    answer: r.answer,
    followUps: normalizeFollowUps(r.follow_ups),
    project: r.project,
    tags: r.tags ?? [],
    confidence: r.confidence,
    level: r.level ?? 'interview',
    noteId: r.note_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastReviewedAt: r.last_reviewed_at,
  }),
  to: (c: Card): CardRow => ({
    id: c.id,
    question: c.question,
    answer: c.answer,
    follow_ups: c.followUps,
    project: c.project,
    tags: c.tags,
    confidence: c.confidence,
    level: c.level,
    note_id: c.noteId,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    last_reviewed_at: c.lastReviewedAt,
  }),
};

const noteMapper = {
  from: (r: NoteRow): Note => ({
    id: r.id,
    title: r.title,
    body: r.body,
    tags: r.tags ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }),
  to: (n: Note): NoteRow => ({
    id: n.id,
    title: n.title,
    body: n.body,
    tags: n.tags,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  }),
};

class SupabaseRepository<T, R> implements Repository<T> {
  private readonly db: SupabaseClient;
  private readonly table: string;
  private readonly mapper: { from: (r: R) => T; to: (x: T) => R };

  constructor(db: SupabaseClient, table: string, mapper: { from: (r: R) => T; to: (x: T) => R }) {
    this.db = db;
    this.table = table;
    this.mapper = mapper;
  }

  async list() {
    const { data, error } = await this.db.from(this.table).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data as R[]).map(this.mapper.from);
  }

  async upsertMany(items: T[]) {
    if (items.length === 0) return;
    const { error } = await this.db.from(this.table).upsert(items.map(this.mapper.to) as Record<string, unknown>[]);
    if (error) throw error;
  }

  async remove(id: string) {
    const { error } = await this.db.from(this.table).delete().eq('id', id);
    if (error) throw error;
  }
}

export function createSupabaseStore(db: SupabaseClient): Store {
  return {
    kind: 'supabase',
    cards: new SupabaseRepository<Card, CardRow>(db, 'cards', cardMapper),
    notes: new SupabaseRepository<Note, NoteRow>(db, 'notes', noteMapper),
  };
}
