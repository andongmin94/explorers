// The lesson column: 해설 · 장면 · 변화 · 범위. On the desktop console nothing
// in it scrolls: each tab is a fit column whose blocks page (PagedList +
// Pager). Outside the console (stacked, or shorter than 700px) the page
// scrolls as before: every panel is shown, one under the other, without tabs.
import { useEffect, useState } from "react";

import { PagedList, Pager, usePager, type PagedItem } from "@/components/learning/pager.tsx";
import { recapItems } from "@/components/learning/recap.tsx";
import { SidePanel } from "@/components/shell/console.tsx";
import { PlateHead } from "@/components/shell/plate.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Led, listButtonRow, Note } from "@/components/ui/content.tsx";
import { Table } from "@/components/ui/table.tsx";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs.tsx";
import { Index, Label, Muted, Text, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import {
  LABELS,
  type Progress,
  type ProgressSummary,
  type RecallChoice,
  type RecallQuestion,
} from "@/lib/lesson-kit.ts";
import { nextLesson } from "@/lib/lesson-rail.ts";
import { useMediaQuery } from "@/lib/use-media-query.ts";
import { RESOLUTIONS } from "./engine.ts";
import { indexLabel, keepFlags, pad, titleOf } from "./format.ts";
import { LESSONS } from "./lessons.ts";
import type { Lesson } from "./lesson-model.ts";
import type { Playback, PlaybackSnapshot } from "./playback.ts";
import { RowTh } from "./records.tsx";

export type SideTab = "now" | "scenes" | "change" | "scope";

export const CONSOLE_QUERY = "(min-width: 1100px) and (min-height: 700px)";

/** A fit column body: fills the panel, its paged list takes the rest. */
const bodyClass = cn(
  "fit-column px-5 pt-2.5 pb-4 phone:px-3",
  "min-[1100px]:min-h-0 min-[1100px]:flex-1",
  "console-short:pt-2.5 console-short:pb-3",
);
/** Outside the console a panel is a plain block; the next one follows without a gap. */
const stackedBody = "px-5 pt-2.5 pb-4 phone:px-3 [&+&]:pt-0";

/** What the 해설 shows for the step on screen (the vanilla render()). */
export function stepView(lesson: Lesson, snap: PlaybackSnapshot) {
  const { run, index, busy, completed, choice } = snap;
  const last = run.steps.length - 1;
  const step = run.steps[index];
  const pendingAt = (i: number) => lesson.hasPrediction(i, choice) && !snap.settled.has(i);
  const pending = pendingAt(index);
  const text = lesson.describeStep(step, { pending, variant: choice });
  const ended = index === last && !busy && completed === last;
  const prediction = pending ? lesson.predictionAt(index, choice) : null;
  return { last, step, pending, pendingAt, text, ended, prediction };
}

export function GitSide({
  lesson,
  playback,
  snap,
  tab,
  onTab,
  progress,
  summary,
  onPredict,
}: {
  lesson: Lesson;
  playback: Playback;
  snap: PlaybackSnapshot;
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  progress: Progress;
  summary: ProgressSummary;
  onPredict: () => void;
}) {
  const consoleMode = useMediaQuery(CONSOLE_QUERY);
  const nowPager = usePager();
  const changePager = usePager();
  const scenePager = usePager();
  const scopePager = usePager();
  const { run, index, busy, choice } = snap;
  const { last, step, text, ended, prediction, pendingAt } = stepView(lesson, snap);
  const gate = playback.gate;

  /* ----- the gate: show the resolution choices (tab, page, focus) ----- */
  useEffect(() => {
    playback.setOnShow((key) => {
      onTab("now");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const block = document.getElementById(key);
          if (!block) return;
          nowPager.showKey(key);
          if (key === "terminal") return;
          if (!window.matchMedia(CONSOLE_QUERY).matches)
            block.scrollIntoView({ behavior: "instant", block: "center" });
          block.querySelector("button")?.focus({ preventScroll: true });
        }),
      );
    });
    return () => playback.setOnShow(null);
  }, [playback, onTab, nowPager]);

  /* ----- 정리: recall answers for this page's lifetime ----- */
  const [answers, setAnswers] = useState<{ picked: Record<string, number>; last: string | null }>({
    picked: {},
    last: null,
  });
  useEffect(() => {
    if (answers.last) nowPager.showKey(`recall-why-${answers.last}`);
  }, [answers, nowPager]);

  /* ----- 해설 ----- */
  const variant = lesson.variants.find((v) => v.id === choice);
  const showVariant = lesson.gate
    ? index >= gate + 1 && !ended && choice
    : choice !== lesson.defaultVariant && index > lesson.fork && !ended;
  // Terminal output: one page item per paragraph (split at blank lines), so a
  // long git status continues on the next page instead of being cut.
  const chunks = (text.terminal ?? []).join("\n").split(/\n\n+/).filter(Boolean);
  const items: PagedItem[] = [
    {
      key: "intro",
      node: (
        <div className="git-intro">
          <Label id="eyebrow">{ended ? `${LABELS.recap} · ${text.eyebrow}` : text.eyebrow}</Label>
          <Title id="lesson-title" className="mt-1.5 keep-all">
            {keepFlags(text.title)}
          </Title>
          {!ended && (
            <Text id="lesson-body" className="mt-2">
              {keepFlags(text.body)}
            </Text>
          )}
          {index !== 0 && !ended && (
            <p id="command-line" className="m-0 mt-2.5 grid justify-items-start gap-1">
              <Label id="command-label">{step.command ? "실행 명령" : "작업 트리 편집"}</Label>
              {step.command ? (
                <code
                  id="command"
                  className="justify-self-stretch rounded-small bg-fill-3 px-3 py-1.5 font-mono text-control text-label [overflow-wrap:anywhere] keep-all before:text-label-3 before:content-['$_']"
                >
                  {step.command}
                </code>
              ) : (
                <code
                  id="command"
                  className="font-sans text-control text-label [overflow-wrap:anywhere] keep-all"
                >
                  {lesson.editNote(step)}
                </code>
              )}
            </p>
          )}
        </div>
      ),
    },
  ];
  if (text.goal)
    items.push({
      key: "goal",
      text: keepFlags(text.goal),
      className: "m-0 text-body text-label keep-all text-pretty",
    });
  if (!busy && index === gate)
    items.push({
      key: "resolution",
      node: (
        <div id="resolution">
          <Label>
            <Index>!</Index> 직접 해결 · 파일에 남길 제목은?
          </Label>
          <div className="mt-1 grid">
            {RESOLUTIONS.map((r, i) => (
              <button
                key={r.id}
                type="button"
                data-resolution={r.id}
                className={cn(
                  listButtonRow,
                  "flex min-h-9 items-start gap-2.5 border-b border-separator-soft px-0.5 py-[5px] last:border-b-0",
                )}
                onClick={() => void playback.playVariant(r.id)}
              >
                <Index className="leading-[1.35]">{pad(i + 1)}</Index>
                <span className="grid gap-0.5 text-left leading-[1.35]">
                  <span>{r.label}</span>
                  <Muted>{titleOf(r.content)}</Muted>
                </span>
              </button>
            ))}
          </div>
        </div>
      ),
    });
  if (showVariant)
    items.push({
      key: "chosen",
      node: (
        <div id="chosen">
          <Label id="chosen-head">{lesson.gate ? "선택한 해결안" : "보고 있는 방식"}</Label>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <strong id="chosen-label">{variant?.label}</strong>
            <Button
              variant="filled"
              size="sm"
              data-action="choose-again"
              onClick={() => playback.chooseAgain()}
            >
              {lesson.gate ? "다른 해결안으로" : LABELS.backToFork}
            </Button>
          </div>
        </div>
      ),
    });
  if (text.terminal) {
    const more = chunks.length > 1;
    items.push({
      key: "terminal",
      node: (
        <div id="terminal">
          <Label>터미널 출력</Label>
          <pre
            id="terminal-text"
            className={cn(
              "m-0 mt-1.5 rounded-small bg-fill-3 px-3 py-2 font-mono text-caption leading-[1.45] whitespace-pre-wrap text-label [overflow-wrap:anywhere]",
              more && "rounded-b-none pb-0",
            )}
          >
            {chunks[0] ?? ""}
          </pre>
        </div>
      ),
    });
    chunks.slice(1).forEach((chunk, i, rest) =>
      items.push({
        key: `terminal-${i + 1}`,
        className:
          "-mt-3.5 border-t-0! pt-0! [[hidden]+&]:mt-0 [[hidden]+&>pre]:rounded-t-small [[hidden]+&>pre]:pt-2",
        node: (
          <pre
            className={cn(
              "m-0 rounded-small rounded-t-none bg-fill-3 px-3 pt-[1.45em] pb-2 font-mono text-caption leading-[1.45] whitespace-pre-wrap text-label [overflow-wrap:anywhere]",
              i < rest.length - 1 && "rounded-b-none pb-0",
            )}
          >
            {chunk}
          </pre>
        ),
      }),
    );
  }
  if (text.takeaway && !ended)
    items.push({
      key: "takeaway",
      note: true,
      node: (
        <Note as="p" accent id="takeaway">
          <span>
            <Label className="me-2 inline text-accent-text">{LABELS.key}</Label>
            <span id="takeaway-text">{keepFlags(text.takeaway)}</span>
          </span>
        </Note>
      ),
    });
  if (!busy && prediction)
    items.push({
      key: "predict",
      node: (
        <div id="predict-section">
          <Button
            variant="filled"
            data-action="predict"
            className="w-full whitespace-normal"
            onClick={onPredict}
          >
            <span id="predict-label">{LABELS.predict(prediction.target)}</span>
          </Button>
        </div>
      ),
    });
  if (ended)
    items.push(
      ...recapItems({
        explorer: "git",
        points: lesson.recap.points,
        recall: lesson.recap.recall,
        answers: answers.picked,
        onAnswer: (question: RecallQuestion, picked: RecallChoice, i: number) => {
          progress.markRecall(question.id, Boolean(picked.correct));
          setAnswers((prev) => ({
            picked: { ...prev.picked, [question.id]: i },
            last: question.id,
          }));
        },
        summary,
        next: nextLesson(LESSONS, lesson.id),
        pointClass: "m-0",
      }),
    );

  /* ----- 변화 ----- */
  const before = run.steps[index].before;
  const state = snap.shown;
  const hide = pendingAt(index) && state.status === "resolved";
  const facts: [string, string | number, string | number][] = [
    ["현재 커밋", before.refs[before.currentBranch] ?? "", state.refs[state.currentBranch] ?? ""],
    ["인덱스", indexLabel(before, hide), indexLabel(state, hide)],
    ["커밋 수", before.commits.length, state.commits.length],
  ];
  const changeItems: PagedItem[] = [
    {
      key: "facts",
      node: (
        <div>
          <Label>{LABELS.now} 사건 · 직전 → 현재</Label>
          <Table className="mt-2">
            <tbody id="facts">
              {facts.map(([label, a, b]) => (
                <tr key={label} className="even:[&>*]:bg-fill-4">
                  <RowTh>{label}</RowTh>
                  <td className="px-2.5 py-[5px] align-top text-label-2 [overflow-wrap:anywhere]">
                    {a}
                  </td>
                  <td
                    className={cn(
                      "px-2.5 py-[5px] align-top [overflow-wrap:anywhere]",
                      a !== b && "font-semibold text-accent-text",
                    )}
                  >
                    {b}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ),
    },
    ...(text.details ?? []).map((d, i) => ({
      key: `detail-${i}`,
      node: (
        <p className="git-detail m-0 flex items-baseline gap-3 text-body leading-[1.6] keep-all text-pretty">
          <Led className="-translate-y-px" />
          <span>{keepFlags(d)}</span>
        </p>
      ),
    })),
  ];

  /* ----- 장면 ----- */
  const milestones = lesson.milestones(choice);
  const reached = milestones.filter((m) => m.index <= index).at(-1)?.index;
  const sceneItems: PagedItem[] = milestones.map((m, i) => ({
    key: `m${i}`,
    element: (
      <button
        type="button"
        data-seek={m.index}
        data-milestone=""
        aria-current={reached === m.index ? "true" : undefined}
        className={cn(listButtonRow, "px-2.5")}
        onClick={() => playback.jump(m.index)}
      >
        <Index>{pad(i + 1)}</Index>
        <span className="min-w-0 flex-1">{m.label}</span>
        <span className="ms-auto font-mono text-label-2">
          {index > m.index ? "✓ " : ""}
          {pad(m.index)}
        </span>
      </button>
    ),
  }));

  /* ----- 범위 ----- */
  const scopeItems: PagedItem[] = lesson.scope.map(([term, meaning], i) => ({
    key: `s${i}`,
    element: (
      <div className="grid gap-0.5 border-b border-separator-soft py-[7px] last:border-b-0 [&:not(:has(~div:not([hidden])))]:border-b-0">
        <dt className="text-body font-[650]">{keepFlags(term)}</dt>
        <dd className="m-0">
          <Text>{keepFlags(meaning)}</Text>
        </dd>
      </div>
    ),
  }));

  const counter = index ? `${pad(index)} / ${pad(last)}${busy ? " · 처리 중" : ""}` : "시작 전";

  const panels: Record<SideTab, React.ReactNode> = {
    now: (
      <>
        <PagedList
          id="now-pages"
          aria-label="이번 사건 해설"
          pager={nowPager}
          resetKey={index}
          items={items}
          className="paged-blocks"
        />
        <Pager pager={nowPager} label="해설 쪽" />
      </>
    ),
    scenes: (
      <>
        <Label className="mb-2">{LABELS.jumpToScene}</Label>
        <PagedList
          as="nav"
          id="milestones"
          aria-label={LABELS.scene}
          pager={scenePager}
          resetKey={`${choice}`}
          items={sceneItems}
          className="grid content-start [&>*]:flex [&>*]:min-h-9 [&>*]:items-center [&>*]:gap-2.5 [&>*]:border-b [&>*]:border-separator-soft [&>*]:py-[7px] [&>*]:keep-all [&>*:last-child]:border-b-0"
        />
        <Pager pager={scenePager} label="장면 쪽" />
      </>
    ),
    change: (
      <>
        <PagedList
          id="change-pages"
          aria-label="직전과 현재 비교"
          pager={changePager}
          resetKey={index}
          items={changeItems}
          className="paged-blocks"
        />
        <Pager pager={changePager} label="변화 쪽" />
      </>
    ),
    scope: (
      <>
        <PagedList
          as="dl"
          id="glossary"
          aria-label="용어와 모델의 범위"
          pager={scopePager}
          resetKey={lesson.id}
          items={scopeItems}
          className="m-0 flex flex-col"
        />
        <Pager pager={scopePager} label="범위 쪽" />
      </>
    ),
  };
  const order: SideTab[] = ["now", "scenes", "change", "scope"];
  const tabLabels: Record<SideTab, string> = {
    now: LABELS.explainTab,
    scenes: LABELS.scenesTab,
    change: "변화",
    scope: LABELS.scopeTab,
  };
  const head = (
    <Label id="side-label">
      <Index>B</Index> <span id="lesson-counter">{counter}</span>
    </Label>
  );

  return (
    <SidePanel
      aria-labelledby="lesson-title"
      className="console:flex console:flex-col console:[contain:size]"
    >
      {consoleMode ? (
        <Tabs value={tab} onValueChange={(value) => onTab(value as SideTab)}>
          <PlateHead className="pe-3.5">
            {head}
            <TabsList aria-label="사건 해설 보기" className="flex-none">
              {order.map((t) => (
                <TabsTab key={t} value={t} data-tab={t}>
                  {tabLabels[t]}
                </TabsTab>
              ))}
            </TabsList>
          </PlateHead>
          {order.map((t) => (
            <TabsPanel
              key={t}
              value={t}
              className={cn(bodyClass, "console:pt-2.5 console:px-5 console:pb-4")}
            >
              {panels[t]}
            </TabsPanel>
          ))}
        </Tabs>
      ) : (
        <>
          <PlateHead>{head}</PlateHead>
          {order.map((t) => (
            <div key={t} data-panel={t} className={stackedBody}>
              {panels[t]}
            </div>
          ))}
        </>
      )}
    </SidePanel>
  );
}
