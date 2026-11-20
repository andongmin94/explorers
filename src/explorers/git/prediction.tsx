// 예측: asked at a 핵심 장면 just before the decision. Each choice has its why;
// the answer reveals "실제로 확인 → (git …)", which plays exactly the event
// that answers it (or, for git status, shows this step's own output).
import { useEffect, useRef, useState } from "react";

import { ChoiceKey, Feedback } from "@/components/learning/prediction.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFoot,
  SheetHead,
  SheetSection,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Index, Label, Text, Title } from "@/components/ui/typography.tsx";
import { LABELS, type Progress } from "@/lib/lesson-kit.ts";
import { keepFlags, pad } from "./format.ts";
import type { Lesson, Prediction } from "./lesson-model.ts";

export interface Quiz {
  prediction: Prediction;
  /** playback.renders when it opened: any later render closes it (as the vanilla render()). */
  renders: number;
}

export function GitPrediction({
  lesson,
  quiz,
  onClose,
  onAnswered,
  onVerify,
  progress,
}: {
  lesson: Lesson;
  quiz: Quiz | null;
  /** The sheet closed; `answered` when the step behind it may now show the answer. */
  onClose: (answered: boolean) => void;
  onAnswered: (q: Prediction) => void;
  onVerify: (q: Prediction) => void;
  progress: Progress;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [shown, setShown] = useState<Quiz | null>(null);
  const verify = useRef<HTMLButtonElement>(null);
  // A new prediction starts unanswered.
  if (shown !== quiz) {
    setShown(quiz);
    setPicked(null);
  }
  useEffect(() => {
    if (picked !== null) verify.current?.focus();
  }, [picked]);

  const q = quiz?.prediction;
  const answer = (id: string) => {
    if (!q || picked !== null) return;
    const choice = q.choices.find((c) => c.id === id)!;
    progress.markPrediction(`${q.index}`, Boolean(choice.correct));
    setPicked(id);
    onAnswered(q);
  };
  const feedback = q && picked !== null ? lesson.feedback(q, picked) : null;

  return (
    <Sheet open={Boolean(q)} onOpenChange={(open) => !open && onClose(picked !== null)}>
      {q && (
        <SheetContent aria-labelledby="prediction-title">
          <SheetHead>
            <Label>
              <Index>?</Index> {LABELS.predictTitle}
            </Label>
          </SheetHead>
          <div className="flex min-h-0 flex-auto flex-col">
            <SheetBody>
              <SheetSection>
                <SheetTitle render={<Title id="prediction-title" className="mt-1" />}>
                  {keepFlags(q.question)}
                </SheetTitle>
                <Text className="mt-2">{keepFlags(q.context)}</Text>
              </SheetSection>
              <SheetSection>
                <div className="mt-1 grid gap-2.5">
                  {q.choices.map((c, i) => (
                    <ChoiceKey
                      key={c.id}
                      data-answer={c.id}
                      answered={picked !== null}
                      mark={
                        picked === null
                          ? null
                          : c.correct
                            ? "correct"
                            : c.id === picked
                              ? "picked"
                              : null
                      }
                      className="min-h-12"
                      onClick={() => answer(c.id)}
                    >
                      <Index>{pad(i + 1)}</Index>
                      <span>{c.text}</span>
                    </ChoiceKey>
                  ))}
                </div>
                <div
                  id="prediction-feedback"
                  aria-live="polite"
                  className={feedback ? "mt-3.5" : ""}
                >
                  {feedback && (
                    <Feedback correct={feedback.correct}>
                      <p>
                        <strong>{feedback.verdict}</strong> {keepFlags(feedback.why)}
                      </p>
                    </Feedback>
                  )}
                </div>
              </SheetSection>
            </SheetBody>
            {feedback && (
              <SheetFoot>
                <Button
                  ref={verify}
                  variant="primary"
                  data-action="verify"
                  onClick={() => onVerify(q)}
                >
                  {q.verify.label}
                </Button>
              </SheetFoot>
            )}
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
