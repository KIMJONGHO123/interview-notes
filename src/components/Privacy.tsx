/** 개인정보 처리방침 (로그인 화면·사이드바에서 열기) */
const CONTACT_EMAIL = 'iikim098701@gmail.com';
const EFFECTIVE_DATE = '2026년 11월 19일';

export function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal stack privacy" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 style={{ margin: 0 }}>개인정보 안내</h2>
          <span className="spacer" />
          <button className="icon-btn" title="닫기" onClick={onClose}>
            ✕
          </button>
        </div>

        <section>
          <h3>어떤 정보를 저장하나요</h3>
          <ul>
            <li>
              <b>GitHub 계정 정보</b>: GitHub 로그인 시 전달되는 아이디, 이름, 프로필 사진 주소, 이메일(GitHub에 공개·인증된 경우)
            </li>
            <li>
              <b>직접 작성한 학습 자료</b>: 개념 노트, 카드, 마인드맵, 복습 기록(자신감·마지막 복습 시각)
            </li>
            <li>
              <b>접속 기록</b>: 사이트 접속 시 IP 주소, 브라우저 정보 (호스팅 업체가 자동으로 처리)
            </li>
          </ul>
          <p className="muted small">
            비밀번호는 받지 않아요. 로그인은 GitHub가 처리합니다. 로그인 없이 둘러보기로 만든 자료는 이 브라우저에만 저장되고 서버로
            보내지 않아요.
          </p>
        </section>

        <section>
          <h3>어디에 쓰나요</h3>
          <p>로그인과 내 자료를 저장·보여주는 데만 씁니다. 광고, 분석, 다른 서비스로 보내는 데 쓰지 않아요.</p>
        </section>

        <section>
          <h3>언제까지 보관하나요</h3>
          <p>
            탈퇴할 때까지 보관하고, <b>회원 탈퇴</b>를 하면 계정과 모든 자료를 바로 삭제해요. 삭제한 자료는 되돌릴 수 없어요.
          </p>
          <p className="muted small">
            GitHub 쪽 연결도 끊으려면 GitHub → Settings → Applications → Authorized OAuth Apps 에서 이 앱의 권한을 취소하세요.
          </p>
        </section>

        <section>
          <h3>처리 위탁 및 국외 이전</h3>
          <p>
            서비스 운영을 위해 아래 업체에 개인정보 처리를 맡기고 있어요. 서비스를 이용하는 동안 인터넷으로 전송되며, 탈퇴하면 함께
            삭제돼요.
          </p>
          <ul>
            <li>
              <b>Supabase Inc.</b> (미국 / 서버: 대한민국 서울): 계정 정보와 학습 자료 저장, 로그인 처리
            </li>
            <li>
              <b>Vercel Inc.</b> (미국): 웹사이트 제공, 접속 기록 처리
            </li>
          </ul>
          <p className="muted small">
            이전을 원하지 않으면 서비스를 이용하지 않거나 탈퇴할 수 있어요. 이 업체들 없이는 서비스를 제공할 수 없어요. 각 업체의
            개인정보 처리 방식:{' '}
            <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">
              Supabase
            </a>{' '}
            ·{' '}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">
              Vercel
            </a>
          </p>
        </section>

        <section>
          <h3>어떻게 보호하나요</h3>
          <p>
            각 사용자의 자료는 본인만 읽고 쓸 수 있도록 데이터베이스 권한(RLS)으로 분리돼 있어요. 운영자는 장애 대응이나 문의·삭제
            요청 처리 외에는 자료를 열람하지 않아요.
          </p>
        </section>

        <section>
          <h3>내 권리</h3>
          <p>
            자료는 앱에서 언제든 직접 보고, 고치고, 삭제할 수 있어요. 계정 삭제는 사이드바 아래 <b>회원 탈퇴</b>에서 할 수 있어요.
            만 14세 미만은 가입할 수 없어요.
          </p>
        </section>

        <section>
          <h3>문의</h3>
          <p>
            개인정보 관련 문의, 열람·삭제 요청:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </section>

        <section>
          <h3>주의</h3>
          <p className="muted small">
            개인 학습용으로 운영하는 무료 서비스예요. 비밀번호, 주민번호, 회사 기밀 같은 민감한 정보는 노트에 적지 마세요. 중요한
            자료는 <b>가져오기 → JSON 내보내기</b>로 따로 백업해 두는 걸 권해요.
          </p>
        </section>

        <p className="muted small">시행일: {EFFECTIVE_DATE}</p>

        <div className="row end">
          <span className="spacer" />
          <button className="primary" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
