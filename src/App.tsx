import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { onboard } from './lib/onboard';
import { SignInButtons, SignupPrompt } from './components/SignIn';
import { createDemoStore, endDemo, isDemo, startDemo } from './lib/demo';
import type { Store } from './repo/Store';
import { createLocalStore } from './repo/localRepo';
import { createSupabaseStore } from './repo/supabaseRepo';
import { newCard, newNote, type Card, type Confidence, type MindMap, type Note } from './types';
import { Auth } from './components/Auth';
import { CardList } from './components/CardList';
import { CardEditor } from './components/CardEditor';
import { Review, type ReviewMode } from './components/Review';
import { ImportPanel } from './components/ImportPanel';
import { NotesView } from './components/NotesView';
import { MindMapsView } from './components/MindMapsView';
import { NoteEditor } from './components/NoteEditor';
import { STORAGE_LIMIT_BYTES, formatMB, friendlyError } from './lib/limits';
import { Sidebar, type Tab } from './components/Sidebar';
import { PrivacyModal } from './components/Privacy';
import { DeleteAccountModal } from './components/DeleteAccount';

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
  const [demo, setDemo] = useState(isDemo);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // 로그인했으면 둘러보기 화면은 끝. 자료는 Main 에서 계정으로 옮긴 뒤 지움 (lib/onboard)
  useEffect(() => {
    if (session && demo) setDemo(false);
  }, [session, demo]);

  if (!authReady) return <div className="center muted">불러오는 중…</div>;
  if (supabase && !session) {
    if (demo)
      return (
        <Main
          key="demo"
          email={null}
          demo
          onExitDemo={() => {
            endDemo();
            setDemo(false);
          }}
        />
      );
    return (
      <Auth
        onDemo={async () => {
          await startDemo();
          setDemo(true);
        }}
      />
    );
  }

  // GitHub 로그인은 이메일이 비공개일 수 있어서 GitHub 아이디를 우선 표시
  const meta = session?.user.user_metadata as { user_name?: string } | undefined;
  const label = meta?.user_name ? `@${meta.user_name}` : (session?.user.email ?? null);
  return <Main key={session?.user.id ?? 'local'} email={label} user={session?.user ?? null} />;
}

const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

interface MainProps {
  email: string | null;
  /** 로그인한 계정 (첫 로그인 준비에 씀) */
  user?: User | null;
  /** 로그인 없이 둘러보기 */
  demo?: boolean;
  onExitDemo?: () => void;
}

