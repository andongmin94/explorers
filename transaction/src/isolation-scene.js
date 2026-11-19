// Scene for the isolation lessons (03, 04): the same two laptops and database
// as lessons 01–02. The database top prints each row with its committed value
// (LCD), its uncommitted write (a token in the writer's colour) and its lock
// LED. Lesson 03 has one stock row (laid out like lesson 01), lesson 04 the
// two doctor rows A and B (laid out like lesson 02). SQL requests travel as
// tokens; a blocked UPDATE parks at the database edge; a serialization
// failure travels back to the laptop as a "40001" token.
import { topText } from "../../shared/iso-kit.js";
import { eul, ga } from "../../shared/josa.js";
import { getIsolationPresentationState as present } from "./isolation-engine.js";
import {
  COLORS,
  DB,
  DB_TOP,
  PARK,
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
const STATUS = { idle: "IDLE", active: "ACTIVE", waiting: "WAITING", aborted: "ABORTED", rolledback: "ROLLED BACK", committed: "COMMITTED" };

// Where each row prints its LCD and pending token.
function layout(rows) {
  if (rows.length === 1) {
    const id = rows[0].id;
    return {
      single: true,
      at: { [id]: { lcd: [DB.x + 3.9, DB.y + 2.6, DB_TOP], pending: [DB.x + 4.3, DB.y + 4.8, DB_TOP] } },
      top: `
        ${printed({ x: DB.x + 0.7, y: DB.y + 0.9, text: "LOCK", anchor: "start" })}
        <g data-lock-led="${id}">${lamp({ x: DB.x + 3.5, y: DB.y + 0.9 })}</g>
        <g data-lock-owner>${printed({ x: DB.x + 5.4, y: DB.y + 0.9, text: "FREE", anchor: "end", weight: 800 })}</g>
        ${well({ x: DB.x + 0.55, y: DB.y + 1.55, w: DB.w - 1.1, d: 2.15 })}
        ${printed({ x: DB.x + 0.95, y: DB.y + 2.6, text: rows[0].label, anchor: "start", fill: "var(--tx-screen-dim)" })}
        <g data-lcd="${id}">${printed({ x: DB.x + 5.1, y: DB.y + 2.6, text: "", anchor: "end", size: 30, weight: 700, fill: "var(--hw-lcd-ink)", cls: "tx-lcd-text" })}</g>
        ${slot({ x: DB.x + 0.55, y: DB.y + 4.1, w: DB.w - 1.1, d: 1.4 })}
        ${printed({ x: DB.x + 0.85, y: DB.y + 4.8, text: "PENDING", anchor: "start" })}`,
    };
  }
  const ys = [DB.y + 1.65, DB.y + 4.35];
  return {
    single: false,
    at: Object.fromEntries(rows.map((r, i) => [r.id, { lcd: [DB.x + 2.45, ys[i], DB_TOP], pending: [DB.x + 4.5, ys[i], DB_TOP] }])),
    top: rows
      .map(
        (r, i) => `
        ${topText({ x: DB.x + 0.85, y: ys[i], z: DB_TOP + 0.01, text: r.label, size: 20, weight: 800, fill: "var(--ink)" })}
        ${well({ x: DB.x + 1.4, y: ys[i] - 0.8, w: 2.1, d: 1.6 })}
        <g data-lcd="${r.id}">${printed({ x: DB.x + 2.45, y: ys[i], text: "", anchor: "middle", size: 18, weight: 700, fill: "var(--hw-lcd-ink)", cls: "tx-lcd-text" })}</g>
        ${slot({ x: DB.x + 3.85, y: ys[i] - 0.7, w: 1.25, d: 1.4 })}
        <g data-lock-led="${r.id}">${lamp({ x: DB.x + 5.5, y: ys[i] })}</g>`,
      )
      .join(""),
  };
}

const latest = (state, row) => state.rows[row].versions.at(-1).value;

export function createIsolationScene(host, lesson, { onPhase = () => {} } = {}) {
  const geo = layout(lesson.rows);
  host.innerHTML = sceneSvg({
    label: `두 트랜잭션이 ${lesson.db.title}에 보내는 SQL과 행 잠금, 커밋된 값의 변화`,
    dbTop: geo.top,
    screens: lesson.screens,
    dbSub: lesson.db.sub,
    dbTitle: lesson.db.title,
    names: lesson.names,
  });
  const svg = host.querySelector("svg");
  const runner = createRunner(svg);
  const moves = createMoves(svg, runner);
  const $ = (s) => svg.querySelector(s);
  const mobile = matchMedia("(max-width: 759px)");
  const text = lesson.valueText;
  // Lesson 03 has one row (the stock); lesson 04 names its rows A and B.
  const rowName = (row) => (geo.single ? "재고" : row);
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
      setLamp($(`[data-lock-led="${id}"] .iso-led`), r.owner);
      const key = r.pending ? `${r.pending.client}:${r.pending.value}` : "";
      const token = pending.querySelector(`[data-pend="${id}"]`);
      if (token?.dataset.key === key) continue;
      token?.remove();
      if (!key) continue;
      pending.insertAdjacentHTML(
        "beforeend",
        `<g class="tx-pend" data-pend="${id}" data-key="${key}">${sqlToken({ text: text(r.pending.value), color: COLORS[r.pending.client], w: geo.single ? 1.3 : 1.25, d: 1 })}</g>`,
      );
      place(pending.lastElementChild, ...geo.at[id].pending);
    }
    if (geo.single) {
      const owner = state.rows[lesson.rows[0].id].owner;
      const ownerText = $("[data-lock-owner] text");
      ownerText.textContent = owner ?? "FREE";
      ownerText.setAttribute("fill", owner ? `var(--${owner.toLowerCase()}-ink)` : "var(--muted)");
    }
    const parked = $(".tx-parked");
    parked.innerHTML = IDS.filter((id) => state.clients[id].waitingFor && id !== hideParked)
      .map((id) => {
        const row = state.clients[id].waitingFor;
        return `<g class="tx-park ${state.rows[row].owner ? "is-blocked" : "is-ready"}" data-park="${id}">${sqlToken({ text: lesson.token({ action: "update", row }), color: COLORS[id], w: 2.5 })}</g>`;
      })
      .join("");
    for (const g of parked.children) place(g, ...PARK[g.dataset.park], 0);
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
        if (!(await moves.send(id, label(step), [PARK[id], moves.edge(id)]))) return;
        if (!(await moves.rise(id, geo.at[row].pending))) return;
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
      const route = action === "wait" ? [...ROUTES[id].slice(0, -1), PARK[id]] : ROUTES[id];
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
      if (!(await moves.send(id, label(step), route))) return;
      if (action === "wait") {
        moves.reset();
        paint(present(step, "database"));
        phase(`${id}의 UPDATE가 ${step.state.rows[row].owner}의 잠금 해제를 기다립니다`, "기다리는 동안 이 UPDATE는 DB 안에 남아 있습니다.");
        if (!(await runner.hold(420))) return;
      } else {
        let reply = "OK";
        if (action === "write") {
          if (!(await moves.rise(id, geo.at[row].pending))) return;
          paint(present(step, "database"));
        } else if (action === "commit") {
          moves.reset();
          const merges = [...svg.querySelectorAll(".tx-pend")]
            .filter((el) => el.dataset.key.startsWith(`${id}:`))
            .map((el) => moves.merge(el, geo.at[el.dataset.pend].pending, geo.at[el.dataset.pend].lcd));
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
