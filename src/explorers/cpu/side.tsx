// The lesson column: 해설 · 장면 · 작업 · 범위. Nothing in it scrolls: each tab
// is a fit column whose blocks page (PagedList + Pager).
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { PagedList, Pager, usePager, type PagedItem } from "@/components/learning/pager.tsx";
import { recapItems } from "@/components/learning/recap.tsx";
import { SidePanel } from "@/components/shell/console.tsx";
import { PlateHead } from "@/components/shell/plate.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Led, listButtonRow, List, Note } from "@/components/ui/content.tsx";
import { Segment, SegmentedControl } from "@/components/ui/segmented-control.tsx";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs.tsx";
import { Index, Label, Muted, Text, Title, VisuallyHidden } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import {
  LABELS,
  type Progress,
  type ProgressSummary,
  type RecallChoice,
  type RecallQuestion,
} from "@/lib/lesson-kit.ts";
import { nextLesson } from "@/lib/lesson-rail.ts";
import { explanationItems, explanationKey } from "./explanation.tsx";
import { colorOf, keepUnits } from "./format.ts";
import { eventLabel, processDetails } from "./lesson.ts";
import { LESSONS, lessonRuns, type Lesson } from "./lessons.ts";
import type { Playback, PlaybackSnapshot } from "./playback.ts";

export type SideTab = "now" | "scenes" | "process" | "rules";

/** A fit column body: fills the panel, its paged list takes the rest. */
const bodyClass = cn(
  "fit-column px-3.5 pt-2.5 pb-4 phone:px-3",
  "min-[1100px]:min-h-0 min-[1100px]:flex-1",
  "console-short:pt-2.5 console-short:pb-3",
);
const pagesClass = "paged-blocks";

