// Hand-written prediction questions, keyed by lesson and by the index of the
// packet they ask about (the order of getLessonPackets()). `kind` names what
// is read off that packet to grade the answer (see getPacketAnswer in
// ../quiz.js), so a question can never disagree with the packet it precedes.
// Choices are [value, text]; the text defaults to the value.

const WELL_KNOWN_PORTS = {
  21: "21 (FTP 제어)",
  22: "22 (SSH)",
  25: "25 (SMTP 서버 간)",
  53: "53 (DNS)",
  80: "80 (HTTP)",
  443: "443 (HTTPS)",
  993: "993 (IMAPS)",
  995: "995 (POP3S)",
};
const port = (number) => [String(number), WELL_KNOWN_PORTS[number] ?? String(number)];

const lessonQuizzes = {
  http: [
    {
      packet: 1,
      kind: "address",
      prompt: "DNS 리졸버는 www.example.com에 대해 무엇을 돌려줄까요?",
      choices: [
        ["203.0.113.10", "203.0.113.10 · 웹 서버 주소"],
        ["8.8.8.8", "8.8.8.8 · 리졸버 자신의 주소"],
        ["192.168.1.10", "192.168.1.10 · 노트북 주소"],
        ["192.168.1.1", "192.168.1.1 · 라우터 주소"],
      ],
      explain: "A 레코드 응답에는 이름에 해당하는 IPv4 주소가 들어 있습니다. 브라우저는 이 주소로 TCP 연결을 엽니다.",
    },
    {
      packet: 2,
      kind: "port",
      prompt: "브라우저는 웹 서버의 어느 포트로 연결을 열까요?",
      choices: [port(80), port(443), port(53), port(22)],
      explain: "주소가 http://로 시작하므로 HTTP의 기본 포트 80을 씁니다. 출발 포트(52344)는 운영체제가 임시로 고른 번호입니다.",
    },
  ],
  https: [
    {
      packet: 2,
      kind: "port",
      prompt: "https:// 주소입니다. 브라우저는 서버의 어느 포트로 연결할까요?",
      choices: [port(443), port(80), port(53), port(22)],
      explain: "HTTPS의 기본 포트는 443입니다. 같은 서버라도 80번은 암호화하지 않은 HTTP용입니다.",
    },
    {
      packet: 8,
      kind: "message",
      prompt: "핸드셰이크가 끝났습니다. 이제 브라우저가 보내는 것은?",
      choices: [["APP DATA", "APP DATA · 암호화된 HTTP 요청"], ["GET /", "GET / · 평문 HTTP 요청"], ["CLIENT HELLO"], ["TICKETS"]],
      explain: "HTTP 요청은 TLS 레코드 안에 암호화되어 Application Data로 나갑니다. 중간 장비는 GET이라는 글자조차 볼 수 없습니다.",
    },
  ],
  tcp: [
    {
      packet: 1,
      kind: "flags",
      prompt: "SYN을 받은 서버는 어떤 플래그로 답할까요?",
      choices: [["SYN"], ["SYN, ACK"], ["ACK"], ["RST"]],
      explain: "서버는 클라이언트의 시작 번호를 확인(ACK)하고 자기 시작 번호를 알립니다(SYN). 그래서 SYN-ACK입니다.",
    },
    {
      packet: 2,
      kind: "flags",
      prompt: "SYN-ACK를 받은 노트북은 무엇을 보내 핸드셰이크를 끝낼까요?",
      choices: [["ACK"], ["SYN"], ["SYN, ACK"], ["FIN, ACK"]],
      explain: "서버의 시작 번호를 확인하는 ACK 하나로 3방향 핸드셰이크가 끝나고, 이제 양쪽 모두 데이터를 보낼 수 있습니다.",
    },
    {
      packet: 4,
      kind: "ack",
      prompt: "노트북이 Seq=1부터 78바이트짜리 요청을 보냈습니다. 서버가 돌려보내는 ACK 번호는?",
      choices: [["79", "79 · 다음에 받을 바이트 번호"], ["78", "78 · 받은 바이트 수"], ["1", "1 · 요청의 시작 번호"], ["1461", "1461 · 한 세그먼트(1460바이트) 뒤"]],
      explain: "ACK 번호는 ‘여기까지 다 받았으니 다음에는 이 바이트부터 보내라’는 뜻입니다. 1부터 78바이트를 받았으므로 다음 바이트는 1+78=79입니다.",
    },
    {
      packet: 7,
      kind: "message",
      prompt: "첫 번째 세그먼트가 사라지고 두 번째만 도착했습니다. 노트북은 무엇을 보낼까요?",
      choices: [["DUP ACK", "중복 ACK · 아직 1번 바이트를 기다린다고 알림"], ["ACK", "ACK · 2921까지 받았다고 알림"], ["FIN", "FIN · 연결 종료"], ["RESEND", "재전송 · 노트북이 다시 보냄"]],
      explain: "TCP의 ACK는 누적 확인이라 빈틈 뒤의 데이터를 확인할 수 없습니다. 노트북은 Ack=1을 다시 보내고, 받은 구간은 SACK 옵션으로 따로 알려 줍니다.",
    },
    {
      packet: 8,
      kind: "message",
      prompt: "서버는 빠진 세그먼트를 어떻게 처리할까요?",
      choices: [["RESEND", "재전송 · 빠진 1460바이트만 다시 보냄"], ["DATA", "DATA · 다음 데이터를 계속 보냄"], ["FIN", "FIN · 연결을 닫음"], ["SYN", "SYN · 연결을 새로 엶"]],
      explain: "중복 ACK 하나로는 빠른 재전송이 일어나지 않습니다. 재전송 타이머(RTO, 확인 응답을 기다리는 최대 시간)가 만료되자 서버는 SACK로 비어 있다고 알려진 구간만 다시 보냅니다.",
    },
    {
      packet: 9,
      kind: "ack",
      prompt: "빠졌던 1–1460바이트가 재전송으로 도착했습니다. 1461–2920은 이미 받아 두었습니다. 노트북의 ACK 번호는?",
      choices: [["2921", "2921 · 두 세그먼트 모두 확인"], ["1461", "1461 · 재전송분까지만 확인"], ["1", "1 · 다시 중복 ACK"], ["2920", "2920 · 마지막 바이트 번호"]],
      explain: "빈틈이 메워졌으므로 누적 ACK는 SACK로 보관하던 구간까지 한 번에 건너뜁니다. 2920바이트까지 다 받았으니 다음 바이트 2921을 요청합니다.",
    },
    {
      packet: 11,
      kind: "flags",
      prompt: "노트북이 FIN을 보냈습니다. 서버가 곧바로 보내는 세그먼트의 플래그는?",
      choices: [["ACK"], ["FIN, ACK"], ["RST"], ["SYN, ACK"]],
      explain: "서버는 먼저 노트북의 FIN만 확인(ACK)합니다. 서버 쪽 방향은 보낼 것이 끝난 뒤 자기 FIN으로 따로 닫습니다.",
    },
  ],
  udp: [
    {
      packet: 7,
      kind: "message",
      prompt: "VOICE 7이 도중에 사라졌습니다. 노트북은 다음에 무엇을 보낼까요?",
      choices: [["VOICE 8", "VOICE 8 · 다음 음성 조각"], ["VOICE 7", "VOICE 7 · 사라진 조각을 다시"], ["ACK", "ACK · 받은 것 확인 요청"], ["REMOTE 1", "아무것도 보내지 않고 기다림"]],
      explain: "UDP에는 확인 응답도 재전송도 없습니다. 실시간 음성은 늦게 도착한 조각이 쓸모없으므로 그냥 다음 조각을 보냅니다.",
    },
  ],
  ip: [
    {
      packet: 0,
      kind: "message",
      prompt: "목적지는 다른 네트워크에 있고, ARP 캐시가 비어 있습니다. 노트북이 가장 먼저 보내는 것은?",
      choices: [["ARP REQUEST", "ARP 요청 · 라우터의 MAC 주소 묻기"], ["IP PACKET", "IP 패킷 · 바로 서버로"], ["DNS QUERY", "DNS 쿼리"], ["REPLY", "응답"]],
      explain: "IP 패킷을 라우터에 건네려면 이더넷 프레임에 라우터의 MAC 주소를 적어야 합니다. 모르면 ARP로 먼저 묻습니다.",
    },
    {
      packet: 3,
      kind: "sport",
      prompt: "라우터가 NAT를 적용해 패킷을 내보냅니다. 출발 포트는 몇 번이 될까요?",
      choices: [["40112", "40112 · 라우터가 새로 고른 포트"], ["52344", "52344 · 노트북이 쓴 포트 그대로"], ["443", "443 · 목적지 포트와 같게"], ["80", "80"]],
      explain: "NAT는 출발 주소를 공인 주소로 바꾸고 그 대응을 표에 기록합니다. 이 예시의 라우터는 출발 포트도 40112로 바꿨습니다. 포트가 겹치지 않으면 그대로 두는 NAT도 많습니다. 응답은 이 표로 다시 노트북에 돌아갑니다.",
    },
  ],
  dns: [
    {
      packet: 1,
      kind: "rd",
      prompt: "캐시에 답이 없어 리졸버가 루트 서버에 묻습니다. 이 질의의 RD 비트는?",
      choices: [["0", "RD=0 · 반복 질의 (아는 만큼만 알려 달라)"], ["1", "RD=1 · 재귀 질의 (끝까지 찾아 달라)"]],
      explain: "노트북은 리졸버에 RD=1로 재귀 질의를 보내 조회 전체를 맡겼습니다. 리졸버는 루트·TLD·권한 서버에 RD=0으로 반복 질의를 하며 직접 한 단계씩 내려갑니다. 루트 서버 주소는 리졸버에 미리 들어 있습니다.",
    },
    {
      packet: 2,
      kind: "message",
      prompt: "루트 서버는 www.example.com의 주소를 알까요? 무엇을 돌려줄까요?",
      choices: [["REFERRAL", "리퍼럴 · .com 서버 목록"], ["ANSWER", "응답 · 최종 IP 주소"], ["DNS QUERY", "다른 서버에 대신 물어봄"]],
      explain: "루트 서버는 최종 답을 모릅니다. 대신 .com을 맡은 TLD 서버들의 이름과 주소를 알려 주고 거기서 계속 물으라고 합니다. 이름과 함께 실어 주는 주소를 글루라고 하며, 덕분에 리졸버는 그 서버 이름을 따로 조회하지 않아도 됩니다.",
    },
    {
      packet: 3,
      kind: "route",
      prompt: "리퍼럴을 받은 리졸버는 이제 누구에게 물을까요?",
      choices: [["dns>tld", ".com TLD 서버"], ["dns>root", "루트 서버에 다시"], ["dns>auth", "example.com의 권한 있는 서버"], ["dns>client", "노트북에 리퍼럴을 그대로 전달"]],
      explain: "리퍼럴에 적힌 .com TLD 서버로 같은 질문을 다시 보냅니다. 한 단계씩 이름의 오른쪽에서 왼쪽으로 내려갑니다.",
    },
    {
      packet: 7,
      kind: "address",
      prompt: "리졸버가 노트북에 돌려줄 답은?",
      choices: [["203.0.113.10", "203.0.113.10 · www.example.com"], ["8.8.8.8", "8.8.8.8 · 리졸버"], ["192.168.1.1", "192.168.1.1 · 라우터"], ["198.51.100.7", "198.51.100.7 · 공인 NAT 주소"]],
      explain: "권한 있는 서버가 준 A 레코드를 리졸버가 캐시에 저장하고 노트북에 전달합니다. 다음 질문은 TTL 동안 캐시에서 바로 답합니다.",
    },
  ],
  dhcp: [
    {
      packet: 0,
      kind: "message",
      prompt: "주소가 없는 노트북이 네트워크에 붙었습니다. 처음 보내는 메시지는?",
      choices: [["DISCOVER"], ["REQUEST"], ["OFFER"], ["ACK"]],
      explain: "누가 DHCP 서버인지 모르므로 브로드캐스트로 DISCOVER를 외칩니다. 출발 주소는 0.0.0.0, 목적지는 255.255.255.255입니다.",
    },
    {
      packet: 1,
      kind: "delivery",
      prompt: "라우터(DHCP 서버)가 OFFER로 주소를 제안합니다. 이 OFFER는 브로드캐스트일까요?",
      choices: [["unicast", "아니요 · 노트북의 MAC 주소로 바로 (유니캐스트)"], ["broadcast", "예 · 255.255.255.255로 모두에게 (브로드캐스트)"]],
      explain: "노트북이 DISCOVER에서 브로드캐스트 플래그를 끄고 보냈으므로, 서버는 노트북의 MAC 주소와 제안할 주소(yiaddr)로 바로 보냅니다. 플래그를 켜는 클라이언트에게는 브로드캐스트로 답합니다.",
    },
    {
      packet: 2,
      kind: "message",
      prompt: "OFFER를 받은 노트북은 다음에 무엇을 보낼까요?",
      choices: [["REQUEST"], ["ACK"], ["DISCOVER"], ["OFFER"]],
      explain: "노트북은 어느 서버의 제안을 받아들이는지 REQUEST로 알립니다. 브로드캐스트라 다른 서버들도 자기 제안이 거절된 것을 압니다.",
    },
    {
      packet: 3,
      kind: "message",
      prompt: "REQUEST를 받은 서버의 마지막 메시지는?",
      choices: [["ACK"], ["OFFER"], ["REQUEST"], ["DISCOVER"]],
      explain: "ACK로 임대가 확정되고, 이 순간부터 노트북은 192.168.1.10을 씁니다. DISCOVER-OFFER-REQUEST-ACK를 줄여 DORA라고 부릅니다.",
    },
    {
      packet: 4,
      kind: "message",
      prompt: "임대 기간의 절반이 지났습니다. 노트북은 무엇을 보낼까요?",
      choices: [["REQUEST", "REQUEST · 같은 서버에 연장 요청"], ["DISCOVER", "DISCOVER · 처음부터 다시"], ["OFFER"], ["ACK"]],
      explain: "갱신(T1)에는 이미 아는 서버에 유니캐스트 REQUEST만 보냅니다. 서버가 ACK하면 같은 주소를 계속 씁니다.",
    },
  ],
  icmp: [
    {
      packet: 3,
      kind: "message",
      prompt: "TTL이 1인 패킷이 첫 라우터에 도착했습니다. 라우터는 어떻게 할까요?",
      choices: [["TIME EXCEEDED", "시간 초과 메시지를 돌려보냄"], ["ECHO REPLY", "대신 에코 응답을 보냄"], ["UNREACHABLE", "도달 불가를 보냄"], ["TTL 2", "TTL을 늘려 전달"]],
      explain: "라우터는 TTL을 1 줄이고 0이 되면 패킷을 버린 뒤 ICMP 시간 초과를 보냅니다. traceroute는 이 응답으로 각 홉의 주소를 알아냅니다.",
    },
    {
      packet: 9,
      kind: "message",
      prompt: "아무도 듣지 않는 UDP 포트로 데이터그램을 보냈습니다. 서버의 반응은?",
      choices: [["UNREACHABLE", "ICMP 도달 불가 (포트)"], ["ECHO REPLY", "에코 응답"], ["TIME EXCEEDED", "시간 초과"], ["UDP", "빈 UDP 응답"]],
      explain: "UDP에는 연결 거부가 없으므로 운영체제가 ICMP 포트 도달 불가로 알려 줍니다. 원래 패킷의 헤더 일부가 함께 실립니다.",
    },
  ],
  smtp: [
    {
      packet: 0,
      kind: "port",
      prompt: "메일 앱이 보내는 메일 서버에 연결합니다. 어느 포트일까요?",
      choices: [["465", "465 (SMTPS 제출)"], port(25), port(80), port(995)],
      explain: "메일 앱의 제출은 처음부터 TLS를 쓰는 465(또는 STARTTLS를 쓰는 587)를 씁니다. 25번은 서버끼리 배달할 때 씁니다.",
    },
    {
      packet: 15,
      kind: "route",
      prompt: "메일을 받은 smtp.example.com은 상대 메일 서버를 찾으려고 누구에게 물을까요?",
      choices: [["web>dns", "DNS 리졸버 · MX 레코드 조회"], ["web>mx", "mx.example.org에 바로 연결"], ["web>client", "Alice의 메일 앱에 되묻기"]],
      explain: "받는 주소의 도메인(example.org)에 대한 MX 레코드를 DNS에 묻습니다. 그 답이 메일을 받을 서버의 이름입니다.",
    },
    {
      packet: 25,
      kind: "message",
      prompt: "상대 서버가 STARTTLS를 지원한다고 알렸습니다. 보내는 서버의 다음 명령은?",
      choices: [["STARTTLS"], ["MAIL · RCPT · DATA", "MAIL · RCPT · DATA · 바로 평문으로"], ["EHLO"], ["CLIENT HELLO"]],
      explain: "평문으로 시작한 25번 연결을 STARTTLS로 TLS로 올립니다. 그다음 같은 연결에서 TLS 핸드셰이크가 이어집니다.",
    },
  ],
  pop3: [
    {
      packet: 0,
      kind: "port",
      prompt: "메일 앱이 POP3 서버에 연결합니다. 암호화된 POP3의 포트는?",
      choices: [port(995), ["110", "110 (평문 POP3)"], port(993), port(25)],
      explain: "995는 연결하자마자 TLS를 시작하는 POP3S 포트입니다. 110은 평문 POP3에서 씁니다.",
    },
    {
      packet: 17,
      kind: "message",
      prompt: "1번 메시지를 내려받았습니다. 메일 앱이 다음에 보내는 명령은?",
      choices: [["DELE 1", "DELE 1 · 서버에서 지우기 표시"], ["QUIT"], ["RETR 1"], ["LIST"]],
      explain: "POP3는 내려받은 메일을 서버에서 지우는 방식을 기본으로 합니다. DELE는 표시만 하고 QUIT 때 실제로 지웁니다.",
    },
  ],
  imap: [
    {
      packet: 13,
      kind: "message",
      prompt: "FETCH로 2번 메일 본문을 받았습니다. 이 메일은 서버에 남을까요? 앱의 다음 명령은?",
      choices: [["a4 IDLE", "a4 IDLE · 메일은 서버에 둔 채 새 메일을 기다림"], ["DELE 2", "DELE 2 · POP3처럼 서버에서 지움"], ["a4 LOGOUT", "a4 LOGOUT · 받았으니 연결을 끝냄"]],
      explain: "IMAP에서 FETCH는 사본을 받을 뿐 메일은 서버에 남고 \\Seen 표시만 붙습니다. 그래서 휴대폰과 웹메일에서도 같은 메일이 보입니다. POP3 레슨에서는 RETR 뒤 DELE로 서버에서 지웠습니다.",
    },
    {
      packet: 0,
      kind: "port",
      prompt: "메일 앱이 IMAP 서버에 연결합니다. 암호화된 IMAP의 포트는?",
      choices: [port(993), ["143", "143 (평문 IMAP)"], port(995), port(443)],
      explain: "993은 연결 즉시 TLS를 시작하는 IMAPS 포트입니다.",
    },
    {
      packet: 15,
      kind: "message",
      prompt: "IDLE로 기다리는 중에 새 메일이 도착했습니다. 서버는?",
      choices: [["* 3 EXISTS", "* 3 EXISTS · 새 메일 수를 바로 알림"], ["a4 OK", "a4 OK · IDLE을 끝냄"], ["MESSAGE", "메일 본문을 바로 보냄"], ["DONE"]],
      explain: "IDLE 중에는 앱이 묻지 않아도 서버가 상태 변화를 태그 없는 응답(*)으로 밀어 줍니다. 본문은 앱이 다시 요청할 때 받습니다.",
    },
  ],
  ftp: [
    {
      packet: 0,
      kind: "port",
      prompt: "FTP 제어 연결은 서버의 어느 포트로 열까요?",
      choices: [port(21), ["20", "20 (액티브 모드 데이터)"], port(22), port(80)],
      explain: "명령과 응답은 21번 제어 연결로 오갑니다. 파일 자체는 별도의 데이터 연결로 옮깁니다.",
    },
    {
      packet: 12,
      kind: "connect",
      prompt: "PASV에 227 (203,0,113,21,195,149)로 답이 왔습니다. 데이터 연결을 여는 쪽과 포트는?",
      choices: [
        ["client>web:50069", "클라이언트가 서버의 50069번으로 (195×256+149)"],
        ["web>client:20", "서버가 20번 포트에서 클라이언트로"],
        ["client>web:21", "클라이언트가 서버의 21번으로"],
        ["client>web:195149", "클라이언트가 서버의 195149번으로"],
      ],
      explain: "패시브 모드에서는 클라이언트가 데이터 연결을 엽니다. 마지막 두 수는 포트의 상위·하위 바이트라 195×256+149=50069입니다. 액티브 모드라면 클라이언트가 PORT로 자기 주소를 알려 주고 서버가 20번 포트에서 거꾸로 연결해 NAT·방화벽에 막히기 쉽습니다.",
    },
  ],
  ssh: [
    {
      packet: 3,
      kind: "message",
      prompt: "TCP 연결이 열렸습니다. SSH에서 가장 먼저 오가는 것은?",
      choices: [["VERSION", "버전 문자열 (SSH-2.0-…)"], ["KEXINIT", "키 교환 시작"], ["SERVICE REQUEST", "로그인 서비스 요청"], ["NEWKEYS", "새 키 사용 시작 (NEWKEYS)"]],
      explain: "양쪽은 먼저 평문 한 줄로 SSH 버전과 프로그램 이름을 교환합니다. 그다음 키 교환 알고리즘을 협상합니다.",
    },
    {
      packet: 14,
      kind: "message",
      prompt: "클라이언트가 'none' 방식으로 로그인을 시도했습니다. 서버의 답은?",
      choices: [["AUTH FAILURE", "실패 · 가능한 방식 목록과 함께"], ["SUCCESS", "성공 · 바로 로그인"], ["PK OK", "공개 키 승인 (PK_OK)"], ["SERVICE ACCEPT", "서비스 수락 (SERVICE_ACCEPT)"]],
      explain: "none은 서버가 허용하는 인증 방식을 알아보려는 시도입니다. 서버는 실패와 함께 publickey,password 같은 목록을 돌려줍니다.",
    },
    {
      packet: 22,
      kind: "message",
      prompt: "사용자가 p 키를 눌렀습니다. 서버는 무엇을 돌려보낼까요?",
      choices: [["ECHO", "에코 · 글자를 되돌려 화면에 표시"], ["OUTPUT", "명령 실행 결과"], ["SUCCESS", "요청 성공 알림 (SUCCESS)"], ["CONFIRMED", "채널 열림 확인 (CONFIRMED)"]],
      explain: "원격 셸은 입력한 글자를 되돌려 보내 터미널에 표시합니다. 그래서 키 하나에도 암호화된 패킷이 왕복합니다.",
    },
  ],
  tls: [
    {
      packet: 3,
      kind: "message",
      prompt: "TCP 핸드셰이크가 끝났습니다. TLS를 시작하는 첫 메시지는?",
      choices: [["CLIENT HELLO"], ["SERVER HELLO"], ["FINISHED"], ["APP DATA"]],
      explain: "브라우저가 Client Hello로 지원하는 암호 스위트와 키 공유 값을 먼저 보냅니다. TLS 1.3에서는 이 한 번에 키 재료까지 실립니다.",
    },
    {
      packet: 4,
      kind: "message",
      prompt: "Client Hello를 받은 서버는 무엇으로 답할까요?",
      choices: [["SERVER HELLO"], ["FINISHED"], ["TICKETS"], ["APP DATA"]],
      explain: "Server Hello로 암호 스위트를 고르고 자기 키 공유 값을 보냅니다. 이후 인증서와 Finished는 이미 암호화되어 이어집니다.",
    },
    {
      packet: 7,
      kind: "message",
      prompt: "서버의 인증서와 Finished를 검증했습니다. 브라우저의 다음 메시지는?",
      choices: [["FINISHED"], ["CLIENT HELLO"], ["CLOSE_NOTIFY"], ["TICKETS"]],
      explain: "브라우저도 지금까지의 핸드셰이크 전체에 대한 확인 값을 Finished로 보냅니다. 바로 뒤에 암호화된 HTTP 요청이 따라갑니다.",
    },
    {
      packet: 12,
      kind: "flags",
      prompt: "close_notify로 TLS를 끝냈습니다. 그다음 서버가 보내는 TCP 세그먼트는?",
      choices: [["FIN, ACK"], ["RST"], ["SYN"], ["PSH, ACK"]],
      explain: "TLS를 닫은 뒤 TCP 연결도 FIN으로 정상 종료합니다. close_notify가 먼저 오므로 잘린 데이터 공격과 구별할 수 있습니다.",
    },
  ],
};

export { lessonQuizzes };
