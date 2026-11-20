// Scene for the isolation lessons (03, 04): the same two laptops and database
// as lessons 01–02. The row table on the database top shows each row with its
// committed value (LCD cell), its uncommitted write (a token in the writer's
// colour) and its lock owner (LOCK cell, row LED). Lesson 03 has one stock row
// (like lesson 01), lesson 04 the two doctor rows A and B (like lesson 02).
// SQL requests travel as tokens on the cables; a blocked UPDATE waits in its
// WAIT pocket; a serialization failure travels back to the laptop as a
// "40001" token.
import { eul, ga } from "../../shared/josa.js";
import { getIsolationPresentationState as present } from "./isolation-engine.js";
import {
  COLORS,
  PARK,
  ROUTES,
  createMoves,
  createRunner,
  mountScene,
  place,
  sceneSvg,
  setLock,
  setScreen,
  setStatus,
  setWaiting,
  sqlToken,
} from "./stage.js";

const IDS = ["T1", "T2"];
const STATUS = { idle: "IDLE", active: "ACTIVE", waiting: "WAITING", aborted: "ABORTED", rolledback: "ROLLED BACK", committed: "COMMITTED" };

const latest = (state, row) => state.rows[row].versions.at(-1).value;

export function createIsolationScene(host, lesson, { onPhase = () => {} } = {}) {
  const single = lesson.rows.length === 1;
  const scene = sceneSvg({
    label: `두 트랜잭션이 ${lesson.db.title}에 보내는 SQL과 행 잠금, 커밋된 값의 변화`,
    rows: lesson.rows.map((r) => ({ id: r.id, name: single ? r.id : r.label })),
    valueHeader: single ? lesson.rows[0].label : "DUTY",
    valueSize: single ? undefined : 18,
    screens: lesson.screens,
    dbSub: lesson.db.sub,
    dbTitle: lesson.db.title,
    names: lesson.names,
  });
  const svg = mountScene(host, scene);
  const at = scene.at;
  const runner = createRunner(svg);
  const moves = createMoves(svg, runner);
  const $ = (s) => svg.querySelector(s);
  const mobile = matchMedia("(max-width: 759px)");
  const text = lesson.valueText;
  // Lesson 03 has one row (the stock); lesson 04 names its rows A and B.
  const rowName = (row) => (single ? "재고" : row);
  let painted = null;

  function paint(state, { hideParked = null } = {}) {
    painted = state;
    for (const id of IDS) {
      const c = state.clients[id];
      setScreen(svg, id, lesson.screenValues(c));
      setStatus(svg, id, STATUS[c.status]);
      $(`[data-client="${id}"]`).dataset.status = c.status === "rolledback" ? "aborted" : c.status;
    }
    const pending = $(".tx-pending");
    for (const { id } of lesson.rows) {
      const r = state.rows[id];
      $(`[data-lcd="${id}"] text`).textContent = text(latest(state, id));
      setLock(svg, at, id, r.owner);
      const key = r.pending ? `${r.pending.client}:${r.pending.value}` : "";
      const token = pending.querySelector(`[data-pend="${id}"]`);
      if (token?.dataset.key === key) continue;
      token?.remove();
      if (!key) continue;
      pending.insertAdjacentHTML(
        "beforeend",
        `<g class="tx-pend" data-pend="${id}" data-key="${key}">${sqlToken({ text: text(r.pending.value), color: COLORS[r.pending.client], w: single ? 1.3 : 1.4, d: single ? 0.85 : 0.72, h: single ? 0.38 : 0.3, size: single ? 13 : 11 })}</g>`,
      );
      place(pending.lastElementChild, ...at[id].pending);
    }
    const parked = $(".tx-parked");
    const waiting = IDS.filter((id) => state.clients[id].waitingFor && id !== hideParked);
    setWaiting(svg, waiting);
    parked.innerHTML = waiting
      .map((id) => {
        const row = state.clients[id].waitingFor;
        return `<g class="tx-park ${state.rows[row].owner ? "is-blocked" : "is-ready"}" data-park="${id}">${sqlToken({ text: lesson.token({ action: "update", row }), color: COLORS[id], w: 2.5 })}</g>`;
      })
      .join("");
    for (const g of parked.children) place(g, ...PARK[g.dataset.park]);
  }

  const phase = (title, body = "") => onPhase({ title, body, snapshot: painted });

  function completedTitle(step) {
    const s = step.state;
    const c = step.client ? s.clients[step.client] : null;
    const id = step.client;
    switch (step.action) {
      case "initial":
        return lesson.rows.length === 1 ? "두 주문이 같은 재고 행을 1개씩 줄이려 합니다" : "의사 A와 B가 동시에 당직을 빠지려 합니다";
      case "begin":
        return `${id} 트랜잭션을 시작했습니다${c.attempt > 1 ? " · 재시도" : ""}`;
      case "select":
        return `${id} 앱이 ${lesson.screens[0]} ${eul(c.read)} 받았습니다`;
      case "decide":
        return `${id} 앱 판단 · ${c.plan === "off" ? "빠져도 된다" : "빠질 수 없다"}`;
      case "write":
      case "resume-write":
        return `${ga(id)} ${rowName(step.row)} ${eul(text(s.rows[step.row].pending.value))} 썼습니다 · 커밋 전`;
      case "wait":
        return `${id}의 UPDATE가 ${s.rows[step.row].owner}의 잠금 해제를 기다립니다`;
      case "commit":
        return `${id} 커밋 완료${lesson.rows.length === 1 ? ` · 확정 재고 ${latest(s, lesson.rows[0].id)}` : ` · A ${text(latest(s, "A"))}, B ${text(latest(s, "B"))}`}`;
      case "error":
      case "commit-error":
        return `${id} · ERROR 40001 · 트랜잭션 실패`;
      case "rollback":
        return `${id} 롤백 완료`;
    }
    return "";
  }

  const label = (step) => {
    switch (step.action) {
      case "begin":
        return "BEGIN";
      case "commit":
      case "commit-error":
        return "COMMIT";
      case "rollback":
        return "ROLLBACK";
      default:
        return lesson.token(step);
    }
  };

  async function update(step, previous = null, { animate = true, speed = 1 } = {}) {
    runner.cancel();
    moves.reset();
    if (!animate || !previous || runner.reduced || step.index === 0) {
      paint(present(step, "complete"));
      phase(completedTitle(step));
      return;
    }
    if (mobile.matches) host.scrollIntoView({ block: "nearest", behavior: "instant" });
    runner.start(speed);
    const id = step.client;
    const c = step.state.clients[id];
    const { action, row } = step;
    paint(present(step, "request"));

    if (action === "decide") {
      phase(`${id} 앱이 규칙을 검사`, "DB 요청 없이 앱이 센 인원으로 판단합니다.");
      const value = $(`[data-screen="${id}-1"] text`);
      value.textContent = lesson.screenValues(c)[1];
      if (!(await runner.animate(value, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], { duration: 900 }))) return;
    } else if (action === "resume-write" || action === "error") {
      phase(`${id} · 잠금이 풀려 기다리던 UPDATE가 이어집니다`, "새 요청을 보내지 않고 DB에서 기다리던 UPDATE가 진행합니다.");
      paint(present(step, "request"), { hideParked: id });
      if (action === "resume-write") {
        if (!(await moves.unpark(id, label(step), at[row].pending))) return;
        paint(present(step, "database"));
        phase(`DB → ${id} · 새 버전에서 다시 계산`, `커밋된 ${text(latest(step.state, row))} 위에서 SET 식을 다시 평가했습니다.`);
        if (!(await moves.respond(id, "OK"))) return;
      } else {
        if (!(await moves.flashDatabase(2))) return;
        paint(present(step, "database"), { hideParked: id });
        phase(`DB → ${id} · ERROR 40001`, step.error.message);
        if (!(await moves.respond(id, "40001", PARK[id]))) return;
      }
    } else {
      phase(
        action === "begin" ? `${id} → DB · 트랜잭션 시작 요청` : action.startsWith("commit") ? `${id} → DB · COMMIT 요청` : action === "rollback" ? `${id} → DB · ROLLBACK 요청` : action === "select" ? `${id} → DB · 읽기 요청` : `${id} → DB · ${rowName(row)} UPDATE 요청`,
        action === "begin"
          ? "BEGIN만으로는 스냅숏을 잡거나 행을 잠그지 않습니다."
          : action === "select"
            ? "응답이 돌아와야 앱이 읽은 값을 압니다."
            : action === "rollback"
              ? "실패한 트랜잭션을 끝냅니다."
              : action.startsWith("commit")
                ? "COMMIT이 도착하기 전에는 미확정 값과 행 잠금을 유지합니다."
                : "UPDATE는 바꿀 행을 잠근 뒤 미확정 버전을 만듭니다.",
      );
      if (!(await moves.send(id, label(step), ROUTES[id]))) return;
      if (action === "wait") {
        if (!(await moves.rise(id, PARK[id]))) return;
        moves.reset();
        paint(present(step, "database"));
        phase(`${id}의 UPDATE가 ${step.state.rows[row].owner}의 잠금 해제를 기다립니다`, "기다리는 동안 이 UPDATE는 DB 안에 남아 있습니다.");
        if (!(await runner.hold(420))) return;
      } else {
        let reply = "OK";
        if (action === "write") {
          if (!(await moves.rise(id, at[row].pending))) return;
          paint(present(step, "database"));
        } else if (action === "commit") {
          moves.reset();
          const merges = [...svg.querySelectorAll(".tx-pend")]
            .filter((el) => el.dataset.key.startsWith(`${id}:`))
            .map((el) => moves.merge(el, at[el.dataset.pend].pending, at[el.dataset.pend].lcd));
          if (!(await Promise.all(merges)).every(Boolean)) return;
          paint(present(step, "database"));
        } else if (action === "commit-error") {
          moves.reset();
          if (!(await moves.flashDatabase(3))) return;
          const mine = [...svg.querySelectorAll(".tx-pend")].filter((el) => el.dataset.key.startsWith(`${id}:`));
          const fades = mine.map((el) => runner.animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, fill: "forwards" }));
          if (!(await Promise.all(fades)).every(Boolean)) return;
          paint(present(step, "database"));
          reply = "40001";
        } else {
          moves.reset();
          if (!(await moves.flashDatabase())) return;
          paint(present(step, "database"));
          if (action === "select") reply = String(c.read);
        }
        phase(
          reply === "40001" ? `DB → ${id} · ERROR 40001` : action === "select" ? `DB → ${id} · ${lesson.screens[0]} ${c.read} 반환` : `DB → ${id} · 처리 완료`,
          reply === "40001" ? step.error.message : action === "write" ? "확정 값은 그대로이고, 커밋할 때 바뀝니다." : "클라이언트에 결과를 알립니다.",
        );
        if (!(await moves.respond(id, reply))) return;
      }
    }
    paint(present(step, "complete"));
    phase(completedTitle(step));
    runner.end();
  }

  return { update, pause: runner.pause, resume: runner.resume, setSpeed: runner.setSpeed };
}
