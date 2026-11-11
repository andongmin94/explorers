# 탐색기 학습 품질 재검수

2026년 11월 11일, 로컬 통합본의 여섯 탐색기와 트랜잭션 교착 시나리오를 실제 Chromium에서 확인했다. 데스크톱 대표 장면을 같은 크기로 비교하고, 일반 속도에서 중간 상태를 관찰했다. 390×844에서는 정답 확인, 수동 진행, 일시정지 후 너비 변경을 살폈다. 프로토콜은 이번에 DHCP·IP·UDP·DNS·SMTP를 표본으로 봤다. 지난 수정 때 통과한 75개 자동 검사는 다시 실행하지 않았다.

## 콘텐츠와 아이소메트릭 표현

| 탐색기 | 학습자가 장면에서 읽을 수 있는 것 | 남은 한계 |
| --- | --- | --- |
| 프로토콜 | IP 패킷이 라우터를 거치는 경로를 그림에서 보고, 주소·포트·TTL을 표와 검사기에서 대조할 수 있다. DNS의 위임 응답과 권한 응답도 구분된다. | 노트북 주소처럼 단계에 따라 변하는 값을 고정 장치 라벨로 표시한다. UDP는 음성 손실을 처리하는 위치까지 반대로 읽힌다. |
| CPU 스케줄링 | 같은 작업 카드를 준비 큐·CPU·입출력 장치 사이에서 추적할 수 있다. RR과 FCFS를 같은 작업으로 비교해 선점의 효과를 설명하기에 충분하다. | 한 시각에 도착·선점·배정이 겹치면 그림과 옆 작업표가 서로 다른 순간을 보여준다. |
| 메모리 | 고정된 프레임에서 카드만 교체되어 페이지와 프레임의 차이가 보인다. FIFO·LRU에서 여섯 번째 A의 결과가 달라지는 이유도 확인할 수 있다. | 페이지가 적재되는 순간과 CPU가 읽기를 끝내는 순간을 과정표와 문구가 구분하지 못한다. |
| 트랜잭션 | 두 클라이언트의 로컬 값, DB 행의 확정·미확정 값, 잠금 소유자와 대기자를 따로 읽을 수 있다. 롤백으로 어느 대기선이 풀리는지도 보인다. | 요청이 도착하기 전에 해설이 대기 고리나 다음 계산값을 먼저 알려준다. |
| 디스크 스케줄링 | SSTF의 첫 선택 53 → 65에서 실제 헤드 끝이 65번 트랙에 닿는다. 이동 거리 12칸을 팔의 움직임과 연결해 볼 수 있다. | 큐에서 컨트롤러로 가는 카드와 그 아래 그려 둔 점선이 실제로 어긋난다. |
| Git | 커밋 그래프·작업 파일·인덱스가 고정된 자리를 갖는다. 충돌 때 세 버전이 인덱스에 모이고, 선택한 문장과 두 부모의 병합 이력이 각각 남는 과정을 볼 수 있다. | 390px에서는 병합을 실행하는 위치에서 출발 커밋과 충돌 표식이 생기는 작업 파일을 동시에 볼 수 없다. |

[실제 데스크톱 장면 여섯 개 비교](scene-comparison.jpg)

## 먼저 고칠 항목

