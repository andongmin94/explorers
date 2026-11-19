// Page 2 scene: the same two laptops and database. The database top holds rows
// A and B, each with its committed stock (LCD), an uncommitted write (token in
// the writer's colour) and a lock LED in the owner's colour. A blocked UPDATE
// parks at the database edge, and the wait-for relation is drawn on the floor
// as a lit path from the waiting transaction to the one it waits for. Two such
// paths close the cycle; the rollback of T2 removes its write, its lock and its
// parked request, and the cycle opens.
import { floorPath, topText } from "../../shared/iso-kit.js";
import { eul, eun, ga } from "../../shared/josa.js";
import { getDeadlockPresentationState } from "./deadlock-engine.js";
import {
  COLORS,
  DB,
  DB_TOP,
  PARK,
  VIEWS,
  ROUTES,
  createMoves,
  createRunner,
  lamp,
  place,
  printed,
  sceneSvg,
  setLamp,
  setScreen,
  setStatus,
  slot,
  sqlToken,
  well,
} from "./stage.js";

const IDS = ["T1", "T2"];
const ROWS = { A: DB.y + 1.65, B: DB.y + 4.35 };
const PENDING_X = DB.x + 4.5;
const LCD_X = DB.x + 2.45;
const STATUS = { idle: "IDLE", active: "ACTIVE", waiting: "WAITING", committed: "COMMITTED", aborted: "ABORTED" };
const other = (id) => (id === "T1" ? "T2" : "T1");
// Wait-for edges run in front of the database, laptop to laptop.
const EDGES = {
  T1: [[3.15, 12.15], [12.85, 12.15], [12.85, 1.55]],
  T2: [[13.5, 1.55], [13.5, 12.8], [3.15, 12.8]],
};

const dbTop = Object.entries(ROWS)
  .map(
    ([row, y]) => `
  ${topText({ x: DB.x + 0.85, y, z: DB_TOP + 0.01, text: row, size: 20, weight: 800, fill: "var(--ink)" })}
  ${well({ x: DB.x + 1.4, y: y - 0.8, w: 2.1, d: 1.6 })}
  <g data-lcd="${row}">${printed({ x: DB.x + 2.45, y, text: "", anchor: "middle", size: 20, weight: 700, fill: "var(--hw-lcd-ink)", cls: "tx-lcd-text" })}</g>
  ${slot({ x: DB.x + 3.85, y: y - 0.7, w: 1.25, d: 1.4 })}
  <g data-lock-led="${row}">${lamp({ x: DB.x + 5.5, y })}</g>`,
  )
  .join("");

const floorMarks = `
  ${Object.entries(EDGES)
    .map(([id, route]) => `<g class="tx-edge" data-edge="${id}" style="--edge:${COLORS[id]}">${floorPath(route)}</g>`)
    .join("")}
  ${topText({ x: 8.2, y: 13.55, z: 0.01, text: "WAIT-FOR", size: 12, weight: 600, fill: "var(--muted)", cls: "tx-floor-mark" })}
`;

function completedTitle(step) {
  const s = step.state;
  switch (step.action) {
    case "initial":
      return step.order === "same" ? "T1과 T2 모두 A→B 순서로 두 행을 줄이려 합니다" : "T1은 A→B, T2는 B→A 순서로 두 행을 줄이려 합니다";
    case "begin":
      return `${step.client} 트랜잭션을 시작했습니다`;
    case "write":
    case "resume":
      return `${ga(step.client)} ${step.row} 잠금 보유 · 미확정 ${s.rows[step.row].pending.value}`;
    case "wait":
      return s.deadlocked ? "순환 대기 · T1과 T2가 서로의 잠금을 기다립니다" : `${ga(step.client)} ${step.row} 잠금 해제를 기다립니다`;
    case "detect":
      return `DB가 순환을 감지 · ${eul(s.victim)} 중단 대상으로 선택`;
    case "rollback":
      return `${step.client} 중단·롤백 · ${step.row}의 미확정 값·잠금과 A 대기 요청 취소`;
    case "commit":
      return `${step.client} 커밋 · A ${s.rows.A.committed}, B ${s.rows.B.committed} 확정`;
  }
  return "";
}

