# Git 탐색기

로컬 저장소 하나에서 브랜치를 나누고 다시 합치는 네 가지 방법(fast-forward, 3-way 자동 병합, 충돌 해결, rebase)을 레슨 네 개로 따라가는 한국어 학습 앱입니다.

## 실행

이 탐색기는 [탐색기 모음](../README.md)의 한 페이지입니다(React 19 + TypeScript + Tailwind CSS v4 + Base UI, `docs/REACT-PORT.md`). 저장소 루트에서 `npm run dev`를 실행한 뒤 <http://127.0.0.1:5173/git/>을 엽니다. 검사는 루트의 `npm test`로 모든 탐색기를 함께 실행합니다.

## 레슨

왼쪽 레슨 목록(1280px 미만에서는 상단 "레슨" 키로 여는 서랍)에서 고릅니다. 레슨마다 주소가 다르고(`?lesson=<id>`, 첫 레슨은 `/git/`), 진도도 레슨마다 따로 저장됩니다.

| # | id | 질문 | 두 조건(두 방식 비교) |
|---|----|------|------|
| 01 | `fast-forward` (`/git/`) | 갈라지지 않았으면 병합 커밋이 생길까? | `git merge`(main만 C1으로 이동, 새 커밋 없음) vs `git merge --no-ff`(부모 C0 + C1의 병합 커밋 C2) |
| 02 | `auto-merge` | 서로 다른 줄을 고쳤다면 Git이 혼자 합칠 수 있을까? | 공통 조상 C0와 함께 비교(3-way, 자동으로 C3) vs 두 끝만 비교(생각 실험: 바뀐 두 줄 모두 결정 불가) |
| 03 | `conflict` | 두 브랜치가 같은 줄을 고치면 Git은 어떻게 할까? | 세 해결안(두 의도 합치기 · main 문장 유지 · feature/title 문장 선택), `해결안 비교` |
| 04 | `rebase` | 병합 커밋 없이 갈라진 이력을 합칠 수 있을까? | `git rebase main` 후 fast-forward(C1 → C1', 한 줄 이력) vs `git merge`(병합 커밋 C3) |

모든 레슨이 같은 `welcome.txt`와 C0에서 시작합니다. feature/title은 언제나 2번째 줄 제목을 고칩니다. 02와 04에서 main은 4번째 줄 버튼만 고치고, 두 줄 사이의 `출발: 공원 입구`는 그대로라 두 변경이 맞닿지 않습니다. 03에서는 main이 제목과 버튼을 함께 고쳐 제목 줄이 충돌합니다(03의 내용은 이전 단일 레슨과 같습니다).

### 01 Fast-forward (사건 6개)

`git switch -c feature/title` → 제목 수정 → `git add` → C1 커밋 → `git switch main` → 병합. main은 C0에 그대로이므로 `git merge feature/title`은 `Updating C0..C1` / `Fast-forward`를 출력하고 main을 C1으로 옮길 뿐입니다. `--no-ff`는 `Merge made by the 'ort' strategy.`와 함께 C0·C1을 부모로 하는 C2를 만듭니다. 파일 내용은 두 방식이 같습니다. 핵심 장면 3·4·5·6, 예측은 3(커밋 뒤 main의 위치)과 5(병합 커밋이 생길지).

### 02 3-way 자동 병합 (사건 9개)

C1(제목)과 C2(버튼)로 이력이 갈라진 뒤 `git merge feature/title`이 `Auto-merging welcome.txt` / `Merge made by the 'ort' strategy.`를 출력하고 C2 + C1을 부모로 하는 C3를 바로 만듭니다. 두 끝 C2와 C1만 놓고 보면 제목과 버튼 두 줄이 다르고 누가 바꿨는지 알 수 없습니다. C0와 비교해야 줄마다 바뀐 쪽을 고를 수 있습니다. 핵심 장면 4·7·8·9, 예측은 7(두 끝의 차이: 2줄)과 8(병합 결과: 병합 커밋 C3).

### 03 병합 충돌 (사건 12개)

| 사건 | 조작 | 관찰할 변화 |
| ---- | ---- | ---- |
| 0–4 | 브랜치 생성, 제목 수정, `git add`, 커밋 | `나만의 산책을 찾아보세요`를 담은 C1 |
| 5–8 | `git switch main`, 같은 줄과 버튼 수정, 커밋 | `우리 동네를 함께 걸어요`와 `동네 코스 보기`를 담은 C2 |
| 9 | `git merge feature/title` | 버튼 줄은 자동 병합, 제목 줄은 충돌. 새 커밋 없이 main → C2, 인덱스에 stage 1·2·3 |
| 10 | 최종 문장 선택 | 작업 트리의 충돌 표시 제거, `git status`는 여전히 `both modified` |
| 11 | `git add welcome.txt` | stage 0으로 해결 등록, 병합 커밋 대기 |
| 12 | 병합 커밋 | HEAD(C2)·MERGE_HEAD(C1)를 부모로 갖는 C3 |

9번째 사건에서 해결안을 직접 골라야 진행됩니다. 핵심 장면 4·8·9·10·11·12, 예측은 8·10·11.

### 04 Rebase와 Merge (사건 12개, merge는 9개)

02와 같은 갈라진 이력에서 `git switch feature/title` → `git rebase main`(`Successfully rebased and updated refs/heads/feature/title.`) → `git switch main` → `git merge feature/title`(`Updating C2..C1'` / `Fast-forward`). rebase는 C1의 변경을 C2 위에 다시 적용해 새 커밋 C1'(부모 C2)을 만들고, 원래 C1은 어느 브랜치에도 없게 됩니다(장면에서 흐리게 표시). 비교 조건인 merge는 C2 + C1을 부모로 하는 C3를 남깁니다. 최종 파일은 같습니다. 정리에서 이미 push해 남이 받은 커밋은 rebase하지 않는다는 규칙(Pro Git 3.6)을 다룹니다. 핵심 장면 8·9·10·11·12, 예측은 9(rebase 뒤 feature/title → C1')와 11(fast-forward).

