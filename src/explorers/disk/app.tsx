// 디스크 스케줄링 탐색기: one lesson per page (?lesson=scan-look|cscan). The
// shell (toolbar, rail, console, footer) comes from src/components/shell;
// this file wires the lesson's playback, panels and sheets together.
import { ChartColumnIcon } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Console, Footer, Kbd, Stage } from "@/components/shell/console.tsx";
import { LessonRail } from "@/components/shell/lesson-rail.tsx";
import { ExplorerPage } from "@/components/shell/page.tsx";
import { Toolbar, ToolbarKey } from "@/components/shell/toolbar.tsx";
import { Label } from "@/components/ui/typography.tsx";
import { Led, Readout, Tag } from "@/components/ui/content.tsx";
import { createProgress, LABELS, type Progress } from "@/lib/lesson-kit.ts";
import { currentLesson, progressIdFor } from "@/lib/lesson-rail.ts";
import { useExplorerShortcuts } from "@/lib/shortcuts.ts";
import { DiskComparison } from "./comparison.tsx";
import { DiskDeck } from "./deck.tsx";
import { DiskScene } from "./disk-scene.tsx";
import { fix } from "./format.ts";
import { buildLesson, LESSONS, type Lesson } from "./lessons.ts";
import { Playback, useHead, usePlayback, type PlaybackSnapshot } from "./playback.ts";
import { DiskPrediction, type Quiz } from "./prediction.tsx";
import { DiskRecords, type RecordTab } from "./records.tsx";
import { DiskSide, type SideTab } from "./side.tsx";

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

const RECORD_TABS: RecordTab[] = ["path", "log", "results"];

