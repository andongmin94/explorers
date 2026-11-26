// The protocol picker: the shared lesson rail's look (Medium glass column
// from 1280px, a drawer below) with the vanilla picker's category filter
// (전체 · 기본 · 응용 · 보안). Rows are buttons, not links: a protocol opens
// in place (and its ?lesson= URL is kept for reloads). Rows follow the kit
// sidebar item (symbol + name + dim detail "30%" / "완료"); status comes from
// the protocol's own progress store (steps seen), not lessonStatus().
import { CircleCheckIcon, CircleIcon, ContrastIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useRail, useRailButton } from "@/components/shell/page.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Segment, SegmentedControl } from "@/components/ui/segmented-control.tsx";
import { Label, VisuallyHidden } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import type { LessonStatus } from "@/lib/lesson-kit.ts";
import { translate } from "./i18n.ts";
import { lessonsById, protocolCatalog, type ProtocolEntry } from "./lessons/index.ts";
import { getLessonCompletion, getLessonStatus } from "./progress.ts";

const FILTERS: [ProtocolEntry["group"] | "all", string][] = [
  ["all", "ALL"],
  ["core", "CORE"],
  ["application", "APPLICATION"],
  ["security", "SECURITY"],
];

const STATUS_TEXT: Record<LessonStatus, string> = {
  new: "시작 전",
  progress: "진행 중",
  done: "완료",
};

const STATUS_ICON = { new: CircleIcon, progress: ContrastIcon, done: CircleCheckIcon } as const;

/** The sidebar item symbol (kit 207:14495): accent only on the selected row. */
function StatusIcon({ status }: { status: LessonStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Icon
      aria-hidden="true"
      data-status={status}
      strokeWidth={1.7}
      className="size-4 flex-none text-vlabel-2 group-aria-[current=true]/row:text-accent-text"
    />
  );
}

/** Ring: new, half ring: in progress, filled: complete (the shared rail dots). */
export function StatusDot({ status, title }: { status: LessonStatus; title?: string }) {
  return (
    <span
      data-status={status}
      title={title}
      className={cn(
        "inline-block size-2 flex-none rounded-full",
        status === "new" && "bg-transparent shadow-[inset_0_0_0_1.5px_var(--label-3)]",
        status === "progress" &&
          "bg-[conic-gradient(var(--accent)_0_50%,transparent_0)] shadow-[inset_0_0_0_1.5px_var(--accent)]",
        status === "done" && "bg-accent",
      )}
    />
  );
}

