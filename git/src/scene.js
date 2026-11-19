// The Git scene: one isometric SVG built from the shared kit. Three devices
// stand on one floor, left to right: the working tree (a laptop whose screen
// shows welcome.txt), the index (a module with slots for the staged snapshot
// or the three conflict stages) and the local repository (a server whose top
// carries the commit graph). Snapshots travel between devices as tokens.
import {
  callout,
  defs,
  floor,
  floorPath,
  frontQuad,
  frontText,
  laptop,
  led,
  module,
  project,
  server,
  token,
} from "../../shared/iso-kit.js";
import { CONTENTS } from "./engine.js";

const LAPTOP = { x: 1, y: 7, w: 6, d: 4 };
const INDEX = { x: 9.5, y: 4.5, w: 5, d: 4, h: 0.9 };
const REPO = { x: 17, y: 0, w: 9, d: 8, units: 2 };
const REPO_TOP = REPO.units * 0.75 - 0.05;
const NODES = { C0: [19.1, 2.2], C1: [22, 6], C2: [22, 2.2], C3: [24.9, 2.2] };
const EDGES = [
  ["C0", "C1", "feature"],
  ["C0", "C2", "main"],
  ["C2", "C3", "main"],
  ["C1", "C3", "feature"],
];
const WORK_SLOT = [LAPTOP.x + 3, LAPTOP.y + 2.9, 0.5];
const INDEX_SLOT = [12, 6.5, INDEX.h];
const STAGES = [
  { key: "base", slot: [10.6, 6.5, INDEX.h] },
  { key: "ours", slot: [12, 6.5, INDEX.h] },
  { key: "theirs", slot: [13.4, 6.5, INDEX.h] },
];
const ROUTES = {
  add: [[LAPTOP.x + LAPTOP.w + 0.4, 9], [8.2, 9], [8.2, 6.5], [9.3, 6.5]],
  commit: [[14.7, 6.5], [16.8, 6.5]],
  checkout: [[20, 8.3], [20, 12], [WORK_SLOT[0], 12], [WORK_SLOT[0], LAPTOP.y + LAPTOP.d + 0.3]],
};
const LIFT = 0.35;
const lifted = (points) => points.map(([x, y]) => [x, y, LIFT]);
const node = (id) => [...NODES[id], REPO_TOP];

const KIND_COLOR = {
  base: "var(--git-base)",
  main: "var(--git-main)",
  feature: "var(--git-feature)",
  both: "var(--accent)",
  conflict: "var(--git-conflict)",
};
/** Which title a file snapshot carries: base, main, feature, both or conflict. */
export function contentKind(content) {
  if (content == null) return "conflict";
  const hit = Object.entries(CONTENTS).find(([, value]) => value === content);
  return hit ? hit[0] : "conflict";
}
const BRANCH_COLOR = { main: "var(--git-main)", "feature/title": "var(--git-feature)" };
const COMMIT_COLOR = { C0: KIND_COLOR.base, C1: KIND_COLOR.feature, C2: KIND_COLOR.main, C3: KIND_COLOR.main };

const r2 = (n) => Math.round(n * 100) / 100;
const screen = ([x, y, z = 0]) => project(x, y, z).map(r2);
const translate = ([sx, sy]) => `translate(${sx}px, ${sy}px)`;

/** Label of a snapshot token: the commit it equals, or Δ for a new change. */
function snapshotLabel(content, commits) {
  return commits.find((commit) => commit.content === content)?.id ?? "Δ";
}

/**
 * The laptop screen: a miniature editor. A tab strip with the file name on
 * top, then welcome.txt as a gutter of line numbers and code lines, the title
 * line in the colour of whoever wrote it. Geometry stays inside the glass
 * (z 0.46–2.56 above the laptop base).
 */
