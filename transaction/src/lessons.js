// The transaction explorer's lessons, in the order of the lesson rail.
// { id, name, sub } for the rail; title for the header context. A lesson
// with href lives on its own page; the others switch by ?lesson= on index.html.
export const EXPLORER = "transaction";
export const RAIL_TITLE = "트랜잭션과 잠금";

export const LESSONS = Object.freeze([
  { id: "lost-update", name: "갱신 유실", sub: "읽기 잠금의 시점", title: "같은 재고, 두 개의 주문" },
  { id: "deadlock", name: "교착 상태", sub: "잠금 순서와 롤백", title: "두 행을 줄이는 두 주문", href: "deadlock.html" },
  { id: "repeatable-read", name: "직렬화 오류", sub: "REPEATABLE READ와 재시도", title: "더 강한 격리, 같은 두 주문" },
  { id: "write-skew", name: "쓰기 왜곡", sub: "SERIALIZABLE의 검사", title: "당직 의사 두 명" },
]);

export const lessonById = (id) => LESSONS.find((l) => l.id === id);
export const lessonNumber = (id) => String(LESSONS.findIndex((l) => l.id === id) + 1).padStart(2, "0");
