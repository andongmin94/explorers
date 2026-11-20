// The lesson column: 해설 · 장면 · 프레임 · 범위. Nothing in it scrolls: each
// tab is a fit column whose blocks page (PagedList + Pager).
import { useEffect, useState } from "react";

import { PagedList, Pager, usePager, type PagedItem } from "@/components/learning/pager.tsx";
import { ProgressLine, recapItems } from "@/components/learning/recap.tsx";
import { SidePanel } from "@/components/shell/console.tsx";
import { PlateHead } from "@/components/shell/plate.tsx";
import { Button } from "@/components/ui/button.tsx";
import { listButtonRow, Note } from "@/components/ui/content.tsx";
import { Segment, SegmentedControl } from "@/components/ui/segmented-control.tsx";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs.tsx";
import { Index, Label, Text, Title, VisuallyHidden } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import {
  LABELS,
  type Progress,
  type ProgressSummary,
  type RecallChoice,
  type RecallQuestion,
} from "@/lib/lesson-kit.ts";
import { nextLesson } from "@/lib/lesson-rail.ts";
import { LESSONS } from "./lessons.ts";
import { PageChip } from "./parts.tsx";
import type { Playback, PlaybackSnapshot } from "./playback.ts";
import { modelRules, NEXT_NOTE, TERMS } from "./terms.ts";
import type { Algorithm, Frame, Quiz, Step } from "./types.ts";

export type SideTab = "now" | "scenes" | "frames" | "scope";

/** A fit column body: fills the panel, its paged list takes the rest. */
const bodyClass = cn(
  "fit-column px-3.5 pt-2.5 pb-4 phone:px-3",
  "min-[1100px]:min-h-0 min-[1100px]:flex-1",
  "console-short:pt-2.5 console-short:pb-3",
);
/** Rows of a list (kit Lists): hairlines between them. */
const rows =
  "m-0 grid list-none content-start p-0 [&>*]:flex [&>*]:min-h-9 [&>*]:items-center [&>*]:gap-2.5 [&>*]:border-b [&>*]:border-separator-soft [&>*]:px-0.5 [&>*]:py-[7px] [&>*]:keep-all [&>*:last-child]:border-b-0";

