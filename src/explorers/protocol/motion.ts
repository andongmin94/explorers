// Reconstructed from the distributed Protocol Explorer JavaScript.
const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN_CUBIC = "cubic-bezier(0.5, 0, 0.75, 0)";
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const prefersReducedMotion = () => reducedMotionQuery.matches;
interface ContentTransition {
  phase: "out" | "in";
  update: () => void;
  dir: number;
  entering?: Animation;
}
const contentTransitions = new WeakMap<HTMLElement, ContentTransition>();
// Smooth scroll sessions: a newer scroll or direct input stops the older one.
const glides = new WeakMap<HTMLElement, { stopped?: boolean } | null>();
const glideWatched = new WeakSet<HTMLElement>();
/** Coalesce rapid updates while text leaves, then animate the newest content in. */

function transitionContent(
  element: HTMLElement,
  updateContent: () => void,
  {
    axis = "x",
    dir: direction = 1,
    distance = 24,
    out: exitDuration = 160,
    inn: enterDuration = 300,
  } = {},
) {
  if (prefersReducedMotion()) {
    return updateContent();
  }
  const translateBy = (offset: number) =>
    axis === "x" ? `translateX(${offset}px)` : `translateY(${offset}px)`;
  const previousTransition = contentTransitions.get(element);
  if (previousTransition?.phase === "out") {
    previousTransition.update = updateContent;
    previousTransition.dir = direction;
    return;
  }
  const computedStyle = getComputedStyle(element);
  const currentFrame = {
    transform: computedStyle.transform,
    opacity: Number(computedStyle.opacity),
  };
  if (previousTransition?.phase === "in" && currentFrame.opacity < 0.5) {
    // Content is still mostly invisible, so replace it without a second exit.
    previousTransition.entering!.cancel();
    updateContent();
    previousTransition.entering = element.animate(
      [
        currentFrame,
        {
          transform: "none",
          opacity: 1,
        },
      ],
      {
        duration: enterDuration * (1 - currentFrame.opacity),
        easing: EASE_OUT_EXPO,
      },
    );
    previousTransition.entering.onfinish = () =>
      contentTransitions.get(element) === previousTransition && contentTransitions.delete(element);
    return;
  }
  previousTransition?.entering?.cancel();
  const transition: ContentTransition = {
    phase: "out",
    update: updateContent,
    dir: direction,
  };
  contentTransitions.set(element, transition);
  const exitAnimation = element.animate(
    [
      currentFrame,
      {
        transform: translateBy(-distance * direction),
        opacity: 0,
      },
    ],
    {
      duration: exitDuration * currentFrame.opacity,
      easing: previousTransition ? "linear" : EASE_IN_CUBIC,
      fill: "forwards",
    },
  );
  exitAnimation.onfinish = () => {
    if (contentTransitions.get(element) === transition) {
      transition.update();
      transition.phase = "in";
      transition.entering = element.animate(
        [
          {
            transform: translateBy(distance * transition.dir),
            opacity: 0,
          },
          {
            transform: "none",
            opacity: 1,
          },
        ],
        {
          duration: enterDuration,
          easing: EASE_OUT_EXPO,
        },
      );
      exitAnimation.cancel();
      transition.entering!.onfinish = () =>
        contentTransitions.get(element) === transition && contentTransitions.delete(element);
    }
  };
}

const getReadingDirection = () => (document.documentElement.dir === "rtl" ? -1 : 1);

const slideContent = (
  element: HTMLElement,
  updateContent: () => void,
  direction = 1,
  distance = 24,
) =>
  transitionContent(element, updateContent, {
    axis: "x",
    dir: direction * getReadingDirection(),
    distance,
  });

function animateTextChange(
  element: HTMLElement,
  text: string,
  direction = 1,
  onUpdate?: (element: HTMLElement) => void,
) {
  if (element.dataset.text === text) {
    return;
  }
  const isFirstRender = element.dataset.text === undefined;
  element.dataset.text = text;
  const applyText = () => {
    element.textContent = text;
    onUpdate?.(element);
  };
  if (isFirstRender) {
    return applyText();
  }
  transitionContent(element, applyText, {
    axis: "y",
    dir: direction,
    distance: 10,
    out: 120,
    inn: 240,
  });
}

function resetScrollPosition(element: HTMLElement) {
  glides.set(element, null);
  element.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

function smoothScrollTo(element: HTMLElement, targetTop: number) {
  const initialTop = element.scrollTop;
  const distance =
    Math.max(0, Math.min(targetTop, element.scrollHeight - element.clientHeight)) - initialTop;
  if (Math.abs(distance) < 1) {
    return;
  }
  if (prefersReducedMotion()) {
    return (element.scrollTop = initialTop + distance);
  }
  const duration = Math.min(650, 280 + Math.abs(distance) * 0.8);
  // A newer scroll or direct user input invalidates this animation's session.
  const scrollSession: { stopped?: boolean } = {};
  glides.set(element, scrollSession);
  if (!glideWatched.has(element)) {
    glideWatched.add(element);
    const stopScroll = () => {
      const glide = glides.get(element);
      if (glide) glide.stopped = true;
    };
    element.addEventListener("wheel", stopScroll, {
      passive: true,
    });
    element.addEventListener("touchstart", stopScroll, {
      passive: true,
    });
  }
  let startedAt: number | undefined;
  const animateFrame = (timestamp: number) => {
    if (scrollSession.stopped || glides.get(element) !== scrollSession) {
      return;
    }
    startedAt ??= timestamp;
    const progress = Math.min(1, (timestamp - startedAt) / duration);
    element.scrollTop =
      initialTop +
      distance * (progress < 0.5 ? 4 * progress ** 3 : 1 - (2 - 2 * progress) ** 3 / 2);
    if (progress < 1) {
      requestAnimationFrame(animateFrame);
    }
  };
  requestAnimationFrame(animateFrame);
}
export {
  EASE_OUT_EXPO,
  animateTextChange,
  prefersReducedMotion,
  resetScrollPosition,
  slideContent,
  smoothScrollTo,
};
