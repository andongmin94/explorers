// The learning model around each lesson (docs/DESIGN.md → "Learning model"):
// the start screen leads with a scenario question, a short setup and one
// 학습 목표 line (목표); the end of the lesson is 정리 with 2–3 핵심 정리
// points and 확인 문제 answered without the scene. Korean only; the setup
// never names what the lesson's predictions ask (a port, the first message).
//
// recall: [{ id, question, choices: [{ label, correct?, why }] }] — the shape
// shared/lesson-kit.js bindRecap() reads.

import type { RecallQuestion } from "@/lib/lesson-kit.ts";

export interface LearningInfo {
  question: string;
  setup: string;
  goal: string;
  points: string[];
  recall: RecallQuestion[];
}

const learning: Record<string, LearningInfo> = {
  http: {
    question:
      "주소창에 http://www.example.com을 치면, 화면이 뜨기까지 네트워크에서는 무슨 일이 일어날까요?",
    setup:
      "노트북의 브라우저가 처음 보는 웹 사이트를 엽니다. 브라우저가 아는 것은 이름뿐이고, 패킷은 이름이 아니라 주소로 갑니다.",
    goal: "이름 찾기 → 연결 → 요청·응답 순서와, 평문 HTTP를 누구나 읽을 수 있다는 점을 설명한다.",
    points: [
      "패킷은 IP 주소로 가므로 브라우저는 먼저 DNS로 이름을 주소로 바꿉니다.",
      "HTTP 요청 전에 TCP 3방향 핸드셰이크로 연결을 엽니다.",
      "요청 하나에 응답 하나이며, 평문 HTTP는 경로의 누구나 읽을 수 있습니다.",
    ],
    recall: [
      {
        id: "http-order",
        question: "브라우저가 웹 페이지를 받기까지의 순서로 맞는 것은?",
        choices: [
          {
            label: "DNS 조회 → TCP 연결 → HTTP 요청",
            correct: true,
            why: "주소를 알아야 연결할 수 있고, 연결이 열려야 요청을 보낼 수 있습니다.",
          },
          {
            label: "HTTP 요청 → DNS 조회 → TCP 연결",
            why: "요청은 연결 위로 나갑니다. 연결할 주소도 아직 모르는 상태입니다.",
          },
          {
            label: "TCP 연결 → DNS 조회 → HTTP 요청",
            why: "TCP 연결은 상대의 IP 주소가 있어야 열 수 있습니다.",
          },
        ],
      },
    ],
  },
  https: {
    question: "https://로 같은 페이지를 열면, http://와 무엇이 달라질까요?",
    setup:
      "이번에는 주소가 https://로 시작합니다. 브라우저는 서버가 진짜인지 확인하고, 내용을 아무도 읽지 못하게 보내야 합니다.",
    goal: "TLS 핸드셰이크가 TCP 연결과 HTTP 요청 사이에 들어가는 이유와, 그 뒤 HTTP가 암호화된다는 점을 설명한다.",
    points: [
      "HTTPS는 TCP 연결 위에서 TLS 핸드셰이크를 마친 뒤 HTTP를 보냅니다.",
      "인증서로 서버의 신원을 확인하고, 한 번의 왕복으로 키를 합의합니다.",
      "그 뒤의 요청과 응답은 Application Data로 암호화되어 중간 장비가 읽을 수 없습니다.",
    ],
    recall: [
      {
        id: "https-visible",
        question: "HTTPS 통신을 경로에서 엿보는 사람이 볼 수 있는 것은?",
        choices: [
          {
            label: "서버의 IP 주소와 포트",
            correct: true,
            why: "IP·TCP 헤더는 라우터가 읽어야 하므로 암호화되지 않습니다.",
          },
          {
            label: "요청한 경로(GET /index.html)",
            why: "HTTP 요청 전체가 TLS 레코드 안에서 암호화됩니다.",
          },
          {
            label: "응답 본문(HTML)",
            why: "응답도 합의한 키로 암호화되어 Application Data로 갑니다.",
          },
        ],
      },
    ],
  },
  tcp: {
    question: "세그먼트 하나가 도중에 사라져도 curl은 어떻게 모든 바이트를 순서대로 받을까요?",
    setup:
      "curl이 서버와 연결을 열고 데이터를 주고받습니다. 이번에는 서버가 보낸 세그먼트 하나가 인터넷 어딘가에서 사라집니다.",
    goal: "SEQ/ACK 번호로 바이트를 확인하는 방법과, 사라진 세그먼트를 복구하는 과정을 설명한다.",
    points: [
      "연결은 SYN, SYN-ACK, ACK로 열고, 양쪽이 각자 FIN과 ACK로 닫습니다.",
      "ACK 번호는 다음에 받을 바이트 번호이며, 빈틈 뒤는 SACK로 따로 알립니다.",
      "RTO가 만료되면 사라진 세그먼트만 재전송하고, 누적 ACK가 한 번에 건너뜁니다.",
    ],
    recall: [
      {
        id: "tcp-ack",
        question: "Seq=101부터 50바이트를 받은 쪽이 보내는 ACK 번호는?",
        choices: [
          {
            label: "151",
            correct: true,
            why: "101부터 50바이트면 마지막이 150이므로 다음에 받을 바이트는 151입니다.",
          },
          {
            label: "150",
            why: "150은 마지막으로 받은 바이트입니다. ACK는 다음 바이트를 가리킵니다.",
          },
          { label: "50", why: "ACK는 받은 바이트 수가 아니라 바이트 번호입니다." },
        ],
      },
      {
        id: "tcp-gap",
        question: "중간 세그먼트가 빠졌을 때 받는 쪽은 무엇을 보내나요?",
        choices: [
          {
            label: "빈틈 앞을 가리키는 중복 ACK (+SACK)",
            correct: true,
            why: "누적 ACK는 빈틈을 건너뛸 수 없어 같은 번호를 다시 보내고, 받은 구간은 SACK로 알립니다.",
          },
          {
            label: "빠진 세그먼트를 직접 재전송",
            why: "재전송은 데이터를 보낸 쪽만 할 수 있습니다.",
          },
          {
            label: "마지막으로 받은 세그먼트까지의 ACK",
            why: "그러면 빈틈까지 받았다고 잘못 알리게 됩니다.",
          },
        ],
      },
    ],
  },
  udp: {
    question: "통화 중 음성 조각 하나가 사라지면, UDP는 무엇을 할까요?",
    setup:
      "통화 앱이 미디어 서버로 20 ms마다 음성 조각을 보냅니다. 연결을 열지 않고 바로 첫 데이터그램부터 목소리를 싣습니다.",
    goal: "UDP에 연결·확인 응답·재전송이 없는 이유와, 실시간 음성에 그것이 알맞은 이유를 설명한다.",
    points: [
      "UDP는 연결 없이 첫 데이터그램부터 데이터를 싣습니다. 헤더는 8바이트뿐입니다.",
      "확인 응답도 재전송도 없어서, 사라진 데이터그램은 그냥 사라집니다.",
      "늦게 온 음성은 쓸모없으므로 앱이 빈틈을 메우고 다음 조각을 계속 보냅니다.",
    ],
    recall: [
      {
        id: "udp-loss",
        question: "UDP 데이터그램이 사라졌다는 것을 누가 알아챌 수 있나요?",
        choices: [
          {
            label: "받는 쪽 앱 (번호가 빠진 것을 보고)",
            correct: true,
            why: "UDP 자체는 아무것도 확인하지 않습니다. RTP 같은 앱 프로토콜의 번호로 앱이 빈틈을 압니다.",
          },
          {
            label: "UDP가 자동으로 알아채고 재전송",
            why: "재전송은 TCP의 기능입니다. UDP에는 없습니다.",
          },
          { label: "보낸 쪽의 UDP가 ACK를 기다려서", why: "UDP에는 ACK가 없습니다." },
        ],
      },
    ],
  },
  ip: {
    question: "다른 네트워크에 있는 서버로 가는 패킷은 어떻게 길을 찾고, 응답은 어떻게 돌아올까요?",
    setup:
      "노트북(192.168.1.10)이 인터넷 건너편의 서버 203.0.113.10에 패킷을 보냅니다. 그 주소는 노트북의 네트워크 범위 밖입니다.",
    goal: "기본 게이트웨이, NAT가 주소를 바꾸는 이유, 홉마다 줄어드는 TTL을 설명한다.",
    points: [
      "다른 네트워크로 가는 패킷은 기본 게이트웨이(라우터)로 보내며, 그 MAC 주소는 ARP로 알아냅니다.",
      "NAT는 사설 출발 주소를 공인 주소로 바꾸고 대응을 기록해 응답을 되돌려 줍니다.",
      "라우터마다 목적지 주소만 보고 다음 홉을 고르며 TTL을 1씩 줄입니다.",
    ],
    recall: [
      {
        id: "ip-ttl",
        question: "TTL 64로 출발한 패킷이 라우터 5개를 지나 도착했습니다. 도착할 때의 TTL은?",
        choices: [
          { label: "59", correct: true, why: "라우터마다 1씩 줄어 64−5=59입니다." },
          {
            label: "64",
            why: "TTL은 라우터를 지날 때마다 줄어듭니다. 그래야 길을 잃은 패킷이 사라집니다.",
          },
          { label: "69", why: "TTL은 늘어나지 않습니다." },
        ],
      },
    ],
  },
  dns: {
    question: "캐시가 텅 빈 리졸버는 www.example.com의 주소를 어디서 어떻게 알아낼까요?",
    setup:
      "노트북이 리졸버 8.8.8.8에 www.example.com의 주소를 묻습니다. 리졸버는 방금 시작해서 아무것도 기억하지 않습니다.",
    goal: "리졸버가 위에서부터 차례로 물어 내려가는 과정과, 답을 기억하는 캐시를 설명한다.",
    points: [
      "노트북은 리졸버에 재귀 질의(RD=1)로 조회 전체를 맡깁니다.",
      "리졸버는 루트 → .com TLD → 권한 서버로 반복 질의(RD=0)를 하며 리퍼럴을 따라 내려갑니다.",
      "받은 답은 TTL 동안 캐시되어, 다음 조회는 멀리 가지 않고 바로 답합니다.",
    ],
    recall: [
      {
        id: "dns-root",
        question: "루트 서버가 www.example.com 질의에 돌려주는 것은?",
        choices: [
          {
            label: ".com을 맡은 서버 목록(리퍼럴)",
            correct: true,
            why: "루트 서버는 최상위 도메인 서버만 압니다. 그다음은 .com 서버에 물어야 합니다.",
          },
          {
            label: "www.example.com의 IP 주소",
            why: "모든 이름을 아는 서버는 없습니다. 최종 답은 권한 있는 서버가 줍니다.",
          },
          {
            label: "대신 끝까지 찾아본 결과",
            why: "끝까지 찾아 주는 것은 재귀 리졸버의 일입니다.",
          },
        ],
      },
      {
        id: "dns-cache",
        question: "1분 뒤 같은 이름을 다시 물으면 리졸버는?",
        choices: [
          {
            label: "캐시에서 바로 답한다",
            correct: true,
            why: "TTL(여기서는 1시간)이 지나기 전까지 캐시한 답을 씁니다.",
          },
          {
            label: "루트 서버부터 다시 묻는다",
            why: "그러면 캐시가 의미 없습니다. TTL이 남아 있으면 다시 묻지 않습니다.",
          },
          { label: "노트북에 직접 찾으라고 한다", why: "노트북은 재귀 질의로 조회를 맡겼습니다." },
        ],
      },
    ],
  },
  dhcp: {
    question: "IP 주소가 하나도 없는 노트북은 어떻게 네트워크 설정을 받을까요?",
    setup:
      "노트북이 방금 와이파이에 붙었습니다. MAC 주소는 있지만 IP 주소도, 게이트웨이도, DNS 서버도 모릅니다. 누가 DHCP 서버인지도 모릅니다.",
    goal: "메시지 네 개로 주소를 임대받는 과정과, 임대 절반에 갱신하는 이유를 설명한다.",
    points: [
      "DISCOVER, OFFER, REQUEST, ACK(DORA) 네 메시지로 주소와 설정을 받습니다.",
      "주소가 없을 때는 0.0.0.0에서 브로드캐스트로 서버를 찾습니다.",
      "주소는 임대이며, 기간의 절반(T1)에 같은 서버로 REQUEST를 보내 갱신합니다.",
    ],
    recall: [
      {
        id: "dhcp-order",
        question: "DHCP로 처음 주소를 받는 메시지 순서는?",
        choices: [
          {
            label: "DISCOVER → OFFER → REQUEST → ACK",
            correct: true,
            why: "찾고, 제안받고, 수락하고, 확정됩니다(DORA).",
          },
          {
            label: "REQUEST → OFFER → ACK → DISCOVER",
            why: "서버를 모르는 상태에서는 먼저 찾아야(DISCOVER) 합니다.",
          },
          {
            label: "DISCOVER → ACK",
            why: "서버가 제안하고 클라이언트가 수락하는 두 단계가 빠졌습니다. 여러 서버가 제안할 수 있습니다.",
          },
        ],
      },
    ],
  },
  icmp: {
    question: "ping과 traceroute는 응용 데이터도 없이 어떻게 경로와 상태를 알아낼까요?",
    setup:
      "노트북에서 ping과 traceroute를 실행하고, 아무도 듣지 않는 UDP 포트에도 데이터그램을 보냅니다. 네트워크가 무엇이라고 답하는지 봅니다.",
    goal: "ping이 왕복 시간을 재는 법, traceroute가 홉을 찾는 원리, 닫힌 포트에 대한 알림을 설명한다.",
    points: [
      "ping은 ICMP 에코 요청을 보내고 에코 응답으로 왕복 시간을 잽니다.",
      "TTL이 0이 된 라우터는 시간 초과를 보내므로, traceroute는 TTL을 1씩 늘려 홉을 찾습니다.",
      "닫힌 UDP 포트에는 운영체제가 ICMP 포트 도달 불가로 답합니다.",
    ],
    recall: [
      {
        id: "icmp-traceroute",
        question: "traceroute가 경로의 세 번째 라우터를 알아내는 방법은?",
        choices: [
          {
            label: "TTL 3으로 보내 시간 초과를 받는다",
            correct: true,
            why: "TTL 3인 패킷은 세 번째 라우터에서 0이 되고, 그 라우터가 자기 주소로 시간 초과를 보냅니다.",
          },
          {
            label: "라우터에 ping을 세 번 보낸다",
            why: "라우터 주소를 모르므로 ping을 보낼 수 없습니다.",
          },
          {
            label: "목적지의 에코 응답에 경로가 적혀 온다",
            why: "에코 응답에는 경로가 적혀 있지 않습니다.",
          },
        ],
      },
    ],
  },
  smtp: {
    question: "Alice가 보낸 메일은 어떤 길을 거쳐 다른 회사에 있는 Bob의 메일 서버에 닿을까요?",
    setup:
      "Alice가 메일 앱에서 보내기를 누릅니다. 메일은 먼저 Alice의 제공업체 서버로 가고, 그 서버가 Bob의 도메인을 맡은 서버를 찾아 넘겨야 합니다.",
    goal: "제출(앱 → 서버)과 중계(서버 → 서버)의 차이, 상대 서버를 찾는 방법, 서버 사이의 암호화를 설명한다.",
    points: [
      "메일 앱은 처음부터 TLS를 쓰는 제출 포트로 자기 제공업체 서버에 메일을 맡깁니다.",
      "보내는 서버는 받는 도메인의 MX 레코드를 DNS에 물어 상대 서버를 찾습니다.",
      "서버끼리는 25번 포트에서 평문으로 시작해 STARTTLS로 TLS로 올리고, 250 응답으로 배달 책임이 넘어갑니다.",
    ],
    recall: [
      {
        id: "smtp-mx",
        question: "보내는 메일 서버가 받는 사람의 메일 서버를 찾을 때 묻는 DNS 레코드는?",
        choices: [
          {
            label: "MX 레코드",
            correct: true,
            why: "MX는 도메인의 메일을 받을 서버 이름을 알려 줍니다.",
          },
          {
            label: "받는 사람 이메일 주소의 A 레코드",
            why: "이메일 주소 자체에는 A 레코드가 없습니다. 도메인의 MX를 찾습니다.",
          },
          { label: "PTR 레코드", why: "PTR은 주소를 이름으로 바꾸는 역방향 조회입니다." },
        ],
      },
    ],
  },
  pop3: {
    question: "POP3로 메일을 내려받으면, 그 메일은 서버에 남을까요?",
    setup:
      "Bob의 노트북 메일 앱이 메일 서버에 접속해 새 메시지를 내려받습니다. 이 앱은 받은 메일을 서버에 남기지 않도록 설정되어 있습니다.",
    goal: "POP3의 명령과, 내려받은 메일이 서버에서 어떻게 되는지 설명한다.",
    points: [
      "POP3는 짧은 명령(USER, PASS, STAT, LIST, RETR, DELE, QUIT)과 +OK/-ERR 응답으로 이루어집니다.",
      "RETR로 내려받고 DELE로 표시한 메시지는 QUIT 때 서버에서 지워집니다.",
      "그래서 메일이 한 장치에만 남습니다. 여러 장치에는 IMAP이 맞습니다.",
    ],
    recall: [
      {
        id: "pop3-dele",
        question: "DELE 1을 보낸 직후 연결이 끊겨 QUIT을 보내지 못했습니다. 1번 메시지는?",
        choices: [
          {
            label: "서버에 그대로 남는다",
            correct: true,
            why: "DELE는 표시만 합니다. 실제 삭제는 QUIT으로 세션을 끝낼 때(UPDATE 상태) 일어납니다.",
          },
          { label: "DELE 순간 바로 지워졌다", why: "POP3 서버는 QUIT 전까지 삭제를 미뤄 둡니다." },
          {
            label: "다음 접속 때 자동으로 지워진다",
            why: "표시는 세션이 끝나면 사라집니다. 다음 세션은 처음부터 시작합니다.",
          },
        ],
      },
    ],
  },
  imap: {
    question: "휴대폰과 노트북이 같은 메일함을 보려면, 메일 앱은 서버와 어떻게 대화해야 할까요?",
    setup:
      "Bob의 메일 앱이 IMAP 서버에 접속해 받은편지함을 열고 메일 하나를 읽습니다. 같은 메일함을 휴대폰과 웹메일도 봅니다.",
    goal: "태그가 붙은 IMAP 명령, 서버에 남는 메일과 \\Seen 표시, 새 메일을 알림받는 방식을 설명한다.",
    points: [
      "IMAP 명령에는 태그(a1, a2…)가 붙고, 서버는 같은 태그로 완료를 알립니다.",
      "FETCH는 사본을 받을 뿐 메일은 서버에 남고, \\Seen 같은 표시가 모든 장치에 반영됩니다.",
      "IDLE로 기다리면 서버가 새 메일을 태그 없는 응답(* EXISTS)으로 바로 알려 줍니다.",
    ],
    recall: [
      {
        id: "imap-seen",
        question: "노트북에서 메일을 읽은 뒤 휴대폰으로 메일함을 열면?",
        choices: [
          {
            label: "같은 메일이 읽음으로 보인다",
            correct: true,
            why: "읽음(\\Seen) 표시는 서버에 저장되므로 모든 장치가 같은 상태를 봅니다.",
          },
          {
            label: "메일이 사라져 있다",
            why: "그것은 POP3에서 내려받고 지웠을 때입니다. IMAP은 메일을 서버에 둡니다.",
          },
          {
            label: "읽지 않음으로 보인다",
            why: "IMAP은 읽음 표시를 각 장치가 아니라 서버에 둡니다.",
          },
        ],
      },
    ],
  },
  ftp: {
    question: "FTP로 파일 하나를 내려받는 데 왜 TCP 연결이 두 개나 필요할까요?",
    setup:
      "FTP 앱이 ftp.example.com에 로그인해 파일 목록을 보고 파일 하나를 내려받습니다. 모든 대화는 암호화되지 않습니다.",
    goal: "제어 연결과 데이터 연결의 역할, 패시브 모드에서 포트를 계산하는 법, 평문의 위험을 설명한다.",
    points: [
      "명령과 응답은 하나의 제어 연결로 세션 내내 오가고, 응답은 세 자리 코드로 시작합니다.",
      "파일과 목록은 매번 새 데이터 연결로 옮기며, 패시브 모드에서는 클라이언트가 그 연결을 엽니다.",
      "비밀번호와 파일이 모두 평문이라 오늘날에는 SFTP나 FTPS를 씁니다.",
    ],
    recall: [
      {
        id: "ftp-pasv",
        question: "227 응답의 마지막 두 수가 (4,1)이면 데이터 연결 포트는?",
        choices: [
          {
            label: "1025",
            correct: true,
            why: "상위 바이트 4×256에 하위 바이트 1을 더해 1025입니다.",
          },
          { label: "41", why: "두 수를 이어 붙이는 것이 아니라 상위·하위 바이트로 계산합니다." },
          { label: "5", why: "두 수를 더하는 것이 아닙니다. 첫 수는 256배입니다." },
        ],
      },
    ],
  },
  ssh: {
    question: "비밀번호를 보내지 않고도 Alice는 어떻게 원격 서버에 안전하게 로그인할까요?",
    setup:
      "Alice가 터미널에서 ssh alice@server.example.com을 실행합니다. 서버도, 그 사이의 네트워크도 Alice는 믿을 수 없습니다.",
    goal: "SSH가 연결을 암호화하고 서버와 사용자를 각각 인증하는 순서와, 키 입력마다 패킷이 오가는 이유를 설명한다.",
    points: [
      "평문 버전 교환 뒤 키 교환으로 공유 키를 만들고, 서버는 호스트 키로 신원을 증명합니다.",
      "사용자는 기기 밖으로 나가지 않는 개인 키로 서명해 비밀을 보내지 않고 로그인합니다.",
      "셸에서는 키 하나마다 암호화된 패킷이 오가고 서버가 글자를 되돌려 화면에 표시합니다.",
    ],
    recall: [
      {
        id: "ssh-pubkey",
        question: "공개 키 로그인에서 클라이언트가 서버에 보내는 것은?",
        choices: [
          {
            label: "세션 데이터에 대한 개인 키 서명",
            correct: true,
            why: "서버는 등록된 공개 키로 서명을 확인합니다. 개인 키는 기기를 떠나지 않습니다.",
          },
          {
            label: "개인 키 파일 자체",
            why: "개인 키를 보내면 누구나 그 사람 행세를 할 수 있습니다.",
          },
          {
            label: "암호화된 비밀번호",
            why: "그것은 비밀번호 방식입니다. 공개 키 방식은 비밀을 보내지 않습니다.",
          },
        ],
      },
    ],
  },
  tls: {
    question: "처음 만난 브라우저와 서버가 어떻게 한 번의 왕복만으로 비밀 키를 나눠 가질까요?",
    setup:
      "TCP 연결이 막 열렸습니다. 브라우저는 이 서버가 진짜인지 모르고, 둘 사이에는 아직 공유한 비밀이 없습니다.",
    goal: "TLS 1.3 핸드셰이크의 메시지 순서, 키 공유와 인증서 검증, close_notify로 끝내는 이유를 설명한다.",
    points: [
      "Hello 두 메시지로 키 공유 값을 교환해 한 번의 왕복으로 키를 합의합니다.",
      "인증서와 서명은 이미 암호화된 핸드셰이크 안에서 오고, 브라우저가 검증해 서버의 신원을 확인합니다.",
      "데이터와 종료 경고(close_notify)까지 보호한 뒤 TCP를 FIN으로 닫습니다.",
    ],
    recall: [
      {
        id: "tls-cert",
        question: "TLS에서 인증서가 하는 일은?",
        choices: [
          {
            label: "서버가 그 이름의 주인임을 증명",
            correct: true,
            why: "인증 기관이 서명한 인증서와 핸드셰이크 서명으로 상대가 진짜 서버임을 확인합니다.",
          },
          {
            label: "데이터를 직접 암호화하는 키",
            why: "데이터는 핸드셰이크에서 합의한 세션 키로 암호화합니다.",
          },
          {
            label: "TCP 연결을 여는 데 필요",
            why: "인증서는 TCP 연결이 열린 뒤 TLS 핸드셰이크에서 씁니다.",
          },
        ],
      },
    ],
  },
};

export { learning };
