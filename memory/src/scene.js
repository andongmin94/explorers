// The memory explorer's isometric scene: CPU, page table, RAM frames and SSD
// on one floor. Pages are tokens: the SSD keeps the originals A–E, the RAM
// frames hold copies, and one access moves them along the floor paths.
// The RAM has 3 or 4 frames (lesson 03 compares both); under Clock every
// frame shows its reference bit and the hand sits in front of one frame.
import { josa } from "../../shared/josa.js";
import {
  callout,
  chip,
  defs,
  fitViewBox,
  floor,
  floorPath,
  frontText,
  led,
  module,
  place,
  quad,
  socket,
  ramStick,
  ssd,
  token,
  topText,
  travel as kitTravel,
} from "../../shared/iso-kit.js";

const PAGES = ["A", "B", "C", "D", "E"];
export const pageColor = (page) => `var(--page-${page.toLowerCase()})`;

/* ---------- World layout (iso units) ---------- */
const CPU = { x: 0, y: 9, size: 5 };
const CPU_TOP = 0.75;
const CPU_SPOT = [2.5, 11.5];
const TABLE = { x: -0.5, y: 1.2, w: 9, d: 3, h: 0.6 };
const entryX = (i) => TABLE.x + 1.1 + i * 1.7;
// RAM grows to the right with the frame count; three frames keep the original layout.
let N = 3;
let RAM = { x: 8, y: 6, w: 10, d: 3.8, h: 0.6 };
let PITCH = 3.1;
function setFrameCount(n) {
  N = n;
  PITCH = n > 3 ? 2.6 : 3.1;
  RAM = { x: 8, y: 6, w: 3.8 + PITCH * (n - 1), d: 3.8, h: 0.6 };
}
const SLOTS = () => Array.from({ length: N }, (_, slot) => slot);
const WELL = () => Math.min(2.5, PITCH - 0.25);
const slotX = (slot) => RAM.x + 1.9 + slot * PITCH;
const SLOT_Y = RAM.y + 1.45;
// The SSD is the one device whose place depends on the layout: on a wide
// desktop stage it stands right of the RAM so the cluster reads as one wide
// row; on a phone it sits in front so the scene stays tall enough to read.
const DISK_NARROW = { x: 16.5, y: 11, w: 10, d: 4 };
const DISK_WIDE = { x: 19.5, y: -0.5, w: 10, d: 4 };
let DISK = DISK_WIDE;
const DISK_TOP = 0.42;
const diskX = (page) => DISK.x + 1.6 + PAGES.indexOf(page) * 1.65;
const diskY = () => DISK.y + DISK.d / 2;
const TOKEN = 1.3;

const slotPoint = (slot, lift = 0) => [slotX(slot), SLOT_Y, RAM.h + lift];
const diskPoint = (page, lift = 0) => [diskX(page), diskY(), DISK_TOP + lift];
const cpuPoint = (lift = 0) => [...CPU_SPOT, CPU_TOP + lift];
const entryPoint = (page, lift = 0) => [entryX(PAGES.indexOf(page)), TABLE.y + 1.55, TABLE.h + lift];

const ROUTES = {
  lookup: [[2.5, 9], [2.5, 4.5]],
  read: [[9.2, 10], [9.2, 11.5], [5.5, 11.5]],
};
const loadRoute = (wide) => {
  const end = RAM.x + RAM.w + 0.3;
  const x = Math.max(wide ? 20.6 : 19.5, end + 1);
  return wide ? [[x, DISK.y + DISK.d], [x, 7.9], [end, 7.9]] : [[x, 11], [x, 7.9], [end, 7.9]];
};
const HAND_Y = () => RAM.y + RAM.d + 0.95;

