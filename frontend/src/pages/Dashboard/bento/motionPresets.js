// Presets de motion do bento — springs físicos (framer-motion v6 / React 17)
// damping 30 + stiffness 320 ≈ criticamente amortecido (sem overshoot perceptível)

export const bentoContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

export const bentoItem = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 30 },
  },
};

// Variante segura para prefers-reduced-motion: fade curto, sem deslocamento
export const bentoItemReduced = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

export const springHover = { type: "spring", stiffness: 420, damping: 28 };
