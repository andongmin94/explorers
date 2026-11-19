// No-scroll helpers. On a desktop console nothing scrolls: content that does
// not fit is split into pages you step through, or a window of rows that
// follows the current one. Both re-fit when their box changes size.

/**
 * Split a list's children into pages that fit the list's own height and add
 * a pager (‹ 1 / 3 ›) after it. Returns { refresh(), show(page), showItem(el) }.
 *
 * The list must have a definite height (e.g. flex: 1; min-height: 0 inside a
 * column flex box). Items are never cut: a page holds as many whole items as
 * fit; an item taller than the box gets a page of its own.
 */
export function paginate(list, { label = "페이지", pager } = {}) {
  let pages = [[]];
  let page = 0;
  const bar = pager ?? document.createElement("div");
  if (!pager) {
    bar.className = "hw-pager";
    list.after(bar);
  }
  bar.innerHTML = `<button type="button" class="hw-key hw-key--sm hw-key--icon" data-dir="-1" aria-label="이전 ${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><span class="hw-pager-count hw-mono" aria-live="polite"></span><button type="button" class="hw-key hw-key--sm hw-key--icon" data-dir="1" aria-label="다음 ${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>`;
  const [prev, next] = bar.querySelectorAll("button");
  const count = bar.querySelector(".hw-pager-count");

  // A paragraph taller than the space left on a page would move whole to the
  // next page and leave a mostly empty one. Plain-text blocks that are tall
  // are split into one block per sentence so pages fill evenly.
  function splitTallText(box) {
    for (const el of [...list.children]) {
      if (el.dataset.split || el.children.length || !box) continue;
      if (el.getBoundingClientRect().height < box * 0.35) continue;
      const sentences = el.textContent.trim().split(/(?<=[.!?。])\s+(?=\S)/);
      if (sentences.length < 2) continue;
      const parts = sentences.map((sentence, i) => {
        const part = el.cloneNode(false);
        part.textContent = sentence;
        part.dataset.split = i ? "cont" : "first";
        return part;
      });
      el.replaceWith(...parts);
    }
  }

  function layout() {
    list.querySelectorAll(":scope > [hidden]").forEach((el) => (el.hidden = false));
    splitTallText(list.clientHeight);
    const items = [...list.children];
    const box = list.clientHeight;
    pages = [[]];
    if (!box) {
      pages = [items];
    } else {
      let used = 0;
      const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
      for (const el of items) {
        const h = el.getBoundingClientRect().height;
        const cur = pages.at(-1);
        const need = (cur.length ? gap : 0) + h;
        if (cur.length && used + need > box + 0.5) {
          pages.push([el]);
          used = h;
        } else {
          cur.push(el);
          used += need;
        }
      }
    }
    page = Math.min(page, pages.length - 1);
    render();
  }
  function render() {
    pages.forEach((group, i) => group.forEach((el) => (el.hidden = i !== page)));
    bar.hidden = pages.length < 2;
    count.textContent = `${page + 1} / ${pages.length}`;
    prev.disabled = page === 0;
    next.disabled = page === pages.length - 1;
  }
  bar.addEventListener("click", (event) => {
    const dir = Number(event.target.closest("[data-dir]")?.dataset.dir);
    if (!dir) return;
    page = Math.max(0, Math.min(pages.length - 1, page + dir));
    render();
  });
  new ResizeObserver(() => layout()).observe(list);
  layout();
  return {
    refresh: layout,
    show(p) {
      page = Math.max(0, Math.min(pages.length - 1, p));
      render();
    },
    showItem(el) {
      const i = pages.findIndex((group) => group.includes(el));
      if (i >= 0) {
        page = i;
        render();
      }
    },
  };
}

/**
 * Show only the rows of a table body that fit its scroll box, centred on the
 * current row (or the last row when none is current). Hidden rows stay in
 * the DOM so tables keep their behaviour; nothing scrolls.
 *
 * box: the element whose height bounds the table (header included).
 * current: () => the current <tr> or null.
 * Returns { refresh() }; call it after rows change or the current row moves.
 */
export function rowWindow(box, tbody, { current = () => null, before = 0.4 } = {}) {
  function refresh() {
    const rows = [...tbody.rows];
    rows.forEach((r) => (r.hidden = false));
    const head = box.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    const room = box.clientHeight - head - 4;
    const rowH = rows[0]?.getBoundingClientRect().height || 1;
    const fit = Math.max(1, Math.floor(room / rowH));
    if (rows.length <= fit) return;
    const cur = current();
    const at = cur ? rows.indexOf(cur) : rows.length - 1;
    let start = Math.max(0, at - Math.floor(fit * before));
    start = Math.min(start, rows.length - fit);
    rows.forEach((r, i) => (r.hidden = i < start || i >= start + fit));
  }
  new ResizeObserver(refresh).observe(box);
  refresh();
  return { refresh };
}

/**
 * Tabs inside a plate head: buttons with data-tab="name" switch panels with
 * data-panel="name" (role="tab"/"tabpanel", arrow keys move between tabs).
 * Returns { select(name) }.
 */
export function plateTabs(root, { onChange = () => {} } = {}) {
  const tabs = [...root.querySelectorAll("[data-tab]")];
  const panels = [...root.querySelectorAll("[data-panel]")];
  function select(name, focus = false) {
    for (const t of tabs) {
      const on = t.dataset.tab === name;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    }
    for (const p of panels) p.hidden = p.dataset.panel !== name;
    onChange(name);
  }
  for (const t of tabs) {
    t.setAttribute("role", "tab");
    t.addEventListener("click", () => select(t.dataset.tab));
    t.addEventListener("keydown", (e) => {
      const i = tabs.indexOf(t);
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      select(tabs[(i + d + tabs.length) % tabs.length].dataset.tab, true);
    });
  }
  for (const p of panels) p.setAttribute("role", "tabpanel");
  select(tabs.find((t) => t.getAttribute("aria-selected") === "true")?.dataset.tab ?? tabs[0]?.dataset.tab);
  return { select };
}

/**
 * Console rows: the records plate spans the middle row and the deck row, the
 * lesson spans the stage row and the middle row. The middle row is exactly
 * what the records need beyond the deck, so a taller records plate takes its
 * height from the stage and the lesson keeps everything above the deck.
 */
function bindConsoleRows() {
  const console = document.querySelector(".hw-console");
  const records = console?.querySelector(":scope > .hw-records");
  const deck = console?.querySelector(":scope > .hw-deck");
  if (!records || !deck) return;
  const update = () => {
    const want = parseFloat(getComputedStyle(records).scrollMarginTop) || 0;
    const gap = parseFloat(getComputedStyle(console).rowGap) || 0;
    const extra = Math.max(0, want - deck.getBoundingClientRect().height - gap);
    console.style.setProperty("--records-extra", `${Math.round(extra)}px`);
  };
  const observer = new ResizeObserver(update);
  observer.observe(deck);
  observer.observe(console);
  // The records height can change with a class (e.g. while inspecting).
  new MutationObserver(update).observe(console, { subtree: true, attributes: true, attributeFilter: ["class"] });
  update();
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindConsoleRows, { once: true });
  else queueMicrotask(bindConsoleRows);
}
