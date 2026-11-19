const INTERVIEW_CARDS = `Q: 트랜잭션과 ACID에 대해 설명해 주세요.
A: 트랜잭션은 여러 작업을 하나로 묶어 전부 성공하거나 전부 취소되게 하는 단위입니다. 이를 위해 원자성, 일관성, 격리성, 지속성을 보장하고, 계좌이체처럼 중간에 실패하면 안 되는 작업에 꼭 필요합니다.
꼬리: 원자성은 DB가 어떻게 보장하나요? (Undo 로그에 변경 전 값을 남겨 두고 실패 시 되돌림)
꼬리: 지속성은 어떻게 보장하나요? (커밋 전에 Redo 로그(WAL)를 디스크에 먼저 기록해 장애 후 복구)
태그: 트랜잭션, DB
난이도: 면접

Q: 트랜잭션 격리 수준에 대해 설명해 주세요.
A: 동시에 실행되는 트랜잭션이 서로의 데이터를 얼마나 볼 수 있는지 정하는 기준입니다. READ UNCOMMITTED부터 SERIALIZABLE까지 네 단계가 있고, 높을수록 안전하지만 동시성이 떨어집니다. MySQL은 기본으로 REPEATABLE READ를 씁니다.
꼬리: 각 단계에서 막히는 문제는? (RC는 Dirty Read, RR은 Non-Repeatable Read까지, SERIALIZABLE은 Phantom Read까지 막음)
꼬리: MySQL REPEATABLE READ에서 팬텀 리드가 생기나요? (일반 SELECT는 MVCC 스냅샷, 잠금 읽기는 넥스트 키 락으로 대부분 막힘)
꼬리: 실무에서는 어떤 수준을 쓰나요? (대부분 기본값을 쓰고, 정합성이 중요한 구간만 락 등으로 보완)
태그: 트랜잭션, DB, 격리수준
난이도: 면접

Q: 스프링 @Transactional은 어떻게 동작하나요?
A: 스프링 AOP 프록시가 메서드 호출을 가로채 트랜잭션을 시작하고, 정상 종료면 커밋, 런타임 예외면 롤백합니다. 그래서 프록시를 거치지 않는 호출에는 적용되지 않는다는 점을 주의해야 합니다.
꼬리: 같은 클래스 안에서 호출하면? (self-invocation이라 프록시를 거치지 않아 적용 안 됨, 클래스를 분리해서 해결)
꼬리: 체크 예외가 나면 롤백되나요? (기본은 롤백 안 됨, rollbackFor로 지정)
꼬리: readOnly = true의 효과는? (JPA 플러시와 더티 체킹 생략, 읽기 전용 DB로 라우팅 가능)
태그: 트랜잭션, Spring
난이도: 면접

Q: 트랜잭션 전파 속성 REQUIRED와 REQUIRES_NEW의 차이는?
A: REQUIRED는 기존 트랜잭션에 참여하고, REQUIRES_NEW는 기존 것을 잠시 멈추고 새 트랜잭션을 만듭니다. 그래서 실패 로그처럼 본 작업이 롤백돼도 남겨야 하는 작업에 REQUIRES_NEW를 씁니다.
꼬리: REQUIRED에서 안쪽 예외를 바깥에서 catch하면? (rollback-only가 표시돼 커밋 시 UnexpectedRollbackException 발생)
꼬리: REQUIRES_NEW를 쓸 때 주의점은? (커넥션을 하나 더 쓰므로 커넥션 풀 고갈과 데드락 주의)
태그: 트랜잭션, Spring
난이도: 면접

Q: 낙관적 락과 비관적 락은 언제 쓰나요?
A: 충돌이 잦으면 조회 시점에 미리 잠그는 비관적 락, 충돌이 드물면 버전으로 수정 시점에 충돌을 감지하는 낙관적 락을 씁니다. 낙관적 락은 실패했을 때 재시도 처리가 필요합니다.
꼬리: JPA에서 각각 어떻게 쓰나요? (낙관적은 @Version, 비관적은 @Lock(PESSIMISTIC_WRITE)로 SELECT ... FOR UPDATE)
꼬리: 데드락은 어떻게 예방하나요? (잠금 순서 통일, 트랜잭션을 짧게, 락 타임아웃 설정)
태그: 트랜잭션, DB, 동시성
난이도: 면접`;

const ADVANCED_CARDS = `Q: MVCC는 어떻게 동작하나요?
A: 데이터를 수정할 때 이전 버전을 Undo 로그에 남겨 두고, 각 트랜잭션은 자기 스냅샷 기준으로 보이는 버전을 읽습니다.
그래서 읽기는 쓰기를 기다리지 않고, 쓰기도 읽기를 막지 않아 동시성이 높아집니다.
InnoDB는 각 행에 마지막으로 수정한 트랜잭션 ID와 Undo 로그 포인터를 두고, Read View로 어떤 버전이 보이는지 판단합니다.
태그: 트랜잭션, DB, MVCC
난이도: 심화

Q: READ COMMITTED와 REPEATABLE READ에서 MVCC 스냅샷은 어떻게 다르게 만들어지나요?
A: READ COMMITTED는 SELECT를 실행할 때마다 새 Read View를 만들어서, 그 사이 다른 트랜잭션이 커밋한 변경이 보입니다.
REPEATABLE READ는 트랜잭션의 첫 SELECT 시점에 만든 Read View를 끝까지 재사용해서, 같은 조회를 반복해도 결과가 유지됩니다.
태그: 트랜잭션, DB, MVCC, 격리수준
난이도: 심화

Q: InnoDB의 넥스트 키 락은 무엇이고 왜 필요한가요?
A: 레코드 락과 그 앞의 간격(갭)을 함께 잠그는 락입니다.
잠금 읽기(SELECT ... FOR UPDATE)나 수정 시 조건 범위 사이에 새 행이 끼어드는 것을 막아, REPEATABLE READ에서도 팬텀 리드를 방지합니다.
대신 잠그는 범위가 넓어지면 동시성이 떨어지고 데드락이 생기기 쉽습니다.
태그: 트랜잭션, DB, 락
난이도: 심화

Q: 커밋된 데이터는 장애가 나도 어떻게 살아남나요?
A: 데이터 페이지를 바로 디스크에 쓰는 대신, 변경 내용을 Redo 로그에 먼저 순차적으로 기록하고 그 로그가 디스크에 저장되면 커밋 완료로 봅니다(Write-Ahead Logging).
장애 후 재시작하면 Redo 로그를 재생해 커밋된 변경을 복구하고, Undo 로그로 커밋되지 않은 변경은 되돌립니다.
태그: 트랜잭션, DB
난이도: 심화`;

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
export const SAMPLE_CONCEPT = `${CONCEPT_NOTE}\n\n===카드===\n${BASIC_CARDS}\n\n${ADVANCED_CARDS}\n\n${INTERVIEW_CARDS}`;

/** 카드만 (가져오기 탭 예시) */
export const SAMPLE_TEXT = `${BASIC_CARDS}\n\n${ADVANCED_CARDS}\n\n${INTERVIEW_CARDS}`;
