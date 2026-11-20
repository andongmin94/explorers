// The lesson column: 해설 · 장면 · 범위. Nothing in it scrolls: each tab is a
// fit column whose blocks page (PagedList + Pager). At the last event the
// 정리 blocks follow the 해설.
import { useEffect, useState } from "react";

import { PagedList, Pager, usePager, type PagedItem } from "@/components/learning/pager.tsx";
import { recapItems } from "@/components/learning/recap.tsx";
import { SidePanel } from "@/components/shell/console.tsx";
import { PlateHead } from "@/components/shell/plate.tsx";
import { Button } from "@/components/ui/button.tsx";
import { List, listButtonRow, Note } from "@/components/ui/content.tsx";
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
import { LESSONS } from "./lessons.ts";
import type { TxPage, TxStep } from "./page.ts";
import { pad, Sql } from "./parts.tsx";
import type { Player, PlayerSnapshot } from "./player.ts";
import type { Quiz } from "./types.ts";

export type SideTab = "lesson" | "scenes" | "scope";

/** A fit column body: fills the panel, its paged list takes the rest. */
const bodyClass = cn(
  "fit-column px-3.5 pt-2.5 pb-4 phone:px-3",
  "min-[1100px]:min-h-0 min-[1100px]:flex-1",
  "console:px-5 console:pt-3 console:pb-4",
  "console-short:pt-2.5 console-short:pb-3",
);
/** Blocks of one 해설 read as one column: no hairlines between them (as in the vanilla page). */
const flat = "border-t-0! pt-0!";
const textClass = cn(flat, "m-0 text-body text-label text-pretty keep-all");

