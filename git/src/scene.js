import "./scene.css";
import { indexMatchesHead } from "./engine.js";

const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const branchClass = (branch) =>
  branch === "feature/title" ? "feature" : "main";
const statusNames = {
  clean: "변경 없음",
  modified: "수정됨",
  staged: "스테이징됨",
  conflict: "충돌 1곳",
  resolved: "파일 수정 완료",
};
const commitNames = {
  C0: "처음 기록",
  C1: "기능 제목",
  C2: "메인 제목",
  C3: "병합 기록",
};
const fileIcon =
  '<svg viewBox="0 0 20 22" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 1h9l5 5v15H3Z M12 1v6h5 M6 11h8 M6 15h8"/></svg>';
const repoIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10"/></svg>';

function housing(x, y, width, height, depth = 12) {
  const rise = depth / Math.sqrt(3),
    bottom = y + height;
  return `<g><path class="gs-device-shadow" d="M${x + 5} ${y + 6}H${x + width + depth + 5}V${bottom + 6}H${x + 5}Z"/>
    <path class="gs-device-top" d="M${x} ${y}L${x + depth} ${y - rise}H${x + width + depth}L${x + width} ${y}Z"/>
    <path class="gs-device-side" d="M${x + width} ${y}L${x + width + depth} ${y - rise}V${bottom - rise}L${x + width} ${bottom}Z"/>
    <rect class="gs-device-front" x="${x}" y="${y}" width="${width}" height="${height}" rx="2"/></g>`;
}
function keyboard(x, y, width) {
  return `<path class="gs-device-top" d="M${x} ${y}H${x + width}L${x + width - 12} ${y + 20}H${x - 12}Z"/>
    <path class="gs-device-side" d="M${x - 12} ${y + 20}H${x + width - 12}L${x + width} ${y}V${y + 5}L${x + width - 12} ${y + 25}H${x - 12}Z"/>
    <path class="gs-keyboard" d="M${x + 10} ${y + 5}H${x + width - 18}l-6 10H${x + 4}Z"/>
    ${[0, 1].map((i) => `<path class="gs-key-line" d="M${x + 8 - i * 2} ${y + 8 + i * 4}H${x + width - 20 - i * 2}"/>`).join("")}
    ${[1, 2, 3, 4, 5, 6].map((i) => `<path class="gs-key-line" d="M${x + 10 + ((width - 28) * i) / 7} ${y + 5}l-6 10"/>`).join("")}`;
}
function fileLines(content, conflict = false, branch = "main") {
  return content
    .trimEnd()
    .split("\n")
    .map((line, i) => {
      const marker = /^(<<<<<<<|=======|>>>>>>>)/.test(line);
      const current = conflict && i === 2;
      const incoming = conflict && i === 4;
      const cls = marker
        ? "marker"
        : current
          ? "main-line"
          : incoming
            ? "feature-line"
            : line.startsWith("제목:")
              ? `${branchClass(branch)}-line`
              : "";
      return `<div class="gs-file-line ${cls}"><span>${i + 1}</span><b>${escape(line)}</b></div>`;
    })
    .join("");
}
const headline = (content) =>
  (content || "")
    .split("\n")
    .find((line) => line.startsWith("제목:"))
    ?.replace(/^제목:\s*/, "") || "";

const indexStages = [
  { key: "base", label: "공통 조상", branch: "main" },
  { key: "ours", label: "현재 main", branch: "main" },
  { key: "theirs", label: "병합 대상", branch: "feature/title" },
];
function indexVersion(state, { key, label }, number) {
  return `<div class="gs-index-version ${key}"><span>${number + 1} · ${label}<b>${state.merge[key]}</b></span><strong>${escape(headline(state.index.stages[key]))}</strong></div>`;
}

