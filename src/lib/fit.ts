// No-scroll helpers (port of shared/fit.js). On a desktop console nothing
// scrolls: content that does not fit is split into pages you step through
// (PagerStore + <PagedList>, src/components/learning/pager.tsx), or a window
// of rows that follows the current one (useRowWindow). Both re-fit when their
// box changes size. The console grid's middle row is sized by useConsoleRows.
//
// These helpers set `hidden` on DOM children imperatively, exactly like the
// vanilla version. React never renders a `hidden` prop on those children, so
// the two never fight over the attribute.
import { useLayoutEffect, useState, useSyncExternalStore, type RefObject } from "react";

/* ---------- Pages ---------- */

/** Page state shared by a <PagedList> and its <Pager> (which may sit elsewhere). */
export class PagerStore {
  page = 0;
  count = 1;
  /** Page index of every item key, filled by the list's layout. */
  keys = new Map<string, number>();
  private listeners = new Set<() => void>();
  private snapshot = { page: 0, count: 1 };

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snapshot;

  set(page: number, count: number) {
    const p = Math.max(0, Math.min(count - 1, page));
    if (p === this.page && count === this.count) return;
    this.page = p;
    this.count = count;
    this.snapshot = { page: p, count };
    for (const fn of this.listeners) fn();
  }
  show(page: number) {
    this.set(page, this.count);
  }
  /** Show the page that holds the item with this key. */
  showKey(key: string) {
    const page = this.keys.get(key);
    if (page !== undefined) this.show(page);
  }
  prev = () => this.show(this.page - 1);
  next = () => this.show(this.page + 1);
}

/** A PagerStore for this component's lifetime. */
export function usePager(): PagerStore {
  const [store] = useState(() => new PagerStore());
  return store;
}

/** { page, count } of a store, re-rendering on change. */
export function usePagerState(store: PagerStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/**
 * Split a list's element children into pages that fit the list's own height:
 * a page holds as many whole items as fit (an item taller than the box gets a
 * page of its own). Items are measured with their border box plus the list's
 * row-gap; margins between items are not counted, so space paged blocks with
 * `gap`, never `margin-top`.
 */
export function layoutPages(list: HTMLElement): HTMLElement[][] {
  const items = [...list.children] as HTMLElement[];
  for (const el of items) el.hidden = false;
  const box = list.clientHeight;
  if (!box) return [items];
  const pages: HTMLElement[][] = [[]];
  let used = 0;
  const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
  for (const el of items) {
    const h = el.getBoundingClientRect().height;
    const cur = pages.at(-1)!;
    const need = (cur.length ? gap : 0) + h;
    if (cur.length && used + need > box + 0.5) {
      pages.push([el]);
      used = h;
    } else {
      cur.push(el);
      used += need;
    }
  }
  return pages;
}

/** Sentences of a paragraph, for splitting a tall text block into pages. */
export const sentences = (text: string) => text.trim().split(/(?<=[.!?。])\s+(?=\S)/);

/* ---------- Row window ---------- */

/**
 * Show only the rows of a table body that fit its box, around the current row
 * (or the last row when none is current). Hidden rows stay in the DOM so
 * tables keep their behaviour; nothing scrolls. `box` bounds the table (header
 * included). Re-runs when `deps` change and when the box resizes.
 */
export function useRowWindow(
  box: RefObject<HTMLElement | null>,
  tbody: RefObject<HTMLTableSectionElement | null>,
  deps: unknown[],
  {
    current = (rows: HTMLTableRowElement[]) => rows.findIndex((r) => r.ariaCurrent === "true"),
    before = 0.4,
  } = {},
) {
  useLayoutEffect(() => {
    const boxEl = box.current;
    const body = tbody.current;
    if (!boxEl || !body) return;
    const refresh = () => {
      const rows = [...body.rows];
      rows.forEach((r) => (r.hidden = false));
      const head = boxEl.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      const room = boxEl.clientHeight - head - 4;
      const rowH = rows[0]?.getBoundingClientRect().height || 1;
      const fit = Math.max(1, Math.floor(room / rowH));
      if (rows.length <= fit) return;
      const cur = current(rows);
      const at = cur >= 0 ? cur : rows.length - 1;
      let start = Math.max(0, at - Math.floor(fit * before));
      start = Math.min(start, rows.length - fit);
      rows.forEach((r, i) => (r.hidden = i < start || i >= start + fit));
    };
    refresh();
    const observer = new ResizeObserver(refresh);
    observer.observe(boxEl);
    return () => observer.disconnect();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- callers pass what the rows depend on
  }, deps);
}

/* ---------- Console rows ---------- */

/**
 * Console rows: the records plate spans the middle row and the deck row, the
 * lesson spans the stage row and the middle row. The middle row is exactly
 * what the records need beyond the deck (--records-extra), so a taller
 * records plate takes its height from the stage and the lesson keeps
 * everything above the deck. The wanted records height is read from the
 * records plate's scroll-margin-top (set to var(--records-h) by the shell).
 */
export function useConsoleRows(
  consoleEl: RefObject<HTMLElement | null>,
  records: RefObject<HTMLElement | null>,
  deck: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    const grid = consoleEl.current;
    const rec = records.current;
    const dk = deck.current;
    if (!grid || !rec || !dk) return;
    const update = () => {
      const want = parseFloat(getComputedStyle(rec).scrollMarginTop) || 0;
      const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
      const extra = Math.max(0, want - dk.getBoundingClientRect().height - gap);
      grid.style.setProperty("--records-extra", `${Math.round(extra)}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(dk);
    observer.observe(grid);
    update();
    return () => observer.disconnect();
  }, [consoleEl, records, deck]);
}
