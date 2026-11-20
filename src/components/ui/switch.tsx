import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/cn.ts";

/** Switch (kit 468:808): 44×20 track, 26×16 white knob that stretches on press; the label sits to its right. */
export function Switch({
  className,
  children,
  ...props
}: Omit<SwitchPrimitive.Root.Props, "className" | "render" | "nativeButton"> & {
  className?: string;
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      nativeButton
      // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the label is the children, inside this button
      render={<button type="button" />}
      className={cn(
        "group/switch relative inline-flex min-h-6 cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left",
        "font-sans text-control font-medium text-label",
        "focus-visible:rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)]",
        "data-disabled:cursor-default data-disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="relative h-5 w-11 flex-none rounded-full bg-track shadow-[inset_0_0_0_0.5px_var(--fill-3)] transition-colors duration-200 group-data-checked/switch:bg-accent motion-reduce:transition-none"
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-[26px] rounded-full bg-knob shadow-knob",
            "transition-[translate,width] duration-[260ms] ease-knob motion-reduce:transition-none",
            "data-checked:translate-x-[14px] group-active/switch:w-[30px] group-active/switch:data-checked:translate-x-[10px]",
          )}
        />
      </span>
      {children}
    </SwitchPrimitive.Root>
  );
}