## 학습 흐름

모든 탐색기와 같은 순서(목표 → 관찰 → 예측 → 확인 → 설명 → 비교 → 정리)를 따릅니다. 시작 화면은 질문과 학습 목표로 열고, "핵심 장면에서 멈추기"는 장면 탭의 핵심 장면에서 멈춥니다. 예측이 열려 있는 동안에는 해설·터미널·기록 어디에도 답이 나오지 않고, 선택지마다 이유를 보여 줍니다. 상단 `두 방식 비교`(03은 `해결안 비교`)는 같은 입력에 대한 두 조건을 나란히 보여 주고 "이 방식으로 다시 보기"로 갈림길부터 다시 재생합니다. 마지막에는 핵심 정리, 확인 문제, 학습 진도, 다음 레슨 링크(04는 다음 실험)가 나옵니다.

## 화면에서 구분하는 상태

- **작업 트리:** 사람이 지금 수정하는 내용입니다(노트북 화면과 오른쪽 파일 창).
- **인덱스(스테이징):** 다음 커밋에 넣을 내용입니다. 커밋 뒤에는 비워지는 것이 아니라 커밋과 같은 내용을 가집니다. 충돌 중에는 공통 조상(stage 1), 현재 쪽(stage 2), 가져올 쪽(stage 3)의 세 버전을 기록합니다.
- **커밋 이력:** 서버 위의 커밋 그래프입니다. 줄마다 누가 쓴 줄인지(C0 회색, main 파랑, feature 초록, 새로 합친 줄 강조색)를 같은 색으로 표시합니다.

C0–C3, C1'은 읽기 쉬운 학습용 이름이며 실제 Git 해시가 아닙니다(터미널의 `Updating` 줄에도 이 이름을 씁니다). 장치 사이의 내용 이동은 저장 상태의 변화를 설명하는 표현입니다. 원격 저장소·push/pull, 대화형 rebase, 충돌이 나는 rebase는 다루지 않습니다.

## 파일

소스는 `src/explorers/git/`에 있고, 이 폴더에는 진입 페이지 `index.html`만 남습니다.

