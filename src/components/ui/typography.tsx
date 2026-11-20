import { cn } from "@/lib/cn.ts";

/*
 * The four text roles (docs/DESIGN.md → Rules 4), macOS 26 text styles:
 * Title (Title 3, 15 semibold, one per group), Text (Body 13 / 1.55), Label
 * (12 semibold, secondary, sentence case) and readouts (content.tsx). Plus
 * Index (a secondary number in a label or row), Heading (Headline 13 bold,
 * inside notes) and Muted.
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

/** The number in a label or row ("01", "A", "?"): secondary, never the accent. */
export function Index({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("font-sans font-semibold text-label-2 tabular-nums", className)}
      {...props}
    />
  );
}

/** Title 3 (15 / 20 semibold): one per group at most. */
export function Title({
  className,
  as: Tag = "h2",
  ...props
}: React.ComponentProps<"h2"> & { as?: "h2" | "h3" }) {
  return (
    <Tag
      className={cn(
        "m-0 font-display text-headline font-semibold text-balance keep-all",
        className,
      )}
      {...props}
    />
  );
}

export function Heading({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("m-0 text-control leading-4 font-bold", className)} {...props} />;
}

/** Body text: macOS Body 13 with a Korean line height (1.55). */
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
