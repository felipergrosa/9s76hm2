import { useEffect } from "react";
import { animate, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

// Count-up suave para KPIs. Retorna MotionValue<number> arredondado,
// pronto para renderizar como filho de <motion.span>.
export default function useCountUp(target, duration = 0.9) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));

  useEffect(() => {
    const value = Number(target) || 0;
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [target, duration, reduced, mv]);

  return rounded;
}
