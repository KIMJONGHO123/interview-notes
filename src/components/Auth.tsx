import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PrivacyModal } from './Privacy';
import { Logo } from './Logo';

/** OAuth 실패 시 Supabase 가 주소에 붙여 보내는 오류 메시지 */
function readOAuthError(): string | null {
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''));
  return params.get('error_description');
}

const FEATURES = [
  ['📖', '개념 노트', 'GPT로 정리한 내용을 붙여넣으면 노트와 카드가 한 번에 만들어져요'],
  ['🔁', '면접식 복습', '질문만 보고 답한 뒤 확인, 꼬리질문까지 이어서 연습해요'],
  ['📊', '약한 곳 표시', '자신감 낮은 카드부터 나오고, 약한 개념이 한눈에 보여요'],
] as const;

export function Auth({ db }: { db: SupabaseClient }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(readOAuthError);
  const [showPrivacy, setShowPrivacy] = useState(false);

  async function signInWithGitHub() {
    setBusy(true);
    setMsg(null);
    const { error } = await db.auth.signInWithOAuth({
      provider: 'github',
      // 로그인 후 지금 사이트(배포 주소 또는 localhost)로 돌아오게
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setBusy(false);
      setMsg(error.message);
    }
  }

  return (
    <div className="auth">
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="auth-title">
          <Logo size={44} />
          면접노트
        </h1>
        <p className="muted">개념을 이해하고, 면접처럼 말해보는 공부 도구</p>
      </div>

      <ul className="auth-features">
        {FEATURES.map(([icon, title, desc]) => (
          <li key={title}>
            <span className="auth-icon">{icon}</span>
            <div>
              <b>{title}</b>
              <p className="muted small">{desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <button className="github-btn" onClick={signInWithGitHub} disabled={busy}>
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
        GitHub으로 시작하기
      </button>

      {msg && <p className="notice error">{msg}</p>}

      <p className="muted small auth-note">
        GitHub 계정으로 가입과 로그인이 함께 돼요. 처음이면 자동으로 가입됩니다.
        <br />
        시작하면 <button className="link small" style={{ padding: 0 }} onClick={() => setShowPrivacy(true)}>개인정보 안내</button>에 동의한 것으로 봐요.
      </p>

      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