export function CpuSide({
  playback,
  snap,
  tab,
  onTab,
  selected,
  onPick,
  progress,
  summary,
  onPredict,
  onCompare,
}: {
  playback: Playback;
  snap: PlaybackSnapshot;
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  selected: string | null;
  onPick: (id: string) => void;
  progress: Progress;
  summary: ProgressSummary;
  onPredict: () => void;
  onCompare: () => void;
}) {
  const lesson = playback.lesson;
  const lessonNumber = String(LESSONS.indexOf(lesson) + 1).padStart(2, "0");
  const nowPager = usePager();
  const scenePager = usePager();
  const processPager = usePager();
  const rulesPager = usePager();
  const { result, time } = snap;
  const finished = snap.finished && !snap.move;
  const intro = time < 0 && !snap.move;

  /* ----- 해설 (+ 정리 at the end) ----- */
  const resetKey = explanationKey(snap);
  const [answers, setAnswers] = useState<{
    key: string;
    picked: Record<string, number>;
    last: string | null;
  }>({
    key: resetKey,
    picked: {},
    last: null,
  });
  const picked = answers.key === resetKey ? answers.picked : {};
  let items = explanationItems({
    lesson,
    lessonNumber,
    snap,
    onReplay: () => playback.replayEvent(),
  });
  if (finished && !intro) {
    const runs = lessonRuns(lesson, snap.quantum);
    const recall = lesson.content.recall(runs);
    items = items.concat(
      recapItems({
        explorer: "cpu",
        points: lesson.content.recapPoints(result, runs).map(keepUnits),
        recall,
        answers: picked,
        onAnswer: (question: RecallQuestion, choice: RecallChoice, index: number) => {
          progress.markRecall(question.id, Boolean(choice.correct));
          setAnswers({
            key: resetKey,
            picked: { ...picked, [question.id]: index },
            last: question.id,
          });
        },
        summary,
        next: nextLesson(LESSONS, lesson.id),
        pointClass: "m-0",
      }),
    );
  }
  // An answer's note is its own block: show the page it landed on.
  const lastAnswer = answers.key === resetKey ? answers.last : null;
  useEffect(() => {
    if (lastAnswer) nowPager.showKey(`recall-why-${lastAnswer}`);
  }, [lastAnswer, answers, nowPager]);

  const hasNext = result.decisions.some((d) => d.time > time && d.candidates.length > 1);

  /* ----- 장면 ----- */
  const milestones = lesson.content.milestones(result);
  const active = Math.max(
    0,
    milestones.findLastIndex((m) => m.time <= time),
  );
  const milestoneItems: PagedItem[] = milestones.map((m, i) => ({
    key: `m${i}`,
    element: (
      <button
        type="button"
        data-time={m.time}
        data-milestone=""
        aria-current={i === active ? "true" : undefined}
        className={cn(listButtonRow, "group/m px-2.5 font-normal aria-[current=true]:font-[650]")}
        onClick={() => {
          playback.seek(m.time);
          onTab("now");
          requestAnimationFrame(() => {
            const el = document.getElementById("explanation");
            el?.focus({ preventScroll: true });
            el?.scrollIntoView({ block: "nearest" });
          });
        }}
      >
        <Index className={cn(i < active && "text-label-2")}>{String(i + 1).padStart(2, "0")}</Index>
        <span className="min-w-0 flex-1">{m.title}</span>
        <span className="text-label-2 tabular-nums">{m.time} ms</span>
      </button>
    ),
  }));
  const milestoneKey = `${snap.algorithm}:${snap.quantum}:${tab}`;
  useEffect(() => {
    scenePager.showKey(`m${active}`);
  }, [active, milestoneKey, scenePager]);

  /* ----- 작업 ----- */
  const processItems = processDetailItems(lesson, snap, selected);
  const processKey = `${selected}:${snap.time}:${snap.move?.type}-${snap.move?.id}:${snap.algorithm}:${snap.quantum}`;

  /* ----- 범위 ----- */
  const ruleItems: PagedItem[] = lesson.content.rules.map((rule, i) => ({
    key: `r${i}`,
    text: rule,
    className: "text-control keep-all",
  }));

  return (
    <SidePanel
      aria-labelledby="side-label"
      className="min-[1100px]:flex min-[1100px]:flex-col min-[1100px]:[contain:size]"
    >
      <Tabs value={tab} onValueChange={(value) => onTab(value as SideTab)}>
        <PlateHead className="pe-3.5">
          <Label id="side-label">
            <Index>B</Index>
            <VisuallyHidden>학습 패널</VisuallyHidden>
          </Label>
          <TabsList aria-labelledby="side-label">
            <TabsTab value="now" data-tab="now">
              {LABELS.explainTab}
            </TabsTab>
            <TabsTab value="scenes" data-tab="scenes">
              {LABELS.scenesTab}
            </TabsTab>
            <TabsTab value="process" data-tab="process">
              작업
            </TabsTab>
            <TabsTab value="rules" data-tab="rules">
              {LABELS.scopeTab}
            </TabsTab>
          </TabsList>
        </PlateHead>

        <TabsPanel value="now" className={bodyClass}>
          <PagedList
            id="now-pages"
            pager={nowPager}
            resetKey={resetKey}
            items={items}
            className={pagesClass}
          />
          <div className="flex items-center gap-2.5 pt-3">
            {!snap.finished && (
              <Button
                variant="filled"
                data-action="predict"
                className="min-w-0 flex-auto"
                onClick={onPredict}
              >
                {hasNext ? (
                  LABELS.predict("다음 CPU 배정")
                ) : (
                  <>
                    앞선 장면에서 다시 예측 <ArrowRightIcon aria-hidden="true" />
                  </>
                )}
              </Button>
            )}
            {snap.finished && (
              <Button
                variant="filled"
                data-action="compare"
                data-conclusion=""
                className="min-w-0 flex-auto"
                onClick={onCompare}
              >
                {LABELS.compareEnd}
              </Button>
            )}
            <Pager pager={nowPager} label="해설" className="flex-none pt-0" />
          </div>
        </TabsPanel>

        <TabsPanel value="scenes" className={bodyClass}>
          <Label className="mb-1.5">
            {LABELS.jumpToScene}{" "}
            <Muted>
              · {active + 1} / {milestones.length}
            </Muted>
          </Label>
          <PagedList
            as="nav"
            aria-label="핵심 학습 장면"
            pager={scenePager}
            resetKey={milestoneKey}
            items={milestoneItems}
            className={cn(
              "grid content-start",
              "[&>*]:flex [&>*]:min-h-9 [&>*]:items-center [&>*]:gap-2.5 [&>*]:border-b [&>*]:border-separator-soft [&>*]:py-[7px] [&>*]:keep-all [&>*:last-child]:border-b-0",
            )}
          />
          <Pager pager={scenePager} label="장면" />
        </TabsPanel>

        <TabsPanel value="process" className={bodyClass}>
          <SegmentedControl
            aria-label="자세히 볼 작업"
            value={selected}
            onValueChange={(id) => onPick(id)}
            className="mb-3.5 grid grid-cols-3"
          >
            {lesson.processes.map((p) => (
              <Segment
                key={p.id}
                value={p.id}
                data-pick={p.id}
                className="gap-2 aria-pressed:[&>[data-slot=led]]:shadow-[0_0_0_1.5px_var(--on-accent)]"
              >
                <Led color={colorOf(p.id)} />
                {p.id}
              </Segment>
            ))}
          </SegmentedControl>
          <PagedList
            id="process-detail"
            pager={processPager}
            resetKey={processKey}
            items={processItems}
            className={pagesClass}
          />
          <Pager pager={processPager} label="상세" />
        </TabsPanel>

        <TabsPanel value="rules" className={bodyClass}>
          <Label className="mb-1.5">이 모델의 범위 · 흔한 오해</Label>
          <PagedList
            as="ul"
            textAs="li"
            id="rules"
            pager={rulesPager}
            resetKey={lesson.id}
            items={ruleItems}
            className="m-0 grid list-none p-0 [&>*]:flex [&>*]:min-h-9 [&>*]:items-center [&>*]:border-b [&>*]:border-separator-soft [&>*]:px-0.5 [&>*]:py-[7px] [&>*:last-child]:border-b-0"
          />
          <Pager pager={rulesPager} label="범위" />
        </TabsPanel>
      </Tabs>
    </SidePanel>
  );
}

