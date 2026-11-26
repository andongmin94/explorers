// 정리 (docs/DESIGN.md → Learning model): 핵심 정리 points, 확인 문제
// answered without the scene (every choice has its why), the progress line and
// the link onward. recapItems() returns the blocks for a <PagedList>, so a
// question and its answer split into whole pages instead of overflowing.
import { useState, type ReactNode } from "react";

import { ButtonLink } from "@/components/ui/button.tsx";
import { Meter, Note } from "@/components/ui/content.tsx";
import { Index, Label, Text } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import {
  LABELS,
  nextExperiment,
  progressParts,
  recallVerdict,
  type ProgressSummary,
  type RecallChoice,
  type Misconception,
  type RecallQuestion,
} from "@/lib/lesson-kit.ts";
import { MisconceptionNote } from "./misconception.tsx";
import type { PagedItem } from "./pager.tsx";

/** Dots + "학습 진도 · 핵심 장면 4/6 · 예측 3/4 · 비교 완료 · 확인 문제 1/2". */
export function ProgressLine({
  summary,
  className,
}: {
  summary: ProgressSummary;
  className?: string;
}) {
  const { parts, total, got } = progressParts(summary);
  return (
    <div
      data-slot="progress"
      className={cn("flex min-w-0 flex-wrap items-center gap-2.5", className)}
    >
      <Meter total={total} got={got} />
      <Label className="block whitespace-normal">
        {parts.map((part, i) => (
          <span key={part}>
            {i > 0 && " · "}
            <span className="whitespace-nowrap">{part}</span>
          </span>
        ))}
      </Label>
    </div>
  );
}

/** The learner's first answer to each recall question: { [id]: choice index }. */
export function useRecallAnswers() {
  return useState<Record<string, number>>({});
}

/** One 확인 문제: label, question, choices (the picked one stays pressed). */
export function RecallQuestionBlock({
  question,
  picked,
  onPick,
}: {
  question: RecallQuestion;
  picked?: number;
  onPick: (choice: RecallChoice, index: number) => void;
}) {
  return (
    <div data-recall={question.id}>
      <Label>{LABELS.recall}</Label>
      <Text className="mt-1.5 mb-2 console-tight:mt-0.5 console-tight:mb-1">
        {question.question}
      </Text>
      <div className="grid">
        {question.choices.map((choice, i) => (
          <button
            key={choice.label}
            type="button"
            data-choice={i}
            aria-pressed={picked === i ? true : undefined}
            onClick={() => onPick(choice, i)}
            className={cn(
              "relative flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-small border-0 border-b border-separator-soft last:border-b-0 bg-fill-4 py-[7px] pr-7 pl-0.5 text-left text-inherit keep-all",
              "not-first:mt-1 after:absolute after:end-3 after:text-label-3 after:content-['›']",
              "hover:bg-fill-4 aria-pressed:bg-lg-selected aria-pressed:font-semibold",
              "focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--control-accent)_55%,transparent)]",
              "console-tight:min-h-0 console-tight:py-1.5",
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The verdict under a recall question, once answered. */
export function RecallWhy({
  question,
  choice,
}: {
  question: RecallQuestion;
  choice: RecallChoice;
}) {
  return (
    <Note as="p" accent={Boolean(choice.correct)} className="mt-2">
      {recallVerdict(question, choice)}
    </Note>
  );
}

/** Progress and "다음 레슨: … →" (the last lesson links to the next experiment). */
export function RecapFoot({
  explorer,
  summary,
  next,
}: {
  explorer: string;
  summary: ProgressSummary;
  next: { href: string; title: string } | null;
}) {
  const target = next
    ? { ...next, kind: "다음 레슨" }
    : { ...nextExperiment(explorer), kind: "다음 실험" };
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <ProgressLine summary={summary} />
      {target.href && (
        <ButtonLink variant="filled" size="sm" href={target.href}>
          {target.kind}: {target.title} →
        </ButtonLink>
      )}
    </div>
  );
}

/**
 * The 정리 blocks for a paged column: each point its own block (the first
 * under "정리 · 핵심 정리"), every misconception the lesson set right, each recall question, its answer note once
 * answered, then the foot.
 */
export function recapItems({
  explorer,
  points,
  misconceptions = [],
  recall,
  answers,
  onAnswer,
  summary,
  next,
  pointClass,
}: {
  explorer: string;
  points: ReactNode[];
  misconceptions?: readonly Misconception[];
  recall: RecallQuestion[];
  answers: Record<string, number>;
  onAnswer: (question: RecallQuestion, choice: RecallChoice, index: number) => void;
  summary: ProgressSummary;
  next: { href: string; title: string } | null;
  pointClass?: string;
}): PagedItem[] {
  const items: PagedItem[] = points.map((point, i) => ({
    key: `recap-point-${i}`,
    node:
      i === 0 ? (
        <div>
          <Label className="mb-1 block">
            <Index>{LABELS.recap}</Index> {LABELS.recapPoints}
          </Label>
          <Text className={pointClass}>{point}</Text>
        </div>
      ) : (
        <Text className={pointClass}>{point}</Text>
      ),
  }));
  for (const item of misconceptions) {
    items.push({
      key: `recap-misconception-${item.id}`,
      note: true,
      node: <MisconceptionNote item={item} />,
    });
  }
  for (const question of recall) {
    const picked = answers[question.id];
    items.push({
      key: `recall-${question.id}`,
      node: (
        <RecallQuestionBlock
          question={question}
          picked={picked}
          onPick={(choice, index) => onAnswer(question, choice, index)}
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
  items.push({
    key: "recap-foot",
    node: <RecapFoot explorer={explorer} summary={summary} next={next} />,
  });
  return items;
}
