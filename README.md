# 면접 노트

**개념 노트(기초) → 기초 확인 카드 → 면접 카드** 순서로 공부하고, 답을 가린 채 **복습**하는 개인용 웹앱.

- 스택: Vite + React + TypeScript / Supabase(DB·로그인) / Vercel(배포)
- Supabase 환경변수가 없으면 **로컬 모드**(이 브라우저 localStorage에만 저장)로 동작

## 쓰는 법

### 새 주제 공부 (개념 탭)
1. **개념 → + 새 개념** → "개념 정리 프롬프트 복사" → 주제만 바꿔 GPT에 보내기
2. GPT 답변 **전체**를 본문에 붙여넣고 저장
   - `===카드===` 위는 개념 노트(마크다운), 아래는 이 노트에 연결된 카드로 자동 생성
3. 노트를 읽고 → **이 개념 복습**으로 기초 카드부터 확인
4. 면접 카드는 **답변을 내 말로 고치고**, "내 프로젝트와 연결" 칸 채우기 (가장 중요)

### 복습
질문 보고 소리 내어 답 → 답 보기 → 상/중/하 평가.
**기초 → 면접**, 자신감 **하 → 중 → 상**, 오래 안 본 카드 순으로 출제. 답을 펼치면 연결된 개념 노트를 바로 다시 볼 수 있음.

### 카드 형식 (가져오기 탭 / `===카드===` 아래)

```
Q: 질문
A: 답변 (여러 줄 가능)
꼬리: 꼬리질문 (여러 개 가능)
프로젝트: 내 프로젝트에서 쓴 곳
태그: 트랜잭션, DB
난이도: 기초 | 심화 | 면접   (기초·심화 = 개념 카드, 면접 = 30초 답변 카드)
자신감: 상 | 중 | 하
```

## 로컬 실행

```bash
npm install
npm run dev
```

## Supabase 설정 (1회)

1. https://supabase.com 에서 새 프로젝트 생성 (Region: Northeast Asia (Seoul))
2. **SQL Editor** → `supabase/schema.sql` 전체 붙여넣고 **Run** (여러 번 실행해도 안전, 업데이트 후 다시 실행)
3. **Project Settings → API**(또는 API Keys)에서 `Project URL`, `anon`(publishable) 키 복사
4. 프로젝트 루트에 `.env.local` 생성 (`.env.example` 참고)

   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

5. `npm run dev` → 회원가입 → 로그인
   - 혼자 쓸 거라면 **Authentication → Sign In / Providers → Email → Confirm email** 을 꺼두면 메일 확인 없이 바로 로그인됨
   - 내 계정을 만든 뒤 **Allow new users to sign up** 을 꺼두면 다른 사람이 가입할 수 없음

> anon 키는 브라우저에 노출되는 공개 키라 괜찮습니다. 데이터는 RLS 정책으로 본인 것만 접근됩니다.
> `service_role` 키는 절대 넣지 마세요.

## Vercel 배포

- 운영 주소: https://interview-notes-wheat.vercel.app (Vercel 팀 `jh-k`, 프로젝트 `interview-notes`)
- 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 는 Vercel 프로젝트에 설정되어 있음
- **GitHub 자동 배포 연결됨**: `main` 에 push 하면 운영에 자동 배포, 다른 브랜치는 미리보기 배포
- 급할 때 수동 배포:

  ```bash
  npx vercel deploy --prod --scope jh-k
  ```
- Supabase **Authentication → URL Configuration**
  - Site URL: 운영 주소
  - Redirect URLs: 운영 주소, `http://localhost:5173`

## 구조

```
src/
  types.ts                 Card, Note 타입
  repo/Store.ts            저장소 인터페이스 (cards, notes)
  repo/localRepo.ts        localStorage 구현
  repo/supabaseRepo.ts     Supabase 구현
  lib/parse.ts             붙여넣기 → 노트/카드 변환, GPT 프롬프트
  lib/samples.ts           트랜잭션 예시 (개념 노트 + 기초·면접 카드)
  components/              NotesView, NoteEditor, CardList, CardEditor, Review, ImportPanel ...
supabase/schema.sql        notes, cards 테이블 + RLS
```