export function MemorySide({
  playback,
  snap,
  tab,
  onTab,
  progress,
  summary,
  nextQuiz,
  hints,
  masked,
  onPredict,
  onCompare,
}: {
  playback: Playback;
  snap: PlaybackSnapshot;
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  progress: Progress;
  summary: ProgressSummary;
  /** The prediction for the next access, if any (none while it plays). */
  nextQuiz: Quiz | null;
  /** Next-victim marks may show (no victim prediction pending). */
  hints: boolean;
  masked: boolean;
  onPredict: () => void;
  onCompare: () => void;
}) {
  const lesson = playback.lesson;
  const total = playback.total;
  const { run, mode, index, committed, busy } = snap;
  const nowPager = usePager();
  const scenePager = usePager();
  const framesPager = usePager();
  const termsPager = usePager();
  const rulesPager = usePager();
  const [scope, setScope] = useState<"terms" | "rules">("terms");
  const finished = index === total && !busy;

  /* ----- 해설 (+ 정리 at the end) ----- */
  const shown = run.steps[busy && index < total ? index : committed];
  const d = lesson.describe(shown, run, mode);
  const eyebrow = busy ? `${index}번째 접근 · 처리 중 · ${mode.label}` : d.eyebrow;
  const body = busy ? snap.phase.body : d.body;
  const goal = busy ? "" : d.goal;
  // Changed explanation text starts again on its first page.
  const resetKey = `${eyebrow}|${d.title}|${body}|${goal}|${busy}|${finished}`;
  const [answers, setAnswers] = useState<{ picked: Record<string, number>; last: string | null }>({
    picked: {},
    last: null,
  });

  let items: PagedItem[] = [
    {
      key: "lesson",
      node: (
        <div id="explanation" tabIndex={-1} className="outline-none">
          <Label id="eyebrow">{eyebrow}</Label>
          <Title id="lesson-title" className="mt-1.5">
            {d.title}
          </Title>
          <Text id="lesson-body" aria-live="polite" className="mt-1.5">
            {body}
          </Text>
          {goal && <Text className="mt-1.5 text-label-2">{goal}</Text>}
        </div>
      ),
    },
  ];
  if (!busy && shown.index) {
    items.push({
      key: "event",
      node: (
        <div id="event-block">
          <Label>
            {LABELS.now} 접근 · {d.eventTitle}
          </Label>
          <p className="m-0 mt-1.5 flex flex-wrap items-center gap-1">
            <Label className="mr-1 ml-0.5">직전</Label>
            {shown.before.map((f) => (
              <PageChip key={`b${f.slot}`} page={f.page} />
            ))}
            <Label className="mr-1 ml-2.5">→ 현재</Label>
            {shown.frames.map((f) => (
              <PageChip key={`a${f.slot}`} page={f.page} />
            ))}
          </p>
        </div>
      ),
    });
  }
  if (!busy) {
    items.push({
      key: "key",
      note: true,
      node: (
        <Note accent id="key-block" className="text-body leading-[1.6]">
          <p className="m-0">
            <b className="font-bold">{LABELS.key}</b> <span id="insight">{d.key}</span>
          </p>
        </Note>
      ),
    });
  }
  if (finished) {
    const recap = lesson.recap(playback.runs, playback.extras);
    items = items.concat(
      recapItems({
        explorer: "memory",
        points: recap.points,
        recall: recap.recall,
        answers: answers.picked,
        onAnswer: (question: RecallQuestion, choice: RecallChoice, i: number) => {
          progress.markRecall(question.id, Boolean(choice.correct));
          setAnswers({ picked: { ...answers.picked, [question.id]: i }, last: question.id });
        },
        summary,
        next: nextLesson(LESSONS, lesson.id),
      }),
    );
  }
  // An answer's note is its own block: show the page it landed on.
  useEffect(() => {
    if (answers.last) nowPager.showKey(`recall-why-${answers.last}`);
  }, [answers, nowPager]);

  /* ----- 장면 ----- */
  const milestones = playback.milestones;
  const chapter = milestones.findIndex((m) => m.index === d.chapterId);
  const milestoneItems: PagedItem[] = milestones.map((m, i) => ({
    key: `m${i}`,
    element: (
      <button
        type="button"
        data-seek={m.index}
        data-milestone=""
        aria-current={i === chapter ? "true" : undefined}
        className={cn(listButtonRow, "px-2.5 text-control font-normal text-label")}
        onClick={() => {
          onTab("now");
          void playback.seek(m.index);
        }}
      >
        <Index>{String(i + 1).padStart(2, "0")}</Index>
        <span className="min-w-0 flex-1">{m.title}</span>
        <span className="text-label-2 tabular-nums">
          {m.index === 0 ? "시작" : `${m.index}번째`}
        </span>
      </button>
    ),
  }));
  useEffect(() => {
    scenePager.showKey(`m${Math.max(0, chapter)}`);
  }, [chapter, tab, scenePager]);

  /* ----- 프레임 ----- */
  const step = run.steps[committed];
  const occupied = step.frames.filter((frame) => frame.page !== null);
  const framesNote = busy
    ? "직전 접근 기준"
    : !hints
      ? "예측을 마치면 다음 교체 순서를 표시합니다."
      : occupied.length < step.frames.length
        ? "빈 프레임이 있어 교체하지 않습니다."
        : NEXT_NOTE[mode.algorithm];
  const frameItems: PagedItem[] = occupied.length
    ? occupied.map((f) => ({
        key: `f${f.slot}`,
        element: (
          <li>
            <Label className="w-[22px]">F{f.slot}</Label>
            <PageChip page={f.page} />
            <FrameNumbers frame={f} hints={hints} step={step} algorithm={mode.algorithm} />
          </li>
        ),
      }))
    : [{ key: "empty", element: <li className="text-label-2">RAM이 비어 있습니다.</li> }];
  const framesKey = `${mode.id}:${committed}:${hints}`;

  /* ----- 범위 ----- */
  const definitions = (list: [string, string][], prefix: string): PagedItem[] =>
    list.map(([term, text], i) => ({
      key: `${prefix}${i}`,
      element: (
        <div className="items-baseline!">
          <dt className="w-[92px] flex-none font-semibold keep-all">{term}</dt>
          <dd className="m-0 min-w-0 text-control text-pretty keep-all">{text}</dd>
        </div>
      ),
    }));

  const panel = cn(bodyClass, masked && "invisible");
  return (
    <SidePanel
      aria-labelledby="lesson-label"
      className="min-[1100px]:flex min-[1100px]:flex-col min-[1100px]:[contain:size]"
    >
      <Tabs value={tab} onValueChange={(value) => onTab(value as SideTab)}>
        <PlateHead className="pe-3.5">
          <Label id="lesson-label">
            <Index>B</Index>
            <VisuallyHidden>학습 패널</VisuallyHidden>
          </Label>
          <TabsList aria-labelledby="lesson-label">
            <TabsTab value="now" data-tab="now">
              {LABELS.explainTab}
            </TabsTab>
            <TabsTab value="scenes" data-tab="scenes">
              {LABELS.scenesTab}
            </TabsTab>
            <TabsTab value="frames" data-tab="frames">
              프레임
            </TabsTab>
            <TabsTab value="scope" data-tab="scope">
              {LABELS.scopeTab}
            </TabsTab>
          </TabsList>
        </PlateHead>

        <TabsPanel value="now" className={panel}>
          <PagedList
            id="now-pages"
            pager={nowPager}
            resetKey={resetKey}
            items={items}
            className="paged-blocks"
          />
          {(nextQuiz || finished) && (
            <div className="flex items-center gap-2.5 pt-3">
              {nextQuiz && (
                <Button
                  variant="filled"
                  data-action="predict"
                  className="min-w-0 flex-auto"
                  onClick={onPredict}
                >
                  {LABELS.predict(
                    nextQuiz.kind === "outcome"
                      ? `${nextQuiz.atIndex}번째 ${nextQuiz.page}의 결과`
                      : "내보낼 페이지",
                  )}
                </Button>
              )}
              {finished && (
                <Button
                  variant="filled"
                  data-action="compare"
                  id="conclusion"
                  className="min-w-0 flex-auto"
                  onClick={onCompare}
                >
                  {LABELS.compareEnd}
                </Button>
              )}
              <Pager pager={nowPager} label="해설" className="ms-auto flex-none pt-0" />
            </div>
          )}
          {!nextQuiz && !finished && <Pager pager={nowPager} label="해설" />}
        </TabsPanel>

        <TabsPanel value="scenes" className={panel}>
          <Label>{LABELS.jumpToScene}</Label>
          <PagedList
            as="nav"
            id="milestones"
            aria-label="핵심 학습 장면"
            pager={scenePager}
            resetKey={`${mode.id}:${tab}`}
            items={milestoneItems}
            className={cn(rows, "mt-1.5")}
          />
          <Pager pager={scenePager} label={LABELS.scenesTab} />
          <ProgressLine summary={summary} className="mt-1.5 [&_[data-slot=label]]:basis-full" />
        </TabsPanel>

        <TabsPanel value="frames" className={panel}>
          <Label>지금 RAM의 프레임</Label>
          <Label id="frames-note" className="mt-0.5 font-medium">
            {framesNote}
          </Label>
          <PagedList
            as="ul"
            id="frame-list"
            pager={framesPager}
            resetKey={framesKey}
            items={frameItems}
            className={cn(rows, "mt-1.5")}
          />
          <Pager pager={framesPager} label="프레임" />
        </TabsPanel>

        <TabsPanel value="scope" className={panel}>
          <SegmentedControl
            aria-label="범위"
            value={scope}
            onValueChange={(value) => setScope(value)}
            className="self-start"
          >
            <Segment value="terms" data-scope="terms">
              용어
            </Segment>
            <Segment value="rules" data-scope="rules">
              이 실험의 규칙
            </Segment>
          </SegmentedControl>
          {scope === "terms" ? (
            <>
              <PagedList
                as="dl"
                id="terms"
                aria-label="용어"
                pager={termsPager}
                resetKey="terms"
                items={definitions(TERMS, "t")}
                className={cn(rows, "mt-1.5")}
              />
              <Pager pager={termsPager} label="용어" />
            </>
          ) : (
            <>
              <PagedList
                as="dl"
                id="rules"
                aria-label="이 실험의 규칙"
                pager={rulesPager}
                resetKey="rules"
                items={definitions(modelRules(lesson), "r")}
                className={cn(rows, "mt-1.5")}
              />
              <Pager pager={rulesPager} label="규칙" />
            </>
          )}
        </TabsPanel>
      </Tabs>
    </SidePanel>
  );
}

