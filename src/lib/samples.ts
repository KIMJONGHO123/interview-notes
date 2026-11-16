const INTERVIEW_CARDS = `Q: 트랜잭션이란 무엇이고, ACID는 각각 무엇을 의미하나요?
A: 트랜잭션은 더 이상 쪼갤 수 없는 작업 단위로, 전부 성공하거나 전부 실패해야 합니다.
원자성은 전부 반영되거나 전부 취소되는 것, 일관성은 제약 조건을 지키는 올바른 상태를 유지하는 것,
격리성은 동시에 실행되는 트랜잭션이 서로 간섭하지 않는 것, 지속성은 커밋된 결과가 장애 후에도 유지되는 것입니다.
꼬리: 원자성은 DB가 어떻게 보장하나요? (Undo 로그로 롤백)
꼬리: 지속성은 어떻게 보장하나요? (Redo 로그 / WAL을 먼저 디스크에 기록)
태그: 트랜잭션, DB
자신감: 중
난이도: 면접

Q: 트랜잭션 격리 수준 4가지와 각각 어떤 문제를 막는지 설명해 주세요.
A: READ UNCOMMITTED는 커밋 전 데이터도 읽어서 Dirty Read가 생깁니다.
READ COMMITTED는 Dirty Read를 막지만 같은 조회 결과가 달라지는 Non-Repeatable Read가 생깁니다.
REPEATABLE READ는 Non-Repeatable Read까지 막고, 표준상 Phantom Read는 생길 수 있습니다.
SERIALIZABLE은 모두 막지만 동시성이 가장 낮습니다. MySQL InnoDB 기본은 REPEATABLE READ, PostgreSQL은 READ COMMITTED입니다.
꼬리: MySQL REPEATABLE READ에서도 팬텀 리드가 생기나요? (일반 SELECT는 MVCC 스냅샷, 잠금 읽기는 넥스트 키 락으로 대부분 방지)
꼬리: MVCC가 무엇인가요? (Undo 로그로 이전 버전을 보여줘 읽기와 쓰기가 서로 막지 않게 함)
태그: 트랜잭션, DB, 격리수준
자신감: 하
난이도: 면접

Q: 스프링 @Transactional은 어떻게 동작하나요?
A: 스프링 AOP 프록시가 메서드 호출을 가로채서 트랜잭션을 시작하고, 정상 종료되면 커밋, 예외가 나면 롤백합니다.
기본적으로 RuntimeException과 Error에서만 롤백하고, 체크 예외는 롤백하지 않아서 필요하면 rollbackFor를 지정합니다.
꼬리: 같은 클래스 안에서 다른 @Transactional 메서드를 호출하면? (프록시를 거치지 않아 적용 안 됨 - self-invocation)
꼬리: private 메서드에 붙이면? (프록시가 가로챌 수 없어 적용 안 됨)
꼬리: readOnly = true는 어떤 효과가 있나요? (JPA 더티 체킹·플러시 생략, 읽기 전용 DB로 라우팅 가능)
태그: 트랜잭션, Spring
자신감: 중
난이도: 면접

Q: 트랜잭션 전파 속성 중 REQUIRED와 REQUIRES_NEW의 차이는?
A: REQUIRED는 기본값으로, 이미 트랜잭션이 있으면 참여하고 없으면 새로 만듭니다.
REQUIRES_NEW는 기존 트랜잭션을 잠시 보류하고 항상 새 트랜잭션을 만들어서, 안쪽 결과가 바깥 롤백과 무관하게 따로 커밋·롤백됩니다.
꼬리: REQUIRED에서 안쪽 메서드 예외를 바깥에서 catch하면? (rollback-only가 표시돼 커밋 시 UnexpectedRollbackException)
꼬리: 실패 로그는 본 작업이 롤백돼도 남기고 싶다면? (로그 저장을 REQUIRES_NEW로 분리)
태그: 트랜잭션, Spring
자신감: 하
난이도: 면접

Q: 낙관적 락과 비관적 락의 차이와 언제 쓰는지 설명해 주세요.
A: 비관적 락은 조회 시점에 SELECT ... FOR UPDATE로 미리 잠가 충돌을 막는 방식으로, 충돌이 잦을 때 적합합니다.
낙관적 락은 버전 컬럼으로 수정 시점에 충돌을 감지하는 방식으로, 충돌이 드물 때 적합하고 실패하면 재시도 처리가 필요합니다.
꼬리: JPA에서 낙관적 락은 어떻게 쓰나요? (@Version 필드, 충돌 시 OptimisticLockException)
꼬리: 데드락은 어떻게 예방하나요? (잠금 순서 통일, 트랜잭션 짧게, 타임아웃)
태그: 트랜잭션, DB, 동시성
자신감: 하
난이도: 면접`;

