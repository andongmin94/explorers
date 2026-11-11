import { REQUESTS } from "./engine.js";

const radius = (cylinder) => 146 - (cylinder / 199) * 108;
const angle = (cylinder) =>
  (Math.acos((185 ** 2 + 195 ** 2 - radius(cylinder) ** 2) / (2 * 185 * 195)) *
    180) /
  Math.PI;

const requestRoute = [[300, 0], [300, 30], [575, 30], [575, 351], [506, 351]];
const wirePath = requestRoute.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("");

// The label's leader starts on the same ellipse used to draw its cylinder.
function trackLabel(cylinder, label, alternate = false) {
  const r = radius(cylinder);
  const x = 320 + (alternate ? 1 : -1) * r * 0.8;
  const y = 185 + 0.48 * r * 0.6;
  const center = alternate ? 473 : 147;
  return `<g class="track-label${alternate ? " alternate" : ""}">
    <path d="M${x} ${y} L${center} 247 V258"/>
    <circle cx="${x}" cy="${y}" r="4"/>
    <rect x="${center - 75}" y="258" width="150" height="33" rx="2"/>
    <text x="${center}" y="280" text-anchor="middle">${label}</text>
  </g>`;
}

function seekDistance(step) {
  if (!step.distance) return "이동 0칸";
  const direction = step.state.head > step.before.head ? "안쪽" : "바깥쪽";
  return `${direction} ${step.distance}칸`;
}

function arrivalTitle(step, algorithm) {
  const runnerUp = algorithm === "sstf" && step.candidates[1];
  if (runnerUp)
    return `${step.before.head}에서 ${step.state.head}번 도착 · ${step.distance}칸 (비교한 ${runnerUp.cylinder}번은 ${runnerUp.distance}칸)`;
  return `${step.before.head} → ${step.state.head} · ${step.distance}칸 이동 완료`;
}

