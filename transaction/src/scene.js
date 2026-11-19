// Page 1 scene: two client laptops and the inventory database. The laptop
// screens show what each app holds (read value, computed value); the database
// top shows the committed stock (LCD), the uncommitted write (a token in the
// writer's colour) and the row lock (LED in the owner's colour). SQL requests
// are tokens that travel the floor routes; a blocked request parks at the
// database edge until the lock is released.
import { getPresentationState } from "./presentation.js";
import {
  COLORS,
  DB,
  DB_TOP,
  PARK,
  ROUTES,
  createMoves,
  eul,
  ga,
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

const STATUS = { idle: "IDLE", active: "ACTIVE", waiting: "WAITING", committed: "COMMITTED" };
const PENDING_AT = [DB.x + 4.3, DB.y + 4.8, DB_TOP];
const LCD_AT = [DB.x + 3.9, DB.y + 2.6, DB_TOP];
const IDS = ["T1", "T2"];

const dbTop = `
  ${printed({ x: DB.x + 0.7, y: DB.y + 0.9, text: "LOCK", anchor: "start" })}
  <g data-lock-led>${lamp({ x: DB.x + 3.5, y: DB.y + 0.9 })}</g>
  <g data-lock-owner>${printed({ x: DB.x + 5.4, y: DB.y + 0.9, text: "FREE", anchor: "end", weight: 800 })}</g>
  ${well({ x: DB.x + 0.55, y: DB.y + 1.55, w: DB.w - 1.1, d: 2.15 })}
  ${printed({ x: DB.x + 0.95, y: DB.y + 2.6, text: "STOCK", anchor: "start", fill: "var(--tx-screen-dim)" })}
  <g data-lcd>${printed({ x: DB.x + 5.1, y: DB.y + 2.6, text: "10", anchor: "end", size: 30, weight: 700, fill: "var(--hw-lcd-ink)", cls: "tx-lcd-text" })}</g>
  ${slot({ x: DB.x + 0.55, y: DB.y + 4.1, w: DB.w - 1.1, d: 1.4 })}
  ${printed({ x: DB.x + 0.85, y: DB.y + 4.8, text: "PENDING", anchor: "start" })}
`;

const requestLabel = (action, mode, client) => {
  if (action === "begin") return "BEGIN";
  if (action === "commit") return "COMMIT";
  const reading = action === "read" || action === "resume-read" || (action === "wait" && mode === "locked");
  if (reading) return mode === "locked" ? "FOR UPD" : "SELECT";
  return `SET ${client.localWrite}`;
};

function completedTitle(step) {
  const client = step.client ? step.state.clients[step.client] : null;
  switch (step.action) {
    case "initial":
      return "두 주문이 같은 재고 행을 사용합니다";
    case "begin":
      return `${step.client} 트랜잭션을 시작했습니다`;
    case "wait":
      return `${step.client}의 SQL이 ${step.state.rowLock.owner}의 잠금 해제를 기다립니다`;
    case "commit":
      return `${step.client} 커밋 · 재고 ${step.before.committedStock} → ${step.state.committedStock} 확정, 잠금 해제`;
    case "calculate":
      return `${step.client} 앱 계산 완료 · ${client.localRead} − 1 = ${client.localWrite}`;
    case "read":
    case "resume-read":
      return `${step.client} 앱이 재고 ${eul(client.localRead)} 보관했습니다`;
    default:
      return `${ga(step.client)} 재고 ${eul(client.localWrite)} 썼습니다 · 커밋 전`;
  }
}

export function createTransactionScene(host, { onPhase = () => {} } = {}) {
  host.innerHTML = sceneSvg({
    label: "두 클라이언트와 재고 DB 사이의 SQL 요청과 행 잠금",
    dbTop,
    screens: ["READ", "CALC"],
    dbSub: "INVENTORY · ID 1",
  });
  const svg = host.querySelector("svg");
  const runner = createRunner(svg);
  const moves = createMoves(svg, runner);
  const $ = (s) => svg.querySelector(s);
  const mobile = matchMedia("(max-width: 759px)");
  let painted = null;
  let mode = "naive";

  function paint(state, { hideParked = null } = {}) {
    painted = state;
    const { owner, waiting } = state.rowLock;
    for (const id of IDS) {
      const c = state.clients[id];
      setScreen(svg, id, [c.localRead ?? "—", c.localWrite ?? "—"]);
      setStatus(svg, id, STATUS[c.status]);
      $(`[data-client="${id}"]`).dataset.status = c.status;
    }
    $("[data-lcd] text").textContent = state.committedStock;
    // Uncommitted write: a token in the writer's colour on the pending slot.
    const pending = $(".tx-pending");
    const key = state.uncommitted ? `${state.uncommitted.client}:${state.uncommitted.stock}` : "";
    if (pending.dataset.key !== key) {
      pending.dataset.key = key;
      pending.innerHTML = key
        ? `<g class="tx-pend">${sqlToken({ text: state.uncommitted.stock, color: COLORS[state.uncommitted.client], w: 1.3, d: 1 })}</g>`
        : "";
      if (key) place(pending.firstElementChild, ...PENDING_AT);
    }
    setLamp($("[data-lock-led] .iso-led"), owner);
    const ownerText = $("[data-lock-owner] text");
    ownerText.textContent = owner ?? "FREE";
    ownerText.setAttribute("fill", owner ? `var(--${owner.toLowerCase()}-ink)` : "var(--muted)");
    // Blocked requests stay parked at the database edge.
    const parked = $(".tx-parked");
    parked.innerHTML = waiting
      .filter((id) => id !== hideParked)
      .map(
        (id) =>
          `<g class="tx-park ${owner ? "is-blocked" : "is-ready"}" data-park="${id}">${sqlToken({ text: requestLabel("wait", mode, state.clients[id]), color: COLORS[id], w: 2.7 })}</g>`,
      )
      .join("");
    for (const g of parked.children) place(g, ...PARK[g.dataset.park], 0);
  }

  const phase = (title, body = "") => onPhase({ title, body, snapshot: painted });

  async function update(step, previous = null, { animate = true, speed = 1 } = {}) {
    runner.cancel();
    moves.reset();
    mode = step.mode;
    if (!animate || !previous || runner.reduced || step.index === 0) {
      paint(getPresentationState(step, "complete"));
      phase(completedTitle(step));
      return;
    }
    if (mobile.matches) host.scrollIntoView({ block: "nearest", behavior: "instant" });
    runner.start(speed);
    const id = step.client;
    const c = step.state.clients[id];
    const action = step.action;
    const reading = ["read", "resume-read"].includes(action);
    const writing = ["write", "resume-write"].includes(action);
    paint(getPresentationState(step, "request"));

    if (action === "calculate") {
      phase(`${id} 앱에서 ${c.localRead} − 1을 계산`, "DB 요청 없이 앱이 기억하는 값으로 계산합니다.");
      const value = $(`[data-screen="${id}-1"] text`);
      value.textContent = c.localWrite;
      if (!(await runner.animate(value, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], { duration: 900 }))) return;
    } else {
      if (action.startsWith("resume")) {
        phase(`${id} · 대기하던 SQL을 이어서 실행`, "새 요청을 보내지 않고 DB에서 기다리던 요청이 진행합니다.");
        paint(getPresentationState(step, "request"), { hideParked: id });
        if (!(await moves.send(id, requestLabel(action, mode, c), [PARK[id], moves.edge(id)]))) return;
      } else {
        const lockedRead = action === "read" || (action === "wait" && mode === "locked");
        phase(
          action === "commit"
            ? `${id} → DB · COMMIT 요청`
            : action === "begin"
              ? `${id} → DB · 트랜잭션 시작 요청`
              : lockedRead
                ? `${id} → DB · 재고 읽기 요청`
                : `${id} → DB · 재고 ${c.localWrite} 쓰기 요청`,
          action === "commit"
            ? "COMMIT이 DB에 도착하기 전에는 미확정 값과 행 잠금을 유지합니다."
            : action === "begin"
              ? "새 트랜잭션을 시작합니다. 아직 재고를 읽거나 쓰지 않습니다."
              : lockedRead
                ? mode === "locked"
                  ? "행 잠금을 얻은 뒤 재고를 읽습니다. 다른 트랜잭션이 보유 중이면 이 SQL이 기다립니다."
                  : "확정된 재고를 요청합니다. 응답이 돌아와야 앱의 읽은 값이 바뀝니다."
                : `앱에서 계산한 ${eul(c.localWrite)} 쓰는 요청입니다. 쓰기가 끝나도 커밋 전까지는 미확정입니다.`,
        );
        const route = action === "wait" ? [...ROUTES[id].slice(0, -1), PARK[id]] : ROUTES[id];
        if (!(await moves.send(id, requestLabel(action, mode, c), route))) return;
      }

      if (action === "wait") {
        moves.reset();
        paint(getPresentationState(step, "database"));
        phase(
          `${id}의 SQL이 ${step.before.rowLock.owner}의 잠금 해제를 기다립니다`,
          mode === "locked" ? "읽기 결과를 아직 받지 못했습니다." : "앱에서 계산한 값은 그대로인 채 UPDATE가 기다립니다.",
        );
        if (!(await runner.hold(420))) return;
      } else {
        if (writing) {
          if (!(await moves.rise(id, PENDING_AT))) return;
          paint(getPresentationState(step, "database"));
        } else if (action === "commit") {
          moves.reset();
          phase(
            `${id} 커밋 · ${step.before.committedStock} → ${step.state.committedStock} 확정, 잠금 해제`,
            step.state.rowLock.waiting.length
              ? "미확정 쓰기가 확정되는 순간 행 잠금도 함께 해제됩니다. 대기 SQL의 실제 재개는 다음 사건입니다."
              : "미확정 쓰기가 확정되는 순간 행 잠금도 함께 해제됩니다. 두 트랜잭션이 끝났습니다.",
          );
          const token = $(".tx-pend");
          if (token && !(await moves.merge(token, PENDING_AT, LCD_AT))) return;
          paint(getPresentationState(step, "database"));
          if (!(await runner.animate($("[data-lcd] text"), [{ opacity: 0.2 }, { opacity: 1 }], { duration: 360 }))) return;
        } else {
          moves.reset();
          if (!(await moves.flashDatabase())) return;
          paint(getPresentationState(step, "database"));
        }
        phase(
          reading
            ? `DB → ${id} · 재고 ${c.localRead} 반환`
            : writing
              ? `DB에 재고 ${c.localWrite} 기록 · 커밋 대기`
              : action === "commit"
                ? `DB → ${id} · 커밋 완료`
                : `DB → ${id} · 처리 완료`,
          reading
            ? "응답이 도착하면 앱이 읽은 값을 기억합니다."
            : writing
              ? `현재 확정 재고는 ${step.before.committedStock}개입니다. 앱에서 계산해 보낸 ${c.localWrite}개는 커밋할 때 확정됩니다.`
              : action === "commit"
                ? "커밋된 버전이 바뀌고 대기 요청이 진행할 수 있게 됩니다."
                : "클라이언트에 처리 결과를 알립니다.",
        );
        if (!(await moves.respond(id, reading ? String(c.localRead) : "OK"))) return;
      }
    }
    paint(getPresentationState(step, "complete"));
    phase(completedTitle(step));
    runner.end();
  }

  return { update, pause: runner.pause, resume: runner.resume, setSpeed: runner.setSpeed };
}
