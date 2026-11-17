import { useState, type FormEvent } from 'react';
import { LIMITS } from '../lib/limits';
import { newMindMap, type MindMap, type Note } from '../types';
import { MindMapCanvas } from './MindMapCanvas';

interface Props {
  maps: MindMap[];
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (map: MindMap) => Promise<boolean>;
  onDelete: (map: MindMap) => void;
  onOpenNote: (noteId: string) => void;
}

export function MindMapsView({ maps, notes, selectedId, onSelect, onSave, onDelete, onOpenNote }: Props) {
  const selected = maps.find((m) => m.id === selectedId);
  if (selected) {
    return (
      <MindMapCanvas
        key={selected.id}
        map={selected}
        notes={notes}
        onSave={onSave}
        onBack={() => onSelect(null)}
        onOpenNote={onOpenNote}
      />
    );
  }
  return <MapList maps={maps} onSelect={onSelect} onSave={onSave} onDelete={onDelete} />;
}

function MapList({
  maps,
  onSelect,
  onSave,
  onDelete,
}: Pick<Props, 'maps' | 'onSelect' | 'onSave' | 'onDelete'>) {
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    const title = word.trim();
    if (!title) return;
    setBusy(true);
    const map = newMindMap(title);
    if (await onSave(map)) {
      setWord('');
      onSelect(map.id);
    }
    setBusy(false);
  }

  const sorted = [...maps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="stack">
      <form className="mm-new" onSubmit={create}>
        <input
          className="grow"
          placeholder="핵심 단어 입력 (예: 트랜잭션)"
          value={word}
          maxLength={LIMITS.mindLabel}
          onChange={(e) => setWord(e.target.value)}
        />
        <button className="primary" disabled={!word.trim() || busy}>
          🧠 마인드맵 만들기
        </button>
      </form>

      {sorted.length === 0 ? (
        <div className="empty stack">
          <p>아직 마인드맵이 없어요.</p>
          <p className="small">
            핵심 단어를 입력하고, 떠오르는 개념을 <b>＋</b>로 가지처럼 뻗어나가 보세요.
            <br />
            개념 사이의 연결을 한눈에 정리할 수 있어요.
          </p>
        </div>
      ) : (
        <ul className="mm-list">
          {sorted.map((m) => (
            <li key={m.id} className="note-item" onClick={() => onSelect(m.id)}>
              <div className="note-title">🧠 {m.title}</div>
              <div className="row small">
                <span className="muted">가지 {m.nodes.length - 1}개</span>
                <span className="muted">· {new Date(m.updatedAt).toLocaleDateString('ko-KR')}</span>
                <span className="spacer" />
                <button
                  className="link small danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(m);
                  }}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
