import { useState } from 'react';
import type { FollowUp } from '../types';

/** 꼬리질문 목록: 질문만 보이고, 누르면 답이 펼쳐짐 */
export function FollowUpList({ items }: { items: FollowUp[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const allOpen = open.size === items.length;

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="followups">
      <div className="row">
        <h4>꼬리질문 {items.length}개</h4>
        <span className="spacer" />
        <button className="link small" onClick={() => setOpen(allOpen ? new Set() : new Set(items.map((_, i) => i)))}>
          {allOpen ? '답 모두 접기' : '답 모두 보기'}
        </button>
      </div>
      <ol>
        {items.map((f, i) => (
          <li key={i} className={open.has(i) ? 'open' : ''}>
            <button className="fq" onClick={() => toggle(i)}>
              <span>{f.q}</span>
              <span className="muted small">{f.a ? (open.has(i) ? '접기' : '답 보기') : '답 없음'}</span>
            </button>
            {open.has(i) && f.a && <p className="fa">{f.a}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
