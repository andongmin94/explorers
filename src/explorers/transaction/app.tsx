// 트랜잭션 탐색기: one lesson per page. index.html runs lessons 01, 03 and 04
// (?lesson=…), deadlock.html lesson 02. Every lesson shares this console: the
// shell comes from src/components/shell, the lesson (page.ts) brings its
// runs, scene, 해설, records and comparison.
import { ChartColumnIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { Console, Footer, Kbd, Stage } from "@/components/shell/console.tsx";
import { sceneBoxClass } from "@/components/shell/console.tsx";
import { LessonRail } from "@/components/shell/lesson-rail.tsx";
import { ExplorerPage } from "@/components/shell/page.tsx";
import { Toolbar, ToolbarKey } from "@/components/shell/toolbar.tsx";
import { Led, Readout, Tag } from "@/components/ui/content.tsx";
import { cn } from "@/lib/cn.ts";
import { createProgress, LABELS, type Progress } from "@/lib/lesson-kit.ts";
import { progressIdFor } from "@/lib/lesson-rail.ts";
import { TxDeck } from "./deck.tsx";
import { EXPLORER, LESSONS, RAIL_TITLE, lessonById, lessonNumber } from "./lessons.ts";
import type { TxPage } from "./page.ts";
import { pad } from "./parts.tsx";
import { Player, usePlayer } from "./player.ts";
import { TxRecords, type RecordTab } from "./records.tsx";
import { TxComparison, TxPrediction } from "./sheets.tsx";
import { TxSide, type SideTab } from "./side.tsx";
import type { Quiz } from "./types.ts";

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

/** Progress of one lesson, under its own id (transaction, transaction:deadlock, …). */
function lessonProgress(page: TxPage) {
  return createProgress(progressIdFor(EXPLORER, LESSONS, page.lessonId), {
    scenes: 5,
    recall: page.recap.recall.length,
  });
}

export function App({ page }: { page: TxPage }) {
  const lesson = lessonById(page.lessonId)!;
  const [progress] = useState(() => lessonProgress(page));
  const [player] = useState(
    () =>
      new Player({
        runs: page.runs,
        mode: page.modes[0],
        stopAt: page.stopAt,
        // A 핵심 장면 counts once its event is on screen (not while it plays).
        onRender: (snap) => {
          if (snap.busy) return;
          const step = page.runs[snap.mode].steps[snap.done];
          const at = page.milestones(snap.mode).findIndex((m) => m.index === step.index);
          if (at >= 0) progress.markScene(at + 1);
        },
      }),
  );
  const snap = usePlayer(player);
  const summary = useProgressSummary(progress);

  const [sideTab, setSideTab] = useState<SideTab>("lesson");
  const [recordTab, setRecordTab] = useState<RecordTab>("timeline");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const openPrediction = (shown: Quiz) => {
    player.pause();
    setQuiz(shown);
  };
  const reveal = () => {
    setQuiz(null);
    const scene = document.getElementById("scene");
    scene?.focus({ preventScroll: true });
    scene?.scrollIntoView({ block: "nearest", behavior: "instant" });
    void player.move(player.snapshot().index + 1, true);
  };
  const openComparison = () => {
    player.pause();
    progress.markCompared();
    setCompareOpen(true);
  };
  const switchMode = (mode: string) => {
    setCompareOpen(false);
    player.setMode(mode);
  };

  // Keyboard: Space play/pause, ←/→ one event, R back to the start (not while
  // a sheet is open or a control has focus). Leaving the tab pauses.
  const sheetOpen = quiz !== null || compareOpen;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        sheetOpen ||
        (e.target as Element | null)?.closest?.(
          "input,select,textarea,button,a,summary,[role='button']",
        )
      )
        return;
      const { index } = player.snapshot();
      if (e.code === "Space") {
        e.preventDefault();
        player.play();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        void player.jump(index - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        void player.jump(index + 1);
      } else if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        void player.jump(0);
      }
    };
    const onVisibility = () => document.hidden && player.pause();
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [player, sheetOpen]);

  const steps = page.runs[snap.mode].steps;
  return (
    <ExplorerPage>
      <Toolbar
        explorer="transaction"
        caption="보면서 이해하는 데이터베이스"
        lessonNumber={lessonNumber(page.lessonId)}
        lessonTitle={lesson.title}
        actions={
          <ToolbarKey data-action="compare" className="glass-lens-sm" onClick={openComparison}>
            <ChartColumnIcon aria-hidden="true" />
            <span>{LABELS.compare}</span>
          </ToolbarKey>
        }
      />
      <Console>
        <LessonRail
          explorer="transaction"
          title={RAIL_TITLE}
          lessons={LESSONS}
          current={page.lessonId}
          progress={progress}
        />
        <Stage
          label={page.stageLabel}
          head={
            <>
              <Tag id="stage-tag" className="phone:hidden">
                {page.stageTag(snap.mode)}
              </Tag>
              <Readout glass aria-hidden="true">
                <span id="step-count">{pad(snap.index)}</span>
                <small>/ {pad(snap.last)} 사건</small>
              </Readout>
            </>
          }
          foot={
            <>
              <Led id="status-led" on={snap.busy} />
              <span id="status" className="text-control text-label">
                {snap.status}
              </span>
            </>
          }
        >
          <TxSceneHost page={page} player={player} busy={snap.busy} />
        </Stage>
        <TxDeck page={page} player={player} snap={snap} />
        <TxSide
          page={page}
          player={player}
          snap={snap}
          tab={sideTab}
          onTab={setSideTab}
          progress={progress}
          summary={summary}
          onPredict={openPrediction}
          onCompare={openComparison}
        />
        <TxRecords
          page={page}
          tab={recordTab}
          onTab={setRecordTab}
          mode={snap.mode}
          snap={snap}
          steps={steps}
          onSeek={(index) => void player.jump(index)}
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
            {page.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title} ↗
                </a>
              </span>
            ))}
          </>
        }
      />
      <TxPrediction
        page={page}
        mode={snap.mode}
        quiz={quiz}
        onClose={() => setQuiz(null)}
        onReveal={reveal}
        progress={progress}
      />
      <TxComparison
        page={page}
        mode={snap.mode}
        open={compareOpen}
        onOpenChange={setCompareOpen}
        onMode={switchMode}
      />
    </ExplorerPage>
  );
}

/** React owns the host element; the imperative scene owns everything inside it. */
function TxSceneHost({ page, player, busy }: { page: TxPage; player: Player; busy: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scene = page.createScene(host.current!, player.onPhase);
    player.attachScene(scene);
    return () => {
      player.detachScene(scene);
      scene.destroy();
    };
  }, [page, player]);
  return (
    <div
      ref={host}
      id="scene"
      tabIndex={-1}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the scene is one picture (the SVG inside is role="img")
      role="group"
      aria-label={page.sceneLabel}
      aria-busy={busy}
      className={cn(
        sceneBoxClass,
        "tx-scene min-h-0 outline-none stacked:overflow-hidden [@media(max-height:699px)]:overflow-hidden",
      )}
    />
  );
}
