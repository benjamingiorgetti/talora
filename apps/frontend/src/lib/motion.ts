import type { Variants, Transition } from "framer-motion";

export const easing = {
  expOut: [0.16, 1, 0.3, 1] as const,
};

export const spring = {
  indicator: { type: "spring" as const, stiffness: 500, damping: 35 },
};

export const transition = {
  default: { duration: 0.15, ease: easing.expOut } as Transition,
  fast: { duration: 0.1, ease: easing.expOut } as Transition,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.default },
  exit: { opacity: 0, transition: transition.fast },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15, ease: easing.expOut } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: easing.expOut } },
};
