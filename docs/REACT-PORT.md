# Porting an explorer to React (phase 2 recipe)

Phase 1 moved the project to the stack of `andongmin94/neobrutal-ui` and ported the **CPU** explorer as the reference implementation. Phase 2 ports protocol, memory, transaction (+ `deadlock.html`), disk and git the same way. Read this whole file, then read `src/explorers/cpu/` next to the vanilla explorer you are porting. `shared/DESIGN.md` and `shared/LIQUID-GLASS.md` remain the design contract; this file says how the React shell implements it.

## 1. Stack and commands

| Package | Version | Role |
| --- | --- | --- |
| react / react-dom | 19.3.1 | UI |
| typescript | ^7.0.2 (`tsc` 7, the native compiler) | `npm run typecheck` = `tsc --noEmit` |
| vite / @vitejs/plugin-react | ^8.3.8 / ^6.3.0 | multi-page build (rolldown) |
| tailwindcss / @tailwindcss/vite | ^4.3.5 | styles (CSS-first config in `src/styles/app.css`) |
| @base-ui/react | ^1.9.0 | headless parts (Button, Toggle/ToggleGroup, Switch, Slider, Tabs, Dialog, Menu) — API docs are in `node_modules/@base-ui/react/docs/react/components/*.md` |
| class-variance-authority, clsx, tailwind-merge | ^0.7.1, ^2.1.1, ^3.7.0 | `cva` variants, `cn()` |
| lucide-react | ^1.76.0 | icons |
| pretendard | ^1.3.9 | Korean font (dynamic subset, imported by app.css) |
| oxlint / oxfmt | 1.93.0 / 0.78.0 | `npm run lint` (oxlint --deny-warnings + oxfmt --check), `npm run format` |
| tsx | ^4.23.15 | `npm test` = `tsx --test` over `src/**/*.test.ts` and the vanilla `*/test/*.test.js` |
| @playwright/test | 1.65.0 | `npm run test:browser` (tests/smoke.spec.ts; uses the installed Chrome locally, `CI=1` uses Playwright's Chromium) |
| wrangler | 4.161.0 | `npm run deploy:cloudflare` (`wrangler.jsonc`: assets `./dist`, `auto-trailing-slash`, `404-page`, custom domain explorers.andongmin.com) |

Node ≥ 24. `vite.config.ts` uses `base: "/"`, builds every page listed in `src/lib/explorers.ts` (+ `transaction/deadlock.html`, `404.html`) and splits React and Base UI into shared chunks. You do not need to touch it to port an explorer: its `index.html` simply switches from `./src/main.js` to `/src/explorers/<slug>/main.tsx`. (When you port `transaction`, keep the `transaction-deadlock` input; its HTML points at its own `main.tsx`.)

Before you hand back: `npm run lint && npm run typecheck && npm test && npm run build`, `npm run check:scroll -- <slug>/ "<slug>/?lesson=…"` (all sizes `ok`, needs a dev server; `--base=http://127.0.0.1:<port>` for your own), `npm run test:browser`, and screenshots old vs new (section 9).

## 2. File layout

```
src/
  styles/app.css, tokens.css      Tailwind v4 + Liquid Glass tokens (do not redefine tokens in an explorer)
  lib/                            cn, theme, explorers, josa, lesson-kit (progress, LABELS), lesson-rail (currentLesson, nextLesson, progressIdFor),
                                  fit (PagerStore, useRowWindow), use-media-query, glass (lens), iso/ (kit.ts = shared/iso-kit.js, defs.ts = shared/iso.js)
  components/ui/                  Base UI + Tailwind parts (shadcn style, one per file)
  components/shell/               page.tsx (ExplorerPage, rail drawer state), toolbar.tsx (Toolbar, ExplorerSwitcher, ThemeToggle, ToolbarKey),
                                  lesson-rail.tsx, console.tsx (Console, Stage, sceneBoxClass, Deck, Field, SidePanel, Records, Footer, Kbd), plate.tsx
  components/learning/            pager.tsx (PagedList, Pager, usePager), recap.tsx (recapItems, ProgressLine, Recall*), prediction.tsx (PredictionSheet,
                                  ChoiceKey, Feedback, SheetSection), comparison.tsx (ComparisonSheet)
  explorers/<slug>/
    main.tsx                      imports app.css + <slug>.css, mountGlass(), mountIsoDefs(), renders <App/> in StrictMode
    app.tsx                       wires shell + panels + sheets + keyboard
    types.ts                      engine/lesson types
    engine.ts, lessons.ts, …      the vanilla logic modules, typed (behaviour and numbers unchanged)
    scene.ts                      the vanilla scene module, typed, still imperative (+ destroy())
    <name>-scene.tsx              React wrapper of the scene
    playback.ts                   the vanilla main.js state machine as an external store (if the explorer animates steps)
    deck.tsx, side.tsx, explanation.tsx, records.tsx, prediction.tsx, comparison.tsx
    <slug>.css                    only explorer colours + classes used inside the scene SVG string
    test/*.test.ts                the vanilla tests, typed
<slug>/index.html                 entry (theme script + <script type="module" src="/src/explorers/<slug>/main.tsx">)
```

## 3. Old part → new part

| Vanilla | React |
| --- | --- |
| `.hw-page` | `<ExplorerPage>` (utility `explorer-page`) |
| `.hw-topbar` + `shared/switcher.js` + theme key | `<Toolbar explorer caption lessonNumber lessonTitle actions={<ToolbarKey …/>} />` — switcher is Base UI Menu, theme toggle is built in (`useTheme`, localStorage key `<slug>-explorer:theme`) |
| `mountRail()` / `.hw-rail*` | `<LessonRail explorer title lessons current progress />` (drawer state lives in `ExplorerPage`; Escape/scrim/breakpoint close) |
| `.hw-console` grid + `bindConsoleRows` (fit.js) | `<Console sideWidth="clamp(…)" recordsHeight="…">` — grid areas, `--records-extra` and the stage reach are built in |
| `.hw-stage` + `.hw-plate-head` + `.hw-scene` + `.hw-plate-foot` | `<Stage label head={<Tag/><Readout glass/>} foot={…}>{scene host with sceneBoxClass}</Stage>` |
| `.hw-deck`, `.hw-field`, `.hw-transport`, `.hw-seek` | `<Deck>`, `<Field>`; lay out with Tailwind (`console:grid …` like `cpu/deck.tsx`) |
| `.hw-side` + `plateTabs()` | `<SidePanel>` + `<Tabs value onValueChange>` + `<PlateHead><TabsList><TabsTab value data-tab>` + `<TabsPanel value className={fit body}>` |
| `.hw-records` + record tabs | `<Records>` + Tabs (same parts) |
| `.hw-plate`, `-head`, `-body`, `-foot` | `<Plate>`, `<PlateHead>`, `<PlateBody>`, `<PlateFoot>` |
| `.hw-key` (glass / inside content / `--accent` / `--sm` / `--icon`) | `<Button variant="glass" \| "filled" \| "primary" size="default" \| "sm" \| "toolbar" \| "icon" \| "icon-sm" \| "icon-toolbar">`. Inside side/records/sheets use `variant="filled"` (the old CSS did this by ancestor; now you choose). `<ButtonLink>` for links |
| `.hw-seg` | `<SegmentedControl value onValueChange><Segment value>` (Base UI ToggleGroup; segments carry `aria-pressed`) |
| `.hw-switch` | `<Switch checked onCheckedChange>label</Switch>` |
| `.hw-slider` + `bindSliders` + `.hw-ticks` | `<Slider min max step value onValueChange thumbLabel thumbProps={{ "aria-valuetext" }}/>` + `<SliderTicks>` (no syncSlider needed) |
| `.hw-tabs` | `<TabsList>`/`<TabsTab>` |
| `.hw-dialog` (`showModal`) | `<Sheet>`/`<SheetContent>`/`<SheetHead>`/`<SheetBody>`/`<SheetFoot>`/`<SheetSection>`; for the learning sheets `<PredictionSheet>`, `<ComparisonSheet>` |
| `.hw-label`, `.hw-index`, `.hw-title`, `.hw-heading`, `.hw-text`, `.hw-muted` | `<Label vibrant? as?>`, `<Index>`, `<Title>`, `<Heading>`, `<Text>`, `<Muted>` (`components/ui/typography.tsx`) |
| `.hw-tag`, `.hw-lcd`, `.hw-led`, `.hw-meter`, `.hw-note`, `.hw-list`, `kbd` | `<Tag>`, `<Readout glass? large?>`, `<Led color on>`, `<Meter>`, `<Note accent? as>`, `<List as>` + `listButtonRow`, `<Kbd>` (`components/ui/content.tsx`) |
| `.hw-table` | `<Table>`, `<Th>`, `<Td>`, `rowClass` on `<tr>` (`aria-current="true"` = current row; `data-time` / `data-clickable` = pointer) |
| `paginate(list, { pager })` | `const pager = usePager(); <PagedList pager items resetKey/> <Pager pager label/>` (section 6) |
| `rowWindow(box, tbody, { current })` | `useRowWindow(boxRef, tbodyRef, deps)` — current row = `aria-current="true"` |
| `lesson-kit.js` (`LABELS`, `createProgress`, `lessonStatus`, `nextExperiment`) | `src/lib/lesson-kit.ts` (same storage key, progress carries over) |
| `recapHtml` / `bindRecap` / `progressHtml` | `recapItems({ explorer, points, recall, answers, onAnswer, summary, next })` → blocks for a `PagedList`; `<ProgressLine summary/>`; call `progress.markRecall` in `onAnswer` |
| `lesson-rail.js` helpers | `src/lib/lesson-rail.ts` (`currentLesson`, `lessonHref`, `nextLesson`, `progressIdFor`) |
| `josa.js` (shared, "이/가" pairs) | `src/lib/josa.ts` — accepts "이/가" or one form ("가"); `{ digits: "ko" \| "en" }` (default "ko" = shared behaviour; CPU wraps it with "en") |
| `iso-kit.js`, `iso.js`, `glass.js` | `src/lib/iso/kit.ts` (byte-identical output, tested), `mountIsoDefs()`, `mountGlass()` |
| `hw.js` `icon(name)` | lucide: play `PlayIcon`, pause `PauseIcon`, back/next `ChevronLeft/RightIcon`, reset `SkipBackIcon`, replay `RotateCcwIcon`, compare `ChartColumnIcon`, arrow `ArrowRightIcon`, close `XIcon`, sun/moon `SunIcon`/`MoonIcon`, menu `MenuIcon` |

## 4. The page skeleton

Copy `src/explorers/cpu/app.tsx` and keep its shape:

```tsx
<ExplorerPage>
  <Toolbar explorer="memory" caption="보면서 이해하는 운영체제" lessonNumber="01" lessonTitle={lesson.title}
           actions={<ToolbarKey data-action="compare" className="glass-lens-sm" onClick={openComparison}><ChartColumnIcon aria-hidden /><span>{LABELS.compare}</span></ToolbarKey>} />
  <Console sideWidth="clamp(…)">           {/* only if the vanilla page set --side-w / --records-h */}
    <LessonRail explorer="memory" title="…" lessons={LESSONS} current={lesson.id} progress={progress} />
    <Stage label="…" head={…} foot={…}><MemoryScene … /></Stage>
    <MemoryDeck … />
    <MemorySide … />
    <MemoryRecords … />
  </Console>
  <Footer shortcuts={<>조작: <Kbd>Space</Kbd> …</>} sources={<>학습 근거 <a …>…</a></>} />
  <MemoryPrediction … /> <MemoryComparison … />
</ExplorerPage>
```

- Lesson + progress: `const lesson = useMemo(() => currentLesson(LESSONS), [])`; `const [progress] = useState(() => createProgress(progressIdFor("<id>", LESSONS, lesson.id), { scenes, recall }))` with the same totals the vanilla page used (protocol, deadlock etc. have their own ids — keep them exactly so stored progress still matches). Re-render on progress with a `useSyncExternalStore` over `progress.onChange` (see `useProgressSummary` in cpu/app.tsx); `<LessonRail progress>` subscribes itself.
- Keyboard: one `keydown` listener on `document` in an effect; ignore while a sheet is open or when the target is `input,select,textarea,button,a,summary,[role='button']` (same rule as the vanilla pages). Pause on `visibilitychange`.
- Keep the vanilla page's `data-action`, `data-tab`, `data-record`, `data-time`, `data-answer`, `data-number`, `data-pick`, `data-milestone`, `id="clock"`, `id="explanation"` etc. on the equivalent elements: `scripts/check-scroll.mjs` clicks `[data-action="next"|"step"|"event"]`, the Playwright smoke test and the screenshot script use the others.
- Copy (Korean text) is unchanged. Every string the vanilla page passed through `keepUnits()` goes through it too (`cpu/format.ts`; it inserts no-break spaces before units and around `=`).

## 5. Wrapping a scene

Scenes stay imperative SVG-string builders driven by WAAPI; React owns only the host element.

1. Copy `<slug>/src/scene.js` to `src/explorers/<slug>/scene.ts`, change the kit import to `@/lib/iso/kit.ts`, type it (see `cpu/scene.ts`: a `Layout` interface, `Point = number[]`, `let svg!: SVGSVGElement` for things `build()` assigns). Keep every number.
2. Return a `destroy()` that cancels running animations, disconnects its ResizeObserver, stops `labelScale` and clears the host (React StrictMode mounts, unmounts and mounts again in dev).
3. Wrapper component (`cpu/scheduler-scene.tsx`): `useLayoutEffect(() => { const scene = createScene(host.current!, …, controller.onMove); controller.attachScene(scene); return () => { controller.detachScene(scene); scene.destroy(); }; }, [controller])`. Do not render children into the host; attributes on the host (`aria-label`, `aria-busy`, `id`) are fine. The scene may set `data-*` on the host itself.
4. Interactions inside the SVG (tokens with `role="button"`): one `onClick`/`onKeyDown` on the host that finds `closest("[data-…]")`.
5. Scene CSS classes (`.cpu-token`, `.cpu-scene .iso-…`) go in `<slug>.css`, copied from the vanilla stylesheet. The iso kit injects its own CSS (`#iso-kit-css`) on import as before.
6. Give the host `sceneBoxClass` from `components/shell/console.tsx` plus the vanilla scene box's own padding (CPU: `min-h-0 px-3 pt-2 pb-1 console:p-0 phone:p-0`, and `overflow-hidden` when stacked).

### State machine (main.js) → external store

`cpu/playback.ts` is `main.js`'s timing logic (`render`, `presentFrame`, `seek`, `pause`, `moveTo`, `tick`, `togglePlay`, `reconfigure`) as a class with `subscribe`/`snapshot` and `usePlayback()` (`useSyncExternalStore`). Everything that was `updateControls()` or DOM writing became React rendering from the snapshot; side effects that must happen at a precise moment (progress `markScene` when a 핵심 장면 is presented, `onMove` during an animation) stay in the class. `snapshot()` must return the same object until `emit()` (cache it), or React loops. Do not mutate the instance from components (the `react/immutability` lint rule); add a setter (`setOnRewind`). Explorers without step animation (git, protocol) may simply use `useState`/`useReducer`; port whatever the vanilla `main.js` does, in the same order.

## 6. Paged content (nothing scrolls)

`PagedList` renders blocks into a box with a definite height (it is the `data-fill` child of a `fit-column` body) and hides whole blocks that do not fit, exactly like `paginate()`:

```tsx
const pager = usePager();
<TabsPanel value="now" className="fit-column px-3.5 pt-2.5 pb-4 phone:px-3 min-[1100px]:min-h-0 min-[1100px]:flex-1">
  <PagedList pager={pager} resetKey={stepKey} items={items} className="paged-blocks" />
  <div className="flex items-center gap-2.5 pt-3">{/* action key */}<Pager pager={pager} label="해설" className="flex-none pt-0" /></div>
</TabsPanel>
```

- `items: PagedItem[]`: `{ key, node }` (wrapped in a div), `{ key, text, className }` (a plain paragraph; split into sentences when taller than a third of the box, as before), `{ key, element }` (the element itself is the child — use for list rows so `List`-style child selectors apply), `{ key, note: true }` (a block that is only a `<Note>`: no hairline above it).
- `className="paged-blocks"` gives the column gap and the hairlines between visible blocks (`.cpu-pages` in the vanilla CSS). For lists use list classes on the `PagedList` itself (`as="nav" | "ul"`, `textAs="li"`; see `cpu/side.tsx`).
- `resetKey` = what the vanilla code compared in `refill()`: when it changes the list starts again on page 1. Content that changes without a reset (an answered recall question) keeps the page; then call `pager.showKey(key)` in an effect to show the page holding a block (the vanilla `showItem`).
- `useRowWindow(boxRef, tbodyRef, deps)` replaces `rowWindow`; mark the current row `aria-current="true"`.
- `hidden` on paged children and table rows is set imperatively by these helpers; never render a `hidden` prop on those children yourself.

## 7. Styling rules and gotchas

- Tokens (`--label`, `--fill-3`, `--accent`, `--lg-*`, `--iso-*` …) are the vanilla names, in `src/styles/tokens.css`. Tailwind reads them through `@theme inline`: `bg-window`, `bg-group`, `text-label`, `text-label-2`, `text-vlabel-2`, `bg-fill-1…5`, `border-separator-soft`, `bg-accent`, `text-accent-text`, `bg-accent-fill`, `text-on-accent`, `bg-control-fill`, `bg-lg-hover|press|selected`, `bg-track`, `bg-knob`, `shadow-knob`. Explorer colours (job/page/transaction colours) go on `:root` in `<slug>.css` (light) and `:root[data-theme="dark"]`.
- Type scale: `text-caption` 12, `text-control` 13, `text-body` 14/1.6, `text-headline` 15/20, `text-title` 17/22, `text-large` 22/26. `text-caption`/`text-control` set only the size (line height comes from the context, as in hw.css); `<Label>` adds 15px. Weights: `font-medium` 510, `font-semibold` 590, `font-bold` 700. Fonts: `font-sans`, `font-display`, `font-mono` (code/bytes only — use `tabular-nums` for numbers).
- Radii: `rounded-window` 26, `rounded-panel` 18, `rounded-group` 12, `rounded-note` 10, `rounded-small` 8, `rounded-menu` 13.
- Glass: utilities `glass-md` (rail, deck), `glass-sm` (+ `glass-lens-sm` for toolbar keys/readouts over the scene), `glass-lg` (sheets), `glass-menu`. Each handles the Chromium lens (`data-lens="on"`) and reduced transparency / increased contrast.
- Layout variants (app.css): `phone:` ≤ 759, `stacked:` ≤ 1099, `drawer:` ≤ 1279, `rail-column:` ≥ 1280, `console:` ≥ 1100 × 700, `console-short:` console with height ≤ 820, `console-tight:` ≥ 1100 wide and ≤ 760 tall, `short:` ≥ 760 wide and ≤ 820 tall, `opaque:` reduced transparency or more contrast, `dark:`. Rules the vanilla CSS wrote as `@media (min-width: 1100px)` without a height use `min-[1100px]:`; a lone height query uses `[@media(max-height:699px)]:`.
- **Multi-layer backgrounds must be `[background:…]`**, never `bg-[a,b]`: Tailwind types `bg-[linear-gradient(…),var(--accent)]` as an image and drops the colour layer (the primary key rendered without its orange before this was fixed). Same for stripes that must replace a base colour: `[background:repeating-linear-gradient(…)_padding-box]`.
- **`cn()` knows the theme names** (`src/lib/cn.ts` extends tailwind-merge with text sizes, radii, eases, `font-display`, `shadow-knob`). If you add a theme token that shares a prefix with colours (`text-*`, `bg-*`, `shadow-*`), add it there too, or `cn("text-caption text-label-2")` silently drops one class. There is a test (`src/lib/test/cn.test.ts`).
- Never name a colour like a font size: `--color-control` made `text-control` also set the colour to a 5% fill (now `--color-control-fill`).
- `aria-current` has no built-in variant: write `aria-[current=true]:` (or `aria-[current=page]:`). `aria-pressed:`, `aria-selected:`, `aria-checked:`, `data-*:` work as is (Base UI sets `aria-pressed` on toggles, `aria-selected`/`data-active` on tabs, `data-checked` on switches, `data-dragging` on slider thumbs, `data-popup-open` on menu triggers, `data-highlighted` on menu items).
- Variant order matters inside one class: `phone:[&>span]:sr-only`, not `[&>span]:phone:sr-only`.
- Ancestor-dependent vanilla rules (keys inside `.hw-side` are filled, labels inside the deck are vibrant, `.hw-side .hw-title` shrinks on short windows) are now explicit: pick `variant="filled"`, `<Label vibrant>` (the deck already recolours labels), and `Title`/`Text` shrink inside `.side-panel` on `console-short` automatically.
- Base UI Tabs unmount inactive panels (no `keepMounted`), which matches the vanilla `hidden` panels for paging. `Tabs` renders `display: contents`, so the panels are flex children of the plate.
- Sheets are Base UI Dialogs in a portal: there is no `dialog[open]` any more; track open state in React and use it to mute the keyboard shortcuts. `SheetHead` already has the close key (`data-action="close-dialog"`).
- Base UI Slider: `thumbAlignment="edge"` (set in `<Slider>`) mimics the native range input; `onValueChange` gives `number | number[]` (cast). Give the thumb a name with `thumbLabel` or a visible label.
- The Pretendard npm package registers **"Pretendard Variable"**; the font stack lists it before `Pretendard`. Iosevka still comes from `public/fonts`.
- `index.html` sets `data-theme` *and* `class="dark"` before paint; `useTheme(explorer)` toggles both.
- Lint (`oxlint --deny-warnings`, plugins react, react-hooks via react, jsx-a11y, typescript, unicorn, oxc) is strict: no refs read during render (pass refs through their own context, see `useRailButton`), no `setState` synchronously inside an effect (subscribe to the event instead), no mutation of values from `useState`. Disable a rule only on the line with a reason (`// oxlint-disable-next-line rule -- why`).
- `oxfmt --write` reformats; run `npm run format` before `npm run lint`. It may turn `"\u00a0"` escapes into literal no-break spaces — that is fine.
- tsx resolves the `@/` alias from `tsconfig.json`; import TS files with the `.ts`/`.tsx` extension (`allowImportingTsExtensions`).

## 8. Porting tests

1. `cp <slug>/test/*.test.js src/explorers/<slug>/test/*.test.ts`, fix imports (`../engine.ts`, `@/lib/lesson-rail.ts` …).
2. Type the engine first (`types.ts`, then annotate the exported functions; inner callbacks infer). Keep runtime behaviour identical; where TS needs it, prefer `!`/`as` over changing logic. For optional ids (events without one) use `id?: string` and `!` at the use sites that are guaranteed.
3. In tests: annotate helper params, add `!` after `find(…)`/predictions that the test knows exist, cast literal option objects (`as SimulateOptions[]`, `as ProcessDef[]`). Do not change an assertion.
4. `npm test` must show the same number of tests as before for the explorer (CPU: 46) and all pass; then delete `<slug>/src` and `<slug>/test` and drop the explorer's glob from the `test` script in `package.json`.

## 9. Parity checklist (do not hand back before every box is true)

- [ ] Screenshots old vs new, same states, light + dark, 1440×900 and 390×844: use `node <scratchpad>/shot.mjs <base> <outDir> <prefix>` (CPU agent's script: `C:\Users\studcom\AppData\Local\Temp\claude\5587dff1c0a3f2f3\021d949d-d2f9-4e60-bfe2-076d1ab31ab4\scratchpad\agents\react-cpu\shot.mjs`; set `PAGES`, `SIZES`, `THEMES`, `ONLY`; in Git Bash prefix `MSYS_NO_PATHCONV=1`; its click selectors are `data-action` / `data-tab` / `data-record` / `data-answer` — adapt the `STATES` map to your explorer). Before you change anything, build the old version once (`npx vite build --outDir <your scratchpad>/old-dist`) and serve it with `node serve.mjs <dir> <port>` (next to `shot.mjs`), so the reference stays available while the dev server shows your work.
- [ ] `check:scroll` ok for every lesson at 1100×700, 1280×720, 1440×900, 1920×1080, plus the other explorers still ok.
- [ ] Lesson rail: column ≥ 1280, drawer below (key "레슨", scrim, Escape, focus to the current lesson, focus back to the key), status dots + % follow progress.
- [ ] 목표 start screen shows no result; guided stops at every 핵심 장면 (same count as before → same progress totals); 장면 tab jumps and marks the current scene.
- [ ] Predictions: opening pauses and rewinds to just before the decision; nothing on screen gives the answer away (scene, tabs, step text, records); every choice has its why; reveal plays exactly that unit.
- [ ] Comparison: same numbers as the vanilla page; "이 방식으로 다시 보기" switches method; opening marks compared.
- [ ] 정리: points, recall questions with per-choice why, progress line, "다음 레슨/실험" link; answering moves to the answer's page.
- [ ] Keyboard: Space, ←/→, R (and the explorer's own keys), Esc closes sheets/drawer; not while typing or on a focused control.
- [ ] Reduced motion (no travel animations, pulses static), dark mode (`?`/toggle), reduced transparency, mobile stacking ≤ 759 (keys ≥ 42px, no horizontal page scroll), Korean copy byte-for-byte.
- [ ] No console errors (Playwright smoke: add your pages' flows to `tests/smoke.spec.ts`).
- [ ] lint, typecheck, test, build all green; old vanilla files of the explorer removed; README of the explorer updated (source table).

## 10. Things phase 2 must know

- The shared vanilla files (`shared/hw.css`, `theme.css`, `iso-kit.js`, `fit.js`, `lesson-kit.js`, `lesson-rail.js`, `switcher.*`, `glass.js`, `iso.js`, `hw.js`, `kit.html`) stay until the last explorer is ported; phase 3 deletes them, the `@ui-sdk/*` dependencies and `.github/workflows/pages.yml` (it still builds with `BASE_PATH` and Node 22). `shared/explorers.js` re-exports `src/lib/explorers.ts`.
- Do not change `src/components/**` or `src/lib/**` behaviour for one explorer. If you need a new shared part, add it generically (and keep CPU working — run its tests, smoke test and check-scroll). Explorer-only parts live in `src/explorers/<slug>/`.
- The CPU explorer's numbers match the vanilla build; its screenshots (old vs new) are in the CPU agent's scratchpad (`shots-old/`, `shots-new/`).
