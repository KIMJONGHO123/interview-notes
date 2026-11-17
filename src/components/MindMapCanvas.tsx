import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LIMITS } from '../lib/limits';
import { radialLayout, subtreeIds, type Placed } from '../lib/mindLayout';
import { shortId, type MindMap, type MindNode, type Note } from '../types';

interface Props {
  map: MindMap;
  notes: Note[];
  onSave: (map: MindMap) => Promise<boolean>;
  onBack: () => void;
  onOpenNote: (noteId: string) => void;
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

interface View {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.25;
const MAX_K = 2;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

export function MindMapCanvas({ map, notes, onSave, onBack, onOpenNote }: Props) {
  const [nodes, setNodes] = useState<MindNode[]>(map.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  /** 방금 추가해서 아직 이름이 없는 노드 (취소하면 삭제) */
  const freshId = useRef<string | null>(null);
  const [save, setSave] = useState<SaveState>('saved');
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewportRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => radialLayout(nodes), [nodes]);
  const noteTitle = useMemo(() => new Map(notes.map((n) => [n.id, n.title])), [notes]);
  const root = nodes.find((n) => n.parentId === null)!;
  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const atLimit = nodes.length >= LIMITS.mindNodes;

  // ───────────── 자동 저장 (마지막 변경 후 0.7초)
  // onSave 는 부모가 렌더링될 때마다 새로 만들어지므로 ref 로 보관 (그대로 deps 에 넣으면 저장이 무한 반복됨)
  const latest = useRef({ map, nodes, onSave });
  latest.current = { map, nodes, onSave };
  const saveNow = useCallback(async () => {
    const { map: m, nodes: ns, onSave: save } = latest.current;
    const r = ns.find((n) => n.parentId === null)!;
    setSave('saving');
    const ok = await save({ ...m, title: r.label || '이름 없는 마인드맵', nodes: ns, updatedAt: new Date().toISOString() });
    setSave(ok ? 'saved' : 'error');
  }, []);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSave('dirty');
    const t = setTimeout(saveNow, 700);
    return () => clearTimeout(t);
  }, [nodes, saveNow]);

  // 화면을 떠날 때 저장 안 된 변경이 있으면 저장
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(
    () => () => {
      if (saveRef.current === 'dirty') void saveNow();
    },
    [saveNow],
  );

