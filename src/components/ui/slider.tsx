import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/cn.ts";

/**
 * Slider (kit 512:3367): a 4px track filled with the accent and a 26×20 white
 * knob that turns to clear glass and grows while dragged.
 */
export function Slider({
  className,
  thumbLabel,
  thumbProps,
  ...props
}: Omit<SliderPrimitive.Root.Props<number>, "className"> & {
  className?: string;
  /** Accessible name of the thumb (when no Slider label element names it). */
  thumbLabel?: string;
  thumbProps?: Omit<SliderPrimitive.Thumb.Props, "className">;
}) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      thumbAlignment="edge"
      className={cn("group/slider w-full data-disabled:opacity-40", className)}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-6 w-full cursor-pointer touch-none items-center select-none group-data-disabled/slider:cursor-default">
        <SliderPrimitive.Track className="relative h-1 w-full rounded-full bg-track">
          <SliderPrimitive.Indicator className="rounded-full bg-accent group-data-dragging/slider:bg-[color-mix(in_srgb,var(--accent)_85%,black)]" />
          <SliderPrimitive.Thumb
            getAriaLabel={thumbLabel ? () => thumbLabel : undefined}
            {...thumbProps}
            className={cn(
              "h-5 w-[26px] rounded-full [background:linear-gradient(rgb(255_255_255/0.35),rgb(255_255_255/0)),var(--knob)] shadow-knob outline-none",
              "transition-[scale,background-color] duration-150 ease-spring motion-reduce:transition-none",
              "data-dragging:scale-[1.18] data-dragging:bg-[rgb(255_255_255/0.22)]",
              "data-dragging:shadow-[inset_1px_1px_0_rgb(255_255_255/0.95),inset_-1px_-1px_0_rgb(255_255_255/0.5),inset_0_0_0_0.5px_rgb(255_255_255/0.8),0_2px_10px_rgb(0_0_0/0.18)]",
              "has-focus-visible:ring-focus",
            )}
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
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
