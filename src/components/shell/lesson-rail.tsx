// Lesson rail = the sidebar (kit Sidebars 656:3559, items 207:14495): Medium
// glass, inset from the window edge. A column left of the stage from 1280px;
// a drawer opened by the toolbar's "레슨" key below that. Rows are the kit's
// sidebar items: status symbol + lesson name + a dim right-aligned detail
// ("30%" / "완료"), 32 tall, no separators; the selected row is a grey
// rounded fill whose symbol takes the accent. The section header is the
// explorer name (secondary, bold, small).
import { CircleCheckIcon, CircleIcon, ContrastIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Label, VisuallyHidden } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { lessonStatus, type LessonStatus, type Progress } from "@/lib/lesson-kit.ts";
import { lessonHref, progressIdFor, type RailLesson } from "@/lib/lesson-rail.ts";
import { useRail, useRailButton } from "./page.tsx";

const STATUS_TEXT: Record<LessonStatus, string> = {
  new: "시작 전",
  progress: "진행 중",
  done: "완료",
};

const STATUS_ICON = { new: CircleIcon, progress: ContrastIcon, done: CircleCheckIcon } as const;

/** Re-render on every progress change of the open lesson (the others cannot change here). */
function useProgressVersion(progress: Progress | null) {
  const version = useRef(0);
  return useSyncExternalStore(
    (fn) =>
      progress?.onChange(() => {
        version.current++;
        fn();
      }) ?? (() => {}),
    () => version.current,
    () => 0,
  );
}

export function LessonRail({
  explorer,
  title,
  lessons,
  current,
  progress,
}: {
  explorer: string;
  /** The rail heading, e.g. "CPU 스케줄링". */
  title: string;
  lessons: RailLesson[];
  current: string;
  /** The open lesson's progress, so its dot and percentage follow. */
  progress: Progress | null;
}) {
  const rail = useRail();
  const railButton = useRailButton();
  const ref = useRef<HTMLElement>(null);
  useProgressVersion(progress);

  // Opening the drawer moves focus to the current lesson.
  useEffect(() => {
    if (!rail.open) return;
    const el =
      ref.current?.querySelector<HTMLElement>('[aria-current="page"]') ??
      ref.current?.querySelector("button");
    el?.focus({ preventScroll: true });
  }, [rail.open]);

  return (
    <aside
      ref={ref}
      id="lessons"
      data-plate="rail"
      aria-label={`${title} 레슨`}
      inert={rail.drawer && !rail.open ? true : undefined}
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-panel glass-md",
        // Column (≥ 1280px): the first grid column, over the stage backdrop.
        "rail-column:relative rail-column:z-[2] rail-column:[grid-area:rail] rail-column:self-stretch",
        "console:rail-column:overflow-hidden console:rail-column:[contain:size]",
        // Drawer (< 1280px): fixed at the left edge, slides in; near-opaque glass.
        "drawer:fixed drawer:top-2.5 drawer:bottom-2.5 drawer:left-2.5 drawer:z-[60] drawer:w-[min(320px,calc(100vw-40px))]",
        "drawer:[background:var(--lg-sheen),color-mix(in_srgb,var(--window)_90%,transparent)] drawer:[-webkit-backdrop-filter:blur(30px)_saturate(1.6)] drawer:[backdrop-filter:blur(30px)_saturate(1.6)]! opaque:[backdrop-filter:none]!",
        "drawer:transition-transform drawer:duration-[360ms] drawer:ease-drawer motion-reduce:transition-none",
        rail.open ? "drawer:translate-x-0" : "drawer:-translate-x-[calc(100%+24px)]",
      )}
    >
      <div className="flex min-h-9 items-center gap-2.5 pt-3 pr-3 pb-[3px] pl-[18px]">
        <Label vibrant className="min-w-0 flex-auto font-bold">
          {title}
        </Label>
        <Button
          size="icon-sm"
          aria-label="레슨 목록 닫기"
          className="ms-auto rail-column:hidden"
          onClick={() => {
            rail.setOpen(false);
            railButton.current?.focus({ preventScroll: true });
          }}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-auto px-2.5 pt-0.5 pb-2.5 [scrollbar-width:thin] console:rail-column:overflow-hidden">
        <div className="grid">
          {lessons.map((lesson, i) => {
            const { status, ratio } = lessonStatus(progressIdFor(explorer, lessons, lesson.id));
            const here = lesson.id === current;
            const Icon = STATUS_ICON[status];
            const detail =
              status === "done"
                ? "완료"
                : status === "progress"
                  ? `${Math.round(ratio * 100)}%`
                  : "";
            return (
              <a
                key={lesson.id}
                href={lessonHref(lessons, lesson)}
                data-lesson={lesson.id}
                aria-current={here ? "page" : undefined}
                title={lesson.sub ? `${lesson.name} · ${lesson.sub}` : lesson.name}
                className={cn(
                  "group/row flex min-h-8 items-center gap-1.5 rounded-small px-2 text-control text-vlabel no-underline",
                  "hover:bg-lg-hover aria-[current=page]:bg-sel-strong",
                  "focus-visible:outline-3 focus-visible:-outline-offset-1 focus-visible:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)]",
                  "phone:min-h-11",
                )}
              >
                <Icon
                  aria-hidden="true"
                  data-status={status}
                  strokeWidth={1.7}
                  className="size-4 flex-none text-vlabel-2 group-aria-[current=page]/row:text-accent-text"
                />
                <span className="min-w-0 flex-1 truncate ps-0.5 keep-all">
                  <VisuallyHidden>{String(i + 1).padStart(2, "0")} </VisuallyHidden>
                  {lesson.name}
                  {lesson.sub && <VisuallyHidden> · {lesson.sub}</VisuallyHidden>}
                </span>
                <span
                  className="flex-none font-sans text-caption text-vlabel-3 tabular-nums dark:text-vlabel-2"
                  aria-label={STATUS_TEXT[status]}
                >
                  {detail}
                </span>
              </a>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
