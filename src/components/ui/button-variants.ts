import { cva, type VariantProps } from "class-variance-authority";

/**
 * Keys (shared/DESIGN.md → `.hw-key`). Three looks:
 * - glass: a Liquid Glass Small capsule, for chrome (toolbar, deck, over the scene).
 * - filled: the kit's bordered push button, for content (side panel, records, sheets).
 * - primary: tinted with the explorer accent (one per group at most).
 * `aria-pressed="true"` latches a glass/filled key (grey fill + accent label).
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
    "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.8]",
    "phone:min-h-[42px]",
  ],
  {
    variants: {
      variant: {
        glass: [
          "glass-sm text-vlabel shadow-[var(--hw-key-shadow)]",
          "hover:not-disabled:[background:linear-gradient(var(--lg-hover),var(--lg-hover)),var(--lg-sheen),var(--lg-small)]",
          "active:not-disabled:[background:linear-gradient(var(--lg-press),var(--lg-press)),var(--lg-sheen),var(--lg-small)]",
          "aria-pressed:[background:linear-gradient(var(--lg-selected),var(--lg-selected)),var(--lg-sheen),var(--lg-small)] aria-pressed:text-accent-text",
        ],
        filled: [
          "bg-control-fill text-label",
          "hover:not-disabled:[background:linear-gradient(var(--fill-4),var(--fill-4)),var(--control-fill)]",
          "active:not-disabled:bg-control-press",
          "aria-pressed:bg-accent-fill aria-pressed:text-accent-text",
        ],
        primary: [
          "[background:linear-gradient(rgb(255_255_255/0.18),rgb(255_255_255/0)_60%),var(--accent)] font-semibold text-on-accent",
          "shadow-[var(--hw-key-accent-shadow)] hover:not-disabled:brightness-[1.06]",
          "active:not-disabled:[background:linear-gradient(rgb(0_0_0/0.15),rgb(0_0_0/0.15)),var(--accent)]",
        ],
      },
      size: {
        default: "min-h-8 px-3.5",
        sm: "min-h-7 px-[11px] [&_svg]:size-[15px]",
        toolbar: "min-h-9 px-3.5",
        icon: "size-8 min-h-8 p-0 phone:size-[42px]",
        "icon-sm": "size-7 min-h-7 p-0 [&_svg]:size-[15px] phone:size-[42px]",
        "icon-toolbar": "size-9 min-h-9 p-0 phone:size-[42px]",
      },
    },
    defaultVariants: { variant: "glass", size: "default" },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
