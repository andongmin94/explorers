// 예측 for the memory explorer: which page goes (victim) or what the next
// access gives and why (outcome). The sheet shows only the accesses so far;
// a victim choice's evidence (적재 · 마지막 접근 …) is revealed with the answer.
import { useState } from "react";

import { Feedback, PredictionSheet, SheetSection } from "@/components/learning/prediction.tsx";
import { List } from "@/components/ui/content.tsx";
import { SheetTitle } from "@/components/ui/sheet.tsx";
import { Index, Label, Text, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS } from "@/lib/lesson-kit.ts";
import { OutcomeLed, PageChip } from "./parts.tsx";
import type { Mode, Quiz } from "./types.ts";

export function MemoryPrediction({
  quiz,
  mode,
  references,
  onAnswer,
  onClose,
  onReveal,
}: {
  quiz: Quiz | null;
  mode: Mode;
  references: readonly string[];
  /** The learner's first answer (marks progress, lifts the mask). */
  onAnswer: (quiz: Quiz, correct: boolean) => void;
  onClose: () => void;
  onReveal: (quiz: Quiz) => void;
}) {
  // A new prediction starts unanswered.
  const [picked, setPicked] = useState<string | null>(null);
  const [shown, setShown] = useState<Quiz | null>(null);
  if (shown !== quiz) {
    setShown(quiz);
    setPicked(null);
  }
  if (!quiz) return null;

  const outcome = quiz.kind === "outcome";
  const right = quiz.choices.find((c) => c.correct)!;
  const chosen = quiz.choices.find((c) => c.id === picked);
  const answer = (id: string) => {
    if (picked !== null) return;
    setPicked(id);
    onAnswer(quiz, quiz.choices.find((c) => c.id === id)!.correct);
  };
  const line = "flex flex-wrap items-center gap-1 [&>b]:ms-1 [&>b]:font-medium";

  return (
    <PredictionSheet
      open
      onOpenChange={(open) => !open && onClose()}
      revealed={picked !== null}
      onReveal={() => onReveal(quiz)}
      className="w-[min(580px,calc(100vw-24px))]"
    >
      <SheetSection>
        <Label>
          <Index>{mode.label}</Index> {quiz.atIndex}번째 접근
        </Label>
        <SheetTitle render={<Title id="prediction-title" className="mt-1.5" />}>
          {quiz.question}
        </SheetTitle>
        <Text className="mt-1.5 text-label-2">{quiz.rule}</Text>
        <Label as="p" className={cn("mt-1.5", line)}>
          지금까지의 접근 ·{" "}
          {quiz.history.map((page, i) => (
            <span key={i} className="inline-flex items-center gap-1 tabular-nums">
              {i + 1}
              <PageChip page={page} />
            </span>
          ))}
        </Label>
        {mode.algorithm === "opt" && (
          <Label as="p" className={cn("mt-1.5", line)}>
            OPT가 아는 앞으로의 접근 ·{" "}
            {references.slice(quiz.atIndex).map((page, i) => (
              <span key={i} className="inline-flex items-center gap-1 tabular-nums">
                {quiz.atIndex + i + 1}
                <PageChip page={page} />
              </span>
            ))}
          </Label>
        )}
        <List className="mt-3">
          {quiz.choices.map((c) => {
            const correct = picked !== null && c.id === right.id;
            const wrong = picked === c.id && !correct;
            return (
              <button
                key={c.id}
                type="button"
                data-answer={c.id}
                disabled={picked !== null}
                onClick={() => answer(c.id)}
                className={cn(
                  "w-full cursor-pointer gap-3! rounded-none border-x-0 border-t-0 bg-transparent px-2! py-[9px]! text-left text-label",
                  "not-disabled:hover:rounded-small not-disabled:hover:bg-fill-4 disabled:cursor-default",
                  "focus-visible:rounded-small focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)]",
                  (correct || wrong) && "rounded-small border-b-transparent",
                  correct && "bg-accent-fill",
                  wrong && "bg-[color-mix(in_srgb,var(--mem-fault)_12%,transparent)]",
                )}
              >
                {outcome ? (
                  <span className="grid size-6 flex-none place-items-center">
                    <OutcomeLed hit={c.label === "적중"} />
                  </span>
                ) : (
                  <PageChip page={c.id} />
                )}
                <span className="grid gap-0.5 text-control font-semibold">
                  <span>{c.label}</span>
                  <Label className="font-medium">
                    {outcome || picked !== null ? c.detail : `F${c.slot}`}
                  </Label>
                </span>
                <span
                  className={cn(
                    "ms-auto text-caption font-medium text-label-2",
                    correct && "font-semibold text-accent-text",
                  )}
                >
                  {correct ? "정답" : wrong ? "선택" : ""}
                </span>
              </button>
            );
          })}
        </List>
        <div id="prediction-feedback" aria-live="polite" className={cn(chosen && "mt-3")}>
          {chosen && (
            <Feedback
              correct={chosen.correct}
              heading={chosen.correct ? LABELS.correct : LABELS.wrong(quiz.answer)}
            >
              <p>
                {chosen.why}
                {chosen.correct ? "" : ` ${right.why}`}
              </p>
            </Feedback>
          )}
        </div>
      </SheetSection>
    </PredictionSheet>
  );
}
