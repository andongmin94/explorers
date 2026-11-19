# 탐색기 모음

프로토콜, CPU 스케줄링, 메모리, 트랜잭션, 디스크 스케줄링, Git 탐색기를 하나의 Vite 프로젝트로 묶었습니다. 화면 왼쪽 위의 탐색기 이름을 눌러 주제를 바꿀 수 있습니다.

| 탐색기 | 주소 | 폴더 |
| --- | --- | --- |
| 프로토콜 탐색기 | `/protocol/` | [protocol](protocol/README.md) |
| CPU 스케줄링 탐색기 | `/cpu/` | [cpu](cpu/README.md) |
| 메모리 탐색기 | `/memory/` | [memory](memory/README.md) |
| 트랜잭션 탐색기 | `/transaction/`, `/transaction/deadlock.html` | [transaction](transaction/README.md) |
| 디스크 스케줄링 탐색기 | `/disk/` | [disk](disk/README.md) |
| Git 탐색기 | `/git/` | [git](git/README.md) |

## 실행

Node.js 22.12 이상이 필요합니다.

```sh
npm install
npm run dev
```

<http://127.0.0.1:5173/>에서 프로토콜 탐색기로 시작합니다. 개발 서버에서는 모든 탐색기의 수정 사항이 바로 반영됩니다.

```sh
npm test
npm run build
npm run preview
```

`npm test`는 여섯 탐색기의 검사를 모두 실행합니다. `npm run build`는 `dist/`에 통합본을 만들고, `npm run preview`는 그 결과를 <http://127.0.0.1:4173/>에서 엽니다. `dist/`를 웹 서버 루트에 올리면 같은 주소 구조로 배포됩니다.

## 구조

- `<탐색기>/index.html`, `src/`, `test/`: 각 탐색기의 페이지, 소스, 검사
- `shared/theme.css`: 하드웨어 테마의 토큰([SPEC-01/HARDWARE](https://spec-01.vercel.app/)를 따름). 플라스틱·잉크 색, 패널과 키캡 그림자, 탐색기별 강조색(`<html data-explorer>`), LCD·LED 색, 아이소메트릭 면의 조명, 12·14·16·20·28px 글자 크기 단계를 정합니다.
- `shared/DESIGN.md`: 모든 탐색기 화면이 따르는 설계 규칙(화면 구조, 한 단계 깊이, 정보는 한 곳에, 네 가지 글자 역할, 장면 속 데이터 표현)
- `shared/hw.css`, `shared/hw.js`: 하드웨어 부품(패널, 키캡 버튼, 세그먼트, 슬라이더, 스위치, 탭, LCD, LED, 표, 대화상자)과 슬라이더·아이콘 도우미
- `shared/iso-kit.js`: 모든 장면이 같은 투영·빛·축척으로 그리는 아이소메트릭 도구. 상자·글자·경로·호출선과 CPU 칩, RAM, SSD, 서버, 노트북, HDD, 모듈 같은 장치, 장치 사이를 이동하는 데이터 블록(`token`)을 그립니다.
- `shared/kit.html`: 공통 부품만으로 만든 참고 화면. 개발 서버에서 `/shared/kit.html`(`?theme=dark`, `?explorer=memory`)로 엽니다. 빌드에는 들어가지 않습니다.
- `shared/iso.js`: 아이소메트릭 장치의 윗면·앞면·옆면 그라데이션(`url(#hw-iso-*)`)을 페이지에 한 번 넣습니다.
- `shared/switcher.js`, `shared/switcher.css`: 탐색기 전환 메뉴. [UI SDK](https://ui-sdk.dev)의 `<ui-menu>`가 포커스, 방향키, 입력 검색, Esc와 바깥 클릭 닫기를 맡습니다.
- `shared/explorers.js`: 탐색기 이름, 주소, 폴더 목록. 탐색기를 추가하면 여기와 `vite.config.js`의 입력이 함께 바뀝니다.
- `public/fonts/`: 모든 탐색기가 함께 쓰는 Pretendard와 Iosevka 글꼴
- `public/protocol/`, `public/cpu/`: 그 탐색기만 쓰는 아이콘과 공유 이미지
- `docs/`: 통합 이전 탐색기 모음(explorer-hub)의 품질 확인 기록

각 탐색기의 Git 이력은 그 폴더 아래로 합쳐져 있어 `git log -- cpu/`처럼 폴더별로 볼 수 있습니다.
