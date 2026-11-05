# 트랜잭션 탐험가

두 주문의 재고 갱신과 교착 상태를 따라가는 한국어 학습 앱입니다. 프로토콜·CPU·메모리 탐험가와 소스, 의존성, Git 저장소를 분리한 독립 Vite 프로젝트입니다.

## 실행

```sh
npm install
npm run dev
npm test
npm run build
```

개발 주소는 `http://127.0.0.1:5176/`입니다. 포트가 이미 사용 중이면 다른 포트로 옮기지 않고 종료합니다. `npm run preview`는 빌드 결과를 4176번 포트에서 제공합니다.

## 대표 시나리오

PostgreSQL의 `READ COMMITTED`에서 재고 한 행의 초기 값은 10입니다. 두 트랜잭션은 각각 **읽기 → 앱에서 1 감소 → 계산한 숫자로 UPDATE → COMMIT**을 수행합니다.

| 읽는 방법         | T2가 읽은 값 | T2가 쓴 값 | 최종 재고 | 반영된 감소    |
| ----------------- | -----------: | ---------: | --------: | -------------- |
| 일반 SELECT       |           10 |          9 |         9 | 두 번 중 한 번 |
| SELECT FOR UPDATE |            9 |          8 |         8 | 두 번 모두     |

두 실행 모두 11개 사건이며, UPDATE는 두 방식에서 모두 행 잠금을 얻어 커밋까지 유지합니다. 일반 SELECT 실행에서는 T2가 UPDATE를 기다려도 이미 앱에 저장한 9가 자동으로 다시 계산되지 않습니다. FOR UPDATE 실행에서는 T2의 읽기가 먼저 대기하고, T1이 커밋한 9를 읽어 8을 계산합니다.

학습 화면은 SQL 요청과 응답의 이동, 클라이언트가 기억하는 값, DB의 미확정 쓰기와 확정 재고, 잠금 소유자와 대기자를 함께 보여 줍니다. 주문 카드의 잠금 상태와 DB 앞에 멈춘 SQL로 보유·대기·재개를 구분합니다. 커밋 요청이 도착하면 재고 확정과 잠금 해제를 동시에 적용하고, 직전·현재 값으로 변화를 강조합니다. T2의 잠금 획득은 다음 재개 사건에서 일어납니다.

핵심 장면 정지, 현재 사건 다시 보기, 사건 이동, SQL 기록, 다음 사건 예측, 두 결과 비교를 지원합니다. 애니메이션을 멈추면 요청 위치와 현재 DB 상태를 함께 관찰할 수 있습니다.

## 모델의 범위

- 실제 데이터베이스에 연결하지 않는 고정 사건 시뮬레이션입니다. 애니메이션 길이는 DB 지연이나 성능 측정값이 아닙니다.
- 재고 갱신 시나리오는 한 행과 트랜잭션 두 개에 집중합니다. 교착 상태 시나리오는 별도 화면에서 두 행을 다룹니다. 잠금 승격과 다른 격리 수준은 다루지 않습니다.
- 일반 SELECT는 다른 트랜잭션의 미확정 값을 읽지 않습니다. 쓰기 잠금이 있다고 일반 SELECT까지 모두 막힌다는 뜻은 아닙니다.
- `SET stock = stock - 1`처럼 DB에서 한 문장으로 감소시키는 방식은 이 실험의 앱 계산 후 리터럴 UPDATE와 다릅니다. FOR UPDATE가 모든 재고 변경에 필수라는 결론을 뜻하지 않습니다.
- 화면의 버전 번호는 확정 이력을 설명하기 위한 번호이며 PostgreSQL의 실제 트랜잭션 ID가 아닙니다.

## 교착 상태와 롤백

상단 시나리오 메뉴 또는 `http://127.0.0.1:5176/deadlock.html`에서 엽니다. 두 페이지 모두 프로덕션 빌드에 포함됩니다.

T1은 A→B, T2는 B→A 순서로 `stock = stock - 1`을 실행합니다. A의 초기 확정 값은 10, B는 20입니다. 첫 행을 각각 잠근 뒤 상대가 가진 행을 요청하면 T1→T2→T1의 순환 대기가 생깁니다.

10개 사건으로 시작·첫 쓰기·대기·감지·롤백·재개·커밋을 관찰합니다. DB가 T2를 중단하면 T2의 B 미확정 19와 B 잠금, A에 걸린 대기가 함께 사라집니다. T1의 A 미확정 9와 A 잠금은 남습니다. B의 확정 값은 롤백 전후 모두 20이며, 다음 사건에서 T1이 대기하던 쓰기를 재개합니다. 마지막에 T1만 커밋하여 A 9·B 19가 됩니다.

중단 대상을 T2로 고정하고 감지·정리·재개를 분리한 것은 관찰을 위한 구성입니다. 실제 PostgreSQL의 희생자 선택이나 감지 시간을 재현하지 않습니다. T2의 오류 처리·실패한 트랜잭션 블록 정리와 전체 트랜잭션 재시도는 앱의 몫이며, 이 시나리오에서는 재시도하지 않습니다.

## 구현과 근거

`src/engine.js`가 사건별 상태를 계산하고, `src/lesson.js`가 해설·예측·학습 근거를 제공합니다. `src/presentation.js`는 요청·DB 처리·응답 완료 시점의 표시 상태를 계산합니다. DB 변경은 함께 반영하고 앱이 읽은 값은 응답 도착 뒤 갱신합니다. `src/scene.js`는 취소와 일시정지가 가능한 이동 애니메이션을, `src/main.js`는 재생 및 기록 화면을 담당합니다. 로컬 Pretendard와 자체 SVG 장치를 사용합니다.

엔진과 학습 검사는 Node의 기본 테스트 러너로 실행합니다. 외부 브라우저 테스트 프레임워크는 포함하지 않습니다.

교착 상태의 계산·시점별 표시 상태는 `src/deadlock-engine.js`, 해설은 `src/deadlock-lesson.js`, 장면과 재생 화면은 `src/deadlock-scene.js`와 `src/deadlock-main.js`에 분리되어 있습니다.

- [PostgreSQL: Read Committed Isolation Level](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)
- [PostgreSQL: Row-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)
- [PostgreSQL: Deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS)
- [PostgreSQL: Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