| 파일 | 내용 |
| ---- | ---- |
| `engine.ts`, `types.ts` | 사건별 독립 상태. `simulateGit`(03), `simulateFastForward`, `simulateAutoMerge`, `simulateRebase`, 줄 색 분류 `lineKinds`, 2-way/3-way 비교 `compareMergeBases` |
| `lessons.ts`, `lesson-model.ts`, `lesson.ts` | 레슨 목록(레일의 `{ id, name, sub }`)과 레슨별 질문·핵심 장면·예측·해설·정리·비교·장면 배치. `lesson-model.ts`는 레슨 데이터를 페이지가 쓰는 모양으로 바꾸고, `lesson.ts`는 03의 해설을 담습니다 |
| `scene.ts`, `git-scene.tsx` | 작업 트리(노트북 화면의 작은 편집기)·인덱스(stage 0–3 트레이)·저장소(서버 위 커밋 그래프) 장면과 이동. 장면은 명령형 SVG이고 React는 호스트만 가집니다 |
| `playback.ts` | 재생 흐름: 사건 이동, 핵심 장면 멈춤, 03의 해결안 관문, 답한 예측, 딥 링크 `?step=N&choice=…`(`&animate`로 그 사건을 재생) |
| `app.tsx`, `deck.tsx`, `side.tsx`, `records.tsx`, `well.tsx`, `prediction.tsx`, `comparison.tsx` | 화면: 툴바·레일·장면 옆 파일 창(작업 트리/인덱스/HEAD 커밋)·재생 조작·해설/장면/변화/범위 탭·사건 기록(전체 사건 기준 고정 열 너비)/커밋 이력/병합 결과·예측·비교 |
| `git.css` | 브랜치 색과 장면 SVG 클래스 |
| `test/*.test.ts` | 아래 검증 |

## 검증

`npx tsx --test "src/explorers/git/**/*.test.ts"`: 33개 테스트로 네 레슨의 브랜치 포인터·부모·인덱스·파일 내용, fast-forward와 `--no-ff`, 3-way 자동 병합과 2-way 생각 실험, rebase의 C1' 생성과 C1 이탈, 터미널 출력, 예측 정답과 모델의 일치, 예측 중 답 숨김, 레슨 순서·다음 레슨 링크·진도 id를 검사합니다.

모든 명령 출력은 별도 임시 저장소에서 git 2.56으로 같은 시나리오를 실행해 확인했습니다: fast-forward(`Updating …` / `Fast-forward` / ` welcome.txt | 2 +-`), `--no-ff`와 자동 병합(`Merge made by the 'ort' strategy.`, 자동 병합은 앞에 `Auto-merging welcome.txt`), rebase(`Rebasing (1/1)` 진행 표시 뒤 `Successfully rebased and updated refs/heads/feature/title.`), 그리고 각 경우의 `git log --graph` 모양.

`node scripts/check-scroll.mjs "git/" "git/?lesson=auto-merge" "git/?lesson=conflict" "git/?lesson=rebase" --sizes=1100x700,1280x720,1440x900,1920x1080 --steps=12`은 모든 레슨에서 `ok`입니다. 브라우저 흐름(키보드, 예측, 03의 해결안 관문, 비교, 정리)은 `tests/git.spec.ts`(`npm run test:browser`)가 확인합니다.

## 학습 근거

- [Pro Git 3.1 — Branches in a Nutshell](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell): 브랜치 포인터, HEAD.
- [Pro Git 3.2 — Basic Branching and Merging](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging): fast-forward, 공통 조상을 쓰는 3-way 병합과 병합 커밋, 충돌 표시와 해결.
- [Pro Git 3.6 — Rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing): rebase의 다시 적용과 한 줄 이력, rebase와 merge의 비교, 공유한 커밋을 rebase하지 않는 규칙.
- [git-merge — Fast-forward merge](https://git-scm.com/docs/git-merge#_fast_forward_merge), [git-merge — True merge](https://git-scm.com/docs/git-merge#_true_merge), [git-add](https://git-scm.com/docs/git-add).
