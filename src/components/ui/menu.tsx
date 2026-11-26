import { MenuContent as MenuContentPrimitive, MenuItem } from "@ui-sdk/react/menu";

import { useId } from "react";

import { cn } from "@/lib/cn.ts";

export { Menu, MenuTrigger } from "@ui-sdk/react/menu";

/**
 * A macOS menu (kit Menus 483:8811): glass r 13, items r 8, highlight in the
 * accent. A UI SDK menu in the top layer; its popover's own border and margin
 * are reset here. It renders into <body> by default, so it never inherits the
 * trigger's surroundings (the switcher sits in the page's <h1>, whose heading
 * must not contain the menu, and whose line height is 1).
 */
export function MenuContent({
  className,
  children,
  side = "bottom",
  align = "start",
  sideOffset = 10,
  collisionPadding = 12,
  container = typeof document === "undefined" ? undefined : document.body,
  "aria-label": label,
  ...props
}: Omit<React.ComponentProps<typeof MenuContentPrimitive>, "className" | "children"> & {
  className?: string;
  children?: React.ReactNode;
}) {
  // The content always names itself after its trigger with aria-labelledby,
  // which outranks an aria-label; a labelledby of our own replaces it.
  const labelId = useId();
  return (
    <MenuContentPrimitive
      container={container}
      aria-labelledby={label ? labelId : undefined}
      side={side}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "m-0 border-0",
        "max-h-[var(--available-height,70vh)] w-[max(var(--anchor-width,0px),260px)] overflow-y-auto",
        "origin-[var(--transform-origin)] rounded-menu glass-menu px-3 py-[5px] font-sans text-label outline-none",
        "transition-[opacity,transform] duration-[180ms] ease-knob motion-reduce:transition-none",
        "data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0",
        className,
      )}
      {...props}
    >
      {label && (
        <span id={labelId} hidden>
          {label}
        </span>
      )}
      {children}
    </MenuContentPrimitive>
  );
}

/** A menu item that is a link (24 → 30 tall for touch; the highlight bleeds 7px into the padding). */
export function MenuLinkItem({
  className,
  href,
  ...props
}: Omit<React.ComponentProps<typeof MenuItem>, "className" | "render"> & {
  className?: string;
  href?: string;
}) {
  return (
    <MenuItem
      // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the item's children name the link
      render={<a href={href} />}
      className={cn(
        "relative -mx-[7px] flex min-h-[30px] items-center gap-2 rounded-small py-0 pr-[7px] pl-1",
        "text-control font-medium text-vlabel no-underline outline-none",
        "data-highlighted:bg-accent data-highlighted:text-on-accent",
        "phone:min-h-11",
        className,
      )}
      {...props}
    />
  );
}