export function createDiskScene(host, onPhase) {
  host.innerHTML = `<div class="scene-callout">같은 8개 요청, 선택하는 순서가 달라집니다.</div><div class="queue-dock"><div class="dock-title"><strong>대기 큐</strong><span>처음 도착한 순서 · 전부 시작 전에 도착</span></div><div class="request-queue">${REQUESTS.map((n, i) => `<div class="request-slot" data-request="${i + 1}"><small>요청 ${i + 1}</small><b>${n}</b><span>대기</span></div>`).join("")}</div></div><div class="drive"><svg class="drive-map" viewBox="0 0 600 450" aria-hidden="true"><defs><marker id="disk-arrow" viewBox="0 0 8 8" markerWidth="5" markerHeight="5" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z"/></marker></defs><path class="request-wire" d="${wirePath}" marker-end="url(#disk-arrow)"/><text class="wire-label" x="548" y="55" text-anchor="end">선택한 요청 ↓</text><polygon class="device-shadow" points="87,221 327,341 572,219 332,99"/><polygon class="case-front" points="80,185 320,305 320,340 80,220"/><polygon class="case-side" points="320,305 560,185 560,220 320,340"/><polygon class="case-top" points="80,185 320,65 560,185 320,305"/><ellipse class="platter" cx="320" cy="185" rx="150" ry="72"/>${[0, 25, 50, 75, 100, 125, 150, 175, 199].map((n) => `<ellipse class="guide-track" cx="320" cy="185" rx="${radius(n)}" ry="${radius(n) * 0.48}"/>`).join("")}${REQUESTS.map((n, i) => `<ellipse class="request-track" data-track="${i + 1}" cx="320" cy="185" rx="${radius(n)}" ry="${radius(n) * 0.48}"/>`).join("")}<ellipse class="spindle" cx="320" cy="185" rx="23" ry="11"/><ellipse class="spindle-top" cx="320" cy="181" rx="23" ry="11"/><g transform="translate(505 185) scale(1 .48)"><g class="arm"><path class="arm-shadow" d="M0 -16L-195 -7L-204 5L0 16Z"/><path class="arm-body" d="M0 -12L-195 -4L-195 4L0 12Z"/><circle class="head-tip" cx="-195" cy="0" r="9"/><circle class="arm-pivot" cx="0" cy="0" r="19"/></g></g><text class="geometry-label" x="202" y="118">0 · 바깥쪽</text><text class="geometry-label" x="287" y="214">199 · 안쪽</text><polygon class="dock-top" points="100,317 116,307 516,307 500,317"/><polygon class="dock-side" points="500,317 516,307 516,414 500,424"/><rect class="dock-front" x="100" y="317" width="400" height="107"/><rect class="port" x="502" y="344" width="8" height="14"/><path class="screw" d="M107 325h5m-2.5-2.5v5M487 413h5m-2.5-2.5v5"/></svg><div class="controller"><div><span>헤드 위치</span><b data-head>53</b></div><div><span>누적 이동</span><b data-total>0<small>칸</small></b></div></div><div class="drive-label"><strong>하드 디스크</strong><span>실린더 0–199 · 헤드가 목표 트랙으로 이동</span></div></div><div class="motion-token" hidden></div>`;
  const $ = (s) => host.querySelector(s),
    arm = $(".arm"),
    token = $(".motion-token");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const labels = document.createElementNS("http://www.w3.org/2000/svg", "g");
  $(".drive-map").append(labels);
  let active = null;
  function snap(state, chosen = null, runnerUp = null) {
    arm.style.transform = `rotate(${angle(state.head)}deg)`;
    $("[data-head]").textContent = state.head;
    $("[data-total]").innerHTML = `${state.total}<small>칸</small>`;
    for (let id = 1; id <= REQUESTS.length; id++) {
      const done = state.completed.some((r) => r.id === id);
      const slot = $(`[data-request="${id}"]`);
      let appearance = "waiting";
      let caption = "대기";
      if (done) {
        appearance = "done";
        caption = "처리 완료";
      } else if (chosen?.id === id) {
        appearance = "selected";
        caption = runnerUp ? `선택 · ${chosen.distance}칸` : "선택";
      } else if (runnerUp?.id === id) {
        appearance = "alternate";
        caption = `후보 · ${runnerUp.distance}칸`;
      }
      slot.dataset.state = appearance;
      slot.querySelector("span").textContent = caption;
      $(`[data-track="${id}"]`).dataset.state = appearance;
    }
  }
  function phase(kind, title, body, state) {
    $(".scene-callout").textContent = title;
    onPhase({ kind, title, body, state });
  }
  function cancel() {
    if (active) {
      active.cancelled = true;
      for (const a of active.animations) a.cancel();
    }
    active = null;
    token.hidden = true;
    host.dataset.moving = "false";
  }
  async function animate(run, element, frames, options) {
    const a = element.animate(frames, options);
    a.playbackRate = run.speed;
    run.animations.add(a);
    if (run.paused) a.pause();
    await a.finished.catch(() => {});
    run.animations.delete(a);
  }
  async function update(
    step,
    { motion = false, speed = 1, algorithm = "fcfs" } = {},
  ) {
    cancel();
    if (!motion || !step.index || reduced.matches) {
      snap(step.state);
      labels.innerHTML = step.index ? trackLabel(step.state.head, seekDistance(step)) : "";
      phase(
        "complete",
        step.index
          ? arrivalTitle(step, algorithm)
          : "같은 8개 요청, 선택하는 순서가 달라집니다.",
        "",
        step.state,
      );
      return;
    }
    const run = { cancelled: false, paused: false, speed, animations: new Set() };
    active = run;
    const request = step.request;
    const chosen = step.candidates[0];
    const runnerUp = algorithm === "sstf" ? step.candidates[1] : null;
    snap(step.before, chosen, runnerUp);
    labels.innerHTML = runnerUp
      ? trackLabel(chosen.cylinder, `${chosen.cylinder}번 · ${chosen.distance}칸`) +
        trackLabel(runnerUp.cylinder, `${runnerUp.cylinder}번 · ${runnerUp.distance}칸`, true)
      : "";
    host.dataset.moving = "true";
    phase(
      "select",
      runnerUp ? `헤드 ${step.before.head} 기준 · 가장 가까운 ${request.cylinder}번 선택` : `요청 ${request.id} · ${request.cylinder}번 실린더 선택`,
      algorithm === "fcfs"
        ? "남은 요청 중 먼저 도착한 요청을 선택합니다. 가까운 위치인지는 선택 기준이 아닙니다."
        : `현재 헤드 ${step.before.head}에서 가장 가까운 요청을 선택합니다. 거리는 |${request.cylinder} − ${step.before.head}| = ${step.distance}입니다.`,
      step.before,
    );
    token.textContent = request.cylinder;
    token.hidden = false;
    const positionRoute = () => {
      const outer = host.getBoundingClientRect();
      const start = $(`[data-request="${request.id}"]`).getBoundingClientRect();
      const matrix = $(".drive-map").getScreenCTM();
      const points = [
        new DOMPoint(start.left + start.width / 2, start.bottom),
        ...requestRoute.map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix)),
      ];
      const path = points.map(({ x, y }, i) =>
        `${i ? "L" : "M"}${x - outer.left - host.clientLeft} ${y - outer.top - host.clientTop}`
      ).join(" ");
      token.style.offsetPath = `path("${path}")`;
    };
    positionRoute();
    const observer = new ResizeObserver(positionRoute);
    observer.observe(host);
    token.style.offsetRotate = "0deg";
    // Let both distances register before the selected card leaves the queue.
    await animate(run, token, [
      { offsetDistance: "0%", opacity: 0 },
      { offset: 0.035, offsetDistance: "3.5%", opacity: 1 },
      { offsetDistance: "100%", opacity: 1 },
    ],
      { delay: runnerUp ? 650 : 0, fill: "backwards", duration: 850, easing: "linear" });
    observer.disconnect();
    if (run.cancelled) return;
    token.hidden = true;
    if (runnerUp) snap(step.before, chosen);
    labels.innerHTML = trackLabel(request.cylinder, seekDistance(step));
    $("[data-head]").textContent = `${step.before.head} → ${request.cylinder}`;
    phase(
      "seek",
      `${step.before.head} → ${request.cylinder} · ${seekDistance(step)} 이동 중`,
      `선택한 트랙으로 헤드를 옮깁니다. 이번 이동 ${step.distance}칸은 도착 후 누적 이동에 더합니다.`,
      step.before,
    );
    await animate(
      run,
      arm,
      [
        { transform: `rotate(${angle(step.before.head)}deg)` },
        { transform: `rotate(${angle(request.cylinder)}deg)` },
      ],
      { duration: 1050 + step.distance * 4, easing: "ease-in-out" },
    );
    if (run.cancelled) return;
    snap(step.state);
    phase(
      "arrive",
      arrivalTitle(step, algorithm),
      `|${request.cylinder} − ${step.before.head}| = ${step.distance}칸. ${step.before.total} + ${step.distance} = ${step.state.total}칸으로 누적됩니다.`,
      step.state,
    );
    host.dataset.moving = "false";
    active = null;
  }
  return {
    update,
    setSpeed(speed) {
      if (!active) return;
      active.speed = speed;
      active.animations.forEach((animation) => animation.updatePlaybackRate(speed));
    },
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