// Both views are fitted to the devices, callouts and token routes (lifts
// included), not to the floor, which runs past the stage edges.
const VIEW_WIDE = fitViewBox([[0, 14.5, 0], [-0.5, 1.2, 0.6], [-1.6, 4.4, 4.6], [6, -0.6, 4.6], [29.5, 3.5, 0], [29.8, -1.6, 4.4], [18, 9.8, 0], [5, 14, 0]], 12);
const VIEW_TIGHT = fitViewBox([[0, 14.5, 0], [26.5, 10.5, 0], [26.5, 15, 0], [-0.5, 1.2, 5.6], [-0.5, 15, 0], [24, 6, 4.2]], 8);

function staticScene(wide) {
  const ram = ramStick({ x: RAM.x + 0.4, y: RAM.y - 1.9, length: RAM.w - 0.8, label: "", chips: 5 });
  const frames = module({ ...RAM, well: false });
  const table = module({ ...TABLE, well: false });
  const cpu = chip({ ...CPU, label: "" });
  const disk = ssd({ ...DISK, label: "" });

  const well = WELL();
  const slots = SLOTS()
    .map((slot) => {
      const x = slotX(slot);
      return `<g class="mem-slot" data-slot="${slot}">
        ${socket({ x: x - well / 2, y: SLOT_Y - 1.1, z: RAM.h, w: well, d: 2.2, cls: "mem-slot-well" })}
        ${quad({ x: x - well / 2, y: SLOT_Y - 1.1, z: RAM.h + 0.004, w: well, d: 2.2, fill: "none", stroke: "var(--accent)", strokeWidth: 2, cls: "mem-slot-ring" })}
        ${frontText({ x, y: RAM.y + RAM.d, z: RAM.h / 2, text: `F${slot}`, size: 10, fill: "var(--ink)", weight: 700 })}
        <g class="mem-rank"></g>
      </g>`;
    })
    .join("");

  const entries = PAGES.map((page, i) => {
    const x = entryX(i);
    // Each entry is a cell set into the table: LED, page letter, frame number.
    return `<g class="mem-entry" data-entry="${page}">
      ${socket({ x: x - 0.7, y: TABLE.y + 0.25, z: TABLE.h, w: 1.4, d: TABLE.d - 0.5, cls: "mem-entry-cell" })}
      ${led({ x, y: TABLE.y + 0.6, z: TABLE.h, color: pageColor(page) })}
      ${topText({ x, y: TABLE.y + 1.35, z: TABLE.h, text: page, size: 12, weight: 800, fill: pageColor(page) })}
      <g class="mem-entry-frame">${topText({ x, y: TABLE.y + 2.15, z: TABLE.h, text: "—", size: 10, weight: 600, fill: "var(--muted)" })}</g>
    </g>`;
  }).join("");

  const originals = PAGES.map(
    (page) => `<g class="mem-original" data-original="${page}">${token({ id: page, color: pageColor(page), size: TOKEN })}</g>`,
  ).join("");

  return `<svg class="mem-svg" viewBox="${wide ? VIEW_WIDE : VIEW_TIGHT}" role="img" aria-label="CPU, 페이지 테이블, RAM 프레임, SSD 장면">
    ${defs()}
    ${wide ? floor({ x: -4, y: -4, w: 37, d: 22 }) : floor({ x: -1, y: 0, w: 28.5, d: 16 })}
    ${floorPath(ROUTES.lookup, { dashed: true, cls: "mem-path", id: "mem-path-lookup" })}
    ${floorPath(ROUTES.read, { dashed: true, cls: "mem-path", id: "mem-path-read" })}
    ${floorPath(loadRoute(wide), { dashed: true, cls: "mem-path", id: "mem-path-load" })}
    ${table.svg}
    ${entries}
    ${ram.svg}
    ${frames.svg}
    ${slots}
    ${cpu.svg}
    ${disk.svg}
    ${frontText({ x: DISK.x + 2.6, y: DISK.y + DISK.d, z: 0.21, text: "PAGE STORE", size: 8, fill: "var(--muted)" })}
    ${callout({ x: 0.6, y: CPU.y + 2, z: 0.3, dx: -36, dy: -78, title: "CPU", sub: "요청하는 쪽", anchor: "middle" })}
    ${callout({ x: TABLE.x + 1, y: TABLE.y, z: TABLE.h, dx: -10, dy: -58, title: "페이지 테이블", sub: "상주 여부 · 프레임", anchor: "middle" })}
    ${callout({ x: RAM.x + RAM.w - 1, y: RAM.y - 1.4, z: 2.05, dx: 30, dy: -64, title: "RAM", sub: "·", cls: "mem-ram-callout", anchor: "middle" })}
    ${callout({ x: DISK.x + DISK.w, y: DISK.y + 0.6, z: DISK_TOP, dx: 34, dy: -64, title: "SSD", sub: "원본 A–E", anchor: "middle" })}
    <g class="mem-originals">${originals}</g>
    <g class="mem-hand"></g>
    <g class="mem-tokens">${SLOTS().map((slot) => `<g class="mem-token" data-token-slot="${slot}"></g>`).join("")}</g>
    <g class="mem-request"></g>
    <g class="mem-movers"></g>
  </svg>`;
}

