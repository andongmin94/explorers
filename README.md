# 탐색기 모음

프로토콜, CPU 스케줄링, 메모리, 트랜잭션, 디스크 스케줄링, Git 탐색기를 하나의 Vite 프로젝트로 묶었습니다. 화면 왼쪽 위의 탐색기 이름을 눌러 주제를 바꿀 수 있습니다.

바로 보기: <https://explorers.andongmin.com/>. 여섯 탐색기 모두 React 19 + TypeScript + Tailwind CSS v4 + UI SDK(`@ui-sdk/react`) 페이지입니다. 탐색기를 추가하거나 고치는 방법은 [docs/REACT-PORT.md](docs/REACT-PORT.md)에 있습니다.

| 탐색기 | 주소 | 폴더 |
| --- | --- | --- |
| 프로토콜 탐색기 | `/protocol/` | [protocol](protocol/README.md) |
| CPU 스케줄링 탐색기 | `/cpu/` | [cpu](cpu/README.md) |
| 메모리 탐색기 | `/memory/` | [memory](memory/README.md) |
| 트랜잭션 탐색기 | `/transaction/`, `/transaction/deadlock.html` | [transaction](transaction/README.md) |
| 디스크 스케줄링 탐색기 | `/disk/` | [disk](disk/README.md) |
| Git 탐색기 | `/git/` | [git](git/README.md) |

## 실행

Node.js 24 이상이 필요합니다.

```sh
npm install
npm run dev
```

<http://127.0.0.1:5173/>에서 프로토콜 탐색기로 시작합니다. 개발 서버에서는 모든 탐색기의 수정 사항이 바로 반영됩니다.

```sh
npm run lint                    # oxlint --deny-warnings + oxfmt --check
npm run format                  # oxlint --fix + oxfmt --write
npm run typecheck               # tsc --noEmit
npm test                        # tsx --test: src/**/*.test.ts
npm run build                   # dist/에 통합본
npm run preview                 # dist/를 http://127.0.0.1:4173/에서 열기
npm run test:browser            # Playwright 브라우저 검사(tests/*.spec.ts, 설치된 Chrome)
npm run check:scroll -- cpu/    # 데스크톱 콘솔에 스크롤이 없는지(개발 서버 필요)
npm run deploy:cloudflare       # dist/를 Cloudflare Workers에 직접 배포(wrangler deploy)
```

`npm test`는 여섯 탐색기와 공통 도구의 검사를 모두 실행합니다. `npm run test:browser`는 자체 개발 서버(5199번 포트)를 띄워 데스크톱(1440×900)과 휴대폰(390×844) 크기에서 확인합니다. `check:scroll`은 `--sizes=1100x700,1280x720,…`, `--steps=N`, `--base=http://127.0.0.1:<포트>`를 받습니다.

## 구조

- `src/components/ui/`: UI SDK + Tailwind 부품(버튼, 세그먼트, 스위치, 슬라이더, 탭, 표, 시트, 메뉴, 글자 역할, 태그·읽음값·노트 같은 내용 부품)
- `src/components/shell/`: 탐색기 화면의 틀. 페이지(`page.tsx`), 툴바와 탐색기 전환 메뉴·테마 키(`toolbar.tsx`), 레슨 레일(`lesson-rail.tsx`), 콘솔 격자·무대·조작 팔레트·학습 패널·기록·바닥글(`console.tsx`), 그룹 틀(`plate.tsx`)
- `src/components/learning/`: 공통 학습 부품. 쪽 나눔(`pager.tsx`), 정리·확인 문제·학습 진도(`recap.tsx`), 예측 시트(`prediction.tsx`), 두 방식 비교 시트(`comparison.tsx`)
- `src/lib/`: 탐색기 목록(`explorers.ts`), 학습 문구와 진도(`lesson-kit.ts`), 레슨 주소와 진도 id(`lesson-rail.ts`), 쪽 나눔·행 창(`fit.ts`), 조사(`josa.ts`), 테마(`theme.ts`), Liquid Glass 굴절 필터(`glass.ts`), `cn()`, 미디어 쿼리
- `src/lib/iso/`: 모든 장면이 같은 투영·빛·축척으로 그리는 아이소메트릭 도구(`kit.ts`)와 장치 면·재질 그라데이션(`defs.ts`의 `mountIsoDefs()`)
- `src/styles/`: `tokens.css`(색·유리 재질·장면 토큰, 밝은·어두운 테마, `<html data-explorer>`별 강조색), `app.css`(Tailwind v4 테마, 레이아웃 조건, 유리·콘솔 유틸리티)
- `src/explorers/<탐색기>/`: 탐색기마다 엔진·레슨·장면·화면·검사(`test/*.test.ts`). 파일 목록은 각 폴더의 README에 있습니다.
- `<탐색기>/index.html`(+ `transaction/deadlock.html`): 페이지 진입점. 테마를 먼저 적용하고 `src/explorers/<탐색기>/main.tsx`를 불러옵니다. `index.html`은 `/protocol/`로 보내고, `404.html`은 없는 주소에 쓰입니다.
- `public/fonts/`: 고정폭 Iosevka 글꼴과 Pretendard 라이선스. 본문 글꼴 Pretendard Variable은 npm `pretendard` 패키지에서 불러옵니다.
- `public/protocol/`, `public/cpu/`: 그 탐색기만 쓰는 아이콘과 공유 이미지
- `tests/*.spec.ts`: Playwright 브라우저 검사. `scripts/check-scroll.mjs`: 스크롤 검사
- `docs/DESIGN.md`: 모든 탐색기 화면이 따르는 설계 규칙(두 층, 콘솔 배치, 스크롤 없음, 학습 모델, 레슨 레일, 장면 규칙). `docs/LIQUID-GLASS.md`: Apple UI 키트에서 읽은 수치. `docs/QUALITY.md`: 통합 이전 탐색기 모음(explorer-hub)의 품질 확인 기록

통합 이전 각 탐색기의 Git 이력은 그 폴더 아래로 합쳐져 있어 `git log -- cpu/`처럼 폴더별로 볼 수 있습니다. React로 옮긴 뒤의 소스 이력은 `git log -- src/explorers/cpu/`로 봅니다.

## 배포

`main`에 push하면 이 저장소에 연결된 Cloudflare Workers Builds가 `npm run build`로 빌드하고 `wrangler.jsonc` 설정대로 `dist/`를 정적 자산으로 배포합니다. 사용자 지정 도메인은 `explorers.andongmin.com`입니다.

- `wrangler.jsonc`: 자산 폴더 `./dist`, `html_handling: "auto-trailing-slash"`(`/cpu` → `/cpu/`), `not_found_handling: "404-page"`(`404.html`), 사용자 지정 도메인 경로
- 직접 배포할 때는 `npm run build && npm run deploy:cloudflare`
- `.github/workflows/ci.yml`은 배포하지 않고 push와 pull request마다 lint, typecheck, test, build, 브라우저 검사를 실행합니다.
