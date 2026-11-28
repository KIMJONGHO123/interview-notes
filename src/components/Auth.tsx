import { useEffect, useState } from 'react';
import { CONFIDENCE_LABEL, type Confidence } from '../types';
import { STARTER_STATS, TRY_QUESTIONS } from '../lib/starter';
import { track, trackOnce } from '../lib/track';
import { PrivacyModal } from './Privacy';
import { Logo } from './Logo';
import { SignInButtons, TrustLine } from './SignIn';

/** OAuth 실패 시 Supabase 가 주소에 붙여 보내는 오류 메시지 */
function readOAuthError(): string | null {
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''));
  return params.get('error_description');
}

const FEATURES = [
  ['🎤', '30초 면접 연습', '타이머를 켜고 소리 내어 답한 뒤, 꼬리질문까지 이어서 연습해요'],
  ['📊', '약한 질문부터', '하·중·상으로 매긴 자신감이 낮은 질문이 먼저 나와요'],
  ['📖', '내 노트로 확장', 'AI로 정리한 내용을 붙여넣으면 노트와 카드가 한 번에 만들어져요'],
] as const;

const RATE_REPLY: Record<Confidence, string> = {
  low: '괜찮아요. "하"로 매긴 질문은 다음 복습에서 가장 먼저 나와요.',
  mid: '반쯤 맞았다면, 꼬리질문까지 답할 수 있을 때 "상"으로 올려 보세요.',
  high: '좋아요! 실제 면접에선 바로 이어서 꼬리질문이 나와요. 아래 질문에도 답해 보세요.',
};

export function Auth({ onDemo }: { onDemo: () => void }) {
  const [msg] = useState<string | null>(readOAuthError);
  // /#privacy 로 들어오면 바로 열기 (Google 동의 화면의 개인정보처리방침 링크)
  const [showPrivacy, setShowPrivacy] = useState(() => window.location.hash === '#privacy');

  useEffect(() => trackOnce('landing_view'), []);

  return (
    <div className="landing">
      <section className="landing-copy">
        <div className="brand">
          <Logo size={36} />
          <span>면접노트</span>
        </div>
        <h1 className="landing-title">
          기술면접,
          <br />
          읽지 말고 <em>말하면서</em> 준비하세요
        </h1>
        <p className="landing-sub">
          질문을 보고 30초 안에 답해 보고, 꼬리질문까지 이어서 연습하는 공부 도구예요. 가입하면 운영체제·네트워크·DB·자료구조·자바/스프링·웹 면접 질문{' '}
          <b>{STARTER_STATS.questions}개</b>와 개념 카드가 바로 준비돼요.
        </p>

        <div className="landing-cta">
          <SignInButtons source="landing" />
          <button
            className="demo-btn"
            onClick={() => {
              track('demo_start');
              onDemo();
            }}
          >
            로그인 없이 둘러보기
          </button>
          <TrustLine />
        </div>

        {msg && <p className="notice error">{msg}</p>}

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

        <p className="muted small auth-note">
          처음이면 자동으로 가입돼요. 시작하면{' '}
          <button className="link small" style={{ padding: 0 }} onClick={() => setShowPrivacy(true)}>
            개인정보 안내
          </button>
          에 동의한 것으로 봐요.
        </p>
      </section>

      <TryCard />

      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}

/** 가입 전에 실제 면접 질문 하나를 풀어 보는 카드 */
function TryCard() {
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rated, setRated] = useState<Confidence | null>(null);
  const card = TRY_QUESTIONS[i % TRY_QUESTIONS.length];
  if (!card) return null;
  const follow = card.followUps[0];

  const next = () => {
    setI((n) => n + 1);
    setRevealed(false);
    setRated(null);
  };

  return (
    <section className="try" aria-label="면접 질문 체험">
      <div className="try-head">
        <span className="try-label">지금 바로 한 문제</span>
        <span className="muted small">
          {(i % TRY_QUESTIONS.length) + 1} / {TRY_QUESTIONS.length}
        </span>
      </div>
      <div className="try-card">
        <div className="row small">
          <span className="level interview">🎤 면접</span>
          <div className="tags">
            {card.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        </div>
        <h2 className="review-q">{card.question}</h2>

        {!revealed ? (
          <>
            <p className="muted small">머릿속으로, 또는 소리 내어 30초 안에 답해 본 뒤 눌러 보세요.</p>
            <button
              className="primary big"
              onClick={() => {
                setRevealed(true);
                track('try_reveal');
              }}
            >
              답 보기
            </button>
          </>
        ) : (
          <div className="stack">
            <p className="answer">{card.answer}</p>
            {!rated ? (
              <>
                <p className="muted small">얼마나 잘 답했나요?</p>
                <div className="rate">
                  {(['low', 'mid', 'high'] as Confidence[]).map((c) => (
                    <button
                      key={c}
                      className={`conf-${c}`}
                      onClick={() => {
                        setRated(c);
                        track('try_rate', c);
                      }}
                    >
                      {CONFIDENCE_LABEL[c]}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="small try-reply">{RATE_REPLY[rated]}</p>
                {follow && (
                  <div className="try-follow">
                    <span className="fu-badge">↳ 꼬리질문</span>
                    <p>{follow.q}</p>
                  </div>
                )}
                <div className="row">
                  <button className="link" onClick={next}>
                    다른 질문 풀어 보기 →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <p className="muted small try-foot">
        가입하면 이런 질문 {STARTER_STATS.questions}개와 꼬리질문, 개념 노트 {STARTER_STATS.topics}개가 내 계정에 저장되고, 매긴 자신감에 따라 약한 질문부터 다시 나와요.
      </p>
    </section>
  );
}
