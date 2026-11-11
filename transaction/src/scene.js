import { getPresentationState } from "./presentation.js";

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
function box(o, u, v, low, high, prefix = "device") {
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
    "device-shadow",
  )}
  ${box(o, u, v, 0, 5)}${polygon(o, panel, "device-screen-shell")}
  ${polygon(
    o,
    [
      [-u + 5, -v - 0.1, 12],
      [u - 5, -v - 0.1, 12],
      [u - 5, -v - 0.1, h - 5],
      [-u + 5, -v - 0.1, h - 5],
    ],
    "device-screen",
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
        "device-code",
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
    "device-keys",
  )}
  ${[0, 1, 2]
    .map((i) => {
      const a = point(o, -u * 0.72, -v * 0.45 + i * v * 0.3, 5.5),
        b = point(o, u * 0.72, -v * 0.45 + i * v * 0.3, 5.5);
      return `<path class="device-detail" d="M${a.join(" ")}L${b.join(" ")}"/>`;
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
    "device-trackpad",
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
    "device-shadow",
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
        "device-drawer",
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
        "device-vent",
      ),
    )
    .join("")}
  <text class="device-engraving" transform="matrix(${COS} .5 ${-COS} .5 ${tx} ${ty})" text-anchor="middle" y="6">DB</text></g>`;
}
function housing(x, y, width, height, depth = 12) {
  const rise = depth / Math.sqrt(3),
    bottom = y + height;
  return `<g>
    <path class="device-shadow" d="M${x + 4} ${bottom + 4}H${x + width + depth + 4}L${x + width + 4} ${bottom + 6}H${x + 4}Z"/>
    <path class="device-top" d="M${x} ${y}L${x + depth} ${y - rise}H${x + width + depth}L${x + width} ${y}Z"/>
    <path class="device-side" d="M${x + width} ${y}L${x + width + depth} ${y - rise}V${bottom - rise}L${x + width} ${bottom}Z"/>
    <rect class="device-front" x="${x}" y="${y}" width="${width}" height="${height}" rx="2"/>
    <path d="M${x + 4} ${y + 5}V${bottom - 4}H${x + width - 4}V${y + 5}" fill="none" stroke="var(--border)" stroke-width="1" opacity=".4"/>
    ${[x + 4, x + width - 4].map((a) => `<circle cx="${a}" cy="${y + 5}" r="1.3" fill="var(--border)"/><circle cx="${a}" cy="${bottom - 5}" r="1.3" fill="var(--border)"/>`).join("")}
  </g>`;
}
const socketPort = (x, y) =>
  `<rect x="${x - 3}" y="${y - 4}" width="6" height="8" fill="var(--ink)" stroke="var(--surface)" stroke-width="1"/>`;
const STATUS = {
  idle: "시작 전",
  active: "진행 중",
  waiting: "SQL 대기",
  committed: "커밋 완료",
};
const color = (id) => `var(--${id.toLowerCase()})`;

export function createTransactionScene(host, { onPhase = () => {} } = {}) {
  host.className = "transaction-scene";
  host.innerHTML = `<svg class="scene-map" aria-hidden="true"></svg><div class="scene-callout" aria-live="off"></div>
    ${["T1", "T2"].map((id, i) => `<div class="client-card" data-client="${id}" style="--client-color:${color(id)}"><div class="client-card-head"><b class="tx-id ${id.toLowerCase()}">${id}</b><strong>주문 ${i + 1}</strong></div><div class="client-role" data-status></div><div class="local-values"><span>읽은 값 <b data-read>—</b></span><span>앱 계산 <b data-write>—</b></span></div></div>`).join("")}
    <div class="stock-card"><div class="stock-card-head"><strong>재고 행</strong><span data-row-caption>inventory · id = 1</span></div><div class="stock-values"><div><span>확정 재고</span><b data-stock>10</b><small data-version>버전 0</small></div><div class="pending-value"><span data-pending-owner>미확정 쓰기</span><b data-pending>—</b><small>커밋 전</small></div></div></div>
    <div class="row-lock"><svg class="lock-icon" viewBox="0 0 22 22" aria-hidden="true"><path class="lock-shackle" d="M6 10V7a5 5 0 0 1 10 0v3"/><rect x="4" y="10" width="14" height="10" rx="1"/><path d="M11 14v3"/></svg><strong data-lock>행 잠금 없음</strong><span data-wait></span></div>
    <div class="parked-query" hidden><b class="tx-id t2">T2</b><strong></strong><span></span></div><div class="query-packet" hidden></div>`;
  const svg = host.querySelector("svg"),
    callout = host.querySelector(".scene-callout"),
    packet = host.querySelector(".query-packet"),
    parked = host.querySelector(".parked-query");
  const stock = host.querySelector(".stock-card"),
    lock = host.querySelector(".row-lock");
  const cards = Object.fromEntries(
    ["T1", "T2"].map((id) => [id, host.querySelector(`[data-client="${id}"]`)]),
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let layout,
    active = null,
    lastStep = null,
    paintedState = null;

  function path(id, returning = false, stopping = false) {
    const c = layout.clients[id],
      left = id === "T1",
      sign = left ? -1 : 1;
    const laneX = layout.mobile ? (left ? 42 : layout.width - 42) : c.x;
    const offset = returning ? -sign * 11 : sign * 11;
    const sx = c.x + offset,
      sy = layout.cardY + layout.cardHeight + 7;
    const dx = layout.dbX + sign * (layout.rowWidth / 2 + 9),
      dy = layout.rowY + (returning ? 53 : 28);
    if (stopping)
      return `M${sx} ${sy}H${laneX + offset}V${layout.park.y}H${layout.park.x}`;
    return returning
      ? `M${dx} ${dy}H${laneX + offset}V${sy}H${sx}`
      : `M${sx} ${sy}H${laneX + offset}V${dy}H${dx}`;
  }
  function resumePath() {
    const lane = layout.mobile ? layout.width - 31 : layout.clients.T2.x + 11;
    return `M${layout.park.x} ${layout.park.y}H${lane}V${layout.rowY + 28}H${layout.dbX + layout.rowWidth / 2 + 9}`;
  }
  function draw() {
    const previousArm = svg.querySelector(".gate-arm");
    const width = Math.round(host.clientWidth),
      mobile = width < 560;
    layout = {
      width,
      mobile,
      height: mobile ? 573 : 520,
      clients: {
        T1: { x: width * 0.24 },
        T2: { x: width * 0.76 - (mobile ? 8 : 0) },
      },
      cardWidth: Math.min(192, (width - 66) / 2),
      cardHeight: 96,
      cardY: 205,
      dbX: width / 2,
      dbY: mobile ? 407 : 350,
      rowY: mobile ? 449 : 392,
      rowWidth: Math.min(252, width - 100),
    };
    layout.park = {
      x: mobile ? width - 54 : layout.dbX + layout.rowWidth / 2 + 67,
      y: layout.rowY - 34,
    };
    host.dataset.compact = String(mobile);
    host.style.height = `${layout.height}px`;
    svg.setAttribute("viewBox", `0 0 ${width} ${layout.height}`);
    svg.innerHTML = `<defs><marker id="tx-arrow" viewBox="0 0 8 8" markerWidth="5" markerHeight="5" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z"/></marker></defs>
      ${["T1", "T2"].map((id) => `<g class="connection" data-connection="${id}" style="--lane-color:${color(id)}"><path class="request-lane" d="${path(id)}" marker-end="url(#tx-arrow)"/><path class="return-lane" d="${path(id, true)}" marker-end="url(#tx-arrow)"/><text x="${layout.clients[id].x}" y="324" text-anchor="middle">요청 ↓ · 응답 ↑</text></g>`).join("")}
      ${["T1", "T2"]
        .map(
          (
            id,
            i,
          ) => `<g class="client-device" data-device="${id}"><text class="device-title" x="${layout.clients[id].x}" y="57" text-anchor="middle">클라이언트 ${i + 1}</text>
        ${housing(layout.clients[id].x - layout.cardWidth / 2 - 5, 195, layout.cardWidth + 10, 114)}
        ${laptop(layout.clients[id].x, 159, Math.min(mobile ? 119 : 143, width * 0.34))}
        ${socketPort(layout.clients[id].x - 11, 308)}${socketPort(layout.clients[id].x + 11, 308)}</g>`,
        )
        .join("")}
      <g class="database-device">
        ${housing(layout.dbX - layout.rowWidth / 2 - 16, layout.rowY - 10, layout.rowWidth + 32, 128)}
        ${database(layout.dbX, layout.dbY, mobile ? 139 : 156)}
        ${[-1, 1].map((side) => [28, 53].map((offset) => socketPort(layout.dbX + side * (layout.rowWidth / 2 + 9), layout.rowY + offset)).join("")).join("")}
      </g><g class="query-gate" data-gate hidden transform="translate(${layout.dbX + layout.rowWidth / 2 + 13} ${layout.rowY + 28})"><path class="gate-post" d="M-3 13H3M0 10V15"/><path class="gate-arm" d="M0 10V-12"/><rect x="-3" y="-15" width="6" height="6"/></g><path class="motion-path"/>`;
    for (const [id, card] of Object.entries(cards))
      Object.assign(card.style, {
        left: `${layout.clients[id].x - layout.cardWidth / 2}px`,
        top: `${layout.cardY}px`,
        width: `${layout.cardWidth}px`,
        boxShadow: "none",
      });
    Object.assign(stock.style, {
      left: `${layout.dbX - layout.rowWidth / 2}px`,
      top: `${layout.rowY}px`,
      width: `${layout.rowWidth}px`,
      boxShadow: "none",
    });
    Object.assign(lock.style, {
      left: `${layout.dbX - layout.rowWidth / 2 - 8}px`,
      top: `${layout.rowY + 86}px`,
      width: `${layout.rowWidth + 16}px`,
      zIndex: "2",
    });
    Object.assign(parked.style, {
      left: `${layout.park.x - 44}px`,
      top: `${layout.park.y - 24}px`,
    });
    if (previousArm) svg.querySelector(".gate-arm").replaceWith(previousArm);
    if (paintedState) paintConnections(paintedState.rowLock);
    active?.updateRoute?.();
  }
  function paintConnections({ owner, waiting }) {
    const ready = !owner && waiting.length > 0;
    for (const id of ["T1", "T2"]) {
      const connection = svg.querySelector(`[data-connection="${id}"]`);
      connection.dataset.owner = String(owner === id);
      connection.dataset.waiting = String(waiting.includes(id) && !ready);
      connection.querySelector(".request-lane").setAttribute("d", path(id, false, waiting.includes(id)));
    }
    const gate = svg.querySelector("[data-gate]");
    gate.toggleAttribute("hidden", !waiting.length);
    gate.setAttribute("visibility", waiting.length ? "visible" : "hidden");
    gate.dataset.open = String(ready);
  }
  function snap(state) {
    paintedState = state;
    paintConnections(state.rowLock);
    const owner = state.rowLock.owner,
      waiting = state.rowLock.waiting,
      ready = !owner && waiting.length > 0,
      committed =
        lastStep?.action === "commit" &&
        state.committedVersion === lastStep.state.committedVersion;
    const writesStock = ["write", "resume-write", "commit"].includes(lastStep.action) ||
      (lastStep.action === "wait" && lastStep.mode === "naive");
    for (const id of ["T1", "T2"]) {
      const client = state.clients[id],
        card = cards[id];
      card.dataset.state = client.status;
      const role =
        owner === id
          ? "owner"
          : waiting.includes(id)
            ? ready
              ? "ready"
              : "waiting"
            : client.status;
      const roleLabel =
        {
          owner: "잠금 보유",
          waiting: "잠금 대기",
          ready: "재개 가능",
        }[role] || STATUS[client.status];
      card.dataset.role = role;
      card.querySelector("[data-status]").textContent = roleLabel;
      card.querySelector("[data-read]").textContent = client.localRead ?? "—";
      card.querySelector("[data-write]").textContent = client.localWrite ?? "—";
      card.toggleAttribute("data-write-source", id === lastStep.client && writesStock);
      card.setAttribute(
        "aria-label",
        `${id} ${roleLabel}. 읽은 값 ${client.localRead ?? "없음"}, 앱 계산 ${client.localWrite ?? "없음"}`,
      );
    }
    stock.querySelector("[data-stock]").textContent = state.committedStock;
    stock.querySelector("[data-version]").textContent =
      `버전 ${state.committedVersion}`;
    stock.querySelector("[data-pending]").textContent =
      state.uncommitted?.stock ?? "—";
    stock.querySelector("[data-pending-owner]").textContent = state.uncommitted
      ? `${state.uncommitted.client} 미확정`
      : "미확정 쓰기";
    stock.dataset.pending = String(!!state.uncommitted);
    stock.dataset.owned = String(!!owner);
    stock.style.setProperty(
      "--owner-color",
      owner ? color(owner) : "var(--border)",
    );
    stock.style.setProperty(
      "--pending-color",
      state.uncommitted ? color(state.uncommitted.client) : "var(--muted)",
    );
    lock.dataset.locked = String(!!state.rowLock.owner);
    lock.style.setProperty(
      "--lock-color",
      state.rowLock.owner ? color(state.rowLock.owner) : "var(--muted)",
    );
    lock.querySelector("[data-lock]").textContent = owner
      ? `보유 ${owner}`
      : ready || committed
        ? "잠금 해제"
        : "잠금 없음";
    lock.querySelector("[data-wait]").textContent = waiting.length
      ? ready
        ? `${waiting.join("·")} 재개 가능`
        : `대기 ${waiting.join("·")}`
      : "대기 없음";
    lock.dataset.ready = String(ready);
    parked.hidden = !waiting.length;
    parked.dataset.ready = String(ready);
    parked.querySelector("strong").textContent = waiting.length && lastStep.mode === "naive"
      ? `쓰기 ${state.clients[waiting[0]].localWrite}` : "읽기";
    parked.querySelector("span").textContent = ready ? "재개 가능" : "SQL 대기";
    const pending = state.uncommitted;
    stock.querySelector(".pending-value small").textContent = pending
      ? `${state.clients[pending.client].localRead} − 1` : "커밋 전";
    const caption = stock.querySelector("[data-row-caption]");
    caption.textContent = "inventory · id = 1";
    if (pending) caption.textContent = pending.stock === state.committedStock
      ? "같은 값 다시 쓰기 · 커밋 전" : "차감 반영 대기 · 커밋 전";
    stock.dataset.committing = String(committed);
    if (committed) {
      const decrement = lastStep.before.committedStock - state.committedStock;
      caption.textContent = `이번 주문 · 실제 차감 ${decrement}개`;
      stock.querySelector("[data-version]").textContent =
        `${lastStep.before.committedStock} → ${state.committedStock} 확정`;
      stock.querySelector(".pending-value small").textContent =
        `직전 ${lastStep.before.uncommitted.stock} → 확정`;
      stock.querySelector("[data-pending-owner]").textContent = "미확정 없음";
    }
  }
  function phase(client, title, body, kind = "database") {
    if (lastStep.action === "commit" && ["commit", "response"].includes(kind)) {
      cards[client].querySelector("[data-status]").textContent =
        "커밋 응답 대기";
      const state = paintedState.clients[client];
      cards[client].setAttribute(
        "aria-label",
        `${client} 커밋 응답 대기. 읽은 값 ${state.localRead}, 앱 계산 ${state.localWrite}`,
      );
    }
    callout.innerHTML = `${client ? `<b class="tx-id ${client.toLowerCase()}">${client}</b>` : ""}<strong>${title}</strong>`;
    onPhase({ title, body, kind, snapshot: paintedState });
  }
  function cancel() {
    if (active) {
      active.cancelled = true;
      for (const a of active.animations) a.cancel();
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
  async function travel(run, id, label, returning, pace, route = () => path(id, returning)) {
    if (run.cancelled) return;
    const laneSelector = `[data-connection="${id}"] ${returning ? ".return-lane" : ".request-lane"}`;
    run.updateRoute = () => {
      const data = route();
      const measurement = svg.querySelector(".motion-path");
      measurement.setAttribute("d", data);
      packet.style.offsetPath = `path("${data}")`;
      const lane = svg.querySelector(laneSelector);
      lane.dataset.active = "true";
      lane.setAttribute("d", data);
      return measurement.getTotalLength();
    };
    const distance = run.updateRoute();
    packet.hidden = false;
    packet.textContent = label;
    packet.style.setProperty("--packet-color", color(id));
    await animate(run, packet, [
      { offsetDistance: "0%", opacity: 0 },
      { opacity: 1, offset: 0.04 },
      { opacity: 1, offset: 0.96 },
      { offsetDistance: "100%", opacity: 0 },
    ], {
      duration: (350 + distance * 1.1) * pace,
      easing: "linear",
    });
    if (run.cancelled) return;
    packet.hidden = true;
    run.updateRoute = null;
    const lane = svg.querySelector(laneSelector);
    delete lane.dataset.active;
    lane.setAttribute("d", path(id, returning));
  }
  function completedTitle(step) {
    const client = step.state.clients[step.client];
    if (step.action === "initial") return "두 주문이 같은 재고 행을 사용합니다";
    if (step.action === "begin") return "트랜잭션을 시작했습니다";
    if (step.action === "wait")
      return `${step.state.rowLock.owner}의 잠금 해제를 기다립니다`;
    if (step.action === "commit")
      return `${step.before.committedStock} → ${step.state.committedStock} 확정 · 잠금 해제`;
    if (step.action === "calculate")
      return `앱 계산 완료 · ${client.localRead} − 1 = ${client.localWrite}`;
    if (step.action === "read" || step.action === "resume-read")
      return `재고 ${client.localRead}개를 앱에 보관했습니다`;
    return `재고 ← ${client.localWrite} · 커밋 대기`;
  }
  async function update(
    step,
    previous = null,
    { animate: motion = true, speed = 1 } = {},
  ) {
    cancel();
    lastStep = step;
    if (!motion || !previous || reduced.matches || step.index === 0) {
      snap(getPresentationState(step, "complete"));
      phase(step.client, completedTitle(step), "", "complete");
      return;
    }
    const run = {
      animations: new Set(),
      cancelled: false,
      paused: false,
    };
    active = run;
    const id = step.client,
      client = step.state.clients[id],
      pace = 1 / speed;
    snap(getPresentationState(step, "request"));
    if (step.action === "calculate") {
      phase(
        id,
        `${client.localRead} − 1을 앱에서 계산`,
        "DB 요청 없이 앱이 기억하는 값으로 계산합니다.",
        "request",
      );
      cards[id].dataset.active = "true";
      await animate(
        run,
        cards[id],
        [
          { transform: "translateY(0)" },
          { transform: "translateY(-4px)", offset: 0.45 },
          { transform: "translateY(0)" },
        ],
        { duration: 650 * pace, easing: "ease-in-out" },
      );
      if (run.cancelled) return;
      snap(getPresentationState(step, "complete"));
      delete cards[id].dataset.active;
    } else {
      const resuming = step.action.startsWith("resume");
      if (!resuming) {
        phase(
          id,
          step.action === "commit"
            ? "COMMIT 요청"
            : step.action === "begin"
              ? "트랜잭션 시작 요청"
              : step.action === "read" ||
                  (step.action === "wait" && step.mode === "locked")
                ? "재고 읽기 요청"
                : "재고 쓰기 요청",
          step.action === "commit"
            ? "COMMIT이 DB에 도착하기 전에는 미확정 값과 행 잠금을 유지합니다."
            : step.action === "begin"
              ? "새 트랜잭션을 시작합니다. 아직 재고를 읽거나 쓰지 않습니다."
              : step.action === "read" ||
                  (step.action === "wait" && step.mode === "locked")
                ? step.mode === "locked"
                  ? "행 잠금을 얻은 뒤 재고를 읽습니다. 다른 트랜잭션이 보유 중이면 이 SQL이 기다립니다."
                  : "확정된 재고를 요청합니다. 응답이 돌아와야 앱의 읽은 값이 바뀝니다."
                : `앱에서 계산한 ${client.localWrite}을 쓰는 요청입니다. 쓰기가 끝나도 커밋 전까지는 미확정입니다.`,
          "request",
        );
        await travel(
          run,
          id,
          step.action === "commit"
            ? "커밋"
            : step.action === "begin"
              ? "시작"
              : step.action === "read" ||
                  (step.action === "wait" && step.mode === "locked")
                ? "읽기"
                : `재고 ← ${client.localWrite}`,
          false,
          pace,
          () => path(id, false, step.action === "wait"),
        );
        if (run.cancelled) return;
      } else {
        phase(
          id,
          "대기하던 SQL을 이어서 실행합니다",
          "새 요청을 보내지 않고 DB에서 기다리던 요청이 진행합니다.",
          "resume",
        );
        parked.hidden = true;
        await travel(
          run,
          id,
          step.action === "resume-read" ? "읽기 재개" : `재고 ← ${client.localWrite}`,
          false,
          pace,
          resumePath,
        );
        if (run.cancelled) return;
      }
      snap(getPresentationState(step, "database"));
      if (step.action === "wait") {
        phase(
          id,
          `${step.before.rowLock.owner}의 잠금 해제를 기다립니다`,
          step.mode === "locked"
            ? "읽기 결과를 아직 받지 못했습니다."
            : "앱에서 계산한 값은 그대로인 채 UPDATE가 기다립니다.",
          "wait",
        );
        await animate(
          run,
          parked,
          [{ transform: "translateY(-4px)" }, { transform: "translateY(0)" }],
          { duration: 320 * pace, easing: "ease-out" },
        );
      } else {
        const reading = step.action === "read" || step.action === "resume-read";
        const writing = step.action === "write" || step.action === "resume-write";
        if (step.action === "commit") {
          phase(
            id,
            `${step.before.committedStock} → ${step.state.committedStock} 확정 · 잠금 해제`,
            step.state.rowLock.waiting.length
              ? "미확정 쓰기가 확정되는 순간 행 잠금도 함께 해제됩니다. 대기 SQL의 실제 재개는 다음 사건입니다."
              : "미확정 쓰기가 확정되는 순간 행 잠금도 함께 해제됩니다. 두 트랜잭션이 끝났습니다.",
            "commit",
          );
          await Promise.all([
            animate(
              run,
              stock.querySelector("[data-stock]"),
              [
                { transform: "translateY(6px)", opacity: 0.3 },
                { transform: "translateY(0)", opacity: 1 },
              ],
              { duration: 300 * pace, easing: "ease-out" },
            ),
            animate(
              run,
              lock.querySelector(".lock-shackle"),
              [{ transform: "rotate(0deg)" }, { transform: "rotate(-28deg)" }],
              { duration: 300 * pace, easing: "ease-out" },
            ),
            animate(
              run,
              svg.querySelector(".gate-arm"),
              [{ transform: "rotate(0deg)" }, { transform: "rotate(70deg)" }],
              { duration: 300 * pace, easing: "ease-out" },
            ),
            animate(
              run,
              stock,
              [{ outlineColor: "var(--ink)" }, { outlineColor: "var(--ink)" }],
              { duration: 1200 * pace },
            ),
          ]);
          if (run.cancelled) return;
        }
        phase(
          id,
          reading
            ? `DB에서 재고 ${client.localRead}개를 반환합니다`
            : writing
              ? `DB에 재고 ${client.localWrite} 기록 · 커밋 대기`
              : step.action === "commit"
                ? `${step.state.committedStock} 확정 · 잠금 해제`
                : "DB 처리가 끝났습니다",
          reading
            ? "응답이 도착하면 앱이 읽은 값을 기억합니다."
            : writing
              ? `현재 확정 재고는 ${step.before.committedStock}개입니다. 앱에서 계산해 보낸 ${client.localWrite}개는 커밋할 때 확정됩니다.`
              : step.action === "commit"
                ? "커밋된 버전이 바뀌고 대기 요청이 진행할 수 있게 됩니다."
                : "클라이언트에 처리 결과를 알립니다.",
          "response",
        );
        await travel(
          run,
          id,
          reading
            ? `${client.localRead} 반환`
            : step.action === "commit"
              ? "확정"
              : "확인",
          true,
          pace,
        );
      }
    }
    if (run.cancelled) return;
    snap(getPresentationState(step, "complete"));
    phase(step.client, completedTitle(step), "", "complete");
    active = null;
  }
  draw();
  const observer = new ResizeObserver(() => {
    if (Math.abs(host.clientWidth - layout.width) > 1) draw();
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
    destroy() {
      cancel();
      observer.disconnect();
      host.replaceChildren();
    },
  };
}
