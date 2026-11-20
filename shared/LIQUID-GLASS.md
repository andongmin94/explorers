# Liquid Glass spec (from Apple's macOS 26 and iOS/iPadOS 26 UI kits)

Numbers read with the Figma MCP from Apple's kits: macOS 26 `CFWN1l1xNoavx0pS8LXrLi`, iOS/iPadOS 26 `cNTEmpHVm25v16g9Fhk0vJ`. Node ids are given so every value can be re-checked. Implementation: `theme.css` (tokens) and `hw.css` (parts). Deviations for the web are marked **web**.

## Materials (macOS Materials `483:8848`)

| Material | Node | Light | Dark | Shape / shadow |
|---|---|---|---|---|
| Liquid Glass Small (controls) | `483:9263` (`483:9270` light, `483:9282` dark) | `#333` color-dodge + `#f7f7f7` / `rgba(255,255,255,.5)` | opacity .67 · `rgba(204,204,204,.5)` color-burn + `rgba(255,255,255,.06)` over `rgba(0,0,0,.6)` | capsule (r 1000) · `0 8px 40px rgba(0,0,0,.12)` |
| Small Primary | `483:9264` | `#0091ff` over white 50% (+ saturation white, overlay `#999`) | same tint | capsule · same shadow |
| Liquid Glass Medium (sidebars, palettes) | `483:9250` (`483:9257`/`483:9251`) | `#262626` color-dodge + `rgba(245,245,245,.67)` | opacity .67 · `#ccc` color-burn + `rgba(255,255,255,.03)` over `rgba(0,0,0,.67)` | r 34 (sidebar instance r 18) · `0 8px 40px rgba(0,0,0,.12)` |
| Liquid Glass Large (sheets) | `483:9237` | `#262626` color-dodge + `rgba(250,250,250,.8)` | opacity .67 · `#ccc` color-burn + `rgba(255,255,255,.03)` over `rgba(0,0,0,.85)` | r 34 · same shadow |
| Glass Effect layer | every glass symbol | `rgba(0,0,0,.2)` screen — placeholder for the system's refraction/specular pass | same | — |
| Menu background | `488:1821` | `#262626` color-dodge + `rgba(245,245,245,.67)` | (dark by tokens) | r 13 · `0 0 2px rgba(0,0,0,.1), 0 0 25px rgba(0,0,0,.16)` |
| Popover | `121:11348` | white 70% lighten + `#fafafa` 20% darken | — | r ≈16 · `0 4px 20px rgba(0,0,0,.15)` + 1.25px contact |

**web**: color-dodge/burn over the backdrop are approximated with `backdrop-filter: blur() saturate() brightness()`; the Glass Effect layer becomes a specular rim (bright 1px inner edge, stronger top-left) plus, in Chromium, an SVG displacement filter (`#lg-lens`, `shared/glass.js`) that bends the backdrop at the edges. `prefers-reduced-transparency` / `prefers-contrast: more` → opaque fill, no blur, visible border.

## Window and layout (Examples `2548:2856` Toolbar + Titlebar, `2548:2849` Form)

| Part | Value |
|---|---|
| Window | `#fff`, r 26 (`2302:6361`; titlebar window r 16), `0 0 0 1px rgba(0,0,0,.23), 0 16px 48px rgba(0,0,0,.35)` |
| Sidebar | Medium glass floating inset 8px from the window edges, r 18 (`2302:6364`), width 240 incl. inset |
| Toolbar | height 52, padding 8, items 36 tall, gap 8; no bar background — controls float as glass capsules over the content (`684:18081`) |
| Toolbar capsule group | Small glass, padding 4, buttons 28×≥28 r 100, 13px Medium, separator 1×20 `#d9d9d9` (`684:18082`, `684:18085`) |
| Search field | 36 tall, r 100, Small glass, 13px Medium `#727272` (`586:10582`) |
| Window title | 15px Bold, primary label (`177:11506`); subtitle 11px Medium `#999` |
| Content | extends under the toolbar; content is **not glass** |
| Form group (content sections) | fill `rgba(0,0,0,.03)` (Fills opaque/quaternary), r 12, padding-x 10, rows min 42, row rule `rgba(0,0,0,.05)` (`2302:6716`) |
| Sidebar row | 24 tall, px 10, inner r 8; selected `rgba(0,0,0,.11)` multiply, selected icon accent; 11px Medium (`655:2379`) |
| Sidebar section header | 11px Bold `rgba(0,0,0,.5)`, pt 15 pb 5 (`97:8754`) |
| Scrollbar thumb | 6 wide, `rgba(0,0,0,.15)` |

