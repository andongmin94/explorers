// Plates: content groups (kit Form Group 2302:6716) — a quiet fill on the
// window background, r 12, never glass, never a box inside a box.
import { cn } from "@/lib/cn.ts";

export function Plate({
  className,
  as: Tag = "section",
  ...props
}: React.ComponentProps<"section"> & { as?: "section" | "aside" }) {
  return <Tag className={cn("min-w-0 rounded-group bg-group", className)} {...props} />;
}

/** Head: a label (grows) and, last, tabs or a readout pushed to the end. */
export function PlateHead({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center gap-2.5 px-3.5 pt-2.5 pb-1",
        "[&>[data-slot=label]:first-child]:min-w-0 [&>[data-slot=label]:first-child]:flex-auto",
        "[&>:last-child:not(:first-child)]:ms-auto",
        "console-short:min-h-10 console-short:pt-2 console-short:pb-[2px] phone:px-3",
        className,
      )}
      {...props}
    />
  );
}

export function PlateBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-3.5 pt-3 pb-3.5 phone:p-3", className)} {...props} />;
}

/** One status line under a plate. */
export function PlateFoot({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-10 items-center gap-2.5 border-t border-separator-soft px-3.5 py-2 text-caption text-label-2 phone:px-3",
        className,
      )}
      {...props}
    />
  );
}
