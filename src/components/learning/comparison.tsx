// 비교 (docs/DESIGN.md → Learning model): the same input run with the other
// method, side by side, with one 갈림길 sentence. The explorer fills the body;
// the frame gives the head "C 두 방식 비교 · 같은 입력 · 다른 방식" and the
// two actions.
import { ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button.tsx";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFoot,
  SheetHead,
} from "@/components/ui/sheet.tsx";

export { SheetSection } from "@/components/ui/sheet.tsx";
import { Index, Label } from "@/components/ui/typography.tsx";
import { LABELS } from "@/lib/lesson-kit.ts";

export function ComparisonSheet({
  open,
  onOpenChange,
  otherLabel,
  onTryOther,
  children,
  className,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "FCFS로 다시 보기 →": the other method, with its particle. */
  otherLabel: ReactNode;
  onTryOther: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-labelledby="comparison-title" className={className}>
        <SheetHead>
          <Label>
            <Index>C</Index> {LABELS.compare} · {LABELS.compareSub}
          </Label>
        </SheetHead>
        <div className="flex min-h-0 flex-auto flex-col">
          <SheetBody className={bodyClassName}>{children}</SheetBody>
          <SheetFoot>
            <Button variant="filled" data-action="try-other" onClick={onTryOther}>
              {otherLabel} <ArrowRightIcon aria-hidden="true" />
            </Button>
            <SheetClose render={<Button variant="primary" data-action="close-dialog" />}>
              계속 살펴보기
            </SheetClose>
          </SheetFoot>
        </div>
      </SheetContent>
    </Sheet>
  );
}
