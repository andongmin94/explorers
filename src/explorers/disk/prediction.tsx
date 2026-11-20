// 예측 for the disk: which cylinder comes next (SSTF and the sweeps), or how
// long the next move is (FCFS, and SCAN/LOOK at the turn). The scene is
// behind the sheet, so the prompt carries what the learner needs; every
// choice has its own why.
import { useState } from "react";

import {
  ChoiceKey,
  Feedback,
  PredictionSheet,
  SheetSection,
} from "@/components/learning/prediction.tsx";
import { SheetTitle } from "@/components/ui/sheet.tsx";
import { Label, Text, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS, type Progress } from "@/lib/lesson-kit.ts";
import { fix } from "./format.ts";
import type { Lesson } from "./lessons.ts";
import type { Algorithm, Prediction } from "./types.ts";

export interface Quiz {
  algorithm: Algorithm;
  /** The request the prediction is about (the next one to play). */
  index: number;
  head: number;
  prediction: Prediction;
}

export function DiskPrediction({
  lesson,
  quiz,
  onClose,
  onReveal,
  progress,
}: {
  lesson: Lesson;
  quiz: Quiz | null;
  onClose: () => void;
  onReveal: () => void;
  progress: Progress;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  // A new prediction starts unanswered.
  const [shown, setShown] = useState<Quiz | null>(null);
  if (shown !== quiz) {
    setShown(quiz);
    setPicked(null);
  }
  if (!quiz) return null;

  const { prediction: p, algorithm } = quiz;
  const right = p.choices.find((c) => c.correct)!;
  const chosen = p.choices.find((c) => c.id === picked);
  const answer = (id: number) => {
    if (picked !== null) return;
    const choice = p.choices.find((c) => c.id === id)!;
    progress.markPrediction(`${algorithm}:${quiz.index}`, choice.correct);
    setPicked(id);
  };

  return (
    <PredictionSheet
      open
      onOpenChange={(open) => !open && onClose()}
      revealed={picked !== null}
      onReveal={onReveal}
      className="w-[min(760px,calc(100vw-24px))]"
    >
      <div id="prediction-body" className={cn(picked !== null && "is-answered")}>
        <SheetSection>
          <Label>
            {fix(lesson.names[algorithm]!)} · 현재 헤드 {quiz.head}
          </Label>
          <SheetTitle render={<Title id="prediction-title" className="mt-1.5" />}>
            {fix(p.question)}
          </SheetTitle>
          <Text className="mt-1.5">{fix(p.prompt)}</Text>
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2.5 phone:grid-cols-2">
            {p.choices.map((c) => (
              <ChoiceKey
                key={c.id}
                data-answer={c.id}
                answered={picked !== null}
                mark={
                  picked === null ? null : c.correct ? "correct" : c.id === picked ? "picked" : null
                }
                className="min-h-10 justify-center px-3"
                onClick={() => answer(c.id)}
              >
                <b className="text-headline font-semibold tabular-nums">{c.label}</b>
              </ChoiceKey>
            ))}
          </div>
        </SheetSection>
        <div id="prediction-feedback" aria-live="polite">
          {chosen && (
            <SheetSection className="mt-3.5">
              <Feedback
                correct={chosen.correct}
                heading={chosen.correct ? LABELS.correct : LABELS.wrong(right.answer)}
              >
                <p>
                  {fix(chosen.why)}
                  {chosen.correct ? "" : ` ${fix(right.why)}`}
                </p>
              </Feedback>
            </SheetSection>
          )}
        </div>
      </div>
    </PredictionSheet>
  );
}
