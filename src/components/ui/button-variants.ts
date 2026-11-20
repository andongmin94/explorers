import { cva, type VariantProps } from "class-variance-authority";

/**
 * Push buttons (kit Buttons 207:14487; docs/LIQUID-GLASS.md → Controls).
 * - glass: a Liquid Glass Small capsule, for chrome (toolbar, over the scene).
 * - filled: the bordered push button (5% fill), for content (side, records, sheets).
 * - plain: a borderless item inside a <ButtonGroup> capsule (kit 647:1886).
 * - primary: the default button (accent fill): only where one default action
 *   exists (a sheet's confirm). Never for transport or selection.
 * `aria-pressed="true"` latches a key with the grey selection fill (kit form
 * "Button: Label | [Label]"); the label stays primary, never the accent.
 * Sizes follow the kit: 28 (large, default), 24 (medium, sm), 36 (toolbar).
 */
export const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-1.5 rounded-full border-0",
    "font-sans text-control font-medium leading-4 whitespace-nowrap keep-all no-underline cursor-pointer",
    "[-webkit-tap-highlight-color:transparent]",
    "transition-[transform,background-color,filter] duration-150 ease-spring motion-reduce:transition-none",
    "active:not-disabled:scale-[0.97] motion-reduce:active:not-disabled:scale-100",
    "focus-visible:ring-focus",
    "disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default",
    "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.7]",
    "phone:min-h-[42px]",
  ],
  {
    variants: {
      variant: {
        glass: [
          "glass-sm text-vlabel shadow-[var(--hw-key-shadow)]",
          "hover:not-disabled:[background:linear-gradient(var(--lg-hover),var(--lg-hover)),var(--lg-sheen),var(--lg-small)]",
          "active:not-disabled:[background:linear-gradient(var(--lg-press),var(--lg-press)),var(--lg-sheen),var(--lg-small)]",
          "aria-pressed:[background:linear-gradient(var(--sel),var(--sel)),var(--lg-sheen),var(--lg-small)]",
        ],
        filled: [
          "bg-control-fill text-label",
          "hover:not-disabled:[background:linear-gradient(var(--fill-4),var(--fill-4)),var(--control-fill)]",
          "active:not-disabled:bg-control-press",
          "aria-pressed:bg-sel",
        ],
        plain: [
          "bg-transparent text-label",
          "hover:not-disabled:bg-lg-hover active:not-disabled:bg-lg-press",
          "aria-pressed:bg-sel",
        ],
        primary: [
          "bg-accent text-on-accent hover:not-disabled:brightness-[1.05]",
          "active:not-disabled:[background:linear-gradient(rgb(0_0_0/0.15),rgb(0_0_0/0.15)),var(--accent)]",
        ],
      },
      size: {
        default: "min-h-7 px-3",
        sm: "min-h-6 px-2.5 [&_svg]:size-[14px]",
        toolbar: "min-h-9 px-3.5",
        icon: "size-7 min-h-7 p-0 phone:size-[42px]",
        "icon-sm": "size-6 min-h-6 p-0 [&_svg]:size-[14px] phone:size-[42px]",
        "icon-toolbar": "size-9 min-h-9 p-0 phone:size-[42px]",
      },
    },
    defaultVariants: { variant: "glass", size: "default" },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
