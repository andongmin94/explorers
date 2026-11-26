// CPU 스케줄링 탐색기: one lesson per page (?lesson=rr|sjf|srtf|custom). The shell
// (toolbar, rail, console, footer) comes from src/components/shell; this file
// wires the lesson's playback, panels and sheets together.
import { ChartColumnIcon, SlidersHorizontalIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Console, Footer, Kbd, Stage } from "@/components/shell/console.tsx";
import { LessonRail } from "@/components/shell/lesson-rail.tsx";
import { ExplorerPage } from "@/components/shell/page.tsx";
import { Toolbar, ToolbarKey } from "@/components/shell/toolbar.tsx";
import { Led, Readout, Tag } from "@/components/ui/content.tsx";
import { createProgress, LABELS, type Progress } from "@/lib/lesson-kit.ts";
import { currentLesson, progressIdFor } from "@/lib/lesson-rail.ts";
import { useExplorerShortcuts } from "@/lib/shortcuts.ts";
import { CpuComparison } from "./comparison.tsx";
import { customQuery, parseCustom, type CustomConfig } from "./custom.ts";
import { CpuCustomSheet } from "./custom-sheet.tsx";
import { CpuDeck } from "./deck.tsx";
import { simulate } from "./engine.ts";
import { colorOf } from "./format.ts";
import { josa } from "./josa.ts";
import { eventLabel } from "./lesson.ts";
import { LESSONS, METHODS, customLesson, lessonRuns, type Lesson } from "./lessons.ts";
import { Playback, usePlayback, type PlaybackSnapshot } from "./playback.ts";
import { CpuPrediction, type Quiz } from "./prediction.tsx";
import { CpuRecords, type RecordTab } from "./records.tsx";
import { SchedulerScene } from "./scheduler-scene.tsx";
import { CpuSide, type SideTab } from "./side.tsx";