function Main({ email, user = null, demo = false, onExitDemo }: MainProps) {
  const store: Store = useMemo(
    () => (demo ? createDemoStore() : supabase ? createSupabaseStore(supabase) : createLocalStore()),
    [demo],
  );
  const [cards, setCards] = useState<Card[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [mindmaps, setMindmaps] = useState<MindMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('notes');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [reviewNoteId, setReviewNoteId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode | null>(null);
  const [reviewKey, setReviewKey] = useState(0);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingNote, setEditingNote] = useState<{ note: Note; isNew: boolean } | null>(null);
  /** PC: 사이드바 접기 / 모바일: 서랍 열기 */
  const [sidebarHidden, setSidebarHidden] = useState(readHidden);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialog, setDialog] = useState<'privacy' | 'delete' | null>(null);

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
      const [c, n, m, u] = await Promise.all([
        store.cards.list(),
        store.notes.list(),
        store.mindmaps.list(),
        store.usage().catch(() => null),
      ]);
      setCards(c.sort(byNewest));
      setNotes(n.sort(byNewest));
      setMindmaps(m);
      setUsage(u);
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [store]);

  const [welcome, setWelcome] = useState<string | null>(null);

  // 첫 로그인: 둘러보기 자료 옮기기 + 기본 문제 세트. 끝난 뒤 불러오기
  useEffect(() => {
    const ready =
      store.kind === 'supabase' && supabase && user
        ? onboard(supabase, store, user).then(
            (r) => {
              if (!r) return;
              const parts = [
                r.movedNotes + r.movedCards > 0 && `둘러보기에서 쓰던 개념 ${r.movedNotes}개·카드 ${r.movedCards}개를 옮겼어요`,
                r.starterCards > 0 && `CS 면접 기본 문제 ${r.starterCards}개(개념 ${r.starterNotes}개)를 준비했어요`,
              ].filter(Boolean);
              if (parts.length) setWelcome(`${parts.join(' · ')}. 복습 탭에서 바로 시작해 보세요.`);
            },
            (e) => setError(friendlyError(e)),
          )
        : Promise.resolve();
    ready.then(reload);
  }, [reload, store, user]);

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
  const saveAll = (newCards: Card[], newNotes: Note[], newMaps: MindMap[] = []) =>
    run(async () => {
      await store.notes.upsertMany(newNotes);
      await store.cards.upsertMany(newCards);
      if (newMaps.length) await store.mindmaps.upsertMany(newMaps);
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

  /** 마인드맵 자동 저장: 편집 중인 화면을 유지하려고 전체를 다시 불러오지 않음 */
  const saveMindMap = async (map: MindMap) => {
    try {
      await store.mindmaps.upsertMany([map]);
      setMindmaps((prev) => (prev.some((m) => m.id === map.id) ? prev.map((m) => (m.id === map.id ? map : m)) : [...prev, map]));
      store.usage().then(setUsage, () => {});
      return true;
    } catch (e) {
      setError(friendlyError(e));
      return false;
    }
  };

  const removeMindMap = (map: MindMap) => {
    if (!confirm(`"${map.title}" 마인드맵을 삭제할까요? 되돌릴 수 없어요.`)) return;
    run(async () => {
      await store.mindmaps.remove(map.id);
      if (selectedMapId === map.id) setSelectedMapId(null);
    });
  };

  const openNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setTab('notes');
  };

  const reviewNote = (noteId: string | null, mode: ReviewMode | null = null) => {
    setReviewMode(mode);
    setReviewNoteId(noteId);
    setReviewKey((k) => k + 1);
    setTab('review');
  };

  const goTab = (t: Tab) => {
    if (t === 'notes') setSelectedNoteId(null);
    if (t === 'maps') setSelectedMapId(null);
    if (t === 'review' && tab !== 'review') reviewNote(null);
    else setTab(t);
    closeDrawer();
  };

  const selectedNote = notes.find((n) => n.id === selectedNoteId);
  const selectedMap = mindmaps.find((m) => m.id === selectedMapId);
  const TITLES: Record<Tab, string> = { notes: '개념', maps: '마인드맵', list: '카드', review: '복습', import: '가져오기' };
  const pageTitle =
    tab === 'notes' && selectedNote ? selectedNote.title : tab === 'maps' && selectedMap ? `🧠 ${selectedMap.title}` : TITLES[tab];
  const canvasMode = tab === 'maps' && !!selectedMap;

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
      {store.kind === 'demo' ? (
        <span className="pill warn" title="로그인하지 않아 이 브라우저에만 저장됩니다">
          둘러보기 · 이 브라우저에만 저장
        </span>
      ) : store.kind === 'local' ? (
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
      <div className="foot-links">
        <button className="link" onClick={() => setDialog('privacy')}>
          개인정보 안내
        </button>
        {store.kind === 'supabase' && (
          <>
            <span className="sep">·</span>
            <button className="link" onClick={() => setDialog('delete')}>
              회원 탈퇴
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className={`layout ${sidebarHidden ? 'sb-hidden' : ''} ${drawerOpen ? 'drawer-open' : ''}`}>
      <Sidebar
        tab={tab}
        notes={notes}
        cards={cards}
        mapCount={mindmaps.length}
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
        {demo && (
          <div className="demo-bar">
            <span>
              👀 <b>둘러보기 중</b> · 가입하면 여기서 만든 자료와 복습 기록이 계정으로 그대로 옮겨져요.
            </span>
            <div className="row">
              <SignInButtons source="demo_bar" compact />
              <button onClick={onExitDemo}>나가기</button>
            </div>
          </div>
        )}
        <div className="topbar">
          <button className="icon-btn menu-btn" title="사이드바" onClick={toggleSidebar}>
            ☰
          </button>
          <span className="topbar-title">{pageTitle}</span>
        </div>

        <main className={canvasMode ? 'content canvas-mode' : 'content'}>
          {error && (
            <p className="notice error" onClick={() => setError(null)}>
              {error}
            </p>
          )}
          {welcome && (
            <p className="notice welcome" onClick={() => setWelcome(null)} title="눌러서 닫기">
              🎉 {welcome}
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
        ) : tab === 'maps' ? (
          <MindMapsView
            maps={mindmaps}
            notes={notes}
            selectedId={selectedMapId}
            onSelect={setSelectedMapId}
            onSave={saveMindMap}
            onDelete={removeMindMap}
            onOpenNote={openNote}
          />
        ) : tab === 'list' ? (
          <CardList cards={cards} notes={notes} onEdit={setEditingCard} onNew={() => setEditingCard(newCard())} onOpenNote={openNote} />
        ) : tab === 'review' ? (
          <Review
            key={reviewKey}
            cards={cards}
            notes={notes}
            initialNoteId={reviewNoteId}
            initialMode={reviewMode}
            onRate={rate}
            onOpenNote={openNote}
            doneExtra={demo && supabase ? <SignupPrompt /> : null}
          />
        ) : (
          <ImportPanel cards={cards} notes={notes} mindmaps={mindmaps} onImport={saveAll} />
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

      {dialog === 'privacy' && <PrivacyModal onClose={() => setDialog(null)} />}
      {dialog === 'delete' && supabase && (
        <DeleteAccountModal db={supabase} notes={notes} cards={cards} mindmaps={mindmaps} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
