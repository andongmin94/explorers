// The Git scene: one isometric SVG built from the shared kit. Three devices
// stand on one floor and read left to right: the working tree (a laptop whose
// screen shows welcome.txt as a mini editor), the index (a machined tray with
// the four stage slots 0–3: stage 0 holds the staged snapshot, stages 1–3 the
// three versions of a conflicted file) and the local repository (a server whose
// glass top carries the commit graph). Cables join them; a snapshot travels
// along a cable as a token, and the cable it uses lights up.
// The commit graph's layout comes from the lesson (lessons.js → layout.nodes:
// [column, lane], lane 0 = main, lane 1 = feature).
import {
  MAT,
  cable,
  callout,
  defs,
  fitScene,
  floor,
  floorPath,
  frontQuad,
  frontText,
  labelScale,
  laptop,
  pocket,
  project,
  server,
  token,
  tray,
} from "../../shared/iso-kit.js";
import { contentKindOf, lineKinds, VERSIONS } from "./engine.js";

const LAPTOP = { x: 1.5, y: 3, w: 5, d: 3.4 };
const TRAY = { x: 2.5, y: 9.3, slots: 4, pitch: 1.45, d: 2.2, start: 0 };
const REPO = { x: 11, y: 0, w: 7.5, d: 7.5, units: 2 };
const REPO_TOP = REPO.units * 0.75 - 0.05;
const REPO_C = [REPO.x + REPO.w / 2, REPO.y + REPO.d / 2];
/** Commit graph on the server top: columns run along the screen horizontal. */
const COL_STEP = 2.0;
const LANE_S = [-0.9, 1.15];
const DEFAULT_LAYOUT = {
  nodes: { C0: [0, 0], C1: [1, 1], C2: [1, 0], C3: [2, 0] },
  versions: VERSIONS.conflict,
  kindOf: contentKindOf,
};
const indexDevice = tray({ ...TRAY, label: "INDEX", mat: MAT.metal });
const TRAY_W = indexDevice.w;
const WORK_SLOT = [LAPTOP.x + 2.5, LAPTOP.y + 2.75, 0.3];
const ADD_X = LAPTOP.x + 3.8;
/** Stage 0 = the staged snapshot; stages 1–3 = base, ours, theirs. */
const INDEX_SLOT = indexDevice.slots[0];
const STAGES = [
  { key: "base", slot: indexDevice.slots[1], n: 1 },
  { key: "ours", slot: indexDevice.slots[2], n: 2 },
  { key: "theirs", slot: indexDevice.slots[3], n: 3 },
];
// Cables on the floor, ending at device edges (drawn before the devices so
// the plugs tuck under them).
const CABLE_X = 13.2;
const CHECKOUT_Y = 4.9;
const CABLES = {
  add: [[ADD_X, LAPTOP.y + LAPTOP.d + 0.05], [ADD_X, TRAY.y - 0.05]],
  commit: [[TRAY.x + TRAY_W + 0.05, TRAY.y + TRAY.d / 2], [CABLE_X, TRAY.y + TRAY.d / 2], [CABLE_X, REPO.y + REPO.d + 0.05]],
  checkout: [[REPO.x - 0.05, CHECKOUT_Y], [LAPTOP.x + LAPTOP.w + 0.05, CHECKOUT_Y]],
};
const LIFT = 0.45;
const lifted = (points) => points.map(([x, y]) => [x, y, LIFT]);
/** Token paths along the cables (world points, lifted off the floor). */
const ROUTES = {
  add: [[ADD_X, LAPTOP.y + LAPTOP.d - 0.3, 0.7], ...lifted(CABLES.add), [ADD_X, TRAY.y + 0.3, 0.9]],
  commit: lifted(CABLES.commit),
  checkout: lifted(CABLES.checkout),
};
const UP = 0.9;
const COMMIT_TOKEN = { size: 1.4, h: 0.55, textSize: 15 };
const SLOT_TOKEN = { size: 1.12, h: 0.45, textSize: 13 };
const MOVER_TOKEN = { size: 1.3, h: 0.5, textSize: 14 };
/** From the commit cable's end, up the server's front face and onto a commit. */
const intoRepo = (to) => [...ROUTES.commit, [CABLE_X, REPO.y + REPO.d + 0.05, REPO_TOP + UP], [to[0], to[1], to[2] + UP], to];
const outOfRepo = (from) => [...intoRepo(from)].reverse();
/** From a commit over the server's back-left edge and along the checkout cable. */
const repoToWork = (from) => [from, [from[0], from[1], from[2] + UP], [REPO.x + 0.3, CHECKOUT_Y, REPO_TOP + UP], [REPO.x - 0.4, CHECKOUT_Y, LIFT], ...ROUTES.checkout.slice(1), WORK_SLOT];

