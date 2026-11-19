# 트랜잭션 탐색기

두 트랜잭션의 재고 갱신, 교착 상태, 격리 수준을 따라가는 한국어 학습 앱입니다. 왼쪽 레슨 목록(`shared/lesson-rail.js`, 1280px 미만에서는 상단 "레슨" 키로 여는 서랍)에서 네 레슨을 고릅니다.

| 레슨 | 주소 | 비교하는 두 조건 |
| --- | --- | --- |
| 01 갱신 유실 | `/transaction/` | 일반 SELECT · SELECT FOR UPDATE |
| 02 교착 상태 | `/transaction/deadlock.html` | 반대 잠금 순서 · 같은 잠금 순서 |
| 03 직렬화 오류 | `/transaction/?lesson=repeatable-read` | READ COMMITTED · REPEATABLE READ |
| 04 쓰기 왜곡 | `/transaction/?lesson=write-skew` | REPEATABLE READ · SERIALIZABLE |

레슨마다 학습 진도를 따로 저장합니다(`transaction`, `transaction:deadlock`, `transaction:repeatable-read`, `transaction:write-skew`). 각 레슨의 정리는 다음 레슨으로, 04는 다음 실험(디스크 스케줄링)으로 이어집니다.

## 실행

이 탐색기는 [탐색기 모음](../README.md)의 한 페이지입니다. 저장소 루트에서 `npm run dev`를 실행한 뒤 <http://127.0.0.1:5173/transaction/>을 엽니다. 교착 상태 시나리오는 `/transaction/deadlock.html`입니다. 검사는 루트의 `npm test`로 모든 탐색기를 함께 실행합니다.

## 01 갱신 유실

PostgreSQL의 `READ COMMITTED`에서 재고 한 행의 초기 값은 10입니다. 두 트랜잭션은 각각 **읽기 → 앱에서 1 감소 → 계산한 숫자로 UPDATE → COMMIT**을 수행합니다.

| 읽는 방법         | T2가 읽은 값 | T2가 쓴 값 | 최종 재고 | 반영된 감소    |
| ----------------- | -----------: | ---------: | --------: | -------------- |
| 일반 SELECT       |           10 |          9 |         9 | 두 번 중 한 번 |
| SELECT FOR UPDATE |            9 |          8 |         8 | 두 번 모두     |

두 실행 모두 11개 사건이며, UPDATE는 두 방식에서 모두 행 잠금을 얻어 커밋까지 유지합니다. 일반 SELECT 실행에서는 T2가 UPDATE를 기다려도 이미 앱에 저장한 9가 자동으로 다시 계산되지 않습니다. FOR UPDATE 실행에서는 T2의 읽기가 먼저 대기하고, T1이 커밋한 9를 읽어 8을 계산합니다.

학습 화면은 SQL 요청과 응답의 이동, 클라이언트가 기억하는 값, DB의 미확정 쓰기와 확정 재고, 잠금 소유자와 대기자를 함께 보여 줍니다. 주문 카드의 잠금 상태와 DB 앞에 멈춘 SQL로 보유·대기·재개를 구분합니다. 커밋 요청이 도착하면 재고 확정과 잠금 해제를 동시에 적용하고, 직전·현재 값으로 변화를 강조합니다. T2의 잠금 획득은 다음 재개 사건에서 일어납니다.

두 페이지 모두 공통 학습 흐름(목표 → 관찰 → 예측 → 확인 → 설명 → 비교 → 정리, `shared/lesson-kit.js`)을 따릅니다. 핵심 장면 정지, 현재 사건 다시 보기, 사건 이동, T1 커밋 직후의 최종 재고 예측, 두 방식 비교, 마지막 사건의 정리(핵심 정리·확인 문제·학습 진도)를 지원합니다. 두 방식 모두 11개 사건을 진행합니다. 각 트랜잭션이 보낸 BEGIN·SELECT·UPDATE·COMMIT은 총 8건, 앱 계산은 2건, 대기 중이던 SQL의 재개는 1건입니다. 사건 기록에서 일반 SELECT의 10번 쓰기 재개는 8번 UPDATE 요청으로, 읽기부터 잠그는 방식의 8번 읽기 재개는 4번 SELECT FOR UPDATE 요청으로 연결됩니다.

## 모델의 범위

- 실제 데이터베이스에 연결하지 않는 고정 사건 시뮬레이션입니다. 애니메이션 길이는 DB 지연이나 성능 측정값이 아닙니다.
- 재고 갱신 시나리오는 한 행과 트랜잭션 두 개에 집중합니다. 교착 상태 시나리오는 별도 화면에서 두 행을 다룹니다. 잠금 승격은 다루지 않습니다. 다른 격리 수준은 레슨 03·04에서 다룹니다.
- 일반 SELECT는 다른 트랜잭션의 미확정 값을 읽지 않습니다. 쓰기 잠금이 있다고 일반 SELECT까지 모두 막힌다는 뜻은 아닙니다.
- `SET stock = stock - 1`처럼 DB에서 한 문장으로 감소시키는 방식은 이 실험의 앱 계산 후 리터럴 UPDATE와 다릅니다. FOR UPDATE가 모든 재고 변경에 필수라는 결론을 뜻하지 않습니다.
- 화면의 버전 번호는 확정 이력을 설명하기 위한 번호이며 PostgreSQL의 실제 트랜잭션 ID가 아닙니다.

## 02 교착 상태와 롤백

레슨 목록 또는 `http://127.0.0.1:5173/transaction/deadlock.html`에서 엽니다. 두 페이지 모두 프로덕션 빌드에 포함됩니다.