const CONCEPT_NOTE = `# 트랜잭션 기초

## 한 줄 정의
**트랜잭션**은 "전부 성공하거나, 전부 없던 일이 되어야 하는" 데이터베이스 작업의 묶음입니다.

## 왜 필요한가
A가 B에게 1만 원을 보내는 상황을 생각해 보세요.

1. A 계좌에서 1만 원 빼기
2. B 계좌에 1만 원 더하기

1번만 실행되고 서버가 죽으면 **1만 원이 증발**합니다. 두 작업을 하나로 묶어 "둘 다 반영(커밋)" 또는 "둘 다 취소(롤백)"만 가능하게 만드는 것이 트랜잭션입니다.

## 핵심 개념

### 커밋과 롤백
- **COMMIT**: 트랜잭션 안의 변경을 확정해 DB에 영구 반영
- **ROLLBACK**: 트랜잭션 시작 전 상태로 되돌림

### ACID
| 성질 | 의미 | 계좌이체로 보면 |
|---|---|---|
| 원자성 (Atomicity) | 전부 반영 또는 전부 취소 | 출금만 되고 입금 안 되는 일은 없음 |
| 일관성 (Consistency) | 제약 조건을 지키는 올바른 상태 유지 | 잔액이 음수가 되면 안 된다는 규칙 유지 |
| 격리성 (Isolation) | 동시에 실행돼도 서로 간섭하지 않음 | 두 사람이 동시에 송금해도 잔액이 꼬이지 않음 |
| 지속성 (Durability) | 커밋된 결과는 장애 후에도 유지 | 송금 완료 후 서버가 꺼져도 기록이 남음 |

### 동시에 실행될 때 생기는 문제
| 문제 | 상황 |
|---|---|
| Dirty Read | 다른 트랜잭션이 **커밋하지 않은** 값을 읽음 → 그쪽이 롤백하면 없는 값을 본 셈 |
| Non-Repeatable Read | 같은 행을 두 번 읽었는데 그 사이 다른 트랜잭션이 **수정·커밋**해서 값이 다름 |
| Phantom Read | 같은 조건으로 두 번 조회했는데 그 사이 **행이 추가·삭제**되어 결과 개수가 다름 |

### 격리 수준 (아래로 갈수록 엄격, 동시성은 낮아짐)
| 격리 수준 | Dirty | Non-Repeatable | Phantom |
|---|---|---|---|
| READ UNCOMMITTED | 발생 | 발생 | 발생 |
| READ COMMITTED | 방지 | 발생 | 발생 |
| REPEATABLE READ | 방지 | 방지 | 발생 (표준 기준) |
| SERIALIZABLE | 방지 | 방지 | 방지 |

기본값: MySQL InnoDB는 REPEATABLE READ, PostgreSQL·Oracle은 READ COMMITTED.

## 예시
\`\`\`sql
START TRANSACTION;
UPDATE account SET balance = balance - 10000 WHERE id = 'A';
UPDATE account SET balance = balance + 10000 WHERE id = 'B';
COMMIT;   -- 중간에 오류가 나면 ROLLBACK
\`\`\`

스프링에서는 메서드에 \`@Transactional\`을 붙이면 위 과정을 대신 처리해 줍니다.

## 헷갈리기 쉬운 점
- 격리 수준이 높을수록 무조건 좋은 게 아니라 **안전성과 성능(동시성)의 트레이드오프**입니다.
- Non-Repeatable Read는 **값이 바뀌는 것**, Phantom Read는 **행이 생기거나 사라지는 것**입니다.
- 일관성(C)은 DB 혼자 보장하는 게 아니라 제약 조건과 애플리케이션 로직이 함께 지킵니다.

## 연관 개념
MVCC · 락(공유 락/배타 락) · 데드락 · Undo/Redo 로그 · 스프링 트랜잭션 전파`;

const BASIC_CARDS = `Q: 트랜잭션이란 무엇인가요?
A: 전부 성공하거나 전부 취소되어야 하는 DB 작업의 묶음입니다.
태그: 트랜잭션, DB
난이도: 기초
자신감: 하

Q: 커밋과 롤백은 각각 무엇인가요?
A: 커밋은 트랜잭션의 변경을 확정해 영구 반영하는 것, 롤백은 트랜잭션 시작 전 상태로 되돌리는 것입니다.
태그: 트랜잭션, DB
난이도: 기초
자신감: 하

Q: Dirty Read란 무엇인가요?
A: 다른 트랜잭션이 아직 커밋하지 않은 데이터를 읽는 것입니다. 그 트랜잭션이 롤백하면 존재하지 않는 값을 읽은 셈이 됩니다.
태그: 트랜잭션, 격리수준
난이도: 기초
자신감: 하

Q: Non-Repeatable Read와 Phantom Read의 차이는?
A: Non-Repeatable Read는 같은 행을 다시 읽었을 때 값이 바뀐 것이고, Phantom Read는 같은 조건으로 다시 조회했을 때 행이 새로 생기거나 사라진 것입니다.
태그: 트랜잭션, 격리수준
난이도: 기초
자신감: 하

Q: 격리 수준을 가장 높게(SERIALIZABLE) 하면 안 되는 이유는?
A: 동시에 처리할 수 있는 트랜잭션이 줄어 성능이 크게 떨어지기 때문입니다. 안전성과 동시성의 트레이드오프입니다.
태그: 트랜잭션, 격리수준
난이도: 기초
자신감: 하`;

/** 개념 노트 + 카드 (개념 탭 예시) */
export const SAMPLE_CONCEPT = `${CONCEPT_NOTE}\n\n===카드===\n${BASIC_CARDS}\n\n${INTERVIEW_CARDS}`;

/** 카드만 (가져오기 탭 예시) */
export const SAMPLE_TEXT = `${BASIC_CARDS}\n\n${INTERVIEW_CARDS}`;
