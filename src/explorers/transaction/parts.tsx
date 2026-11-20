// Small parts the transaction lessons share: a transaction id in its colour,
// SQL split between clauses, the records' seek key and row, and a row window
// for tables whose rows differ in height.
import { useLayoutEffect, type ReactNode, type RefObject } from "react";

import { Led } from "@/components/ui/content.tsx";
import { rowClass, Td } from "@/components/ui/table.tsx";
import { cn } from "@/lib/cn.ts";
import type { ClientId } from "./types.ts";

export const pad = (n: number) => String(n).padStart(2, "0");

/** A transaction id printed in its colour with its LED. */
export function TxId({ id, className }: { id: ClientId | "DB"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-sans font-semibold whitespace-nowrap tabular-nums",
        className,
      )}
    >
      {id !== "DB" && <Led color={`var(--${id.toLowerCase()})`} className="size-1.5" />}
      {id}
    </span>
  );
}

/**
 * SQL for the 이번 사건 block: each clause (SET, WHERE, FROM, ...) is one
 * inline block, so a long statement wraps between clauses ("... SET stock =
 * stock - 1 / WHERE id = 1;") instead of inside an expression.
 */
export function Sql({ sql, className, id }: { sql: string; className?: string; id?: string }) {
  const parts = sql.split(
    / (?=(?:SET|WHERE|FROM|VALUES|ORDER BY|FOR UPDATE|FOR SHARE|ISOLATION LEVEL)\b)/,
  );
  return (
    <code
      id={id}
      className={cn(
        "mt-2 block rounded-small bg-fill-2 px-3 py-[9px] font-mono text-caption leading-[1.6] font-medium text-label [font-variant-ligatures:none] break-words text-pretty",
        className,
      )}
    >
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && " "}
          <span className="inline-block">{part}</span>
        </span>
      ))}
    </code>
  );
}

/** Monospace SQL or app work inside a records cell. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-caption leading-[1.6] [font-variant-ligatures:none] break-words">
      {children}
    </code>
  );
}

/** The # cell's key: seeks to that event (the row seeks too, by pointer). */
export function SeekKey({ index, onSeek }: { index: number; onSeek: (index: number) => void }) {
  return (
    <button
      type="button"
      data-seek={index}
      aria-label={`${index}번째 사건으로 이동`}
      className="-mx-1 -my-0.5 cursor-pointer rounded-md border-0 bg-transparent px-1 py-0.5 font-[inherit] text-inherit tabular-nums hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent [tr[aria-current=true]_&]:font-semibold [tr[aria-current=true]_&]:hover:text-inherit [tr[aria-current=true]_&]:focus-visible:outline-on-accent"
      onClick={(event) => {
        event.stopPropagation();
        onSeek(index);
      }}
    >
      {pad(index)}
    </button>
  );
}

/** Classes for the records tables (cells middle-aligned, alert text in the accent). */
export const tableClass = "[&_td]:align-middle";
/** Text that marks a wait or an error. */
export const alertText = "text-accent-text [tr[aria-current=true]_&]:text-inherit";
/** Quieter text that stays readable on the current (accent) row. */
export const quietText =
  "text-label-2 [tr[aria-current=true]_&]:text-inherit [tr[aria-current=true]_&]:opacity-78";

/** A records row that seeks to its event. */
export function SeekRow({
  index,
  current,
  onSeek,
  step,
  children,
}: {
  index: number;
  current: boolean;
  onSeek: (index: number) => void;
  /** data-step: the timeline's row window follows the event on screen. */
  step?: boolean;
  children: ReactNode;
}) {
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the # key is the keyboard path
    <tr
      data-row-seek={index}
      data-step={step ? index : undefined}
      data-clickable=""
      aria-current={current ? "true" : undefined}
      className={rowClass}
      onClick={() => onSeek(index)}
    >
      <Td>
        <SeekKey index={index} onSeek={onSeek} />
      </Td>
      {children}
    </tr>
  );
}

/** A row not reached yet: only its number. */
export function FutureRow({ index }: { index: number }) {
  return (
    <tr data-step={index} className={cn(rowClass, "[&>td]:text-label-2")}>
      <Td>
        <span className="tabular-nums">{pad(index)}</span>
      </Td>
      <Td colSpan={4}>·</Td>
    </tr>
  );
}

const DESKTOP = "(min-width: 1100px) and (min-height: 700px)";

/**
 * Records tables never scroll: show the rows that fit the box, around the
 * current row (a little history before it, the rest after). Like useRowWindow
 * (src/lib/fit.ts), but it measures every row (rows differ in height here)
 * and leaves the table whole on narrow screens, where the page scrolls.
 */
export function useFollowRows(
  box: RefObject<HTMLElement | null>,
  deps: unknown[],
  {
    before = 0.4,
    current = (tbody: HTMLTableSectionElement) =>
      tbody.querySelector<HTMLTableRowElement>('tr[aria-current="true"]'),
  }: {
    before?: number;
    current?: (tbody: HTMLTableSectionElement) => HTMLTableRowElement | null;
  } = {},
) {
  useLayoutEffect(() => {
    const boxEl = box.current;
    if (!boxEl) return;
    const desktop = matchMedia(DESKTOP);
    const refresh = () => {
      const tbody = boxEl.querySelector("tbody");
      if (!tbody) return;
      const rows = [...tbody.rows];
      rows.forEach((r) => (r.hidden = false));
      if (
        !rows.length ||
        !desktop.matches ||
        !boxEl.clientHeight ||
        boxEl.scrollHeight <= boxEl.clientHeight + 1
      )
        return;
      const heights = rows.map((r) => r.getBoundingClientRect().height);
      const total = heights.reduce((a, b) => a + b, 0);
      const room = boxEl.clientHeight - (boxEl.scrollHeight - total) - 2;
      const cur = current(tbody);
      // Before the first event nothing is current: show the table from its top.
      const at = cur && rows.includes(cur) ? rows.indexOf(cur) : 0;
      let start = at;
      let end = at;
      let used = heights[at];
      for (;;) {
        const wantBefore =
          start > 0 && (at - start < before * (end - start + 2) || end === rows.length - 1);
        const i = wantBefore ? start - 1 : end + 1;
        if (i < 0 || i >= rows.length || used + heights[i] > room) break;
        used += heights[i];
        if (wantBefore) start = i;
        else end = i;
      }
      rows.forEach((r, i) => (r.hidden = i < start || i > end));
      // Safety net for rounding: drop rows from the end farther from the current one.
      while (boxEl.scrollHeight > boxEl.clientHeight + 1 && end > start) {
        if (end - at >= at - start) rows[end--].hidden = true;
        else rows[start++].hidden = true;
      }
    };
    refresh();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    });
    observer.observe(boxEl);
    desktop.addEventListener("change", refresh);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      desktop.removeEventListener("change", refresh);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- callers pass what the rows depend on
  }, deps);
}