export function TxSide({
  page,
  player,
  snap,
  tab,
  onTab,
  progress,
  summary,
  onPredict,
  onCompare,
}: {
  page: TxPage;
  player: Player;
  snap: PlayerSnapshot;
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  progress: Progress;
  summary: ProgressSummary;
  onPredict: (quiz: Quiz) => void;
  onCompare: () => void;
}) {
  const lessonPager = usePager();
  const scenePager = usePager();
  const scopePager = usePager();
  const steps = page.runs[snap.mode].steps;
  const step = steps[snap.done];
  const lessonStep = snap.busy ? steps[snap.index] : step;
  const lesson = page.describe(lessonStep, snap.mode);
  const milestones = page.milestones(snap.mode);
  const sceneAt = snap.busy ? -1 : milestones.findIndex((m) => m.index === lessonStep.index);
  const conclusion = snap.done === snap.last && !snap.busy;

  /* ----- 해설 (+ 정리 at the end) ----- */
  const resetKey = `${snap.mode}:${snap.index}`;
  const [answers, setAnswers] = useState<{
    key: string;
    picked: Record<string, number>;
    last: string | null;
  }>({ key: "", picked: {}, last: null });
  const recapKey = snap.mode;
  const picked = answers.key === recapKey ? answers.picked : {};

  const items = explanationItems({ page, snap, step, lessonStep, lesson, sceneAt, conclusion });
  if (conclusion) {
    items.push(
      ...recapItems({
        explorer: "transaction",
        points: page.recap.points,
        recall: page.recap.recall,
        answers: picked,
        onAnswer: (question: RecallQuestion, choice: RecallChoice, index: number) => {
          progress.markRecall(question.id, Boolean(choice.correct));
          setAnswers({
            key: recapKey,
            picked: { ...picked, [question.id]: index },
            last: question.id,
          });
        },
        summary,
        next: nextLesson(LESSONS, page.lessonId),
        pointClass: "m-0",
      }),
    );
  }
  // An answer's note is its own block: show the page it landed on.
  const lastAnswer = answers.key === recapKey ? answers.last : null;
  useEffect(() => {
    if (lastAnswer) lessonPager.showKey(`recall-why-${lastAnswer}`);
  }, [lastAnswer, answers, lessonPager]);

  const quiz = snap.busy ? null : page.prediction(step, snap.mode);

  /* ----- 장면 ----- */
  const active = milestones.findLastIndex((m) => m.index <= snap.index);
  const milestoneItems: PagedItem[] = milestones.map((m, i) => {
    const seen = snap.done >= m.index;
    return {
      key: `m${i}`,
      element: (
        <button
          type="button"
          data-seek={m.index}
          data-milestone=""
          aria-current={i === active ? "true" : undefined}
          title={
            page.hideUnseenMilestones
              ? undefined
              : seen
                ? m.description
                : `${m.index}번째 사건에서 확인`
          }
          className={cn(
            listButtonRow,
            "gap-3 px-2.5 text-control font-normal text-label aria-[current=true]:font-semibold",
          )}
          onClick={() => void player.jump(m.index)}
        >
          <Index>{pad(i + 1)}</Index>
          <span className="min-w-0 flex-1 keep-all">
            {page.hideUnseenMilestones && !seen ? (
              <Muted>{m.index}번째 사건에서 확인</Muted>
            ) : (
              <>
                {m.label}
                {seen && <Muted className="font-normal"> · {m.description}</Muted>}
              </>
            )}
          </span>
          <Muted className="tabular-nums">#{pad(m.index)}</Muted>
        </button>
      ),
    };
  });
  const milestoneKey = `${snap.mode}:${tab}`;
  useEffect(() => {
    if (active >= 0) scenePager.showKey(`m${active}`);
  }, [active, milestoneKey, scenePager]);

  /* ----- 범위 ----- */
  const fact = (key: string, label: React.ReactNode, body: React.ReactNode): PagedItem => ({
    key,
    node: (
      <div>
        <Label>{label}</Label>
        {body}
      </div>
    ),
  });
  const scopeItems: PagedItem[] = [
    fact(
      "rule",
      <>
        {page.scope.ruleLabel} · <span id="rule-mode">{page.modeLabels[snap.mode]}</span>
      </>,
      <Text id="rule-summary" className="mt-1">
        {page.scope.rules[snap.mode]}
      </Text>,
    ),
    fact("condition", "실험 조건", <Text className="mt-1">{page.scope.condition}</Text>),
    ...page.scope.notes.map((note, i) =>
      fact(`note-${i}`, `모델 ${pad(i + 1)}`, <Text className="mt-1">{note}</Text>),
    ),
    fact(
      "legend",
      "장면 표시",
      <ul className="m-0 mt-2.5 grid list-disc gap-1.5 ps-[18px] text-control leading-[1.65] keep-all text-pretty marker:text-label-3">
        {page.scope.legend.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>,
    ),
  ];

  return (
    <SidePanel
      aria-labelledby="lesson-label"
      className="min-[1100px]:flex min-[1100px]:flex-col min-[1100px]:[contain:size]"
    >
      <Tabs value={tab} onValueChange={(value) => onTab(value as SideTab)}>
        <PlateHead className="pe-3.5">
          <Label id="lesson-label">
            <Index>B</Index> 학습
            <VisuallyHidden> 패널</VisuallyHidden>
          </Label>
          <TabsList aria-label="학습 패널">
            <TabsTab value="lesson" data-tab="lesson">
              {LABELS.explainTab}
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
            className="paged-blocks"
          />
          {(quiz || conclusion) && (
            <div className="grid gap-2.5 pt-3">
              {quiz && (
                <Button
                  variant="filled"
                  data-action="predict"
                  className="w-full"
                  onClick={() => onPredict(quiz)}
                >
                  {LABELS.predict(page.predictionTarget(quiz))}
                </Button>
              )}
              {conclusion && (
                <Button
                  variant="primary"
                  data-action="compare"
                  data-role="conclusion"
                  className="w-full"
                  onClick={onCompare}
                >
                  {LABELS.compareEnd}
                </Button>
              )}
            </div>
          )}
          <Pager pager={lessonPager} label="쪽" />
        </TabsPanel>

        <TabsPanel value="scenes" className={bodyClass}>
          <Label className="mb-1.5">
            {LABELS.jumpToScene}{" "}
            <Muted>
              · {Math.max(0, active) + 1} / {milestones.length}
            </Muted>
          </Label>
          <PagedList
            as="nav"
            id="milestones"
            aria-label={LABELS.jumpToScene}
            pager={scenePager}
            resetKey={milestoneKey}
            items={milestoneItems}
            className={cn(
              "grid content-start",
              "[&>*]:flex [&>*]:min-h-9 [&>*]:items-center [&>*]:border-b [&>*]:border-separator-soft [&>*]:py-[7px] [&>*:last-child]:border-b-0",
            )}
          />
          <Pager pager={scenePager} label="쪽" />
        </TabsPanel>

        <TabsPanel value="scope" className={bodyClass}>
          <PagedList
            id="scope-pages"
            pager={scopePager}
            resetKey={`${page.lessonId}:${snap.mode}`}
            items={scopeItems}
            className="paged-blocks"
          />
          <Pager pager={scopePager} label="쪽" />
        </TabsPanel>
      </Tabs>
    </SidePanel>
  );
}

/** The 해설 blocks for the event on screen (or in flight). */
function explanationItems({
  page,
  snap,
  step,
  lessonStep,
  lesson,
  sceneAt,
  conclusion,
}: {
  page: TxPage;
  snap: PlayerSnapshot;
  step: TxStep;
  lessonStep: TxStep;
  lesson: ReturnType<TxPage["describe"]>;
  sceneAt: number;
  conclusion: boolean;
}): PagedItem[] {
  const milestones = page.milestones(snap.mode);
  const eyebrow = snap.busy
    ? `${snap.index}번째 사건 · 처리 중`
    : sceneAt >= 0
      ? `${LABELS.scene} ${sceneAt + 1}/${milestones.length} · ${lesson.eyebrow}`
      : lesson.eyebrow;
  const title = snap.busy ? `${page.busyTitle(lessonStep)} 처리 중` : lesson.title;
  const summary = snap.busy ? snap.phaseBody || page.busyHint : lesson.summary;
  const items: PagedItem[] = [
    {
      key: "head",
      node: (
        <div id="explanation" tabIndex={-1} className="grid gap-1.5 outline-none">
          <Label id="eyebrow">{eyebrow}</Label>
          <Title id="lesson-title" className="mt-1">
            {title}
          </Title>
        </div>
      ),
    },
    { key: "summary", text: summary, className: textClass },
  ];
  if (!snap.busy && lesson.goal)
    items.push({ key: "goal", text: lesson.goal, className: textClass });
  const sql = lessonStep.sql;
  if (lessonStep.index !== 0 && !conclusion && (sql || !page.hideEmptySql))
    items.push({
      key: "event",
      className: flat,
      node: (
        <div id="event-section">
          <Label>{LABELS.now} 사건</Label>
          {sql && <Sql id="current-sql" sql={sql} />}
        </div>
      ),
    });
  if (lessonStep.index !== 0 && !snap.busy && lesson.details.length)
    items.push({
      key: "details",
      className: flat,
      node: (
        <ul
          id="lesson-details"
          className="m-0 grid list-disc gap-1.5 ps-[18px] text-control leading-[1.65] keep-all text-pretty marker:text-label-3"
        >
          {lesson.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ),
    });
  if (lessonStep.index !== 0 && !conclusion) {
    const state = snap.busy ? (snap.phaseState ?? lessonStep.before) : step.state;
    items.push({
      key: "changes",
      className: flat,
      node: <Changes page={page} before={lessonStep.before} state={state} />,
    });
  }
  if (!snap.busy && !conclusion)
    items.push({
      key: "key",
      note: true,
      node: (
        <Note as="p" accent id="key-section">
          <span>
            <b className="font-bold">{LABELS.key}</b> <span id="lesson-key">{lesson.key}</span>
          </span>
        </Note>
      ),
    });
  return items;
}

/** DB 상태 · 직전 → 현재: only the values this event changed. */
function Changes({ page, before, state }: { page: TxPage; before: unknown; state: unknown }) {
  const was = page.changes(before);
  const changed = page
    .changes(state)
    .map(([label, now], i): [string, string, string] => [label, was[i][1], now])
    .filter(([, a, b]) => a !== b);
  return (
    <div id="changes">
      <Label>DB 상태 · 직전 → 현재</Label>
      {changed.length ? (
        <List as="ul" className="mt-1">
          {changed.map(([label, a, b]) => (
            <li key={label} className="min-h-[34px] items-baseline! justify-between gap-4 py-1.5!">
              <span className="flex-none whitespace-nowrap">{label}</span>
              <span className="text-right tabular-nums">
                <Muted>{a}</Muted> → <b>{b}</b>
              </span>
            </li>
          ))}
        </List>
      ) : (
        <Text className="mt-2.5 text-label-2">{page.noChange}</Text>
      )}
    </div>
  );
}
