// 메모리 탐색기: one lesson per page (?lesson=opt|belady|clock|custom). The shell
// (toolbar, rail, console, footer) comes from src/components/shell; this file
// wires the lesson's playback, panels and sheets together.
import { ChartColumnIcon, SlidersHorizontalIcon } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Console, Footer, Kbd, Stage } from "@/components/shell/console.tsx";
import { LessonRail } from "@/components/shell/lesson-rail.tsx";
import { ExplorerPage } from "@/components/shell/page.tsx";
import { Toolbar, ToolbarKey } from "@/components/shell/toolbar.tsx";
import { Led, Readout } from "@/components/ui/content.tsx";
import { VisuallyHidden } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { createProgress, LABELS, type Progress } from "@/lib/lesson-kit.ts";
import { currentLesson, progressIdFor } from "@/lib/lesson-rail.ts";
import { useExplorerShortcuts } from "@/lib/shortcuts.ts";
import { MemoryComparison } from "./comparison.tsx";
import { customQuery, parseCustom, type CustomConfig } from "./custom.ts";
import { MemoryCustomSheet } from "./custom-sheet.tsx";
import { MemoryDeck } from "./deck.tsx";
import { victimHintsVisible } from "./lesson.ts";
import { customLesson, extrasFor, LESSONS, runsFor } from "./lessons.ts";
import { MemoryScene } from "./memory-scene.tsx";
import { Playback, usePlayback, type PlaybackSnapshot } from "./playback.ts";
import { MemoryPrediction } from "./prediction.tsx";
import { MemoryRecords, type RecordTab } from "./records.tsx";
import type { Phase } from "./scene.ts";
import { MemorySide, type SideTab } from "./side.tsx";
import { STAGES } from "./terms.ts";
import type { Lesson, Quiz } from "./types.ts";

/** Progress of this lesson: its 핵심 장면 and 확인 문제. */
function lessonProgress(lesson: Lesson): Progress {
  const runs = runsFor(lesson);
  return createProgress(progressIdFor("memory", LESSONS, lesson.id), {
    scenes: lesson.milestones(runs).length,
    recall: lesson.recap(runs, extrasFor(lesson)).recall.length,
  });
}

function useProgressSummary(progress: Progress) {
  const [cache] = useState(() => ({ value: progress.summary() }));
  return useSyncExternalStore(
    (fn) =>
      progress.onChange((summary) => {
        cache.value = summary;
        fn();
      }),
    () => cache.value,
    () => cache.value,
  );
}

/**
 * The page: the lesson named in the URL. 직접 실험 (?lesson=custom) builds its
 * lesson from the query (custom.ts); running a new input rewrites the query
 * and mounts a fresh lesson view, so playback and progress start over.
 */
export function App() {
  const base = useMemo(() => currentLesson(LESSONS), []);
  const [custom, setCustom] = useState(() => parseCustom(globalThis.location?.search ?? ""));
  const lesson = useMemo(
    () => (base.id === "custom" ? customLesson(custom.config) : base),
    [base, custom],
  );
  const run = (config: CustomConfig) => {
    history.replaceState(null, "", `?${customQuery(config)}`);
    setCustom({ config, errors: [] });
  };
  return (
    <LessonView
      key={base.id === "custom" ? customQuery(custom.config) : base.id}
      lesson={lesson}
      custom={base.id === "custom" ? { ...custom, run } : null}
    />
  );
}

interface CustomState {
  config: CustomConfig;
  errors: string[];
  run: (config: CustomConfig) => void;
}

