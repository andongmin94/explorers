import {
  SegmentedControl as SegmentedControlPrimitive,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";

import { cn } from "@/lib/cn.ts";

/**
 * Segmented control (kit 121:11848 / 121:12398): one white capsule, 3px
 * padding, thin dividers between segments, the selected segment a light grey
 * pill (never the accent). Exactly one segment is checked; pressing the
 * checked one again does nothing. A UI SDK segmented control: a radio group,
 * one tab stop, arrow keys move and check. Each segment is followed by its
 * hidden native radio, hence the `+input+` in the divider rule.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  className,
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof SegmentedControlPrimitive>,
  "value" | "onValueChange" | "className" | "defaultValue"
> & {
  value: T | null;
  onValueChange: (value: T) => void;
  className?: string;
}) {
  return (
    <SegmentedControlPrimitive
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next as T);
      }}
      className={cn(
        "relative inline-grid auto-cols-fr grid-flow-col gap-0 rounded-full p-[3px] capsule",
        className,
      )}
      {...props}
    >
      {children}
    </SegmentedControlPrimitive>
  );
}

/** One segment. */
export function Segment({
  className,
  ...props
}: Omit<React.ComponentProps<typeof SegmentedControlItem>, "className"> & {
  className?: string;
}) {
  return (
    <SegmentedControlItem
      className={cn(
        "relative inline-flex min-h-[26px] cursor-pointer items-center justify-center gap-1.5 rounded-full border-0 bg-transparent px-3",
        "font-sans text-control font-medium whitespace-nowrap text-label keep-all",
        "transition-[background-color,color] duration-150 motion-reduce:transition-none",
        // 1×14 divider between two unselected segments
        "not-first:before:absolute not-first:before:top-1/2 not-first:before:left-0 not-first:before:-mt-[7px] not-first:before:h-3.5 not-first:before:w-px not-first:before:bg-capsule-divider not-first:before:content-['']",
        "data-checked:before:opacity-0 [[data-checked]+input+&]:before:opacity-0",
        "hover:not-data-disabled:not-data-checked:bg-lg-hover",
        "data-checked:bg-sel",
        "focus-visible:ring-focus data-disabled:cursor-default data-disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
