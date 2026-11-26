// 예측: "what will the next packet be?" The sheet opens just before the
// packet (playback paused), lists the choices as rows, and after an answer
// shows the verdict with the chosen choice's why; 실제로 확인 → plays on until
// the real packet has arrived and pauses. Questions and grading: quiz.ts.
import { PredictionSheet, SheetSection } from "@/components/learning/prediction.tsx";
import { List, Note } from "@/components/ui/content.tsx";
import { SheetTitle } from "@/components/ui/sheet.tsx";
import { Index, Label, Text, Title } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS } from "@/lib/lesson-kit.ts";
import type { ProtocolController, QuizSession } from "./controller.ts";
import { getLessonPackets } from "./packets/encode.ts";

const CHOICE_LETTERS = "ABCDEF";

export function ProtocolPrediction({
  controller,
  session,
}: {
  controller: ProtocolController;
  session: QuizSession | null;
}) {
  if (!session) return null;
  const { quiz, lesson, picked } = session;
  const total = getLessonPackets(lesson).length;
  const answered = picked !== null;
  const choice = answered ? quiz.choices[picked] : null;
  const correct = quiz.choices.find((c) => c.correct)!;
  return (
    <PredictionSheet
      open
      onOpenChange={(open) => !open && controller.closeQuiz()}
      revealed={answered}
      onReveal={controller.revealQuiz}
      initialFocus={() => document.querySelector<HTMLElement>("[data-answer]")}
    >
      <div id="prediction-body" className={cn(answered && "is-answered")}>
        <SheetSection>
          <Label>
            {lesson.name} · 패킷 {quiz.packet + 1}/{total}
          </Label>
          <SheetTitle render={<Title id="prediction-title" className="mt-1.5 mb-3.5" />}>
            {quiz.prompt}
          </SheetTitle>
          <List className="[&>*]:min-h-12">
            {quiz.choices.map((option, index) => {
              const wrong = picked === index && !option.correct;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-answer={index}
                  disabled={answered}
                  onClick={() => controller.answerQuiz(index)}
                  className={cn(
                    "w-full cursor-pointer gap-3! rounded-none border-x-0 border-t-0 bg-transparent px-2! py-2.5! text-left text-control text-label",
                    "not-disabled:hover:rounded-small not-disabled:hover:bg-fill-4 disabled:cursor-default",
                    "focus-visible:rounded-small focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--control-accent)_55%,transparent)]",
                    answered && option.correct && "font-semibold",
                  )}
                >
                  <Index>{CHOICE_LETTERS[index]}</Index>
                  <span
                    className={cn(
                      "min-w-0 flex-1 keep-all",
                      wrong && "text-label-2 line-through decoration-[var(--pk-lost)]",
                    )}
                  >
                    {option.text}
                  </span>
                  <span
                    className={cn(
                      "text-caption font-semibold text-label-2",
                      answered && option.correct && "text-accent-text",
                      wrong && "text-[var(--pk-lost)]",
                    )}
                  >
                    {answered && option.correct ? "정답" : wrong ? "선택" : ""}
                  </span>
                </button>
              );
            })}
          </List>
          <div aria-live="polite" className={cn(choice && "mt-3.5")}>
            {choice && (
              <>
                <Note as="p" accent={choice.correct}>
                  <span>
                    <b>{choice.correct ? LABELS.correct : LABELS.wrong(correct.text)}</b>{" "}
                    {choice.why}
                  </span>
                </Note>
                {!choice.correct && <Text className="mt-2.5 text-label-2">{correct.why}</Text>}
              </>
            )}
          </div>
          {!answered && (
            <Text className="mt-3.5 text-caption text-label-2">
              답을 고르면 고른 답의 이유가 나옵니다
            </Text>
          )}
        </SheetSection>
      </div>
    </PredictionSheet>
  );
}
