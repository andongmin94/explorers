import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";

import { cn } from "@/lib/cn.ts";

/**
 * Segmented control (kit 121:11848 / 121:12398): one white capsule, 3px
 * padding, thin dividers between segments, the selected segment a light grey
 * pill (never the accent). Exactly one segment is pressed;
 * pressing the pressed one again does nothing. Segments are Base UI toggles,
 * so they carry aria-pressed.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  className,
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof ToggleGroup>,
  "value" | "onValueChange" | "className" | "defaultValue"
> & {
  value: T | null;
  onValueChange: (value: T) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      data-slot="segmented-control"
      value={value === null ? [] : [value]}
      onValueChange={(next) => {
        if (next.length) onValueChange(next[0] as T);
      }}
      className={cn(
        "inline-grid auto-cols-fr grid-flow-col gap-0 rounded-full p-[3px] capsule",
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroup>
  );
}

/** One segment. */
export function Segment({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Toggle>, "className"> & { className?: string }) {
  return (
    <Toggle
      data-slot="segment"
      className={cn(
        "relative inline-flex min-h-[26px] cursor-pointer items-center justify-center gap-1.5 rounded-full border-0 bg-transparent px-3",
        "font-sans text-control font-medium whitespace-nowrap text-label keep-all",
        "transition-[background-color,color] duration-150 motion-reduce:transition-none",
        // 1×14 divider between two unselected segments
        "not-first:before:absolute not-first:before:top-1/2 not-first:before:left-0 not-first:before:-mt-[7px] not-first:before:h-3.5 not-first:before:w-px not-first:before:bg-capsule-divider not-first:before:content-['']",
        "aria-pressed:before:opacity-0 [[aria-pressed=true]+&]:before:opacity-0",
        "hover:not-disabled:not-aria-pressed:bg-lg-hover",
        "aria-pressed:bg-sel",
        "focus-visible:ring-focus disabled:cursor-default disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
