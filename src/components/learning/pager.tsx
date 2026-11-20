// Content that does not fit is split into pages, never scrolled
// (shared/DESIGN.md → Nothing scrolls). <PagedList> renders blocks in a box
// with a definite height and hides whole blocks that do not fit on the current
// page; <Pager> (‹ 1 / 3 ›) steps through them and may sit anywhere (e.g. in
// an action row under the list). Both share a PagerStore from usePager().
//
//   const pager = usePager();
//   <PagedList pager={pager} resetKey={step} items={[{ key: "a", node: <…/> }, { key: "b", text: "…", className: "…" }]} />
//   <Pager pager={pager} label="해설" />
//
// A `text` item is a plain paragraph: when it is taller than a third of the
// box it is split into one block per sentence so pages fill evenly (the
// vanilla paginate() did the same in the DOM).
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  cloneElement,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/cn.ts";
import { layoutPages, sentences, usePagerState, type PagerStore } from "@/lib/fit.ts";

export { usePager } from "@/lib/fit.ts";

const NONE: ReadonlySet<string> = new Set();

export interface PagedItem {
  key: string;
  /** Any block (wrapped in a <div>). */
  node?: ReactNode;
  /** A block that is itself the list child (e.g. a list row <button>); it gets data-key. */
  element?: ReactElement<Record<string, unknown>>;
  /** A plain paragraph that may be split into sentences. */
  text?: string;
  className?: string;
  /** Mark a block that is only a note: it gets no hairline above it. */
  note?: boolean;
}

export function PagedList({
  items,
  pager,
  resetKey,
  className,
  as: Tag = "div",
  textAs: TextTag = "p",
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  items: PagedItem[];
  pager: PagerStore;
  /** When it changes, the list starts again on its first page (new content). */
  resetKey?: unknown;
  as?: "div" | "ul" | "ol" | "nav" | "dl";
  /** Element for text items: "p" in a column of blocks, "li" in a list. */
  textAs?: "p" | "li";
}) {
  const List = Tag as "div";
  const Para = TextTag as "p";
  const ref = useRef<HTMLDivElement>(null);
  // Split paragraphs belong to one content (resetKey); new content starts unsplit.
  const [splitState, setSplitState] = useState<{ key: unknown; keys: ReadonlySet<string> }>(() => ({
    key: resetKey,
    keys: new Set(),
  }));
  const split = splitState.key === resetKey ? splitState.keys : NONE;
  const lastReset = useRef<unknown>(resetKey);
  // Re-render (and so re-apply the page) when the pager moves.
  usePagerState(pager);

  // Measure after every render (cheap: a handful of blocks) and on resize.
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const layout = () => {
      // A tall plain paragraph becomes one block per sentence (re-renders once).
      const box = list.clientHeight;
      if (box) {
        for (const el of [...list.children] as HTMLElement[]) {
          const key = el.dataset.textKey;
          if (!key || split.has(key)) continue;
          el.hidden = false;
          if (el.getBoundingClientRect().height < box * 0.35) continue;
          if (sentences(el.textContent ?? "").length < 2) continue;
          setSplitState({ key: resetKey, keys: new Set(split).add(key) });
          return;
        }
      }
      // New content starts again on its first page.
      const want = lastReset.current === resetKey ? pager.page : 0;
      const pages = layoutPages(list);
      pager.keys.clear();
      pages.forEach((group, i) =>
        group.forEach((el) => el.dataset.key && pager.keys.set(el.dataset.key, i)),
      );
      const current = Math.max(0, Math.min(want, pages.length - 1));
      pages.forEach((group, i) => group.forEach((el) => (el.hidden = i !== current)));
      pager.set(current, pages.length);
      lastReset.current = resetKey;
    };
    layout();
    const observer = new ResizeObserver(() => layout());
    observer.observe(list);
    return () => observer.disconnect();
  });

  return (
    <List ref={ref} data-fill="" className={cn("min-h-0", className)} {...props}>
      {items.flatMap((item) => {
        if (item.element) {
          return cloneElement(item.element, { key: item.key, "data-key": item.key });
        }
        if (item.text === undefined) {
          return (
            <div
              key={item.key}
              data-key={item.key}
              data-note-block={item.note || undefined}
              className={item.className}
            >
              {item.node}
            </div>
          );
        }
        if (!split.has(item.key)) {
          return (
            <Para
              key={item.key}
              data-key={item.key}
              data-text-key={item.key}
              className={item.className}
            >
              {item.text}
            </Para>
          );
        }
        return sentences(item.text).map((sentence, i) => (
          <Para
            key={`${item.key}:${i}`}
            data-key={`${item.key}:${i}`}
            data-split={i ? "cont" : "first"}
            className={item.className}
          >
            {sentence}
          </Para>
        ));
      })}
    </List>
  );
}

/** ‹ 1 / 3 ›: hidden when everything fits on one page. */
export function Pager({
  pager,
  label = "페이지",
  className,
}: {
  pager: PagerStore;
  label?: string;
  className?: string;
}) {
  const { page, count } = usePagerState(pager);
  return (
    <div
      data-slot="pager"
      hidden={count < 2}
      className={cn("flex items-center justify-end gap-2 pt-2", className)}
    >
      <Button
        variant="filled"
        size="icon-sm"
        aria-label={`이전 ${label}`}
        disabled={page === 0}
        onClick={pager.prev}
      >
        <ChevronLeftIcon aria-hidden="true" />
      </Button>
      <span
        className="min-w-11 text-center font-sans text-caption text-label-2 tabular-nums"
        aria-live="polite"
      >
        {page + 1} / {count}
      </span>
      <Button
        variant="filled"
        size="icon-sm"
        aria-label={`다음 ${label}`}
        disabled={page >= count - 1}
        onClick={pager.next}
      >
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
