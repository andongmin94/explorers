import {
  Slider as SliderPrimitive,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/react/slider";

import { cn } from "@/lib/cn.ts";

/**
 * Slider (kit 512:3367): a 4px track filled with the accent and a 26×20 white
 * knob that turns to clear glass and grows while dragged. The knob stays
 * inside the rail at both ends: the UI SDK track the thumb runs along is the
 * rail inset by half a knob (13px), the rail itself is drawn by the control,
 * and the fill reaches back over that inset.
 */
export function Slider({
  className,
  thumbLabel,
  thumbProps,
  ...props
}: Omit<React.ComponentProps<typeof SliderPrimitive<number>>, "className" | "format"> & {
  className?: string;
  /** Accessible name of the thumb (when no Slider label element names it). */
  thumbLabel?: string;
  /** What screen readers hear for the value, in place of the number. */
  thumbProps?: { "aria-valuetext"?: string };
}) {
  const valueText = thumbProps?.["aria-valuetext"];
  return (
    <SliderPrimitive<number>
      format={valueText === undefined ? undefined : () => valueText}
      className={cn("group/slider w-full data-disabled:opacity-40", className)}
      {...props}
    >
      <SliderControl
        className={cn(
          "relative flex h-6 w-full cursor-pointer touch-none items-center select-none group-data-disabled/slider:cursor-default",
          "before:absolute before:inset-x-0 before:top-1/2 before:-mt-0.5 before:h-1 before:rounded-full before:bg-track before:content-['']",
        )}
      >
        <SliderTrack className="relative mx-[13px] h-1 flex-1">
          <SliderIndicator className="top-0 h-full -ml-[13px] box-content rounded-full bg-control-accent pl-[13px] group-data-dragging/slider:bg-[color-mix(in_srgb,var(--control-accent)_85%,black)]" />
          <SliderThumb
            aria-label={thumbLabel}
            className={cn(
              "h-5 w-[26px] rounded-full [background:linear-gradient(rgb(255_255_255/0.35),rgb(255_255_255/0)),var(--knob)] shadow-knob outline-none",
              "transition-[scale,background-color] duration-150 ease-spring motion-reduce:transition-none",
              "data-dragging:scale-[1.18] data-dragging:bg-[rgb(255_255_255/0.22)]",
              "data-dragging:shadow-[inset_1px_1px_0_rgb(255_255_255/0.95),inset_-1px_-1px_0_rgb(255_255_255/0.5),inset_0_0_0_0.5px_rgb(255_255_255/0.8),0_2px_10px_rgb(0_0_0/0.18)]",
              "has-focus-visible:ring-focus",
            )}
          />
        </SliderTrack>
      </SliderControl>
    </SliderPrimitive>
  );
}

/** The min/max labels under a slider (kit ticks). */
export function SliderTicks({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex justify-between px-[11px] font-sans text-caption text-label-2 tabular-nums",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
