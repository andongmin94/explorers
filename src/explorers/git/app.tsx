// Git 탐색기: one lesson per page (?lesson=auto-merge|conflict|rebase; the bare
// page is fast-forward). Deep links: &step=N&choice=… (add &animate to play
// into the step). The shell (toolbar, rail, console, footer) comes from
// src/components/shell; this file wires the lesson's playback, panels and
// sheets together.
import { ChartColumnIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Console, Footer, Kbd, Stage } from "@/components/shell/console.tsx";
import { LessonRail } from "@/components/shell/lesson-rail.tsx";
import { ExplorerPage } from "@/components/shell/page.tsx";
import { Toolbar, ToolbarKey } from "@/components/shell/toolbar.tsx";
import { Led, Readout, Tag } from "@/components/ui/content.tsx";
import { Muted } from "@/components/ui/typography.tsx";
import { createProgress, type Progress } from "@/lib/lesson-kit.ts";
import { currentLesson, progressIdFor } from "@/lib/lesson-rail.ts";
import { CONTROLS, useExplorerShortcuts } from "@/lib/shortcuts.ts";
import { GitComparison } from "./comparison.tsx";
import { GitDeck } from "./deck.tsx";
import { FILE_NAME } from "./engine.ts";
import { pad } from "./format.ts";
import { GitScene } from "./git-scene.tsx";
import type { Lesson, Prediction } from "./lesson-model.ts";
import { LESSONS } from "./lessons.ts";
import { Playback, usePlayback, type PlaybackSnapshot } from "./playback.ts";
import { GitPrediction, type Quiz } from "./prediction.tsx";
import { GitRecords, type RecordTab } from "./records.tsx";
import { GitSide, stepView, type SideTab } from "./side.tsx";
import { FileWell } from "./well.tsx";

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

