# Explorer design contract

Every explorer page is a piece of hardware in the SPEC-01 style: matte plates, keycap controls, LCD readouts, LEDs, and one isometric scene where the data visibly moves through devices. The reference implementation is `shared/kit.html` (`shared/kit-demo.js`); open `/shared/kit.html`, `?theme=dark`, `?explorer=memory` on the dev server.

## Files

- `shared/theme.css` — tokens only (colours, shadows, type scale, accents per `<html data-explorer>`). Don't define these tokens again in an explorer.
- `shared/hw.css` — the parts: `.hw-page`, `.hw-topbar`, `.hw-console` grid, `.hw-plate` (+ `-head`, `-body`, `-foot`), `.hw-section`, `.hw-label`, `.hw-index`, `.hw-title`, `.hw-heading`, `.hw-text`, `.hw-muted`, `.hw-mono`, `.hw-tag`, `.hw-lcd` (`.is-large`), `.hw-led` (`.is-on`, `--led`), `.hw-key` (`--accent`, `--icon`, `--sm`, `--dark`), `.hw-seg`, `.hw-slider` + `.hw-ticks`, `.hw-switch`, `.hw-tabs`, `.hw-list`, `.hw-table`, `.hw-scroll`, `.hw-note` (`--accent`), `.hw-deck`, `.hw-field`, `.hw-transport`, `.hw-seek`, `.hw-scene`, `.hw-dialog`, `.hw-footer`, and the SPEC-01 displays `.hw-screen` (+ `-head`), `.hw-meter`, `.hw-input` (`--sm`).
- `shared/hw.js` — `bindSliders(root)` / `syncSlider(input)` (call after rendering and whenever a slider's value or max changes in code), `icon(name)`.
- `shared/iso-kit.js` — the only way scenes draw isometric geometry: `project`, `box`, `quad`, `frontQuad`, `sideQuad`, `shadow`, `topText`, `frontText`, `sideText`, `callout`, `floorPath`, `defs`, `led`, `token`, `place`, `travel`, `fitViewBox`, `floor`, and devices `chip`, `ramStick`, `ssd`, `server`, `laptop`, `hdd`, `module`.
- `shared/iso.js` — lit face gradients; `shared/switcher.js` — the explorer switcher (ui-sdk menu).

## Page structure

```
.hw-page
  header.hw-topbar
    .hw-brand > h1 + p            ← the switcher replaces this; keep exactly h1 + p inside one wrapper
    .hw-context > .hw-label + strong
    .hw-actions > .hw-key--sm …   (compare, theme)
  main.hw-console
    section.hw-plate.hw-stage     head: .hw-label + .hw-lcd; .hw-scene (one SVG); .hw-plate-foot (one status line)
    section.hw-plate.hw-deck      every control: mode .hw-seg, sliders, transport keys, seek, guided-mode .hw-switch
    aside.hw-plate.hw-side        the lesson: label, .hw-title, .hw-text, events .hw-list, note, milestones .hw-list, prediction key
    section.hw-plate.hw-records   head: .hw-tabs; body: timeline / log .hw-table / metrics
  footer.hw-footer                shortcuts with <kbd>, sources
  dialog.hw-dialog …              prediction, comparison
```

Stylesheet order in `main.js`: `../../shared/theme.css`, `../../shared/hw.css`, `./styles.css`, then `../../shared/switcher.js` and `../../shared/iso.js`.

## Full-screen console (desktop ≥ 1100 × 700)

The page fills the viewport and never scrolls at page level:

```
topbar plate ───────────────────────────────────────────────
stage (1fr, the scene fills it)           │ side (scrolls inside)
──────────────────────────────────────────┼──────────────────
records (≥ --records-h, scrolls inside)   │ deck (controls)
footer (one line) ──────────────────────────────────────────
```

- The stage scene SVG is absolutely positioned to fill `.hw-scene` and scales with `preserveAspectRatio` "meet". Fit the viewBox tightly to the devices, tokens and callouts — not to the whole `floor()`: the floor may run past the stage edges (the stage clips it), so the devices fill the stage. At 1440×900 the device cluster should span most of the stage width or height. Never cap the SVG with `max-height`.
- The deck sits in the side column (`--side-w`, 340–440px): lay its controls out so they wrap into tidy rows at that width. Nothing may overflow it.
- Tune with `--side-w` and `--records-h` on `.hw-console`. Don't redefine the grid in an explorer.
- Check 1440×900, 1920×1080, 1280×720 and 390×844 (mobile stacks and scrolls as before).

## Nothing scrolls (desktop ≥ 1100 × 700)

One screen is the whole lesson: no page scroll and no scroll area anywhere — not in the side plate, the records, a picker, a sequence view or a table. `node scripts/check-scroll.mjs` must print `ok` for every page at 1280×720, 1440×900 and 1920×1080 (it also steps the lesson forward and checks again). Mobile (≤ 759px) still stacks and scrolls the page.

Content that does not fit is split, never scrolled (helpers in `shared/fit.js`, styles in `hw.css`):
- Side plate: head tabs (`.hw-tabs` in `.hw-plate-head`, wired with `plateTabs()`) such as 해설 / 장면 / 규칙. The default tab is the current step only: label, `.hw-title`, a short `.hw-text`, what happens now. Other material (milestones, rules, glossary, details, process detail) goes in its own tab.
- Body: `.hw-plate-body.hw-fit` with one `.hw-fill` child. A long list in a fill box uses `paginate(list)`, which shows whole items that fit and a `‹ 1 / 3 ›` pager.
- Records: tables show a window of rows that fits, following the current row (`rowWindow(box, tbody, { current })`); full history is reached through tabs, the seek slider or a chart. Charts are sized to fit their box.
- Shorten copy before adding pages: one idea per screen.

## SPEC-01 parts

- Plate heads read "A LABEL ————": the first `.hw-label` is followed by a hairline to the end of the head. No rule under the head.
- Keys, segments and tabs are printed in the mono face, uppercase for Latin. Segments carry a corner LED lit on the selected position.
- `.hw-table` is a reflective grey-green LCD (`--hw-paper*`); the `aria-current` row is printed in the accent between two dashes.
- `.hw-screen` is a glossy black screen in a bezel for charts drawn light-on-dark (timelines, seek graphs, frame histories). `.hw-screen-head` holds mono labels; `.is-on` lights one.
- `.hw-meter > i` is a dot meter (`.is-on`, `.is-half`, `--led`) for progress and ratios.
- `.hw-input` is a dark recessed text field (mono, accent caret) for user-entered data like request lists.
- `.hw-note` is an alert: a rule above and below with a status LED, never a tinted box.

## Rules

1. One depth level. Only `.hw-plate`, keys, LCDs and wells have depth. Inside a plate everything is flat: separate with `.hw-section` hairlines or `.hw-list` rows. Never a bordered box inside a bordered box. Never a card with its own shadow inside a plate.
2. Only controls look like keys. A non-interactive label is text, `.hw-label`, `.hw-tag`, or a scene `callout`. Never style a label as a button.
3. Each fact appears once. If the scene shows who is running, the side panel doesn't repeat it as a card, and the stage foot doesn't repeat it either — pick one place (stage foot = one short status line).
4. Four text roles only: `.hw-title` (20px, one per plate at most), body (`.hw-text`, 14px), `.hw-label` (mono 12px, muted), LCD digits. Bold is for the title and key numbers; body text is regular. No text under 12px. Use `word-break: keep-all` for Korean (`.hw-text` has it).
5. The scene is one isometric SVG built with `iso-kit.js`, one scale for every device, standing on a `floor()`. The data entities (processes, pages, transactions, requests, commits, packets) are `token()`s or device states (LEDs, lit paths, screens) on the devices — they sit in slots, on chips, in drives, and travel with `travel()` / `place()` along `floorPath()` routes. No flat HTML cards placed over or beside the scene to show state. Device names are `callout()`s, not boxes.
6. Accent (`--accent`, set per explorer) marks: the primary key, the active path, lit LEDs, LCD glow, indices. Semantic colours (P1/P2/P3, A–E pages, T1/T2, main/feature) stay for tokens and their LEDs.
7. Dark mode comes from tokens; check `?theme=dark` (the explorers keep their own theme toggle that sets `data-theme`).
8. Mobile (≤ 759px): the console stacks stage → deck → side → records; the scene SVG scales to width; no horizontal page scroll; keys ≥ 42px tall.
9. Motion: tokens move with `travel()` (WAAPI) or `.iso-token` transitions; honour `prefers-reduced-motion` and the explorer's existing pause/speed logic.

## Learning model (every explorer)

All six explorers teach the same way: **목표 → 관찰 → 예측 → 확인 → 설명 → 비교 → 정리**. Wording and progress live in `shared/lesson-kit.js` (`LABELS`, `createProgress`, `recapHtml`, `bindRecap`, `nextExperiment`); Korean particles after IDs and numbers come from `shared/josa.js` (`ga`, `eul`, `eun`, `ro`, `josa`).

| Phase | What the learner gets | Shared labels |
|---|---|---|
| 목표 | Start screen (before playback): header `01 대표 시나리오 · {title}`; side title is a **question**; body sets up the scenario; one line `학습 목표: …`. No result is shown before it happens. | `학습 시작` |
| 관찰 | Playback with the guided switch on: it stops at 3–6 **핵심 장면** (the same list the 장면 tab shows). | `핵심 장면에서 멈추기`, `학습 시작 / 이어서 재생 / 일시정지 / 다시 재생`, `다음 {단위}`, `이번 {단위} 다시 보기`, keys Space ←/→ R |
| 예측 | At a 핵심 장면 just before a decision. While a prediction is open, **nothing on screen gives the answer away** (scene marks, tabs, step text, terminal, facts). Each option has its own `why` (the misconception it reflects). Never gates progress (except Git's resolution choice). | `{대상}, 먼저 맞혀보기 →`, dialog `예측`, `맞았습니다.` / `정답은 X입니다.` |
| 확인 | Plays exactly that unit, then pauses. | `실제로 확인 →` |
| 설명 | 해설 tab: eyebrow `핵심 장면 k/N` or `{n}번째 {단위}` / title / body (≤ 3 sentences) / `이번 {단위}` (직전 → 현재) / note `핵심` that changes per step. | `핵심` |
| 비교 | Same input, other method: two columns, one 갈림길 sentence. | `두 방식 비교`, `결과 비교 →`, `같은 입력 · 다른 방식`, `이 방식으로 다시 보기`, `갈림길로 돌아가기` |
| 정리 | Shown at the end in 해설: 2–3 `핵심 정리` points, 1–2 `확인 문제` answered without the scene (per-option `why`), progress line, `다음 실험: … →`. | `정리`, `핵심 정리`, `확인 문제`, `학습 진도` |

Nouns: **장면** only means a 핵심 장면; **사건** is one event; **단계** is used only for protocol lesson steps. Side tabs: `해설 · 장면 · [one subject tab] · 범위` (범위 = rules, terms, model notes). Records: `[subject trace] · {단위} 기록 · {…} 결과`.

Progress: `createProgress(id, { scenes, recall })` — call `markScene` when a 핵심 장면 is reached, `markPrediction` on the first answer, `markCompared` when the comparison opens, `markRecall` via `bindRecap`. Ids: `protocol`, `cpu`, `memory`, `transaction`, `deadlock`, `disk`, `git`.

Kept on purpose (subject-specific): the unit (ms·사건 / 접근 / 사건 / 요청 / 사건 / 단계+패킷), CPU's two-step generated prediction, memory's and disk's sub-stage strips, Git's gated resolution choice and `해결안 비교`, protocol's 14-lesson picker, OSI header, packet inspector, V view switch and multi-event steps.
