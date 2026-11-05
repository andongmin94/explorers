import "./scene.css";

const PAGES = ["A", "B", "C", "D", "E"];
const COLOR = Object.fromEntries(
  PAGES.map((page) => [page, `var(--${page.toLowerCase()})`]),
);
const COS = Math.sqrt(3) / 2;
const point = (origin, u, v, z = 0) => [
  origin.x + (u - v) * COS,
  origin.y + (u + v) / 2 - z,
];
const coordinates = (vertices) =>
  vertices.map((p) => p.map((n) => Number(n.toFixed(2))).join(",")).join(" ");
const face = (origin, vertices, className) =>
  `<polygon class="${className}" points="${coordinates(vertices.map((p) => point(origin, ...p)))}"/>`;
function box(origin, u0, u1, v0, v1, z0, z1, prefix = "mem-device") {
  return (
    face(
      origin,
      [
        [u0, v1, z1],
        [u1, v1, z1],
        [u1, v1, z0],
        [u0, v1, z0],
      ],
      `${prefix}-front`,
    ) +
    face(
      origin,
      [
        [u1, v0, z1],
        [u1, v1, z1],
        [u1, v1, z0],
        [u1, v0, z0],
      ],
      `${prefix}-side`,
    ) +
    face(
      origin,
      [
        [u0, v0, z1],
        [u1, v0, z1],
        [u1, v1, z1],
        [u0, v1, z1],
      ],
      `${prefix}-top`,
    )
  );
}
function engraving(origin, text, z, size) {
  const [x, y] = point(origin, 0, 0, z);
  return `<text class="mem-engraving" text-anchor="middle" font-size="${size}" transform="matrix(${COS} .5 ${-COS} .5 ${x} ${y})" y="${size * 0.3}">${text}</text>`;
}
function cpuDrawing({ x, y, width }) {
  const origin = { x, y },
    base = width / (4 * COS),
    chip = base * 0.79,
    die = chip * 0.53;
  const pins = Array.from({ length: 7 }, (_, index) => {
    const p = chip * (-0.8 + index * 0.267),
      a = chip * 0.055;
    return [
      [chip * 0.94, base * 0.96, p - a, p + a],
      [-base * 0.96, -chip * 0.94, p - a, p + a],
      [p - a, p + a, chip * 0.94, base * 0.96],
      [p - a, p + a, -base * 0.96, -chip * 0.94],
    ]
      .map(
        (bounds) => `<g class="mem-pins">${box(origin, ...bounds, 0, 2)}</g>`,
      )
      .join("");
  }).join("");
  return `<g class="mem-cpu">${face(
    { x: x + 4, y: y + 5 },
    [
      [-base, -base, -5],
      [base, -base, -5],
      [base, base, -5],
      [-base, base, -5],
    ],
    "mem-device-shadow",
  )}
    ${box(origin, -base, base, -base, base, -5, 0)}${pins}
    ${box(origin, -chip, chip, -chip, chip, 0, 18)}
    ${box(origin, -die, die, -die, die, 18, 20)}${engraving(origin, "CPU", 21, Math.max(16, width * 0.12))}</g>`;
}
function ramDrawing({ x, y, width, height }) {
  const length = (width * 0.8) / COS,
    thick = 4 / COS,
    tall = height - 22 - length / 2;
  const origin = { x: x + 5, y: y + height - 10 };
  return `<g class="mem-ram">${face(
    { x: origin.x + 4, y: origin.y + 5 },
    [
      [-2, -length - 2, 0],
      [12, -length - 2, 0],
      [12, 2, 0],
      [-2, 2, 0],
    ],
    "mem-device-shadow",
  )}
    ${box(origin, -2, 12, -length - 2, 2, -5, 0)}${box(origin, 0, thick, -length, 0, 0, tall)}
    ${Array.from({ length: 4 }, (_, i) => box(origin, thick, thick + 4, -length * 0.94 + i * length * 0.23, -length * 0.94 + i * length * 0.23 + length * 0.16, tall * 0.24, tall * 0.83, "mem-chip")).join("")}
    ${Array.from({ length: 16 }, (_, i) =>
      face(
        origin,
        [
          [thick + 0.2, -length * 0.96 + i * length * 0.06, 1],
          [thick + 0.2, -length * 0.93 + i * length * 0.06, 1],
          [thick + 0.2, -length * 0.93 + i * length * 0.06, 5],
          [thick + 0.2, -length * 0.96 + i * length * 0.06, 5],
        ],
        "mem-contact",
      ),
    ).join("")}</g>`;
}
function ssdDrawing({ x, y, width }) {
  const origin = { x, y: y + 10 },
    u = (width * 0.34) / COS,
    v = (width * 0.16) / COS;
  return `<g class="mem-ssd">${face(
    { x: x + 5, y: y + 15 },
    [
      [-u, -v, 0],
      [u, -v, 0],
      [u, v, 0],
      [-u, v, 0],
    ],
    "mem-device-shadow",
  )}
    ${box(origin, -u, u, -v, v, 0, 10)}${face(
      origin,
      [
        [-u * 0.72, -v * 0.68, 10.3],
        [u * 0.72, -v * 0.68, 10.3],
        [u * 0.72, v * 0.68, 10.3],
        [-u * 0.72, v * 0.68, 10.3],
      ],
      "mem-ssd-label",
    )}
    ${engraving(origin, "SSD", 11, Math.max(17, width * 0.13))}
    ${[-1, 1]
      .flatMap((a) =>
        [-1, 1].map((b) => {
          const p = point(origin, u * a * 0.85, v * b * 0.8, 10.5);
          return `<ellipse class="mem-bolt" cx="${p[0]}" cy="${p[1]}" rx="2.5" ry="1.5"/>`;
        }),
      )
      .join("")}
    ${face(
      origin,
      [
        [u, -v * 0.6, 2],
        [u, v * 0.6, 2],
        [u, v * 0.6, 7],
        [u, -v * 0.6, 7],
      ],
      "mem-port",
    )}
    ${Array.from({ length: 6 }, (_, i) => {
      const a = point(origin, u + 0.2, -v * 0.5 + i * v * 0.2, 2.5),
        b = point(origin, u + 0.2, -v * 0.5 + i * v * 0.2, 6.5);
      return `<path class="mem-connector" d="M${a.join(" ")}L${b.join(" ")}"/>`;
    }).join("")}</g>`;
}

