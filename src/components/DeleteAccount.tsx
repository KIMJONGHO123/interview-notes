import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Card, MindMap, Note } from '../types';
import { downloadBackup } from '../lib/backup';

interface Props {
  db: SupabaseClient;
  notes: Note[];
  cards: Card[];
  mindmaps: MindMap[];
  onClose: () => void;
}

const CONFIRM_WORD = '탈퇴';

/** 회원 탈퇴: 백업 → "탈퇴" 입력 → 계정과 모든 자료 삭제 */
export function DeleteAccountModal({ db, notes, cards, mindmaps, onClose }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasData = notes.length + cards.length + mindmaps.length > 0;

  const backup = () => downloadBackup({ notes, cards, mindmaps }, 'interview-notes-backup');

  async function remove() {
    if (text.trim() !== CONFIRM_WORD) return;
    setBusy(true);
    setError(null);
    const { error } = await db.rpc('delete_my_account');
    if (error) {
      setBusy(false);
      setError(`탈퇴하지 못했어요. 잠시 뒤 다시 시도해 주세요. (${error.message})`);
      return;
    }
    alert('탈퇴가 완료됐어요. 그동안 써주셔서 고마워요.');
    // 계정이 이미 없으므로 서버 호출 없이 이 브라우저의 로그인만 정리
    await db.auth.signOut({ scope: 'local' });
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>회원 탈퇴</h2>
        <p>
          계정과 함께 아래 자료가 <b>모두 바로 삭제</b>되고, <b>되돌릴 수 없어요.</b>
        </p>
        <ul className="delete-list">
          <li>개념 노트 {notes.length}개</li>
          <li>카드 {cards.length}개</li>
          <li>마인드맵 {mindmaps.length}개</li>
        </ul>

        {hasData && (
          <div className="helper">
            <span>나중에 다시 쓰고 싶다면 먼저 백업해 두세요. (다시 가입한 뒤 가져오기 탭에서 불러올 수 있어요)</span>
            <div className="row">
              <button onClick={backup}>📦 내 자료 백업 (JSON)</button>
            </div>
          </div>
        )}

        <label>
          확인을 위해 <b>{CONFIRM_WORD}</b> 라고 입력하세요
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={CONFIRM_WORD} disabled={busy} />
        </label>

        {error && <p className="notice error">{error}</p>}

        <div className="row end">
          <span className="spacer" />
          <button onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="danger-solid" onClick={remove} disabled={busy || text.trim() !== CONFIRM_WORD}>
            {busy ? '삭제 중…' : '탈퇴하고 모두 삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
