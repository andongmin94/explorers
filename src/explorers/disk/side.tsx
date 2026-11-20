// The lesson column: 해설 · 거리 · 장면 · 범위. Nothing in it scrolls: each tab
// is a fit column whose blocks page (PagedList + Pager).
import { useEffect, useState } from "react";

import { PagedList, Pager, usePager, type PagedItem } from "@/components/learning/pager.tsx";
import { recapItems } from "@/components/learning/recap.tsx";
import { SidePanel } from "@/components/shell/console.tsx";
import { PlateHead } from "@/components/shell/plate.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Led, List, listButtonRow, Note } from "@/components/ui/content.tsx";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs.tsx";
import { Index, Label, Text, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { josa } from "@/lib/josa.ts";
import {
  LABELS,
  type Progress,
  type ProgressSummary,
  type RecallChoice,
  type RecallQuestion,
} from "@/lib/lesson-kit.ts";
import { nextLesson } from "@/lib/lesson-rail.ts";
import { useMediaQuery } from "@/lib/use-media-query.ts";
import { fix } from "./format.ts";
import { STAGES } from "./lesson.ts";
import { LESSONS } from "./lessons.ts";
import { N, type Playback, type PlaybackSnapshot } from "./playback.ts";
import type { Candidate, DiskRequest, Step } from "./types.ts";

export type SideTab = "lesson" | "distance" | "scenes" | "scope";

/** A fit column body: fills the panel, its paged list takes the rest. */
const bodyClass = cn(
  "fit-column px-3.5 pt-2.5 pb-4 phone:px-3",
  "min-[1100px]:min-h-0 min-[1100px]:flex-1",
  "console:px-5 console:pt-3 console:pb-4 console-short:pt-2.5 console-short:pb-3",
);
const pagesClass = "paged-blocks";
const textClass = "m-0 text-body text-label text-pretty keep-all";
/** Body text and the stage list follow the heading without a hairline (vanilla sections). */
const flowClass = "border-t-0! pt-0!";
const mutedClass = "m-0 text-body text-label-2 text-pretty keep-all";
/** The short desktop window narrates the four stages in the stage foot instead. */
const SHORT_CONSOLE = "(min-width: 1100px) and (min-height: 700px) and (max-height: 820px)";

export function DiskSide({
  playback,
  snap,
  tab,
  onTab,
  progress,
  summary,
  onPredict,
  onCompare,
}: {
  playback: Playback;
  snap: PlaybackSnapshot;
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  progress: Progress;
  summary: ProgressSummary;
  onPredict: () => void;
  onCompare: () => void;
}) {
  const lesson = playback.lesson;
  const lessonPager = usePager();
  const distancePager = usePager();
  const scenePager = usePager();
  const scopePager = usePager();
  const shortConsole = useMediaQuery(SHORT_CONSOLE);
  const { algorithm, index, committed, busy, run } = snap;
  const step = run.steps[committed];
  const target = run.steps[index];
  const end = committed === N && !busy;
  const scenes = lesson.scenes[algorithm];

  /* ----- 해설 (+ 정리 at the end) ----- */
  // Rebuilt only when the moment changes, so recall answers stay put.
  const resetKey = `${algorithm}:${index}:${busy}`;
  const [answers, setAnswers] = useState<{
    key: string;
    picked: Record<string, number>;
    last: string | null;
  }>({ key: resetKey, picked: {}, last: null });
  const picked = answers.key === resetKey ? answers.picked : {};

  const k = scenes.findIndex((m) => m.n === committed);
  const tag =
    !busy && k >= 0
      ? `${end ? `${LABELS.recap} · ` : ""}${LABELS.scene} ${k + 1}/${scenes.length} · `
      : "";
  const text = busy
    ? {
        eyebrow: `${index}번째 요청 · 처리 중`,
        title: `요청 ${target.request!.id} · ${target.request!.cylinder}번 처리 중`,
        body: lesson.phaseText(snap.phase, snap.phaseStep, algorithm).body,
        goal: undefined,
      }
    : lesson.lessonAt(algorithm, index);
  let items: PagedItem[] = [
    {
      key: "head",
      node: (
        <div
          id="explanation"
          tabIndex={-1}
          aria-live="polite"
          aria-atomic="true"
          className="grid gap-1.5 outline-none"
        >
          <Label id="eyebrow">{fix(`${tag}${text.eyebrow}`)}</Label>
          <Title id="lesson-title">{fix(text.title)}</Title>
        </div>
      ),
    },
  ];
  if (end) {
    const recap = lesson.recapFor(algorithm);
    const recall = recapItems({
      explorer: "disk",
      points: recap.points.map(fix),
      recall: recap.recall,
      answers: picked,
      onAnswer: (question: RecallQuestion, choice: RecallChoice, i: number) => {
        progress.markRecall(question.id, Boolean(choice.correct));
        setAnswers({ key: resetKey, picked: { ...picked, [question.id]: i }, last: question.id });
      },
      summary,
      next: nextLesson(LESSONS, lesson.id),
      pointClass: "m-0",
    });
    // 비교 comes before the questions; the progress line and the next-lesson
    // key close the panel.
    const points = recall.filter((item) => item.key.startsWith("recap-point-"));
    items = items.concat(
      points,
      {
        key: "compare",
        node: (
          <Button
            variant="primary"
            data-action="compare"
            data-conclusion=""
            className="w-full"
            onClick={onCompare}
          >
            {LABELS.compareEnd}
          </Button>
        ),
      },
      recall.filter((item) => !item.key.startsWith("recap-point-")),
    );
  } else {
    // The body is the stage text while a request travels (empty before the first stage).
    if (text.body)
      items.push({ key: "body", text: fix(text.body), className: cn(textClass, flowClass) });
    if (text.goal)
      items.push({ key: "goal", text: fix(text.goal), className: cn(textClass, flowClass) });
    if (!shortConsole)
      items.push({
        key: "stages",
        className: flowClass,
        node: <Stages snap={snap} step={busy ? target : step} />,
      });
    items.push({
      key: "takeaway",
      node: (
        <div className="grid gap-1.5">
          <Label>{LABELS.key}</Label>
          <Note as="p" accent id="takeaway">
            {fix(lesson.takeawayAt(algorithm, committed))}
          </Note>
        </div>
      ),
    });
  }
  // An answer's note is its own block: show the page it landed on.
  const lastAnswer = answers.key === resetKey ? answers.last : null;
  useEffect(() => {
    if (lastAnswer) lessonPager.showKey(`recall-why-${lastAnswer}`);
  }, [lastAnswer, answers, lessonPager]);

  /* ----- 거리 ----- */
  const distanceItems = distanceBlocks(lesson.distanceHint(algorithm), snap, step, target);

  /* ----- 장면 ----- */
  // A scene not reached yet shows only where it is, not what happens there.
  const sceneItems: PagedItem[] = scenes.map((m) => ({
    key: `m${m.n}`,
    element: (
      <button
        type="button"
        data-seek={m.n}
        data-milestone=""
        aria-current={m.n === index ? "true" : undefined}
        className={cn(listButtonRow, "px-2.5 font-normal aria-[current=true]:font-[650]")}
        onClick={() => playback.jump(m.n)}
      >
        <Index>{String(m.n).padStart(2, "0")}</Index>
        <span className="min-w-0 flex-1">
          {fix(m.n <= committed ? m.label : `${m.n}번째 요청 · ${m.preview}`)}
        </span>
      </button>
    ),
  }));
  const sceneKey = `${algorithm}:${tab}`;
  useEffect(() => {
    if (scenes.some((m) => m.n === index)) scenePager.showKey(`m${index}`);
  }, [index, sceneKey, scenes, scenePager]);

  /* ----- 범위 ----- */
  const scopeItems: PagedItem[] = lesson.notes.map((note, i) => ({
    key: `n${i}`,
    node: (
      <div className="grid gap-1">
        <Label>모델 {String(i + 1).padStart(2, "0")}</Label>
        <Text>{fix(note)}</Text>
      </div>
    ),
  }));

  return (
    <SidePanel
      aria-labelledby="side-label"
      className="min-[1100px]:flex min-[1100px]:flex-col min-[1100px]:[contain:size]"
    >
      <Tabs value={tab} onValueChange={(value) => onTab(value as SideTab)}>
        <PlateHead className="pe-3.5">
          <Label id="side-label">
            <Index>B</Index> 학습
          </Label>
          <TabsList aria-label="학습 패널">
            <TabsTab value="lesson" data-tab="lesson">
              {LABELS.explainTab}
            </TabsTab>
            <TabsTab value="distance" data-tab="distance">
              거리
            </TabsTab>
            <TabsTab value="scenes" data-tab="scenes">
              {LABELS.scenesTab}
            </TabsTab>
            <TabsTab value="scope" data-tab="scope">
              {LABELS.scopeTab}
            </TabsTab>
          </TabsList>
        </PlateHead>

        <TabsPanel value="lesson" className={bodyClass}>
          <PagedList
            id="lesson-pages"
            pager={lessonPager}
            resetKey={resetKey}
            items={items}
            className={pagesClass}
          />
          <Pager pager={lessonPager} label="쪽" />
          {!end && (
            <div className="pt-3 empty:hidden">
              {!busy && committed < N && (
                <Button
                  variant="filled"
                  data-action="predict"
                  className="w-full"
                  onClick={onPredict}
                >
                  {LABELS.predict("다음 선택")}
                </Button>
              )}
            </div>
          )}
        </TabsPanel>

        <TabsPanel value="distance" className={bodyClass}>
          <PagedList
            id="remaining"
            pager={distancePager}
            resetKey={`${algorithm}:${index}:${committed}:${busy}`}
            items={distanceItems}
            className={pagesClass}
          />
          <Pager pager={distancePager} label="쪽" />
        </TabsPanel>

        <TabsPanel value="scenes" className={bodyClass}>
          <PagedList
            as="nav"
            id="milestones"
            aria-label={LABELS.jumpToScene}
            pager={scenePager}
            resetKey={sceneKey}
            items={sceneItems}
            className={cn(
              "grid content-start",
              "[&>*]:flex [&>*]:min-h-9 [&>*]:items-center [&>*]:gap-2.5 [&>*]:border-b [&>*]:border-separator-soft [&>*]:py-[7px] [&>*]:keep-all [&>*:last-child]:border-b-0",
            )}
          />
          <Pager pager={scenePager} label="쪽" />
        </TabsPanel>

        <TabsPanel value="scope" className={bodyClass}>
          <PagedList
            id="scope-pages"
            pager={scopePager}
            resetKey={lesson.id}
            items={scopeItems}
            className={pagesClass}
          />
          <Pager pager={scopePager} label="쪽" />
        </TabsPanel>
      </Tabs>
    </SidePanel>
  );
}

/** 한 요청의 네 단계: OS 선택 → 컨트롤러 → 헤드 이동 → 도착·합산. */
function Stages({ snap, step }: { snap: PlaybackSnapshot; step: Step }) {
  const { busy, index, phase } = snap;
  const at = STAGES.findIndex((s) => s.kind === phase);
  const reached = (i: number) => (busy ? i <= at : index > 0);
  const r = step.request;
  const detail: Record<string, string> = {
    select: r ? `요청 ${r.id} · ${r.cylinder}` : "",
    controller: "",
    seek: r ? `${step.before.head} → ${step.state.head}` : "",
    arrive: r ? `${step.before.total} + ${step.distance} = ${step.state.total}` : "",
  };
  return (
    <div className="grid gap-1.5">
      <Label>한 요청의 네 단계</Label>
      <List as="ol" id="stages" className="[&>li]:min-h-9 [&>li]:px-2 [&>li]:py-1.5">
        {STAGES.map((s, i) => (
          <li
            key={s.kind}
            aria-current={busy && i === at ? "step" : undefined}
            className={cn(
              "aria-[current=step]:rounded-small aria-[current=step]:border-b-transparent aria-[current=step]:bg-lg-selected aria-[current=step]:font-semibold",
              "[&:has(+[aria-current=step])]:border-b-transparent",
            )}
          >
            <Led on={reached(i)} />
            <Index>{i + 1}</Index>
            {s.label}
            <span className="ms-auto text-caption whitespace-nowrap text-label-2 tabular-nums">
              {reached(i) ? fix(detail[s.kind]) : ""}
            </span>
          </li>
        ))}
      </List>
    </div>
  );
}

/** 거리: the distances behind the choice just made; the next choice's are left to work out. */
function distanceBlocks(
  hint: string,
  snap: PlaybackSnapshot,
  step: Step,
  target: Step,
): PagedItem[] {
  const { busy, committed } = snap;
  const state = step.state;
  const cells = (list: DiskRequest[], dist: (r: DiskRequest) => string) => (
    <div
      className={cn(
        "mt-3 grid grid-cols-4 gap-x-2 gap-y-2.5",
        list.length >= 5 && list.length <= 6 && "grid-cols-3",
      )}
    >
      {list.map((r) => {
        const chosen = r.id === step.request?.id;
        return (
          <span key={r.id} className="grid gap-px tabular-nums">
            <b className={cn("text-headline leading-5 font-bold", chosen && "text-[var(--head)]")}>
              {r.cylinder}
            </b>
            <span className="text-caption text-label-2">
              {chosen ? `${step.distance}칸` : dist(r)}
            </span>
          </span>
        );
      })}
    </div>
  );
  const last: PagedItem[] = committed
    ? [
        {
          key: "last",
          node: (
            <div>
              <Label>직전 선택 · 헤드 {step.before.head}에서 잰 거리</Label>
              {cells(
                step.candidates.toSorted((a, b) => a.id - b.id),
                (r) => `${(r as Candidate).distance}칸`,
              )}
            </div>
          ),
        },
      ]
    : [];
  if (busy)
    return [
      {
        key: "busy",
        node: (
          <div className="grid gap-2.5">
            <Label>남은 요청까지의 거리</Label>
            <p className={mutedClass}>
              {josa(`요청 ${target.request!.id}번`, "을/를")} 처리하는 중입니다. 헤드가 도착하면
              남은 요청까지 거리를 다시 잽니다.
            </p>
          </div>
        ),
      },
    ];
  if (state.pending.length)
    return [
      {
        key: "next",
        node: (
          <div>
            <Label>다음 후보 · 헤드 {state.head}</Label>
            {cells(state.pending, () => "?칸")}
            <p className="mt-2.5 text-caption leading-[1.6] text-label-2 keep-all">{fix(hint)}</p>
          </div>
        ),
      },
      ...last,
    ];
  return [
    ...last,
    {
      key: "none",
      text: "남은 요청이 없습니다. 요청 기록과 결과 비교에서 전체 이동을 확인하세요.",
      className: mutedClass,
    },
  ];
}