export function createGitScene(host, { onPhase = () => {} } = {}) {
  host.classList.add("git-scene");
  host.innerHTML = `<svg class="gs-decoration" aria-hidden="true"></svg>
    <div class="gs-callout"><span class="gs-phase-dot"></span><strong></strong></div>
    <section class="gs-repository" aria-label="로컬 저장소의 커밋 이력"><header>${repoIcon}<strong>로컬 저장소</strong><span class="gs-commit-count"></span></header>
      <div class="gs-graph"><svg class="gs-graph-edges" aria-hidden="true"></svg><div class="gs-commits"></div><div class="gs-ref main" data-ref="main"></div><div class="gs-ref feature" data-ref="feature/title"></div></div>
      <div class="gs-graph-caption"></div></section>
    <div class="gs-flow-guide"><span>파일 수정</span><b>→</b><span>git add</span><b>→</b><span>git commit</span></div>
    <section class="gs-work gs-device-card" aria-label="작업 파일"><header><span class="gs-zone-number">01</span><strong>작업 파일</strong><b class="gs-work-status"></b></header>
      <div class="gs-file-heading">${fileIcon}<b>welcome.txt</b><span>직접 편집</span></div><div class="gs-work-content"></div><p class="gs-work-note"></p></section>
    <section class="gs-index gs-device-card" aria-label="스테이징 영역"><header><span class="gs-zone-number">02</span><strong>스테이징</strong><b class="gs-index-status"></b></header><div class="gs-index-content"></div><p class="gs-index-note"></p></section>
    <svg class="gs-motion-layer" aria-hidden="true"><defs><marker id="gs-moving-arrow" viewBox="0 0 8 8" markerWidth="5" markerHeight="5" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="context-stroke"/></marker></defs><path class="gs-motion-wire"/><path class="gs-restore-wire"/></svg><div class="gs-restore-dot" aria-hidden="true" hidden></div><div class="gs-token" hidden>${fileIcon}<b></b></div>`;
  const $ = (selector) => host.querySelector(selector);
  const decoration = $(".gs-decoration"),
    edges = $(".gs-graph-edges"),
    token = $(".gs-token"),
    wire = $(".gs-motion-wire"),
    restoreWire = $(".gs-restore-wire"),
    restoreDot = $(".gs-restore-dot");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const stacked = matchMedia("(max-width: 1099px)");
  let layout,
    paintedState = null,
    active = null;

  function draw() {
    const width = Math.round(host.clientWidth),
      compact = width < 560;
    const left = compact ? 22 : 28,
      right = compact ? 24 : 32;
    const boardWidth = width - left - right;
    const zoneWidth = compact ? boardWidth : (boardWidth - 38) / 2;
    const work = {
      x: left,
      y: compact ? 312 : 338,
      // Leave a side lane between the index and the repository on phones.
      width: compact ? zoneWidth - 20 : zoneWidth,
      height: 236,
    };
    const index = {
      x: compact ? left : left + zoneWidth + 38,
      y: compact ? 612 : 338,
      width: zoneWidth,
      height: compact ? 226 : 236,
    };
    layout = {
      width,
      compact,
      left,
      boardWidth,
      work,
      index,
      graph: { x: left, y: 103, width: boardWidth, height: 168 },
      height: compact ? 866 : 620,
    };
    const graph = layout.graph;
    layout.nodes = {
      C0: { x: graph.width * 0.14, y: 80 },
      C1: { x: graph.width * 0.4, y: 112 },
      C2: { x: graph.width * 0.6, y: 50 },
      C3: { x: graph.width * 0.86, y: 80 },
    };
    host.dataset.compact = String(compact);
    host.style.height = `${layout.height}px`;
    for (const svg of [decoration, $(".gs-motion-layer")])
      svg.setAttribute("viewBox", `0 0 ${width} ${layout.height}`);
    decoration.innerHTML = `${housing(left - 7, 68, boardWidth + 14, 228, 12)}${housing(work.x - 7, work.y - 7, work.width + 14, work.height + 14, 12)}${keyboard(work.x - 7, work.y + work.height + 7, work.width + 14)}${housing(index.x - 7, index.y - 7, index.width + 14, index.height + 14, 12)}
      <path class="gs-index-slot" d="M${index.x + 8} ${index.y + index.height + 11}h${index.width - 16}"/>`;
    Object.assign($(".gs-repository").style, {
      left: `${left}px`,
      top: "74px",
      width: `${boardWidth}px`,
    });
    edges.setAttribute("viewBox", `0 0 ${graph.width} ${graph.height}`);
    for (const [name, box] of [
      ["work", work],
      ["index", index],
    ])
      Object.assign($(`.gs-${name}`).style, {
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
    if (paintedState) positionGraph(paintedState);
    active?.updatePath?.();
    if (active && !active.paused) active.frameTrip?.();
  }
  function referencePosition(branch, state) {
    const id = state.refs[branch],
      node = layout.nodes[id];
    if (!node) return null;
    const selected = state.currentBranch === branch;
    const width =
      branch === "main" ? (selected ? 99 : 58) : selected ? 146 : 112;
    const y =
      branch === "main"
        ? id === "C3" && layout.compact
          ? 0
          : node.y - 50
        : node.y + 30;
    return {
      x: Math.max(
        4,
        Math.min(layout.graph.width - width - 4, node.x - width / 2),
      ),
      y,
      connector:
        branch === "main"
          ? node.y - (layout.compact ? 24 : 25.5) - y - 23
          : y - node.y - (layout.compact ? 24 : 25.5),
      width,
    };
  }
  function positionGraph(state) {
    edges.innerHTML = state.commits
      .flatMap((commit) =>
        commit.parents.map((parent) => {
          const a = layout.nodes[parent],
            b = layout.nodes[commit.id];
          return `<path class="gs-history-edge ${commit.parents.length > 1 && parent === "C1" ? "feature" : branchClass(commit.branch)}" d="M${a.x} ${a.y}C${(a.x + b.x) / 2} ${a.y},${(a.x + b.x) / 2} ${b.y},${b.x} ${b.y}"/>`;
        }),
      )
      .join("");
    for (const commit of state.commits) {
      const point = layout.nodes[commit.id];
      Object.assign($(`[data-commit="${commit.id}"]`).style, {
        left: `${point.x}px`,
        top: `${point.y}px`,
      });
    }
    for (const branch of ["main", "feature/title"]) {
      const ref = $(`[data-ref="${branch}"]`),
        position = referencePosition(branch, state);
      ref.hidden = !position;
      if (!position) continue;
      const before = active && referencePosition(branch, active.before);
      if (before) {
        ref.style.setProperty("--ref-from-x", `${before.x - position.x}px`);
        ref.style.setProperty("--ref-from-y", `${before.y - position.y}px`);
      }
      ref.style.setProperty("--connector-height", `${position.connector}px`);
      ref.style.setProperty(
        "--anchor-x",
        `${layout.nodes[state.refs[branch]].x - position.x}px`,
      );
      Object.assign(ref.style, {
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${position.width}px`,
      });
    }
  }
  function snap(state, restoredFrom, frameRestore = false) {
    paintedState = state;
    host.dataset.status = state.status;
    $(".gs-commit-count").textContent = `${state.commits.length}개 커밋`;
    $(".gs-commits").innerHTML = state.commits
      .map((commit) => {
        const selected = state.refs[state.currentBranch] === commit.id;
        return `<div class="gs-commit ${commit.id === "C0" ? "base" : branchClass(commit.branch)}" data-commit="${commit.id}" data-current="${selected}" title="${escape(commit.message)} · ${commit.parents.length ? `부모 ${commit.parents.join(", ")}` : "최초 커밋"}"><strong>${commit.id}</strong><span>${commitNames[commit.id]}</span></div>`;
      })
      .join("");
    for (const branch of ["main", "feature/title"]) {
      const ref = $(`[data-ref="${branch}"]`);
      ref.innerHTML = `${state.currentBranch === branch ? '<b class="gs-head-tag">HEAD</b><span class="gs-head-arrow">→</span>' : ""}<strong>${branch}</strong>`;
      ref.dataset.current = String(state.currentBranch === branch);
    }
    positionGraph(state);
    $(".gs-graph-caption").innerHTML = state.merge
      ? '<b class="gs-warning-text">병합 진행 중</b><span>main은 C2 그대로 · 아직 새 커밋 없음</span>'
      : state.refs.main === "C3"
        ? "<b>부모 2개: C2 + C1</b><span>main → C3 · feature/title → C1 유지</span>"
        : `<b>HEAD → ${state.currentBranch}</b><span>연결선은 부모 관계 · 네모는 저장된 기록</span>`;
    const registered = state.merge && state.index.status === "staged";
    $(".gs-work-status").textContent = registered ? "해결 등록 완료" : statusNames[state.status];
    $(".gs-work-content").innerHTML = fileLines(
      state.working,
      state.status === "conflict",
      state.currentBranch,
    );
    $(".gs-work-note").textContent = {
      clean: "HEAD 커밋과 같은 파일",
      modified: "편집한 내용 · 아직 git add 전",
      staged: "스테이징과 같은 내용 · 커밋 전",
      conflict: "두 문장 사이에서 최종 내용을 결정하세요",
      resolved: "표시를 지웠어도 인덱스는 아직 미해결",
    }[state.status];
    $(".gs-index-status").textContent =
      state.index.status === "unmerged"
        ? "미해결"
        : registered ? "해결 등록 완료"
        : state.index.status === "staged"
          ? "커밋 준비"
          : "커밋과 동일";
    if (state.index.status === "unmerged") {
      $(".gs-index-content").innerHTML =
        `<div class="gs-unmerged-heading">충돌 중에는 세 버전을 보관합니다</div>${indexStages
          .map((stage, i) => indexVersion(state, stage, i))
          .join("")}`;
      $(".gs-index-note").textContent =
        state.status === "resolved"
          ? "git add로 해결 내용을 인덱스에 기록"
          : "아직 커밋할 한 가지 내용이 아님";
    } else {
      const stamp = registered
        ? `HEAD(C2)와 다른 파일 ${indexMatchesHead(state) ? 0 : 1}개`
        : state.index.status === "staged" ? "이 내용으로 커밋합니다" : "새로 커밋할 변경 없음";
      $(".gs-index-content").innerHTML =
        `<div class="gs-file-heading">${fileIcon}<b>welcome.txt</b><span>${state.index.status === "staged" ? "다음 커밋" : state.refs[state.currentBranch]}</span></div><div class="gs-staged-file">${fileLines(state.index.content, false, state.currentBranch)}</div><div class="gs-index-stamp">${stamp}</div>`;
      $(".gs-index-note").textContent =
        state.index.status === "staged"
          ? "git commit 전까지 브랜치 위치는 그대로"
          : "커밋 뒤에도 파일 스냅샷을 유지합니다";
    }
    $(".gs-index").dataset.status = state.index.status;
    $(".gs-work").dataset.status = state.status;
    if (restoredFrom) {
      $(`[data-commit="${restoredFrom}"]`).dataset.reading = "true";
      for (const row of host.querySelectorAll(".gs-file-line.main-line, .gs-file-line.feature-line")) {
        row.insertAdjacentHTML("beforeend", `<small class="gs-restore-source">${escape(restoredFrom)} 복원</small>`);
      }
      if (frameRestore && stacked.matches) {
        const origin = host.getBoundingClientRect().top;
        const first = $(".gs-work .gs-restore-source").getBoundingClientRect().top - origin;
        const last = $(".gs-index .gs-restore-source").getBoundingClientRect().bottom - origin;
        showSceneRange(first - 12, last + 12);
      }
    }
  }
  function phase(kind, title, body, state) {
    $(".gs-callout strong").textContent = title;
    $(".gs-callout").dataset.kind = kind;
    onPhase({ kind, title, body, state });
  }
  function cancel() {
    if (active) {
      active.cancelled = true;
      for (const animation of active.animations) animation.cancel();
    }
    active = null;
    token.hidden = true;
    wire.removeAttribute("data-active");
    restoreWire.removeAttribute("data-active");
    restoreDot.hidden = true;
    host
      .querySelectorAll("[data-reading]")
      .forEach((element) => delete element.dataset.reading);
  }
  async function animate(run, element, frames, options) {
    const animation = element.animate(frames, options);
    run.animations.add(animation);
    if (run.paused) animation.pause();
    await animation.finished.catch(() => {});
    run.animations.delete(animation);
  }
  function anchorPoint(id) {
    const p = layout.nodes[id];
    if (p) return { x: layout.graph.x + p.x, y: layout.graph.y + p.y };
    const box = layout[id];
    return { x: box.x + box.width / 2, y: box.y + 18 };
  }
  function showSceneRange(top, bottom) {
    if (!stacked.matches) return;
    const origin = host.getBoundingClientRect().top;
    if (origin + top >= 12 && origin + bottom <= innerHeight - 12) return;
    window.scrollBy({ top: origin + (top + bottom - innerHeight) / 2, behavior: "instant" });
  }
  async function travel(run, source, destination, label, branch, pace, restoreBoth = false) {
    let top, bottom;
    const indexCommit = source === "index" && destination in layout.nodes;
    const graphToIndex = source in layout.nodes && destination === "index";
    run.updatePath = () => {
      const from = anchorPoint(source), to = anchorPoint(destination);
      const bend = from.y < 290 || to.y < 290 ? 303 : layout.compact ? 590 : from.y;
      const useLane = layout.compact && (indexCommit || graphToIndex);
      let path = from.y === to.y
        ? `M${from.x} ${from.y}H${to.x}`
        : `M${from.x} ${from.y}V${bend}H${to.x}V${to.y}`;
      if (useLane) {
        const lane = layout.width - 15;
        const port = layout.index.x + layout.index.width;
        path = indexCommit
          ? `M${port} ${from.y}H${lane}V${to.y}H${to.x}`
          : `M${from.x} ${from.y}H${lane}V${to.y}H${port}`;
      } else if (layout.compact && (source === "work" && destination === "index" || source === "index" && destination === "work")) {
        const x = layout.work.x + layout.work.width * 0.68;
        const filePort = layout.work.y + layout.work.height + 8;
        const indexPort = layout.index.y - 5;
        path = source === "work" ? `M${x} ${filePort}V${indexPort}` : `M${x} ${indexPort}V${filePort}`;
      }
      token.toggleAttribute("data-lane", Boolean(useLane));
      token.querySelector("b").textContent = useLane ? (indexCommit ? destination : source) : label;
      wire.setAttribute("d", path);
      token.style.offsetPath = `path("${path}")`;
      top = Math.min(from.y, to.y) - 32;
      bottom = Math.max(from.y, to.y) + 32;
      if (restoreBoth) {
        const index = anchorPoint("index");
        const side = layout.index.x + layout.index.width;
        const route = layout.compact
          ? `M${from.x} ${from.y}V${bend}H${side + 13}V${index.y}H${side}`
          : `M${from.x} ${from.y}V${bend}H${index.x}V${index.y}`;
        restoreWire.setAttribute("d", route);
        restoreDot.style.offsetPath = `path("${route}")`;
      }
    };
    run.updatePath();
    wire.dataset.active = "true";
    const color = branch === "feature/title" ? "var(--feature)" : "var(--main)";
    wire.style.setProperty("--traveler", color);
    token.style.setProperty("--traveler", color);
    token.hidden = false;
    if (restoreBoth) {
      restoreWire.dataset.active = "true";
      restoreDot.hidden = false;
    }
    let followFrame;
    const follow = () => {
      if (run.paused || run.cancelled) return;
      const rect = token.getBoundingClientRect();
      const delta = rect.top < 12 ? rect.top - 12 : Math.max(0, rect.bottom - innerHeight + 12);
      if (delta) window.scrollBy({ top: delta, behavior: "instant" });
      followFrame = requestAnimationFrame(follow);
    };
    run.frameTrip = () => {
      cancelAnimationFrame(followFrame);
      if (!stacked.matches) return;
      if (layout.height - 74 <= innerHeight - 24) {
        showSceneRange(62, layout.height - 12);
      } else if (bottom - top <= innerHeight - 24) {
        showSceneRange(top, bottom);
      } else {
        followFrame = requestAnimationFrame(follow);
      }
    };
    run.frameTrip();
    const frames = [
      { offsetDistance: "0%", opacity: 0 },
      { offset: 0.025, offsetDistance: "2.5%", opacity: 1 },
      { offset: 0.975, offsetDistance: "97.5%", opacity: 1 },
      { offsetDistance: "100%", opacity: 0 },
    ];
    const timing = {
      duration: (430 + Math.min(wire.getTotalLength(), 550) * 0.95) * pace,
      easing: "ease-in-out",
    };
    const flight = animate(run, token, frames, timing);
    if (restoreBoth) await Promise.all([flight, animate(run, restoreDot, frames, timing)]);
    else await flight;
    cancelAnimationFrame(followFrame);
    run.frameTrip = null;
    run.updatePath = null;
    if (!run.cancelled) {
      token.hidden = true;
      wire.removeAttribute("data-active");
      restoreWire.removeAttribute("data-active");
      restoreDot.hidden = true;
    }
  }
  async function update(step, { animate: motion = false, speed = 1 } = {}) {
    cancel();
    const restoredFrom = step.action === "switch" ? step.state.refs[step.state.currentBranch] : null;
    host.dataset.action = step.action;
    host.toggleAttribute("data-switching", Boolean(restoredFrom));
    if (!motion || step.index === 0 || reduced.matches) {
      snap(step.state, restoredFrom, motion);
      if (motion && step.action === "commit") showSceneRange(layout.graph.y - 29, layout.graph.y + layout.graph.height + 20);
      if (motion && step.action === "merge") showSceneRange(layout.work.y, layout.work.y + layout.work.height);
      phase("complete", step.title, "", step.state);
      return;
    }
    const run = { before: step.before, cancelled: false, paused: false, animations: new Set() };
    active = run;
    const pace = 1 / speed;
    snap(step.before);
    const branch = step.state.currentBranch;
    phase(
      "request",
      step.command || step.title,
      {
        branch: "브랜치는 새 커밋이 아니라, 기존 커밋을 가리키는 이름입니다.",
        edit: "작업 파일을 고칩니다. 저장된 커밋과 인덱스는 아직 바뀌지 않습니다.",
        stage: "작업 파일의 현재 내용을 인덱스에 기록합니다.",
        commit: "인덱스의 내용으로 새 커밋을 만들고 현재 브랜치를 옮깁니다.",
        switch: `${branch}이 가리키는 ${restoredFrom}에서 작업 파일과 스테이징을 함께 복원합니다.`,
        merge: "공통 조상 C0, 현재 C2, 병합 대상 C1을 함께 비교합니다.",
        resolve:
          "선택한 최종 문장으로 충돌 표시를 교체합니다. 아직 git add 전입니다.",
      }[step.action] || "",
      step.before,
    );
    if (step.action === "stage") {
      await travel(
        run,
        "work",
        "index",
        "파일 내용",
        branch,
        pace,
      );
    } else if (step.action === "commit") {
      const id = step.state.refs[branch];
      await travel(
        run,
        "index",
        id,
        "새 커밋",
        branch,
        pace,
      );
    } else if (step.action === "switch") {
      $(`[data-commit="${restoredFrom}"]`).dataset.reading = "true";
      await travel(
        run,
        restoredFrom,
        "work",
        `${restoredFrom} 복원`,
        branch,
        pace,
        true,
      );
    } else if (step.action === "merge") {
      const content = $(".gs-index-content");
      const comparing = { ...step.before, index: { status: "comparing" } };
      content.innerHTML = '<div class="gs-unmerged-heading">같은 제목 줄의 세 버전</div>';
      $(".gs-index-status").textContent = "세 버전 대조 중";
      $(".gs-index-note").textContent = "저장소에서 각 버전의 제목을 가져옵니다";
      for (const [i, stage] of indexStages.entries()) {
        const id = step.state.merge[stage.key];
        const commit = $(`[data-commit="${id}"]`);
        commit.dataset.reading = "true";
        phase("request", `${i + 1}/3 · ${stage.label} ${id} → 인덱스`, `${stage.label}의 제목을 인덱스에서 대조합니다.`, comparing);
        await travel(
          run,
          id,
          "index",
          `${id} · ${stage.label}`,
          stage.branch,
          pace * 0.8,
        );
        if (run.cancelled) return;
        delete commit.dataset.reading;
        content.insertAdjacentHTML("beforeend", indexVersion(step.state, stage, i));
      }
      phase("request", "충돌 표식 → 작업 파일", "같은 줄의 변경이 겹칩니다. 두 문장과 충돌 표식을 작업 파일에서 확인하세요.", comparing);
      await travel(run, "index", "work", "충돌 표식", branch, pace * 0.8);
    } else {
      const element =
        step.action === "branch" ? $(".gs-repository") : $(".gs-work-content");
      const focusBox = step.action === "branch" ? layout.graph : layout.work;
      showSceneRange(focusBox.y, focusBox.y + focusBox.height);
      await animate(
        run,
        element,
        [{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }],
        { duration: 650 * pace, easing: "ease-in-out" },
      );
    }
    if (run.cancelled) return;
    const refsBefore = Object.fromEntries(
      ["main", "feature/title"].map((name) => [
        name,
        referencePosition(name, step.before),
      ]),
    );
    snap(step.state, restoredFrom, true);
    if (step.action === "commit") showSceneRange(layout.graph.y - 29, layout.graph.y + layout.graph.height + 20);
    if (step.action === "merge") showSceneRange(layout.work.y, layout.work.y + layout.work.height);
    phase(
      "apply",
      step.title,
      step.action === "merge"
        ? "같은 줄을 다르게 바꿔 자동 병합이 멈췄습니다. main은 여전히 C2입니다."
        : step.action === "resolve"
          ? "작업 파일은 수정했지만 인덱스에는 아직 세 버전이 남아 있습니다."
          : step.action === "commit" &&
              step.state.merge === null &&
              step.index === 12
            ? "C3은 C2와 C1을 부모로 갖습니다. main만 C3으로 이동하고 feature/title은 C1에 남습니다."
            : "",
      step.state,
    );
    const flips = [];
    for (const name of ["main", "feature/title"]) {
      const before = refsBefore[name],
        after = referencePosition(name, step.state);
      if (before && after && (before.x !== after.x || before.y !== after.y))
        flips.push(
          animate(
            run,
            $(`[data-ref="${name}"]`),
            [
              {
                transform: "translate(var(--ref-from-x), var(--ref-from-y))",
              },
              { transform: "translate(0,0)" },
            ],
            { duration: 500 * pace, easing: "ease-in-out" },
          ),
        );
    }
    if (step.action === "commit") {
      const commit = $(`[data-commit="${step.state.refs[branch]}"]`);
      flips.push(
        animate(
          run,
          commit,
          [
            { opacity: 0.2, scale: 0.75 },
            { opacity: 1, scale: 1 },
          ],
          { duration: 500 * pace, easing: "ease-out" },
        ),
      );
    }
    if (!flips.length)
      flips.push(
        animate(
          run,
          step.action === "stage" ? $(".gs-index") : $(".gs-callout"),
          [{ opacity: 0.6 }, { opacity: 1 }],
          { duration: 450 * pace },
        ),
      );
    await Promise.all(flips);
    if (run.cancelled) return;
    phase("complete", step.title, "", step.state);
    active = null;
  }
  draw();
  new ResizeObserver(() => {
    if (Math.abs(host.clientWidth - layout.width) < 1) return;
    draw();
  }).observe(host);
  return {
    update,
    cancel,
    pause() {
      if (active) {
        active.paused = true;
        active.animations.forEach((animation) => animation.pause());
      }
    },
    resume() {
      if (active) {
        active.paused = false;
        active.frameTrip?.();
        active.animations.forEach((animation) => animation.play());
      }
    },
  };
}