function layoutFor(width) {
  const compact = width < 620;
  const ramWidth = compact
    ? Math.min(166, width * 0.475)
    : Math.min(184, width * 0.275);
  const ramX = compact ? width - ramWidth - 20 : (width - ramWidth) / 2;
  const cpuX = compact ? 75 : Math.max(92, width * 0.15);
  const ssdX = compact ? 82 : width - Math.max(92, width * 0.15);
  return {
    width,
    compact,
    height: compact ? 664 : 520,
    cpu: {
      x: cpuX,
      y: 166,
      width: compact
        ? Math.min(126, width * 0.36)
        : Math.min(182, width * 0.27),
    },
    ram: {
      x: ramX + 4,
      y: compact ? 114 : 91,
      width: ramWidth - (compact ? 26 : 14),
      height: compact ? 108 : 126,
    },
    ssd: {
      x: ssdX,
      y: compact ? 408 : 158,
      width: compact ? 136 : Math.min(174, width * 0.26),
    },
    ramX,
    ramWidth,
    frameY: compact ? 232 : 222,
    frameGap: 68,
    frameHeight: 56,
    request: { x: cpuX - 56, y: compact ? 222 : 238, width: 112, height: 62 },
    disk: { x: ssdX - 57, y: compact ? 479 : 245, gap: 42 },
    lookup: { x: ramX + ramWidth / 2, y: compact ? 218 : 207 },
    accessY: compact ? 300 : 389,
    order: { x: 18, y: compact ? 586 : 450, width: width - 36 },
    titleY: compact ? 85 : 79,
  };
}
const framePosition = (layout, slot) => ({
  x: layout.ramX + layout.ramWidth / 2,
  y: layout.frameY + slot * layout.frameGap + layout.frameHeight / 2,
});
const diskPosition = (layout, page) => {
  const index = PAGES.indexOf(page);
  return {
    x: layout.disk.x + (index % 3) * layout.disk.gap + 15,
    y: layout.disk.y + Math.floor(index / 3) * 41 + 15,
  };
};
const cloneFrames = (frames) => frames.map((frame) => ({ ...frame }));
let serial = 0;

