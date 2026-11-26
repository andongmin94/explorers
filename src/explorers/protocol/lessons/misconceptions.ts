// 오개념 바로잡기 for the fourteen protocol lessons (docs/DESIGN.md →
// Learning model): a belief learners commonly hold, the precise statement
// (from the RFCs) and what this lesson's run shows. `scene` is the 1-based
// 단계 where it becomes visible; the 해설 shows it there (unless a pending
// prediction holds that step) and 정리 lists them all. `evidence` are strings
// of the lesson's own data (packet rows, payloads, step text) that `check`
// relies on; test/learning.test.ts asserts they are still in the lesson, so
// the check cannot drift from the packets.
import type { Misconception } from "@/lib/lesson-kit.ts";

export interface ProtocolMisconception extends Misconception {
  scene: number;
  evidence: string[];
}

const misconceptions: Record<string, ProtocolMisconception[]> = {
  http: [
    {
      id: "http-name",
      wrong: "브라우저는 주소창의 이름(www.example.com)으로 바로 서버에 접속한다.",
      right:
        "패킷은 IP 주소로만 전달됩니다. 브라우저는 먼저 DNS로 이름을 IP 주소로 바꾼 뒤에 연결합니다(RFC 1034).",
      check:
        "2단계에서 노트북이 8.8.8.8에 www.example.com을 묻고 A 레코드 203.0.113.10을 받은 뒤에야 서버로 SYN을 보냅니다.",
      scene: 2,
      evidence: ["8.8.8.8", "203.0.113.10"],
    },
    {
      id: "http-private",
      wrong: "http:// 페이지도 오가는 내용은 중간 장비가 볼 수 없다.",
      right:
        "HTTP는 암호화하지 않습니다. 경로의 공유기, 와이파이, 통신사 장비 누구나 요청 줄, 헤더, 본문을 그대로 읽고 바꿀 수 있습니다(RFC 9110 §17).",
      check:
        "4단계 패킷을 열면 GET 요청 줄과 Host 헤더가 읽을 수 있는 글자 그대로 바이트에 보입니다.",
      scene: 4,
      evidence: ["GET /", "Host"],
    },
    {
      id: "http-one-request",
      wrong: "웹 페이지 하나는 요청 한 번으로 받는다.",
      right:
        "HTML은 첫 응답일 뿐입니다. 그 안에 연결된 CSS, 이미지, 스크립트는 각각 따로 요청하며, 가능하면 열려 있는 연결을 재사용합니다.",
      check:
        "5단계: 브라우저가 HTML을 그리면서 연결된 CSS, 이미지, 스크립트마다 같은 요청을 다시 시작합니다.",
      scene: 5,
      evidence: ["CSS"],
    },
  ],
  https: [
    {
      id: "https-hides-name",
      wrong: "HTTPS를 쓰면 어느 사이트에 접속하는지도 숨겨진다.",
      right:
        "DNS 조회는 기본적으로 평문이고, TLS Client Hello의 SNI도 서버 이름을 평문으로 보냅니다. 경로에서는 IP 주소와 사이트 이름이 보입니다(RFC 6066 §3).",
      check:
        "2단계의 DNS 질의가 UDP 53번으로 www.example.com을 평문으로 묻고, 4단계 Client Hello에 SNI=www.example.com이 실립니다.",
      scene: 2,
      evidence: ["SNI=www.example.com", "53"],
    },
    {
      id: "https-replaces-tcp",
      wrong: "HTTPS는 TCP 대신 TLS로 바로 연결한다.",
      right:
        "TLS는 TCP 연결 위에서 시작합니다. 443번 포트로 SYN·SYN-ACK·ACK를 먼저 마친 뒤 Client Hello를 보냅니다(RFC 8446).",
      check: "3단계에서 TCP 3방향 핸드셰이크가 끝난 뒤에야 4단계 Client Hello가 나갑니다.",
      scene: 4,
      evidence: ["Client Hello"],
    },
    {
      id: "https-hides-url",
      wrong: "HTTPS는 접속 주소(URL)와 통신 사실까지 모두 숨긴다.",
      right:
        "경로(/index.html), 쿼리, 헤더, 본문은 암호화됩니다. 그러나 IP·TCP 헤더(주소와 포트), 패킷 크기와 시각은 라우터가 읽어야 하므로 그대로 보입니다.",
      check:
        "5단계의 GET과 200 OK는 Application Data로만 보이지만, 같은 패킷의 IP 주소와 443번 포트는 평문입니다.",
      scene: 5,
      evidence: ["Application Data", "443"],
    },
  ],
  tcp: [
    {
      id: "tcp-handshake-data",
      wrong: "TCP 3방향 핸드셰이크 동안 요청 데이터도 함께 전송된다.",
      right:
        "SYN, SYN-ACK, ACK는 양쪽의 시작 시퀀스 번호를 맞추는 제어 세그먼트입니다. 이 연결에서 데이터는 핸드셰이크가 끝난 뒤에 나갑니다(RFC 9293 §3.5).",
      check:
        "1단계의 SYN(Seq=0)과 SYN-ACK(Ack=1)에는 데이터가 없고, 78바이트 요청은 2단계 [PSH, ACK]로 나갑니다.",
      scene: 1,
      evidence: ["[SYN] Seq=0", "[SYN, ACK] Seq=0 Ack=1", "Len=78"],
    },
    {
      id: "tcp-ack-count",
      wrong: "ACK 번호는 받은 패킷의 개수나 마지막으로 받은 바이트 번호다.",
      right:
        "ACK 번호는 다음에 받기를 기대하는 바이트 번호입니다. 그 앞의 바이트는 모두 받았다는 뜻입니다.",
      check: "2단계: 바이트 1–78을 받은 서버가 Ack=79를 보냅니다.",
      scene: 2,
      evidence: ["Ack=79"],
    },
    {
      id: "tcp-resend-all",
      wrong: "세그먼트 하나가 사라지면 그 뒤의 데이터를 모두 다시 보낸다.",
      right:
        "받는 쪽이 SACK로 받은 구간을 알리면 보내는 쪽은 빠진 세그먼트만 재전송하고, 누적 ACK가 빈틈 뒤까지 한 번에 오릅니다(RFC 2018).",
      check:
        "5단계: 서버는 첫 세그먼트(1–1460) 하나만 다시 보내고, 노트북의 ACK가 2921로 건너뜁니다.",
      scene: 5,
      evidence: ["2921", "SACK"],
    },
  ],
  udp: [
    {
      id: "udp-handshake",
      wrong: "UDP도 데이터를 보내기 전에 연결을 연다.",
      right:
        "UDP에는 핸드셰이크가 없습니다. 첫 데이터그램부터 8바이트 헤더 뒤에 데이터를 싣습니다(RFC 768).",
      check: "1단계의 첫 패킷이 곧바로 음성 20 ms를 실은 데이터그램입니다.",
      scene: 1,
      evidence: ["RTP"],
    },
    {
      id: "udp-retransmits",
      wrong: "UDP 패킷이 사라지면 UDP가 다시 보내 준다.",
      right:
        "UDP는 확인 응답도 재전송도 하지 않습니다. 사라진 데이터그램은 사라진 채로 끝나고, 보낸 쪽은 알지 못합니다.",
      check:
        "3단계: 프레임 7이 버려져도 돌아오는 패킷이 없고, 뒤의 데이터그램은 평소처럼 도착합니다.",
      scene: 3,
      evidence: ["frame 7"],
    },
    {
      id: "udp-nobody-knows",
      wrong: "UDP를 쓰면 손실을 아무도 알아챌 수 없다.",
      right:
        "UDP 자체는 알리지 않지만, 그 위의 앱 프로토콜(RTP)이 시퀀스 번호로 빈 곳을 알아채고 보정할 수 있습니다. 신뢰성은 앱의 몫입니다.",
      check:
        "5단계: 서버가 프레임 6과 8의 RTP 시퀀스 번호에서 7이 비었음을 알아내고 20 ms를 보정합니다.",
      scene: 5,
      evidence: ["RTP sequence numbers"],
    },
  ],
  ip: [
    {
      id: "ip-arp-server",
      wrong: "다른 네트워크의 서버로 보낼 때도 노트북은 그 서버의 MAC 주소를 찾는다.",
      right:
        "목적지가 내 서브넷 밖이면 프레임은 기본 게이트웨이로 갑니다. ARP로 찾는 것은 라우터의 MAC이고, IP 목적지는 서버 주소 그대로입니다(RFC 826, RFC 1122).",
      check: "2단계 ARP는 192.168.1.1을 묻고, 3단계 패킷의 IP 목적지는 203.0.113.10입니다.",
      scene: 2,
      evidence: ["192.168.1.1", "203.0.113.10"],
    },
    {
      id: "ip-addresses-fixed",
      wrong: "IP 패킷의 주소는 출발부터 도착까지 바뀌지 않는다.",
      right:
        "공유기의 NAT가 사설 출발지 주소와 포트를 공인 주소로 바꾸고, 라우터는 홉마다 TTL을 1씩 줄입니다(RFC 3022, RFC 791).",
      check:
        "4단계: 출발지 192.168.1.10:52344가 198.51.100.7:40112로 바뀌고 TTL이 128에서 127로 줄어듭니다.",
      scene: 4,
      evidence: ["198.51.100.7", "40112", "52344"],
    },
    {
      id: "ip-ttl-time",
      wrong: "TTL은 패킷이 살아 있는 시간(초)이다.",
      right: "TTL은 사실상 홉 수입니다. 라우터를 지날 때마다 1씩 줄고, 0이 되면 패킷이 버려집니다.",
      check: "5단계 응답은 TTL 64로 출발해 52로 도착합니다. 라우터 12개를 지났다는 뜻입니다.",
      scene: 5,
      evidence: ["TTL 64", "52"],
    },
  ],
  dns: [
    {
      id: "dns-client-walks",
      wrong: "노트북이 루트 서버부터 차례로 직접 묻는다.",
      right:
        "노트북은 재귀 리졸버에 질문 하나(RD=1)만 보냅니다. 루트·TLD·권한 서버에 차례로 묻는 것은 리졸버의 반복 질의(RD=0)입니다(RFC 1034 §4.3.1).",
      check: "1단계 질의는 노트북 → 8.8.8.8 하나뿐이고, 2–4단계 질의는 리졸버가 RD=0으로 보냅니다.",
      scene: 2,
      evidence: ["RD=0 (iterative query)", "flags: RD"],
    },
    {
      id: "dns-root-knows",
      wrong: "루트 서버는 모든 도메인의 IP 주소를 알고 있다.",
      right:
        "루트는 .com을 맡은 서버를, .com 서버는 example.com의 네임 서버를 알려 주는 리퍼럴로만 답합니다. 실제 A 레코드는 권한 있는 서버가 줍니다.",
      check: "2·3단계 응답은 리퍼럴이고, 4단계에서야 권한 있음 표시가 붙은 A 레코드가 옵니다.",
      scene: 4,
      evidence: ["A? www.example.com"],
    },
    {
      id: "dns-always-root",
      wrong: "DNS는 이름을 찾을 때마다 항상 루트 서버까지 간다.",
      right:
        "리졸버와 노트북은 답을 TTL 동안 캐시합니다. 그동안 같은 이름은 루트까지 가지 않고 바로 답합니다.",
      check:
        "5단계: 리졸버가 TTL 3600초짜리 답을 보관하므로, 한 시간 안의 같은 질문은 캐시에서 바로 답합니다.",
      scene: 5,
      evidence: ["3600"],
    },
  ],
  dhcp: [
    {
      id: "dhcp-unicast",
      wrong: "새 노트북은 공유기 주소로 DHCP 요청을 보낸다.",
      right:
        "아직 자기 IP도 서버 주소도 모르므로, 출발지 0.0.0.0에서 브로드캐스트 주소 255.255.255.255로 Discover를 보냅니다(RFC 2131).",
      check: "2단계 Discover의 출발지는 0.0.0.0, 목적지는 255.255.255.255입니다.",
      scene: 2,
      evidence: ["0.0.0.0", "255.255.255.255"],
    },
    {
      id: "dhcp-offer-final",
      wrong: "Offer를 받으면 노트북은 곧바로 그 주소를 쓴다.",
      right:
        "Offer는 제안일 뿐입니다. Request로 그 주소를 수락하고 서버의 ACK를 받은 뒤에야 주소, 게이트웨이, DNS를 설정합니다.",
      check:
        "3단계 Offer 뒤에 4단계 Request와 5단계 ACK가 오고, 그다음에야 노트북이 주소를 설정합니다.",
      scene: 5,
      evidence: ["Request", "ACK"],
    },
    {
      id: "dhcp-forever",
      wrong: "DHCP로 한 번 받은 IP 주소는 계속 내 것이다.",
      right:
        "주소는 임대입니다. 임대 기간의 절반(T1)에 서버에 직접 갱신을 요청하고, 갱신하지 못하면 결국 주소를 잃습니다.",
      check: "6단계: 24시간 임대의 절반인 12시간에 노트북이 라우터에 직접 갱신을 요청합니다.",
      scene: 6,
      evidence: ["24 h, renewed at 12 h"],
    },
  ],
  icmp: [
    {
      id: "icmp-port",
      wrong: "ping은 웹 서버 프로그램(포트)이 살아 있는지 확인한다.",
      right:
        "ICMP 에코에는 포트가 없고, 서버의 운영체제가 직접 답합니다. 웹 서버 프로그램이 멈춰 있어도 ping은 응답할 수 있습니다(RFC 792).",
      check: "1·2단계 에코 요청(유형 8)과 응답(유형 0)에는 포트 번호가 없습니다.",
      scene: 2,
      evidence: ["type 8"],
    },
    {
      id: "icmp-trace-records",
      wrong: "traceroute는 패킷 하나가 지나간 라우터를 기록해 온다.",
      right:
        "TTL을 1, 2, 3 …으로 늘린 프로브를 따로 보내고, TTL이 0이 된 라우터가 돌려보낸 시간 초과 메시지로 홉을 하나씩 알아냅니다.",
      check: "3단계: TTL 1로 보낸 요청에 192.168.1.1이 시간 초과(Time Exceeded)로 답합니다.",
      scene: 3,
      evidence: ["Time Exceeded", "192.168.1.1"],
    },
    {
      id: "icmp-ping-down",
      wrong: "ping에 응답이 없으면 서버가 꺼진 것이다.",
      right:
        "많은 방화벽이 ICMP를 조용히 버리므로 응답이 없다고 서버가 꺼졌다고 단정할 수 없습니다. 반대로 도달 불가 응답은 그 호스트가 켜져서 답했다는 뜻입니다.",
      check:
        "6단계: 9999번 포트로 간 데이터그램에 서버가 목적지 도달 불가(코드 3)로 답합니다. 서버는 켜져 있습니다.",
      scene: 6,
      evidence: ["9999", "Destination Unreachable"],
    },
  ],
  smtp: [
    {
      id: "smtp-base64",
      wrong: "AUTH PLAIN의 base64가 비밀번호를 암호화한다.",
      right:
        "base64는 인코딩이라 누구나 되돌릴 수 있습니다. 이 세션에서 비밀번호를 지키는 것은 465번 포트에서 처음부터 시작한 TLS입니다(RFC 4616, RFC 8314).",
      check: "2단계의 AUTH PLAIN 값은 base64 문자열이고, 이 대화는 1단계부터 TLS 안에서 오갑니다.",
      scene: 2,
      evidence: ["AUTH PLAIN", "465"],
    },
    {
      id: "smtp-direct",
      wrong: "이메일은 보내는 사람 컴퓨터에서 받는 사람 컴퓨터로 바로 간다.",
      right:
        "메일 앱은 자기 제공업체의 제출 서버에 넘기고, 제공업체가 DNS MX 조회로 받는 쪽 메일 서버를 찾아 서버끼리 전달합니다. 받는 사람은 나중에 POP3나 IMAP으로 가져갑니다(RFC 5321).",
      check: "4단계: Alice의 제공업체가 example.org의 MX를 물어 mx.example.org를 찾습니다.",
      scene: 4,
      evidence: ["mx.example.org", "MX"],
    },
    {
      id: "smtp-relay-encrypted",
      wrong: "서버와 서버 사이의 메일 전달은 처음부터 암호화돼 있다.",
      right:
        "25번 포트의 서버 간 대화는 평문으로 시작하고, STARTTLS로 전환해야 암호화됩니다(RFC 3207).",
      check: "5단계: 220 인사와 EHLO가 평문으로 오간 뒤 STARTTLS → 220으로 TLS가 시작됩니다.",
      scene: 5,
      evidence: ["STARTTLS"],
    },
  ],
  pop3: [
    {
      id: "pop3-pass",
      wrong: "POP3의 PASS 명령은 비밀번호를 암호화해서 보낸다.",
      right:
        "POP3 명령은 평문입니다. 이 세션에서 비밀번호를 지키는 것은 995번 포트에서 처음부터 시작한 TLS입니다(RFC 1939, RFC 8314).",
      check: "1단계에서 TLS가 먼저 시작되고, 2단계 USER와 PASS는 그 안에서 오갑니다.",
      scene: 2,
      evidence: ["995", "PASS"],
    },
    {
      id: "pop3-dele",
      wrong: "DELE를 보내면 그 순간 서버에서 메일이 지워진다.",
      right:
        "DELE는 삭제 표시만 합니다. QUIT으로 세션을 정상 종료할 때 지우며, 그 전에 연결이 끊기면 아무것도 지워지지 않습니다(RFC 1939 §6).",
      check: "5단계: DELE 1에 +OK가 와도 메시지는 QUIT 뒤에야 지워집니다.",
      scene: 5,
      evidence: ["DELE 1", "QUIT"],
    },
  ],
  imap: [
    {
      id: "imap-order",
      wrong: "서버의 응답은 보낸 명령 순서대로 한 줄씩만 온다.",
      right:
        "IMAP은 명령마다 태그(a1 …)를 붙이고 서버가 같은 태그로 끝맺어 응답을 짝짓습니다. *로 시작하는 줄은 태그 없는 데이터입니다(RFC 3501 §2.2).",
      check: "2단계: a1 LOGIN에 서버가 a1 OK로 답을 끝맺습니다.",
      scene: 2,
      evidence: ["a1"],
    },
    {
      id: "imap-moves",
      wrong: "메일을 읽으면 내 기기로 옮겨지고 서버에서는 사라진다.",
      right:
        "IMAP의 FETCH는 사본을 가져올 뿐 메시지는 서버에 남고, \\Seen 플래그가 붙어 다른 기기에서도 읽음으로 보입니다.",
      check: "4단계: FETCH 2 뒤 메시지 2에 \\Seen 플래그가 붙고, 메시지는 서버에 그대로 남습니다.",
      scene: 4,
      evidence: ["\\\\Seen", "FETCH 2"],
    },
    {
      id: "imap-polling",
      wrong: "새 메일을 알려면 앱이 몇 초마다 서버에 다시 물어야 한다.",
      right:
        "IDLE을 쓰면 연결을 열어 둔 채 기다리고, 변경이 생기면 서버가 먼저 알립니다(RFC 2177).",
      check: "5단계: IDLE 중에 서버가 * 3 EXISTS를 먼저 보냅니다.",
      scene: 5,
      evidence: ["EXISTS", "IDLE"],
    },
  ],
  ftp: [
    {
      id: "ftp-login-safe",
      wrong: "FTP 로그인은 비밀번호를 보호해서 보낸다.",
      right:
        "FTP는 USER와 PASS를 평문으로 보냅니다. 암호화가 필요하면 SFTP(SSH 위)나 FTPS(TLS 안의 FTP)를 씁니다(RFC 959).",
      check: "2단계 PASS 명령의 바이트에 비밀번호가 읽을 수 있는 글자 그대로 보입니다.",
      scene: 2,
      evidence: ["PASS"],
    },
    {
      id: "ftp-one-connection",
      wrong: "FTP는 연결 하나로 명령과 파일 데이터를 함께 보낸다.",
      right: "명령과 응답은 21번 포트의 제어 연결로, 파일은 따로 연 데이터 연결로 갑니다(RFC 959).",
      check: "4단계: 50069번 포트로 두 번째 TCP 연결이 열리고, RETR 명령은 제어 연결로 갑니다.",
      scene: 4,
      evidence: ["50069", "RETR report.pdf"],
    },
    {
      id: "ftp-length",
      wrong: "FTP는 파일 크기를 먼저 알려 주고 그만큼 받으면 끝난다.",
      right:
        "스트림 모드에서는 서버가 데이터 연결을 닫아 파일의 끝을 알리고, 제어 연결의 226으로 완료를 확인합니다.",
      check: "5단계: 4,000바이트를 보낸 뒤 서버가 데이터 연결을 닫고, 제어 연결로 226이 옵니다.",
      scene: 5,
      evidence: ["226"],
    },
  ],
  ssh: [
    {
      id: "ssh-all-encrypted",
      wrong: "SSH는 연결 직후부터 모든 것이 암호화된다.",
      right:
        "버전 문자열과 KEXINIT 알고리즘 목록, 키 교환 값은 평문입니다. NEWKEYS 뒤부터 암호화됩니다(RFC 4253).",
      check:
        "1단계에서 SSH-2.0 버전 줄이 평문으로 보이고, 3단계 NEWKEYS 뒤의 패킷부터 암호화됩니다.",
      scene: 1,
      evidence: ["SSH-2.0", "NEWKEYS"],
    },
    {
      id: "ssh-key-sent",
      wrong: "공개 키 로그인은 개인 키나 비밀번호를 서버로 보낸다.",
      right:
        "개인 키는 노트북을 떠나지 않습니다. 이 세션 값에 대한 서명만 보내고, 서버가 authorized_keys의 공개 키로 검증합니다(RFC 4252 §7).",
      check: "4단계: PK_OK 뒤 노트북이 보내는 것은 서명이며, 키 자체는 오가지 않습니다.",
      scene: 4,
      evidence: ["PK_OK", "authorized_keys"],
    },
    {
      id: "ssh-line",
      wrong: "SSH 셸에서는 Enter를 누를 때 명령 한 줄이 한 번에 간다.",
      right:
        "대화형 셸에서는 키를 누를 때마다 암호화된 패킷이 하나씩 바로 나가고, 서버가 그 문자를 에코로 돌려보내 화면에 보입니다.",
      check: "6단계: pwd의 p, w, d와 Enter가 각각 별도의 keystroke 패킷으로 갑니다.",
      scene: 6,
      evidence: ["keystroke", "keystroke (Enter)"],
    },
  ],
  tls: [
    {
      id: "tls-sni-hidden",
      wrong: "TLS를 쓰면 접속하려는 사이트 이름도 처음부터 암호화된다.",
      right:
        "Client Hello는 평문이라 SNI의 서버 이름이 경로에서 보입니다. 이름까지 숨기려면 ECH 같은 확장이 필요합니다(RFC 6066 §3).",
      check: "1단계 Client Hello에 SNI=www.example.com이 평문으로 실립니다.",
      scene: 1,
      evidence: ["SNI=www.example.com"],
    },
    {
      id: "tls-cert-encrypts",
      wrong: "TLS는 인증서의 공개 키로 데이터를 암호화한다.",
      right:
        "TLS 1.3에서 인증서의 공개 키는 서명 검증(신원 확인)에만 씁니다. 데이터는 Hello의 키 공유로 합의한 대칭 세션 키로 암호화합니다(RFC 8446 §4.4).",
      check:
        "2단계 Server Hello의 키 공유로 양쪽이 키를 계산한 뒤, 인증서는 3단계에야 그 키로 암호화된 채 도착합니다.",
      scene: 3,
      evidence: ["Server Hello", "key share"],
    },
    {
      id: "tls-fin-enough",
      wrong: "TCP 연결이 닫히면 데이터가 끝까지 다 온 것이다.",
      right:
        "공격자도 TCP FIN을 위조해 연결을 자를 수 있습니다. TLS는 암호화된 close_notify 경고로 의도한 종료임을 알립니다(RFC 8446 §6.1).",
      check: "6단계: 암호화된 close_notify 경고가 먼저 가고, 그다음에 TCP FIN이 갑니다.",
      scene: 6,
      evidence: ["close_notify", "FIN"],
    },
  ],
};

export { misconceptions };