export function createDeadlockScene(host, { onPhase = () => {} } = {}) {
  host.innerHTML = sceneSvg({
    label: "두 클라이언트가 재고 행 A와 B의 잠금을 서로 기다리는 장면",
    dbTop,
    floorMarks,
    view: VIEWS.deadlock,
    screens: ["HOLD", "WAIT"],
    dbSub: "ROWS A · B",
  });
  const svg = host.querySelector("svg");
  const runner = createRunner(svg);
  const moves = createMoves(svg, runner);
  const $ = (s) => svg.querySelector(s);
  const mobile = matchMedia("(max-width: 759px)");
  let painted = null;

  function paint(state, { hideParked = null, keepEdges = false } = {}) {
    painted = state;
    for (const id of IDS) {
      const c = state.clients[id];
      setScreen(svg, id, [c.held.join("·") || "—", c.waitingFor ?? "—"]);
      const victim = state.detected && state.victim === id && c.status !== "aborted";
      setStatus(svg, id, victim ? "TO ABORT" : STATUS[c.status]);
      $(`[data-client="${id}"]`).dataset.status = victim ? "aborted" : c.status;
    }
    const pending = $(".tx-pending");
    for (const [row, y] of Object.entries(ROWS)) {
      const r = state.rows[row];
      $(`[data-lcd="${row}"] text`).textContent = r.committed;
      setLamp($(`[data-lock-led="${row}"] .iso-led`), r.owner);
      const key = r.pending ? `${r.pending.client}:${r.pending.value}` : "";
      let token = pending.querySelector(`[data-pend="${row}"]`);
      if (token?.dataset.key === key) continue;
      token?.remove();
      if (!key) continue;
      pending.insertAdjacentHTML("beforeend", `<g class="tx-pend" data-pend="${row}" data-key="${key}">${sqlToken({ text: r.pending.value, color: COLORS[r.pending.client], w: 1.15, d: 1 })}</g>`);
      place(pending.lastElementChild, PENDING_X, y, DB_TOP);
    }
    const parked = $(".tx-parked");
    parked.innerHTML = IDS.filter((id) => state.clients[id].waitingFor && id !== hideParked)
      .map((id) => {
        const row = state.clients[id].waitingFor;
        return `<g class="tx-park ${state.rows[row].owner ? "is-blocked" : "is-ready"}" data-park="${id}">${sqlToken({ text: `UPD ${row}`, color: COLORS[id], w: 2.4 })}</g>`;
      })
      .join("");
    for (const g of parked.children) place(g, ...PARK[g.dataset.park], 0);
    // Wait-for edges: lit while the waiter's row is held by the other transaction.
    for (const id of IDS) {
      const row = state.clients[id].waitingFor;
      const on = Boolean(row && state.rows[row].owner === other(id));
      const edge = $(`[data-edge="${id}"]`);
      if (!keepEdges) edge.classList.toggle("is-on", on);
      edge.classList.toggle("is-cycle", state.deadlocked);
      edge.classList.toggle("is-detected", state.deadlocked && state.detected);
    }
  }

  const phase = (title, body = "") => onPhase({ title, body, snapshot: painted });
  const slotOf = (row) => [PENDING_X, ROWS[row], DB_TOP];

  async function update(step, previous = null, { animate = true, speed = 1 } = {}) {
    runner.cancel();
    moves.reset();
    if (!animate || !previous || runner.reduced || step.index === 0) {
      paint(getDeadlockPresentationState(step, "complete"));
      phase(completedTitle(step));
      return;
    }
    if (mobile.matches) host.scrollIntoView({ block: "nearest", behavior: "instant" });
    runner.start(speed);
    const id = step.client;
    const { action, row } = step;
    paint(getDeadlockPresentationState(step, "request"));

    switch (action) {
      case "begin":
      case "write":
      case "wait":
      case "commit": {
        const label = action === "begin" ? "BEGIN" : action === "commit" ? "COMMIT" : `UPD ${row}`;
        phase(
          action === "begin" ? `${id} → DB · 트랜잭션 시작 요청` : action === "commit" ? `${id} → DB · COMMIT 요청` : `${id} → DB · ${row} 재고 감소 요청`,
          action === "begin"
            ? "BEGIN만으로 재고 행 잠금을 얻지는 않습니다."
            : action === "commit"
              ? "커밋이 도착하면 이 트랜잭션의 미확정 값이 확정되고 잠금이 풀립니다."
              : step.state.rows[row].owner === id
                ? `${row} 행에 잠금이 없으면 UPDATE가 잠금을 얻고 stock − 1을 계산합니다.`
                : `${row} 행은 ${ga(step.before.rows[row].owner)} 잠갔습니다. 이 UPDATE는 DB 앞에서 기다립니다.`,
        );
        const route = action === "wait" ? [...ROUTES[id].slice(0, -1), PARK[id]] : ROUTES[id];
        if (!(await moves.send(id, label, route))) return;
        if (action === "wait") {
          moves.reset();
          paint(getDeadlockPresentationState(step, "database"));
          phase(
            step.state.deadlocked ? "순환 대기 · 서로가 가진 잠금을 기다립니다" : step.state.clients[id].held.length ? `${eun(id)} ${row} 잠금을 기다리며 ${step.state.clients[id].held.join("·")} 잠금을 유지합니다` : `${eun(id)} 아무 잠금 없이 ${row} 잠금을 기다립니다`,
            step.state.deadlocked
              ? "T1은 B를 가진 T2를, T2는 A를 가진 T1을 기다립니다. 둘 다 잠금을 놓지 않아 진행할 수 없습니다."
              : step.state.clients[id].held.length
                ? "기다리는 동안 먼저 얻은 잠금과 미확정 쓰기는 유지됩니다."
                : `${eun(id)} 아직 아무 행도 잠그지 않았습니다.`,
          );
          if (!(await runner.hold(step.state.deadlocked ? 700 : 420))) return;
          break;
        }
        if (action === "write") {
          if (!(await moves.rise(id, slotOf(row)))) return;
          paint(getDeadlockPresentationState(step, "database"));
        } else if (action === "commit") {
          moves.reset();
          phase(`${id} 커밋 · 두 행의 미확정 값을 확정`, `${id}의 A·B 쓰기가 함께 확정되고 두 행 잠금이 해제됩니다.`);
          const merges = [...svg.querySelectorAll(".tx-pend")].map((el) => moves.merge(el, slotOf(el.dataset.pend), [LCD_X, ROWS[el.dataset.pend], DB_TOP]));
          if (!(await Promise.all(merges)).every(Boolean)) return;
          paint(getDeadlockPresentationState(step, "database"));
        } else {
          moves.reset();
          if (!(await moves.flashDatabase())) return;
          paint(getDeadlockPresentationState(step, "database"));
        }
        phase(`DB → ${id} · 처리 완료`, action === "write" ? `${row}의 미확정 값은 ${step.state.rows[row].pending.value}입니다. 확정 재고는 그대로입니다.` : "클라이언트에 처리 결과를 알립니다.");
        if (!(await moves.respond(id, "OK"))) return;
        break;
      }
      case "detect": {
        phase("DB가 대기 관계의 순환을 확인합니다", "deadlock_timeout(기본 1초) 동안 기다린 뒤 검사합니다. 기다림의 방향을 따라가면 원래 트랜잭션으로 돌아옵니다.");
        if (!(await moves.flashDatabase(3))) return;
        paint(getDeadlockPresentationState(step, "database"));
        phase(`${eul(step.state.victim)} 중단 대상으로 선택`, "아직 롤백 전이므로 잠금과 미확정 값은 그대로입니다.");
        if (!(await runner.hold(500))) return;
        break;
      }
      case "rollback": {
        phase(`${id} 중단·롤백 · 미확정 쓰기와 잠금을 버립니다`, `${id}의 B 미확정 값과 B 잠금이 사라지고, A를 기다리던 UPDATE가 오류로 끝납니다.`);
        const mine = [...svg.querySelectorAll(".tx-pend")].filter((el) => el.dataset.key.startsWith(`${id}:`));
        const fades = mine.map((el) => runner.animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, fill: "forwards" }));
        if (!(await Promise.all(fades)).every(Boolean)) return;
        const state = getDeadlockPresentationState(step, "database");
        paint(state, { hideParked: null });
        // The parked request goes back to T2 as an error, not as a new SQL.
        phase(`DB → ${id} · ERROR: deadlock detected (40P01)`, "A를 기다리던 T2의 UPDATE가 이 오류로 끝납니다. T2는 중단됐고, 앱이 ROLLBACK해야 합니다.");
        if (!(await moves.respond(id, "ERROR", PARK[id]))) return;
        break;
      }
      case "resume": {
        phase(`${id} · 대기하던 ${row} UPDATE를 이어서 실행`, "새 SQL을 보내지 않고 DB에 대기 중이던 UPDATE가 이어집니다.");
        paint(getDeadlockPresentationState(step, "request"), { hideParked: id });
        if (!(await moves.send(id, `UPD ${row}`, [PARK[id], moves.edge(id)]))) return;
        if (!(await moves.rise(id, slotOf(row)))) return;
        paint(getDeadlockPresentationState(step, "database"));
        phase(`DB → ${id} · 처리 완료`, `${row}의 미확정 값 ${eun(step.state.rows[row].pending.value)} ${ga(id)} 새로 만든 값입니다.`);
        if (!(await moves.respond(id, "OK"))) return;
        break;
      }
    }
    paint(getDeadlockPresentationState(step, "complete"));
    phase(completedTitle(step));
    runner.end();
  }

  return { update, pause: runner.pause, resume: runner.resume, setSpeed: runner.setSpeed };
}