function screenSvg(state) {
  const y = LAPTOP.y - 0.05;
  const left = LAPTOP.x + 0.26;
  const width = LAPTOP.w - 0.52;
  const muted = "color-mix(in srgb, var(--hw-lcd-ink) 34%, transparent)";
  const gutter = "color-mix(in srgb, var(--hw-lcd-ink) 22%, transparent)";
  const conflict = state.status === "conflict";
  const kind = contentKind(state.working);
  const lines = conflict
    ? [[1.5, muted], [1.0, KIND_COLOR.conflict], [2.5, KIND_COLOR.main], [0.7, KIND_COLOR.conflict], [2.5, KIND_COLOR.feature], [1.0, KIND_COLOR.conflict], [1.9, muted]]
    : [[1.5, muted], [2.8, KIND_COLOR[kind]], [1.9, muted]];
  const step = conflict ? 0.19 : 0.42;
  const barH = conflict ? 0.11 : 0.16;
  const top = conflict ? 1.66 : 1.5;
  const tab = `${frontQuad({ x: left, y, z: 1.98, w: width, h: 0.58, fill: "rgb(255 255 255 / .05)" })}
    ${frontQuad({ x: left + 0.12, y, z: 1.98, w: 2.7, h: 0.5, fill: "rgb(255 255 255 / .1)" })}
    ${frontText({ x: left + 0.3, y, z: 2.23, text: "welcome.txt", size: 7.5, anchor: "start", fill: "var(--hw-lcd-ink)", weight: 600 })}`;
  const code = lines
    .map(([w, fill], i) => {
      const z = top - i * step;
      return frontQuad({ x: left + 0.2, y, z, w: 0.16, h: barH, fill: gutter }) + frontQuad({ x: left + 0.55, y, z, w, h: barH, fill });
    })
    .join("");
  return tab + code;
}

// Branch labels are small printed tags (dot + name on a plate-coloured pill)
// so they stay legible over the server. main stands above its commit (the back
// lane); feature/title sits to the left, so neither covers the slot where the
// next commit lands.
function refSvg(branch) {
  const width = branch.length * 7.4 + 26;
  const pill = (x, y) => `<rect class="git-ref-pill" x="${r2(x)}" y="${r2(y - 11)}" width="${r2(width)}" height="22" rx="11"/>
    <circle cx="${r2(x + 11)}" cy="${r2(y)}" r="3.6" fill="${BRANCH_COLOR[branch]}"/>
    <text class="git-ref-text" x="${r2(x + 19)}" y="${r2(y)}">${branch}</text>`;
  if (branch === "main") {
    return `<line class="git-ref-line" x1="0" y1="-14" x2="0" y2="-35"/>${pill(-width / 2, -46)}`;
  }
  return `<line class="git-ref-line" x1="-22" y1="4" x2="-30" y2="4"/>${pill(-30 - width, 4)}`;
}