Decision: the console's reading panels (side 해설, records) are content → form-group style (opaque, not glass). Toolbar, lesson rail (sidebar), deck (control palette), menus, dialogs are glass.

## Controls

| Control | Node | Geometry | Fills |
|---|---|---|---|
| Push button, Bordered Neutral | `121:11924` | h 24, px 16, r 6, 13px Medium 510 | `rgba(0,0,0,.05)`; clicked `.15`; label `#1a1a1a` |
| Push button, Default/Preferred | `502:5866` | same | Controls tint `#0d6fff`, white label (plus-lighter) |
| Bordered Secondary | `502:5854` | same | tint 10%, label accent |
| Bordered Destructive | `502:5860` | same | red `#ff383c` |
| Segmented control | `121:12398`, segment `498:4492` | h 24, r 6, segment px 10, separator 1×14 `#d9d9d9` | track `rgba(0,0,0,.05)`; selected = tint fill, white 13px Medium |
| Switch | `468:808` on / `468:810` off | track 54×24 (mini 36×16, 44×20, 64×28, 80×36), inset 2, knob 32×20 white | on tint; off `rgba(0,0,0,.05)`; knob `0 0 1px rgba(0,0,0,.05), 0 0 4px rgba(0,0,0,.05), 0 0 44px rgba(0,0,0,.1)` |
| Slider | `512:3367`, dragged `531:11145` | h 24, track 6 with 1px inset (4 visible), r 100; knob 20×16 capsule | filled tint, unfilled `rgba(0,0,0,.05)`; knob white 65%+45% lighten+35%, same knob shadow; dragged knob becomes clear glass, filled track +15% black |
| Ticks | `513:13484` | 2×2 dots, 25% black, 7px under the track | — |
| Checkbox / radio | `497:3827`, `121:12142` | 16, r 5.5 / round | tint + white glyph; off `rgba(0,0,0,.05)` |
| Text field | `687:28078` | h 24, r 6, pl 8 | white + `0 0 0 1px rgba(0,0,0,.08)` |
| Menu item | `240:7920` | h 24, pl 12, r 8, highlight inset −7px | highlight `#08f` (accent), white label; separator `#e6e6e6` 1px in 11px |
| Table column header | `121:12610` | h 28, 11px Bold primary (sorted) / Medium secondary, bottom `rgba(0,0,0,.05)`, column rule `rgba(0,0,0,.1)` | — |
| Table row | `121:12779` | h 20, px 8, 13px Medium | alternating `rgba(0,0,0,.03)`; selected `#2962d9` white, r 8 at the row ends; inactive `rgba(0,0,0,.14)` |
| iOS tab bar | `507:24689` | capsule glass bar, selected item = grey pill + accent glyph/label | — |

**web**: desktop explorers are used with a mouse and on touch laptops, so control heights step up one size class: keys 32 (sm 28), segments 32, switch 44×24, slider knob 24×20, rows ≥ 32; on ≤ 759px keys stay ≥ 42. Large controls (≥ 28) use the capsule shape Apple uses for large/extra-large sizes.

## Colors (`0:687`, variables on `0:765`)