const KIND_COLOR = {
  base: "var(--git-base)",
  main: "var(--git-main)",
  feature: "var(--git-feature)",
  both: "var(--accent)",
  conflict: "var(--git-conflict)",
};
/** Lesson 03's title-based kind; kept as the scene's default. */
export const contentKind = contentKindOf;
const BRANCH_COLOR = { main: "var(--git-main)", "feature/title": "var(--git-feature)" };

const r2 = (n) => Math.round(n * 100) / 100;
const screen = ([x, y, z = 0]) => project(x, y, z).map(r2);
const translate = ([sx, sy]) => `translate(${sx}px, ${sy}px)`;
const attr = (s) => String(s).replace(/"/g, "&quot;");
const desktopQuery = "(min-width: 1100px) and (min-height: 700px)";

/** Label of a snapshot token: the commit it equals, or Δ for a new change. */
function snapshotLabel(content, commits) {
  return commits.findLast((commit) => commit.content === content && !commit.orphan)?.id ?? commits.find((c) => c.content === content)?.id ?? "Δ";
}

/** Colour of a commit token: C0 grey, then the colour of the branch that made it. */
function commitColor(state, id) {
  const commit = state.commits.find((c) => c.id === id);
  if (!commit || !commit.parents.length) return KIND_COLOR.base;
  return BRANCH_COLOR[commit.branch] ?? KIND_COLOR.feature;
}

// Branch labels are printed pill tags (dot + name) so they stay legible over
// the server. main stands above its commit, feature/title below it (offset to
// the right), so the two never meet, even on the same commit, and neither
// covers an edge or another commit. Each tag group is scaled by k (labelScale's
// factor) about its commit.
// Measured in the label font (dot 19 + text + 13 end padding), so the pill
// hugs its name; the estimate covers a missing canvas.
let measure = null;
const refWidth = (branch) => {
  measure ??= document.createElement("canvas").getContext("2d");
  if (!measure) return branch.length * 7.4 + 26;
  measure.font = `600 12px ${getComputedStyle(document.documentElement).getPropertyValue("--font-sans") || "sans-serif"}`;
  return Math.round(measure.measureText(branch).width + 32);
};
function refSvg(branch, place) {
  const width = refWidth(branch);
  const pill = (x, y) => `<rect class="git-ref-pill" x="${r2(x)}" y="${r2(y - 11)}" width="${r2(width)}" height="22" rx="11"/>
    <circle cx="${r2(x + 11)}" cy="${r2(y)}" r="3.6" fill="${BRANCH_COLOR[branch]}"/>
    <text class="git-ref-text" x="${r2(x + 19)}" y="${r2(y)}">${branch}</text>`;
  if (place === "above") return `<line class="git-ref-line" x1="0" y1="-16" x2="0" y2="-33"/>${pill(-width / 2, -44)}`;
  return `<line class="git-ref-line" x1="0" y1="14" x2="0" y2="29"/>${pill(-24, 40)}`;
}

export function createGitScene(host, { onPhase = () => {}, layout: given = {} } = {}) {
  const layout = { ...DEFAULT_LAYOUT, ...given };
  const NODES = Object.fromEntries(
    Object.entries(layout.nodes).map(([id, [col, lane]]) => {
      const t = (col - 1) * COL_STEP;
      const s = LANE_S[lane];
      return [id, [REPO_C[0] + t + s, REPO_C[1] - t + s]];
    }),
  );
  const node = (id) => [...NODES[id], REPO_TOP];
  const versions = layout.versions;
  /** Which colour a whole snapshot takes: base, main, feature, both or conflict. */
  const kindOf =
    layout.kindOf ??
    ((content) => {
      if (content == null || /^<<<<<<< /m.test(content)) return "conflict";
      if (content === versions.base) return "base";
      if (content === versions.main) return "main";
      if (content === versions.feature) return "feature";
      return "both";
    });

  /**
   * The laptop screen: a miniature editor. A tab strip with the file name on
   * top, then welcome.txt as a gutter of line numbers and code lines, each
   * line in the colour of whoever wrote it. Geometry stays inside the glass
   * (z 0.46–2.56 above the laptop base).
   */
  function screenSvg(state) {
    const y = LAPTOP.y - 0.05;
    const left = LAPTOP.x + 0.26;
    const width = LAPTOP.w - 0.52;
    const muted = "color-mix(in srgb, var(--hw-lcd-ink) 34%, transparent)";
    const gutter = "color-mix(in srgb, var(--hw-lcd-ink) 22%, transparent)";
    const lines = lineKinds(state.working, versions);
    const conflict = lines.some((l) => l.kind === "marker");
    const color = { plain: muted, base: KIND_COLOR.base, main: KIND_COLOR.main, feature: KIND_COLOR.feature, both: KIND_COLOR.both, marker: KIND_COLOR.conflict };
    const widthOf = ({ text, kind }) => (kind === "marker" ? (text.startsWith("=") ? 0.7 : 1.0) : Math.min(2.8, 0.5 + [...text].length * 0.13));
    const step = conflict ? 0.17 : 0.34;
    const barH = conflict ? 0.1 : 0.15;
    const top = conflict ? 1.66 : 1.5;
    const tab = `${frontQuad({ x: left, y, z: 1.98, w: width, h: 0.58, fill: "rgb(255 255 255 / .05)" })}
      ${frontQuad({ x: left + 0.12, y, z: 1.98, w: 2.7, h: 0.5, fill: "rgb(255 255 255 / .1)" })}
      ${frontText({ x: left + 0.3, y, z: 2.23, text: "welcome.txt", size: 7.5, anchor: "start", fill: "var(--hw-lcd-ink)", weight: 600 })}`;
    const code = lines
      .map((line, i) => {
        const z = top - i * step;
        return frontQuad({ x: left + 0.2, y, z, w: 0.16, h: barH, fill: gutter }) + frontQuad({ x: left + 0.55, y, z, w: widthOf(line), h: barH, fill: color[line.kind] });
      })
      .join("");
    return tab + code;
  }

  const laptopDevice = laptop({ ...LAPTOP });
  const repoDevice = server({ ...REPO, label: "", lit: 1 });
  // The commit graph lies on a dark glass panel set into the server top.
  const graphGlass = pocket({ x: REPO.x + 0.45, y: REPO.y + 0.45, z: REPO_TOP, w: REPO.w - 0.9, d: REPO.d - 0.9, depth: 0.05, floor: "url(#hw-iso-lcd) var(--iso-glass)", wall: "var(--iso-glass)", lip: "rgb(255 255 255 / .55)" });
  const NOTES = {
    work: { x: LAPTOP.x + 1.2, y: LAPTOP.y - 0.2, z: 2.82, dx: -10, dy: -34, title: "작업 트리", sub: "working tree", cls: "git-callout-work" },
    index: { x: TRAY.x + 2.6, y: TRAY.y + TRAY.d, z: 0.2, dx: -6, dy: 42, title: "인덱스(스테이징)", sub: "stage 0 · 1 · 2 · 3", cls: "git-callout-index" },
    history: { x: REPO.x + 3.2, y: REPO.y + REPO.d, z: 0.4, dx: -8, dy: 84, title: "로컬 저장소", sub: ".git · 커밋 이력", cls: "git-callout-history" },
  };

  // Leaders lengthen as labelScale() grows the labels, so a label never
  // reaches the ref tags or cables next to its device.
  const notesAt = (kk) => Object.values(NOTES).map((n) => ({ ...n, dy: n.dy + (n.dy > 0 ? 30 : -12) * (kk - 1) }));
  const callouts = (kk) => notesAt(kk).map((n) => callout(n)).join("");

  host.innerHTML = `<svg viewBox="0 0 800 500" role="img" aria-label="작업 트리, 인덱스, 로컬 저장소 사이의 welcome.txt 흐름">
    ${defs()}
    ${floor({ x: -12, y: -10, w: 46, d: 34 })}
    ${Object.entries(CABLES).map(([id, points]) => cable(points, { id: `route-${id}`, width: id === "checkout" ? 5 : 6, pulse: true, cls: "git-cable" })).join("")}
    ${laptopDevice.svg}
    <g class="git-screen"></g>
    ${indexDevice.svg}
    ${repoDevice.svg}
    ${graphGlass}
    <g class="git-edges"></g>
    <g class="git-commits"></g>
    <g class="git-index-tokens">
      <g class="git-slot" data-index="single" style="transform:${translate(screen(INDEX_SLOT))}"></g>
      ${STAGES.map((stage) => `<g class="git-slot" data-stage="${stage.key}" style="transform:${translate(screen(stage.slot))}"></g>`).join("")}
    </g>
    <g class="git-callouts">${callouts(1)}</g>
    <g class="git-refs">
      <g class="git-ref" data-ref="main"><g class="git-k"></g></g>
      <g class="git-ref" data-ref="feature/title"><g class="git-k"></g></g>
      <g class="git-head"><g class="git-k"><rect x="-24" y="-10" width="48" height="20" rx="5" class="git-head-tag"/><text class="git-head-text" x="0" y="0.5">HEAD</text></g></g>
    </g>
    <g class="git-mover" data-mover="a" style="display:none"></g>
    <g class="git-mover" data-mover="b" style="display:none"></g>
    <g class="git-mover" data-mover="c" style="display:none"></g>
  </svg>`;

  const $ = (selector) => host.querySelector(selector);
  const $$ = (selector) => [...host.querySelectorAll(selector)];
  const svg = $("svg");
  const commitEl = (id) => $$("[data-commit]").find((el) => el.dataset.commit === id);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const desktop = matchMedia(desktopQuery);
  const phone = matchMedia("(max-width: 759px)");
  let active = null;
  let lastState = null;
  /** labelScale's factor, mirrored here so ref tags and their framing follow it. */
  let k = 1;

  /* ---------- framing ---------- */

  // Device footprints and tops, and the cable ends.
  const FRAME_POINTS = [
    [LAPTOP.x, LAPTOP.y - 0.22, 2.82], [LAPTOP.x + LAPTOP.w, LAPTOP.y - 0.22, 2.82], [LAPTOP.x, LAPTOP.y + LAPTOP.d, 0], [LAPTOP.x + LAPTOP.w, LAPTOP.y + LAPTOP.d, 0],
    [TRAY.x, TRAY.y, 0.62], [TRAY.x + TRAY_W, TRAY.y, 0.62], [TRAY.x, TRAY.y + TRAY.d, 0], [TRAY.x + TRAY_W, TRAY.y + TRAY.d, 0],
    [REPO.x, REPO.y, REPO_TOP], [REPO.x + REPO.w, REPO.y, REPO_TOP], [REPO.x, REPO.y + REPO.d, 0], [REPO.x + REPO.w, REPO.y + REPO.d, 0],
    ...Object.values(CABLES).flat().map(([x, y]) => [x, y, 0]),
  ];
  /** Callout label boxes and ref tag boxes in user units, at label factor kk. */
  function labelBoxes(kk) {
    const boxes = notesAt(kk).map((n) => {
      const [sx, sy] = project(n.x, n.y, n.z);
      const w = Math.max(n.title.length * 15, n.sub.length * 7.6) * kk;
      const lx = sx + n.dx;
      // The label scales about the end of its leader (see callout()).
      const ly = sy + n.dy;
      const box = n.dy > 12 ? [ly - 11.25 - 3 * kk, 38 * kk] : [ly + 25 - 41 * kk, 43 * kk];
      return [n.anchor === "end" ? lx - w : n.anchor === "start" ? lx : lx - w / 2, box[0], w, box[1]];
    });
    for (const [id, [col, lane]] of Object.entries(layout.nodes)) {
      const [sx, sy] = screen(node(id));
      if (lane === 0) boxes.push([sx - 60 * kk, sy - 80 * kk, 120 * kk, 80 * kk]);
      if (lane === 1 || col === 2) boxes.push([sx - 24 * kk, sy, (refWidth("feature/title") + 4) * kk, 90 * kk]);
    }
    return boxes;
  }
  function fit() {
    const rect = host.getBoundingClientRect();
    if (!rect.width) return;
    const fixed = desktop.matches ? 0 : phone.matches ? 1.5 : 1.7;
    const aspect = fixed || Math.max(0.6, rect.width / Math.max(1, rect.height));
    let kk = 1;
    let box;
    // A few passes: the labels' size depends on the scale, which depends on the frame.
    for (let i = 0; i < 3; i++) {
      box = fitScene(FRAME_POINTS, { stageAspect: aspect, fill: 0.94, pad: 4, labels: labelBoxes(kk) });
      const scale = rect.width / Number(box.split(" ")[2]);
      kk = Math.min(2.2, Math.max(1, 1 / scale));
    }
    if (svg.getAttribute("viewBox") !== box) svg.setAttribute("viewBox", box);
    if (Math.abs(kk - k) > 0.01) {
      k = kk;
      for (const g of $$(".git-k")) g.setAttribute("transform", `scale(${r2(k)})`);
      $(".git-callouts").innerHTML = callouts(k);
      if (lastState && !active) paintRefs(lastState);
    }
  }
  fit();
  labelScale(svg);
  new ResizeObserver(() => requestAnimationFrame(fit)).observe(host);
  // Ref pills are sized from the label font: re-measure once it has loaded.
  document.fonts?.ready.then(() => lastState && !active && paintRefs(lastState));

  /* ---------- painting a state ---------- */

  const placeOf = (branch) => (branch === "main" ? "above" : "below");
  const refPoint = (branch, state) => {
    const id = state.refs[branch];
    return id ? screen(node(id)) : null;
  };
  const headPoint = (state) => {
    const [x, y] = refPoint(state.currentBranch, state);
    const place = placeOf(state.currentBranch, state);
    const w = refWidth(state.currentBranch);
    if (place === "above") return [x, r2(y - 68 * k)];
    return [r2(x + (w / 2 - 24) * k), r2(y + 66 * k)];
  };

  function paintRefs(state) {
    for (const branch of ["main", "feature/title"]) {
      const el = $(`[data-ref="${branch}"]`);
      const point = refPoint(branch, state);
      el.style.display = point ? "" : "none";
      if (!point) continue;
      const place = placeOf(branch, state);
      const key = place + refWidth(branch);
      if (el.dataset.place !== key) {
        el.dataset.place = key;
        el.firstElementChild.innerHTML = refSvg(branch, place);
      }
      el.style.transform = translate(point);
    }
    $(".git-head").style.transform = translate(headPoint(state));
  }

  function paintIndex(state, stages = state.index.stages) {
    const single = $('[data-index="single"]');
    if (stages) {
      single.innerHTML = "";
      for (const { key } of STAGES) {
        const slot = $(`[data-stage="${key}"]`);
        const id = state.merge?.[key];
        slot.innerHTML = stages[key] && id ? token({ id, color: commitColor(state, id), ...SLOT_TOKEN }) : "";
      }
    } else {
      for (const { key } of STAGES) $(`[data-stage="${key}"]`).innerHTML = "";
      single.innerHTML = token({
        id: snapshotLabel(state.index.content, state.commits),
        color: KIND_COLOR[kindOf(state.index.content)],
        ...SLOT_TOKEN,
      });
    }
    // Occupancy LEDs under the slots: stage 0 in the accent while staged,
    // stages 1–3 in the conflict red while the file is unmerged.
    const unmerged = state.index.status === "unmerged" || Boolean(stages);
    const lit = [!stages && state.index.status === "staged", ...STAGES.map(({ key }) => Boolean(stages?.[key]))];
    for (const el of $$(".iso-tray-led")) {
      const i = Number(el.dataset.slot);
      el.classList.toggle("is-on", lit[i] && (i === 0 || unmerged));
      el.style.setProperty("--led", i === 0 ? "var(--accent)" : "var(--git-conflict)");
    }
  }

  function paintGraph(state) {
    const conflict = state.status === "conflict" || state.status === "resolved";
    const base = state.merge?.base;
    $(".git-edges").innerHTML = state.commits
      .flatMap((commit) =>
        commit.parents.map((parent, i) => {
          const cls = i === 0 && commit.branch === "main" ? "main" : "feature";
          const extra = `${conflict && parent === base ? " is-conflict" : ""}${commit.orphan ? " is-orphan" : ""}`;
          return floorPath([NODES[parent], NODES[commit.id]], { z: REPO_TOP, arrow: false, cls: `git-edge is-${cls}${extra}` });
        }),
      )
      .join("");
    $(".git-commits").innerHTML = state.commits
      .map(
        (commit) =>
          `<g class="git-slot${commit.orphan ? " is-orphan" : ""}" data-commit="${attr(commit.id)}" style="transform:${translate(screen(node(commit.id)))}">${token({ id: commit.id, color: commitColor(state, commit.id), ...COMMIT_TOKEN })}</g>`,
      )
      .join("");
  }

  function paint(state, { stages } = {}) {
    host.dataset.status = state.status;
    $(".git-screen").innerHTML = screenSvg(state);
    paintIndex(state, stages);
    paintGraph(state);
    paintRefs(state);
    lastState = state;
    for (const route of $$(".git-cable")) route.classList.remove("is-active", "is-conflict");
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
    el.innerHTML = token({ id: label, color, ...MOVER_TOKEN });
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
    switch: "브랜치가 가리키는 커밋에서 작업 트리와 인덱스를 함께 복원합니다.",
    merge: "Git이 공통 조상 C0, 현재 C2, 가져올 C1로 병합을 계산하고, 자동으로 합칠 수 없는 파일의 세 버전을 인덱스에 기록합니다.",
    "merge-ff": "가져올 커밋이 현재 브랜치의 끝에서 바로 이어집니다. 합칠 갈래가 없습니다.",
    "merge-commit": "Git이 공통 조상과 두 끝을 비교해 줄마다 바뀐 쪽을 고릅니다.",
    rebase: "feature/title의 커밋이 C0에서 바꾼 내용을 main의 끝 위에 다시 적용합니다.",
    resolve: "선택한 최종 문장으로 충돌 표시를 교체합니다.",
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
    const tip = state.refs[branch];
    paint(before);
    phase("request", step.command || step.title, requestBodies[step.action] ?? "", before);

    const restore = (id, color) =>
      Promise.all([
        travel(run, "a", [...outOfRepo(node(id)), INDEX_SLOT], { label: id, color }),
        travel(run, "b", repoToWork(node(id)), { label: id, color }),
      ]);

    if (step.action === "stage") {
      light("add");
      await travel(run, "a", [WORK_SLOT, ...ROUTES.add, INDEX_SLOT], {
        label: snapshotLabel(state.index.content, state.commits),
        color: KIND_COLOR[kindOf(state.working)],
      });
    } else if (step.action === "commit") {
      light("commit");
      await travel(run, "a", [INDEX_SLOT, ...intoRepo(node(tip))], { label: tip, color: commitColor(state, tip) });
    } else if (step.action === "switch") {
      light("commit", "checkout");
      await restore(tip, KIND_COLOR[kindOf(state.working)]);
    } else if (step.action === "merge-ff") {
      // No commit is made: the branch slides first, then its snapshot is checked out.
      await flipRefs(run, before, state);
      if (run.cancelled) return;
      paintRefs(state);
      light("commit", "checkout");
      await restore(tip, KIND_COLOR[kindOf(state.working)]);
    } else if (step.action === "merge-commit") {
      const [ours, theirs] = state.commits.find((c) => c.id === tip).parents;
      light("commit");
      await Promise.all([
        travel(run, "a", [...outOfRepo(node(ours)), INDEX_SLOT], { label: ours, color: commitColor(state, ours), scale: 0.8 }),
        travel(run, "b", [...outOfRepo(node(theirs)), INDEX_SLOT], { label: theirs, color: commitColor(state, theirs), scale: 0.8 }),
      ]);
      if (run.cancelled) return;
      phase("request", `${tip} · 부모 ${ours} + ${theirs}`, "합친 내용으로 병합 커밋을 만들고 작업 트리에도 펼칩니다.", before);
      light("add", "commit");
      await Promise.all([
        travel(run, "a", [INDEX_SLOT, ...intoRepo(node(tip))], { label: tip, color: commitColor(state, tip) }),
        travel(run, "b", [INDEX_SLOT, ...[...ROUTES.add].reverse(), WORK_SLOT], { label: tip, color: KIND_COLOR[kindOf(state.working)] }),
      ]);
    } else if (step.action === "rebase") {
      const replayed = state.commits.find((c) => c.id === tip);
      const from = node(replayed.replayOf);
      const to = node(tip);
      await travel(run, "a", [from, [from[0], from[1], from[2] + 1.2], [to[0], to[1], to[2] + 1.2], to], { label: tip, color: commitColor(state, tip) });
      if (run.cancelled) return;
      light("commit", "checkout");
      await restore(tip, KIND_COLOR[kindOf(state.working)]);
    } else if (step.action === "merge") {
      const stages = {};
      light("commit");
      const comparing = (partial) => ({ ...before, merge: state.merge, index: { status: "comparing", content: null, stages: partial } });
      paintIndex({ ...before, merge: state.merge }, {});
      for (const [i, { key, slot }] of STAGES.entries()) {
        const id = state.merge[key];
        phase("request", `${i + 1}/3 · ${stageNames[key]} ${id} → 인덱스 stage ${i + 1}`, `${stageNames[key]}의 파일 버전을 인덱스에 기록합니다.`, comparing({ ...stages }));
        await travel(run, "a", [...outOfRepo(node(id)), slot], {
          label: id,
          color: commitColor(state, id),
          scale: 0.8,
        });
        if (run.cancelled) return;
        stages[key] = state.index.stages[key];
        paintIndex({ ...before, merge: state.merge }, { ...stages });
      }
      phase("request", "충돌 표시 → 작업 트리", "버튼 줄은 C0에서 main만 바꿔 자동으로 합쳐졌습니다. 제목 줄은 양쪽이 다르게 바꿔 두 문장이 충돌 표시와 함께 파일에 들어갑니다.", comparing({ ...stages }));
      light("add:conflict");
      $("#route-commit").classList.remove("is-active");
      await travel(run, "a", [INDEX_SLOT, ...[...ROUTES.add].reverse(), WORK_SLOT], {
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

    const made = state.commits.length > before.commits.length ? state.commits.at(-1) : null;
    paint(state);
    phase(
      "apply",
      step.title,
      {
        merge: "자동 병합이 멈췄습니다. main은 여전히 C2를 가리키고, 새 커밋은 없습니다.",
        // Neutral on purpose: prediction 10 ("is it resolved now?") is asked right after.
        resolve: "작업 트리의 충돌 표시가 사라졌습니다.",
        commit: made?.parents.length === 2 ? `${made.id}는 ${made.parents.join("와 ")}을 부모로 갖습니다. main만 ${made.id}로 이동합니다.` : "",
        "merge-ff": `새 커밋 없이 포인터만 이동 · main → ${tip}`,
        "merge-commit": made ? `병합 커밋 ${made.id} · 부모 ${made.parents.join(" + ")}` : "",
        rebase: made ? `${made.id}의 부모는 ${made.parents[0]}입니다. 원래 ${made.replayOf}은 브랜치에서 빠졌습니다.` : "",
      }[step.action] ?? "",
      state,
    );
    const moves = step.action === "merge-ff" ? [] : [flipRefs(run, before, state)];
    if (made) {
      const el = commitEl(made.id);
      if (el) moves.push(animate(run, el, [{ opacity: 0.35 }, { opacity: 1 }], { duration: 420, easing: "ease-out" }));
    }
    await Promise.all(moves);
    if (run.cancelled) return;
    phase("complete", step.title, "", state);
    active = null;
  }

  return {
    update,
    cancel,
    kindOf,
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