export function ProtocolRail({
  current,
  onSelect,
  progressVersion,
}: {
  current: string;
  onSelect: (id: string) => void;
  /** Changes whenever progress is saved (re-renders the dots). */
  progressVersion: number;
}) {
  const rail = useRail();
  const railButton = useRailButton();
  const ref = useRef<HTMLElement>(null);
  const [picked, setPicked] = useState<{ filter: ProtocolEntry["group"] | "all"; lesson: string }>({
    filter: "all",
    lesson: current,
  });
  // A lesson chosen while the filter hides it stays visible: fall back to all protocols.
  const currentGroup = protocolCatalog.find((p) => p.id === current)?.group;
  if (picked.lesson !== current) {
    setPicked({
      filter: picked.filter === "all" || picked.filter === currentGroup ? picked.filter : "all",
      lesson: current,
    });
  }
  const shownFilter = picked.filter;
  const setFilter = (filter: ProtocolEntry["group"] | "all") =>
    setPicked({ filter, lesson: current });

  // Opening the drawer moves focus to the current protocol.
  useEffect(() => {
    if (!rail.open) return;
    const el =
      ref.current?.querySelector<HTMLElement>('[aria-current="true"]') ??
      ref.current?.querySelector("button");
    el?.focus({ preventScroll: true });
  }, [rail.open]);

  const select = (id: string) => {
    onSelect(id);
    if (rail.open) setTimeout(() => rail.setOpen(false), 220);
  };

  return (
    <aside
      ref={ref}
      id="lessons"
      data-plate="rail"
      data-progress-version={progressVersion}
      aria-label={translate("INTERNET PROTOCOLS")}
      inert={rail.drawer && !rail.open ? true : undefined}
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-panel glass-md",
        "rail-column:relative rail-column:z-[2] rail-column:[grid-area:rail] rail-column:self-stretch",
        "console:rail-column:overflow-hidden console:rail-column:[contain:size]",
        "drawer:fixed drawer:top-2.5 drawer:bottom-2.5 drawer:left-2.5 drawer:z-[60] drawer:w-[min(320px,calc(100vw-40px))]",
        "drawer:[background:var(--lg-sheen),color-mix(in_srgb,var(--window)_90%,transparent)] drawer:[-webkit-backdrop-filter:blur(30px)_saturate(1.6)] drawer:[backdrop-filter:blur(30px)_saturate(1.6)]! opaque:[backdrop-filter:none]!",
        "drawer:transition-transform drawer:duration-[360ms] drawer:ease-drawer motion-reduce:transition-none",
        rail.open ? "drawer:translate-x-0" : "drawer:-translate-x-[calc(100%+24px)]",
      )}
    >
      <div className="flex min-h-9 items-center gap-2.5 pt-3 pr-3 pb-[3px] pl-[18px]">
        <Label vibrant className="min-w-0 flex-auto font-bold">
          {translate("INTERNET PROTOCOLS")}
        </Label>
        <Button
          size="icon-sm"
          aria-label={translate("Close the protocol list")}
          title={translate("Close (Esc)")}
          className="ms-auto rail-column:hidden"
          onClick={() => {
            rail.setOpen(false);
            railButton.current?.focus({ preventScroll: true });
          }}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-2 overflow-auto px-2.5 pt-1 pb-2.5 [scrollbar-width:thin] console:flex console:flex-col console:overflow-hidden">
        <SegmentedControl
          aria-label="분류"
          value={shownFilter}
          onValueChange={(group) => setFilter(group)}
          className="mb-[2px] w-full flex-none"
        >
          {FILTERS.map(([group, label]) => {
            const count =
              group === "all"
                ? protocolCatalog.length
                : protocolCatalog.filter((p) => p.group === group).length;
            return (
              <Segment
                key={group}
                value={group}
                data-group={group}
                title={`${count}개`}
                className="px-1.5"
              >
                {translate(label)}
              </Segment>
            );
          })}
        </SegmentedControl>
        <nav
          aria-label={translate("INTERNET PROTOCOLS")}
          className={cn(
            "grid console:min-h-0 console:flex-auto console:content-start",
            // All fourteen at once on the console: kit sidebar rows (32 tall),
            // shrinking evenly when the list gets short.
            "console:auto-rows-[min(32px,calc(100%/14))]",
          )}
        >
          {protocolCatalog.map((protocol, index) => {
            const lesson = lessonsById[protocol.id];
            const status = getLessonStatus(lesson);
            const here = protocol.id === current;
            const hidden = shownFilter !== "all" && protocol.group !== shownFilter;
            if (hidden) return null;
            return (
              <button
                key={protocol.id}
                type="button"
                data-lesson={protocol.id}
                data-group={protocol.group}
                aria-current={here ? "true" : "false"}
                title={`${protocol.name} · ${translate(protocol.full)}`}
                onClick={() => select(protocol.id)}
                className={cn(
                  "group/row flex min-h-8 w-full cursor-pointer items-center gap-1.5 rounded-small border-0 bg-transparent px-2 text-left font-sans text-control text-vlabel",
                  "console:min-h-0",
                  "hover:bg-lg-hover aria-[current=true]:bg-sel-strong",
                  "focus-visible:outline-3 focus-visible:-outline-offset-1 focus-visible:outline-[color-mix(in_srgb,var(--control-accent)_55%,transparent)]",
                  "phone:min-h-11",
                )}
              >
                <StatusIcon status={status} />
                <span className="min-w-0 flex-1 truncate ps-0.5 keep-all">
                  <VisuallyHidden>{String(index + 1).padStart(2, "0")} </VisuallyHidden>
                  {protocol.name}
                  <VisuallyHidden> · {translate(protocol.full)}</VisuallyHidden>
                </span>
                <span
                  className="flex-none font-sans text-caption text-vlabel-3 tabular-nums dark:text-vlabel-2"
                  aria-label={STATUS_TEXT[status]}
                >
                  {status === "done"
                    ? "완료"
                    : status === "progress"
                      ? `${Math.round(getLessonCompletion(lesson) * 100)}%`
                      : ""}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
