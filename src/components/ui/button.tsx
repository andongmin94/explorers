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
