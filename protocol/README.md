# 프로토콜 탐색기 (Protocol Explorer) — 복원 소스

원작 및 디자인: **Dilum Sanjaya**  
원본 사이트: https://protocol-explorer-alpha.vercel.app/

배포본의 동작을 보존하면서 개발·유지보수할 수 있게 재구성한 TypeScript 프로젝트입니다. 레슨별 모듈, 의미 있는 함수·지역 변수 이름, 읽기 쉬운 제어 흐름, 핵심 알고리즘 설명과 회귀 검사를 갖추었습니다. 화면은 React 19 + Tailwind CSS v4 + Base UI로, 네트워크·시퀀스 장면은 SVG와 Web Animations API를 직접 다루는 명령형 모듈로 그리며, Vite로 개발·빌드합니다.

제작자가 공개한 원본 저장소에서 받은 소스는 아닙니다. 원래 파일 구조·변수명·주석·개발 테스트는 배포본에 남아 있지 않습니다. 현재 이름과 설명은 실제 동작을 분석해 작성했으며, 원본과의 일치는 보존된 콘텐츠와 검증한 실행 결과를 기준으로 합니다.

## 실행

이 탐색기는 [탐색기 모음](../README.md)의 한 페이지입니다. 저장소 루트에서 `npm run dev`를 실행한 뒤 <http://127.0.0.1:5173/protocol/>을 엽니다. 검사는 루트의 `npm test`로 모든 탐색기를 함께 실행합니다. 화면은 한국어로 고정되어 있으며 언어 선택 메뉴는 없습니다.

