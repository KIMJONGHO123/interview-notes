import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { Store } from './repo/Store';
import { createLocalStore } from './repo/localRepo';
import { createSupabaseStore } from './repo/supabaseRepo';
import { newCard, newNote, type Card, type Confidence, type Note } from './types';
import { Auth } from './components/Auth';
import { CardList } from './components/CardList';
import { CardEditor } from './components/CardEditor';
import { Review } from './components/Review';
import { ImportPanel } from './components/ImportPanel';
import { NotesView } from './components/NotesView';
import { NoteEditor } from './components/NoteEditor';
import { STORAGE_LIMIT_BYTES, formatMB, friendlyError } from './lib/limits';
import { Sidebar, type Tab } from './components/Sidebar';

const MOBILE_QUERY = '(max-width: 899px)';
const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;
const SIDEBAR_KEY = 'study-sidebar-hidden';

function readHidden() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!authReady) return <div className="center muted">불러오는 중…</div>;
  if (supabase && !session) return <Auth db={supabase} />;

  return <Main key={session?.user.id ?? 'local'} email={session?.user.email ?? null} />;
}

const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

function Main({ email }: { email: string | null }) {
  const store: Store = useMemo(() => (supabase ? createSupabaseStore(supabase) : createLocalStore()), []);
  const [cards, setCards] = useState<Card[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('notes');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [reviewNoteId, setReviewNoteId] = useState<string | null>(null);
  const [reviewKey, setReviewKey] = useState(0);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingNote, setEditingNote] = useState<{ note: Note; isNew: boolean } | null>(null);
  /** PC: 사이드바 접기 / 모바일: 서랍 열기 */
  const [sidebarHidden, setSidebarHidden] = useState(readHidden);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const setHidden = (v: boolean) => {
    setSidebarHidden(v);
    try {
      localStorage.setItem(SIDEBAR_KEY, v ? '1' : '0');
    } catch {
      /* 저장 실패해도 동작에는 문제 없음 */
    }
  };
  const toggleSidebar = () => (isMobile() ? setDrawerOpen((o) => !o) : setHidden(!sidebarHidden));
  const hideSidebar = () => (isMobile() ? setDrawerOpen(false) : setHidden(true));
  /** 모바일에서 사이드바 항목을 고르면 서랍 닫기 */
  const closeDrawer = () => setDrawerOpen(false);

  const [usage, setUsage] = useState<number | null>(null);

  const reload = useCallback(async () => {
    try {
      const [c, n, u] = await Promise.all([store.cards.list(), store.notes.list(), store.usage().catch(() => null)]);
      setCards(c.sort(byNewest));
      setNotes(n.sort(byNewest));
      setUsage(u);
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** 실행 후 다시 불러오기. 성공 여부 반환 */
  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      await reload();
      return true;
    } catch (e) {
      setError(friendlyError(e));
      await reload(); // 일부만 저장됐을 수 있으니 화면을 실제 상태로 맞춤
      return false;
    }
  };

  // 노트를 먼저 저장해야 카드의 note_id 외래키가 유효함
  const saveAll = (newCards: Card[], newNotes: Note[]) =>
    run(async () => {
      await store.notes.upsertMany(newNotes);
      await store.cards.upsertMany(newCards);
    });

  const saveCard = async (card: Card) => {
    if (await saveAll([card], [])) setEditingCard(null);
  };

  const removeCard = (card: Card) => {
    if (!confirm('이 카드를 삭제할까요?')) return;
    run(async () => {
      await store.cards.remove(card.id);
      setEditingCard(null);
    });
  };

  const saveNote = async (note: Note, newCards: Card[]) => {
    if (await saveAll(newCards, [note])) {
      setEditingNote(null);
      setSelectedNoteId(note.id);
    }
  };

  const removeNote = (note: Note) => {
    const linked = cards.filter((c) => c.noteId === note.id);
    const msg = linked.length
      ? `"${note.title}" 노트를 삭제할까요?\n연결된 카드 ${linked.length}개는 남고, 연결만 해제됩니다.`
      : `"${note.title}" 노트를 삭제할까요?`;
    if (!confirm(msg)) return;
    run(async () => {
      await store.cards.upsertMany(linked.map((c) => ({ ...c, noteId: null })));
      await store.notes.remove(note.id);
      setSelectedNoteId(null);
    });
  };

  const rate = (card: Card, confidence: Confidence) => {
    const now = new Date().toISOString();
    const updated = { ...card, confidence, lastReviewedAt: now, updatedAt: now };
    setCards((prev) => prev.map((c) => (c.id === card.id ? updated : c)));
    store.cards.upsertMany([updated]).catch((e) => setError(friendlyError(e)));
  };

  const openNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setTab('notes');
  };

  const reviewNote = (noteId: string | null) => {
    setReviewNoteId(noteId);
    setReviewKey((k) => k + 1);
    setTab('review');
  };

  const goTab = (t: Tab) => {
    if (t === 'notes') setSelectedNoteId(null);
    if (t === 'review' && tab !== 'review') reviewNote(null);
    else setTab(t);
    closeDrawer();
  };

  const selectedNote = notes.find((n) => n.id === selectedNoteId);
  const TITLES: Record<Tab, string> = { notes: '개념', list: '카드', review: '복습', import: '가져오기' };
  const pageTitle = tab === 'notes' && selectedNote ? selectedNote.title : TITLES[tab];

  const usagePct = usage === null ? 0 : Math.min(100, (usage / STORAGE_LIMIT_BYTES) * 100);
  const usageMeter = usage !== null && (
    <div className="usage" title="노트와 카드에 저장된 글자 용량">
      <div className="row small">
        <span className="muted">저장 공간</span>
        <span className="spacer" />
        <span className={usagePct >= 90 ? 'weak' : 'muted'}>
          {formatMB(usage)} / {formatMB(STORAGE_LIMIT_BYTES)}
        </span>
      </div>
      <div className={`usage-bar ${usagePct >= 90 ? 'danger' : usagePct >= 70 ? 'warn' : ''}`}>
        <div style={{ width: `${Math.max(usagePct, usage > 0 ? 1 : 0)}%` }} />
      </div>
    </div>
  );

  const footer = (
    <div className="stack" style={{ gap: 8 }}>
      {usageMeter}
      {store.kind === 'local' ? (
        <span className="pill warn" title="Supabase 환경변수가 없어서 이 브라우저에만 저장됩니다">
          로컬 모드 · 이 브라우저에만 저장
        </span>
      ) : (
        <div className="row">
          <span className="muted small sb-email">{email}</span>
          <span className="spacer" />
          <button className="link small" onClick={() => supabase!.auth.signOut()}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className={`layout ${sidebarHidden ? 'sb-hidden' : ''} ${drawerOpen ? 'drawer-open' : ''}`}>
      <Sidebar
        tab={tab}
        notes={notes}
        cards={cards}
        selectedNoteId={selectedNoteId}
        onTab={goTab}
        onSelectNote={(id) => {
          openNote(id);
          closeDrawer();
        }}
        onNewNote={() => {
          setEditingNote({ note: newNote(), isNew: true });
          closeDrawer();
        }}
        onHide={hideSidebar}
        footer={footer}
      />
      <div className="scrim" onClick={closeDrawer} />

      <div className="main-col">
        <div className="topbar">
          <button className="icon-btn menu-btn" title="사이드바" onClick={toggleSidebar}>
            ☰
          </button>
          <span className="topbar-title">{pageTitle}</span>
        </div>

        <main className="content">
          {error && (
            <p className="notice error" onClick={() => setError(null)}>
              {error}
            </p>
          )}
        {loading ? (
          <p className="muted">불러오는 중…</p>
        ) : tab === 'notes' ? (
          <NotesView
            notes={notes}
            cards={cards}
            selectedId={selectedNoteId}
            onSelect={setSelectedNoteId}
            onNew={() => setEditingNote({ note: newNote(), isNew: true })}
            onEdit={(note) => setEditingNote({ note, isNew: false })}
            onDelete={removeNote}
            onEditCard={setEditingCard}
            onNewCard={(noteId) => {
              const note = notes.find((n) => n.id === noteId);
              setEditingCard(newCard({ noteId, level: 'basic', tags: note ? [...note.tags] : [] }));
            }}
            onReview={reviewNote}
          />
        ) : tab === 'list' ? (
          <CardList cards={cards} notes={notes} onEdit={setEditingCard} onNew={() => setEditingCard(newCard())} onOpenNote={openNote} />
        ) : tab === 'review' ? (
          <Review key={reviewKey} cards={cards} notes={notes} initialNoteId={reviewNoteId} onRate={rate} onOpenNote={openNote} />
        ) : (
          <ImportPanel cards={cards} notes={notes} onImport={saveAll} />
        )}
        </main>
      </div>

      {editingCard && (
        <CardEditor
          card={editingCard}
          notes={notes}
          onSave={saveCard}
          onCancel={() => setEditingCard(null)}
          onDelete={cards.some((c) => c.id === editingCard.id) ? () => removeCard(editingCard) : undefined}
        />
      )}

      {editingNote && (
        <NoteEditor
          note={editingNote.note}
          isNew={editingNote.isNew}
          onSave={saveNote}
          onCancel={() => setEditingNote(null)}
        />
      )}
    </div>
  );
}
