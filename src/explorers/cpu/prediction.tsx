// 예측 for the CPU: who gets the CPU at the next decision, then a number
// (first response or how long this turn lasts). Generated from the run, so it
// works for every method and quantum (the CPU's "two-step generated
// prediction", docs/DESIGN.md).
import { useEffect, useRef, useState } from "react";

import {
  ChoiceKey,
  Feedback,
  PredictionSheet,
  SheetSection,
} from "@/components/learning/prediction.tsx";
import { Led, List } from "@/components/ui/content.tsx";
import { SheetTitle } from "@/components/ui/sheet.tsx";
import { Label, Text, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS, type Progress } from "@/lib/lesson-kit.ts";
import { colorOf, keepUnits } from "./format.ts";
import type { Lesson } from "./lessons.ts";
import type { Prediction } from "./types.ts";

export interface Quiz {
  prediction: Prediction;
  /** Where playback stopped (prediction.beforeTime). */
  at: number;
}

export function CpuPrediction({
  lesson,
  quiz,
  onClose,
  onReveal,
  progress,
}: {
  lesson: Lesson;
  quiz: Quiz | null;
  onClose: () => void;
  onReveal: (quiz: Quiz) => void;
  progress: Progress;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [number, setNumber] = useState<number | null>(null);
  const followRef = useRef<HTMLDivElement>(null);
  const hasIo = lesson.processes.some((p) => p.io.length);
  const prediction = quiz?.prediction;

  // A new prediction starts unanswered.
  const [shown, setShown] = useState<Quiz | null>(null);
  if (shown !== quiz) {
    setShown(quiz);
    setPicked(null);
    setNumber(null);
  }

  const follow = prediction?.followUp ?? null;
  const revealed = picked !== null && (!follow || number !== null);
  useEffect(() => {
    if (picked !== null && follow && number === null)
      followRef.current?.querySelector("button")?.focus();
  }, [picked, follow, number]);

  if (!prediction || !quiz) return null;

  const { decision } = prediction;
  const right = prediction.choices.find((c) => c.correct)!;
  const pickedChoice = prediction.choices.find((c) => c.id === picked);
  const answer = (id: string) => {
    if (picked !== null) return;
    const choice = prediction.choices.find((c) => c.id === id)!;
    progress.markPrediction(prediction.id, choice.correct);
    setPicked(id);
  };
  const mark = (value: string, correctValue: string, pickedValue: string | null) =>
    pickedValue === null
      ? null
      : value === correctValue
        ? "correct"
        : value === pickedValue
          ? "picked"
          : null;

  return (
    <PredictionSheet
      open
      onOpenChange={(open) => !open && onClose()}
      revealed={revealed}
      onReveal={() => onReveal(quiz)}
      bodyClassName="[&_[data-slot=title]]:mt-1.5 [&_p.text-body]:mt-1.5"
    >
      <div id="prediction-body" className={cn(picked !== null && "is-answered")}>
        <SheetSection>
          <Label>{quiz.at < 0 ? "시작 전" : `${quiz.at} ms`}에서 멈춤</Label>
          <SheetTitle render={<Title data-slot="title" id="prediction-title" className="mt-1.5" />}>
            {decision.time} ms,{" "}
            {decision.cause === "keep"
              ? "CPU는 누가 쓰게 될까요?"
              : "다음 CPU는 누구에게 돌아갈까요?"}
          </SheetTitle>
          {picked === null && (
            <Text className="mt-1.5 text-label-2">{keepUnits(prediction.hint)}</Text>
          )}
        </SheetSection>
        {picked === null && (
          <SheetSection>
            <List
              as="dl"
              className={cn(
                "m-0 [&>div]:items-baseline [&>div_dt]:w-[132px] [&>div_dt]:flex-none [&>div_dd]:m-0",
                "phone:[&>div]:flex-col phone:[&>div]:items-start phone:[&>div]:gap-0.5",
                "console:grid console:grid-cols-3 console:gap-x-[18px] console:gap-y-0",
                "console:[&>div]:grid console:[&>div]:min-h-0 console:[&>div]:content-start console:[&>div]:gap-1.5 console:[&>div]:border-0 console:[&>div]:p-0",
                "console:[&>div_dt]:w-auto console:[&_dd_.note]:block console:[&_dd_.note]:text-caption",
              )}
            >
              <div>
                <Label as="dt">지금 CPU</Label>
                <dd>
                  <b>{prediction.running || "유휴"}</b>{" "}
                  <span className="note text-label-2">{keepUnits(prediction.runningNote)}</span>
                </dd>
              </div>
              <div>
                <Label as="dt">{prediction.readyLabel}</Label>
                <dd>
                  <b>
                    {prediction.ready.join(prediction.readyLabel.includes("→") ? " → " : " · ") ||
                      "비어 있음"}
                  </b>
                </dd>
              </div>
              <div>
                <Label as="dt">{decision.time} ms에 들어오는 작업</Label>
                <dd>
                  {prediction.joined.join(" · ") ||
                    (hasIo ? "도착·입출력 복귀 없음" : "새로 도착하는 작업 없음")}
                </dd>
              </div>
            </List>
          </SheetSection>
        )}
        <SheetSection>
          <Label>{decision.time} ms에 CPU를 받을 작업</Label>
          <div
            className={cn(
              "mt-2.5 grid grid-cols-3 gap-2.5 phone:grid-cols-1",
              picked !== null && "short:hidden",
            )}
          >
            {prediction.choices.map(({ id }) => {
              const process = lesson.processes.find((p) => p.id === id)!;
              return (
                <ChoiceKey
                  key={id}
                  data-answer={id}
                  answered={picked !== null}
                  mark={mark(id, decision.chosen, picked)}
                  onClick={() => answer(id)}
                >
                  <Led color={colorOf(id)} />
                  <span>
                    <b>{id}</b> {process.name}
                  </span>
                </ChoiceKey>
              );
            })}
          </div>
          <div
            id="quiz-feedback"
            aria-live="polite"
            className={cn(pickedChoice && "mt-3.5 short:mt-0")}
          >
            {pickedChoice && (
              <Feedback
                correct={pickedChoice.correct}
                heading={pickedChoice.correct ? LABELS.correct : LABELS.wrong(decision.chosen)}
              >
                <p>{keepUnits(pickedChoice.why)}</p>
                {!pickedChoice.correct && <p className="text-label-2">{keepUnits(right.why)}</p>}
              </Feedback>
            )}
          </div>
        </SheetSection>
        {follow && picked !== null && (
          <SheetSection id="quiz-follow">
            <Label>이어서 · 숫자로 예측</Label>
            <Text className="mt-1.5">
              {keepUnits(follow.question)}
              {follow.context && (
                <span className="text-label-2"> ({keepUnits(follow.context)})</span>
              )}
            </Text>
            <div
              ref={followRef}
              className="mt-2.5 grid gap-2.5 phone:grid-cols-1"
              style={{ gridTemplateColumns: `repeat(${follow.choices.length}, minmax(0, 1fr))` }}
            >
              {follow.choices.map((n) => (
                <ChoiceKey
                  key={n}
                  data-number={n}
                  answered={number !== null}
                  mark={mark(
                    String(n),
                    String(follow.answer),
                    number === null ? null : String(number),
                  )}
                  onClick={() => number === null && setNumber(n)}
                >
                  <b className="tabular-nums">{n}&nbsp;ms</b>
                </ChoiceKey>
              ))}
            </div>
            <div
              id="quiz-follow-feedback"
              aria-live="polite"
              className={cn(number !== null && "mt-3.5")}
            >
              {number !== null && (
                <Feedback correct={number === follow.answer}>
                  <p>
                    {number === follow.answer
                      ? LABELS.correct
                      : LABELS.wrong(`${follow.answer} ms`)}{" "}
                    {keepUnits(follow.explanation)}
                  </p>
                </Feedback>
              )}
            </div>
          </SheetSection>
        )}
      </div>
    </PredictionSheet>
  );
}
