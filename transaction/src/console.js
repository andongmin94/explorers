// Console shared by both transaction pages: header, deck, footer markup,
// the event player (play/pause, step, seek, speed, guided stops) and the
// common bindings (keyboard, theme, record tabs, dialogs).
import { bindSliders, icon, syncSlider } from "../../shared/hw.js";
import { paginate, plateTabs } from "../../shared/fit.js";
import { createProgress } from "../../shared/lesson-kit.js";
import { mountRail, nextLesson, progressIdFor } from "../../shared/lesson-rail.js";
import { EXPLORER, LESSONS, RAIL_TITLE, lessonById, lessonNumber } from "./lessons.js";

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const escape = (s) =>
  String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
/** A transaction id printed in its colour with its LED. */
export const tx = (id) => `<span class="tx-id" style="--led:var(--${id.toLowerCase()})"><span class="hw-led is-on"></span>${id}</span>`;
export const pad = (n) => String(n).padStart(2, "0");
/**
 * SQL for the 이번 사건 block: each clause (SET, WHERE, FROM, ...) is one
 * inline block, so a long statement wraps between clauses ("... SET stock =
 * stock - 1 / WHERE id = 1;") instead of inside an expression.
 */
export const sqlHtml = (sql) =>
  String(sql)
    .split(/ (?=(?:SET|WHERE|FROM|VALUES|ORDER BY|FOR UPDATE|FOR SHARE|ISOLATION LEVEL)\b)/)
    .map((part) => `<span class="tx-clause">${escape(part)}</span>`)
    .join(" ");

const THEME_KEY = "transaction-theme";
// 처음으로 (jump to event 0) draws a bar and a chevron so it never reads as the
// circular 이번 사건 다시 보기 (replay) key next to it.
const TO_START = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M17 5l-7 7 7 7"/></svg>';

/**
 * The top bar. The lesson rail (mountLessonRail) adds its drawer key in
 * front; the context names the lesson: "NN 레슨" + its title.
 */
export function topbar({ lessonId, compare = false }) {
  const lesson = lessonById(lessonId);
  return `<header class="hw-topbar">
    <div class="hw-brand"><h1>트랜잭션 탐색기</h1><p>보면서 이해하는 데이터베이스</p></div>
    <div class="hw-context"><span class="hw-label"><span class="hw-index">${lessonNumber(lessonId)}</span> 레슨</span><strong>${lesson.title}</strong></div>
    <div class="hw-actions">
      ${compare ? `<button class="hw-key hw-key--sm" data-action="compare">${icon("compare")}<span>두 방식 비교</span></button>` : ""}
      <button class="hw-key hw-key--sm hw-key--icon" data-action="theme" aria-label="어두운 테마로 전환">${icon("moon")}</button>
    </div>
  </header>`;
}

export function stage({ label, sceneId, total, tag = "READ COMMITTED" }) {
  return `<section class="hw-plate hw-stage" aria-labelledby="stage-label">
    <div class="hw-plate-head">
      <span class="hw-label" id="stage-label"><span class="hw-index">A</span> ${label}</span>
      <span class="hw-tag" id="stage-tag">${tag}</span>
      <span class="hw-lcd" aria-hidden="true"><span id="step-count">00</span><small>/ ${pad(total)} 사건</small></span>
    </div>
    <div class="hw-scene" id="${sceneId}"></div>
    <div class="hw-plate-foot"><span class="hw-led" id="status-led"></span><span id="status" aria-live="polite"></span></div>
  </section>`;
}

export function deck({ total, before = "" }) {
  return `<section class="hw-plate hw-deck" aria-label="재생 조작">
    ${before}
    <div class="hw-field">
      <span class="hw-label">재생</span>
      <div class="hw-transport">
        <button class="hw-key hw-key--icon" data-action="reset" aria-label="처음으로">${TO_START}</button>
        <button class="hw-key hw-key--icon" data-action="back" aria-label="이전 사건">${icon("back")}</button>
        <button class="hw-key hw-key--accent tx-play" data-action="play">${icon("play")}<span>학습 시작</span></button>
        <button class="hw-key" data-action="next">다음 사건${icon("next")}</button>
        <button class="hw-key hw-key--icon" data-action="replay" aria-label="이번 사건 다시 보기" disabled>${icon("replay")}</button>
        <button class="hw-key hw-key--icon tx-num" data-action="speed" aria-label="재생 속도 1배, 눌러서 변경">1×</button>
      </div>
    </div>
    <div class="hw-seek">
      <span class="hw-label">0</span>
      <input class="hw-slider" id="seek" type="range" min="0" max="${total}" value="0" step="1" aria-label="처리한 사건 수" />
      <span class="hw-label">${total}</span>
    </div>
    <button class="hw-switch" role="switch" aria-checked="true" data-action="guided">핵심 장면에서 멈추기</button>
  </section>`;
}

