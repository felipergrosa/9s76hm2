import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { bentoItem, bentoItemReduced, springHover } from "./motionPresets";

// Card base do grid bento: entrada com spring + hover lift.
// O span de grid é controlado via className tailwind (col-span/row-span).
const BentoCard = ({ className = "", children, hover = true, onClick, style }) => {
  const reduced = useReducedMotion();

  return (
    <motion.div
      variants={reduced ? bentoItemReduced : bentoItem}
      whileHover={hover && !reduced ? { y: -4, transition: springHover } : undefined}
      whileTap={onClick && !reduced ? { scale: 0.98 } : undefined}
      onClick={onClick}
      style={style}
      className={`bento-card ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default BentoCard;
