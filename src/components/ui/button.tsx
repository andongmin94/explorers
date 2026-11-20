import { Button as ButtonPrimitive } from "@base-ui/react/button";

import { buttonVariants, type ButtonVariants } from "@/components/ui/button-variants.ts";
import { cn } from "@/lib/cn.ts";

export type ButtonProps = Omit<ButtonPrimitive.Props, "className"> &
  ButtonVariants & { className?: string };

/** A key: glass capsule (chrome), filled (content) or primary (accent). */
export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

/** A link that looks like a key (e.g. "다음 레슨: … →"). */
export function ButtonLink({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<"a"> & ButtonVariants) {
  return (
    <a data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </a>
  );
}

/**
 * Button group (kit Window/Button Group 647:1886): one capsule holding
 * borderless items (`variant="plain"`), 4px padding, items 28 tall. The deck's
 * transport and the toolbar's grouped icon keys use it.
 */
export function ButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a row of buttons, not a form fieldset
      role="group"
      data-slot="button-group"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full p-[3px] capsule",
        "[&>[data-slot=button]]:min-h-7 phone:[&>[data-slot=button]]:min-h-[42px]",
        className,
      )}
      {...props}
    />
  );
}