export function recordsHead(tabs) {
  return `<div class="hw-plate-head">
    <div class="hw-tabs" role="tablist" aria-label="관찰 기록">${tabs
      .map(
        ([id, label], i) =>
          `<button id="tab-${id}" role="tab" aria-selected="${i === 0}" aria-controls="record-${id}" data-record="${id}"${i ? ' tabindex="-1"' : ""}>${label}</button>`,
      )
      .join("")}</div>
    <span class="hw-label tx-hint">기록을 눌러 그 사건으로 이동</span>
  </div>`;
}

/** The side plate's head: its label and the tabs that switch its panels. */
export function sideHead(tabs) {
  return `<div class="hw-plate-head">
    <span class="hw-label" id="lesson-label"><span class="hw-index">B</span> 학습</span>
    <div class="hw-tabs" role="tablist" aria-label="학습 패널">${tabs
      .map(([id, label], i) => `<button type="button" id="side-tab-${id}" data-tab="${id}" aria-controls="side-${id}" aria-selected="${i === 0}">${label}</button>`)
      .join("")}</div>
  </div>`;
}

/** One side panel: a fill list that is split into pages, plus what stays under it. */
export const sidePanel = (id, list, after = "") =>
  `<div class="hw-plate-body hw-fit" id="side-${id}" data-panel="${id}" aria-labelledby="side-tab-${id}">${list}${after}</div>`;

/**
 * Wire the side plate: tabs, and a pager for each fill list. refresh(id) re-fits
 * a list after its content changed; with reset it shows the first page, with
 * item the page that holds that element.
 */
export function createSide() {
  const side = $(".hw-side");
  const pagers = new Map($$(".hw-fill", side).map((list) => [list.id, paginate(list, { label: "쪽" })]));
  plateTabs(side);
  return {
    refresh(id, { reset = false, item = null } = {}) {
      const pager = pagers.get(id);
      if (!pager) return;
      pager.refresh();
      if (item) pager.showItem(item);
      else if (reset) pager.show(0);
    },
  };
}

/**
 * Records tables never scroll: show the rows that fit the box, around the
 * current row (a little history before it, the rest after). Like
 * shared/fit.js rowWindow, but it measures every row (rows differ in height
 * here) and leaves the table whole on narrow screens, where the page scrolls.
 */
export function followRows(box, { before = 0.4, current = (tbody) => tbody.querySelector('tr[aria-current="true"]') } = {}) {
  const desktop = matchMedia("(min-width: 1100px) and (min-height: 700px)");
  function refresh() {
    const tbody = box.querySelector("tbody");
    if (!tbody) return;
    const rows = [...tbody.rows];
    rows.forEach((r) => (r.hidden = false));
    if (!rows.length || !desktop.matches || !box.clientHeight || box.scrollHeight <= box.clientHeight + 1) return;
    const heights = rows.map((r) => r.getBoundingClientRect().height);
    const total = heights.reduce((a, b) => a + b, 0);
    const room = box.clientHeight - (box.scrollHeight - total) - 2;
    const cur = current(tbody);
    // Before the first event nothing is current: show the table from its top.
    const at = cur && rows.includes(cur) ? rows.indexOf(cur) : 0;
    let start = at;
    let end = at;
    let used = heights[at];
    for (;;) {
      const wantBefore = start > 0 && (at - start < before * (end - start + 2) || end === rows.length - 1);
      const i = wantBefore ? start - 1 : end + 1;
      if (i < 0 || i >= rows.length || used + heights[i] > room) break;
      used += heights[i];
      if (wantBefore) start = i;
      else end = i;
    }
    rows.forEach((r, i) => (r.hidden = i < start || i > end));
    // Safety net for rounding: drop rows from the end farther from the current one.
    while (box.scrollHeight > box.clientHeight + 1 && end > start) {
      if (end - at >= at - start) rows[end--].hidden = true;
      else rows[start++].hidden = true;
    }
  }
  new ResizeObserver(() => requestAnimationFrame(refresh)).observe(box);
  desktop.addEventListener("change", refresh);
  return { refresh };
}

/**
 * 정리 (shared/lesson-kit.js recapHtml) mounted as items of a paged 해설 list:
 * each section is its own item, and each recall answer (the `why`) is a
 * separate item after its question so an answered question never outgrows a
 * page. show(false) takes it out again; the progress line follows progress.
 */
