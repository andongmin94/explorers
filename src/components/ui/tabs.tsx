import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/cn.ts";

/** Tabs (iOS 26 Tab Bar 507:24689): a glass capsule; the selected tab is a grey pill. */
export function Tabs({
  className,
  ...props
}: Omit<TabsPrimitive.Root.Props, "className"> & { className?: string }) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("contents", className)} {...props} />;
}

export function TabsList({
  className,
  ...props
}: Omit<TabsPrimitive.List.Props, "className"> & { className?: string }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex max-w-full items-center gap-px overflow-x-auto rounded-full p-[2px] [scrollbar-width:none]",
        "[background:var(--lg-sheen),var(--lg-small)] shadow-[var(--lg-rim),0_2px_10px_rgb(0_0_0/0.06)]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTab({
  className,
  ...props
}: Omit<TabsPrimitive.Tab.Props, "className"> & { className?: string }) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "inline-flex min-h-[26px] cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-[11px]",
        "font-sans text-control font-medium whitespace-nowrap text-vlabel keep-all",
        "transition-[background-color,color] duration-150 motion-reduce:transition-none",
        "hover:not-aria-selected:bg-lg-hover",
        "aria-selected:bg-lg-selected aria-selected:font-semibold aria-selected:text-label",
        "focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)]",
        "phone:min-h-[34px]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsPanel({
  className,
  ...props
}: Omit<TabsPrimitive.Panel.Props, "className"> & { className?: string }) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}