const cloneFrames = (frames) => frames.map((frame) => ({ ...frame }));
const emptyFrames = () => SLOTS().map((slot) => ({ slot, page: null, loadedAt: null, lastUsedAt: null, ref: 0 }));

/** Order in which the policy would replace the resident pages; rank 1 goes first. Clock shows its bits instead. */
function ranks(frames, algorithm) {
  if (algorithm === "clock") return new Map();
  const key =
    algorithm === "fifo"
      ? (frame) => frame.loadedAt
      : algorithm === "opt"
        ? (frame) => -(frame.nextUseAt ?? Infinity)
        : (frame) => frame.lastUsedAt ?? frame.loadedAt;
  const order = frames.filter((frame) => frame.page).toSorted((a, b) => key(a) - key(b) || a.loadedAt - b.loadedAt);
  return new Map(order.map((frame, i) => [frame.slot, i + 1]));
}
const CALLOUT_SUB = { fifo: "#1 다음 교체 · 적재 순서", lru: "#1 다음 교체 · 마지막 접근", opt: "#1 다음 교체 · 다음 접근" };
const POLICY_NAME = { fifo: "FIFO", lru: "LRU", opt: "OPT", clock: "클럭" };

// Prose names a frame "프레임 0"; "F0" stays a compact label on the device.
const F = (slot, pair) => (pair ? josa(`프레임 ${slot}`, pair) : `프레임 ${slot}`);

export const replacementReason = (policy, frame) =>
  policy === "fifo"
    ? `적재 순서가 가장 앞선 ${frame.page} 교체 (적재 ${frame.loadedAt}번째)`
    : policy === "opt"
      ? `다음 접근이 가장 늦은 ${frame.page} 교체 (${frame.nextUseAt ? `다음 접근 ${frame.nextUseAt}번째` : "다시 쓰이지 않음"})`
      : policy === "clock"
        ? `참조 비트 0인 ${frame.page} 교체 (${F(frame.slot)})`
        : `마지막 접근이 가장 이른 ${frame.page} 교체 (마지막 접근 ${frame.lastUsedAt}번째)`;