export function createRecap(host, { id, recap, progress, side, recapHtml, bindRecap, progressHtml, next = null }) {
  progress.onChange((summary) => {
    const line = $(".tx-recap .hw-progress", host);
    if (line) line.outerHTML = progressHtml(summary);
  });
  return {
    show(on) {
      const parts = $$(".tx-recap", host);
      if (!on) {
        for (const el of parts) el.remove();
        return;
      }
      if (parts.length) return;
      const t = document.createElement("template");
      t.innerHTML = recapHtml({ id, ...recap, progress, next: next ?? undefined });
      const items = [...t.content.firstElementChild.children];
      for (const el of items) el.classList.add("tx-recap");
      host.append(...items);
      bindRecap(host, {
        recall: recap.recall,
        progress,
        onAnswer(q) {
          const why = $(`[data-recall="${q.id}"]`, host).nextElementSibling;
          why.classList.remove("tx-off");
          side.refresh(host.id, { item: why });
        },
      });
      // The pager un-hides its direct items, so a pending answer is .tx-off, not [hidden].
      for (const why of $$(".hw-recall-why", host)) {
        why.hidden = false;
        why.classList.add("tx-recap", "tx-off");
        why.closest("[data-recall]").after(why);
      }
    },
  };
}

/** Progress of one lesson, under its own id (progressIdFor). */
export function lessonProgress(lessonId, { scenes, recall }) {
  return createProgress(progressIdFor(EXPLORER, LESSONS, lessonId), { scenes, recall });
}

/** The lesson rail on the left (a drawer below 1280px), following progress. */
export function mountLessonRail(lessonId, progress) {
  const rail = mountRail({ explorer: EXPLORER, title: RAIL_TITLE, lessons: LESSONS, current: lessonId });
  rail.watch(progress);
  return rail;
}

/** 정리 links on to the next lesson; the last one gets null (next experiment). */
export const nextLessonOf = (lessonId) => nextLesson(LESSONS, lessonId);

export function footer(sources) {
  return `<footer class="hw-footer">
    <span>조작: <kbd>Space</kbd> 재생·정지 <kbd>←</kbd><kbd>→</kbd> 사건 이동 <kbd>R</kbd> 처음으로</span>
    <span>학습 근거 ${sources.map((s) => `<a href="${s.url}" target="_blank" rel="noreferrer">${s.title} ↗</a>`).join(" · ")}</span>
  </footer>`;
}

export const dialogHead = (label) =>
  `<div class="hw-plate-head"><span class="hw-label">${label}</span><button class="hw-key hw-key--sm hw-key--icon" data-action="close" aria-label="닫기">${icon("close")}</button></div>`;

/**
 * The event player. steps() returns the current run's steps; render() repaints
 * the page from player.state; stopAt(index) says where guided play halts.
 */
export function createPlayer({ steps, scene, render, stopAt }) {
  const s = { index: 0, done: 0, busy: false, playing: false, paused: false, autoAdvance: false, guided: true, speed: 1, revision: 0, timer: null };
  const last = () => steps().length - 1;

  function pause() {
    s.playing = false;
    clearTimeout(s.timer);
    s.timer = null;
    s.paused = s.busy;
    scene.pause();
    render();
  }
  function schedule() {
    clearTimeout(s.timer);
    if (s.playing && !s.busy && s.index < last()) s.timer = setTimeout(() => move(s.index + 1, true), 520 / s.speed);
  }
  async function move(next, motion = false) {
    const token = ++s.revision;
    clearTimeout(s.timer);
    s.index = Math.max(0, Math.min(last(), next));
    s.busy = motion;
    s.autoAdvance = s.playing;
    s.paused = false;
    render();
    await scene.update(steps()[s.index], steps()[s.done], { animate: motion, speed: s.speed });
    if (token !== s.revision) return;
    s.done = s.index;
    s.busy = false;
    s.paused = false;
    if (s.index === last() || (s.playing && s.guided && stopAt(s.index))) s.playing = false;
    render();
    schedule();
  }
  function jump(next) {
    pause();
    return move(next, false);
  }
  function play() {
    if (s.playing || (s.busy && !s.paused)) return pause();
    if (s.done === last() && !s.busy) {
      s.done = 0;
      s.index = 0;
      scene.update(steps()[0], null, { animate: false });
    }
    s.playing = !s.busy || s.autoAdvance;
    s.paused = false;
    scene.resume();
    render();
    schedule();
  }
  async function replay() {
    const target = s.index;
    pause();
    await move(target - 1, false);
    await move(target, true);
  }
  function restart() {
    pause();
    s.revision++;
    s.index = 0;
    s.done = 0;
    s.busy = false;
    s.paused = false;
    scene.update(steps()[0], null, { animate: false });
    render();
  }
  function next() {
    pause();
    return move(s.index + 1, true);
  }
  function cycleSpeed() {
    s.speed = s.speed === 1 ? 2 : s.speed === 2 ? 0.5 : 1;
    scene.setSpeed(s.speed);
    schedule();
  }
  return { state: s, last, pause, move, jump, play, replay, restart, next, cycleSpeed };
}

