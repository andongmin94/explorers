// 예측 (shared/DESIGN.md → Learning model): a sheet opened just before a
// decision. While it is open nothing on screen gives the answer away; each
// option has its own why; answering never gates progress. The explorer
// fills the body (context, choices, follow-ups); this file gives the frame
// and the parts every prediction shares.
import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Note, Tag } from "@/components/ui/content.tsx";
import { Sheet, SheetBody, SheetContent, SheetFoot, SheetHead } from "@/components/ui/sheet.tsx";

export { SheetSection } from "@/components/ui/sheet.tsx";
import { Heading, Index, Label } from "@/components/ui/typography.tsx";
import { cn } from "@/lib/cn.ts";
import { LABELS } from "@/lib/lesson-kit.ts";

/** The sheet: "? 예측" head, the body, and "실제로 확인 →" once answered. */
export function PredictionSheet({
  open,
  onOpenChange,
  revealed,
  onReveal,
  children,
  bodyClassName,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Show the "실제로 확인 →" key (after the last answer). */
  revealed: boolean;
  onReveal: () => void;
  children: ReactNode;
  bodyClassName?: string;
} & Omit<React.ComponentProps<typeof SheetContent>, "children">) {
  const reveal = useRef<HTMLButtonElement>(null);
  // The reveal key takes focus once it appears, so Enter plays the answer.
  useEffect(() => {
    if (revealed) reveal.current?.focus();
  }, [revealed]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-labelledby="prediction-title" {...props}>
        <SheetHead>
          <Label>
            <Index>?</Index> {LABELS.predictTitle}
          </Label>
        </SheetHead>
        <div className="flex min-h-0 flex-auto flex-col">
          <SheetBody className={bodyClassName}>{children}</SheetBody>
          {revealed && (
            <SheetFoot>
              <Button ref={reveal} variant="primary" data-action="quiz-continue" onClick={onReveal}>
                {LABELS.reveal}
              </Button>
            </SheetFoot>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** A choice key; after the answer the right one says 정답 and the picked one 내 선택. */
export function ChoiceKey({
  mark,
  answered,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  mark?: "correct" | "picked" | null;
  answered?: boolean;
}) {
  return (
    <Button
      variant="filled"
      aria-disabled={answered || undefined}
      disabled={answered && !mark}
      className={cn("justify-start text-left font-medium whitespace-normal", className)}
      {...props}
    >
      {children}
      {mark && <Tag className="ms-auto">{mark === "correct" ? "정답" : "내 선택"}</Tag>}
    </Button>
  );
}

/** The verdict after an answer: "맞았습니다." / "정답은 X입니다." with the why. */
export function Feedback({
  correct,
  heading,
  children,
}: {
  correct: boolean;
  heading?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Note accent={correct} className="[&_p]:m-0 [&_p+p]:mt-1.5">
      <div>
        {heading && <Heading>{heading}</Heading>}
        {children}
      </div>
    </Note>
  );
}
