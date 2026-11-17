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
- `public/fonts/`: 모든 탐색기가 함께 쓰는 Pretendard와 Iosevka 글꼴
- `public/protocol/`, `public/cpu/`: 그 탐색기만 쓰는 아이콘과 공유 이미지
- `public/explorers.js`: 탐색기 이름, 주소, 폴더 목록. 탐색기를 추가하면 여기와 `vite.config.js`의 입력이 함께 바뀝니다.
- `public/switcher.js`, `public/switcher.css`: 탐색기 전환 메뉴. 빌드할 때 각 페이지에 자동으로 붙습니다.
- `docs/`: 통합 이전 탐색기 모음(explorer-hub)의 품질 확인 기록

각 탐색기의 Git 이력은 그 폴더 아래로 합쳐져 있어 `git log -- cpu/`처럼 폴더별로 볼 수 있습니다.