| Accent | Light | Dark | Used for |
|---|---|---|---|
| Blue | `#0088ff` | `#0091ff` | protocol |
| Orange | `#ff8d28` | `#ff9230` | cpu |
| Green | `#34c759` | `#30d158` | memory |
| Pink | `#ff2d55` | `#ff375f` | transaction |
| Yellow | `#ffcc00` | `#ffd600` | disk (black label on it) |
| Purple | `#cb30e0` | `#db34f2` | git |
| Red | `#ff383c` | `#ff4245` | destructive |
| Indigo / Mint / Teal / Cyan / Brown / Gray | `#6155f5` `#00c8b3` `#00c3d0` `#00c0e8` `#ac7f5e` `#8e8e93` | `#6d7cff` `#00dac3` `#00d2e0` `#3cd3fe` `#b78a66` `#98989f` | semantic |

| Label / fill | Light | Dark |
|---|---|---|
| Label primary / secondary / tertiary / quaternary / quinary | `#000000d9` `#00000080` `#00000040` `#0000001a` `#0000000d` | `#ffffffd9` `#ffffff8c` `#ffffff40` `#ffffff1a` `#ffffff0d` |
| Vibrant label primary / secondary / tertiary / quaternary (on glass) | `#1a1a1a` `#727272` `#bfbfbf` `#d9d9d9` | `#f5f5f5` `#8a8a8a` `#404040` `#262626` |
| Fills opaque primary…quinary | (black 10/8/5/3/2%) | `#ffffff1a` `14` `0d` `08` `05` |
| Controls tint | `#0d6fff` | — |

## Type (`0:962`, styles on `0:1745`)

| Style | Size / line | Regular | Emphasized |
|---|---|---|---|
| Large Title | 26 / 32 | 400 | 700 |
| Title 1 | 22 / 26 | 400 | 700 |
| Title 2 | 17 / 22 | 400 | 700 |
| Title 3 | 15 / 20 | 400 | 590 |
| Headline | 13 / 16 | 700 | 860 |
| Body | 13 / 16 | 400 | 590 |
| Callout | 12 / 15 | 400 | 590 |
| Subheadline | 11 / 14 | 400 | 590 |
| Footnote / Caption 1 / Caption 2 | 10 / 13 | 400 / 400 / 510 | 590 / 510 / 590 |

Controls use 13px Medium (510). Letter-spacing 0 at these sizes. **web**: SF Pro cannot ship; the stack is `-apple-system, BlinkMacSystemFont, "SF Pro Text", Pretendard, system-ui, sans-serif` (Pretendard Variable carries 510/590). The project keeps its 12px floor, so Subheadline/Footnote/Caption roles render at 12px; Korean reading text (`.hw-text`) is 14/1.55 between macOS Body and iPadOS Body. Monospace only for code, packet bytes and `.hw-mono` numbers.

## Mapping to the explorer parts

| Part | Liquid Glass role |
|---|---|
| `.hw-topbar` | window toolbar: no background; switcher, title, actions float as glass |
| `.hw-stage` / `.hw-scene` | content layer; on desktop the stage box extends under the toolbar and lesson rail (window backdrop) |
| `.hw-rail` | sidebar: Medium glass, inset, r 18 |
| `.hw-deck` | floating control palette: Medium glass, r 18 |
| `.hw-side`, `.hw-records`, other `.hw-plate` | content: form group fill, r 12 (not glass) |
| `.hw-key` | Small glass capsule (bordered neutral inside content panels); `--accent` = Primary tint |
| `.hw-seg` | segmented control (tint selection); `.hw-tabs` = tab-bar pill selection |
| `.hw-switch`, `.hw-slider` | switch, slider (glass knob) |
| `.hw-list`, `.hw-table` | sidebar/list rows, table with column header + alternating rows |
| `.hw-dialog`, `.explorer-menu` | sheet (Large glass r 26) / menu (r 13) |
| `.hw-lcd`, `.hw-led`, `.hw-label`, `.hw-tag` | monospaced-digit readout badge, 8px status dot, secondary label, capsule badge |
