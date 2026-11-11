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

function housingDrawing({ x, y, width, height, depth = 16 }, kind) {
  const rise = depth / Math.sqrt(3),
    bottom = y + height;
  return `<g class="mem-housing mem-housing-${kind}">
    <path class="mem-device-shadow" d="M${x + 5} ${bottom + 5}H${x + width + depth + 5}L${x + width + 5} ${bottom + rise + 11}H${x + 5}Z"/>
    <path class="mem-housing-top" d="M${x} ${y}L${x + depth} ${y - rise}H${x + width + depth}L${x + width} ${y}Z"/>
    <path class="mem-housing-side" d="M${x + width} ${y}L${x + width + depth} ${y - rise}V${bottom - rise}L${x + width} ${bottom}Z"/>
    <rect class="mem-housing-front" x="${x}" y="${y}" width="${width}" height="${height}" rx="2"/>
    <path class="mem-housing-rail" d="M${x + 5} ${y + 5}V${bottom - 5}H${x + width - 5}V${y + 5}"/>
    ${[
      [x + 5, y + 6],
      [x + width - 5, y + 6],
      [x + 5, bottom - 6],
      [x + width - 5, bottom - 6],
    ]
      .map(([a, b]) => `<circle class="mem-bolt" cx="${a}" cy="${b}" r="1.5"/>`)
      .join("")}
  </g>`;
}

function layoutFor(width) {
  const compact = width < 620;
  const ramWidth = compact
    ? Math.min(158, width * 0.46)
    : Math.min(184, width * 0.275);
  const ramX = compact ? width - ramWidth - 26 : (width - ramWidth) / 2;
  const requestWidth = compact ? Math.min(112, ramX - 37) : 112;
  const cpuX = compact ? 13 + requestWidth / 2 : Math.max(92, width * 0.15);
  const ssdX = compact ? 74 : width - Math.max(92, width * 0.15);
  const request = {
    x: cpuX - requestWidth / 2,
    y: 220,
    width: requestWidth,
    height: 62,
  };
  const ramHousing = {
    x: ramX - 8,
    y: compact ? 192 : 183,
    width: ramWidth + 16,
    height: compact ? 242 : 243,
    depth: compact ? 10 : 16,
  };
  const cpuHousing = {
    x: request.x - 8,
    y: 204,
    width: requestWidth + 16,
    height: 92,
    depth: compact ? 10 : 16,
  };
  const ssdHousing = {
    x: ssdX - 62,
    y: compact ? 435 : 207,
    width: 124,
    height: 106,
    depth: compact ? 10 : 16,
  };
  return {
    width,
    compact,
    height: compact ? 664 : 520,
    cpu: {
      x: cpuX,
      y: 155,
      width: compact
        ? Math.min(120, width * 0.35)
        : Math.min(178, width * 0.265),
    },
    ram: {
      x: ramX + 14,
      y: compact ? 85 : 73,
      width: compact
        ? Math.min(122, ramWidth - 30)
        : Math.min(144, ramWidth - 34),
      height: compact ? 105 : 111,
    },
    ssd: {
      x: ssdX,
      y: compact ? 400 : 165,
      width: compact ? 132 : Math.min(166, width * 0.25),
    },
    ramX,
    ramWidth,
    ramHousing,
    cpuHousing,
    ssdHousing,
    frameY: compact ? 230 : 221,
    frameGap: 68,
    frameHeight: 56,
    request,
    disk: { x: ssdX - 50, y: compact ? 457 : 229, gap: 36 },
    lookup: { x: ramHousing.x - 2, y: ramHousing.y + 20 },
    accessY: compact ? 306 : 355,
    table: { x: 18, y: compact ? 586 : 450, width: width - 36 },
    titleY: 79,
  };
}
const framePosition = (layout, slot) => ({
  x: layout.ramX + 24,
  y: layout.frameY + slot * layout.frameGap + layout.frameHeight / 2,
});
const diskPosition = (layout, page) => {
  const index = PAGES.indexOf(page);
  return {
    x: layout.disk.x + (index % 3) * layout.disk.gap + 14,
    y: layout.disk.y + Math.floor(index / 3) * 37 + 14,
  };
};
const cloneFrames = (frames) => frames.map((frame) => ({ ...frame }));
const replacementReason = (policy, frame) => policy === "fifo"
  ? `가장 먼저 적재된 ${frame.page} 교체 (적재 ${frame.loadedAt}번째)`
  : `마지막 사용이 가장 이른 ${frame.page} 교체 (사용 ${frame.lastUsedAt}번째)`;