export function App() {
  const lesson = useMemo(() => buildLesson(currentLesson(LESSONS).id), []);
  const [progress] = useState(() =>
    createProgress(progressIdFor("disk", LESSONS, lesson.id), lesson.totals),
  );
  const [playback] = useState(() => new Playback(lesson, progress));
  const snap = usePlayback(playback);
  const summary = useProgressSummary(progress);

  // Deep link: &record=log picks a records tab, &dialog=compare|predict opens one.
  const [query] = useState(() => new URLSearchParams(location.search));
  const [sideTab, setSideTab] = useState<SideTab>("lesson");
  const [recordTab, setRecordTab] = useState<RecordTab>(() => {
    const record = query.get("record") as RecordTab | null;
    return record && RECORD_TABS.includes(record) ? record : "path";
  });
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  // After a method switch or a revealed prediction the scene takes focus
  // (and on a phone comes into view).
  useEffect(() => {
    playback.setOnFocusScene((block) => {
      const scene = document.getElementById("disk-scene");
      scene?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 759px)").matches)
        scene?.scrollIntoView({ block, behavior: "instant" });
    });
    return () => playback.setOnFocusScene(null);
  }, [playback]);

  const openPrediction = () => {
    playback.pause();
    const index = playback.committed + 1;
    if (!playback.run().steps[index]) return;
    setQuiz({
      algorithm: playback.algorithm,
      index,
      head: playback.current().state.head,
      prediction: lesson.predictionFor(playback.algorithm, index),
    });
  };
  const openComparison = () => {
    playback.pause();
    progress.markCompared();
    setCompareOpen(true);
  };

  // Deep links that play or open something, once.
  useEffect(() => {
    if (query.get("play") === "next") playback.next();
    if (query.get("dialog") === "compare") openComparison();
    if (query.get("dialog") === "predict") openPrediction();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, on load
  }, []);

  // Keyboard: Space play/pause, ←/→ one request, R back to the start (not
  // while a sheet is open or a control has focus). Hidden tab: pause.
  const sheetOpen = quiz !== null || compareOpen;
  useExplorerShortcuts(
    [
      { keys: "space", run: () => playback.togglePlay(), description: "재생·정지" },
      {
        keys: "arrowright",
        run: () => playback.jump(playback.index + 1),
        description: "다음 요청",
      },
      { keys: "arrowleft", run: () => playback.back(), description: "이전 요청" },
      { keys: "r", run: () => playback.reset(), description: "처음으로" },
    ],
    { enabled: !sheetOpen },
  );
  useEffect(() => {
    const onVisibility = () => document.hidden && playback.pause();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [playback]);

  const names = lesson.names;
  return (
    <ExplorerPage>
      <Toolbar
        explorer="disk"
        caption="보면서 이해하는 운영체제"
        lessonNumber={lesson.number}
        lessonTitle={fix(lesson.name)}
        actions={
          <ToolbarKey data-action="compare" className="glass-lens-sm" onClick={openComparison}>
            <ChartColumnIcon aria-hidden="true" />
            <span>{LABELS.compare}</span>
          </ToolbarKey>
        }
      />
      <Console>
        <LessonRail
          explorer="disk"
          title="디스크 스케줄링"
          lessons={LESSONS}
          current={lesson.id}
          progress={progress}
        />
        <Stage
          label="요청 선택과 헤드 이동"
          className="phone:[&>div:first-child]:flex-wrap"
          head={
            <>
              <Tag id="stage-mode">
                {names[snap.algorithm]} · {lesson.ruleShort[snap.algorithm]}
              </Tag>
              <Readouts playback={playback} total={snap.shownTotal} />
            </>
          }
          foot={<StatusLine lesson={lesson} snap={snap} />}
        >
          <DiskScene playback={playback} busy={snap.busy} />
        </Stage>
        <DiskDeck playback={playback} snap={snap} />
        <DiskSide
          playback={playback}
          snap={snap}
          tab={sideTab}
          onTab={setSideTab}
          progress={progress}
          summary={summary}
          onPredict={openPrediction}
          onCompare={openComparison}
        />
        <DiskRecords
          lesson={lesson}
          snap={snap}
          tab={recordTab}
          onTab={setRecordTab}
          onSeek={(n) => playback.jump(n)}
        />
      </Console>
      <Footer
        shortcuts={
          <>
            조작: <Kbd>Space</Kbd> 재생·정지 <Kbd>←</Kbd>
            <Kbd>→</Kbd> 요청 이동 <Kbd>R</Kbd> 처음으로
          </>
        }
        sources={
          <>
            <a
              href="https://pages.cs.wisc.edu/~remzi/OSTEP/file-disks.pdf"
              target="_blank"
              rel="noreferrer"
            >
              학습 근거 · OSTEP 37 Hard Disk Drives ↗
            </a>{" "}
            · Silberschatz 11.2
          </>
        }
      />
      <DiskPrediction
        lesson={lesson}
        quiz={quiz}
        onClose={() => setQuiz(null)}
        onReveal={() => {
          setQuiz(null);
          playback.reveal();
        }}
        progress={progress}
      />
      <DiskComparison
        lesson={lesson}
        open={compareOpen}
        onOpenChange={setCompareOpen}
        algorithm={snap.algorithm}
        onTryOther={(other) => {
          setCompareOpen(false);
          playback.setAlgorithm(other);
        }}
      />
    </ExplorerPage>
  );
}

/** 헤드 and 누적 이동 over the scene; the head follows the arm every frame. */
function Readouts({ playback, total }: { playback: Playback; total: number }) {
  const head = useHead(playback);
  return (
    <div className="ms-auto flex items-center gap-2.5 phone:ms-0 phone:basis-full phone:gap-1.5">
      <Label>헤드</Label>
      <Readout
        glass
        id="lcd-head"
        className="me-1 min-w-[8.5ch] justify-center phone:min-w-0"
        aria-label="헤드 실린더"
      >
        {head}
        <small>CYL</small>
      </Readout>
      <Label>누적 이동</Label>
      <Readout
        glass
        id="lcd-total"
        className="min-w-[8.5ch] justify-center phone:min-w-0"
        aria-label="누적 이동"
      >
        {total}
        <small>CYL</small>
      </Readout>
    </div>
  );
}

/** The stage foot: the stage of the request in flight, or what is on screen. */
function StatusLine({ lesson, snap }: { lesson: Lesson; snap: PlaybackSnapshot }) {
  const text = lesson.phaseText(snap.phase, snap.phaseStep, snap.algorithm);
  return (
    <>
      <Led id="foot-led" on={snap.led} />
      <span id="status" className="text-label">
        {text.title}
      </span>
    </>
  );
}