export function App() {
  /* The lesson this page runs (?lesson=…, the bare page opens the first). */
  const lesson = useMemo(() => currentLesson(LESSONS), []);
  const lessonNumber = pad(LESSONS.indexOf(lesson) + 1);
  const [progress] = useState(() =>
    createProgress(progressIdFor("git", LESSONS, lesson.id), {
      scenes: lesson.sceneTotal,
      recall: lesson.recap.recall.length,
    }),
  );
  const [playback] = useState(() => new Playback(lesson, progress));
  const snap = usePlayback(playback);
  const summary = useProgressSummary(progress);

  const [sideTab, setSideTab] = useState<SideTab>("now");
  const [recordTab, setRecordTab] = useState<RecordTab>("log");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  // Any render of the step (a move) closes an open prediction, as before.
  const shownQuiz = quiz && quiz.renders === snap.renders ? quiz : null;
  const { text } = stepView(lesson, snap);

  const openPrediction = () => {
    playback.pause();
    const prediction = lesson.predictionAt(playback.index, playback.choice);
    if (!prediction) return;
    setQuiz({ prediction, renders: snap.renders });
  };
  const closePrediction = (answered: boolean) => {
    setQuiz(null);
    // The step behind the sheet may now show what answers the question.
    if (answered) playback.refresh();
  };
  const verify = (q: Prediction) => {
    setQuiz(null);
    if (q.verify.step === playback.index) {
      // The answer is this step's own output (git status): reveal it here.
      playback.refresh();
      playback.show("terminal");
      return;
    }
    void playback.move(q.verify.step, true);
  };
  const openComparison = useCallback(() => {
    playback.pause();
    progress.markCompared();
    setCompareOpen(true);
  }, [playback, progress]);

  // Keyboard: Space play/pause, ←/→ one event, R back to the start (not while a
  // sheet or the lesson drawer is open, or a control has focus).
  const sheetOpen = shownQuiz !== null || compareOpen;
  useExplorerShortcuts(
    [
      { keys: "space", run: () => playback.togglePlay(), description: "재생·정지" },
      {
        keys: "arrowleft",
        run: () => playback.jump(playback.index - 1),
        description: "이전 사건",
      },
      {
        keys: "arrowright",
        run: () => playback.jump(playback.index + 1),
        description: "다음 사건",
      },
      { keys: "r", run: () => playback.reset(), description: "처음으로" },
    ],
    {
      enabled: () => !sheetOpen && !document.querySelector("[data-rail-open]"),
      ignore: `${CONTROLS},tr[data-time]`,
    },
  );
  useEffect(() => {
    const onVisibility = () => document.hidden && playback.pause();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [playback]);
  useEffect(() => () => playback.dispose(), [playback]);

  const last = snap.run.steps.length - 1;
  return (
    <ExplorerPage>
      <Toolbar
        explorer="git"
        caption="브랜치와 병합"
        lessonNumber={lessonNumber}
        lessonTitle={lesson.title}
        actions={
          <ToolbarKey data-action="compare" className="glass-lens-sm" onClick={openComparison}>
            <ChartColumnIcon aria-hidden="true" />
            <span>{lesson.compareLabel}</span>
          </ToolbarKey>
        }
      />
      <Console>
        <LessonRail
          explorer="git"
          title="Git 브랜치와 병합"
          lessons={LESSONS}
          current={lesson.id}
          progress={progress}
        />
        <Stage
          label="파일과 저장소"
          className="console:grid console:grid-cols-[minmax(0,1fr)_clamp(250px,27%,340px)] console:grid-rows-[auto_minmax(0,1fr)_auto] console:[&>:first-child]:col-span-full console:[&>:last-child]:col-span-full"
          head={
            <>
              <Tag>{FILE_NAME}</Tag>
              <Readout glass aria-label="현재 사건">
                <span id="step-count">{pad(snap.index)}</span>
                <small id="step-total">/ {pad(last)} 사건</small>
              </Readout>
            </>
          }
          foot={<StatusLine lesson={lesson} snap={snap} />}
        >
          <GitScene playback={playback} focus={text.focus} busy={snap.busy} />
          <FileWell lesson={lesson} state={snap.shown} />
        </Stage>
        <GitDeck playback={playback} snap={snap} />
        <GitSide
          lesson={lesson}
          playback={playback}
          snap={snap}
          tab={sideTab}
          onTab={setSideTab}
          progress={progress}
          summary={summary}
          onPredict={openPrediction}
        />
        <GitRecords
          lesson={lesson}
          playback={playback}
          snap={snap}
          tab={recordTab}
          onTab={setRecordTab}
          onCompare={openComparison}
        />
      </Console>
      <Footer
        shortcuts={
          <>
            조작: <Kbd>Space</Kbd> 재생·정지 <Kbd>←</Kbd>
            <Kbd>→</Kbd> 사건 이동 <Kbd>R</Kbd> 처음으로
          </>
        }
        sources={
          <>
            학습 근거{" "}
            {lesson.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </span>
            ))}
          </>
        }
      />
      <GitPrediction
        lesson={lesson}
        quiz={shownQuiz}
        onClose={closePrediction}
        onAnswered={(q) => playback.settle(q.index)}
        onVerify={verify}
        progress={progress}
      />
      <GitComparison
        lesson={lesson}
        open={compareOpen}
        onOpenChange={setCompareOpen}
        choice={snap.choice}
        onPlay={(variant) => {
          setCompareOpen(false);
          void playback.playVariant(variant);
        }}
        onFork={() => {
          setCompareOpen(false);
          playback.jump(lesson.fork);
        }}
      />
    </ExplorerPage>
  );
}

/** The stage foot: one status line (the scene's phase while a step plays). */
function StatusLine({ lesson, snap }: { lesson: Lesson; snap: PlaybackSnapshot }) {
  const { busy, phase, index } = snap;
  const state = snap.shown;
  const last = snap.run.steps.length - 1;
  const { pendingAt } = stepView(lesson, snap);
  const [title, body] =
    busy && phase && phase.kind !== "complete"
      ? [phase.title, phase.body]
      : [
          lesson.status(state, {
            index,
            last,
            pending: pendingAt(index),
            variant: snap.choice,
          }),
        ];
  // While prediction 10 (lesson 03) is open the LED does not say "still unresolved".
  const hide = pendingAt(index) && state.status === "resolved";
  const conflict =
    !hide &&
    (state.status === "conflict" ||
      state.index.status === "unmerged" ||
      state.index.status === "comparing");
  return (
    <>
      <Led
        id="status-led"
        className="self-center"
        on={busy || conflict}
        color={conflict ? "var(--git-conflict)" : "var(--accent)"}
      />
      <span id="status" className="leading-normal text-label">
        {title}
        {body && <Muted> — {body}</Muted>}
      </span>
    </>
  );
}
