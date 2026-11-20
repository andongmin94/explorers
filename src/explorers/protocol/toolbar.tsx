// The window toolbar: the shared switcher and theme toggle, the "프로토콜"
// drawer key, the lesson being learned, the OSI layer as a row of LEDs and
// learning progress (a percentage and one status dot per protocol). Built
// from the shared parts because the shared <Toolbar> has no slot for the two
// contexts that sit beside the lesson title (vanilla .hw-context).
import { MenuIcon } from "lucide-react";

import { useRail, useRailButton } from "@/components/shell/page.tsx";
import { ExplorerSwitcher, ThemeToggle } from "@/components/shell/toolbar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Readout } from "@/components/ui/content.tsx";
import { Label } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { translate } from "./i18n.ts";
import { lessonsById, protocolCatalog } from "./lessons/index.ts";
import { getLessonCompletion, getLessonStatus } from "./progress.ts";
import { StatusDot } from "./rail.tsx";
import type { Lesson } from "./types.ts";

const OSI_LAYER_NAMES = [
  "Physical",
  "Data Link",
  "Network",
  "Transport",
  "Session",
  "Presentation",
  "Application",
];

/** The drawer key (the shared one is internal to <Toolbar>): "프로토콜" below 1280px. */
function RailKey() {
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
      <span>프로토콜</span>
    </Button>
  );
}

/** A labelled context beside the title: value on top, label under it. */
function Context({
  label,
  className,
  children,
}: {
  label: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-none flex-col-reverse justify-center gap-px ps-1 stacked:hidden",
        className,
      )}
    >
      <Label className="leading-[15px] font-medium whitespace-nowrap">{label}</Label>
      {children}
    </div>
  );
}

export function ProtocolToolbar({
  lesson,
  progressVersion,
}: {
  lesson: Lesson;
  progressVersion: number;
}) {
  const layerName = translate(OSI_LAYER_NAMES[lesson.layer - 1]);
  const progress = protocolCatalog.map((protocol) => {
    const entry = lessonsById[protocol.id];
    return {
      id: protocol.id,
      name: protocol.name,
      value: getLessonCompletion(entry),
      status: getLessonStatus(entry),
    };
  });
  const percent = Math.round(
    (progress.reduce((sum, item) => sum + item.value, 0) / progress.length) * 100,
  );
  const done = progress.filter((item) => item.status === "done").length;
  const active = progress.filter((item) => item.status === "progress").length;
  return (
    <header
      data-progress-version={progressVersion}
      className={cn(
        "relative z-[3] mx-auto mb-3 flex min-h-[var(--toolbar-h)] max-w-[1680px] items-center gap-2.5",
        "console:m-0 console:mb-[var(--console-gap)] console:h-[var(--toolbar-h)] console:max-w-none console:flex-none console:py-1.5",
        "phone:mb-2 phone:min-h-0 phone:flex-nowrap phone:gap-2",
      )}
    >
      <RailKey />
      <ExplorerSwitcher current="protocol" caption="인터넷 작동 원리 배우기" />
      <Context
        label={translate("NOW LEARNING")}
        className="min-w-0 flex-[0_1_auto] phone:hidden stacked:flex"
      >
        <strong className="truncate font-display text-headline leading-[18px] font-bold">
          {lesson.name} · {translate(lesson.title)}
        </strong>
      </Context>
      <Context
        label={
          <>
            {translate("OSI LAYER")}{" "}
            <span className="text-label">
              L{lesson.layer} {layerName}
            </span>
          </>
        }
      >
        <div
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a row of status dots, read as one image
          role="img"
          aria-label={translate("Layer {n}: {name}", { n: lesson.layer, name: layerName })}
          className="flex h-[18px] items-center gap-1"
        >
          {OSI_LAYER_NAMES.map((name, index) => {
            const here = index + 1 === lesson.layer;
            return (
              <span
                key={name}
                title={translate("Layer {n}: {name}", { n: index + 1, name: translate(name) })}
                className={cn(
                  "inline-flex items-center gap-[3px] px-[3px] py-0.5 text-caption font-medium text-label-2 tabular-nums",
                  here && "font-semibold text-label",
                )}
              >
                <span
                  className={cn("inline-block size-2 rounded-full bg-label-4", here && "bg-accent")}
                />
                <span className="drawer:hidden">{index + 1}</span>
              </span>
            );
          })}
        </div>
      </Context>
      <Context
        label={
          <>
            {translate("LEARNING PROGRESS")}{" "}
            <span className="min-[1440px]:inline hidden">
              {done}/{protocolCatalog.length} 완료 · {active} 진행 중
            </span>
          </>
        }
      >
        <div className="flex items-center gap-2.5">
          <Readout className="min-h-6 gap-px px-2.5 py-[3px] text-control leading-[18px]">
            {percent}
            <small>%</small>
          </Readout>
          <span
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a grid of status dots, read as one image
            role="img"
            aria-label={translate("{pct}% complete", { pct: percent })}
            className="grid grid-cols-[repeat(7,8px)] gap-x-1 gap-y-[3px]"
          >
            {progress.map((item) => (
              <StatusDot
                key={item.id}
                status={item.status}
                title={`${item.name}: ${Math.round(item.value * 100)}%`}
              />
            ))}
          </span>
        </div>
      </Context>
      <div className="ms-auto flex flex-none items-center gap-2 phone:gap-1.5">
        <ThemeToggle explorer="protocol" />
      </div>
    </header>
  );
}