Node 내장 테스트 러너로 14개 레슨과 215개 패킷의 내용·바이트·필드·시퀀스, 재생 제어와 학습 진도를 검사합니다. `src/explorers/protocol/test/fixtures/distribution-baseline.json`에는 복원 당시 배포본의 해시를 보존합니다. 수정한 TCP·TLS·HTTPS 사례, DHCP 주소 할당과 LAN 프레임, UDP 음성 손실, NAT의 TTL, SMTP 배달 단계는 `src/explorers/protocol/test/distribution.test.ts`와 `player.test.ts`에서 원본 기준값과 구분해 검사합니다. TCP 사례는 [RFC 6298 §5](https://www.rfc-editor.org/rfc/rfc6298.html#section-5), 호환용 CCS는 [RFC 8446 부록 D.4](https://www.rfc-editor.org/rfc/rfc8446.html#appendix-D.4)를 따릅니다.

## 수정 위치

React 19 + TypeScript로 옮겼습니다(공통 셸은 `src/components`, 이식 방법은 `docs/REACT-PORT.md`). 이 페이지의 진입점은 `protocol/index.html` → `src/explorers/protocol/main.tsx`입니다. 레슨은 `?lesson=tcp`처럼 주소로 바로 열 수 있습니다.

| 경로 (`src/explorers/protocol/`) | 역할 |
| --- | --- |
| `app.tsx` | 화면 연결, 키보드 조작 |
| `controller.ts` | 레슨 플레이어·예측·검사기 상태(외부 저장소), 장면 갱신 |
| `toolbar.tsx`, `rail.tsx` | 상단 막대(OSI 계층·학습 진도), 분류 필터가 있는 프로토콜 목록 |
| `scenes.tsx` | 네트워크·시퀀스 장면을 담는 React 호스트 |
| `deck.tsx`, `side.tsx`, `records.tsx`, `inspector.tsx`, `prediction.tsx` | 재생 조작, 해설·장면·정리, 패킷 표, 패킷 검사기, 예측 시트 |
| `lessons/*.ts` | 14개 프로토콜별 레슨, 설명, 패킷 시나리오, 예측 문제, 학습 데이터 |
| `simulation/` | 네트워크 그림·애니메이션, 시퀀스 보기, 재생 시계와 플레이어(명령형 모듈) |
| `packets/encode.ts` | 패킷 바이트와 필드 정보 생성 |
| `quiz.ts`, `lesson-view.ts`, `progress.ts` | 예측 채점, 해설에 보일 내용, 학습 진도 저장 |
| `locales/ko.ts`, `i18n.ts` | 한국어 번역과 동적 문장 치환 |
| `protocol.css` | 패킷 색과 장면 SVG 클래스 |
| `test/*.test.ts`, `test/fixtures/` | 회귀 검사와 배포본 기준값 |

## 동작 흐름

`app.tsx`가 한국어 화면을 구성합니다. 선택된 레슨의 `steps[].events`를 `createLessonPlayer()`가 순서대로 실행하며, 하나의 재생 상태를 사이드바·설명·패킷 표·시퀀스 보기로 전달합니다. `clock.ts`는 모든 애니메이션의 속도와 일시정지를 맞춥니다. 레슨 변경·초기화 시 취소 토큰을 바꿔 이전 애니메이션이 현재 상태를 덮어쓰지 않게 합니다.

패킷 검사는 레슨 이벤트를 `encode.ts`에서 바이트·필드·계층으로 변환합니다. 암호화·난수·생략된 파일 데이터처럼 알 수 없는 바이트는 `null`이며 화면에 `··`로 표시됩니다. 시퀀스 보기는 `timeline.ts`의 송수신 시각과 노드별 지연을 사용합니다. 영어 원문 키를 한국어 사전에서 찾고, 동적인 숫자 문장은 한국어 번역 정규식으로 처리합니다.

이 프로젝트는 실제 통신을 캡처하지 않고, 내장된 교육용 패킷 시나리오를 재생합니다. 기존 배포본의 고정 CSP 메타 태그는 Vite 개발 서버의 모듈 갱신을 위해 제거했습니다.

## 확인된 상태

UI와 아이소메트릭 장치는 탐색기 모음의 공통 디자인(`docs/DESIGN.md`, `src/styles/`, `src/lib/iso/kit.ts`)을 따릅니다. 장치는 같은 투영·빛·축척으로 그리고, 패킷은 장치 사이 바닥 경로를 따라 이동하는 블록으로 표시합니다. 학습 상태는 LED로 구별하고, 패킷 배지·화살표·계층별 의미 색은 유지합니다.

한국어만 제공하며 다른 언어 사전·선택 메뉴와 화면의 제작자 크레딧은 제거했습니다. 이전 언어 설정과 무관하게 한국어로 표시합니다. 원작자 정보는 이 문서에 보존합니다. 복원한 도형·배치·카메라와 패킷 애니메이션을 사용하며, 테마·재생·패킷 검사·시퀀스·모바일 메뉴를 확인했습니다. 일반 UI·개요 정보표·검사기 설명·시퀀스 안내는 Pretendard로 통일했습니다. 시간·주소 등의 데이터와 원문 코드·바이트 덤프는 Iosevka를 사용합니다. 좁은 데스크톱에서는 검사기 설명과 바이트 표를 세로로 배치합니다. 패킷 카드의 종류와 송수신 경로는 별도 줄로 표시하고, 현재 단계 번호는 중복 외곽선 없이 구분합니다. Pretendard는 npm `pretendard` 패키지로 번들하며 라이선스는 `public/fonts/Pretendard-LICENSE.txt`에 있습니다.

2026-11-04: 최초 복원 시 14개 레슨과 215개 패킷을 배포 JavaScript와 직접 대조했습니다. 가독성 정리 후 고정 기준값을 사용하는 17개 테스트와 프로덕션 빌드가 통과했습니다. 번역 사전·치환, 네트워크 SVG·좌표, 시퀀스 표시 동작도 Git의 정리 전 버전과 대조했습니다.

브라우저에서는 한국어 표시, 이전 언어 설정 무시, 패킷 검사, 설정 유지, 모바일 메뉴를 확인했습니다. 일반 모션에서도 패킷 이동, 재생 중 보기 전환, 초기화, HTTP 렌더링·레슨 완료, 테마 전환이 동작하며 콘솔 오류나 누락된 자산이 없었습니다.