| 순서 | 재현과 관측 | 수정 후 확인할 기준 |
| --- | --- | --- |
| 1. 프로토콜의 송수신 주체 | DHCP 1단계 해설은 ‘주소 없음(0.0.0.0 사용)’인데 노트북에는 이미 192.168.1.10이 표시된다. 3단계의 2번 OFFER는 IP·해설 모두 라우터 → 노트북이지만, 이더넷 헤더와 바이트는 노트북 MAC(끝 10) → 라우터 MAC(끝 01)이다. UDP에서는 노트북 → 미디어 서버의 7번 프레임이 손실되고, 정상 수신한 반대 방향의 노트북이 ‘20ms 공백을 메움’으로 표시된다. | DHCP 승인 전에는 미할당, 승인 후에는 임대 주소를 표시한다. 이 예시의 유니캐스트 OFFER·ACK에서 출발 MAC은 라우터, 목적 MAC은 노트북이어야 한다. UDP는 손실된 방향의 수신 측에 보정을 표시한다. [OFFER 검사 화면](dhcp-offer-inspector.png) · [MAC 생성](../protocol-explorer-source/src/packets/encode.js#L912) · [장치 라벨](../protocol-explorer-source/src/simulation/network-animation.js#L869) · [UDP 손실](../protocol-explorer-source/src/lessons/udp.js#L199) · [보정 위치](../protocol-explorer-source/src/lessons/udp.js#L252) |
| 2. 일시정지 중 화면 회전 | 390×844에서 사건 중간에 멈추고 창 너비만 변경한다. 메모리 5번 D는 조회에서 적재 완료로, 재고 갱신 9번은 잠금 보유에서 커밋 완료로, 교착 8번은 T2가 B를 보유한 상태에서 롤백 완료로 넘어간다. Git 3번 git add도 가로 회전만으로 기록이 2개에서 3개가 된다. | 너비를 바꾼 직후에도 카드·잠금·인덱스·기록과 정지 상태가 같아야 한다. 이어서 재생하면 멈춘 위치에서 남은 이동이 보인다. [메모리](../memory-explorer/src/scene.js#L727) · [재고](../transaction-explorer/src/scene.js#L666) · [교착](../transaction-explorer/src/deadlock-scene.js#L539) · [Git](../git-explorer/src/scene.js#L504) |
| 3. 모바일에서 화면 밖 재생 | 390×844에서 CPU 첫 예측의 P2, 디스크 SSTF 첫 예측의 65를 고르고 실제 이동 확인을 누른다. 예측 모달이 닫힌 뒤 두 장면 모두 보이는 높이가 0px인 채 재생된다. Git 8→9에서는 인덱스만 보이고 커밋 보드와 작업 파일은 화면 위에 있다. | 확인 직후부터 이동의 출발점과 결과를 따라갈 수 있어야 한다. Git처럼 화면보다 큰 장면은 이동 단계별로 해당 영역이 보여야 한다. [CPU 확인 버튼](../cpu-scheduling-explorer/src/main.js#L558) · [디스크 확인 버튼](../disk-scheduling-explorer/src/main.js#L319) · [Git 모바일 배치](../git-explorer/src/scene.js#L112) |
| 4. 장면보다 앞선 상태·해설 | 메모리 5번에서 D → F0, ‘접근 전’, ‘접근 재시도’가 보일 때 과정표는 ‘접근 완료’, 해설은 ‘D가 RAM에 없다’다. CPU 2ms의 첫 도착 장면에선 P1이 여전히 CPU에 있지만 왼쪽은 P2 실행 중이다. 잠금 읽기 8번에선 T2가 9를 받기 전에 계산 결과 8이 나오고, 교착 6번에서도 두 번째 대기선이 생기기 전에 순환 해설이 나온다. | 메모리의 완료는 재시도 후 실제 읽기 때, CPU의 실행 상태는 실제 배정 때, 교착의 순환 안내는 두 번째 대기선이 생길 때 바뀌어야 한다. 예측과 현재 관찰값을 문구에서 구분한다. [메모리 과정표](../memory-explorer/src/main.js#L75) · [메모리 해설](../memory-explorer/src/lesson.js#L103) · [CPU 작업표](../cpu-scheduling-explorer/src/main.js#L163) · [잠금 읽기](../transaction-explorer/src/main.js#L202) · [교착](../transaction-explorer/src/deadlock-main.js#L162) |

## 그다음 보완할 부분

- **패킷의 숫자 설명.** IP 4단계의 패킷 4는 TTL 127이 맞지만 검사기 주석은 ‘이 시스템은 64에서 시작’이라고 한다. 이 패킷은 노트북이 128로 보내 라우터가 1 줄인 패킷이다. UDP 첫 카드의 ‘오디오 92 B’는 검사기의 음성 80 B에 RTP 헤더 12 B를 합한 값이다. SMTP의 마지막 ‘250 queued’와 메일함 저장 사이에도 로컬 배달 한 단계를 표시하면 수신 서버의 접수와 최종 배달을 구분하기 쉽다. [TTL 설명](../protocol-explorer-source/src/packets/encode.js#L1604) · [음성 크기](../protocol-explorer-source/src/lessons/udp.js#L139) · [SMTP 마지막 사건](../protocol-explorer-source/src/lessons/smtp.js#L743)
- **CPU와 디스크의 배속.** CPU 4ms에서 1× → 2×로 바꾸자 P3의 진행량이 0.5 → 0.1ms로 돌아가고 P2의 입출력 남은 시간은 2.5 → 2.9ms로 늘었다. 배속을 바꿔도 작업 진행량은 역행하지 않아야 한다. 디스크에서는 진행 중인 53 → 65 이동이 2× 버튼을 누른 후에도 기존 1,098ms로 끝났다. [CPU 경과 시간](../cpu-scheduling-explorer/src/main.js#L536) · [디스크 이동 시간](../disk-scheduling-explorer/src/scene.js#L76)
- **디스크의 연결선.** 1440px 화면에서 SSTF의 첫 65번 카드 중심은 수직 점선에서 가로 93px, 도착점은 포트에서 아래로 42px 벗어났다. 같은 장면의 390px 측정값은 각각 8px와 14px다. 큐·점선·포트가 같은 경로를 사용해야 선택한 요청이 디스크에 전달되는 과정이 읽힌다. [카드의 이동 좌표](../disk-scheduling-explorer/src/scene.js#L90)
- **CPU 수동 단계의 재생 버튼.** 정지 상태에서 ‘1ms 다음’을 눌러 이동 중일 때 버튼이 ‘이어서 재생’을 표시한다. 이때 한 번 누르면 자동 재생을 켜고 두 번째에야 멈춘다. 수동 이동 중에도 한 번 눌러 현재 장면을 멈출 수 있어야 한다. [버튼 상태](../cpu-scheduling-explorer/src/main.js#L238) · [재생 처리](../cpu-scheduling-explorer/src/main.js#L308)

프로토콜의 기대 동작은 해당 RFC와 대조했다. [DHCP 서버 응답](https://www.rfc-editor.org/rfc/rfc2131.html#section-4.1) · [라우터의 TTL 처리](https://www.rfc-editor.org/rfc/rfc1812.html#section-5.3.1) · [RTP 헤더](https://www.rfc-editor.org/rfc/rfc3550.html#section-5.1) · [수신 측의 Opus 손실 보정](https://www.rfc-editor.org/rfc/rfc7587.html#section-3.3) · [SMTP 수신 책임](https://www.rfc-editor.org/rfc/rfc5321.html#section-6.1)