export function createMemoryScene(host, { onPhase = () => {}, frameCount = 3 } = {}) {
  setFrameCount(frameCount);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = matchMedia("(max-width: 759px)");
  let svg, slotEls, tokenEls, request, movers, handEl;
  const $ = (selector) => svg.querySelector(selector);
  function build() {
    const wide = !narrow.matches;
    DISK = wide ? DISK_WIDE : DISK_NARROW;
    host.innerHTML = staticScene(wide);
    svg = host.querySelector("svg");
    slotEls = SLOTS().map((slot) => $(`[data-slot="${slot}"]`));
    tokenEls = SLOTS().map((slot) => $(`[data-token-slot="${slot}"]`));
    handEl = $(".mem-hand");
    request = $(".mem-request");
    movers = $(".mem-movers");
    for (const el of svg.querySelectorAll("[data-original]")) place(el, ...diskPoint(el.dataset.original));
    tokenEls.forEach((el, slot) => place(el, ...slotPoint(slot)));
    place(request, ...cpuPoint());
  }
  build();
  // Crossing the phone breakpoint redraws the scene in the other layout.
  narrow.addEventListener("change", () => {
    revision++;
    cancel();
    build();
    frames = step ? cloneFrames(step.frames) : emptyFrames();
    hand = step ? step.hand : null;
    paintFrames();
    paintRequest("done");
    finalPhase();
  });

  let step = null;
  let algorithm = "fifo";
  let frames = emptyFrames();
  // Clock's hand: the frame it points at (null outside Clock).
  let hand = null;
  let run = null;
  let revision = 0;
  // Next-victim marks (#1, its LED, the callout) hide while a victim prediction is pending.
  let hints = true;

  /* ---------- Painting the state ---------- */

  function paintFrames() {
    const rank = hints ? ranks(frames, algorithm) : new Map();
    const full = frames.every((frame) => frame.page);
    const clock = algorithm === "clock";
    frames.forEach((frame) => {
      const el = tokenEls[frame.slot];
      if (el.dataset.page !== (frame.page ?? "")) {
        el.dataset.page = frame.page ?? "";
        el.innerHTML = frame.page ? token({ id: frame.page, color: pageColor(frame.page), size: TOKEN }) : "";
      }
      el.style.opacity = "";
      const r = rank.get(frame.slot);
      const x = slotX(frame.slot);
      // Clock: the reference bit is evidence, not the answer, so it always shows.
      slotEls[frame.slot].querySelector(".mem-rank").innerHTML = clock
        ? frame.page
          ? `${led({ x: x - 0.75, y: SLOT_Y + 1.75, z: RAM.h, on: Boolean(frame.ref) })}${topText({ x: x + 0.2, y: SLOT_Y + 1.75, z: RAM.h, text: `R${frame.ref ? 1 : 0}`, size: 13, weight: 800, fill: frame.ref ? "var(--accent)" : "var(--muted)", cls: "mem-rank-text" })}`
          : ""
        : r
          ? `${led({ x: x - 0.75, y: SLOT_Y + 1.75, z: RAM.h, on: r === 1 && full })}${topText({ x: x + 0.15, y: SLOT_Y + 1.75, z: RAM.h, text: `#${r}`, size: 13, weight: 800, fill: r === 1 && full ? "var(--accent)" : "var(--muted)", cls: "mem-rank-text" })}`
          : "";
    });
    paintHand();
    for (const page of PAGES) {
      const frame = frames.find((f) => f.page === page);
      const entry = $(`[data-entry="${page}"]`);
      entry.querySelector(".iso-led").classList.toggle("is-on", Boolean(frame));
      entry.querySelector(".mem-entry-frame text").textContent = frame ? `F${frame.slot}` : "—";
      entry.classList.toggle("is-resident", Boolean(frame));
    }
    $(".mem-ram-callout .iso-callout-sub").textContent = clock ? "R 참조 비트 · ▲ 바늘" : !hints || !full ? `프레임 ${N}개` : CALLOUT_SUB[algorithm];
    host.setAttribute(
      "aria-label",
      `${step?.index || 0}번째 접근 후. ${frames.map((f) => `${F(f.slot)} ${f.page ? `페이지 ${f.page}${clock ? ` 참조 비트 ${f.ref ? 1 : 0}` : ""}` : "비어 있음"}`).join(", ")}.${clock && hand !== null ? ` 바늘은 ${F(hand)}.` : ""}`,
    );
  }

  function paintHand() {
    const at = algorithm === "clock" ? hand : null;
    if (handEl.dataset.at === String(at)) return;
    handEl.dataset.at = String(at);
    handEl.innerHTML =
      at === null
        ? ""
        : `${topText({ x: slotX(at), y: HAND_Y(), z: 0, text: "▲", size: 14, weight: 800, fill: "var(--accent)", mono: false })}${topText({ x: slotX(at), y: HAND_Y() + 0.85, z: 0, text: "바늘", size: 11, weight: 700, fill: "var(--accent)", mono: false })}`;
  }

  function paintRequest(state = "done") {
    const page = step?.index ? step.page : null;
    if (request.dataset.page !== (page ?? "")) {
      request.dataset.page = page ?? "";
      request.innerHTML = page ? token({ id: page, color: pageColor(page), size: TOKEN }) : "";
    }
    request.dataset.state = state;
  }

  let flows = [];
  function emphasis({ path = null, slot = null, ring = null, entry = null } = {}) {
    flows.forEach((animation) => animation.cancel());
    flows = [];
    for (const name of ["lookup", "read", "load"]) $(`#mem-path-${name}`).classList.toggle("is-active", name === path);
    slotEls.forEach((el, i) => {
      el.classList.toggle("is-hit", ring === "hit" && i === slot);
      el.classList.toggle("is-selected", ring === "select" && i === slot);
    });
    for (const el of svg.querySelectorAll("[data-entry]")) el.classList.toggle("is-probed", el.dataset.entry === entry);
  }

  function phase(kind, title, body) {
    host.dataset.phase = kind;
    onPhase({ kind, title, body });
  }

  function finalPhase() {
    if (!step?.index) {
      phase("ready", `RAM 프레임 ${N}개가 비어 있습니다 · 첫 요청은 A`, "페이지 테이블은 각 페이지의 상주 여부와 RAM 프레임 번호를 기록합니다.");
      return;
    }
    let outcome = step.hit ? "적중" : "빈 프레임에 적재";
    if (step.victim) {
      const { reason } = step.events.find((event) => event.type === "select");
      outcome = replacementReason(reason, step.before[step.frameIndex]);
    }
    phase(
      "access",
      `${step.index}번째 ${step.page} 접근 완료 · ${outcome}`,
      step.hit ? "RAM에 있던 페이지를 그대로 사용했습니다." : "저장장치에서 페이지를 읽어 RAM에 적재한 뒤 접근을 완료했습니다.",
    );
  }

  /* ---------- Motion ---------- */

  const alive = (active) => !active.cancelled && active.revision === revision;
  function track(animation, active) {
    animation.playbackRate = active.speed;
    active.animations.add(animation);
    if (active.paused) animation.pause();
    return animation.finished.catch(() => {}).then(() => active.animations.delete(animation));
  }
  const hold = (ms, active) => track(host.animate([{ opacity: 1 }, { opacity: 1 }], { duration: ms }), active);

  function flow(name, active) {
    const animation = $(`#mem-path-${name}`).animate([{ strokeDashoffset: 22 }, { strokeDashoffset: 0 }], { duration: 500, iterations: Infinity });
    flows.push(animation);
    track(animation, active);
  }

  function mover(page, { size = TOKEN, text = page } = {}) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "mem-mover");
    g.innerHTML = token({ id: page, text, color: pageColor(page), size });
    movers.append(g);
    return g;
  }

  function move(el, route, duration, active) {
    const animation = kitTravel(el, route, { duration, easing: "cubic-bezier(.45,.05,.3,1)" });
    return track(animation, active);
  }

  function fade(el, duration, active) {
    return track(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: "ease-in", fill: "forwards" }), active);
  }

  async function animateStep(active) {
    const page = step.page;
    const slot = step.frameIndex;

    paintRequest("pending");
    phase("lookup", `페이지 테이블에서 ${page} 항목을 조회합니다`, "CPU가 가상 주소에 접근하면 주소 변환 장치(MMU)가 그 주소가 속한 페이지의 항목을 읽습니다. 상주 중이면 이 항목에서 RAM 프레임 번호를 얻습니다.");
    emphasis({ path: "lookup", entry: page });
    const probe = mover(page, { size: 0.8 });
    place(probe, ...cpuPoint(0.55));
    flow("lookup", active);
    await move(probe, [cpuPoint(0.55), [2.5, 7, 1.6], entryPoint(page, 0.6), entryPoint(page)], 900, active);
    probe.remove();
    if (!alive(active)) return;

    for (const event of step.events) {
      if (!alive(active)) return;
      if (event.type === "sweep") {
        emphasis({ ring: "select", slot: event.frameIndex });
        phase("select", `클럭 · ${event.page}의 참조 비트 1 → 0, 바늘이 넘어갑니다`, `${josa(event.page, "은/는")} 참조 비트가 1이라 두 번째 기회를 얻습니다. 바늘이 다음 프레임으로 갑니다.`);
        hand = event.frameIndex;
        paintFrames();
        await hold(450, active);
        if (!alive(active)) return;
        frames[event.frameIndex] = { ...frames[event.frameIndex], ref: 0 };
        hand = (event.frameIndex + 1) % N;
        paintFrames();
        await hold(450, active);
      } else if (event.type === "hit") {
        if (algorithm === "clock") {
          frames[slot] = { ...frames[slot], ref: 1 };
          paintFrames();
        }
        emphasis({ ring: "hit", slot, entry: page });
        phase("hit", `적중 · ${josa(page, "이/가")} ${F(slot)}에 있습니다`, `페이지 테이블의 ${page} 항목이 ${F(slot, "을/를")} 가리킵니다. 이 프레임의 주소로 바로 변환합니다.`);
        await hold(600, active);
      } else if (event.type === "miss") {
        emphasis({ entry: page });
        phase("miss", `페이지 부재 · ${josa(page, "이/가")} RAM에 없습니다`, `${page} 항목이 미상주(—)입니다. 운영체제가 페이지 부재를 처리하기 위해 프레임을 확보합니다.`);
        await hold(700, active);
      } else if (event.type === "select") {
        emphasis({ ring: "select", slot });
        const reason =
          event.reason === "empty"
            ? "빈 프레임을 사용합니다."
            : event.reason === "fifo"
              ? `${josa(event.victim, "이/가")} 적재 순서가 가장 앞섭니다.`
              : event.reason === "opt"
                ? `${event.victim}의 다음 접근이 가장 늦습니다.`
                : event.reason === "clock"
                  ? `바늘이 가리킨 ${event.victim}의 참조 비트가 0입니다.`
                  : `${event.victim}의 마지막 접근이 가장 이릅니다.`;
        if (event.reason === "clock") {
          hand = slot;
          paintFrames();
        }
        phase(
          "select",
          event.reason === "empty" ? `빈 ${F(slot)} 선택` : `${POLICY_NAME[event.reason]} · ${replacementReason(event.reason, frames[slot])}`,
          reason,
        );
        await hold(event.victim ? 1500 : 900, active);
      } else if (event.type === "evict") {
        phase("evict", `${F(slot)}의 ${event.page} 사본만 제거합니다`, `${event.page}의 페이지 테이블 항목도 미상주로 바꿉니다. 읽기 전용이므로 저장장치에 다시 쓸 필요는 없습니다.`);
        const gone = mover(event.page);
        place(gone, ...slotPoint(slot));
        tokenEls[slot].innerHTML = "";
        tokenEls[slot].dataset.page = "";
        frames[slot] = { slot, page: null, loadedAt: null, lastUsedAt: null, ref: 0 };
        paintFrames();
        emphasis({ ring: "select", slot });
        await Promise.all([
          move(gone, [slotPoint(slot), slotPoint(slot, 1.8), diskPoint(event.page, 2.2)], 900, active),
          fade(gone, 900, active),
        ]);
        gone.remove();
        if (!alive(active)) return;
        await hold(120, active);
      } else if (event.type === "load") {
        phase("load", `저장장치에서 ${josa(page, "을/를")} 읽어 ${F(slot)}에 적재합니다`, `저장장치의 원본을 ${F(slot, "으로")} 복사합니다. 적재를 마치면 페이지 테이블에 ${page} → ${josa(`F${slot}`, "을/를")} 기록합니다.`);
        emphasis({ path: "load", ring: "select", slot });
        flow("load", active);
        const copy = mover(page);
        place(copy, ...diskPoint(page));
        await move(copy, [diskPoint(page), diskPoint(page, 2.4), slotPoint(slot, 2.4), slotPoint(slot)], 1300, active);
        copy.remove();
        if (!alive(active)) return;
        frames[slot] = { ...step.frames[slot], lastUsedAt: null };
        if (step.hand !== null) hand = step.hand;
        paintFrames();
        emphasis({ ring: "hit", slot });
      } else if (event.type === "access") {
        if (step.fault) {
          phase("retry", `CPU가 ${page} 접근을 다시 시도합니다`, `같은 가상 주소로 재시도하면 갱신된 페이지 테이블이 ${F(slot, "을/를")} 가리킵니다.`);
          emphasis({ path: "lookup", entry: page, ring: "hit", slot });
          flow("lookup", active);
          const retry = mover(page, { size: 0.8 });
          place(retry, ...cpuPoint(0.55));
          await move(retry, [cpuPoint(0.55), [2.5, 7, 1.6], entryPoint(page, 0.6), entryPoint(page)], 800, active);
          retry.remove();
          if (!alive(active)) return;
        }
        phase("read", `${F(slot)}에서 CPU로 값을 전달합니다`, `${josa(`페이지 ${page}`, "은/는")} ${F(slot)}에 남습니다. 읽은 값이 CPU에 도착하면 이번 접근을 기록합니다.`);
        emphasis({ path: "read", ring: "hit", slot, entry: page });
        flow("read", active);
        const value = mover(page, { size: 0.8 });
        place(value, ...slotPoint(slot, 0.6));
        await move(value, [slotPoint(slot, 0.6), slotPoint(slot, 2), cpuPoint(2), cpuPoint(0.6)], 1100, active);
        value.remove();
        if (!alive(active)) return;
        frames = cloneFrames(step.frames);
        paintFrames();
        paintRequest("done");
      }
    }
    if (!alive(active)) return;
    run = null;
    emphasis();
    finalPhase();
  }

  function cancel() {
    if (run) {
      run.cancelled = true;
      run.animations.forEach((animation) => animation.cancel());
      run = null;
    }
    movers.replaceChildren();
    emphasis();
  }

  function update(next, previous = null, { animate = true, speed = 1, paused = false, algorithm: policy = algorithm } = {}) {
    revision++;
    cancel();
    step = next;
    algorithm = policy;
    if (next.frames.length !== N) {
      // Lesson 03 switches between 3 and 4 frames: redraw the RAM.
      setFrameCount(next.frames.length);
      build();
    }
    const moving = animate && !reduced.matches && previous && next.index === previous.index + 1 && next.events.length;
    frames = cloneFrames(moving ? next.before : next.frames);
    hand = moving ? next.handBefore : next.hand;
    paintFrames();
    paintRequest(moving ? "pending" : "done");
    if (!moving) {
      finalPhase();
      return Promise.resolve();
    }
    const active = { revision, speed, animations: new Set(), paused, cancelled: false };
    run = active;
    return animateStep(active);
  }

  return {
    update,
    setHints(on) {
      if (hints === on) return;
      hints = on;
      paintFrames();
    },
    setSpeed(speed) {
      if (!run) return;
      run.speed = speed;
      run.animations.forEach((animation) => animation.updatePlaybackRate(speed));
    },
    pause() {
      if (!run) return;
      run.paused = true;
      run.animations.forEach((animation) => animation.pause());
    },
    resume() {
      if (!run) return;
      run.paused = false;
      run.animations.forEach((animation) => animation.play());
    },
  };
}

