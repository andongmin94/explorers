import { getDeadlockPresentationState } from "./deadlock-engine.js";

const COS = Math.sqrt(3) / 2;
const point = (o, u, v, z = 0) => [o.x + (u - v) * COS, o.y + (u + v) / 2 - z];
const polygon = (o, vertices, cls) =>
  `<polygon class="${cls}" points="${vertices
    .map((p) =>
      point(o, ...p)
        .map((v) => v.toFixed(2))
        .join(","),
    )
    .join(" ")}"/>`;
function box(o, u, v, low, high, prefix = "dl-device") {
  return (
    polygon(
      o,
      [
        [-u, v, high],
        [u, v, high],
        [u, v, low],
        [-u, v, low],
      ],
      `${prefix}-front`,
    ) +
    polygon(
      o,
      [
        [u, -v, high],
        [u, v, high],
        [u, v, low],
        [u, -v, low],
      ],
      `${prefix}-side`,
    ) +
    polygon(
      o,
      [
        [-u, -v, high],
        [u, -v, high],
        [u, v, high],
        [-u, v, high],
      ],
      `${prefix}-top`,
    )
  );
}
function laptop(x, y, width) {
  const o = { x, y },
    u = (width * 0.32) / COS,
    v = (width * 0.18) / COS,
    h = width * 0.39;
  const panel = [
    [-u, -v, 7],
    [u, -v, 7],
    [u, -v, h],
    [-u, -v, h],
  ];
  return `<g>${polygon(
    { x: x + 5, y: y + 5 },
    [
      [-u, -v, 0],
      [u, -v, 0],
      [u, v, 0],
      [-u, v, 0],
    ],
    "dl-device-shadow",
  )}
  ${box(o, u, v, 0, 5)}${polygon(o, panel, "dl-device-screen-shell")}
  ${polygon(
    o,
    [
      [-u + 5, -v - 0.1, 12],
      [u - 5, -v - 0.1, 12],
      [u - 5, -v - 0.1, h - 5],
      [-u + 5, -v - 0.1, h - 5],
    ],
    "dl-device-screen",
  )}
  ${[0, 1, 2]
    .map((i) =>
      polygon(
        o,
        [
          [-u + 11, -v - 0.2, 22 + i * 7],
          [u - 13, -v - 0.2, 22 + i * 7],
          [u - 13, -v - 0.2, 24 + i * 7],
          [-u + 11, -v - 0.2, 24 + i * 7],
        ],
        "dl-device-code",
      ),
    )
    .join("")}
  ${polygon(
    o,
    [
      [-u * 0.8, -v * 0.7, 5.3],
      [u * 0.8, -v * 0.7, 5.3],
      [u * 0.8, v * 0.35, 5.3],
      [-u * 0.8, v * 0.35, 5.3],
    ],
    "dl-device-keys",
  )}
  ${[0, 1, 2]
    .map((i) => {
      const a = point(o, -u * 0.72, -v * 0.45 + i * v * 0.3, 5.5),
        b = point(o, u * 0.72, -v * 0.45 + i * v * 0.3, 5.5);
      return `<path class="dl-device-detail" d="M${a.join(" ")}L${b.join(" ")}"/>`;
    })
    .join("")}
  ${polygon(
    o,
    [
      [-u * 0.25, v * 0.48, 5.3],
      [u * 0.25, v * 0.48, 5.3],
      [u * 0.25, v * 0.82, 5.3],
      [-u * 0.25, v * 0.82, 5.3],
    ],
    "dl-device-trackpad",
  )}</g>`;
}
function database(x, y, width) {
  const o = { x, y },
    u = width / (4 * COS),
    v = u,
    h = 57;
  const [tx, ty] = point(o, 0, 0, h + 0.5);
  return `<g>${polygon(
    { x: x + 5, y: y + 6 },
    [
      [-u, -v, 0],
      [u, -v, 0],
      [u, v, 0],
      [-u, v, 0],
    ],
    "dl-device-shadow",
  )}
  ${box(o, u, v, 0, h)}
  ${[0, 1, 2]
    .map((i) =>
      polygon(
        o,
        [
          [-u + 5, v + 0.1, 8 + i * 13],
          [u - 5, v + 0.1, 8 + i * 13],
          [u - 5, v + 0.1, 16 + i * 13],
          [-u + 5, v + 0.1, 16 + i * 13],
        ],
        "dl-device-drawer",
      ),
    )
    .join("")}
  ${[0, 1, 2]
    .map((i) =>
      polygon(
        o,
        [
          [u + 0.1, -v + 5, 9 + i * 13],
          [u + 0.1, v - 5, 9 + i * 13],
          [u + 0.1, v - 5, 11 + i * 13],
          [u + 0.1, -v + 5, 11 + i * 13],
        ],
        "dl-device-vent",
      ),
    )
    .join("")}
  <text class="dl-device-engraving" transform="matrix(${COS} .5 ${-COS} .5 ${tx} ${ty})" text-anchor="middle" y="6">DB</text></g>`;
}
function housing(x, y, width, height, depth = 12) {
  const rise = depth / Math.sqrt(3),
    bottom = y + height;
  return `<g>
    <path class="dl-device-shadow" d="M${x + 4} ${bottom + 4}H${x + width + depth + 4}L${x + width + 4} ${bottom + 6}H${x + 4}Z"/>
    <path class="dl-device-top" d="M${x} ${y}L${x + depth} ${y - rise}H${x + width + depth}L${x + width} ${y}Z"/>
    <path class="dl-device-side" d="M${x + width} ${y}L${x + width + depth} ${y - rise}V${bottom - rise}L${x + width} ${bottom}Z"/>
    <rect class="dl-device-front" x="${x}" y="${y}" width="${width}" height="${height}" rx="2"/>
    <path d="M${x + 4} ${y + 5}V${bottom - 4}H${x + width - 4}V${y + 5}" fill="none" stroke="var(--border)" stroke-width="1" opacity=".4"/>
    ${[x + 4, x + width - 4].map((a) => `<circle cx="${a}" cy="${y + 5}" r="1.3" fill="var(--border)"/><circle cx="${a}" cy="${bottom - 5}" r="1.3" fill="var(--border)"/>`).join("")}
  </g>`;
}
const socketPort = (x, y) =>
  `<rect x="${x - 3}" y="${y - 4}" width="6" height="8" fill="var(--ink)" stroke="var(--surface)" stroke-width="1"/>`;

