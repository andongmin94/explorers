// 예측 and 비교 for the transaction lessons. The prediction is asked at a
// finished event (T1's commit, T2's rollback, a retry's BEGIN); revealing
// plays exactly the next event. The comparison sets the same input run both
// ways side by side.
import { useState } from "react";

import { ComparisonSheet, SheetSection } from "@/components/learning/comparison.tsx";
import { ChoiceKey, Feedback, PredictionSheet } from "@/components/learning/prediction.tsx";
import { Button } from "@/components/ui/button.tsx";
import { List, Readout } from "@/components/ui/content.tsx";
import { SheetTitle } from "@/components/ui/sheet.tsx";
import { Label, Text, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { ro } from "@/lib/josa.ts";
import { LABELS, type Progress } from "@/lib/lesson-kit.ts";
import type { TxPage } from "./page.ts";
import { TxId } from "./parts.tsx";
import type { Quiz } from "./types.ts";

/** Fact rows: labels in one column, values lined up in the next. */
const factsClass = cn(
  "grid-cols-[max-content_minmax(0,1fr)] [&>*]:col-span-full [&>*]:grid [&>*]:grid-cols-subgrid [&>*]:items-baseline",
  "[&>*>:first-child]:pe-5 [&>*>:first-child]:text-label-2",
);

export function TxPrediction({
  page,
  mode,
  quiz,
  onClose,
  onReveal,
  progress,
}: {
  page: TxPage;
  mode: string;
  quiz: Quiz | null;
  onClose: () => void;
  onReveal: () => void;
  progress: Progress;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  // A new prediction starts unanswered.
  const [shown, setShown] = useState<Quiz | null>(null);
  if (shown !== quiz) {
    setShown(quiz);
    setPicked(null);
  }
  if (!quiz) return null;

  const chosen = quiz.options.find((o) => o.id === picked);
  const answer = (id: string) => {
    if (picked !== null) return;
    progress.markPrediction(page.predictionKey(mode, quiz), id === quiz.answerId);
    setPicked(id);
  };

  return (
    <PredictionSheet
      open
      onOpenChange={(open) => !open && onClose()}
      revealed={picked !== null}
      onReveal={onReveal}
    >
      <SheetSection>
        <Label>{page.predictionWhere(quiz)}</Label>
        <SheetTitle render={<Title id="prediction-title" className="mt-1.5 keep-all" />}>
          {quiz.question}
        </SheetTitle>
      </SheetSection>
      <SheetSection>
        <List as="ul" className={factsClass}>
          {quiz.facts.map(([label, value]) => (
            <li key={label}>
              <span>{label}</span>
              <b className="tabular-nums">{value}</b>
            </li>
          ))}
        </List>
      </SheetSection>
      <SheetSection>
        <div className="flex flex-wrap gap-2.5 phone:[&>*]:flex-[1_1_100%]">
          {quiz.options.map((o) => (
            <ChoiceKey
              key={o.id}
              data-answer={o.id}
              answered={picked !== null}
              mark={
                picked === null
                  ? null
                  : o.id === quiz.answerId
                    ? "correct"
                    : o.id === picked
                      ? "picked"
                      : null
              }
              className="min-w-24"
              onClick={() => answer(o.id)}
            >
              {o.label}
            </ChoiceKey>
          ))}
        </div>
        <div id="prediction-feedback" aria-live="polite" className={cn(chosen && "mt-3.5")}>
          {chosen && (
            <Feedback
              correct={chosen.id === quiz.answerId}
              heading={
                chosen.id === quiz.answerId ? LABELS.correct : LABELS.wrong(page.wrongAnswer(quiz))
              }
            >
              <p className="mt-1.5! keep-all">{chosen.feedback}</p>
            </Feedback>
          )}
        </div>
      </SheetSection>
    </PredictionSheet>
  );
}

export function TxComparison({
  page,
  mode,
  open,
  onOpenChange,
  onMode,
}: {
  page: TxPage;
  mode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMode: (mode: string) => void;
}) {
  const other = page.modes.find((m) => m !== mode)!;
  const columns = open ? page.comparison.columns() : [];
  return (
    <ComparisonSheet
      open={open}
      onOpenChange={onOpenChange}
      otherLabel={`${ro(page.modeLabels[other])} 다시 보기`}
      onTryOther={() => onMode(other)}
      className="console:w-[min(880px,calc(100vw-48px))]"
    >
      <SheetSection>
        <SheetTitle render={<Title id="comparison-title" className="mt-1.5 keep-all" />}>
          {page.comparison.title}
        </SheetTitle>
        <Text className="mt-2.5">{page.comparison.lead}</Text>
      </SheetSection>
      <SheetSection className="grid grid-cols-2 phone:grid-cols-1">
        {columns.map((col, i) => (
          <section
            key={col.mode}
            className={cn(
              "flex flex-col gap-3 pt-1",
              i === 0
                ? "pe-5 phone:pe-0"
                : "border-s border-separator-soft ps-5 phone:mt-4 phone:border-s-0 phone:border-t phone:ps-0 phone:pt-4",
            )}
          >
            <Label>{col.label}</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Readout large>
                {col.lcd.map(([value, unit], k) => (
                  <span key={k} className="inline-flex items-baseline gap-1">
                    {k > 0 && " "}
                    {value}
                    <small>{unit}</small>
                  </span>
                ))}
              </Readout>
              <Label>{col.tag}</Label>
            </div>
            <List as="ul">
              {col.rows.map(([id, text], k) => (
                <li key={k} className="gap-3">
                  <TxId id={id} />
                  <span>{text}</span>
                </li>
              ))}
            </List>
            <Text>{col.text}</Text>
            <Button
              variant="filled"
              {...{ [`data-${page.modeAttr}`]: col.mode }}
              data-close="true"
              className="mt-auto self-start"
              onClick={() => onMode(col.mode)}
            >
              {LABELS.replayMode} →
            </Button>
          </section>
        ))}
      </SheetSection>
      {page.comparison.foot && (
        <SheetSection>
          <p className="m-0 text-caption leading-[1.55] text-label-2 keep-all text-pretty">
            {page.comparison.foot}
          </p>
        </SheetSection>
      )}
    </ComparisonSheet>
  );
}
