// Prediction quiz UI: a key at the foot of the side plate ("guess the next
// packet first") and a dialog with the question, its choices as list rows, the
// verdict with an explanation, then a key that plays on until the real packet
// has arrived. The questions and their grading live in ../quiz.js.
import { escapeHtml, translate } from "../i18n.js";
import { icon } from "../../../shared/hw.js";
import { getLessonPackets } from "../packets/encode.js";
import { getLessonQuizzes, getQuizForStep, nextQuiz } from "../quiz.js";

const CHOICE_LETTERS = "ABCDEF";

function renderQuizFoot() {
  return `<div class="hw-plate-foot pe-quiz-foot" hidden>
    <button class="hw-key pe-quiz-key" type="button" data-action="quiz"></button>
  </div>`;
}

function renderQuizDialog() {
  return `<dialog class="hw-dialog pe-quiz" id="prediction-dialog" aria-labelledby="prediction-title"></dialog>`;
}

/**
 * Wire the key and dialog to the player.
 * `player()` returns the current lesson player; `lesson()` and `playback()`
 * return the latest lesson and playback snapshot.
 */
function createQuiz({ foot, dialog, player, lesson, playback }) {
  const key = foot.querySelector(".pe-quiz-key");
  let open = null; // { quiz, lesson, wasPlaying, answered }
  let reveal = null; // { lesson, packet, wasPlaying }

  function update(state, currentLesson) {
    // Playing on to reveal: stop once the packet has arrived, unless the
    // lesson was already playing before the question was opened.
    if (reveal) {
      const status = state.packets[reveal.packet];
      if (reveal.lesson !== currentLesson || !state.started) reveal = null;
      else if (status === "past" || status === "lost") {
        const { wasPlaying } = reveal;
        reveal = null;
        if (!wasPlaying && state.playing) player().pause();
      } else if (!state.playing) reveal = null; // paused by hand
    }
    const available = reveal ? null : getQuizForStep(currentLesson, state);
    const upcoming = reveal
      ? getLessonQuizzes(currentLesson).find((quiz) => quiz.packet > reveal.packet)
      : (available ?? nextQuiz(currentLesson, state));
    foot.hidden = !upcoming;
    if (!upcoming) return;
    key.disabled = !available;
    const label = available
      ? `다음 패킷, 먼저 맞혀보기 ${icon("arrow")}`
      : `패킷 ${upcoming.packet + 1} 앞에서 맞혀보기`;
    if (key.dataset.label !== label) {
      key.dataset.label = label;
      key.innerHTML = label;
    }
  }

  function show() {
    const state = playback();
    const currentLesson = lesson();
    const quiz = getQuizForStep(currentLesson, state);
    if (!quiz) return;
    const wasPlaying = state.playing;
    if (state.playing) player().pause();
    open = { quiz, lesson: currentLesson, wasPlaying, answered: false };
    const total = getLessonPackets(currentLesson).length;
    dialog.innerHTML = `
      <div class="hw-plate-head">
        <span class="hw-label"><span class="hw-index">?</span> 다음 패킷을 먼저 예측하기</span>
        <button class="hw-key hw-key--sm hw-key--icon" type="button" data-quiz="close" aria-label="${translate("Close (Esc)")}">${icon("close")}</button>
      </div>
      <div class="hw-plate-body">
        <span class="hw-label">${escapeHtml(currentLesson.name)} · 패킷 ${quiz.packet + 1}/${total}</span>
        <h2 class="hw-title pe-quiz-title" id="prediction-title">${escapeHtml(quiz.prompt)}</h2>
        <div class="hw-list pe-quiz-choices">${quiz.choices
          .map(
            (choice, index) =>
              `<button type="button" data-answer="${index}"><span class="hw-index">${CHOICE_LETTERS[index]}</span><span class="pe-quiz-text">${escapeHtml(choice.text)}</span><span class="pe-quiz-verdict"></span></button>`,
          )
          .join("")}</div>
        <div class="pe-quiz-feedback" aria-live="polite"></div>
      </div>
      <div class="hw-plate-foot pe-quiz-actions">
        <span class="pe-quiz-hint">답을 고르면 설명이 나옵니다</span>
        <button class="hw-key hw-key--accent" type="button" data-quiz="continue" hidden>실제 패킷을 보며 확인 ${icon("arrow")}</button>
      </div>`;
    dialog.showModal();
    dialog.querySelector("[data-answer]").focus();
  }

  function answer(index) {
    if (!open || open.answered) return;
    open.answered = true;
    const { quiz } = open;
    const picked = quiz.choices[index];
    dialog.querySelectorAll("[data-answer]").forEach((button) => {
      const choice = quiz.choices[Number(button.dataset.answer)];
      const wrong = choice === picked && !choice.correct;
      button.disabled = true;
      button.classList.toggle("is-correct", choice.correct);
      button.classList.toggle("is-wrong", wrong);
      button.querySelector(".pe-quiz-verdict").textContent = choice.correct ? "정답" : wrong ? "선택" : "";
    });
    const correct = quiz.choices.find((choice) => choice.correct);
    dialog.querySelector(".pe-quiz-feedback").innerHTML = `<p class="hw-note ${picked.correct ? "hw-note--accent" : ""}"><span><b>${
      picked.correct ? "맞았습니다." : `정답은 ${escapeHtml(correct.text)}입니다.`
    }</b> ${escapeHtml(quiz.explain)}</span></p>`;
    dialog.querySelector(".pe-quiz-hint").hidden = true;
    const next = dialog.querySelector('[data-quiz="continue"]');
    next.hidden = false;
    next.focus();
  }

  function playToPacket() {
    if (!open) return;
    const { quiz, lesson: quizLesson, wasPlaying } = open;
    dialog.close();
    if (quizLesson !== lesson()) return;
    reveal = { lesson: quizLesson, packet: quiz.packet, wasPlaying };
    player().play();
  }

  key.addEventListener("click", show);
  dialog.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-answer]");
    if (choice) return answer(Number(choice.dataset.answer));
    const action = event.target.closest("[data-quiz]")?.dataset.quiz;
    if (action === "close") dialog.close();
    if (action === "continue") playToPacket();
    // A click on the backdrop closes the dialog.
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    open = null;
    const state = playback();
    if (state) update(state, lesson());
  });

  return {
    update,
    isOpen: () => dialog.open,
    /** Forget a pending reveal (new lesson, reset, jump). */
    cancel() {
      reveal = null;
      if (dialog.open) dialog.close();
    },
  };
}

export { createQuiz, renderQuizDialog, renderQuizFoot };
