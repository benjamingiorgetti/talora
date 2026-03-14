import type { Variants, Transition } from "framer-motion";

export const easing = {
  expOut: [0.16, 1, 0.3, 1] as const,
};

export const spring = {
  indicator: { type: "spring" as const, stiffness: 500, damping: 35 },
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
  gentle: { type: "spring" as const, stiffness: 300, damping: 28 },
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

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easing.expOut } },
  exit: { opacity: 0, y: 4, transition: { duration: 0.15, ease: easing.expOut } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: easing.expOut } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: easing.expOut } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: easing.expOut } },
  exit: { opacity: 0, x: 24, transition: { duration: 0.15, ease: easing.expOut } },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: easing.expOut } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.15, ease: easing.expOut } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easing.expOut } },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15, ease: easing.expOut } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: easing.expOut } },
};
