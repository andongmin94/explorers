import {
  Tabs as TabsPrimitive,
  TabsList as TabsListPrimitive,
  TabsPanel as TabsPanelPrimitive,
  TabsTab as TabsTabPrimitive,
} from "@ui-sdk/react/tabs";

import { cn } from "@/lib/cn.ts";

/**
 * Tabs: drawn as the macOS segmented control (kit 121:11848): a white capsule;
 * the selected tab is a grey pill. Arrow keys move focus, Enter or Space
 * selects (manual activation).
 */
export function Tabs({
  className,
  activation = "manual",
  ...props
}: Omit<React.ComponentProps<typeof TabsPrimitive>, "className"> & { className?: string }) {
  return <TabsPrimitive activation={activation} className={cn("contents", className)} {...props} />;
}

export function TabsList({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabsListPrimitive>, "className"> & { className?: string }) {
  return (
    <TabsListPrimitive
      className={cn(
        "flex max-w-full items-center gap-px overflow-x-auto rounded-full p-[3px] capsule [scrollbar-width:none]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTab({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabsTabPrimitive>, "className"> & { className?: string }) {
  return (
    <TabsTabPrimitive
      className={cn(
        "inline-flex min-h-6 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-2.5",
        "font-sans text-control font-medium whitespace-nowrap text-label keep-all",
        "transition-[background-color,color] duration-150 motion-reduce:transition-none",
        "hover:not-data-selected:bg-lg-hover",
        "data-selected:bg-sel",
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
}: Omit<React.ComponentProps<typeof TabsPanelPrimitive>, "className"> & { className?: string }) {
  return <TabsPanelPrimitive className={cn("outline-none", className)} {...props} />;
}