export function createMemoryScene(host, { onPhase = () => {} } = {}) {
  const id = ++serial,
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  host.classList.add("memory-scene");
  host.setAttribute("role", "group");
  host.innerHTML = `<svg class="mem-map" aria-hidden="true"></svg><div class="mem-frame-layer"></div>
    <div class="mem-request" aria-hidden="true"><span>CPU 요청</span><strong>—</strong><small>시작 전</small></div>
    <div class="mem-status" aria-live="off"><b>준비</b><strong>세 개의 RAM 프레임을 관찰하세요</strong></div>
    <div class="mem-order" aria-hidden="true"></div><div class="mem-transfer" hidden aria-hidden="true"></div>`;
  const svg = host.querySelector(".mem-map"),
    frameLayer = host.querySelector(".mem-frame-layer"),
    request = host.querySelector(".mem-request"),
    status = host.querySelector(".mem-status"),
    order = host.querySelector(".mem-order"),
    transfer = host.querySelector(".mem-transfer");
  const cards = Array.from({ length: 3 }, (_, slot) => {
    const element = document.createElement("div");
    element.className = "mem-frame";
    element.dataset.frame = slot;
    element.setAttribute("role", "group");
    element.innerHTML = `<span class="mem-frame-id">F${slot}</span><div class="mem-frame-content"><strong class="mem-page-letter">—</strong><span><b>빈 프레임</b><small>페이지가 없습니다</small></span></div>`;
    frameLayer.append(element);
    return element;
  });
  let layout,
    step = null,
    algorithm = "fifo",
    frames = Array.from({ length: 3 }, (_, slot) => ({
      slot,
      page: null,
      loadedAt: null,
      lastUsedAt: null,
    })),
    pageOrder = [],
    run = null,
    revision = 0,
    destroyed = false;
  function path(kind, slot = 0, page = step?.page) {
    const cpu = { x: layout.request.x + 56, y: layout.request.y + 31 },
      ram = framePosition(layout, slot),
      disk = diskPosition(layout, page || "A");
    const leftGap = (layout.request.x + 112 + layout.ramX) / 2;
    if (kind === "lookup" || kind === "retry")
      return `M${cpu.x} ${cpu.y}H${leftGap}V${layout.lookup.y}H${layout.lookup.x}`;
    if (kind === "load") {
      const corridor = layout.compact
        ? layout.width - 16
        : (layout.ramX + layout.ramWidth + layout.disk.x) / 2;
      return `M${disk.x} ${disk.y}H${corridor}V${ram.y}H${ram.x}`;
    }
    return `M${ram.x} ${ram.y}H${leftGap}V${layout.accessY}H${cpu.x}V${cpu.y}`;
  }
  function paintFrames() {
    frames.forEach((frame) => {
      const card = cards[frame.slot];
      card.dataset.page = frame.page || "";
      card.style.setProperty(
        "--page-color",
        frame.page ? COLOR[frame.page] : "var(--muted)",
      );
      card.querySelector(".mem-page-letter").textContent = frame.page || "—";
      card.querySelector(".mem-frame-content b").textContent = frame.page
        ? `페이지 ${frame.page}`
        : "빈 프레임";
      card.querySelector(".mem-frame-content small").textContent = frame.page
        ? `적재 ${frame.loadedAt} · ${frame.lastUsedAt === null ? "접근 전" : `사용 ${frame.lastUsedAt}`}`
        : "페이지가 없습니다";
      card.setAttribute(
        "aria-label",
        `프레임 F${frame.slot}: ${frame.page ? `페이지 ${frame.page}, ${frame.loadedAt}번째 적재, ${frame.lastUsedAt === null ? "접근 전" : `${frame.lastUsedAt}번째 사용`}` : "비어 있음"}`,
      );
    });
    order.innerHTML = `<span>${algorithm === "fifo" ? "먼저 들어온 순서" : "오래 사용하지 않은 순서"}</span><div>${pageOrder.length ? pageOrder.map((page, index) => `<b style="--page-color:${COLOR[page]}">${page}</b>${index < pageOrder.length - 1 ? "<i>→</i>" : ""}`).join("") : "<small>아직 적재된 페이지가 없습니다</small>"}</div><small>${pageOrder.length ? "왼쪽 페이지가 다음 교체 후보입니다" : "RAM은 빈 프레임부터 사용합니다"}</small>`;
    host.setAttribute(
      "aria-label",
      `${step?.index || 0}번째 접근. ${frames.map((f) => `프레임 F${f.slot} ${f.page || "비어 있음"}`).join(", ")}.`,
    );
  }
  function paintRequest(completed = false) {
    const page = step?.page;
    request.style.setProperty(
      "--page-color",
      page ? COLOR[page] : "var(--muted)",
    );
    request.querySelector("strong").textContent = page || "—";
    request.querySelector("small").textContent = page
      ? completed
        ? "접근 완료"
        : "조회 중"
      : "시작 전";
    svg
      .querySelectorAll("[data-disk-page]")
      .forEach(
        (e) => (e.dataset.current = String(e.dataset.diskPage === page)),
      );
  }
  function phase(kind, title, body) {
    status.querySelector("b").textContent = {
      ready: "준비",
      lookup: "조회",
      hit: "적중",
      miss: "부재",
      select: "선택",
      evict: "제거",
      load: "읽기",
      retry: "재시도",
      access: "완료",
    }[kind];
    status.querySelector("strong").textContent = title;
    status.dataset.phase = kind;
    onPhase({ kind, title, body });
  }
  function finalPhase() {
    if (!step?.index)
      phase(
        "ready",
        "세 개의 RAM 프레임을 관찰하세요",
        "CPU가 요청하는 페이지가 RAM에 있는지 확인합니다.",
      );
    else
      phase(
        "access",
        `${step.page} 접근 완료 · ${step.hit ? "RAM 적중" : "페이지 부재 처리"}`,
        step.hit
          ? "RAM에 있던 페이지를 그대로 사용했습니다."
          : "SSD에서 페이지를 읽어 RAM에 적재한 뒤 접근을 완료했습니다.",
      );
  }
  function draw() {
    layout = layoutFor(Math.max(280, Math.round(host.clientWidth)));
    host.style.height = `${layout.height}px`;
    host.dataset.compact = String(layout.compact);
    svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    const title = (x, y, text, sub) =>
      `<text class="mem-device-title" x="${x}" y="${y}" text-anchor="middle">${text}</text><text class="mem-device-sub" x="${x}" y="${y + 18}" text-anchor="middle">${sub}</text>`;
    const ramCenter = layout.ramX + layout.ramWidth / 2,
      leftGap = (layout.request.x + 112 + layout.ramX) / 2;
    svg.innerHTML = `<defs><marker id="mem-arrow-${id}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z"/></marker></defs>
      <g class="mem-lanes">${["lookup", "load", "access"].map((kind) => `<path data-lane="${kind}" d="${path(kind)}" marker-end="url(#mem-arrow-${id})"/>`).join("")}<path class="mem-active-flow"/></g>
      ${title(layout.cpu.x, layout.titleY, "CPU", "페이지를 요청합니다")}${cpuDrawing(layout.cpu)}
      ${title(ramCenter, layout.titleY, "RAM", "고정된 프레임 3개")}${ramDrawing(layout.ram)}
      ${title(layout.ssd.x, layout.compact ? 344 : layout.titleY, "SSD", "페이지 원본을 보관합니다")}${ssdDrawing(layout.ssd)}
      <path class="mem-device-dock" d="M${layout.cpu.x} ${layout.compact ? 196 : 209}V${layout.request.y}M${ramCenter} ${layout.compact ? 214 : 204}V${layout.frameY}"/>
      <g class="mem-disk-pages">${PAGES.map((page) => {
        const p = diskPosition(layout, page);
        return `<g data-disk-page="${page}" style="--page-color:${COLOR[page]}"><rect x="${p.x - 15}" y="${p.y - 15}" width="30" height="30" rx="2"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle">${page}</text></g>`;
      }).join("")}</g>
      <g class="mem-lane-labels"><text x="${leftGap}" y="${layout.compact ? 212 : 228}" text-anchor="middle">${layout.compact ? "조회" : "페이지 조회"}</text><text x="${layout.cpu.x}" y="${layout.compact ? 320 : 414}" text-anchor="middle">접근 완료</text><text x="${layout.compact ? layout.width / 2 + 20 : (layout.ramX + layout.ramWidth + layout.disk.x) / 2}" y="${layout.compact ? 564 : 226}" text-anchor="middle">페이지 읽기</text></g>
      <path class="mem-measure"/>`;
    cards.forEach((card, slot) =>
      Object.assign(card.style, {
        left: `${layout.ramX}px`,
        top: `${layout.frameY + slot * layout.frameGap}px`,
        width: `${layout.ramWidth}px`,
        height: `${layout.frameHeight}px`,
      }),
    );
    Object.assign(request.style, {
      left: `${layout.request.x}px`,
      top: `${layout.request.y}px`,
      width: "112px",
      height: "62px",
    });
    Object.assign(order.style, {
      left: `${layout.order.x}px`,
      top: `${layout.order.y}px`,
      width: `${layout.order.width}px`,
    });
    paintFrames();
    paintRequest(!!step?.index);
  }
  function clearEmphasis() {
    cards.forEach((card) => {
      delete card.dataset.selected;
      delete card.dataset.hit;
      delete card.dataset.receiving;
    });
    svg
      .querySelectorAll("[data-active]")
      .forEach((e) => delete e.dataset.active);
    svg.querySelector(".mem-active-flow").style.opacity = 0;
    transfer.hidden = true;
  }
  function cancel() {
    if (run) {
      run.cancelled = true;
      run.animations.forEach((animation) => animation.cancel());
      run = null;
    }
    clearEmphasis();
  }
  function track(animation, active) {
    active.animations.add(animation);
    if (active.paused) animation.pause();
    return animation.finished
      .catch(() => {})
      .then(() => active.animations.delete(animation));
  }
  const alive = (active) =>
    !destroyed && !active.cancelled && active.revision === revision;
  const hold = (milliseconds, active) =>
    track(
      status.animate([{ opacity: 1 }, { opacity: 1 }], {
        duration: milliseconds,
      }),
      active,
    );
  async function travel(kind, page, slot, active, pace) {
    const data = path(kind, slot, page),
      measure = svg.querySelector(".mem-measure"),
      flow = svg.querySelector(".mem-active-flow");
    measure.setAttribute("d", data);
    flow.setAttribute("d", data);
    flow.style.setProperty("--page-color", COLOR[page]);
    flow.style.opacity = 1;
    const lane = svg.querySelector(
      `[data-lane="${kind === "retry" ? "lookup" : kind}"]`,
    );
    lane.dataset.active = "true";
    lane.style.setProperty("--page-color", COLOR[page]);
    lane.setAttribute("d", data);
    const length = measure.getTotalLength(),
      duration = (440 + length * 0.6) * pace;
    transfer.textContent = kind === "access" ? "✓" : page;
    transfer.hidden = false;
    transfer.style.setProperty("--page-color", COLOR[page]);
    transfer.dataset.kind = kind;
    const keys = Array.from({ length: 33 }, (_, index) => {
      const p = measure.getPointAtLength((length * index) / 32);
      return {
        transform: `translate(${p.x - 17}px,${p.y - 17}px)`,
        offset: index / 32,
      };
    });
    await Promise.all([
      track(transfer.animate(keys, { duration, easing: "linear" }), active),
      track(
        flow.animate([{ strokeDashoffset: 16 }, { strokeDashoffset: 0 }], {
          duration,
          easing: "linear",
        }),
        active,
      ),
    ]);
    if (alive(active)) {
      transfer.hidden = true;
      flow.style.opacity = 0;
      delete lane.dataset.active;
    }
  }
  async function animateStep(active, pace) {
    const page = step.page,
      slot = step.frameIndex;
    phase(
      "lookup",
      `CPU가 페이지 ${page}를 요청합니다`,
      "먼저 RAM의 세 프레임에 이 페이지가 있는지 확인합니다.",
    );
    await travel("lookup", page, slot, active, pace);
    if (!alive(active)) return;
    for (const event of step.events) {
      if (!alive(active)) return;
      if (event.type === "hit") {
        cards[slot].dataset.hit = "true";
        phase(
          "hit",
          `적중 · ${page}가 F${slot}에 있습니다`,
          "RAM의 페이지를 그대로 사용합니다. SSD에서 새로 가져오지 않습니다.",
        );
        await hold(350 * pace, active);
      } else if (event.type === "miss") {
        phase(
          "miss",
          `페이지 부재 · ${page}가 RAM에 없습니다`,
          "페이지를 SSD에서 읽어올 프레임이 필요합니다.",
        );
        await hold(330 * pace, active);
      } else if (event.type === "select") {
        cards[slot].dataset.selected = "true";
        const reason =
          event.reason === "empty"
            ? "빈 프레임을 사용합니다"
            : event.reason === "fifo"
              ? `${event.victim}가 가장 먼저 들어왔습니다`
              : `${event.victim}를 가장 오래 사용하지 않았습니다`;
        phase(
          "select",
          event.reason === "empty"
            ? `빈 프레임 F${slot} 선택`
            : `교체할 페이지 ${event.victim} 선택`,
          reason,
        );
        await hold(530 * pace, active);
      } else if (event.type === "evict") {
        phase(
          "evict",
          `F${slot}의 ${event.page} 복사본만 제거합니다`,
          "수정되지 않은 페이지이므로 SSD에 다시 쓰지 않습니다. 디스크의 원본은 그대로 남습니다.",
        );
        await track(
          cards[slot].querySelector(".mem-frame-content").animate(
            [
              { opacity: 1, transform: "translateY(0)" },
              { opacity: 0, transform: "translateY(-7px)" },
            ],
            { duration: 340 * pace },
          ),
          active,
        );
        if (!alive(active)) return;
        frames[slot] = { slot, page: null, loadedAt: null, lastUsedAt: null };
        pageOrder = pageOrder.filter((p) => p !== event.page);
        paintFrames();
        await hold(110 * pace, active);
      } else if (event.type === "load") {
        phase(
          "load",
          `SSD에서 ${page}를 읽어 F${slot}에 적재합니다`,
          "화살표는 SSD에서 RAM으로 페이지를 읽어오는 방향입니다. 디스크 원본은 유지됩니다.",
        );
        cards[slot].dataset.receiving = "true";
        cards[slot].style.setProperty("--page-color", COLOR[page]);
        await travel("load", page, slot, active, pace);
        if (!alive(active)) return;
        frames[slot] = { ...step.frames[slot], lastUsedAt: null };
        pageOrder = [...step.order];
        paintFrames();
        delete cards[slot].dataset.receiving;
        await hold(160 * pace, active);
      } else if (event.type === "access") {
        if (step.fault) {
          phase(
            "retry",
            `CPU가 ${page} 접근을 다시 시도합니다`,
            "필요한 페이지가 이제 RAM에 있으므로 CPU의 요청을 다시 처리합니다.",
          );
          await travel("retry", page, slot, active, pace);
          if (!alive(active)) return;
        }
        phase(
          "access",
          `${page} 접근 완료 · RAM의 페이지를 사용합니다`,
          "페이지는 RAM에 남아 다음 요청에서도 사용할 수 있습니다.",
        );
        await travel("access", page, slot, active, pace);
        if (!alive(active)) return;
        frames = cloneFrames(step.frames);
        pageOrder = [...step.order];
        paintFrames();
        paintRequest(true);
      }
    }
    if (!alive(active)) return;
    run = null;
    clearEmphasis();
    finalPhase();
  }
  function update(
    next,
    previous = null,
    { animate = true, duration = 1000, algorithm: nextAlgorithm = "fifo" } = {},
  ) {
    if (destroyed) return Promise.resolve();
    revision++;
    cancel();
    step = next;
    algorithm = nextAlgorithm;
    const moving =
      animate &&
      !reduced.matches &&
      previous &&
      next.index === previous.index + 1 &&
      next.events.length;
    frames = cloneFrames(moving ? next.before : next.frames);
    pageOrder = [...(moving ? next.beforeOrder : next.order)];
    paintFrames();
    paintRequest(!moving);
    if (!moving) {
      finalPhase();
      return Promise.resolve();
    }
    const active = {
      revision,
      animations: new Set(),
      paused: false,
      cancelled: false,
    };
    run = active;
    return animateStep(active, duration / 1000);
  }
  draw();
  const observer = new ResizeObserver((entries) => {
    if (Math.abs(entries[0].contentRect.width - layout.width) <= 1) return;
    revision++;
    cancel();
    if (step) {
      frames = cloneFrames(step.frames);
      pageOrder = [...step.order];
    }
    draw();
    finalPhase();
  });
  observer.observe(host);
  return {
    update,
    pause() {
      if (run) {
        run.paused = true;
        run.animations.forEach((animation) => animation.pause());
      }
    },
    resume() {
      if (run) {
        run.paused = false;
        run.animations.forEach((animation) => animation.play());
      }
    },
    destroy() {
      destroyed = true;
      revision++;
      cancel();
      observer.disconnect();
      host.replaceChildren();
    },
  };
}
