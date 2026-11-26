import { cn } from "@/lib/cn.ts";

/*
 * Content parts (not glass, not controls): the tag badge, the readout, the
 * status dot, progress dots, the inline note, lists and the keyboard key.
 * docs/DESIGN.md → Liquid Glass parts.
 */

/** Badge: a quiet capsule, not a control. */
export function Tag({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tag"
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full border-0 bg-fill-3 px-[9px]",
        "font-sans text-caption font-medium whitespace-nowrap text-label-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A number that changes: tabular digits on a quiet capsule. `glass` floats it
 * over the scene (stage head). The unit goes in <small>.
 */
export function Readout({
  className,
  glass,
  large,
  ...props
}: React.ComponentProps<"span"> & { glass?: boolean; large?: boolean }) {
  return (
    <span
      data-slot="readout"
      className={cn(
        "inline-flex min-h-7 items-baseline gap-1 rounded-full bg-fill-3 px-2.5 py-[6px]",
        "font-sans text-control leading-4 font-semibold whitespace-nowrap text-label tabular-nums",
        "[&_small]:text-caption [&_small]:font-medium [&_small]:text-label-2",
        large && "min-h-9 px-3.5 py-[7px] text-title leading-[22px] font-bold",
        glass && "glass-sm glass-lens-sm shadow-[var(--lg-rim),0_4px_16px_rgb(0_0_0/0.08)]",
        className,
      )}
      {...props}
    />
  );
}

/** Status dot: 8px; `color` is any CSS colour (default the accent); off = quaternary label. */
export function Led({
  className,
  color,
  on = true,
  style,
  ...props
}: React.ComponentProps<"span"> & { color?: string; on?: boolean }) {
  return (
    <span
      data-slot="led"
      data-on={on || undefined}
      className={cn(
        "inline-block size-2 flex-none rounded-full bg-label-4",
        on && "bg-[var(--led,var(--accent))]",
        className,
      )}
      style={{ ...(color ? { "--led": color } : {}), ...style } as React.CSSProperties}
      {...props}
    />
  );
}

/** Progress dots (6px); `got` of `total` are on. */
export function Meter({
  total,
  got,
  className,
}: {
  total: number;
  got: number;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("inline-flex items-center gap-1", className)}>
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={cn(
            "size-1.5 rounded-full bg-fill-1",
            i < got && "bg-[var(--led,var(--accent))]",
          )}
        />
      ))}
    </span>
  );
}

/** Inline tip (TipKit-style): a quiet rounded fill with a status dot; `accent` colours only the dot. */
export function Note({
  className,
  accent,
  as: Tag = "div",
  children,
  ...props
}: React.ComponentProps<"div"> & { accent?: boolean; as?: "div" | "p" }) {
  return (
    <Tag
      data-slot="note"
      className={cn(
        "m-0 flex gap-2.5 rounded-note border-0 px-3 py-2.5 text-control leading-[1.55] text-label keep-all text-pretty",
        "before:mt-[0.5em] before:size-2 before:flex-none before:rounded-full before:content-['']",
        "bg-fill-3",
        accent ? "before:bg-accent" : "before:bg-label-3",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/**
 * Form rows (kit Examples/Form 2548:2849): label left, value or control right,
 * 13px, hairlines between rows, no row boxes. Inside a content group.
 */
export function List({
  className,
  as: Tag = "div",
  ...props
}: React.ComponentProps<"div"> & { as?: "div" | "ul" | "ol" | "dl" | "nav" }) {
  const Comp = Tag as "div";
  return (
    <Comp
      data-slot="list"
      className={cn(
        "m-0 grid list-none p-0",
        "[&>*]:flex [&>*]:min-h-8 [&>*]:items-center [&>*]:gap-2.5 [&>*]:border-b [&>*]:border-separator-soft [&>*]:px-0.5 [&>*]:py-1.5 [&>*]:text-control [&>*]:keep-all",
        "[&>*:last-child]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

/** Classes for a list row that is a button (jump to a moment, pick an item). */
export const listButtonRow = cn(
  "w-full cursor-pointer rounded-none border-x-0 border-t-0 bg-transparent text-left text-inherit",
  "hover:rounded-small hover:bg-fill-4",
  "aria-[current=true]:rounded-small aria-[current=true]:border-b-transparent aria-[current=true]:bg-sel",
  "[&:has(+[aria-current=true])]:border-b-transparent",
  "focus-visible:rounded-small focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--control-accent)_55%,transparent)]",
);

/** A keyboard key in the footer legend. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "mx-0.5 inline-block min-w-5 rounded-[5px] bg-fill-3 px-1.5 py-px text-center font-sans text-caption font-medium text-label",
        className,
      )}
      {...props}
    />
  );
}