/** Sync the deck, stage counter and play key with the player state. */
export function syncControls(player, { sceneEl, status }) {
  const s = player.state;
  const last = player.last();
  const moving = s.playing || (s.busy && !s.paused);
  const play = $('[data-action="play"]');
  play.innerHTML = `${icon(moving ? "pause" : "play")}<span>${moving ? "일시정지" : s.done === last && !s.busy ? "다시 재생" : s.index === 0 ? "학습 시작" : "이어서 재생"}</span>`;
  play.setAttribute("aria-label", moving ? "일시정지" : "재생");
  $('[data-action="back"]').disabled = s.index === 0;
  $('[data-action="next"]').disabled = s.index === last || s.busy;
  $('[data-action="replay"]').disabled = s.index === 0 || s.busy;
  $('[data-action="guided"]').setAttribute("aria-checked", String(s.guided));
  const speed = $('[data-action="speed"]');
  speed.textContent = `${s.speed}×`;
  speed.setAttribute("aria-label", `재생 속도 ${s.speed}배, 눌러서 변경`);
  const seek = $("#seek");
  seek.value = s.index;
  seek.setAttribute("aria-valuetext", `${s.index} / ${last}번째 사건${s.busy ? " 처리 중" : " 처리 완료"}`);
  syncSlider(seek);
  $("#step-count").textContent = pad(s.index);
  sceneEl.setAttribute("aria-busy", String(s.busy));
  $("#status-led").classList.toggle("is-on", s.busy);
  if (status) $("#status").textContent = status;
}

export function selectRecord(name) {
  for (const b of $$("[data-record]")) {
    const selected = b.dataset.record === name;
    b.setAttribute("aria-selected", String(selected));
    b.tabIndex = selected ? 0 : -1;
  }
  for (const panel of $$("[data-record-panel]")) panel.hidden = panel.dataset.recordPanel !== name;
}

/** Wire everything both pages share. onAction handles page-specific actions. */
export function bindConsole(player, { guard, onAction = () => false, refresh }) {
  bindSliders(document);
  const s = player.state;
  document.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    if (onAction(button, e)) return;
    if (button.dataset.seek) {
      player.jump(Number(button.dataset.seek));
      return;
    }
    if (button.dataset.record) {
      selectRecord(button.dataset.record);
      return;
    }
    switch (button.dataset.action) {
      case "play":
        player.play();
        break;
      case "replay":
        player.replay();
        break;
      case "next":
        player.next();
        break;
      case "back":
        player.jump(s.index - 1);
        break;
      case "reset":
        player.jump(0);
        break;
      case "speed":
        player.cycleSpeed();
        refresh?.();
        break;
      case "guided":
        s.guided = !s.guided;
        refresh?.();
        break;
      case "close":
        button.closest("dialog").close();
        break;
      case "theme":
        setTheme(document.documentElement.dataset.theme !== "dark" ? "dark" : "light", true);
        break;
    }
  });
  // Rows of the records tables seek too (the # cell holds the focusable key).
  document.addEventListener("click", (e) => {
    if (e.target.closest("button, a")) return;
    const row = e.target.closest("tr[data-row-seek]");
    if (row) player.jump(Number(row.dataset.rowSeek));
  });
  $("#seek").addEventListener("input", (e) => player.jump(Number(e.target.value)));
  $(".hw-records .hw-tabs").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const tabs = $$("[data-record]");
    const at = tabs.indexOf(document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    selectRecord(tabs[next].dataset.record);
  });
  document.addEventListener("keydown", (e) => {
    if (document.querySelector("dialog[open]") || e.target.closest(guard)) return;
    if (e.code === "Space") {
      e.preventDefault();
      player.play();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      player.jump(s.index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      player.jump(s.index + 1);
    } else if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) player.jump(0);
  });
  setTheme(readTheme());
  selectRecord($("[data-record]").dataset.record);
}

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "light";
  } catch {
    return "light";
  }
}
function setTheme(theme, store = false) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === "dark";
  const key = $('[data-action="theme"]');
  key.innerHTML = icon(dark ? "sun" : "moon");
  key.setAttribute("aria-label", dark ? "밝은 테마로 전환" : "어두운 테마로 전환");
  if (store) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }
}
