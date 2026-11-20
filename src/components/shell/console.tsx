// The console: rail | stage | side over records | deck (docs/DESIGN.md →
// Full-screen console). On a desktop ≥ 1100 × 700 it fills the window and
// never scrolls; below that it stacks (≤ 1099px) and the page scrolls.
import { useLayoutEffect, useRef, type ReactNode } from "react";

import { Label, Index } from "@/components/ui/typography.tsx";
import { Kbd } from "@/components/ui/content.tsx";
import { cn } from "@/lib/cn.ts";
import { Plate, PlateHead } from "./plate.tsx";

/**
 * The grid. Children: <LessonRail>, <Stage>, <Deck>, <SidePanel>, <Records>
 * (any order; each places itself by grid area). Tune the split with
 * `sideWidth` / `recordsHeight` (CSS lengths), never the areas.
 */
export function Console({
  className,
  sideWidth,
  recordsHeight,
  style,
  children,
}: {
  className?: string;
  sideWidth?: string;
  recordsHeight?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  // --records-extra: what the records need beyond the deck (see fit.ts).
  useLayoutEffect(() => {
    const grid = ref.current;
    const records = grid?.querySelector<HTMLElement>(':scope > [data-plate="records"]');
    const deck = grid?.querySelector<HTMLElement>(':scope > [data-plate="deck"]');
    if (!grid || !records || !deck) return;
    const update = () => {
      const want = parseFloat(getComputedStyle(records).scrollMarginTop) || 0;
      const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
      const extra = Math.max(0, want - deck.getBoundingClientRect().height - gap);
      grid.style.setProperty("--records-extra", `${Math.round(extra)}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(deck);
    observer.observe(grid);
    update();
    return () => observer.disconnect();
  }, []);
  const vars = {
    ...(sideWidth ? { "--side-w-console": sideWidth } : {}),
    ...(recordsHeight ? { "--records-h-console": recordsHeight } : {}),
    ...style,
  } as React.CSSProperties;
  return (
    <main
      ref={ref}
      className={cn(
        "console-grid",
        sideWidth && "console:[--side-w:var(--side-w-console)]",
        recordsHeight && "console:[--records-h:var(--records-h-console)]",
        className,
      )}
      style={vars}
    >
      {children}
    </main>
  );
}

/**
 * The stage: content on the window itself (no group fill). Its box reaches
 * under the toolbar and the rail; the scene goes in as children (a box that
 * fills the remaining height). `head` sits top right of the label (tag,
 * readout); `foot` is one short status line.
 */
export function Stage({
  index = "A",
  label,
  head,
  foot,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "children"> & {
  index?: string;
  label: string;
  head?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      data-plate="stage"
      aria-labelledby="stage-label"
      className={cn(
        "relative z-0 min-w-0 rounded-none bg-transparent [grid-area:stage] stage-reach",
        "console:flex console:min-h-0 console:flex-col console:overflow-hidden",
        className,
      )}
      {...props}
    >
      <PlateHead className="relative z-[1] px-1 console-short:min-h-9 console-short:pt-1 console-short:pb-[2px] phone:px-1 [&>[data-slot=tag]]:h-7 [&>[data-slot=tag]]:self-center [&>[data-slot=tag]]:px-[11px]">
        <Label id="stage-label">
          <Index>{index}</Index> {label}
        </Label>
        {head}
      </PlateHead>
      {children}
      {foot !== undefined && (
        <div
          aria-hidden="true"
          className="relative z-[1] flex min-h-10 items-center gap-2.5 border-t-0 px-1 py-2 text-caption text-label-2 console-short:min-h-[30px] console-short:py-1"
        >
          {foot}
        </div>
      )}
    </section>
  );
}

/** The box the scene SVG fills (absolutely on the console, by width when stacked). */
export const sceneBoxClass = cn(
  "relative min-h-[460px] phone:min-h-0",
  "console:min-h-0 console:flex-auto console:overflow-visible",
  "[&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:overflow-visible",
  "console:[&>svg:first-child]:absolute console:[&>svg:first-child]:inset-0 console:[&>svg:first-child]:size-full console:[&>svg:first-child]:max-h-none",
);

/** The deck: the floating control palette (Medium glass) in the side column. */
export function Deck({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-plate="deck"
      className={cn(
        "relative z-[1] flex flex-wrap items-end gap-x-5 gap-y-3.5 rounded-panel glass-md px-4 pt-3.5 pb-4 [grid-area:deck]",
        "[&_[data-slot=label]]:text-vlabel-2",
        "phone:gap-3 phone:p-3",
        "console:min-w-0 console:content-start console:items-start console:gap-x-3.5 console:gap-y-2.5 console:overflow-hidden console:px-3.5 console:pt-3 console:pb-3.5",
        "console-short:gap-x-3 console-short:gap-y-2 console-short:px-3 console-short:pt-2.5 console-short:pb-3",
        className,
      )}
      {...props}
    />
  );
}

/** A labelled control group in the deck. */
export function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-1.5 [&>[data-slot=label]:first-child]:min-h-[15px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The lesson column (content group). Put <Tabs> inside with the list in a
 * <PlateHead>; each panel is a fit column (see fit-column / PagedList).
 */
export function SidePanel({ className, ...props }: React.ComponentProps<"aside">) {
  return (
    <Plate
      as="aside"
      data-plate="side"
      className={cn(
        "side-panel self-stretch [grid-area:side]",
        "console:flex console:min-h-0 console:flex-col console:overflow-hidden console:[contain:size]",
        className,
      )}
      {...props}
    />
  );
}

/** The records group under the stage: tabs in the head, one record per panel. */
export function Records({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <Plate
      data-plate="records"
      className={cn(
        "[grid-area:records]",
        "console:flex console:min-h-0 console:flex-col console:overflow-hidden console:[contain:size] console:scroll-mt-[var(--records-h)]",
        className,
      )}
      {...props}
    />
  );
}

/** The footer: keyboard legend (hidden on phones) and sources. */
export function Footer({ shortcuts, sources }: { shortcuts: ReactNode; sources: ReactNode }) {
  return (
    <footer
      className={cn(
        "mx-auto mt-[18px] flex max-w-[1680px] flex-wrap justify-between gap-x-5 gap-y-1.5 text-caption text-label-2 [&_a]:text-inherit [&_a]:underline",
        "console:mx-1 console:mt-1.5 console:mb-0 console:max-w-none console:flex-none",
      )}
    >
      <span className="phone:hidden">{shortcuts}</span>
      <span>{sources}</span>
    </footer>
  );
}

export { Kbd };
