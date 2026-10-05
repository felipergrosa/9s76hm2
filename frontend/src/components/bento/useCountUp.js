import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

// Count-up suave para KPIs. Retorna número pronto para render.
// FM6 não renderiza MotionValue como filho de <motion.*> — por isso o
// valor animado é espelhado em state via onUpdate.
export default function useCountUp(target, duration = 0.9) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const currentRef = useRef(0); // valor atual: ponto de partida do próximo tween

  useEffect(() => {
    const to = Number(target) || 0;
    const from = currentRef.current;

    if (reduced || from === to) {
      currentRef.current = to;
      setDisplay(to);
      return;
    }

    const controls = animate(from, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
      onComplete: () => {
        currentRef.current = to;
      },
    });
    return () => controls.stop();
  }, [target, duration, reduced]);

  return display;
}
