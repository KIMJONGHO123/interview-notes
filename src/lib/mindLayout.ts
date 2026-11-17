import type { MindNode } from '../types';

export interface Placed {
  node: MindNode;
  x: number;
  y: number;
  depth: number;
  /** 1단계 가지 기준 색 번호 (핵심 노드는 -1) */
  color: number;
  /** 하위 가지 수 (접혀 있어도 셈) */
  childCount: number;
}

export interface Layout {
  placed: Placed[];
  edges: { from: Placed; to: Placed }[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export const PALETTE_SIZE = 6;

export function childrenMap(nodes: MindNode[]) {
  const map = new Map<string, MindNode[]>();
  for (const n of nodes) {
    if (n.parentId === null) continue;
    const list = map.get(n.parentId) ?? [];
    list.push(n);
    map.set(n.parentId, list);
  }
  return map;
}

/** 노드와 그 아래 모든 가지의 id */
export function subtreeIds(nodes: MindNode[], rootId: string) {
  const kids = childrenMap(nodes);
  const out = new Set<string>();
  const walk = (id: string) => {
    out.add(id);
    for (const c of kids.get(id) ?? []) walk(c.id);
  };
  walk(rootId);
  return out;
}

/**
 * 방사형 배치: 각 가지가 차지하는 각도를 "끝 가지 수"에 비례해서 나눔.
 * 끝 가지가 많을수록 반지름을 키워서 글자가 겹치지 않게 함.
 */
export function radialLayout(nodes: MindNode[]): Layout {
  const root = nodes.find((n) => n.parentId === null);
  if (!root) return { placed: [], edges: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };

  const kids = childrenMap(nodes);
  const visibleKids = (n: MindNode) => (n.collapsed ? [] : (kids.get(n.id) ?? []));

  const leafMemo = new Map<string, number>();
  const leaves = (n: MindNode): number => {
    const cached = leafMemo.get(n.id);
    if (cached !== undefined) return cached;
    const vk = visibleKids(n);
    const v = vk.length === 0 ? 1 : vk.reduce((s, c) => s + leaves(c), 0);
    leafMemo.set(n.id, v);
    return v;
  };

  let maxDepth = 0;
  const depthOf = (n: MindNode, d: number) => {
    maxDepth = Math.max(maxDepth, d);
    for (const c of visibleKids(n)) depthOf(c, d + 1);
  };
  depthOf(root, 0);

  const totalLeaves = leaves(root);
  // 가장 바깥 원에서 끝 가지 사이 간격이 최소 MIN_GAP 이 되도록
  const MIN_GAP = 92;
  const step = Math.max(170, (totalLeaves * MIN_GAP) / (2 * Math.PI * Math.max(1, maxDepth)));

  const placed: Placed[] = [];
  const edges: Layout['edges'] = [];

  const place = (n: MindNode, a0: number, a1: number, depth: number, color: number, parent: Placed | null) => {
    const angle = (a0 + a1) / 2;
    const r = depth * step;
    const p: Placed = {
      node: n,
      x: Math.round(r * Math.cos(angle)),
      y: Math.round(r * Math.sin(angle)),
      depth,
      color,
      childCount: (kids.get(n.id) ?? []).length,
    };
    placed.push(p);
    if (parent) edges.push({ from: parent, to: p });

    const vk = visibleKids(n);
    const total = vk.reduce((s, c) => s + leaves(c), 0);
    let cur = a0;
    vk.forEach((c, i) => {
      const span = ((a1 - a0) * leaves(c)) / total;
      place(c, cur, cur + span, depth + 1, depth === 0 ? i % PALETTE_SIZE : color, p);
      cur += span;
    });
  };

  // -180도부터 한 바퀴: 가지 1개면 오른쪽, 4개면 X자 모양으로 퍼짐
  place(root, -Math.PI, Math.PI, 0, -1, null);

  const xs = placed.map((p) => p.x);
  const ys = placed.map((p) => p.y);
  return {
    placed,
    edges,
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
  };
}