/** What each policy compares, as shown in the 프레임 tab for one frame. */
function FrameNumbers({
  frame: f,
  hints,
  step,
  algorithm,
}: {
  frame: Frame;
  hints: boolean;
  step: Step;
  algorithm: Algorithm;
}) {
  const cell = (on: boolean, label: string, value: number | string | null, key = label) => (
    <span key={key} className={cn(on && "text-label [&>b]:font-bold")}>
      {label} <b className="font-mono font-medium">{value}</b>
    </span>
  );
  let cells;
  if (algorithm === "opt")
    cells = [cell(false, "적재", f.loadedAt), cell(hints, "다음 접근", f.nextUseAt ?? "없음")];
  else if (algorithm === "clock")
    cells = [
      cell(false, "적재", f.loadedAt),
      cell(true, "참조 비트", f.ref ? 1 : 0),
      step.hand === f.slot && (
        <span key="hand" className="text-label">
          ▲ 바늘
        </span>
      ),
    ];
  else
    cells = [
      cell(hints && algorithm === "fifo", "적재", f.loadedAt),
      cell(hints && algorithm === "lru", "마지막 접근", f.lastUsedAt),
    ];
  return (
    <span className="ms-auto flex gap-3.5 text-caption text-label-2 phone:gap-2.5">{cells}</span>
  );
}