function LessonView({ lesson, custom }: { lesson: Lesson; custom: CustomState | null }) {
  const lessonNumber = String(LESSONS.findIndex((l) => l.id === lesson.id) + 1).padStart(2, "0");
  const [progress] = useState(() => lessonProgress(lesson));
  const [playback] = useState(() => new Playback(lesson, progress));
  const snap = usePlayback(playback);
  const summary = useProgressSummary(progress);

  const [sideTab, setSideTab] = useState<SideTab>("now");
  const [recordTab, setRecordTab] = useState<RecordTab>("history");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  // 직접 실험: the form opens by itself when a shared link could not be used.
  const [customOpen, setCustomOpen] = useState(() => Boolean(custom?.errors.length));
  // Predictions answered in this visit, by quiz id ("fifo-5"): their hints may show.
  const [answered, setAnswered] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    document.title = `메모리 탐색기 · ${lesson.name}`;
  }, [lesson]);

  const { run, mode, index, busy } = snap;
  const next = run.steps[index + 1];
  const nextQuiz = !busy && next ? lesson.predict(next, run, mode) : null;
  const asked = quiz ?? nextQuiz;
  const hints = victimHintsVisible({
    nextQuiz: asked,
    answered: asked ? answered.has(asked.id) : false,
    busy,
  });
  useEffect(() => playback.setHints(hints), [playback, hints]);
  // While the result of an access is asked, what is in RAM would answer it.
  const masked = quiz?.kind === "outcome" && !answered.has(quiz.id);

  const openPrediction = () => {
    if (!nextQuiz) return;
    playback.pause();
    setQuiz(nextQuiz);
  };
  const answer = (shown: Quiz, correct: boolean) => {
    setAnswered((set) => new Set(set).add(shown.id));
    progress.markPrediction(shown.id, correct);
  };
  const reveal = (shown: Quiz) => {
    setQuiz(null);
    const scene = document.getElementById("memory-scene");
    scene?.focus({ preventScroll: true });
    scene?.scrollIntoView({ block: "center", behavior: "instant" });
    void playback.reveal(shown.atIndex);
  };
  const openComparison = () => {
    playback.pause();
    progress.markCompared();
    setCompareOpen(true);
  };

  // Keyboard: Space play/pause, ←/→ one access, R back to the start (not while a sheet is open or a control has focus).
  const sheetOpen = quiz !== null || compareOpen || customOpen;
  const openCustom = () => {
    playback.pause();
    setCustomOpen(true);
  };
  useExplorerShortcuts(
    [
      { keys: "space", run: () => void playback.togglePlay(), description: "재생·정지" },
      {
        keys: "arrowright",
        run: () => void playback.nextAccess(),
        repeat: false,
        description: "다음 접근",
      },
      { keys: "arrowleft", run: () => void playback.back(), description: "이전 접근" },
      { keys: "r", run: () => void playback.reset(), description: "처음으로" },
    ],
    { enabled: !sheetOpen },
  );
  useEffect(() => {
    const onVisibility = () => document.hidden && playback.pause();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [playback]);

  const step = run.steps[snap.committed];
  return (
    <ExplorerPage>
      <Toolbar
        explorer="memory"
        caption="보면서 이해하는 운영체제"
        lessonNumber={lessonNumber}
        lessonTitle={lesson.name}
        actions={
          <>
            {custom && (
              <ToolbarKey data-action="custom" className="glass-lens-sm" onClick={openCustom}>
                <SlidersHorizontalIcon aria-hidden="true" />
                <span>조건 바꾸기</span>
              </ToolbarKey>
            )}
            <ToolbarKey data-action="compare" className="glass-lens-sm" onClick={openComparison}>
              <ChartColumnIcon aria-hidden="true" />
              <span>{LABELS.compare}</span>
            </ToolbarKey>
          </>
        }
      />
      <Console>
        <LessonRail
          explorer="memory"
          title="페이지 교체"
          lessons={LESSONS}
          current={lesson.id}
          progress={progress}
        />
        <Stage
          label="페이지 접근"
          className={cn(
            "[&>div:first-child]:flex-wrap [&>div:first-child]:gap-y-2",
            // Below 1440px the head keeps one row: the strip names the plate.
            "min-[1100px]:max-[1439px]:[@media(min-height:700px)]:[&_#stage-label]:sr-only",
          )}
          head={
            <>
              <Stages snap={snap} />
              <div className="ms-auto flex gap-2">
                <Readout
                  glass
                  id="lcd-step"
                  aria-label="처리한 접근 수"
                  className="min-w-[92px] justify-center"
                >
                  {index}
                  <small>/ {playback.total} 접근</small>
                </Readout>
                <Readout
                  glass
                  id="lcd-counts"
                  aria-label="부재와 적중 횟수"
                  className="min-w-[116px] justify-center"
                >
                  {step.faults}
                  <small>부재</small> {step.hits}
                  <small>적중</small>
                </Readout>
              </div>
            </>
          }
          foot={<StatusLine phase={snap.phase} masked={masked} />}
        >
          <MemoryScene playback={playback} busy={busy} masked={masked} />
        </Stage>
        <MemoryDeck playback={playback} snap={snap} />
        <MemorySide
          playback={playback}
          snap={snap}
          tab={sideTab}
          onTab={setSideTab}
          progress={progress}
          summary={summary}
          nextQuiz={nextQuiz}
          hints={hints}
          masked={masked}
          onPredict={openPrediction}
          onCompare={openComparison}
          onCustom={custom ? openCustom : undefined}
        />
        <MemoryRecords
          playback={playback}
          snap={snap}
          tab={recordTab}
          onTab={setRecordTab}
          masked={masked}
        />
      </Console>
      <Footer
        shortcuts={
          <>
            조작: <Kbd>Space</Kbd> 재생·정지 <Kbd>←</Kbd>
            <Kbd>→</Kbd> 접근 이동 <Kbd>R</Kbd> 처음으로
          </>
        }
        sources={
          <>
            학습 근거{" "}
            <a
              href="https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys.pdf"
              target="_blank"
              rel="noreferrer"
            >
              OSTEP 21장 ↗
            </a>{" "}
            ·{" "}
            <a
              href="https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf"
              target="_blank"
              rel="noreferrer"
            >
              22장 ↗
            </a>{" "}
            · Silberschatz 10.4
          </>
        }
      />
      <MemoryPrediction
        quiz={quiz}
        mode={mode}
        references={lesson.references}
        onAnswer={answer}
        onClose={() => setQuiz(null)}
        onReveal={reveal}
      />
      {custom && (
        <MemoryCustomSheet
          open={customOpen}
          onOpenChange={setCustomOpen}
          config={custom.config}
          problems={custom.errors}
          onRun={(config) => {
            setCustomOpen(false);
            custom.run(config);
          }}
        />
      )}
      <MemoryComparison
        playback={playback}
        open={compareOpen}
        onOpenChange={setCompareOpen}
        onReplayMode={(id) => {
          setCompareOpen(false);
          void playback.replayMode(id);
        }}
        onTurningPoint={() => {
          setCompareOpen(false);
          void playback.seek(lesson.fork);
        }}
      />
    </ExplorerPage>
  );
}