export function createGitScene(host, { onPhase = () => {} } = {}) {
  const laptopDevice = laptop({ ...LAPTOP });
  const indexDevice = module({ ...INDEX, label: "" });
  const repoDevice = server({ ...REPO, label: "" });
  // Fitted to the devices, callouts and token routes (measured), not to the
  // floor, which runs past the stage edges. Phones print larger labels.
  const VIEW = { wide: "-224 -30 790 394", narrow: "-224 -44 805 408" };
  const narrow = matchMedia("(max-width: 759px)");
  const viewBox = narrow.matches ? VIEW.narrow : VIEW.wide;

  host.innerHTML = `<svg viewBox="${viewBox}" role="img" aria-label="작업 트리, 인덱스, 로컬 저장소 사이의 welcome.txt 흐름">
    ${defs()}
    ${floor({ x: -7, y: -7, w: 40, d: 27 })}
    ${Object.entries(ROUTES).map(([id, points]) => floorPath(points, { id: `route-${id}`, dashed: true, arrow: false, cls: "git-route" })).join("")}
    ${laptopDevice.svg}
    <g class="git-screen"></g>
    ${indexDevice.svg}
    <g class="git-index-led"></g>
    ${repoDevice.svg}
    <g class="git-edges">${EDGES.map(([from, to, cls]) => floorPath([NODES[from], NODES[to]], { z: REPO_TOP, arrow: false, cls: `git-edge is-${cls}`, id: `edge-${from}-${to}` })).join("")}</g>
    <g class="git-commits">${Object.keys(NODES).map((id) => `<g class="git-slot" data-commit="${id}" style="transform:${translate(screen(node(id)))}">${token({ id, color: COMMIT_COLOR[id], size: 1.5, h: 0.6 })}</g>`).join("")}</g>
    <g class="git-index-tokens">
      <g class="git-slot" data-index="single" style="transform:${translate(screen(INDEX_SLOT))}"></g>
      ${STAGES.map((stage) => `<g class="git-slot" data-stage="${stage.key}" style="transform:${translate(screen(stage.slot))}"></g>`).join("")}
    </g>
    ${callout({ x: LAPTOP.x + 0.6, y: LAPTOP.y, z: 2.82, dx: -26, dy: -36, title: "작업 트리", sub: "WORKING TREE", cls: "git-callout-work" })}
    ${callout({ x: 12, y: INDEX.y, z: INDEX.h, dx: 0, dy: -96, title: "인덱스 · 스테이징", sub: "INDEX", cls: "git-callout-index" })}
    ${callout({ x: REPO.x + REPO.w, y: REPO.y, z: REPO_TOP, dx: -10, dy: -112, title: "로컬 저장소", sub: ".git · 커밋 이력", cls: "git-callout-history" })}
    <g class="git-refs">
      <g class="git-ref" data-ref="main">${refSvg("main")}</g>
      <g class="git-ref" data-ref="feature/title">${refSvg("feature/title")}</g>
      <g class="git-head"></g>
    </g>
    <g class="git-mover" data-mover="a" style="display:none"></g>
    <g class="git-mover" data-mover="b" style="display:none"></g>
  </svg>`;

  const $ = (selector) => host.querySelector(selector);
  narrow.addEventListener("change", () => $("svg").setAttribute("viewBox", narrow.matches ? VIEW.narrow : VIEW.wide));
  const $$ = (selector) => [...host.querySelectorAll(selector)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let active = null;

  /* ---------- painting a state ---------- */

  const refPoint = (branch, state) => {
    const id = state.refs[branch];
    return id ? screen(node(id)) : null;
  };
  const headPoint = (state) => {
    const [x, y] = refPoint(state.currentBranch, state);
    return state.currentBranch === "main" ? [x, y - 68] : [r2(x - 64), y + 28];
  };

  function paintRefs(state) {
    for (const branch of ["main", "feature/title"]) {
      const el = $(`[data-ref="${branch}"]`);
      const point = refPoint(branch, state);
      el.style.display = point ? "" : "none";
      if (point) el.style.transform = translate(point);
    }
    const head = $(".git-head");
    head.innerHTML = `<rect x="-24" y="-10" width="48" height="20" rx="5" class="git-head-tag"/><text class="git-head-text" x="0" y="0.5">HEAD</text>`;
    head.style.transform = translate(headPoint(state));
  }

  function paintIndex(state, stages = state.index.stages) {
    const single = $('[data-index="single"]');
    if (stages) {
      single.innerHTML = "";
      for (const { key } of STAGES) {
        const slot = $(`[data-stage="${key}"]`);
        const id = state.merge?.[key];
        slot.innerHTML = stages[key] && id ? token({ id, color: COMMIT_COLOR[id], size: 1.05, h: 0.45 }) : "";
      }
    } else {
      for (const { key } of STAGES) $(`[data-stage="${key}"]`).innerHTML = "";
      single.innerHTML = token({
        id: snapshotLabel(state.index.content, state.commits),
        color: KIND_COLOR[contentKind(state.index.content)],
        size: 1.3,
        h: 0.55,
      });
    }
    const unmerged = state.index.status === "unmerged" || Boolean(stages);
    const staged = state.index.status === "staged";
    $(".git-index-led").innerHTML =
      led({ x: 13.9, y: 7.95, z: INDEX.h, on: unmerged || staged, color: unmerged ? "var(--git-conflict)" : "var(--accent)" });
  }

  function paint(state, { stages } = {}) {
    host.dataset.status = state.status;
    $(".git-screen").innerHTML = screenSvg(state);
    paintIndex(state, stages);
    const present = new Set(state.commits.map((commit) => commit.id));
    for (const el of $$("[data-commit]")) el.style.display = present.has(el.dataset.commit) ? "" : "none";
    const conflict = state.status === "conflict" || state.status === "resolved";
    for (const [from, to] of EDGES) {
      const edge = $(`#edge-${from}-${to}`);
      edge.style.display = present.has(to) ? "" : "none";
      edge.classList.toggle("is-conflict", conflict && from === "C0");
    }
    paintRefs(state);
    for (const route of $$(".git-route")) route.classList.remove("is-active", "is-conflict");
  }

  /* ---------- motion ---------- */

  function animate(run, el, frames, options) {
    const animation = el.animate(frames, options);
    animation.playbackRate = run.speed;
    run.animations.add(animation);
    if (run.paused) animation.pause();
    return animation.finished
      .catch(() => {})
      .then(() => run.animations.delete(animation));
  }

  /** Move a mover token along world points at an even screen speed. */
  async function travel(run, mover, route, { label, color, scale = 1 }) {
    const el = $(`[data-mover="${mover}"]`);
    el.innerHTML = token({ id: label, color, size: 1.3, h: 0.55 });
    el.style.display = "";
    const points = route.map(screen);
    const lengths = points.map((p, i) => (i ? Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0));
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    let run_ = 0;
    const frames = points.map((p, i) => {
      run_ += lengths[i];
      return { transform: translate(p), offset: r2(run_ / total) };
    });
    await animate(run, el, frames, {
      duration: (420 + Math.min(total, 760) * 1.25) * scale,
      easing: "cubic-bezier(.35,.05,.25,1)",
      fill: "forwards",
    });
    if (!run.cancelled) hideMover(el);
  }
  const hideMover = (el) => {
    el.getAnimations().forEach((animation) => animation.cancel());
    el.style.display = "none";
    el.innerHTML = "";
  };

  function light(...ids) {
    for (const id of ids) {
      const [name, mode = "active"] = id.split(":");
      $(`#route-${name}`).classList.add(`is-${mode}`);
    }
  }

  /** Slide refs and HEAD from where they were to where they are now. */
  function flipRefs(run, before, after) {
    const moves = [];
    for (const branch of ["main", "feature/title"]) {
      const from = refPoint(branch, before);
      const to = refPoint(branch, after);
      const el = $(`[data-ref="${branch}"]`);
      if (!to) continue;
      if (!from) moves.push(animate(run, el, [{ opacity: 0 }, { opacity: 1 }], { duration: 450 }));
      else if (from[0] !== to[0] || from[1] !== to[1])
        moves.push(animate(run, el, [{ transform: translate(from) }, { transform: translate(to) }], { duration: 650, easing: "cubic-bezier(.2,.7,.2,1)" }));
    }
    const hf = headPoint(before);
    const ht = headPoint(after);
    if (hf[0] !== ht[0] || hf[1] !== ht[1])
      moves.push(animate(run, $(".git-head"), [{ transform: translate(hf) }, { transform: translate(ht) }], { duration: 650, easing: "cubic-bezier(.2,.7,.2,1)" }));
    return Promise.all(moves);
  }

  function phase(kind, title, body, state) {
    host.dataset.phase = kind;
    onPhase({ kind, title, body, state });
  }

  function cancel() {
    if (active) {
      active.cancelled = true;
      for (const animation of active.animations) animation.cancel();
    }
    active = null;
    for (const el of $$(".git-mover")) hideMover(el);
  }

  const requestBodies = {
    branch: "브랜치는 새 커밋이 아니라, 기존 커밋을 가리키는 이름입니다. HEAD가 새 이름으로 옮겨갑니다.",
    edit: "작업 트리의 파일만 고칩니다. 인덱스와 커밋은 아직 그대로입니다.",
    stage: "작업 트리의 현재 내용이 인덱스로 복사됩니다.",
    commit: "인덱스의 스냅샷으로 새 커밋을 만들고 현재 브랜치를 옮깁니다.",
    switch: "main이 가리키는 커밋에서 작업 트리와 인덱스를 함께 복원합니다.",
    merge: "공통 조상 C0, 현재 C2, 가져올 C1의 세 버전을 인덱스로 불러와 비교합니다.",
    resolve: "선택한 최종 문장으로 충돌 표시를 교체합니다. 아직 git add 전입니다.",
  };
  const stageNames = { base: "공통 조상", ours: "현재 main", theirs: "가져올 feature/title" };

  async function update(step, { animate: motion = false, speed = 1 } = {}) {
    cancel();
    host.dataset.action = step.action;
    if (!motion || step.index === 0 || reduced.matches) {
      paint(step.state);
      phase("complete", step.title, "", step.state);
      return;
    }
    const run = { speed, cancelled: false, paused: false, animations: new Set() };
    active = run;
    const { before, state } = step;
    const branch = state.currentBranch;
    paint(before);
    phase("request", step.command || step.title, requestBodies[step.action] ?? "", before);

    if (step.action === "stage") {
      light("add");
      await travel(run, "a", [WORK_SLOT, ...lifted(ROUTES.add), INDEX_SLOT], {
        label: snapshotLabel(state.index.content, state.commits),
        color: KIND_COLOR[contentKind(state.working)],
      });
    } else if (step.action === "commit") {
      const id = state.refs[branch];
      light("commit");
      await travel(run, "a", [INDEX_SLOT, ...lifted(ROUTES.commit), node(id)], {
        label: id,
        color: COMMIT_COLOR[id],
      });
    } else if (step.action === "switch") {
      const id = state.refs[branch];
      light("commit", "checkout");
      const color = KIND_COLOR[contentKind(state.working)];
      await Promise.all([
        travel(run, "a", [node(id), ...lifted([...ROUTES.commit].reverse()), INDEX_SLOT], { label: id, color }),
        travel(run, "b", [node(id), ...lifted(ROUTES.checkout), WORK_SLOT], { label: id, color }),
      ]);
    } else if (step.action === "merge") {
      const stages = {};
      light("commit");
      const comparing = (partial) => ({ ...before, merge: state.merge, index: { status: "comparing", content: null, stages: partial } });
      paintIndex({ ...before, merge: state.merge }, {});
      for (const [i, { key, slot }] of STAGES.entries()) {
        const id = state.merge[key];
        phase("request", `${i + 1}/3 · ${stageNames[key]} ${id} → 인덱스`, `${stageNames[key]}의 제목 줄을 인덱스에 올려 비교합니다.`, comparing({ ...stages }));
        await travel(run, "a", [node(id), ...lifted([...ROUTES.commit].reverse()), slot], {
          label: id,
          color: COMMIT_COLOR[id],
          scale: 0.8,
        });
        if (run.cancelled) return;
        stages[key] = state.index.stages[key];
        paintIndex({ ...before, merge: state.merge }, { ...stages });
      }
      phase("request", "충돌 표시 → 작업 트리", "같은 줄을 서로 다르게 바꿔 자동으로 합칠 수 없습니다. 두 문장이 충돌 표시와 함께 파일에 들어갑니다.", comparing({ ...stages }));
      light("add:conflict");
      $("#route-commit").classList.remove("is-active");
      await travel(run, "a", [INDEX_SLOT, ...lifted([...ROUTES.add].reverse()), WORK_SLOT], {
        label: "!",
        color: KIND_COLOR.conflict,
        scale: 0.8,
      });
    } else if (step.action === "edit" || step.action === "resolve") {
      const screenEl = $(".git-screen");
      await animate(run, screenEl, [{ opacity: 1 }, { opacity: 0.1 }], { duration: 380, easing: "ease-in" });
      if (run.cancelled) return;
      $(".git-screen").innerHTML = screenSvg(state);
      await animate(run, screenEl, [{ opacity: 0.1 }, { opacity: 1 }], { duration: 420, easing: "ease-out" });
    }
    if (run.cancelled) return;

    paint(state);
    phase(
      "apply",
      step.title,
      {
        merge: "자동 병합이 멈췄습니다. main은 여전히 C2를 가리키고, 새 커밋은 없습니다.",
        resolve: "작업 트리는 고쳤지만 인덱스에는 아직 세 버전이 남아 있습니다.",
        commit: state.commits.length === 4 ? "C3은 C2와 C1을 부모로 갖습니다. main만 C3로 이동합니다." : "",
      }[step.action] ?? "",
      state,
    );
    const moves = [flipRefs(run, before, state)];
    if (step.action === "commit") {
      const commit = $(`[data-commit="${state.refs[branch]}"]`);
      moves.push(animate(run, commit, [{ opacity: 0.35 }, { opacity: 1 }], { duration: 420, easing: "ease-out" }));
    }
    await Promise.all(moves);
    if (run.cancelled) return;
    phase("complete", step.title, "", state);
    active = null;
  }

  return {
    update,
    cancel,
    setSpeed(speed) {
      if (!active) return;
      active.speed = speed;
      active.animations.forEach((animation) => animation.updatePlaybackRate(speed));
    },
    pause() {
      if (!active) return;
      active.paused = true;
      active.animations.forEach((animation) => animation.pause());
    },
    resume() {
      if (!active) return;
      active.paused = false;
      active.animations.forEach((animation) => animation.play());
    },
  };
}
