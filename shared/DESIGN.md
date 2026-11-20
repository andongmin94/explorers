# Explorer design contract

Every explorer page is a macOS 26 window in Apple's **Liquid Glass**, taken from Apple's official macOS 26 and iOS/iPadOS 26 UI kits (numbers and Figma node ids: `shared/LIQUID-GLASS.md`). Two layers, as in the system:

- **Content** — the isometric scene (where the data visibly moves through devices), the lesson text and the records — sits on the window background and is never glass.
- **Chrome** floats above the content as Liquid Glass: the toolbar controls, the lesson sidebar, the control palette (deck), menus and sheets. Glass is translucent, blurs and saturates what is behind it, has a bright specular rim and a soft shadow, and (in Chromium) bends the backdrop at its edges.

The reference is `shared/kit.html` (`shared/kit-demo.js`): `/shared/kit.html` shows every glass part floating over the scene backdrop, the content parts, and every iso material, device, cable and token; `?view=console` is the reference console layout; add `?theme=dark` or `?explorer=memory` to either.

## Files

- `shared/theme.css` — tokens only: Apple labels/fills/separators (`--label`, `--label-2…5`, `--vlabel*` on glass, `--fill-1…5`, `--separator*`), the window and group backgrounds, Apple system colours `--sys-*` (light and dark values from the kit), the explorer accent (`--accent`, `--on-accent`, `--accent-text`, `--accent-fill` per `<html data-explorer>`), the glass material (`--lg-small`, `--lg-medium`, `--lg-large`, `--lg-backdrop`, `--lg-rim`, `--lg-sheen`, `--lg-shadow`, `--lg-hover/press/selected`), control tokens (`--control-fill`, `--knob`, `--track`), type (`--font-sans` = `-apple-system, BlinkMacSystemFont, "SF Pro Text", Pretendard, …`, `--font-mono` for code/bytes only, `--fs-1…5`, `--fs-text`, `--w-medium/semibold/bold`), shapes (`--r-window/panel/group/key/small/menu`), and the iso scene tokens. The old SPEC-01 role names (`--ink`, `--muted`, `--surface`, `--hw-key*`, `--hw-well`, `--hw-lcd-ink`, `--hw-paper*`, `--hw-screen*`, `--neo-*`, `--control-*`) still resolve to the new values so explorer CSS keeps working; prefer the new names in new code. Don't define these tokens again in an explorer. Reduced transparency / increased contrast turn every glass into an opaque material.
- `shared/hw.css` — the parts: `.hw-page`, `.hw-topbar`, `.hw-console` grid, `.hw-plate` (+ `-head`, `-body`, `-foot`), `.hw-glass` (`--sm`), `.hw-section`, `.hw-label`, `.hw-index`, `.hw-title`, `.hw-heading`, `.hw-text`, `.hw-muted`, `.hw-mono`, `.hw-tag`, `.hw-lcd` (`.is-large`), `.hw-led` (`.is-on`, `--led`, `.is-new/.is-progress/.is-done`), `.hw-key` (`--accent`, `--icon`, `--sm`, `--dark`), `.hw-seg`, `.hw-slider` + `.hw-ticks`, `.hw-switch`, `.hw-tabs`, `.hw-list`, `.hw-table`, `.hw-scroll`, `.hw-note` (`--accent`), `.hw-deck`, `.hw-field`, `.hw-transport`, `.hw-seek`, `.hw-scene`, `.hw-dialog`, `.hw-footer`, `.hw-screen` (+ `-head`), `.hw-meter`, `.hw-input` (`--sm`), `.hw-content` (marks a non-glass region so its keys render as filled buttons), the rail `.hw-rail*`.
- `shared/glass.js` — the `#lg-lens` / `#lg-lens-sm` SVG displacement filters and `data-lens="on"` on `<html>` where the browser draws `backdrop-filter: url()` (Chromium); imported by `switcher.js`, so every page has it.
- `shared/hw.js` — `bindSliders(root)` / `syncSlider(input)` (call after rendering and whenever a slider's value or max changes in code), `icon(name)`.
- `shared/iso-kit.js` — the only way scenes draw isometric geometry: `project`, `box`, `quad`, `frontQuad`, `sideQuad`, `pocket`, `shadow`, `topText`, `frontText`, `sideText`, `callout`, `labelScale`, `LABEL`, `floorPath`, `cable`, `defs`, `led`, `token`, `place`, `travel`, `fitViewBox`, `fitScene`, `floor`, materials `MAT`, and devices `chip`, `ramStick`, `tray`, `queueRail`, `tableModule`, `bin`, `ssd`, `hdd`, `server`, `laptop`, `module`, `cylinder`, `socket`.
- `shared/iso.js` — lit face gradients and the material gradients/patterns (`#hw-iso-metal`, `-gold`, `-gold-v`, `-pcb`, `-graphite`, `-ic`, `-lcd`, `-plastic`, `-gloss`, `-brush`); `shared/switcher.js` — the explorer switcher (a glass capsule opening a macOS menu, ui-sdk menu).

## Page structure

```
.hw-page                          the window (window background)
  header.hw-topbar                the toolbar: no bar, controls float as glass
    .hw-brand > h1 + p            ← the switcher replaces this; keep exactly h1 + p inside one wrapper
    .hw-context > .hw-label + strong   window title (strong) over a subtitle (label)
    .hw-actions > .hw-key--sm …   (compare, theme) glass capsules
  main.hw-console
    aside.hw-rail                 added by lesson-rail.js: the glass sidebar
    section.hw-plate.hw-stage     content on the window: head .hw-label + .hw-lcd; .hw-scene (one SVG); .hw-plate-foot (one status line)
    section.hw-plate.hw-deck      the glass control palette: mode .hw-seg, sliders, transport keys, seek, guided-mode .hw-switch
    aside.hw-plate.hw-side        content group: the lesson (tabs, label, .hw-title, .hw-text, lists, note, prediction key)
    section.hw-plate.hw-records   content group: head .hw-tabs; body timeline / log .hw-table / metrics
  footer.hw-footer                shortcuts with <kbd>, sources
  dialog.hw-dialog …              sheets (Large glass): prediction, comparison
```

Stylesheet order in `main.js`: `../../shared/theme.css`, `../../shared/hw.css`, `./styles.css`, then `../../shared/switcher.js` and `../../shared/iso.js`.

## Full-screen console (desktop ≥ 1100 × 700)

The page fills the viewport and never scrolls at page level:

```
toolbar (glass controls floating over the scene) ─────────────
rail  │ stage (1fr, the scene fills it)        │ side (content group)
glass │────────────────────────────────────────┼──────────────────
      │ records (≥ --records-h, content group) │ deck (glass palette)
footer (one line) ───────────────────────────────────────────
```

- The stage is the window backdrop: on desktop its box reaches under the toolbar and under the lesson rail to the window edge (`margin`/`padding` from `--toolbar-h`, `--console-gap`, `--rail-w`), so the floor of the scene runs behind the glass. The `.hw-scene` box inside it is unchanged, so the scene SVG is still fitted to the visible part. Let the scene SVG overflow (`overflow: visible`, as the shared CSS sets) and draw one `floor()` larger than the framed area, so there is scene under the glass; an explorer that clips its scene SVG or paints its own stage background hides this.
- The stage scene SVG is absolutely positioned to fill `.hw-scene` and scales with `preserveAspectRatio` "meet". Fit the viewBox tightly to the devices, tokens and callouts — not to the whole `floor()`: the floor may run past the stage edges (the stage clips it at the window edge), so the devices fill the stage. At 1440×900 the device cluster should span most of the stage width or height. Never cap the SVG with `max-height`.
- The deck sits in the side column (`--side-w`, 340–440px): lay its controls out so they wrap into tidy rows at that width. Nothing may overflow it.
- Tune with `--side-w` and `--records-h` on `.hw-console`. Don't redefine the grid in an explorer.
- Check 1440×900, 1920×1080, 1280×720, 1100×700 and 390×844 (mobile stacks and scrolls as before).

## Nothing scrolls (desktop ≥ 1100 × 700)

One screen is the whole lesson: no page scroll and no scroll area anywhere — not in the side panel, the records, a picker, a sequence view or a table. `node scripts/check-scroll.mjs` must print `ok` for every page at 1280×720, 1440×900 and 1920×1080 (it also steps the lesson forward and checks again). Mobile (≤ 759px) still stacks and scrolls the page.

Content that does not fit is split, never scrolled (helpers in `shared/fit.js`, styles in `hw.css`):
- Side panel: head tabs (`.hw-tabs` in `.hw-plate-head`, wired with `plateTabs()`) such as 해설 / 장면 / 규칙. The default tab is the current step only: label, `.hw-title`, a short `.hw-text`, what happens now. Other material (milestones, rules, glossary, details, process detail) goes in its own tab.
- Body: `.hw-plate-body.hw-fit` with one `.hw-fill` child. A long list in a fill box uses `paginate(list)`, which shows whole items that fit and a `‹ 1 / 3 ›` pager.
- Records: tables show a window of rows that fits, following the current row (`rowWindow(box, tbody, { current })`); full history is reached through tabs, the seek slider or a chart. Charts are sized to fit their box.
- Shorten copy before adding pages: one idea per screen.

## Liquid Glass parts

| Part | Kit source | Look |
|---|---|---|
| Toolbar | Toolbar + Titlebar `2548:2856` | No bar. Switcher = glass capsule with the app icon (a disc in the accent); title 15 bold over a 12px secondary subtitle; action keys = glass capsules 36 tall |
| Lesson rail | Sidebar `684:18069` | Medium glass, r 18, inset from the window edge; rows r 8, selected row = grey fill; status dot: ring (new), half ring (in progress), filled (done) |
| Deck | Medium glass | Floating palette, r 18; labels in vibrant secondary |
| Side, records, other plates | Form Group `2302:6716` | Content group: `--group` fill (3% black / 4% white), r 12, no shadow, hairline sections |
| `.hw-key` | Liquid Glass Small `483:9270` / Push Button `121:11924` | Glass capsule 32 (sm 28, toolbar 36); inside content (`.hw-side`, `.hw-records`, `.hw-dialog`, `.hw-content`) a filled bordered button; `--accent` = primary tinted with the explorer colour; `[aria-pressed=true]` = grey fill + tinted label; 13px Medium |
| `.hw-seg` | Segmented Control `121:12398` | Capsule track (fill 5%), separators 1×14, selected segment filled with the accent |
| `.hw-tabs` | iOS Tab Bar `507:24689` | Glass capsule; selected tab = grey pill with an accent label |
| `.hw-switch` | Switch `468:808` | 44×20 track, 26×16 white knob, accent when on |
| `.hw-slider` | Slider `512:3367` | 4px track (accent / 8% fill), 26×20 white knob that turns to clear glass while dragged |
| `.hw-list`, `.hw-table` | Lists and Tables `121:12606` | Rows with soft separators; selected row r 8 grey; table: 28px column header (12 semibold secondary), alternating rows, current row filled with the accent, rounded ends |
| `.hw-dialog`, menu | Large glass / Menu `488:1821` | Sheet r 26, light dim behind; menu r 13, items r 8, highlight = accent |
| `.hw-lcd` | — | A readout: monospaced digits (`tabular-nums`) on a quiet capsule; over the scene it is small glass. No LCD wells, no glow |
| `.hw-led`, `.hw-meter` | — | 8px status dot / 6px progress dots. No LED glow |
| `.hw-label`, `.hw-index`, `.hw-tag` | Section header | Secondary label 12 semibold, sentence case; index in the accent; tag = capsule badge |
| `.hw-note` | (TipKit inline tip) | Rounded fill r 10 with a status dot; `--accent` tints it |
| `.hw-input` | Text Field `687:28078` | White field, 1px 8% ring, r 8 |
| `.hw-screen` | — | A quiet chart well inside content: charts are drawn in label colours and the accent, not light-on-dark |

Type: SF Pro via the system stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text"`), Pretendard for Hangul and where SF is missing. Monospace only for code, packet bytes and numbers that must line up (`.hw-mono`); never for labels, keys, tabs or headings. No uppercase labels.

## Isometric scene parts (iso-kit.js)

The scene looks like a product render: matte parts in real materials sitting firmly on a faint cutting-mat floor, lit from the upper left. Every device is recognisable by its shape and material, not by its label.

**Materials** (`MAT.*`: pass as `fill` to `box()` or `mat` to a device; light/dark tokens `--iso-<material>-*` in theme.css):

| Material | Use for | Text on it |
|---|---|---|
| `MAT.plastic` | default casing, panels, latches (matte white; dark grey in dark mode) | `ink` |
| `MAT.graphite` | dark anodised housings: sockets, bins, SSD casing | `ink` (light) |
| `MAT.pcb` | boards: chip substrate, RAM stick | silkscreen `ink` |
| `MAT.metal` | brushed aluminium: heat spreader, trays, HDD chassis | engraved: `ink` + `engrave` |
| `MAT.gold` | contacts, pins, pads (small parts only) | — |
| `MAT.glass` | LCD / screen windows, table glass | `ink` (light) |
| `MAT.rubber` | feet, gaskets, jackets | — |
| `MAT.ic` | black chip packages | — |

At most three materials per device; no colour other than the accent and the token colours. Print text with the material's `ink` (pass `engrave` to `topText`/`frontText` for engraved metal or plastic).

**Devices: which one for what** (each returns `{ svg, top, slots }`; extras noted):

- CPU / controller → `chip({ size, label, sub })`: PCB substrate with traces, gold pads and pins, brushed IHS with an engraved label. `slots[0]` = IHS centre.
- RAM → `ramStick({ length, chips, label })`: a DIMM standing in a graphite slot; `chipsAt` = chip faces for frame contents.
- Any queue (ready queue, request queue, arrivals) → `queueRail({ slots, pitch, exit, label, sub })` / `tray()` (`axis: "x" | "y"`): one pocket per slot, number + occupancy LED printed on the face below each pocket, label engraved on a nameplate at the tail, accent arrow at the `exit` (head). Tokens sit in `slots[i]`; light `.iso-tray-led[data-slot="i"]` with `.is-on`.
- Page table, index, lock table → `tableModule({ rows, cols, headers, label })`: glass cells `.iso-cell[data-row][data-col]` (`.is-on`, `.is-hot`), row LEDs `.iso-row-led[data-row]`; `cells[r][c]` for text or tokens.
- Done / finished / terminated → `bin({ capacity, label })`: a graphite drawer, never numbered. A tray means "waiting in order"; a bin means "finished".
- Storage → `ssd()` (graphite casing with a sticker) or `hdd()` (aluminium chassis, platter; `center`, `radius`).
- Server / DB → `server({ units, lit })`; client → `laptop({ screen })`.
- `module({ mat })` is the generic case: only when none of the above fits.

**Connections:** a data path between devices is a `cable(points, { active, bus, arrow, width })`: a raised tube with a lit ridge, a floor shadow and metal plugs. `active` turns it accent and runs a pulse along it (still under `prefers-reduced-motion`); `bus: 2–4` draws a ribbon for wide paths; `arrow` puts a head on the end. The pulse is always drawn and only shows while the cable has `.is-active`, so toggle that class at runtime instead of rebuilding. End a cable about 0.4 units short of a device face that is hidden (back/left), or its plug and head are covered by the device top. Route along world axes with ≥ 2 units straight before a bend, draw cables before the devices so the plugs tuck under, and end them at a device edge. Width 6–7 px for main paths, 5 for secondary. `floorPath()` (dashed or `.is-active`, larger heads now) is only for routes that are not wires, e.g. "goes back to the queue".

**Shadows:** every device calls `shadow()` itself (cast shadow + ambient occlusion + contact line). Anything you build from `box()` needs `shadow({ x, y, z, w, d })` under it, with `z` when it sits on another part.

**Labels:** callout titles are `LABEL.title` (15) and subs `LABEL.sub` (12) user units, haloed against the window background. Call `labelScale(svg)` once after mounting the scene SVG: when the scene renders at < 1 CSS px per user unit it scales callout labels up (≤ 2.2×) so they never render below 15 / 12 px. Device text (`topText`/`frontText`) scales with the device: use ≥ `LABEL.device` (11) user units and keep the scene scale ≥ 1 (viewBox width ≤ the stage width in CSS px). At 1440×900 the stage is about 1000–1100 px wide, so a viewBox wider than ~1000 user units makes device text too small — move devices closer instead. Token ids size themselves to fit (≤ 14).

**Framing:** build the viewBox with `fitScene(points, { stageAspect: stageEl, fill: 0.82–0.9, labels })`: `points` are the device footprint corners (and their tops), `labels` the callout label boxes `[x, y, w, h]` in user units. Recompute it when the stage resizes. Lay the device chain out along the screen horizontal (x up while y goes down): a chain running purely along +x or +y runs diagonally and leaves half the stage empty. Use one `floor()` larger than the framed area and let the stage clip it.

## Rules

1. Two layers. Only chrome is glass (toolbar controls, rail, deck, menus, sheets, a readout floating over the scene). Content is not glass: inside a content group everything is flat — separate with `.hw-section` hairlines or `.hw-list` rows. Never a bordered box inside a box, never a card with its own shadow inside a group, never glass on glass.
2. Only controls look like controls. A non-interactive label is text, `.hw-label`, `.hw-tag`, or a scene `callout`. Never style a label as a button.
3. Each fact appears once. If the scene shows who is running, the side panel doesn't repeat it as a card, and the stage foot doesn't repeat it either — pick one place (stage foot = one short status line).
4. Four text roles only: `.hw-title` (Title 2, 17 bold, one per group at most), body (`.hw-text`, 14), `.hw-label` (12 semibold, secondary label colour, sentence case), readouts (`.hw-lcd`, tabular digits). Controls are 13 Medium. Bold is for the title and key numbers; body text is regular. No text under 12px. No uppercase, no monospace outside code, bytes and aligned numbers. Use `word-break: keep-all` for Korean (`.hw-text` has it).
5. The scene is one isometric SVG built with `iso-kit.js`, one scale for every device, standing on a `floor()`, framed with `fitScene()` so the devices fill about 80–90% of the stage, with `labelScale(svg)` on. Each role has its device and material (see "Isometric scene parts"): a CPU is a `chip()`, a queue is a `queueRail()`/`tray()`, a finished set is a `bin()`, a table is a `tableModule()`, memory is a `ramStick()` — never a plain white slab. Connections between devices are `cable()`s. The data entities (processes, pages, transactions, requests, commits, packets) are `token()`s or device states (LEDs, lit cells, active cables, screens) on the devices — they sit in slots, on chips, in drives, and travel with `travel()` / `place()` along `cable()` / `floorPath()` routes. No flat HTML cards placed over or beside the scene to show state. Device names are `callout()`s, not boxes; no scene text renders under 12 px at 1440×900.
6. Accent (`--accent`, the explorer's Apple system colour: protocol blue, cpu orange, memory green, transaction pink, disk yellow, git purple) marks: the primary button, the selected segment, the current table row, switches and sliders, the active path, indices. Use `--accent-text` for accent-coloured text (it is darkened where the system colour is too light on white) and `--on-accent` for text on an accent fill. Semantic colours (P1/P2/P3, A–E pages, T1/T2, main/feature) stay for tokens and their dots; take them from `--sys-*` where possible.
7. Dark mode comes from tokens; check `?theme=dark` (the explorers keep their own theme toggle that sets `data-theme`). Don't hard-code light-on-dark or dark-on-light colours in charts: use `--label*`, `--fill*`, `--separator*`, `--accent`.
8. Mobile (≤ 759px): the console stacks stage → deck → side → records; the scene SVG scales to width; no horizontal page scroll; keys ≥ 42px tall.
9. Motion: tokens move with `travel()` (WAAPI) or `.iso-token` transitions; glass controls respond with a short spring (scale on press, knob stretch); honour `prefers-reduced-motion` and the explorer's existing pause/speed logic. Honour `prefers-reduced-transparency` and `prefers-contrast` (theme.css swaps glass for an opaque material).

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

## Paged lists

`paginate()` (shared/fit.js) measures items with their border box plus the list's `row-gap`; it does not count margins between items. Space paged blocks with `gap` on the list, never `margin-top`, or the last block on a page can be clipped.

## Lessons and the lesson rail (every explorer)

Every explorer has several lessons (protocol 14, the others 3–4), listed in the glass sidebar on the left (like the protocol picker): `shared/lesson-rail.js` (`mountRail`, `currentLesson`, `lessonHref`, `nextLesson`, `progressIdFor`) with styles in `hw.css` (`.hw-rail*`). From 1280px the rail is a floating glass column left of the stage (the stage backdrop runs under it); below that it is a glass drawer opened by the "레슨" key the rail adds to the toolbar.

- A lesson is one scenario with its own question, guided scenes, predictions, comparison and 정리 (the learning model above). Lessons switch by URL: `?lesson=<id>` (the first lesson is the bare page; a lesson may live on another page via `href`, e.g. `deadlock.html`).
- Header context: `.hw-label` "NN 레슨" (lesson number) + `strong` the lesson title.
- Progress per lesson: `createProgress(progressIdFor(explorer, lessons, lesson.id), { scenes, recall })`, then `rail.watch(progress)` so the status dots follow.
- 정리 links to the next lesson (`recapHtml({ …, next: nextLesson(lessons, id) })`); the last lesson links to the next experiment.
- Lesson data lives with the explorer (e.g. `src/lessons.js`): `{ id, name, sub }` for the rail plus whatever the engine needs.
