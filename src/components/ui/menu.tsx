import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/cn.ts";

/** A macOS menu (kit Menus 483:8811): glass r 13, items r 8, highlight in the accent. */
export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

export function MenuContent({
  className,
  children,
  side = "bottom",
  align = "start",
  sideOffset = 10,
  collisionPadding = 12,
  ...props
}: Omit<MenuPrimitive.Popup.Props, "className"> & {
  className?: string;
  side?: MenuPrimitive.Positioner.Props["side"];
  align?: MenuPrimitive.Positioner.Props["align"];
  sideOffset?: number;
  collisionPadding?: number;
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="z-[100] outline-none"
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
      >
        <MenuPrimitive.Popup
          data-slot="menu"
          className={cn(
            "max-h-[var(--available-height,70vh)] w-[max(var(--anchor-width,0px),260px)] overflow-y-auto",
            "origin-[var(--transform-origin)] rounded-menu glass-menu px-3 py-[5px] font-sans text-label outline-none",
            "transition-[opacity,transform] duration-[180ms] ease-knob motion-reduce:transition-none",
            "data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

/** A menu item that is a link (24 → 30 tall for touch; the highlight bleeds 7px into the padding). */
export function MenuLinkItem({
  className,
  ...props
}: Omit<MenuPrimitive.LinkItem.Props, "className"> & { className?: string }) {
  return (
    <MenuPrimitive.LinkItem
      data-slot="menu-item"
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
