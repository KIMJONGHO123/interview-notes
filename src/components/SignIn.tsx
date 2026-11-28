import { useEffect, useState } from 'react';
import { enabledProviders, signInWith, supabase, type Provider } from '../lib/supabase';
import { STARTER_STATS } from '../lib/starter';
import { track } from '../lib/track';

let providersCache: Promise<Provider[]> | null = null;

function useProviders() {
  const [list, setList] = useState<Provider[]>(['github']);
  useEffect(() => {
    providersCache ??= enabledProviders();
    let alive = true;
    providersCache.then((p) => alive && setList(p));
    return () => {
      alive = false;
    };
  }, []);
  return list;
}

const GitHubIcon = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
    <path
      fill="currentColor"
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
    />
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const LABEL: Record<Provider, { icon: () => React.JSX.Element; text: string }> = {
  github: { icon: GitHubIcon, text: 'GitHub으로 시작하기' },
  google: { icon: GoogleIcon, text: 'Google로 시작하기' },
};

/** 소셜 로그인 버튼 묶음. source 는 측정용 (어느 화면에서 눌렀는지) */
export function SignInButtons({ source, compact = false }: { source: string; compact?: boolean }) {
  const providers = useProviders();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go(p: Provider) {
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    track('signup_click', `${source}:${p}`);
    const { error } = await signInWith(supabase, p);
    if (error) {
      setBusy(false);
      setMsg(error.message);
    }
  }

  return (
    <div className={compact ? 'signin compact' : 'signin'}>
      {providers.map((p) => {
        const { icon: Icon, text } = LABEL[p];
        return (
          <button key={p} className={`oauth-btn ${p}`} onClick={() => go(p)} disabled={busy}>
            <Icon />
            {text}
          </button>
        );
      })}
      {msg && <p className="notice error">{msg}</p>}
    </div>
  );
}

/** 무엇을 받는지 / 무료인지 안심 문구 */
export function TrustLine() {
  return (
    <p className="trust muted small">
      무료 · 이름·프로필 사진·이메일만 받아요 · GitHub 저장소에는 접근하지 않아요 · 언제든 탈퇴
    </p>
  );
}

/** 둘러보기에서 가치를 느낀 순간(복습 끝)에 보여 주는 가입 권유 */
export function SignupPrompt() {
  useEffect(() => track('signup_prompt_view'), []);
  return (
    <div className="signup-prompt">
      <div className="stack" style={{ gap: 4 }}>
        <b>방금 푼 기록, 저장해 둘까요?</b>
        <p className="muted small">
          가입하면 둘러보며 만든 자료와 복습 기록이 계정으로 그대로 옮겨지고, CS 면접 질문 {STARTER_STATS.questions}개(개념 카드 포함 {STARTER_STATS.cards}개)가 함께 준비돼요.
        </p>
      </div>
      <SignInButtons source="review_done" compact />
      <TrustLine />
    </div>
  );
}
