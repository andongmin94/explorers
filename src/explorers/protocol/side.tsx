// The side plate: the lesson in the shared learning model. Before playback
// the start screen asks the scenario question (목표); while playing it
// explains the current step and the packet on the wire (설명); at the end it
// is 정리. What each view shows is decided in lesson-view.ts (also what a
// pending prediction hides). The 장면 tab jumps to any step and marks the
// 핵심 장면. On the console nothing scrolls (tabs + pages); stacked, both
// panels show one under the other.
import { ChevronLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { PagedList, Pager, usePager, type PagedItem } from "@/components/learning/pager.tsx";
import { RecallQuestionBlock, RecallWhy } from "@/components/learning/recap.tsx";
import { SidePanel } from "@/components/shell/console.tsx";
import { PlateFoot, PlateHead } from "@/components/shell/plate.tsx";
import { Button, ButtonLink } from "@/components/ui/button.tsx";
import { listButtonRow, Meter, Tag } from "@/components/ui/content.tsx";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs.tsx";
import { Index, Label, Text, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS, nextExperiment } from "@/lib/lesson-kit.ts";
import { useMediaQuery, STACKED } from "@/lib/use-media-query.ts";
import type { ProtocolController, Snapshot } from "./controller.ts";
import { translate } from "./i18n.ts";
import { buildOverviewState, stepListTitle, type OverviewState } from "./lesson-view.ts";
import { protocolCatalog } from "./lessons/index.ts";
import { learning } from "./lessons/learning.ts";
import {
  getLearningSummary,
  markRecall,
  sharedProgress,
  type LearningSummary,
} from "./progress.ts";
import { getKeySteps } from "./quiz.ts";
import { NETWORK_SHORT_LABELS, PACKET_COLORS } from "./simulation/network-drawing.ts";
import type { Lesson } from "./types.ts";

export type SideTab = "lesson" | "steps";

const bodyClass = cn(
  "fit-column px-3.5 pt-2.5 pb-4 phone:px-3",
  "min-[1100px]:min-h-0 min-[1100px]:flex-1",
  "console-short:pt-2.5 console-short:pb-3",
);

const nodeName = (lesson: Lesson, nodeId: string) =>
  translate(lesson.labels?.[nodeId]?.[0] ?? NETWORK_SHORT_LABELS[nodeId]);

function Facts({ facts }: { facts: [string, string][] }) {
  return (
    <dl className="m-0 grid">
      {facts.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-b border-separator-soft py-2 first:pt-0 last:border-b-0 phone:grid-cols-[84px_minmax(0,1fr)]"
        >
          <Label as="dt" className="items-start pt-0.5">
            {translate(label)}
          </Label>
          <dd className="m-0 text-control keep-all">{translate(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "학습 진도 · 핵심 장면 2/2 · 예측 1/1 · 확인 문제 0/1" (no comparison in this explorer). */
function ProgressLine({ summary }: { summary: LearningSummary }) {
  const parts = [`${LABELS.scene} ${summary.scenesSeen}/${summary.scenesTotal}`];
  if (summary.predictionsAnswered)
    parts.push(`예측 ${summary.predictionsRight}/${summary.predictionsAnswered}`);
  if (summary.recallTotal)
    parts.push(`${LABELS.recall} ${summary.recallRight}/${summary.recallTotal}`);
  const total = summary.scenesTotal + summary.recallTotal;
  const got = summary.scenesSeen + summary.recallRight;
  return (
    <div data-slot="progress" className="flex min-w-0 flex-wrap items-center gap-2.5">
      <Meter total={total} got={got} />
      <Label className="block whitespace-normal">
        {LABELS.progress} · {parts.join(" · ")}
      </Label>
    </div>
  );
}

function packetMeta(packet: NonNullable<OverviewState["packet"]>) {
  const { event, number: first, count, total } = packet;
  if (event.type === "stream") {
    const lostCount = event.packets!.filter((p) => p.lost).length;
    const lengths = event.packets!.map((p) => p.row!.len);
    const size = lengths.every((length) => length === lengths[0])
      ? `${count} × ${lengths[0]}`
      : lengths.every((length) => length.endsWith(" B"))
        ? `${lengths.map((length) => length.slice(0, -2)).join(" + ")} B`
        : lengths.join(" + ");
    const suffix = lostCount
      ? ` · ${translate(lostCount === 1 ? "1 LOST" : "{n} LOST", { n: lostCount })}`
      : event.locked
        ? ` · ${translate("ENCRYPTED")}`
        : "";
    return `${translate("PACKETS {from}–{to} OF {total}", { from: first, to: first + count - 1, total })} · ${size}${suffix}`;
  }
  const suffix = packet.lost
    ? ` · ${translate("LOST ON THE WAY")}`
    : event.locked
      ? ` · ${translate("ENCRYPTED")}`
      : "";
  return `${translate("PACKET {n} OF {total}", { n: first, total })} · ${event.row!.proto} · ${event.row!.len}${suffix}`;
}

const textClass = "m-0 text-body text-label text-pretty keep-all";

function lessonItems(
  state: OverviewState,
  summary: LearningSummary,
  answers: Record<string, number>,
  onAnswer: (id: string, index: number, correct: boolean) => void,
): PagedItem[] {
  const { lesson } = state;
  if (state.view === "overview") {
    const o = state.overview;
    const items: PagedItem[] = [
      {
        key: "o-head",
        node: (
          <div id="explanation" tabIndex={-1} className="outline-none">
            <Label>{o.layer}</Label>
            <Title className="mt-1.5">{o.question}</Title>
            {o.setup && <Text className="mt-2">{o.setup}</Text>}
          </div>
        ),
      },
    ];
    if (o.goal) items.push({ key: "o-goal", text: o.goal, className: textClass });
    items.push({
      key: "o-ref",
      node: (
        <div>
          <Label>{o.reference}</Label>
          <Text className="mt-1 text-label-2">{o.description}</Text>
        </div>
      ),
    });
    if (o.facts.length) items.push({ key: "o-facts", node: <Facts facts={o.facts} /> });
    return items;
  }
  if (state.view === "step") {
    const c = state.content!;
    const items: PagedItem[] = [
      {
        key: "s-head",
        node: (
          <div id="explanation" tabIndex={-1} aria-live="polite" className="outline-none">
            <Label>{c.label}</Label>
            <Title className={cn("mt-1.5", c.hold && "text-label-2")}>
              {c.hold ? c.title : translate(c.title)}
            </Title>
            {c.desc && <Text className="mt-1 text-label-2">{translate(c.desc)}</Text>}
          </div>
        ),
      },
    ];
    if (c.text) items.push({ key: "s-text", text: translate(c.text), className: textClass });
    const packet = state.packet;
    if (packet) {
      const { event } = packet;
      items.push({
        key: `s-packet-${packet.number}`,
        node: (
          <div data-packet-info="">
            <Label>{packetMeta(packet)}</Label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="inline-block size-2 flex-none rounded-full"
                style={{ background: PACKET_COLORS[event.color!] }}
              />
              <b className="text-headline">
                {event.locked ? "🔒 " : ""}
                {translate(event.label!)}
              </b>
              <span className="text-caption text-label-2">
                {nodeName(lesson, event.from!)} → {nodeName(lesson, event.to!)}
              </span>
            </div>
            {event.payload && event.payload.length > 0 && (
              <pre className="m-0 mt-2.5 rounded-note bg-fill-3 px-3 py-2.5 font-mono text-caption leading-[1.6] font-medium break-all whitespace-pre-wrap text-label">
                {event.payload.map((line) => translate(line)).join("\n")}
              </pre>
            )}
          </div>
        ),
      });
    }
    if (c.facts.length) items.push({ key: "s-facts", node: <Facts facts={c.facts} /> });
    return items;
  }
  const r = state.recap!;
  const items: PagedItem[] = [
    {
      key: "r-head",
      node: (
        <div id="explanation" tabIndex={-1} className="outline-none">
          <Label>{r.label}</Label>
          <Title className="mt-1.5">{translate(r.title)}</Title>
          <Text className="mt-1 text-label-2">{translate(r.desc)}</Text>
        </div>
      ),
    },
    { key: "r-progress", node: <ProgressLine summary={summary} /> },
    {
      key: "r-points",
      node: (
        <div>
          <Label>{LABELS.recapPoints}</Label>
          <ul className="m-0 grid list-none p-0">
            {r.points.map((point) => (
              <li
                key={point}
                className="border-b border-separator-soft py-1.5 text-body keep-all last:border-b-0"
              >
                {point}
              </li>
            ))}
          </ul>
        </div>
      ),
    },
  ];
  for (const question of r.recall) {
    const picked = answers[question.id];
    items.push({
      key: `recall-${question.id}`,
      node: (
        <RecallQuestionBlock
          question={question}
          picked={picked}
          onPick={(choice, index) => onAnswer(question.id, index, Boolean(choice.correct))}
        />
      ),
    });
    if (picked !== undefined) {
      items.push({
        key: `recall-why-${question.id}`,
        note: true,
        node: <RecallWhy question={question} choice={question.choices[picked]} />,
      });
    }
  }
  return items;
}

export function ProtocolSide({
  controller,
  snap,
  tab,
  onTab,
  progressVersion,
}: {
  controller: ProtocolController;
  snap: Snapshot;
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  progressVersion: number;
}) {
  const { lesson, playback, pending } = snap;
  const stacked = useMediaQuery(STACKED);
  const lessonPager = usePager();
  const stepsPager = usePager();
  const state = playback ? buildOverviewState(playback, lesson, snap.order, { pending }) : null;
  const keySteps = getKeySteps(lesson);
  const info = learning[lesson.id];
  // progressVersion: the summary is read from the progress store on every change.
  void progressVersion;
  const summary = getLearningSummary(lesson, {
    scenes: keySteps.length,
    recall: info?.recall ?? [],
  });

  // 확인 문제 answers belong to this lesson's 정리 (a new lesson starts fresh).
  const [answers, setAnswers] = useState<{
    lesson: string;
    picked: Record<string, number>;
    last: string | null;
  }>({
    lesson: lesson.id,
    picked: {},
    last: null,
  });
  const picked = answers.lesson === lesson.id ? answers.picked : {};
  const onAnswer = (id: string, index: number, correct: boolean) => {
    if (picked[id] === undefined) {
      markRecall(lesson, id, correct);
      sharedProgress.markRecall(`${lesson.id}:${id}`, correct);
    }
    setAnswers({ lesson: lesson.id, picked: { ...picked, [id]: index }, last: id });
  };
  const lastAnswer = answers.lesson === lesson.id ? answers.last : null;
  useEffect(() => {
    if (lastAnswer) lessonPager.showKey(`recall-why-${lastAnswer}`);
  }, [lastAnswer, answers, lessonPager]);

  const resetKey = state ? `${lesson.id}:${state.view}:${state.rank}:${state.held}` : lesson.id;
  // New content slides in from the side it comes from (the vanilla slideContent).
  const [motion, setMotion] = useState({
    key: resetKey,
    rank: state?.rank ?? -1,
    order: snap.order,
    dir: 1,
  });
  if (motion.key !== resetKey) {
    const dir =
      snap.order !== motion.order
        ? snap.order > motion.order
          ? 1
          : -1
        : (state?.rank ?? -1) >= motion.rank
          ? 1
          : -1;
    setMotion({ key: resetKey, rank: state?.rank ?? -1, order: snap.order, dir });
  }

  const items = state ? lessonItems(state, summary, picked, onAnswer) : [];
  const title = state?.title ?? "대표 시나리오";

  /* ----- 장면 ----- */
  const activeStep = playback?.steps.findIndex((s) => s === "active") ?? -1;
  const stepItems: PagedItem[] = lesson.steps.map((_step, index) => {
    const status = playback?.steps[index] ?? "todo";
    const isKey = keySteps.includes(index);
    return {
      key: `step-${index}`,
      element: (
        <button
          type="button"
          data-step={index}
          data-key={isKey || undefined}
          data-status={status}
          aria-current={status === "active" ? "true" : undefined}
          className={cn(
            listButtonRow,
            "min-h-10 gap-2.5 px-2.5 text-control aria-[current=true]:font-semibold",
          )}
          onClick={() => controller.jumpToStep(index)}
        >
          <Index>{String(index + 1).padStart(2, "0")}</Index>
          <span className="min-w-0 flex-1 text-start">
            {stepListTitle(lesson, index, pending, status)}
          </span>
          {isKey && <Tag className="flex-none">{LABELS.scene}</Tag>}
          <span
            aria-hidden="true"
            className={cn(
              "inline-block size-2 flex-none rounded-full bg-label-4",
              status !== "todo" && "bg-accent",
              status === "active" && "pe-blink",
            )}
          />
        </button>
      ),
    };
  });
  useEffect(() => {
    if (activeStep >= 0) stepsPager.showKey(`step-${activeStep}`);
  }, [activeStep, lesson.id, tab, stepsPager]);

  /* ----- foot: the prediction key, or the next protocol at the end ----- */
  const index = protocolCatalog.findIndex((p) => p.id === lesson.id);
  const nextProtocol = protocolCatalog[index + 1];
  const experiment = nextExperiment("protocol");
  const recapFoot = state?.view === "recap";
  const { available, upcoming } = snap;
  const quizFoot = !recapFoot && upcoming;

  const lessonBody = (
    <>
      <PagedList
        key={motion.key}
        pager={lessonPager}
        resetKey={resetKey}
        items={items}
        className={cn("paged-blocks", motion.dir > 0 ? "pe-slide-in" : "pe-slide-back")}
      />
      <Pager pager={lessonPager} label={state?.view === "recap" ? "정리 쪽" : "해설 쪽"} />
    </>
  );
  const stepsBody = (
    <>
      <Label className="mb-1.5 gap-1">
        {LABELS.jumpToScene}{" "}
        <span className="text-label-2">
          · {keySteps.length}곳 / {lesson.steps.length}단계
        </span>
      </Label>
      <PagedList
        as="nav"
        aria-label="단계 목록"
        pager={stepsPager}
        resetKey={lesson.id}
        items={stepItems}
        className={cn(
          "grid content-start",
          "[&>*]:flex [&>*]:items-center [&>*]:border-b [&>*]:border-separator-soft [&>*]:keep-all [&>*:last-child]:border-b-0",
        )}
      />
      <Pager pager={stepsPager} label="장면 쪽" />
    </>
  );

  return (
    <SidePanel
      aria-labelledby="side-label"
      className="min-[1100px]:flex min-[1100px]:flex-col min-[1100px]:[contain:size]"
    >
      <Tabs value={tab} onValueChange={(value) => onTab(value as SideTab)}>
        <PlateHead className="gap-2 pe-3.5">
          <Label id="side-label" className="overflow-hidden whitespace-nowrap">
            <Index>B</Index> <span className="panel-title">{title}</span>
          </Label>
          {!stacked && (
            <TabsList aria-label="해설 보기" className="flex-none">
              <TabsTab value="lesson" data-tab="lesson">
                {LABELS.explainTab}
              </TabsTab>
              <TabsTab value="steps" data-tab="steps">
                {LABELS.scenesTab}
              </TabsTab>
            </TabsList>
          )}
          {state && state.view !== "overview" && (
            <Button
              size="sm"
              data-action="back"
              title="처음으로 (R)"
              className="flex-none"
              onClick={() => controller.resetLesson()}
            >
              <ChevronLeftIcon aria-hidden="true" />
              <span>처음</span>
            </Button>
          )}
        </PlateHead>
        {stacked ? (
          <>
            <div className={bodyClass}>{lessonBody}</div>
            <div className="mx-5 border-t border-separator-soft pt-4 pb-5 phone:mx-3.5">
              {stepsBody}
            </div>
          </>
        ) : (
          <>
            <TabsPanel value="lesson" className={bodyClass}>
              {lessonBody}
            </TabsPanel>
            <TabsPanel value="steps" className={bodyClass}>
              {stepsBody}
            </TabsPanel>
          </>
        )}
        {quizFoot && (
          <PlateFoot className="border-t-0 px-3.5 py-2.5">
            <Button
              variant={available && !snap.availableAnswered ? "primary" : "filled"}
              data-action="quiz"
              disabled={!available}
              className="flex-1"
              onClick={controller.openQuiz}
            >
              {available
                ? LABELS.predict("다음 패킷")
                : `패킷 ${upcoming!.packet + 1} 앞에서 맞혀보기`}
            </Button>
          </PlateFoot>
        )}
        {recapFoot && (
          <PlateFoot className="border-t-0 px-3.5 py-2.5">
            {nextProtocol ? (
              <Button
                variant="primary"
                size="sm"
                data-next-lesson={nextProtocol.id}
                className="flex-1"
                onClick={() => controller.selectLesson(nextProtocol.id)}
              >
                다음 프로토콜: {nextProtocol.name} →
              </Button>
            ) : (
              experiment && (
                <ButtonLink variant="primary" size="sm" href={experiment.href} className="flex-1">
                  다음 실험: {experiment.title} →
                </ButtonLink>
              )
            )}
          </PlateFoot>
        )}
      </Tabs>
    </SidePanel>
  );
}
