/** 개인정보 안내 (로그인 화면·사이드바에서 열기) */
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
          </ul>
          <p className="muted small">비밀번호는 받지 않아요. 로그인은 GitHub가 처리합니다.</p>
        </section>

        <section>
          <h3>어디에 쓰나요</h3>
          <p>로그인과 내 자료를 저장·보여주는 데만 씁니다. 광고, 분석, 다른 서비스로 보내는 데 쓰지 않아요.</p>
        </section>

        <section>
          <h3>어디에 보관되나요</h3>
          <ul>
            <li>
              <b>Supabase</b> (서울 리전): 데이터베이스와 로그인
            </li>
            <li>
              <b>Vercel</b>: 웹사이트 호스팅 (학습 자료는 저장하지 않음)
            </li>
          </ul>
          <p className="muted small">
            각 사용자의 자료는 본인만 읽고 쓸 수 있도록 데이터베이스 권한(RLS)으로 분리돼 있어요. 다만 서비스 운영자는 관리
            목적으로 데이터베이스에 접근할 수 있어요.
          </p>
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
          <h3>주의</h3>
          <p className="muted small">
            개인 학습용으로 운영하는 무료 서비스예요. 비밀번호, 주민번호, 회사 기밀 같은 민감한 정보는 노트에 적지 마세요. 중요한
            자료는 <b>가져오기 → JSON 내보내기</b>로 따로 백업해 두는 걸 권해요.
          </p>
        </section>

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
