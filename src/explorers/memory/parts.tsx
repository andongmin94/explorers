// Small parts every memory panel shares: the page chip (a rounded square in
// the page's colour, like the scene's tokens) and the 적중 / 부재 outcome dot.
import { Led } from "@/components/ui/content.tsx";
import { cn } from "@/lib/cn.ts";
import { pageColor } from "./scene.ts";
import type { Step } from "./types.ts";

const chip =
  "inline-grid size-6 flex-none place-items-center rounded-[7px] font-sans text-caption leading-none font-bold";

/** A page as a chip; null is an empty frame (—). `future` is an access not made yet. */
export function PageChip({
  page,
  future,
  className,
}: {
  page: string | null;
  future?: boolean;
  className?: string;
}) {
  if (!page || future)
    return (
      <span
        data-slot="page-chip"
        className={cn(chip, future ? "font-medium text-label-2" : "text-label-3", className)}
      >
        {future ? page : "—"}
      </span>
    );
  return (
    <span
      data-slot="page-chip"
      className={cn(
        chip,
        "bg-[var(--pg)] text-white shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.12)]",
        className,
      )}
      style={{ "--pg": pageColor(page) } as React.CSSProperties}
    >
      {page}
    </span>
  );
}

/** "적중" / "부재" (or "강제 부재" with `cold`) with its status dot. */
export function Outcome({
  step,
  cold = false,
  className,
}: {
  step: Step;
  cold?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-[7px] whitespace-nowrap", className)}>
      <OutcomeLed hit={Boolean(step.hit)} />
      {step.hit ? "적중" : cold && step.compulsory ? "강제 부재" : "부재"}
    </span>
  );
}

/** The outcome dot alone: accent for a hit, the fault colour for a miss. */
export function OutcomeLed({ hit, className }: { hit: boolean; className?: string }) {
  return (
    <Led
      data-outcome={hit ? "hit" : "fault"}
      color={hit ? "var(--accent)" : "var(--mem-fault)"}
      className={className}
    />
  );
}
