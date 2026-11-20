import { cn } from "@/lib/cn.ts";

/*
 * The four text roles (docs/DESIGN.md → Rules 4): Title (Title 2, 17 bold,
 * one per group), Text (body 14 / 1.6), Label (12 semibold, secondary,
 * sentence case) and readouts (readout.tsx). Plus Index (an accent number in
 * a label), Heading (15 semibold, inside notes) and Muted.
 */

/** Secondary label (kit section header). On glass pass `vibrant`. */
export function Label({
  className,
  vibrant,
  as: Tag = "span",
  ...props
}: React.ComponentProps<"span"> & { vibrant?: boolean; as?: "span" | "label" | "dt" | "p" }) {
  const Comp = Tag as "span";
  return (
    <Comp
      data-slot="label"
      className={cn(
        "m-0 inline-flex items-center gap-1.5 font-sans text-caption leading-[15px] font-semibold tracking-normal keep-all",
        vibrant ? "text-vlabel-2" : "text-label-2",
        className,
      )}
      {...props}
    />
  );
}

/** The accent number in a label or row ("01", "A", "?"). */
export function Index({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("font-sans font-semibold text-accent-text tabular-nums", className)}
      {...props}
    />
  );
}

/** Title 2: one per group at most. */
export function Title({
  className,
  as: Tag = "h2",
  ...props
}: React.ComponentProps<"h2"> & { as?: "h2" | "h3" }) {
  return (
    <Tag
      className={cn(
        "m-0 font-display text-title font-bold tracking-[-0.01em] text-balance keep-all",
        "console-short:[.side-panel_&]:text-headline console-short:[.side-panel_&]:leading-5",
        className,
      )}
      {...props}
    />
  );
}

export function Heading({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("m-0 text-headline font-semibold", className)} {...props} />;
}

/** Body text: Korean reading text, 14 / 1.6. */
export function Text({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "m-0 text-body text-label text-pretty keep-all console-short:[.side-panel_&]:leading-normal",
        className,
      )}
      {...props}
    />
  );
}

export function Muted({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("text-label-2", className)} {...props} />;
}

/** Visually hidden, read by screen readers. */
export function VisuallyHidden({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("sr-only", className)} {...props} />;
}