/** 작업 tab: the picked job's phases and time split, from progress so far only. */
function processDetailItems(
  lesson: Lesson,
  snap: PlaybackSnapshot,
  selected: string | null,
): PagedItem[] {
  if (!selected)
    return [
      {
        key: "hint",
        text: "작업 키를 누르거나, 장면의 작업이나 작업별 지표의 행을 누르면 그 작업의 순서와 시간 분해를 볼 수 있습니다.",
        className: "m-0 text-body text-label-2 text-pretty keep-all",
      },
    ];
  const p = lesson.processes.find((entry) => entry.id === selected)!;
  const detail = processDetails(snap.frame, snap.result, selected);
  if (snap.move?.id === selected)
    detail.body = `${eventLabel(snap.move, snap.algorithm)} 이동 중입니다.`;
  const status = { past: "완료", current: "현재 구간", future: "예정" } as const;
  return [
    {
      key: "head",
      node: (
        <div className="grid gap-1.5">
          <Label>
            {p.id} · {p.arrival} ms 도착
          </Label>
          <Title>{p.name}</Title>
          <Text>{keepUnits(detail.body)}</Text>
        </div>
      ),
    },
    {
      key: "phases",
      node: (
        <div>
          <Label>작업이 끝나기까지의 순서</Label>
          <List as="ol" className="[&>li]:items-baseline">
            {detail.phases.map((ph, i) => (
              <li key={i} className={cn(ph.status === "future" && "text-label-2")}>
                <Index>{i + 1}</Index>
                <span className="grid min-w-0 flex-1 gap-1.5">
                  <span>
                    {ph.kind === "cpu" ? "CPU 실행" : "입출력"}{" "}
                    <span className="text-label-2 tabular-nums">
                      {ph.used} / {ph.total}&nbsp;ms
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="block h-1 overflow-hidden rounded-full bg-fill-1"
                  >
                    <i
                      className="block h-full rounded-[inherit]"
                      style={{ width: `${(ph.used / ph.total) * 100}%`, background: colorOf(p.id) }}
                    />
                  </span>
                </span>
                <Label className="min-w-16 flex-none justify-end">{status[ph.status]}</Label>
              </li>
            ))}
          </List>
        </div>
      ),
    },
    {
      key: "metrics",
      node: (
        <div>
          <Label>시간 분해</Label>
          <List as="dl" className="[&>div]:items-start [&>div]:justify-between">
            {detail.metrics.map((m) => (
              <div key={m.label}>
                <dt className="grid gap-0.5">
                  <span>{m.label}</span>
                  <span className="text-caption text-label-2">{m.help}</span>
                </dt>
                <dd className="m-0 flex-none font-bold tabular-nums">{keepUnits(m.value)}</dd>
              </div>
            ))}
          </List>
        </div>
      ),
    },
    { key: "insight", note: true, node: <Note as="p">{keepUnits(detail.insight)}</Note> },
  ];
}
