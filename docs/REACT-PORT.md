# Adding or changing an explorer

All six explorers (protocol, cpu, memory, transaction + `deadlock.html`, disk, git) are React 19 + TypeScript + Tailwind CSS v4 + Base UI pages; the port from the vanilla pages is complete. This file is the recipe for changing one or adding a new one. `docs/DESIGN.md` and `docs/LIQUID-GLASS.md` are the design contract; this file says how the React shell implements it. `src/explorers/cpu/` is the reference implementation — read it next to this file.

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
| tsx | ^4.23.15 | `npm test` = `tsx --test "src/**/*.test.ts"` |
| @playwright/test | 1.65.0 | `npm run test:browser` (`tests/*.spec.ts`; uses the installed Chrome locally, `CI=1` uses Playwright's Chromium) |
| wrangler | 4.161.0 | `npm run deploy:cloudflare` (`wrangler.jsonc`: assets `./dist`, `auto-trailing-slash`, `404-page`, custom domain explorers.andongmin.com) |

Node ≥ 24. `vite.config.ts` uses `base: "/"`, builds every page listed in `src/lib/explorers.ts` (`<slug>/index.html`) plus `index.html`, `404.html` and `transaction/deadlock.html`, and splits React and Base UI into shared chunks. Its dev and preview servers redirect `/<slug>` to `/<slug>/`, as Cloudflare does.

Before you hand back: `npm run format && npm run lint && npm run typecheck && npm test && npm run build`, `npm run check:scroll -- <slug>/ "<slug>/?lesson=…"` (all sizes `ok`, needs a dev server; `--base=http://127.0.0.1:<port>` for your own), and `npm run test:browser`. CI (`.github/workflows/ci.yml`) runs the same checks except `check:scroll`; deployment is Cloudflare Workers Builds on push to `main`.

## 2. File layout

```
src/
  styles/app.css, tokens.css      Tailwind v4 + Liquid Glass tokens (do not redefine tokens in an explorer)
  lib/                            cn, theme, explorers, josa, lesson-kit (progress, LABELS, EXPERIMENTS), lesson-rail (currentLesson, nextLesson, progressIdFor),
                                  fit (PagerStore, useRowWindow), use-media-query, glass (mountGlass), iso/ (kit.ts drawing kit, defs.ts mountIsoDefs)
  components/ui/                  Base UI + Tailwind parts (shadcn style, one per file)
  components/shell/               page.tsx (ExplorerPage, rail drawer state), toolbar.tsx (Toolbar, ExplorerSwitcher, ThemeToggle, ToolbarKey),
                                  lesson-rail.tsx, console.tsx (Console, Stage, sceneBoxClass, Deck, Field, SidePanel, Records, Footer, Kbd), plate.tsx
  components/learning/            pager.tsx (PagedList, Pager, usePager), recap.tsx (recapItems, ProgressLine, Recall*), prediction.tsx (PredictionSheet,
                                  ChoiceKey, Feedback, SheetSection), comparison.tsx (ComparisonSheet)
  explorers/<slug>/
    main.tsx                      imports app.css + <slug>.css, mountGlass(), mountIsoDefs(), renders <App/> in StrictMode
    app.tsx                       wires shell + panels + sheets + keyboard
    types.ts                      engine/lesson types
    engine.ts, lessons.ts, …      pure logic: simulation, lesson list and content
    scene.ts                      the imperative isometric scene (SVG string + WAAPI, returns destroy())
    <name>-scene.tsx              React wrapper of the scene
    playback.ts                   the step/animation state machine as an external store (if the explorer animates steps)
    deck.tsx, side.tsx, records.tsx, prediction.tsx, comparison.tsx, …
    <slug>.css                    only explorer colours + classes used inside the scene SVG string
    test/*.test.ts                engine and lesson tests
<slug>/index.html                 entry (theme script + <script type="module" src="/src/explorers/<slug>/main.tsx">)
<slug>/README.md                  what the explorer teaches, its numbers, and a file table of src/explorers/<slug>/
```

Explorers differ where their subject needs it (protocol has `controller.ts`, `simulation/`, `lessons/`; transaction runs four lessons through one console with a `TxPage` per lesson in `page.ts`); the shape above is the default.

## 3. Adding a new explorer

1. Add the slug to `ExplorerSlug` and an entry to `explorers` in `src/lib/explorers.ts` (label, tint = an Apple system colour). That adds it to the build inputs and the toolbar switcher.
2. Give it an icon in `EXPLORER_ICONS` (`src/components/shell/toolbar.tsx`) and an accent in `src/styles/tokens.css` (`:root[data-explorer="<slug>"] { --accent: var(--sys-<tint>); }`, plus `--accent-text` / `--on-accent` if the colour is too light).
3. Add it to `EXPERIMENTS` in `src/lib/lesson-kit.ts` (the 정리 "다음 실험" chain), the link list in `404.html`, the default pages in `scripts/check-scroll.mjs`, `PAGES` in `tests/smoke.spec.ts`, and the table in the root `README.md`.
4. Create `<slug>/index.html` (copy `cpu/index.html`: `data-explorer`, the theme script with the key `<slug>-explorer:theme`, the module script) and `src/explorers/<slug>/` as in section 2, then `<slug>/README.md`.
5. Static files only that explorer uses go in `public/<slug>/` (served at `/<slug>/…`).

## 4. Parts

| Need | Use |
| --- | --- |
| The window | `<ExplorerPage>` (utility `explorer-page`) |
| Toolbar, switcher, theme key | `<Toolbar explorer caption lessonNumber lessonTitle actions={<ToolbarKey …/>} />` — the switcher is a Base UI Menu, the theme toggle is built in (`useTheme`, localStorage key `<slug>-explorer:theme`) |
| Lesson rail | `<LessonRail explorer title lessons current progress />` (drawer state lives in `ExplorerPage`; Escape/scrim/breakpoint close) |
| Console grid | `<Console sideWidth="clamp(…)" recordsHeight="…">` — grid areas, `--records-extra` and the stage reach are built in |
| Stage | `<Stage label head={<Tag/><Readout glass/>} foot={…}>{scene host with sceneBoxClass}</Stage>` |
| Deck | `<Deck>`, `<Field>`; lay out with Tailwind (`console:grid …` like `cpu/deck.tsx`) |
| Side panel, records | `<SidePanel>` / `<Records>` + `<Tabs value onValueChange>` + `<PlateHead><TabsList><TabsTab value data-tab>` + `<TabsPanel value className={fit body}>` |
| Content group | `<Plate>`, `<PlateHead>`, `<PlateBody>`, `<PlateFoot>` |
| Keys | `<Button variant="glass" \| "filled" \| "primary" size="default" \| "sm" \| "toolbar" \| "icon" \| "icon-sm" \| "icon-toolbar">`. Inside side/records/sheets use `variant="filled"`. `<ButtonLink>` for links |
| Segmented control | `<SegmentedControl value onValueChange><Segment value>` (Base UI ToggleGroup; segments carry `aria-pressed`) |
| Switch | `<Switch checked onCheckedChange>label</Switch>` |
| Slider | `<Slider min max step value onValueChange thumbLabel thumbProps={{ "aria-valuetext" }}/>` + `<SliderTicks>` |
| Tabs | `<TabsList>`/`<TabsTab>` |
| Sheets | `<Sheet>`/`<SheetContent>`/`<SheetHead>`/`<SheetBody>`/`<SheetFoot>`/`<SheetSection>`; for the learning sheets `<PredictionSheet>`, `<ComparisonSheet>` |
| Text roles | `<Label vibrant? as?>`, `<Index>`, `<Title>`, `<Heading>`, `<Text>`, `<Muted>` (`components/ui/typography.tsx`) |
| Content parts | `<Tag>`, `<Readout glass? large?>`, `<Led color on>`, `<Meter>`, `<Note accent? as>`, `<List as>` + `listButtonRow`, `<Kbd>` (`components/ui/content.tsx`) |
| Tables | `<Table>`, `<Th>`, `<Td>`, `rowClass` on `<tr>` (`aria-current="true"` = current row; `data-time` / `data-clickable` = pointer) |
| Paged list | `const pager = usePager(); <PagedList pager items resetKey/> <Pager pager label/>` (section 7) |
| Row window | `useRowWindow(boxRef, tbodyRef, deps)` — current row = `aria-current="true"` |
| Progress, labels | `src/lib/lesson-kit.ts` (`LABELS`, `createProgress`, `lessonStatus`, `nextExperiment`; one localStorage key `explorers:progress:v1` for all explorers) |
| 정리 | `recapItems({ explorer, points, recall, answers, onAnswer, summary, next })` → blocks for a `PagedList`; `<ProgressLine summary/>`; call `progress.markRecall` in `onAnswer` |
| Lessons | `src/lib/lesson-rail.ts` (`currentLesson`, `lessonHref`, `nextLesson`, `progressIdFor`) |
| Korean particles | `src/lib/josa.ts` — accepts "이/가" or one form ("가"); `{ digits: "ko" \| "en" }` (default "ko"; CPU wraps it with "en") |
| Scene drawing | `src/lib/iso/kit.ts` (via `@/lib/iso/index.ts`), `mountIsoDefs()`, `mountGlass()` |
| Icons | lucide: play `PlayIcon`, pause `PauseIcon`, back/next `ChevronLeft/RightIcon`, reset `SkipBackIcon`, replay `RotateCcwIcon`, compare `ChartColumnIcon`, arrow `ArrowRightIcon`, close `XIcon`, sun/moon `SunIcon`/`MoonIcon`, menu `MenuIcon` |

## 5. The page skeleton

Copy `src/explorers/cpu/app.tsx` and keep its shape:

```tsx
<ExplorerPage>
  <Toolbar explorer="memory" caption="보면서 이해하는 운영체제" lessonNumber="01" lessonTitle={lesson.title}
           actions={<ToolbarKey data-action="compare" className="glass-lens-sm" onClick={openComparison}><ChartColumnIcon aria-hidden /><span>{LABELS.compare}</span></ToolbarKey>} />
  <Console sideWidth="clamp(…)">           {/* only to change the default split */}
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

- Lesson + progress: `const lesson = useMemo(() => currentLesson(LESSONS), [])`; `const [progress] = useState(() => createProgress(progressIdFor("<id>", LESSONS, lesson.id), { scenes, recall }))` with totals that match the lesson's 핵심 장면 and 확인 문제. Never change an existing progress id (protocol, deadlock etc. have their own) or stored progress is lost. Re-render on progress with a `useSyncExternalStore` over `progress.onChange` (see `useProgressSummary` in `cpu/app.tsx`); `<LessonRail progress>` subscribes itself.
- Keyboard: one `keydown` listener on `document` in an effect; ignore while a sheet is open or when the target is `input,select,textarea,button,a,summary,[role='button']`. Pause on `visibilitychange`.
- Tests and scripts find elements by attribute: keep `data-action`, `data-tab`, `data-record`, `data-time`, `data-answer`, `data-number`, `data-pick`, `data-milestone`, `id="clock"`, `id="explanation"` on the equivalent elements. `scripts/check-scroll.mjs` clicks `[data-action="next"|"step"|"event"]`; the Playwright specs use the others.
- Copy is Korean. Strings with units go through the explorer's `keepUnits()` (`cpu/format.ts`; it inserts no-break spaces before units and around `=`).

## 6. Wrapping a scene

Scenes are imperative SVG-string builders driven by WAAPI; React owns only the host element.

1. `src/explorers/<slug>/scene.ts` imports the kit from `@/lib/iso/index.ts` (or `kit.ts`) and is typed like `cpu/scene.ts`: a `Layout` interface, `Point = number[]`, `let svg!: SVGSVGElement` for things `build()` assigns.
2. It returns a `destroy()` that cancels running animations, disconnects its ResizeObserver, stops `labelScale` and clears the host (React StrictMode mounts, unmounts and mounts again in dev).
3. Wrapper component (`cpu/scheduler-scene.tsx`): `useLayoutEffect(() => { const scene = createScene(host.current!, …, playback.onMove); playback.attachScene(scene); return () => { playback.detachScene(scene); scene.destroy(); }; }, [playback])`. Do not render children into the host; attributes on the host (`aria-label`, `aria-busy`, `id`) are fine. The scene may set `data-*` on the host itself.
4. Interactions inside the SVG (tokens with `role="button"`): one `onClick`/`onKeyDown` on the host that finds `closest("[data-…]")`.
5. Scene CSS classes (`.cpu-token`, `.cpu-scene .iso-…`) go in `<slug>.css`. The iso kit injects its own CSS (`#iso-kit-css`) on import.
6. Give the host `sceneBoxClass` from `components/shell/console.tsx` plus the scene box's own padding (CPU: `min-h-0 px-3 pt-2 pb-1 console:p-0 phone:p-0`, and `overflow-hidden` when stacked).

### State machine → external store

`cpu/playback.ts` holds the timing logic (`render`, `presentFrame`, `seek`, `pause`, `moveTo`, `tick`, `togglePlay`, `reconfigure`) as a class with `subscribe`/`snapshot` and `usePlayback()` (`useSyncExternalStore`). Controls and panels render from the snapshot; side effects that must happen at a precise moment (progress `markScene` when a 핵심 장면 is presented, `onMove` during an animation) stay in the class. `snapshot()` must return the same object until `emit()` (cache it), or React loops. Do not mutate the instance from components (the `react/immutability` lint rule); add a setter (`setOnRewind`). Explorers without step animation may simply use `useState`/`useReducer`.

## 7. Paged content (nothing scrolls)

`PagedList` renders blocks into a box with a definite height (it is the `data-fill` child of a `fit-column` body) and hides whole blocks that do not fit:

```tsx
const pager = usePager();
<TabsPanel value="now" className="fit-column px-3.5 pt-2.5 pb-4 phone:px-3 min-[1100px]:min-h-0 min-[1100px]:flex-1">
  <PagedList pager={pager} resetKey={stepKey} items={items} className="paged-blocks" />
  <div className="flex items-center gap-2.5 pt-3">{/* action key */}<Pager pager={pager} label="해설" className="flex-none pt-0" /></div>
</TabsPanel>
```

- `items: PagedItem[]`: `{ key, node }` (wrapped in a div), `{ key, text, className }` (a plain paragraph; split into sentences when taller than a third of the box), `{ key, element }` (the element itself is the child — use for list rows so `List`-style child selectors apply), `{ key, note: true }` (a block that is only a `<Note>`: no hairline above it).
- `className="paged-blocks"` gives the column gap and the hairlines between visible blocks. For lists use list classes on the `PagedList` itself (`as="nav" | "ul"`, `textAs="li"`; see `cpu/side.tsx`).
- `resetKey` = what makes the content new: when it changes the list starts again on page 1. Content that changes without a reset (an answered recall question) keeps the page; then call `pager.showKey(key)` in an effect to show the page holding a block.
- `useRowWindow(boxRef, tbodyRef, deps)` shows the table rows that fit around the current row; mark it `aria-current="true"`.
- `hidden` on paged children and table rows is set imperatively by these helpers; never render a `hidden` prop on those children yourself.

## 8. Styling rules and gotchas

- Tokens (`--label`, `--fill-3`, `--accent`, `--lg-*`, `--iso-*` …) are in `src/styles/tokens.css`. Tailwind reads them through `@theme inline`: `bg-window`, `bg-group`, `text-label`, `text-label-2`, `text-vlabel-2`, `bg-fill-1…5`, `border-separator-soft`, `bg-accent`, `text-accent-text`, `bg-accent-fill`, `text-on-accent`, `bg-control-fill`, `bg-lg-hover|press|selected`, `bg-track`, `bg-knob`, `shadow-knob`. Explorer colours (job/page/transaction colours) go on `:root` in `<slug>.css` (light) and `:root[data-theme="dark"]`.
- Type scale: `text-caption` 12, `text-control` 13, `text-body` 14/1.6, `text-headline` 15/20, `text-title` 17/22, `text-large` 22/26. `text-caption`/`text-control` set only the size (line height comes from the context); `<Label>` adds 15px. Weights: `font-medium` 510, `font-semibold` 590, `font-bold` 700. Fonts: `font-sans`, `font-display`, `font-mono` (code/bytes only — use `tabular-nums` for numbers).
- Radii: `rounded-window` 26, `rounded-panel` 18, `rounded-group` 12, `rounded-note` 10, `rounded-small` 8, `rounded-menu` 13.
- Glass: utilities `glass-md` (rail, deck), `glass-sm` (+ `glass-lens-sm` for toolbar keys/readouts over the scene), `glass-lg` (sheets), `glass-menu`. Each handles the Chromium lens (`data-lens="on"`) and reduced transparency / increased contrast.
- Layout variants (app.css): `phone:` ≤ 759, `stacked:` ≤ 1099, `drawer:` ≤ 1279, `rail-column:` ≥ 1280, `console:` ≥ 1100 × 700, `console-short:` console with height ≤ 820, `console-tight:` ≥ 1100 wide and ≤ 760 tall, `short:` ≥ 760 wide and ≤ 820 tall, `opaque:` reduced transparency or more contrast, `dark:`, `lens:`. A rule for ≥ 1100px wide without a height condition uses `min-[1100px]:`; a lone height query uses `[@media(max-height:699px)]:`.
- **Multi-layer backgrounds must be `[background:…]`**, never `bg-[a,b]`: Tailwind types `bg-[linear-gradient(…),var(--accent)]` as an image and drops the colour layer. Same for stripes that must replace a base colour: `[background:repeating-linear-gradient(…)_padding-box]`.
- **`cn()` knows the theme names** (`src/lib/cn.ts` extends tailwind-merge with text sizes, radii, eases, `font-display`, `shadow-knob`). If you add a theme token that shares a prefix with colours (`text-*`, `bg-*`, `shadow-*`), add it there too, or `cn("text-caption text-label-2")` silently drops one class. There is a test (`src/lib/test/cn.test.ts`).
- Never name a colour like a font size: `--color-control` would make `text-control` also set the colour (hence `--color-control-fill`).
- `aria-current` has no built-in variant: write `aria-[current=true]:` (or `aria-[current=page]:`). `aria-pressed:`, `aria-selected:`, `aria-checked:`, `data-*:` work as is (Base UI sets `aria-pressed` on toggles, `aria-selected`/`data-active` on tabs, `data-checked` on switches, `data-dragging` on slider thumbs, `data-popup-open` on menu triggers, `data-highlighted` on menu items).
- Variant order matters inside one class: `phone:[&>span]:sr-only`, not `[&>span]:phone:sr-only`.
- Context-dependent looks are explicit: pick `variant="filled"` for keys in content, `<Label vibrant>` on glass (the deck already recolours labels); `Title`/`Text` shrink inside `.side-panel` on `console-short` automatically.
- Base UI Tabs unmount inactive panels (no `keepMounted`), which is what paging needs. `Tabs` renders `display: contents`, so the panels are flex children of the plate.
- Sheets are Base UI Dialogs in a portal: track open state in React and use it to mute the keyboard shortcuts. `SheetHead` already has the close key (`data-action="close-dialog"`).
- Base UI Slider: `thumbAlignment="edge"` (set in `<Slider>`) mimics the native range input; `onValueChange` gives `number | number[]` (cast). Give the thumb a name with `thumbLabel` or a visible label.
- The Pretendard npm package registers **"Pretendard Variable"**; the font stack lists it before `Pretendard`. Iosevka comes from `public/fonts` (`@font-face` in `tokens.css`).
- `index.html` sets `data-theme` *and* `class="dark"` before paint; `useTheme(explorer)` toggles both.
- Lint (`oxlint --deny-warnings`, plugins react, react-hooks via react, jsx-a11y, typescript, unicorn, oxc) is strict: no refs read during render (pass refs through their own context, see `useRailButton`), no `setState` synchronously inside an effect (subscribe to the event instead), no mutation of values from `useState`. Disable a rule only on the line with a reason (`// oxlint-disable-next-line rule -- why`).
- `oxfmt --write` reformats; run `npm run format` before `npm run lint`. It may turn `" "` escapes into literal no-break spaces — that is fine.
- tsx resolves the `@/` alias from `tsconfig.json`; import TS files with the `.ts`/`.tsx` extension (`allowImportingTsExtensions`).

## 9. Tests

- Engine and lesson tests live in `src/explorers/<slug>/test/*.test.ts` and run with `npm test` (`tsx --test "src/**/*.test.ts"`); shared helpers are tested in `src/lib/test/`. One explorer: `npx tsx --test "src/explorers/<slug>/**/*.test.ts"`.
- Type the engine first (`types.ts`, then annotate the exported functions; inner callbacks infer). In tests annotate helper params, add `!` after `find(…)` results the test knows exist, and cast literal option objects (`as SimulateOptions[]`).
- Browser flows go in `tests/<slug>.spec.ts` (Playwright, desktop 1440×900 and phone 390×844 projects); `tests/smoke.spec.ts` loads every page and fails on console errors.

## 10. Checklist for a change

- [ ] `check:scroll` ok for every lesson at 1100×700, 1280×720, 1440×900, 1920×1080, plus the other explorers still ok.
- [ ] Lesson rail: column ≥ 1280, drawer below (key "레슨", scrim, Escape, focus to the current lesson, focus back to the key), status dots + % follow progress.
- [ ] 목표 start screen shows no result; guided stops at every 핵심 장면 (count = progress `scenes` total); 장면 tab jumps and marks the current scene.
- [ ] Predictions: opening pauses and rewinds to just before the decision; nothing on screen gives the answer away (scene, tabs, step text, records); every choice has its why; reveal plays exactly that unit.
- [ ] Comparison: numbers match the engine tests; "이 방식으로 다시 보기" switches method; opening marks compared.
- [ ] 정리: points, recall questions with per-choice why, progress line, "다음 레슨/실험" link; answering moves to the answer's page.
- [ ] Keyboard: Space, ←/→, R (and the explorer's own keys), Esc closes sheets/drawer; not while typing or on a focused control.
- [ ] Reduced motion (no travel animations, pulses static), dark mode (theme key), reduced transparency, mobile stacking ≤ 759 (keys ≥ 42px, no horizontal page scroll).
- [ ] No console errors (`npm run test:browser`).
- [ ] lint, typecheck, test, build all green; the explorer's README (lessons, numbers, file table) updated.
- [ ] Shared code (`src/components/**`, `src/lib/**`) changed only generically: run every explorer's tests, the smoke test and `check:scroll` for all pages. Explorer-only parts live in `src/explorers/<slug>/`.
