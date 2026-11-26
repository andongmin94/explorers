import { Button as ButtonPrimitive } from "@ui-sdk/react/button";
import { Toolbar, ToolbarButton } from "@ui-sdk/react/toolbar";
import { createContext, useContext } from "react";

import { buttonVariants, type ButtonVariants } from "@/components/ui/button-variants.ts";
import { cn } from "@/lib/cn.ts";

export type ButtonProps = Omit<
  React.ComponentProps<typeof ButtonPrimitive>,
  "className" | "onClick" | "children"
> &
  ButtonVariants & {
    className?: string;
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  };

// Set by <ButtonGroup toolbar>: its keys become the toolbar's items.
const InToolbar = createContext(false);

/** A key: glass capsule (chrome), filled (content) or primary (accent). */
export function Button({ className, variant, size, onClick, ...props }: ButtonProps) {
  const inToolbar = useContext(InToolbar);
  const classes = cn(buttonVariants({ variant, size }), className);
  // UI SDK keeps a button pending while its handler's Promise runs; ours never are.
  const press =
    onClick &&
    ((event: React.MouseEvent<HTMLElement>) =>
      void onClick(event as React.MouseEvent<HTMLButtonElement>));
  if (inToolbar) {
    const { render, children, disabled, ...rest } = props;
    return (
      <ToolbarButton
        {...(rest as React.ComponentProps<typeof ToolbarButton>)}
        render={render as React.ComponentProps<typeof ToolbarButton>["render"]}
        disabled={disabled}
        focusableWhenDisabled={false}
        className={classes}
        onClick={press}
      >
        {children}
      </ToolbarButton>
    );
  }
  return <ButtonPrimitive className={classes} onClick={press} {...props} />;
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

const groupClass = cn(
  "inline-flex items-center gap-0.5 rounded-full p-[3px] capsule",
  "[&>[data-slot=button]]:min-h-7 [&>[data-slot=toolbar-button]]:min-h-7",
  "phone:[&>[data-slot=button]]:min-h-[42px] phone:[&>[data-slot=toolbar-button]]:min-h-[42px]",
);

/**
 * Button group (kit Window/Button Group 647:1886): one capsule holding
 * borderless items (`variant="plain"`), 4px padding, items 28 tall. With
 * `toolbar` (the deck's transport) it is a UI SDK toolbar: one tab stop,
 * arrow keys between its keys. Otherwise a plain group (one key in a capsule).
 */
export function ButtonGroup({
  className,
  toolbar,
  ...props
}: React.ComponentProps<"div"> & { toolbar?: boolean }) {
  if (toolbar)
    return (
      <InToolbar.Provider value>
        <Toolbar className={cn(groupClass, className)} {...props} />
      </InToolbar.Provider>
    );
  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a row of buttons, not a form fieldset
    <div role="group" data-slot="button-group" className={cn(groupClass, className)} {...props} />
  );
}
