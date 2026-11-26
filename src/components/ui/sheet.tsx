import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/cn.ts";

/**
 * A sheet (Liquid Glass Large, r 26) over a light dim: predictions,
 * comparisons. A modal UI SDK dialog: focus is trapped, Escape and the close
 * key close it, focus returns to what opened it.
 * Use <SheetHead>, <SheetBody>, <SheetFoot> inside.
 */
export function Sheet(props: React.ComponentProps<typeof Dialog>) {
  return <Dialog {...props} />;
}

export function SheetContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof DialogContent>, "className"> & { className?: string }) {
  return (
    <>
      <DialogBackdrop className="fixed inset-0 z-50 bg-black/18 dark:bg-black/45" />
      <DialogContent
        className={cn(
          "fixed top-1/2 left-1/2 flex max-h-[calc(100dvh-40px)] w-[min(720px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
          "rounded-window glass-lg font-sans text-control leading-[1.45] text-label outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </DialogContent>
    </>
  );
}

/** Head: a label on the left, the close key on the right. */
export function SheetHead({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2.5 pt-[18px] pr-[18px] pb-[2px] pl-6", className)}
      {...props}
    >
      <div className="min-w-0 flex-auto">{children}</div>
      <DialogClose
        data-action="close-dialog"
        aria-label="닫기"
        render={<Button variant="filled" size="icon-sm" />}
      >
        <XIcon aria-hidden="true" />
      </DialogClose>
    </div>
  );
}

export function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("min-h-0 overflow-y-auto px-6 pt-1.5 pb-[22px]", className)} {...props} />
  );
}

/** Actions bottom-right, no rule above them. */
export function SheetFoot({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2.5 pr-5 pb-5 pl-6", className)}
      {...props}
    />
  );
}

/** A section of a sheet body: hairline-separated, never a box. */
export function SheetSection({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "[&+&]:mt-3.5 [&+&]:border-t [&+&]:border-separator-soft [&+&]:pt-3",
        className,
      )}
      {...props}
    />
  );
}

export const SheetTitle = DialogTitle;
export const SheetClose = DialogClose;
