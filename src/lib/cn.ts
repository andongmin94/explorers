import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge must know the theme's custom names (app.css @theme), or it
// reads `text-caption` (a size) and `text-label-2` (a colour) as two colours
// and drops one of them.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "control", "body", "headline", "title", "large"],
      radius: ["window", "panel", "group", "note", "small", "menu"],
      ease: ["spring", "knob", "drawer"],
      font: ["display"],
      shadow: ["knob"],
    },
  },
});

/** Join class names; later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
