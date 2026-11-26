// The window toolbar (kit Toolbar + Titlebar 2548:2856): no bar; the
// explorer switcher, the window title and the actions float as glass over
// the scene. Below 1280px a "레슨" key opens the lesson drawer.
import {
  CheckIcon,
  ChevronDownIcon,
  CpuIcon,
  DatabaseIcon,
  GitMergeIcon,
  HardDriveIcon,
  MemoryStickIcon,
  MenuIcon,
  MoonIcon,
  NetworkIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Menu, MenuContent, MenuLinkItem, MenuTrigger } from "@/components/ui/menu.tsx";
import { Index, Label } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { explorers, type ExplorerSlug } from "@/lib/explorers.ts";
import { useTheme } from "@/lib/theme.ts";
import { useRail, useRailButton } from "./page.tsx";

/** Each explorer's app icon (white on its accent disc). */
export const EXPLORER_ICONS: Record<ExplorerSlug, LucideIcon> = {
  protocol: NetworkIcon,
  cpu: CpuIcon,
  memory: MemoryStickIcon,
  transaction: DatabaseIcon,
  disk: HardDriveIcon,
  git: GitMergeIcon,
};

export function Toolbar({
  explorer,
  caption,
  lessonNumber,
  lessonTitle,
  actions,
}: {
  explorer: ExplorerSlug;
  /** The line under the explorer's name, e.g. "보면서 이해하는 운영체제". */
  caption: string;
  /** "01": shown as "01 레슨" over the lesson title. */
  lessonNumber: string;
  lessonTitle: string;
  /** Extra toolbar keys (e.g. compare); the theme toggle is added after them. */
  actions?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "relative z-[3] mx-auto mb-3 flex min-h-[var(--toolbar-h)] max-w-[1680px] items-center gap-2.5",
        "console:m-0 console:mb-[var(--console-gap)] console:h-[var(--toolbar-h)] console:max-w-none console:flex-none console:py-1.5",
        "phone:mb-2 phone:min-h-0 phone:flex-nowrap phone:gap-2",
      )}
    >
      <RailButton />
      <ExplorerSwitcher current={explorer} caption={caption} />
      <div className="flex min-w-0 flex-col-reverse justify-center gap-px ps-1 phone:hidden">
        <Label className="leading-[15px] font-medium">
          <Index>{lessonNumber}</Index> 레슨
        </Label>
        <strong className="truncate font-display text-headline leading-[18px] font-bold">
          {lessonTitle}
        </strong>
      </div>
      <div className="ms-auto flex flex-none items-center gap-2 phone:gap-1.5">
        {actions}
        <ThemeToggle explorer={explorer} />
      </div>
    </header>
  );
}

/** The "레슨" key that opens the lesson drawer (below 1280px only). */
function RailButton() {
  const rail = useRail();
  const button = useRailButton();
  return (
    <Button
      ref={button}
      size="toolbar"
      className="flex-none gap-1.5 rail-column:hidden phone:w-[42px] phone:p-0 phone:[&>span]:sr-only"
      aria-expanded={rail.open}
      aria-controls="lessons"
      onClick={() => rail.setOpen(!rail.open)}
    >
      <MenuIcon aria-hidden="true" />
      <span>레슨</span>
    </Button>
  );
}

/** A toolbar action key: icon + label (label hidden on phones). */
export function ToolbarKey({ className, children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      size="toolbar"
      className={cn("phone:w-[42px] phone:p-0 phone:[&>span]:sr-only", className)}
      {...props}
    >
      {children}
    </Button>
  );
}