/** Where a phase sits on the five sub-stages (-1 before the first access). */
const POSITION: Record<Phase["kind"], number> = {
  ready: -1,
  lookup: 0,
  hit: 1,
  miss: 1,
  select: 2,
  evict: 2,
  load: 3,
  retry: 4,
  read: 4,
  access: 5,
};

/**
 * The five sub-stages of one access: a status capsule floating over the
 * scene like the readouts beside it. Status dots as in the lesson rail:
 * ring = to come, half = now, filled = done. A hit skips 프레임 선택 and 적재.
 */
function Stages({ snap }: { snap: PlaybackSnapshot }) {
  const step = snap.run.steps[snap.index];
  // At rest the capsule shows the finished access (or nothing before the first).
  const kind: Phase["kind"] = snap.busy ? snap.phase.kind : snap.index ? "access" : "ready";
  const position = POSITION[kind];
  const decided = position >= 1 && step.index > 0;
  return (
    <ol
      id="stages"
      aria-label="한 번의 페이지 접근 과정"
      className={cn(
        "m-0 flex min-h-7 min-w-0 flex-[0_1_auto] list-none items-center rounded-full px-3",
        "glass-sm shadow-[var(--lg-rim),0_4px_16px_rgb(0_0_0/0.08)]",
        "phone:order-3 phone:basis-full phone:overflow-x-auto phone:[scrollbar-width:none]",
      )}
    >
      {STAGES.map((label, i) => {
        const text =
          i === 1 && decided
            ? step.hit
              ? "적중"
              : "부재"
            : i === 4 && kind === "retry"
              ? "재시도"
              : label;
        const skipped = decided && step.hit && (i === 2 || i === 3);
        const now = !skipped && i === position;
        const done = !skipped && i < position;
        return (
          <li
            key={label}
            aria-current={now ? "step" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 font-sans text-caption leading-[15px] font-medium whitespace-nowrap text-vlabel-2",
              "not-first:before:mr-0.5 not-first:before:ml-1.5 not-first:before:h-px not-first:before:w-2.5 not-first:before:flex-none not-first:before:bg-label-3 not-first:before:content-['']",
              "min-[1100px]:max-[1439px]:[@media(min-height:700px)]:not-first:before:w-2",
              "phone:not-first:before:mr-0.5 phone:not-first:before:ml-[3px] phone:not-first:before:w-1.5",
              done && "text-vlabel",
              now && "font-semibold text-vlabel",
              skipped && "text-label-3 line-through",
            )}
          >
            <span
              data-status={skipped || (!now && !done) ? "new" : now ? "progress" : "done"}
              className={cn(
                "inline-block size-2 flex-none rounded-full",
                (skipped || (!now && !done)) &&
                  "bg-transparent shadow-[inset_0_0_0_1.5px_var(--label-3)]",
                now &&
                  "bg-[conic-gradient(var(--accent)_0_50%,transparent_0)] shadow-[inset_0_0_0_1.5px_var(--accent)]",
                done && "bg-accent",
              )}
            />
            {text}
            {skipped && <VisuallyHidden> (생략)</VisuallyHidden>}
          </li>
        );
      })}
    </ol>
  );
}

/** The stage foot: the scene's phase in one line, its dot in the fault colour while a fault is handled. */
function StatusLine({ phase, masked }: { phase: Phase; masked: boolean }) {
  const fault = ["miss", "select", "evict", "load"].includes(phase.kind);
  return (
    <span className={cn("contents", masked && "[&>*]:invisible")}>
      <Led
        id="status-led"
        data-kind={phase.kind}
        on={phase.kind !== "ready"}
        color={fault ? "var(--mem-fault)" : undefined}
      />
      <span id="status-text" className="text-label">
        {phase.title}
      </span>
    </span>
  );
}
