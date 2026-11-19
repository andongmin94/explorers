// Deck: every playback control. Transport keys, speed selector, one event at
// a time, the guided switch (핵심 장면에서 멈추기) and a seek slider over the
// lesson's steps (0 = overview). Labels follow shared/lesson-kit.js LABELS.
import { translate } from "../i18n.js";
import { LABELS } from "../../../shared/lesson-kit.js";
import { icon } from "../../../shared/hw.js";
import { bindSliders, syncSlider } from "../../../shared/hw.js";

const SPEEDS = [0.5, 1, 1.5, 2];

function renderDeck() {
  const speeds = SPEEDS.map(
    (speed) => `<button type="button" data-speed="${speed}" aria-pressed="${speed === 1}">${speed}×</button>`,
  ).join("");
  return `
  <section class="hw-plate hw-deck pe-deck" aria-label="재생 조작">
    <div class="hw-field">
      <span class="hw-label">재생</span>
      <div class="hw-transport">
        <button class="hw-key hw-key--icon" type="button" data-action="reset" aria-label="${translate("Reset")}" title="처음으로 (R)">${icon("reset")}</button>
        <button class="hw-key hw-key--icon" type="button" data-action="prev" aria-label="${translate("Previous step")}" title="${translate("Previous step (←)")}">${icon("back")}</button>
        <button class="hw-key hw-key--accent toggle" type="button" data-action="toggle" title="${translate("Play / pause (Space)")}"><span class="toggle-icon">${icon("play")}</span><span class="toggle-label">${LABELS.start}</span></button>
        <button class="hw-key hw-key--icon" type="button" data-action="next" aria-label="다음 단계" title="다음 단계 (→)">${icon("next")}</button>
      </div>
    </div>
    <div class="hw-field">
      <span class="hw-label">${translate("Playback speed")}</span>
      <div class="hw-seg speed-seg" role="group" aria-label="${translate("Playback speed")}">${speeds}</div>
    </div>
    <div class="hw-field">
      <span class="hw-label">한 사건씩</span>
      <button class="hw-key step-key" type="button" data-action="step" title="사건 하나만 진행">다음 사건</button>
    </div>
    <div class="hw-field guided-field">
      <button class="hw-switch" type="button" role="switch" aria-checked="true" data-action="guided" title="예측이 있는 패킷 앞과 끝에서 멈춥니다">${LABELS.guided}</button>
    </div>
    <div class="hw-seek">
      <span class="hw-label">${translate("OVERVIEW")}</span>
      <input class="hw-slider seek" type="range" min="0" max="1" step="1" value="0" aria-label="단계 이동" />
      <span class="hw-label seek-end">1단계</span>
    </div>
  </section>`;
}

function bindDeck(deck, actions) {
  bindSliders(deck);
  deck.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button && !button.disabled) actions[button.dataset.action]();
    const speed = event.target.closest("[data-speed]");
    if (speed) actions.speed(Number(speed.dataset.speed));
  });
  const seek = deck.querySelector(".seek");
  seek.addEventListener("input", () => actions.seek(Number(seek.value)));
  // The seek slider handles its own arrows; don't also move the lesson.
  seek.addEventListener("keydown", (event) => event.stopPropagation());
  seek.addEventListener("keyup", (event) => event.stopPropagation());
}

function updateDeck(deck, playback, lesson) {
  const toggle = deck.querySelector(".toggle");
  const label = playback.playing
    ? LABELS.pause
    : playback.done
      ? LABELS.replay
      : playback.started
        ? LABELS.resume
        : LABELS.start;
  if (toggle.dataset.label !== label) {
    toggle.dataset.label = label;
    toggle.querySelector(".toggle-label").textContent = label;
    toggle.querySelector(".toggle-icon").innerHTML = icon(
      playback.playing ? "pause" : playback.done ? "replay" : "play",
    );
  }
  deck.querySelector('[data-action="step"]').disabled = playback.done;
  deck.querySelector('[data-action="prev"]').disabled = !playback.started;
  deck.querySelector('[data-action="next"]').disabled =
    playback.started && (playback.done || playback.activeStep >= lesson.steps.length - 1);
  const seek = deck.querySelector(".seek");
  const max = lesson.steps.length;
  if (Number(seek.max) !== max) {
    seek.max = max;
    deck.querySelector(".seek-end").textContent = `${max}단계`;
  }
  const value = playback.started ? (playback.done ? max : playback.activeStep + 1) : 0;
  if (document.activeElement !== seek || Number(seek.value) !== value) {
    if (document.activeElement !== seek) seek.value = value;
  }
  seek.setAttribute(
    "aria-valuetext",
    value === 0 ? translate("OVERVIEW") : `${Math.min(value, max)}단계 / ${max}`,
  );
  syncSlider(seek);
}

function updateDeckGuided(deck, on) {
  deck.querySelector('[data-action="guided"]').setAttribute("aria-checked", String(on));
}

function updateDeckSpeed(deck, speed) {
  deck.querySelectorAll("[data-speed]").forEach((button) =>
    button.setAttribute("aria-pressed", Number(button.dataset.speed) === speed),
  );
}

export { SPEEDS, bindDeck, renderDeck, updateDeck, updateDeckGuided, updateDeckSpeed };
