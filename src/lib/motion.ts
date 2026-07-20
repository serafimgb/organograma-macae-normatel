import { useReducedMotion } from "framer-motion";

export function useEntranceMotion() {
  const reduce = useReducedMotion();

  const fadeInUp = (delay = 0) =>
    reduce
      ? { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, ease: "easeOut" as const, delay },
        };

  const hoverLift = reduce ? {} : { whileHover: { scale: 1.015 }, whileTap: { scale: 0.99 } };

  return { reduce, fadeInUp, hoverLift };
}