T1은 A→B, T2는 B→A 순서로 `stock = stock - 1`을 실행합니다. A의 초기 확정 값은 10, B는 20입니다. 첫 행을 각각 잠근 뒤 상대가 가진 행을 요청하면 T1→T2→T1의 순환 대기가 생깁니다.

10개 사건으로 시작·첫 쓰기·대기·감지·롤백·재개·커밋을 관찰합니다. DB가 T2를 중단하면 T2의 B 미확정 19와 B 잠금, A에 걸린 대기가 함께 사라집니다. T1의 A 미확정 9와 A 잠금은 남습니다. B의 확정 값은 롤백 전후 모두 20이며, 다음 사건에서 T1이 대기하던 쓰기를 재개합니다. 마지막에 T1만 커밋하여 A 9·B 19가 됩니다.

T2 롤백 직후에는 "T1의 B UPDATE가 재개되면 B의 미확정 값은?"을 예측합니다(정답 19: 버려진 T2의 19가 아니라 확정 20에서 다시 평가한 T1의 값). 비교에서는 같은 입력을 두 트랜잭션 모두 A→B 순서로 잠그는 실행과 나란히 봅니다. 이때 T2는 아무 잠금 없이 A에서 기다렸다가 진행하며, 교착 없이 A 8·B 18, 커밋 2회로 끝납니다.

중단 대상을 T2로 고정하고 감지·정리·재개를 분리한 것은 관찰을 위한 구성입니다. 실제 PostgreSQL의 중단 대상 선택이나 감지 시간을 재현하지 않습니다. T2의 오류 처리·실패한 트랜잭션 블록 정리와 전체 트랜잭션 재시도는 앱의 몫이며, 이 시나리오에서는 재시도하지 않습니다.

## 03 직렬화 오류 (REPEATABLE READ)

질문: "더 강한 격리 수준이면 그냥 기다렸다 처리될까?" 재고 10에서 두 트랜잭션이 BEGIN → SELECT → `UPDATE inventory SET stock = stock - 1 WHERE id = 1` → COMMIT을 실행하고, T2의 UPDATE는 T1의 행 잠금을 기다립니다.

| 격리 수준 | T1 커밋 뒤 T2의 UPDATE | T2 시도 | 최종 재고 | 사건 |
| --- | --- | ---: | ---: | ---: |
| READ COMMITTED | 새 버전 9에서 WHERE와 SET을 다시 평가해 8 | 1 | 8 | 9 |
| REPEATABLE READ | `ERROR: could not serialize access due to concurrent update` (40001) → ROLLBACK → 재시도: 새 스냅숏에서 9를 읽고 8 | 2 | 8 | 13 |

REPEATABLE READ의 스냅숏은 BEGIN이 아니라 첫 문장에서 잡힙니다(PostgreSQL 문서 13.2.2). 예측은 T1 커밋 직후(다시 평가 / 10 기준 9 / 40001)와, REPEATABLE READ에서 재시도 BEGIN 직후(다시 읽을 재고 10 / 9 / 8) 두 번입니다.

## 04 쓰기 왜곡 (SERIALIZABLE)

질문: "둘 다 확인했는데, 당직이 0명이 될 수 있을까?" 의사 A·B가 모두 당직이고 규칙은 최소 1명입니다. 각 트랜잭션은 `SELECT count(*) FROM doctors WHERE on_call` → 2명 이상이면 `UPDATE doctors SET on_call = false WHERE name = 'A'`(T2는 'B') → COMMIT.

| 격리 수준 | 결과 | 당직 |
| --- | --- | ---: |
| REPEATABLE READ | 서로 다른 행이라 대기도 오류도 없이 둘 다 커밋 | 0 |
| SERIALIZABLE | T1 커밋 뒤 T2의 COMMIT이 `could not serialize access due to read/write dependencies among transactions` (40001)로 실패 → 재시도에서 1명을 보고 남음 | 1 |

SSI 검사는 두 트랜잭션 사이의 읽기·쓰기 의존 순환만 보는 단순 모델입니다. 실제 PostgreSQL은 실행 순서에 따라 다른 문장에서 중단할 수도 있습니다.

## 구현과 근거

`src/engine.js`가 사건별 상태를 계산하고, `src/lesson.js`가 해설·예측·학습 근거를 제공합니다. `src/presentation.js`는 요청·DB 처리·응답 완료 시점의 표시 상태를 계산합니다. DB 변경은 함께 반영하고 앱이 읽은 값은 응답 도착 뒤 갱신합니다. `src/scene.js`는 취소와 일시정지가 가능한 이동 애니메이션을, `src/lost-update-main.js`는 재생 및 기록 화면을 담당합니다. `src/main.js`는 `?lesson=`에 따라 레슨 01 또는 03·04를 시작하고, 레슨 목록은 `src/lessons.js`에 있습니다. 로컬 Pretendard와 자체 SVG 장치를 사용합니다.

엔진과 학습 검사는 Node의 기본 테스트 러너로 실행합니다. 외부 브라우저 테스트 프레임워크는 포함하지 않습니다.

교착 상태의 계산·시점별 표시 상태는 `src/deadlock-engine.js`, 해설은 `src/deadlock-lesson.js`, 장면과 재생 화면은 `src/deadlock-scene.js`와 `src/deadlock-main.js`에 분리되어 있습니다.

- [PostgreSQL: Read Committed Isolation Level](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)
- [PostgreSQL: Row-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)
- [PostgreSQL: Deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS)
- [PostgreSQL: Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)

격리 수준 레슨(03·04)은 `src/isolation-engine.js`(스냅숏·버전·행 잠금·40001 모델), `src/isolation-lesson.js`(해설·예측·비교·정리), `src/isolation-scene.js`, `src/isolation-main.js`로 구성되며, 검사는 `test/isolation.test.js`입니다.