let serial = 0;

export function createMemoryScene(host, { onPhase = () => {} } = {}) {
  const id = ++serial,
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  host.classList.add("memory-scene");
  host.setAttribute("role", "group");
  host.tabIndex = -1;
  host.innerHTML = `<svg class="mem-map" aria-hidden="true"></svg><div class="mem-frame-layer"></div>
    <div class="mem-request" aria-hidden="true"><span>CPU 요청</span><strong>—</strong><small>시작 전</small></div>
    <div class="mem-status" aria-live="off"><b>준비</b><strong>세 개의 RAM 프레임을 관찰하세요</strong></div>
    <div class="mem-page-table" role="group" aria-label="페이지 테이블"></div><div class="mem-transfer" hidden aria-hidden="true"></div>`;
  const svg = host.querySelector(".mem-map"),
    frameLayer = host.querySelector(".mem-frame-layer"),
    request = host.querySelector(".mem-request"),
    status = host.querySelector(".mem-status"),
    pageTable = host.querySelector(".mem-page-table"),
    transfer = host.querySelector(".mem-transfer");
  const cards = Array.from({ length: 3 }, (_, slot) => {
    const element = document.createElement("div");
    element.className = "mem-frame";
    element.dataset.frame = slot;
    element.setAttribute("role", "group");
    element.innerHTML = `<span class="mem-frame-id">F${slot}</span><div class="mem-frame-content"><strong class="mem-page-letter">—</strong><span><b>빈 프레임</b><small></small></span></div>`;
    frameLayer.append(element);
    return element;
  });
  let layout,
    step = null,
    frames = Array.from({ length: 3 }, (_, slot) => ({
      slot,
      page: null,
      loadedAt: null,
      lastUsedAt: null,
    })),
    run = null,
    revision = 0,
    destroyed = false;
  function path(kind, slot = 0, page = step?.page) {
    const cpu = { x: layout.request.x + 24, y: layout.request.y + 31 },
      ram = framePosition(layout, slot),
      disk = diskPosition(layout, page || "A");
    const leftGap =
      (layout.cpuHousing.x + layout.cpuHousing.width + layout.ramHousing.x) / 2;
    if (kind === "lookup")
      return `M${cpu.x} ${cpu.y}H${leftGap}V${layout.lookup.y}H${layout.lookup.x}`;
    if (kind === "retry")
      return `M${cpu.x} ${cpu.y}H${leftGap}V${layout.lookup.y}H${layout.lookup.x}V${ram.y}H${ram.x}`;
    if (kind === "load") {
      if (layout.compact) {
        // Leave each tray row vertically before moving past the other pages.
        const upperRow = disk.y < layout.disk.y + layout.disk.gap;
        const exitY = upperRow ? disk.y - 37 : disk.y + 37;
        const traySide = layout.ssdHousing.x + layout.ssdHousing.width + 22;
        return `M${disk.x} ${disk.y}V${exitY}H${traySide}V552H${layout.width - 18}V${ram.y}H${ram.x}`;
      }
      const corridor =
        (layout.ramHousing.x +
          layout.ramHousing.width +
          layout.ramHousing.depth +
          layout.ssdHousing.x) /
        2;
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
      card.querySelector(".mem-frame-content small").innerHTML = frame.page
        ? `<span class="mem-loaded">적재 ${frame.loadedAt}</span> · <span class="mem-used">${frame.lastUsedAt === null ? "접근 전" : `사용 ${frame.lastUsedAt}`}</span>`
        : "";
      card.setAttribute(
        "aria-label",
        `프레임 F${frame.slot}: ${frame.page ? `페이지 ${frame.page}, ${frame.loadedAt}번째 적재, ${frame.lastUsedAt === null ? "접근 전" : `${frame.lastUsedAt}번째 사용`}` : "비어 있음"}`,
      );
    });
    const entries = PAGES.map((page) => {
      const frame = frames.find((f) => f.page === page);
      return `<span class="mem-entry" data-requested="${step?.page === page}" aria-label="${page} · ${frame ? "프레임 " + frame.slot : "미상주"}"><b style="--page-color:${COLOR[page]}">${page}</b><small>${frame ? "F" + frame.slot : "—"}</small></span>`;
    });
    pageTable.innerHTML = `<span>페이지 테이블 <small>— 미상주</small></span><div>${entries.join("")}</div>`;
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
      .forEach((e) => (e.dataset.current = "false"));
  }
  function phase(kind, title, body) {
    request.querySelector("small").textContent = {
      ready: "시작 전",
      lookup: "상주 확인",
      hit: "RAM 적중",
      miss: "부재 대기",
      select: "부재 대기",
      evict: "부재 대기",
      load: "부재 대기",
      retry: "접근 재시도",
      read: "응답 대기",
      access: "접근 완료",
    }[kind];
    status.querySelector("b").textContent = {
      ready: "준비",
      lookup: "조회",
      hit: "적중",
      miss: "부재",
      select: "선택",
      evict: "제거",
      load: "읽기",
      retry: "재시도",
      read: "읽기",
      access: "완료",
    }[kind];
    status.querySelector("strong").textContent = title;
    status.dataset.phase = kind;
    host.dataset.phase = kind;
    onPhase({ kind, title, body });
  }
  function finalPhase() {
    if (!step?.index)
      phase(
        "ready",
        "세 개의 RAM 프레임을 관찰하세요",
        "페이지 테이블은 각 페이지의 상주 여부와 RAM 프레임 번호를 기록합니다.",
      );
    else {
      let outcome = step.hit ? "RAM 적중" : "페이지 부재 처리";
      if (step.victim) {
        const { reason } = step.events.find((event) => event.type === "select");
        outcome = replacementReason(reason, step.before[step.frameIndex]);
      }
      phase(
        "access",
        `${step.page} 접근 완료 · ${outcome}`,
        step.hit
          ? "RAM에 있던 페이지를 그대로 사용했습니다."
          : "SSD에서 페이지를 읽어 RAM에 적재한 뒤 접근을 완료했습니다.",
      );
    }
  }
  function draw() {
    layout = layoutFor(Math.max(280, Math.round(host.clientWidth)));
    host.style.height = `${layout.height}px`;
    host.dataset.compact = String(layout.compact);
    svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    const title = (x, y, text, sub) =>
      `<text class="mem-device-title" x="${x}" y="${y}" text-anchor="middle">${text}</text><text class="mem-device-sub" x="${x}" y="${y + 18}" text-anchor="middle">${sub}</text>`;
    const ramCenter = layout.ramX + layout.ramWidth / 2,
      leftGap =
        (layout.cpuHousing.x + layout.cpuHousing.width + layout.ramHousing.x) /
        2;
    const ports = Array.from({ length: 3 }, (_, slot) => {
      const p = framePosition(layout, slot);
      return `<path class="mem-bay-rail" d="M${layout.ramX - 3} ${p.y + 29}H${layout.ramX + layout.ramWidth + 3}"/><rect class="mem-physical-port" x="${layout.ramX - 11}" y="${p.y - 5}" width="5" height="10"/><rect class="mem-physical-port" x="${layout.ramX + layout.ramWidth + 6}" y="${p.y - 5}" width="5" height="10"/>`;
    }).join("");
    svg.innerHTML = `<defs><marker id="mem-arrow-${id}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z"/></marker></defs>
      <g class="mem-lanes">${["lookup", "load", "access"].map((kind) => `<path data-lane="${kind}" d="${path(kind)}" marker-end="url(#mem-arrow-${id})"/>`).join("")}<path class="mem-active-flow"/></g>
      <g class="mem-station" data-device="cpu">${title(layout.cpu.x, layout.titleY, "CPU", "페이지 요청")}
        ${housingDrawing(layout.cpuHousing, "cpu")}${cpuDrawing(layout.cpu)}
        <rect class="mem-request-socket" x="${layout.request.x - 3}" y="${layout.request.y - 3}" width="${layout.request.width + 6}" height="68" rx="2"/>
        <rect class="mem-physical-port" x="${layout.cpuHousing.x + layout.cpuHousing.width - 2}" y="246" width="6" height="10"/>
      </g>
      <g class="mem-station" data-device="ram">${housingDrawing(layout.ramHousing, "ram")}${ramDrawing(layout.ram)}
        <rect class="mem-controller" x="${layout.ramX}" y="${layout.ramHousing.y + 8}" width="${layout.ramWidth}" height="23"/>
        <text class="mem-controller-label" x="${ramCenter}" y="${layout.ramHousing.y + 24}" text-anchor="middle">RAM · 페이지 테이블</text>
        <rect class="mem-controller-port" x="${layout.lookup.x - 2}" y="${layout.lookup.y - 6}" width="6" height="12"/>
        ${ports}
      </g>
      <g class="mem-station" data-device="ssd">${title(layout.ssd.x, layout.compact ? 336 : layout.titleY, "SSD", "원본 페이지 보관")}
        ${housingDrawing(layout.ssdHousing, "ssd")}${ssdDrawing(layout.ssd)}
        <g class="mem-disk-pages">${PAGES.map((page) => {
          const p = diskPosition(layout, page);
          return `<g data-disk-page="${page}" style="--page-color:${COLOR[page]}"><path class="mem-tray-slot" d="M${p.x - 16} ${p.y + 17}H${p.x + 16}l3 -3"/><rect x="${p.x - 14}" y="${p.y - 14}" width="28" height="28" rx="1"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle">${page}</text></g>`;
        }).join("")}</g>
        <rect class="mem-physical-port" x="${layout.compact ? layout.ssdHousing.x + layout.ssdHousing.width - 2 : layout.ssdHousing.x - 4}" y="${layout.ssdHousing.y + 56}" width="6" height="10"/>
      </g>
      <g class="mem-lane-labels">
        <text x="${layout.compact ? layout.ramHousing.x - 6 : leftGap}" y="${layout.compact ? 195 : 224}" text-anchor="${layout.compact ? "end" : "middle"}">${layout.compact ? "조회" : "조회 요청"}</text>
        <text x="${layout.cpu.x}" y="${layout.compact ? 313 : 377}" text-anchor="middle">값 반환</text>
        <text x="${layout.compact ? layout.width / 2 + 20 : layout.ssd.x}" y="${layout.compact ? 574 : 341}" text-anchor="middle">페이지 읽기</text>
      </g>`;
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
      width: `${layout.request.width}px`,
      height: "62px",
    });
    Object.assign(pageTable.style, {
      left: `${layout.table.x}px`,
      top: `${layout.table.y}px`,
      width: `${layout.table.width}px`,
    });
    run?.updateRoute?.();
  }
  function clearEmphasis() {
    delete host.dataset.criterion;
    cards.forEach((card) => {
      delete card.dataset.selected;
      delete card.dataset.hit;
      delete card.dataset.receiving;
    });
    svg
      .querySelectorAll("[data-active]")
      .forEach((e) => delete e.dataset.active);
    svg
      .querySelectorAll("[data-lane]")
      .forEach((lane) => lane.setAttribute("d", path(lane.dataset.lane)));
    svg.querySelector(".mem-active-flow").style.opacity = 0;
    svg
      .querySelectorAll("[data-disk-page]")
      .forEach((source) => (source.dataset.current = "false"));
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
    animation.playbackRate = active.speed;
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
  async function travel(kind, page, slot, active) {
    const laneKind = kind === "retry" ? "lookup" : kind;
    const flow = svg.querySelector(".mem-active-flow");
    active.updateRoute = () => {
      const data = path(kind, slot, page);
      const lane = svg.querySelector(`[data-lane="${laneKind}"]`);
      lane.dataset.active = "true";
      lane.style.setProperty("--page-color", COLOR[page]);
      lane.setAttribute("d", data);
      const placeholder = svg.querySelector(".mem-active-flow");
      if (placeholder !== flow) placeholder.replaceWith(flow);
      flow.setAttribute("d", data);
      flow.style.setProperty("--page-color", COLOR[page]);
      flow.style.opacity = 1;
      transfer.style.offsetPath = `path("${data}")`;
      if (kind === "load") svg.querySelector(`[data-disk-page="${page}"]`).dataset.current = "true";
    };
    active.updateRoute();
    const duration = 440 + flow.getTotalLength() * 0.6;
    transfer.textContent =
      kind === "access" ? "값" : kind === "load" ? page : `${page}?`;
    transfer.hidden = false;
    transfer.style.setProperty("--page-color", COLOR[page]);
    transfer.dataset.kind = kind;
    if (matchMedia("(max-width: 759px)").matches) {
      const bounds = flow.getBoundingClientRect();
      const pad = transfer.offsetHeight / 2 + 4;
      const bottom = innerHeight - host.parentElement.querySelector(".playback-buttons").offsetHeight;
      const distance = bounds.top < pad ? bounds.top - pad : Math.max(0, bounds.bottom + pad - bottom);
      if (distance) window.scrollBy({ top: distance, behavior: "instant" });
    }
    await Promise.all([
      track(transfer.animate([{ offsetDistance: "0%" }, { offsetDistance: "100%" }], { duration, easing: "linear" }), active),
      track(
        flow.animate([{ strokeDashoffset: 16 }, { strokeDashoffset: 0 }], {
          duration,
          easing: "linear",
        }),
        active,
      ),
    ]);
    if (alive(active)) {
      active.updateRoute = null;
      transfer.hidden = true;
      if (kind === "load") svg.querySelector(`[data-disk-page="${page}"]`).dataset.current = "false";
      flow.style.opacity = 0;
      const lane = svg.querySelector(`[data-lane="${laneKind}"]`);
      delete lane.dataset.active;
      lane.setAttribute("d", path(lane.dataset.lane));
    }
  }
  async function animateStep(active) {
    const page = step.page,
      slot = step.frameIndex;
    phase(
      "lookup",
      `페이지 테이블에서 ${page} 항목을 조회합니다`,
      "CPU의 주소 변환 장치가 요청한 페이지의 항목을 읽습니다. 상주 중이면 이 항목에서 RAM 프레임 번호를 얻습니다.",
    );
    await travel("lookup", page, slot, active);
    if (!alive(active)) return;
    for (const event of step.events) {
      if (!alive(active)) return;
      if (event.type === "hit") {
        cards[slot].dataset.hit = "true";
        phase(
          "hit",
          `적중 · ${page}가 F${slot}에 있습니다`,
          `페이지 테이블의 ${page} 항목이 F${slot}을 가리킵니다. 이 프레임을 바로 읽습니다.`,
        );
        await hold(350, active);
      } else if (event.type === "miss") {
        phase(
          "miss",
          `페이지 부재 · ${page}가 RAM에 없습니다`,
          `${page} 항목이 미상주(—)입니다. 운영체제가 페이지 부재를 처리하기 위해 프레임을 확보합니다.`,
        );
        await hold(500, active);
      } else if (event.type === "select") {
        cards[slot].dataset.selected = "true";
        host.dataset.criterion = event.reason;
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
            : `${event.reason.toUpperCase()} · ${replacementReason(event.reason, frames[slot])}`,
          reason,
        );
        await hold(event.victim ? 1500 : 900, active);
        if (!alive(active)) return;
        delete host.dataset.criterion;
      } else if (event.type === "evict") {
        phase(
          "evict",
          `F${slot}의 ${event.page} 복사본만 제거합니다`,
          `${event.page}의 페이지 테이블 항목도 미상주로 바꿉니다. 읽기 전용이므로 SSD에 다시 쓸 필요는 없습니다.`,
        );
        await track(
          cards[slot].querySelector(".mem-frame-content").animate(
            [
              { opacity: 1, transform: "translateY(0)" },
              { opacity: 0, transform: "translateY(-7px)" },
            ],
            { duration: 340 },
          ),
          active,
        );
        if (!alive(active)) return;
        frames[slot] = { slot, page: null, loadedAt: null, lastUsedAt: null };
        paintFrames();
        await hold(110, active);
      } else if (event.type === "load") {
        phase(
          "load",
          `SSD에서 ${page}를 읽어 F${slot}에 적재합니다`,
          `SSD에 있는 원본을 F${slot}으로 복사합니다. 적재를 마치면 페이지 테이블에 ${page} → F${slot}을 기록합니다.`,
        );
        cards[slot].dataset.receiving = "true";
        cards[slot].style.setProperty("--page-color", COLOR[page]);
        await travel("load", page, slot, active);
        if (!alive(active)) return;
        frames[slot] = { ...step.frames[slot], lastUsedAt: null };
        paintFrames();
        delete cards[slot].dataset.receiving;
        delete cards[slot].dataset.selected;
        await track(
          cards[slot]
            .querySelector(".mem-frame-content")
            .animate(
              [
                { transform: "translateY(-5px)" },
                { transform: "translateY(0)" },
              ],
              { duration: 200, easing: "ease-out" },
            ),
          active,
        );
      } else if (event.type === "access") {
        if (step.fault) {
          phase(
            "retry",
            `CPU가 ${page} 접근을 다시 시도합니다`,
            `같은 가상 주소로 재시도하면 갱신된 페이지 테이블이 F${slot}을 가리킵니다.`,
          );
          await travel("retry", page, slot, active);
          if (!alive(active)) return;
        }
        phase(
          "read",
          `F${slot}에서 CPU로 값을 전달합니다`,
          `페이지 ${page}는 F${slot}에 남습니다. 읽은 값이 CPU에 도착하면 이번 접근을 기록합니다.`,
        );
        await travel("access", page, slot, active);
        if (!alive(active)) return;
        frames = cloneFrames(step.frames);
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
    { animate = true, speed = 1, paused = false } = {},
  ) {
    if (destroyed) return Promise.resolve();
    revision++;
    cancel();
    step = next;
    const moving =
      animate &&
      !reduced.matches &&
      previous &&
      next.index === previous.index + 1 &&
      next.events.length;
    frames = cloneFrames(moving ? next.before : next.frames);
    paintFrames();
    paintRequest(!moving);
    if (!moving) {
      finalPhase();
      return Promise.resolve();
    }
    const active = {
      revision,
      speed,
      animations: new Set(),
      paused,
      cancelled: false,
    };
    run = active;
    return animateStep(active);
  }
  draw();
  let layoutFrame;
  const observer = new ResizeObserver((entries) => {
    cancelAnimationFrame(layoutFrame);
    if (Math.abs(entries[0].contentRect.width - layout.width) <= 1) return;
    // Crossing the width breakpoint also changes the observed scene's height.
    layoutFrame = requestAnimationFrame(draw);
  });
  observer.observe(host);
  return {
    update,
    setSpeed(speed) {
      if (!run) return;
      run.speed = speed;
      run.animations.forEach((animation) => animation.updatePlaybackRate(speed));
    },
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
      cancelAnimationFrame(layoutFrame);
      host.replaceChildren();
    },
  };
}
