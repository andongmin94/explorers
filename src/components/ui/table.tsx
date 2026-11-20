import { cn } from "@/lib/cn.ts";

/*
 * Table (kit Lists and Tables 121:12606): a 28px column header (12 semibold
 * secondary), alternating rows, the current row (aria-current="true") in the
 * kit's grey (unfocused) selection with rounded ends. Rows with data-time or
 * data-clickable get a pointer. Pair with useRowWindow (src/lib/fit.ts) so the
 * body shows only the rows that fit.
 */

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="table"
      className={cn(
        "w-full border-separate border-spacing-0 bg-transparent p-0 font-sans text-control text-label tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "sticky top-0 z-[2] h-7 border-b border-separator-soft px-2.5 pt-[5px] pb-1 text-left whitespace-nowrap",
        "[background:linear-gradient(var(--group),var(--group)),var(--window)] font-sans text-caption font-semibold text-label-2",
        "[&+&]:border-l [&+&]:border-l-separator-soft",
        "console-short:h-[26px] console-short:pt-1 console-short:pb-[3px]",
        className,
      )}
      {...props}
    />
  );
}

/** Body rows: alternating fill, hover, the current row in the grey selection. */
export const rowClass = cn(
  "even:[&>td]:bg-fill-4 hover:[&>td]:bg-fill-3 data-time:cursor-pointer data-clickable:cursor-pointer",
  "aria-[current=true]:[&>td]:bg-sel-strong aria-[current=true]:[&>td]:font-semibold",
  "aria-[current=true]:[&>td:first-child]:rounded-l-small aria-[current=true]:[&>td:last-child]:rounded-r-small",
);

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "relative border-b-0 px-2.5 py-[5px] align-top keep-all console-short:py-1",
        className,
      )}
      {...props}
    />
  );
}
