// Lesson rail = the sidebar (kit Sidebar 684:18069): Medium glass, inset from
// the window edge. A column left of the stage from 1280px; a drawer opened by
// the toolbar's "레슨" key below that. Each lesson shows a status dot (ring:
// new, half: in progress, filled: done) and a percentage from lessonStatus().
import { XIcon } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { lessonStatus, type LessonStatus, type Progress } from "@/lib/lesson-kit.ts";
import { lessonHref, progressIdFor, type RailLesson } from "@/lib/lesson-rail.ts";
import { useRail, useRailButton } from "./page.tsx";

const STATUS_TEXT: Record<LessonStatus, string> = {
  new: "시작 전",
  progress: "진행 중",
  done: "완료",
};

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
      <div className="flex min-h-10 items-center gap-2.5 pt-3 pr-3 pb-[2px] pl-4">
        <Label vibrant className="min-w-0 flex-auto">
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
      <nav className="min-h-0 flex-1 overflow-auto px-2 pt-1 pb-2.5 [scrollbar-width:thin] console:rail-column:overflow-hidden">
        <div className="grid">
          {lessons.map((lesson, i) => {
            const { status, ratio } = lessonStatus(progressIdFor(explorer, lessons, lesson.id));
            const here = lesson.id === current;
            return (
              <a
                key={lesson.id}
                href={lessonHref(lessons, lesson)}
                data-lesson={lesson.id}
                aria-current={here ? "page" : undefined}
                className={cn(
                  "group/row flex min-h-11 items-center gap-2.5 rounded-small px-2 py-1.5 text-vlabel no-underline",
                  "hover:bg-lg-hover aria-[current=page]:bg-lg-selected",
                  "focus-visible:outline-3 focus-visible:-outline-offset-1 focus-visible:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)]",
                )}
              >
                <span
                  data-status={status}
                  className={cn(
                    "inline-block size-2 flex-none rounded-full",
                    status === "new" && "bg-transparent shadow-[inset_0_0_0_1.5px_var(--label-3)]",
                    status === "progress" &&
                      "bg-[conic-gradient(var(--accent)_0_50%,transparent_0)] shadow-[inset_0_0_0_1.5px_var(--accent)]",
                    status === "done" && "bg-accent",
                  )}
                />
                <span className="grid min-w-0 flex-1 gap-px leading-4">
                  <span className="text-control font-medium keep-all">
                    <span className="me-1 font-semibold text-vlabel-2 tabular-nums group-aria-[current=page]/row:text-accent-text">
                      {String(i + 1).padStart(2, "0")}
                    </span>{" "}
                    {lesson.name}
                  </span>
                  {lesson.sub && (
                    <span className="truncate text-caption leading-[15px] font-normal text-vlabel-2">
                      {lesson.sub}
                    </span>
                  )}
                </span>
                <span
                  className="font-sans text-caption font-medium text-vlabel-2 tabular-nums"
                  aria-label={STATUS_TEXT[status]}
                >
                  {Math.round(ratio * 100)}%
                </span>
              </a>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