const ids = ["T1", "T2"],
  rowIds = ["A", "B"];
const color = (id) => `var(--${id.toLowerCase()})`;
const badge = (id) => `<b class="tx-id ${id.toLowerCase()}">${id}</b>`;
const statusLabel = {
  idle: "시작 전",
  active: "진행 중",
  waiting: "잠금 대기",
  aborted: "롤백됨",
  committed: "커밋 완료",
};

export function createDeadlockScene(host, { onPhase = () => {} } = {}) {
  host.className = "dl-scene";
  host.innerHTML = `<svg class="dl-map" aria-hidden="true"></svg><div class="dl-callout"></div>
    ${ids.map((id) => `<div class="dl-client" data-client="${id}" style="--actor:${color(id)}"><div class="dl-client-head">${badge(id)}<strong data-status>시작 전</strong></div><div class="dl-client-line"><span>보유</span><b data-held>없음</b></div><div class="dl-client-line dl-client-wait"><span>대기</span><b data-waiting>없음</b></div></div>`).join("")}
    <div class="dl-cycle"><strong data-cycle-title>대기 관계 없음</strong><div data-cycle-edges></div></div>
    ${rowIds.map((row) => `<div class="dl-row" data-row="${row}"><div class="dl-row-head"><b>행 ${row}</b><span data-owner>잠금 없음</span></div><div class="dl-row-values"><span>확정 <strong data-stock></strong></span><span>미확정 <b data-pending>없음</b></span></div><div class="dl-row-note" data-note>변경 없음</div></div><div class="dl-queued" data-queue="${row}" hidden></div>`).join("")}
    <div class="dl-packet" hidden></div>`;
  const svg = host.querySelector(".dl-map"),
    packet = host.querySelector(".dl-packet"),
    callout = host.querySelector(".dl-callout"),
    cycle = host.querySelector(".dl-cycle");
  const cards = Object.fromEntries(
    ids.map((id) => [id, host.querySelector(`[data-client="${id}"]`)]),
  );
  const rows = Object.fromEntries(
    rowIds.map((row) => [row, host.querySelector(`[data-row="${row}"]`)]),
  );
  const queues = Object.fromEntries(
    rowIds.map((row) => [row, host.querySelector(`[data-queue="${row}"]`)]),
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let layout,
    active = null,
    lastStep = null,
    paintedState = null;

  function requestPath(id, row, stop = false, returning = false) {
    const sx = layout.clients[id],
      sy = 283,
      bridge = id === "T1" ? 289 : 298,
      px = layout.park[row].x,
      py = layout.park[row].y,
      ex = layout.ports[row].x,
      ey = layout.ports[row].y;
    if (returning) return `M${ex} ${ey}L${px} ${py}V${bridge}H${sx}V${sy}`;
    return `M${sx} ${sy}V${bridge}H${px}V${py}${stop ? "" : `L${ex} ${ey}`}`;
  }
  function resumePath(row) {
    return `M${layout.park[row].x} ${layout.park[row].y}L${layout.ports[row].x} ${layout.ports[row].y}`;
  }
  function draw() {
    const width = Math.round(host.clientWidth),
      compact = width < 560,
      dbWidth = Math.min(470, width - 34),
      dbLeft = (width - dbWidth) / 2,
      rowWidth = (dbWidth - 30) / 2;
    layout = {
      width,
      compact,
      dbWidth,
      dbLeft,
      rowWidth,
      height: 606,
      cardWidth: Math.min(192, (width - 66) / 2),
      clients: { T1: width * 0.24, T2: width * 0.76 - (compact ? 8 : 0) },
      rowX: { A: dbLeft + 10, B: dbLeft + 20 + rowWidth },
      rowY: 466,
      park: {
        A: { x: dbLeft + 30, y: 430 },
        B: { x: dbLeft + dbWidth - 30, y: 430 },
      },
      ports: {
        A: { x: dbLeft + 3, y: 500 },
        B: { x: dbLeft + dbWidth - 3, y: 500 },
      },
    };
    host.style.height = `${layout.height}px`;
    host.dataset.compact = String(compact);
    svg.setAttribute("viewBox", `0 0 ${width} ${layout.height}`);
    svg.innerHTML = `<defs><marker id="dl-arrow" viewBox="0 0 8 8" markerWidth="5" markerHeight="5" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="context-stroke"/></marker></defs>
      ${ids.map((id) => rowIds.map((row) => `<path class="dl-route" data-route="${id}-${row}" d="${requestPath(id, row)}" style="--actor:${color(id)}" marker-end="url(#dl-arrow)"/>`).join("")).join("")}
      ${ids.map((id, i) => `<g class="dl-device" data-device="${id}"><text class="dl-device-title" x="${layout.clients[id]}" y="61" text-anchor="middle">클라이언트 ${i + 1}</text>${housing(layout.clients[id] - layout.cardWidth / 2 - 5, 167, layout.cardWidth + 10, 114)}${laptop(layout.clients[id], 146, Math.min(compact ? 114 : 138, width * 0.32))}${socketPort(layout.clients[id], 283)}</g>`).join("")}
      <g class="dl-database">${housing(dbLeft, 454, dbWidth, 136, 10)}${database(width / 2, 450, 112)}${rowIds.map((row) => socketPort(layout.ports[row].x, layout.ports[row].y)).join("")}</g>
      ${rowIds.map((row) => `<g class="dl-gate" data-gate="${row}" transform="translate(${layout.ports[row].x} ${layout.ports[row].y})"><path d="M-4 14H4"/><path class="dl-gate-arm" d="M0 13V-13"/></g>`).join("")}<path class="dl-motion-path"/>`;
    for (const id of ids)
      Object.assign(cards[id].style, {
        left: `${layout.clients[id] - layout.cardWidth / 2}px`,
        top: "177px",
        width: `${layout.cardWidth}px`,
      });
    for (const row of rowIds) {
      Object.assign(rows[row].style, {
        left: `${layout.rowX[row]}px`,
        top: `${layout.rowY}px`,
        width: `${rowWidth}px`,
      });
      Object.assign(queues[row].style, {
        left: `${layout.park[row].x - 39}px`,
        top: `${layout.park[row].y - 22}px`,
      });
    }
    Object.assign(cycle.style, {
      left: `${(width - Math.min(320, width - 100)) / 2}px`,
      width: `${Math.min(320, width - 100)}px`,
      top: "307px",
    });
    if (lastStep) snap(lastStep.state);
  }
  function snap(state) {
    paintedState = state;
    host.dataset.deadlocked = String(state.deadlocked);
    for (const id of ids) {
      const client = state.clients[id],
        waiting = client.waitingFor,
        waitingRow = waiting ? state.rows[waiting] : null,
        ready = !!waitingRow && !waitingRow.owner,
        held = client.held.join(" · ") || "없음";
      let label = statusLabel[client.status];
      if (ready) label = "재개 가능";
      if (state.detected && state.victim === id && client.status !== "aborted")
        label = "중단 대상";
      cards[id].dataset.status = client.status;
      cards[id].dataset.victim = String(
        state.detected && state.victim === id && client.status !== "aborted",
      );
      cards[id].querySelector("[data-status]").textContent = label;
      cards[id].querySelector("[data-held]").textContent = held;
      cards[id].querySelector("[data-waiting]").textContent = waiting
        ? `${waiting} · ${ready ? "재개 가능" : waitingRow.owner + " 보유"}`
        : "없음";
      cards[id].setAttribute(
        "aria-label",
        `${id} ${label}. 보유 ${held}. ${waiting ? waiting + " 대기, " + (ready ? "재개 가능" : "보유자 " + waitingRow.owner) : "대기 없음"}`,
      );
    }
    for (const row of rowIds) {
      const data = state.rows[row],
        card = rows[row],
        waiting = data.waiting[0],
        ready = waiting && !data.owner;
      card.style.setProperty(
        "--owner",
        data.owner ? color(data.owner) : "var(--border)",
      );
      card.dataset.owned = String(!!data.owner);
      card.dataset.transition =
        lastStep.action === "rollback" &&
        row === "B" &&
        state.rollbacks > lastStep.before.rollbacks
          ? "rollback"
          : lastStep.action === "commit" &&
              state.commits > lastStep.before.commits
            ? "commit"
            : "none";
      card.querySelector("[data-stock]").textContent = data.committed;
      card.querySelector("[data-owner]").textContent = data.owner
        ? `보유 ${data.owner}`
        : "잠금 없음";
      card.querySelector("[data-pending]").textContent = data.pending
        ? `${data.pending.client} · ${data.pending.value}`
        : "없음";
      const note = card.querySelector("[data-note]");
      if (card.dataset.transition === "rollback")
        note.innerHTML = `<s>${lastStep.before.rows[row].pending.value}</s> 폐기 · 확정 ${data.committed} 유지`;
      else if (
        lastStep.action === "rollback" &&
        state.rollbacks > lastStep.before.rollbacks
      )
        note.textContent = "T2 대기 취소 · T1 보유";
      else if (card.dataset.transition === "commit")
        note.textContent = `${lastStep.before.rows[row].committed} → ${data.committed} 확정 · 잠금 해제`;
      else
        note.textContent = data.pending
          ? "커밋 전 · 확정 값 유지"
          : data.owner
            ? "행 잠금 유지"
            : "변경 없음";
      queues[row].hidden = !waiting;
      queues[row].dataset.ready = String(!!ready);
      queues[row].innerHTML = waiting
        ? `${badge(waiting)}<b>${row} 요청</b><span>${ready ? "재개 가능" : "SQL 대기"}</span>`
        : "";
      const gate = svg.querySelector(`[data-gate="${row}"]`);
      gate.dataset.open = String(!data.owner);
      gate.dataset.waiting = String(!!waiting);
    }
    for (const id of ids)
      for (const row of rowIds) {
        const route = svg.querySelector(`[data-route="${id}-${row}"]`),
          data = state.rows[row];
        route.dataset.owned = String(data.owner === id);
        route.dataset.waiting = String(data.waiting.includes(id));
        route.setAttribute(
          "d",
          requestPath(id, row, data.waiting.includes(id)),
        );
      }
    cycle.dataset.cycle = String(state.deadlocked);
    cycle.querySelector("[data-cycle-title]").textContent = state.deadlocked
      ? state.detected
        ? "교착 감지 · T2 중단 선택"
        : "순환 대기 · 서로 진행 불가"
      : ids.some((id) => state.clients[id].waitingFor)
        ? "남은 대기 관계"
        : "대기 관계 없음";
    cycle.querySelector("[data-cycle-edges]").innerHTML = state.deadlocked
      ? `<div>${badge("T1")}<span>B →</span>${badge("T2")}<span>A →</span>${badge("T1")}</div>`
      : ids
          .filter((id) => state.clients[id].waitingFor)
          .map((id) => {
            const row = state.clients[id].waitingFor,
              owner = state.rows[row].owner;
            return `<div>${badge(id)}<span>${row} ${owner ? "기다림 →" : "요청 → 재개 가능"}</span>${owner ? badge(owner) : ""}</div>`;
          })
          .join("");
  }
  function phase(step, title, body, kind) {
    callout.innerHTML = `${step.client ? badge(step.client) : ""}<strong>${title}</strong>`;
    if (step.action === "commit" && ["database", "response"].includes(kind)) {
      cards.T1.querySelector("[data-status]").textContent = "커밋 응답 대기";
      cards.T1.setAttribute(
        "aria-label",
        "T1 커밋 응답 대기. 보유 없음. 대기 없음",
      );
    }
    onPhase({ title, body, kind, snapshot: paintedState });
  }
  function completeTitle(step) {
    switch (step.action) {
      case "initial":
        return "서로 다른 순서로 두 행을 갱신합니다";
      case "begin":
        return `${step.client} 트랜잭션 시작`;
      case "write":
        return `${step.client} · ${step.row} 쓰기 후 잠금 보유`;
      case "wait":
        return step.state.deadlocked
          ? "T1 → T2 → T1 · 순환 대기"
          : "T1은 B를 기다리며 A를 계속 보유";
      case "detect":
        return "교착 상태 감지 · 예제에서는 T2 선택";
      case "rollback":
        return "T2 롤백 · B 잠금 해제 · T1 재개 가능";
      case "resume":
        return "T1의 B 요청 재개 · A와 B 모두 보유";
      case "commit":
        return "A 9 · B 19 확정 · 모든 잠금 해제";
    }
  }
  function cancel() {
    if (active) {
      active.cancelled = true;
      for (const animation of active.animations) animation.cancel();
    }
    active = null;
    packet.hidden = true;
    host
      .querySelectorAll("[data-active]")
      .forEach((e) => delete e.dataset.active);
  }
  async function animate(run, element, keyframes, options) {
    const animation = element.animate(keyframes, options);
    run.animations.add(animation);
    if (run.paused) animation.pause();
    await animation.finished.catch(() => {});
    run.animations.delete(animation);
  }
  async function travel(run, id, label, path, pace) {
    if (run.cancelled) return;
    const line = svg.querySelector(".dl-motion-path");
    line.setAttribute("d", path);
    line.dataset.active = "true";
    line.dataset.response = String(["확인", "확정"].includes(label));
    line.style.setProperty("--actor", color(id));
    const length = line.getTotalLength();
    packet.textContent = label;
    packet.style.setProperty("--actor", color(id));
    packet.hidden = false;
    const frames = Array.from({ length: 41 }, (_, i) => {
      const p = line.getPointAtLength((length * i) / 40);
      return {
        transform: `translate(${p.x - 32}px,${p.y - 14}px)`,
        opacity: i === 0 || i === 40 ? 0 : 1,
        offset: i / 40,
      };
    });
    await animate(run, packet, frames, {
      duration: (320 + length * 1.1) * pace,
      easing: "linear",
    });
    if (!run.cancelled) {
      packet.hidden = true;
      delete line.dataset.active;
    }
  }
  async function update(
    step,
    previous = null,
    { animate: motion = true, speed = 1 } = {},
  ) {
    cancel();
    lastStep = step;
    if (!motion || !previous || reduced.matches || step.index === 0) {
      snap(getDeadlockPresentationState(step, "complete"));
      phase(step, completeTitle(step), "", "complete");
      return;
    }
    const run = { cancelled: false, paused: false, animations: new Set() };
    active = run;
    const pace = 1 / speed,
      row = step.row || (step.client === "T2" ? "B" : "A");
    snap(getDeadlockPresentationState(step, "request"));
    if (step.action === "detect") {
      phase(
        step,
        "DB가 순환 대기를 확인합니다",
        "T1은 T2가 가진 B를, T2는 T1이 가진 A를 기다립니다. 둘 다 스스로 진행할 수 없습니다.",
        "request",
      );
      await animate(
        run,
        cycle,
        [
          { outlineColor: "var(--warning)" },
          { outlineColor: "var(--warning)" },
        ],
        { duration: 1100 * pace },
      );
      if (run.cancelled) return;
      snap(getDeadlockPresentationState(step, "database"));
      phase(
        step,
        "예제에서는 T2를 중단 대상으로 선택",
        "실제 PostgreSQL이 어느 트랜잭션을 중단할지는 미리 보장할 수 없습니다.",
        "database",
      );
      await animate(
        run,
        cards.T2,
        [{ transform: "translateY(-3px)" }, { transform: "translateY(0)" }],
        { duration: 650 * pace },
      );
    } else if (step.action === "rollback") {
      phase(
        step,
        "DB가 T2를 중단합니다",
        "T2의 미확정 쓰기, 보유 잠금, 기다리던 요청을 함께 정리합니다. 클라이언트가 새 ROLLBACK 요청을 보내는 장면은 아닙니다.",
        "request",
      );
      await animate(
        run,
        cards.T2,
        [
          { outlineColor: "var(--warning)" },
          { outlineColor: "var(--warning)" },
        ],
        { duration: 650 * pace },
      );
      if (run.cancelled) return;
      snap(getDeadlockPresentationState(step, "database"));
      phase(
        step,
        "T2의 19 폐기 · B의 확정 20 유지",
        "B 잠금과 A 대기를 함께 해제했습니다. T1의 A 미확정 9는 그대로이며, B 요청이 이제 진행할 수 있습니다.",
        "database",
      );
      await animate(
        run,
        rows.B.querySelector("[data-note]"),
        [
          { opacity: 0.35, transform: "translateY(-4px)" },
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 1 },
        ],
        { duration: 1300 * pace },
      );
    } else {
      if (step.action === "resume") {
        phase(
          step,
          "DB에서 대기하던 B 요청을 이어서 처리",
          "새 SQL을 보내지 않습니다. T2가 놓은 B 잠금 앞에서 기존 요청이 재개됩니다.",
          "request",
        );
        queues[row].hidden = true;
        await travel(run, step.client, "B 재개", resumePath(row), pace);
      } else {
        phase(
          step,
          step.action === "wait"
            ? `${step.client} · ${row} 잠금 요청`
            : step.action === "commit"
              ? "두 행의 변경을 COMMIT 요청"
              : step.action === "begin"
                ? "트랜잭션 시작 요청"
                : `${row} 재고를 1 줄이는 요청`,
          step.action === "commit"
            ? "DB에 도착하기 전에는 A와 B의 값이 미확정이며 T1이 두 잠금을 보유합니다."
            : step.action === "begin"
              ? "트랜잭션을 시작합니다. BEGIN만으로 A나 B의 행 잠금을 얻지는 않습니다."
              : "요청이 DB에 도착하면 해당 행의 잠금 상태를 확인합니다.",
          "request",
        );
        await travel(
          run,
          step.client,
          step.action === "begin"
            ? "시작"
            : step.action === "commit"
              ? "커밋"
              : `${row} 쓰기`,
          requestPath(step.client, row, step.action === "wait"),
          pace,
        );
      }
      if (run.cancelled) return;
      snap(getDeadlockPresentationState(step, "database"));
      if (step.action === "wait") {
        phase(
          step,
          step.state.deadlocked
            ? "서로 상대 잠금을 기다립니다"
            : `${step.client}의 ${row} 요청 대기`,
          step.state.deadlocked
            ? "T1은 A를 쥔 채 B를, T2는 B를 쥔 채 A를 기다립니다. 대기 경로가 원을 이룹니다."
            : "T1이 A를 놓고 기다리는 것이 아닙니다. A 잠금을 유지한 채 T2의 B를 기다립니다.",
          "database",
        );
        await animate(
          run,
          queues[row],
          [{ transform: "translateY(-4px)" }, { transform: "translateY(0)" }],
          { duration: 450 * pace },
        );
      } else {
        if (step.action === "commit") {
          phase(
            step,
            "A 10 → 9 · B 20 → 19 확정",
            "두 미확정 값이 함께 확정되고 T1의 모든 행 잠금이 해제됩니다. T2는 롤백된 상태로 남습니다.",
            "database",
          );
          await Promise.all(
            rowIds.map((r) =>
              animate(
                run,
                rows[r],
                [
                  { outlineColor: "var(--ink)" },
                  { outlineColor: "var(--ink)" },
                ],
                { duration: 1200 * pace },
              ),
            ),
          );
          if (run.cancelled) return;
        }
        phase(
          step,
          step.action === "resume"
            ? "T1이 B도 보유 · 재고 19는 미확정"
            : step.action === "commit"
              ? "커밋 완료 응답이 돌아갑니다"
              : "DB 처리 결과가 돌아갑니다",
          step.action === "resume"
            ? "롤백으로 남은 확정 값 20에서 1을 줄였습니다. T1은 A와 B를 모두 커밋까지 보유합니다."
            : "DB에 적용된 상태를 클라이언트에 알립니다.",
          "response",
        );
        await travel(
          run,
          step.client,
          step.action === "commit" ? "확정" : "확인",
          requestPath(step.client, row, false, true),
          pace,
        );
      }
    }
    if (run.cancelled) return;
    snap(getDeadlockPresentationState(step, "complete"));
    phase(step, completeTitle(step), "", "complete");
    active = null;
  }
  draw();
  const observer = new ResizeObserver(() => {
    if (Math.abs(host.clientWidth - layout.width) > 1) {
      cancel();
      draw();
      if (lastStep) phase(lastStep, completeTitle(lastStep), "", "complete");
    }
  });
  observer.observe(host);
  return {
    update,
    pause() {
      if (active) {
        active.paused = true;
        active.animations.forEach((a) => a.pause());
      }
    },
    resume() {
      if (active) {
        active.paused = false;
        active.animations.forEach((a) => a.play());
      }
    },
  };
}