/** Progress of this lesson; totals come from its first method at its starting quantum. */
function lessonProgress(lesson: Lesson): Progress {
  const first = simulate({
    algorithm: lesson.methods[0],
    quantum: lesson.quantum ?? 2,
    processes: lesson.processes,
  });
  return createProgress(progressIdFor("cpu", LESSONS, lesson.id), {
    scenes: lesson.content.milestones(first).length,
    recall: lesson.content.recall(lessonRuns(lesson)).length,
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

const isPhone = () => window.matchMedia("(max-width: 759px)").matches;
const isStacked = () => window.matchMedia("(max-width: 1099px)").matches;

/**
 * The page: the lesson named in the URL. 직접 실험 (?lesson=custom) builds its
 * lesson from the query (custom.ts); running new jobs rewrites the query and
 * mounts a fresh lesson view, so playback and progress start over.
 */
export function App() {
  const base = useMemo(() => currentLesson(LESSONS), []);
  const [custom, setCustom] = useState(() => parseCustom(globalThis.location?.search ?? ""));
  const isCustom = base.id === "custom";
  const lesson = useMemo(
    () => (isCustom ? customLesson(custom.config) : base),
    [base, custom, isCustom],
  );
  const run = (config: CustomConfig) => {
    history.replaceState(null, "", `?${customQuery(config)}`);
    setCustom({ config, errors: [] });
  };
  return (
    <LessonView
      key={isCustom ? customQuery(custom.config) : base.id}
      lesson={lesson}
      custom={isCustom ? { ...custom, run } : null}
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
  const [recordTab, setRecordTab] = useState<RecordTab>("timeline");
  const [selected, setSelected] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  // 직접 실험: the form opens by itself when a shared link could not be used.
  const [customOpen, setCustomOpen] = useState(() => Boolean(custom?.errors.length));
  const openCustom = () => {
    playback.pause();
    setCustomOpen(true);
  };

  useEffect(() => playback.select(selected), [playback, selected, snap.algorithm]);

  // Back at the start on a phone: bring the stage into view.
  useEffect(() => {
    playback.setOnRewind(() => {
      if (isPhone())
        document
          .querySelector('[data-plate="stage"]')
          ?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => playback.setOnRewind(null);
  }, [playback]);

  const selectProcess = useCallback(
    (id: string, toggle = true) => {
      const next = toggle && id === selected ? null : id;
      setSelected(next);
      setSideTab(next || !toggle ? "process" : "now");
      if (next && isStacked())
        requestAnimationFrame(() =>
          document
            .querySelector('[data-plate="side"]')
            ?.scrollIntoView({ block: "start", behavior: "smooth" }),
        );
    },
    [selected],
  );

  const openPrediction = () => {
    playback.pause();
    const prediction = lesson.content.prediction(playback.result, playback.time);
    if (!prediction) return;
    playback.seek(prediction.beforeTime);
    setQuiz({ prediction, at: playback.time });
  };
  const reveal = (shown: Quiz) => {
    setQuiz(null);
    const scene = document.getElementById("scene");
    scene?.focus({ preventScroll: true });
    scene?.scrollIntoView({ block: "nearest", behavior: "instant" });
    playback.seek(shown.prediction.decision.time, true);
  };
  const openComparison = () => {
    playback.pause();
    progress.markCompared();
    setCompareOpen(true);
  };

  // Keyboard: Space play/pause, ←/→ 1 ms, R back to the start (not while a sheet is open or a control has focus).
  const sheetOpen = quiz !== null || compareOpen || customOpen;
  useExplorerShortcuts(
    [
      { keys: "space", run: () => playback.togglePlay(), description: "재생·정지" },
      { keys: "arrowright", run: () => playback.step(), description: "1 ms 다음" },
      { keys: "arrowleft", run: () => playback.back(), description: "1 ms 이전" },
      { keys: "r", run: () => playback.reset(), description: "처음으로" },
    ],
    { enabled: !sheetOpen },
  );
  useEffect(() => {
    const onVisibility = () => document.hidden && playback.pause();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [playback]);

  return (
    <ExplorerPage>
      <Toolbar
        explorer="cpu"
        caption="보면서 이해하는 운영체제"
        lessonNumber={lessonNumber}
        lessonTitle={lesson.title}
        actions={
          <>
            {custom && (
              <ToolbarKey data-action="custom" className="glass-lens-sm" onClick={openCustom}>
                <SlidersHorizontalIcon aria-hidden="true" />
                <span>작업 바꾸기</span>
              </ToolbarKey>
            )}
            <ToolbarKey data-action="compare" className="glass-lens-sm" onClick={openComparison}>
              <ChartColumnIcon aria-hidden="true" />
              <span>{LABELS.compare}</span>
            </ToolbarKey>
          </>
        }
      />
      <Console sideWidth="clamp(410px, 28vw, 440px)">
        <LessonRail
          explorer="cpu"
          title="CPU 스케줄링"
          lessons={LESSONS}
          current={lesson.id}
          progress={progress}
        />
        <Stage
          label="스케줄러"
          head={
            <>
              <Tag id="algo-tag">{METHODS[snap.algorithm].tag(snap.quantum)}</Tag>
              <Readout glass role="timer" aria-label="시뮬레이션 시각">
                <span id="clock" className="inline-block min-w-[2ch] text-right">
                  {Math.max(0, snap.time)}
                </span>
                <small>ms</small>
              </Readout>
            </>
          }
          foot={<StatusLine lesson={lesson} snap={snap} />}
        >
          <SchedulerScene
            playback={playback}
            ariaLabel={sceneLabel(snap)}
            busy={snap.transitioning}
            onSelect={(id) => selectProcess(id)}
          />
        </Stage>
        <CpuDeck playback={playback} snap={snap} />
        <CpuSide
          playback={playback}
          snap={snap}
          tab={sideTab}
          onTab={setSideTab}
          selected={selected}
          onPick={(id) => selectProcess(id, false)}
          progress={progress}
          summary={summary}
          onPredict={openPrediction}
          onCompare={openComparison}
          onCustom={custom ? openCustom : undefined}
        />
        <CpuRecords
          lesson={lesson}
          snap={snap}
          tab={recordTab}
          onTab={setRecordTab}
          selected={selected}
          onSeek={(t) => playback.seek(t)}
          onSelect={(id) => selectProcess(id)}
        />
      </Console>
      <Footer
        shortcuts={
          <>
            조작: <Kbd>Space</Kbd> 재생·정지 <Kbd>←</Kbd>
            <Kbd>→</Kbd> 1 ms 이동 <Kbd>R</Kbd> 처음으로
          </>
        }
        sources={
          <>
            학습 근거{" "}
            <a
              href="https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf"
              target="_blank"
              rel="noreferrer"
            >
              OSTEP 7장 ↗
            </a>{" "}
            ·{" "}
            <a
              href="https://cs341.cs.illinois.edu/coursebook/Scheduling"
              target="_blank"
              rel="noreferrer"
            >
              Illinois CS341 ↗
            </a>
          </>
        }
      />
      <CpuPrediction
        lesson={lesson}
        quiz={quiz}
        onClose={() => setQuiz(null)}
        onReveal={reveal}
        progress={progress}
      />
      {custom && (
        <CpuCustomSheet
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
      <CpuComparison
        lesson={lesson}
        open={compareOpen}
        onOpenChange={setCompareOpen}
        algorithm={snap.algorithm}
        quantum={snap.quantum}
        onTryOther={(other) => {
          setCompareOpen(false);
          playback.setAlgorithm(other);
        }}
      />
    </ExplorerPage>
  );
}

/** The scene's accessible summary of the moment on screen. */
function sceneLabel({ time, move, frame, algorithm }: PlaybackSnapshot) {
  return `${time}밀리초. ${move ? `${eventLabel(move, algorithm)} 이동 중` : `CPU ${frame.running || "대기"}`}. 준비 큐 ${frame.ready.join(", ") || "없음"}. 입출력 ${frame.blocked.map((b) => b.id).join(", ") || "없음"}. 완료 ${frame.completed.join(", ") || "없음"}. 작업을 선택하면 상세 정보를 볼 수 있습니다.`;
}

/** The stage foot: one short status line (who runs and until when). */
function StatusLine({ lesson, snap }: { lesson: Lesson; snap: PlaybackSnapshot }) {
  const frame = snap.frame;
  const hasIo = lesson.processes.some((p) => p.io.length);
  let text: string;
  if (snap.transitioning) {
    text = frame.running
      ? `${josa(frame.running, "가")} CPU 사용 중 · 작업 이동 중`
      : "CPU 비어 있음 · 작업 이동 중";
  } else if (frame.running) {
    const left = frame.states[frame.running].burstRemaining;
    const until = {
      rr: `할당량 ${frame.quantumLeft} ms 남음`,
      fcfs: hasIo ? "입출력 요청 또는 완료까지" : `완료까지 ${left} ms`,
      sjf: `완료까지 ${left} ms`,
      srtf: `남은 ${left} ms · 더 짧은 작업이 오면 선점`,
    }[snap.algorithm];
    text = `${frame.running} 실행 중 · ${until}`;
  } else {
    text = snap.finished
      ? "모든 작업을 처리했습니다"
      : snap.time < 0
        ? "시작 전 · 아직 도착한 작업이 없습니다"
        : "CPU 유휴 · 준비된 작업이 없습니다";
  }
  return (
    <>
      <Led
        id="status-led"
        on={Boolean(frame.running)}
        color={frame.running ? colorOf(frame.running) : "var(--label-3)"}
      />
      <span id="status-text" className="text-label">
        {text}
      </span>
    </>
  );
}