export function ThemeToggle({ explorer }: { explorer: string }) {
  const [theme, toggle] = useTheme(explorer);
  const dark = theme === "dark";
  return (
    <Button
      size="icon-toolbar"
      data-action="theme"
      aria-label={`${dark ? "밝은" : "어두운"} 테마로 전환`}
      onClick={toggle}
      className="glass-lens-sm"
    >
      {dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
    </Button>
  );
}

/** The explorer switcher: a glass capsule with the app icon that opens a macOS menu. */
export function ExplorerSwitcher({ current, caption }: { current: ExplorerSlug; caption: string }) {
  const entry = explorers.find((e) => e.slug === current)!;
  const AppIcon = EXPLORER_ICONS[current];
  return (
    // The playback shortcuts listen on the document; keys used here must not also play or pause.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- only stops propagation
    <h1
      aria-label={entry.label}
      className="m-0 w-[260px] max-w-full min-w-0 leading-none phone:w-auto"
      onKeyDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
    >
      <Menu>
        <MenuTrigger
          aria-label={`탐색기 선택, 현재 ${entry.label}`}
          aria-describedby="explorer-caption"
          className={cn(
            "group/switcher flex min-h-10 w-full cursor-pointer items-center gap-[9px] rounded-full border-0 py-1 pr-3 pl-1 text-left",
            "glass-sm glass-lens-sm font-sans text-vlabel shadow-[var(--lg-rim),0_4px_20px_rgb(0_0_0/0.1)]",
            "transition-[transform,background-color] duration-150 ease-spring motion-reduce:transition-none",
            "hover:[background:linear-gradient(var(--lg-hover),var(--lg-hover)),var(--lg-sheen),var(--lg-small)]",
            "active:scale-[0.98] active:[background:linear-gradient(var(--lg-press),var(--lg-press)),var(--lg-sheen),var(--lg-small)]",
            "data-open:[background:linear-gradient(var(--lg-press),var(--lg-press)),var(--lg-sheen),var(--lg-small)]",
            "focus-visible:ring-focus",
            "console-short:min-h-[38px] console-short:py-[3px]",
            "phone:min-h-11 phone:gap-2 phone:py-1 phone:pr-2.5 phone:pl-[5px]",
          )}
        >
          <span
            className={cn(
              "relative grid size-8 flex-none place-items-center rounded-full text-on-accent",
              "[background:linear-gradient(160deg,rgb(255_255_255/0.28),rgb(255_255_255/0)_55%),var(--accent)]",
              "shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.3),0_1px_3px_color-mix(in_srgb,var(--accent)_40%,transparent)]",
              "console-short:size-[30px] phone:size-[34px]",
            )}
          >
            <AppIcon aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
          </span>
          <span className="grid min-w-0 flex-1 gap-0">
            <span className="truncate font-display text-control leading-4 font-bold">
              {entry.label}
            </span>
            <span
              id="explorer-caption"
              className="truncate text-caption font-medium text-vlabel-2 phone:hidden"
            >
              {caption}
            </span>
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            strokeWidth={2.2}
            className="size-3.5 text-vlabel-2 transition-transform duration-150 group-data-open/switcher:rotate-180 motion-reduce:transition-none"
          />
        </MenuTrigger>
        <MenuContent aria-label="탐색기 목록">
          {explorers.map((explorer) => {
            const here = explorer.slug === current;
            const Icon = EXPLORER_ICONS[explorer.slug];
            return (
              <MenuLinkItem
                key={explorer.slug}
                href={here ? undefined : `/${explorer.slug}/`}
                aria-current={here ? "page" : undefined}
                className="group/item"
                style={{ "--item-accent": `var(--sys-${explorer.tint})` } as React.CSSProperties}
              >
                <span className="grid w-3.5 flex-none place-items-center" aria-hidden="true">
                  <CheckIcon
                    strokeWidth={2.6}
                    className={cn("size-[11px]", !here && "invisible")}
                  />
                </span>
                <Icon aria-hidden="true" strokeWidth={1.8} className="size-4" />
                <span className="flex-1">{explorer.label}</span>
                <span
                  aria-hidden="true"
                  className="size-2 flex-none rounded-full bg-[var(--item-accent)] group-data-highlighted/item:shadow-[0_0_0_1.5px_rgb(255_255_255/0.9)]"
                />
              </MenuLinkItem>
            );
          })}
        </MenuContent>
      </Menu>
    </h1>
  );
}
