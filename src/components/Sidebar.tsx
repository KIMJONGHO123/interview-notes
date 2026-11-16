import { useMemo, useState, type ReactNode } from 'react';
import type { Card, Note } from '../types';

export type Tab = 'notes' | 'list' | 'review' | 'import';

interface Props {
  tab: Tab;
  notes: Note[];
  cards: Card[];
  selectedNoteId: string | null;
  onTab: (tab: Tab) => void;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onHide: () => void;
  footer: ReactNode;
}

const NAV: [Tab, string, string][] = [
  ['notes', '📖', '개념'],
  ['list', '🗂️', '카드'],
  ['review', '🔁', '복습'],
  ['import', '📥', '가져오기'],
];

const UNTAGGED = '기타';

export function Sidebar({ tab, notes, cards, selectedNoteId, onTab, onSelectNote, onNewNote, onHide, footer }: Props) {
  const [query, setQuery] = useState('');

  const weakByNote = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) if (c.noteId && c.confidence === 'low') m.set(c.noteId, (m.get(c.noteId) ?? 0) + 1);
    return m;
  }, [cards]);

  // 첫 번째 태그 기준으로 묶기
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = notes.filter((n) => !q || n.title.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)));
    const map = new Map<string, Note[]>();
    for (const n of filtered) {
      const key = n.tags[0] ?? UNTAGGED;
      map.set(key, [...(map.get(key) ?? []), n]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === UNTAGGED ? 1 : b === UNTAGGED ? -1 : a.localeCompare(b)));
  }, [notes, query]);

  const counts: Partial<Record<Tab, number>> = { notes: notes.length, list: cards.length };

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <span className="sb-title">면접 노트</span>
        <span className="spacer" />
        <button className="icon-btn" title="사이드바 닫기" onClick={onHide}>
          ⟨⟨
        </button>
      </div>

      <nav className="sb-nav">
        {NAV.map(([t, icon, label]) => (
          <button key={t} className={tab === t && !(t === 'notes' && selectedNoteId) ? 'on' : ''} onClick={() => onTab(t)}>
            <span className="sb-icon">{icon}</span>
            <span>{label}</span>
            {counts[t] !== undefined && <span className="sb-count">{counts[t]}</span>}
          </button>
        ))}
      </nav>

      <div className="sb-section">
        <div className="row">
          <span className="sb-label">개념 노트</span>
          <span className="spacer" />
          <button className="icon-btn" title="새 개념" onClick={onNewNote}>
            ＋
          </button>
        </div>
        <input className="sb-search" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="sb-list">
        {notes.length === 0 && <p className="muted small sb-empty">아직 개념이 없어요. ＋를 눌러 만들어 보세요.</p>}
        {groups.map(([group, list]) => (
          <div key={group} className="sb-group">
            <div className="sb-group-title">#{group}</div>
            {list.map((n) => {
              const weak = weakByNote.get(n.id) ?? 0;
              return (
                <button
                  key={n.id}
                  className={`sb-item ${tab === 'notes' && selectedNoteId === n.id ? 'on' : ''}`}
                  onClick={() => onSelectNote(n.id)}
                  title={n.title}
                >
                  <span className="sb-item-title">{n.title}</span>
                  {weak > 0 && (
                    <span className="sb-weak" title={`자신감 '하' 카드 ${weak}개`}>
                      {weak}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="sb-foot">{footer}</div>
    </aside>
  );
}