  // ───────────── 화면 맞추기
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const { minX, maxX, minY, maxY } = layout.bounds;
    const w = maxX - minX + 260;
    const h = maxY - minY + 160;
    const k = clampK(Math.min(vp.clientWidth / w, vp.clientHeight / h, 1.1));
    setView({ k, x: (-(minX + maxX) / 2) * k, y: (-(minY + maxY) / 2) * k });
  }, [layout.bounds]);

  useLayoutEffect(() => {
    // 캔버스 크기가 확정된 뒤에 맞춤 (백그라운드 탭에서도 동작하도록 rAF 대신 타이머)
    const t = setTimeout(fit, 30);
    return () => clearTimeout(t);
    // 처음 열 때만 맞춤 (가지 추가할 때마다 화면이 움직이면 불편)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id]);

  // ───────────── 이동 · 확대 (마우스 드래그, 휠, 두 손가락)
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; k: number } | null>(null);

  const zoomAt = useCallback((factor: number, sx: number, sy: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const cx = sx - rect.left - rect.width / 2;
    const cy = sy - rect.top - rect.height / 2;
    setView((v) => {
      const k = clampK(v.k * factor);
      const wx = (cx - v.x) / v.k;
      const wy = (cy - v.y) / v.k;
      return { k, x: cx - wx * k, y: cy - wy * k };
    });
  }, []);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const target = clampK((pinch.current.k * dist) / pinch.current.dist);
      zoomAt(target / view.k, (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (pointers.current.size === 1) {
      setView((v) => ({ ...v, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // ───────────── 편집
  const update = (id: string, patch: Partial<MindNode>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const startEdit = (n: MindNode) => {
    setSelectedId(n.id);
    setEditingId(n.id);
    setDraft(n.label);
  };

  const addChild = (parentId: string) => {
    if (atLimit) return;
    const child: MindNode = { id: shortId(), parentId, label: '' };
    // 접혀 있던 가지에 추가하면 펼치기
    setNodes((ns) => [...ns.map((n) => (n.id === parentId ? { ...n, collapsed: false } : n)), child]);
    freshId.current = child.id;
    setSelectedId(child.id);
    setEditingId(child.id);
    setDraft('');
  };

  const remove = (id: string) => {
    const ids = subtreeIds(nodes, id);
    const parentId = nodes.find((n) => n.id === id)?.parentId ?? null;
    setNodes((ns) => ns.filter((n) => !ids.has(n.id)));
    setSelectedId(parentId);
    if (editingId && ids.has(editingId)) setEditingId(null);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const label = draft.trim();
    const id = editingId;
    setEditingId(null);
    if (!label) {
      // 새로 만든 빈 가지는 지우고, 기존 가지는 원래 이름 유지
      if (freshId.current === id) remove(id);
    } else {
      update(id, { label });
    }
    freshId.current = null;
  };

  const cancelEdit = () => {
    if (editingId && freshId.current === editingId) remove(editingId);
    freshId.current = null;
    setEditingId(null);
  };

  const confirmRemove = (n: MindNode) => {
    const count = subtreeIds(nodes, n.id).size - 1;
    if (count > 0 && !confirm(`"${n.label}" 가지와 그 아래 가지 ${count}개를 삭제할까요?`)) return;
    remove(n.id);
  };

  // 키보드: Tab 으로 가지 추가, Enter 로 이름 수정, Delete 로 삭제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingId || !selected) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Tab') {
        e.preventDefault();
        addChild(selected.id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        startEdit(selected);
      } else if (e.key === 'Delete' && selected.parentId !== null) {
        e.preventDefault();
        confirmRemove(selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const SAVE_LABEL: Record<SaveState, string> = { saved: '저장됨', dirty: '수정 중…', saving: '저장 중…', error: '저장 실패' };

  return (
    <div className="mm">
      <div className="mm-toolbar">
        <button className="link" onClick={onBack}>
          ← 목록
        </button>
        <span className="spacer" />
        <span className={`small ${save === 'error' ? 'weak' : 'muted'}`}>{SAVE_LABEL[save]}</span>
        <span className="muted small hide-sm">
          가지 {nodes.length - 1} / {LIMITS.mindNodes - 1}
        </span>
        <div className="seg">
          <button title="축소" onClick={() => setView((v) => ({ ...v, k: clampK(v.k / 1.2), x: v.x / 1.2, y: v.y / 1.2 }))}>
            −
          </button>
          <button title="화면에 맞추기" onClick={fit}>
            ⤢
          </button>
          <button title="확대" onClick={() => setView((v) => ({ ...v, k: clampK(v.k * 1.2), x: v.x * 1.2, y: v.y * 1.2 }))}>
            ＋
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="mm-viewport"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || (e.target as Element).tagName === 'svg') {
            if (editingId) commitEdit();
            setSelectedId(null);
          }
          onPointerDown(e);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mm-stage" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className="mm-edges" width="1" height="1">
            {layout.edges.map(({ from, to }) => (
              <line
                key={to.node.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={`mm-edge c${to.color}`}
                strokeWidth={to.depth === 1 ? 3 : 2}
              />
            ))}
          </svg>

          {layout.placed.map((p) => (
            <NodeView
              key={p.node.id}
              p={p}
              selected={p.node.id === selectedId}
              editing={p.node.id === editingId}
              draft={draft}
              noteTitle={p.node.noteId ? noteTitle.get(p.node.noteId) : undefined}
              canAdd={!atLimit}
              onDraft={setDraft}
              onCommit={commitEdit}
              onCancel={cancelEdit}
              onSelect={() => {
                if (editingId && editingId !== p.node.id) commitEdit();
                setSelectedId(p.node.id);
              }}
              onEdit={() => startEdit(p.node)}
              onAdd={() => addChild(p.node.id)}
              onToggle={() => update(p.node.id, { collapsed: !p.node.collapsed })}
              onOpenNote={() => p.node.noteId && onOpenNote(p.node.noteId)}
            />
          ))}
        </div>

        {nodes.length === 1 && !editingId && (
          <p className="mm-hint">
            <b>{root.label}</b> 옆의 <b>＋</b>를 눌러 떠오르는 것을 가지로 추가해 보세요.
          </p>
        )}
      </div>

      {selected && !editingId && (
        <div className="mm-actions">
          <span className="mm-actions-title">{selected.label}</span>
          <div className="row">
            <button className="primary" onClick={() => addChild(selected.id)} disabled={atLimit}>
              ＋ 가지
            </button>
            <button onClick={() => startEdit(selected)}>✏️ 이름</button>
            {(layoutChildCount(layout.placed, selected.id) > 0 || selected.collapsed) && (
              <button onClick={() => update(selected.id, { collapsed: !selected.collapsed })}>
                {selected.collapsed ? '▸ 펼치기' : '▾ 접기'}
              </button>
            )}
            <select
              className="mm-note-select"
              value={selected.noteId ?? ''}
              onChange={(e) => update(selected.id, { noteId: e.target.value || null })}
              title="개념 노트 연결"
            >
              <option value="">📖 노트 연결 안 함</option>
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  📖 {n.title}
                </option>
              ))}
            </select>
            {selected.parentId !== null && (
              <button className="danger" onClick={() => confirmRemove(selected)}>
                🗑 삭제
              </button>
            )}
          </div>
          {atLimit && <p className="small weak">가지는 마인드맵 하나에 {LIMITS.mindNodes - 1}개까지 만들 수 있어요.</p>}
        </div>
      )}
    </div>
  );
}

const layoutChildCount = (placed: Placed[], id: string) => placed.find((p) => p.node.id === id)?.childCount ?? 0;

interface NodeProps {
  p: Placed;
  selected: boolean;
  editing: boolean;
  draft: string;
  noteTitle?: string;
  canAdd: boolean;
  onDraft: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onAdd: () => void;
  onToggle: () => void;
  onOpenNote: () => void;
}

function NodeView(props: NodeProps) {
  const { p, selected, editing, draft, noteTitle, canAdd } = props;
  const n = p.node;
  const cls = [
    'mm-node',
    p.depth === 0 ? 'root' : p.depth === 1 ? 'd1' : 'd2',
    p.color >= 0 ? `c${p.color}` : '',
    selected ? 'selected' : '',
  ].join(' ');

  return (
    <div
      className={cls}
      style={{ left: p.x, top: p.y }}
      onPointerDown={(e) => {
        e.stopPropagation();
        props.onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        props.onEdit();
      }}
    >
      {editing ? (
        <input
          className="mm-input"
          autoFocus
          maxLength={LIMITS.mindLabel}
          value={draft}
          placeholder="이름 입력 후 Enter"
          onChange={(e) => props.onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter 무시
            if (e.key === 'Enter') props.onCommit();
            if (e.key === 'Escape') props.onCancel();
          }}
          onBlur={props.onCommit}
          onPointerDown={(e) => e.stopPropagation()}
          size={Math.max(6, draft.length + 2)}
        />
      ) : (
        <span className="mm-label">{n.label}</span>
      )}

      {!editing && n.noteId && noteTitle && (
        <button
          className="mm-badge"
          title={`노트 열기: ${noteTitle}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={props.onOpenNote}
        >
          📖
        </button>
      )}
      {!editing && n.collapsed && p.childCount > 0 && (
        <button className="mm-badge count" title="펼치기" onPointerDown={(e) => e.stopPropagation()} onClick={props.onToggle}>
          +{p.childCount}
        </button>
      )}
      {!editing && canAdd && (
        <button
          className="mm-add"
          title="가지 추가"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            props.onAdd();
          }}
        >
          ＋
        </button>
      )}
    </div>
  );
}
