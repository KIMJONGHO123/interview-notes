import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function Auth({ db }: { db: SupabaseClient }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { data, error } =
      mode === 'signin'
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (mode === 'signup' && !data.session) setMsg('확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인하세요.');
  }

  return (
    <div className="auth">
      <h1>면접 노트</h1>
      <p className="muted">공부한 내용을 카드로 모으고 복습하세요.</p>
      <form onSubmit={submit} className="stack">
        <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="비밀번호 (6자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <button className="primary" disabled={busy}>
          {mode === 'signin' ? '로그인' : '회원가입'}
        </button>
      </form>
      {msg && <p className="notice">{msg}</p>}
      <button className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? '처음이신가요? 회원가입' : '이미 계정이 있어요. 로그인'}
      </button>
    </div>
  );
}
