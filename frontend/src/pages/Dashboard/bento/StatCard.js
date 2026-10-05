import React from "react";
import BentoCard from "./BentoCard";
import useCountUp from "./useCountUp";

// KPI compacto do bento: label + valor com count-up + ícone colorido.
const StatCard = ({ className = "", label, value, icon, accent, loading }) => {
  const isNumeric = typeof value === "number";
  const counted = useCountUp(isNumeric ? value : 0);

  return (
    <BentoCard className={className}>
      <div className="bento-stat">
        <div>
          <span className="bento-label">{label}</span>
          <div className="bento-value" style={{ marginTop: 6 }}>
            {loading ? (
              <span className="bento-shimmer" />
            ) : isNumeric ? (
              counted
            ) : (
              value
            )}
          </div>
        </div>
        <div className="bento-icon" style={{ background: accent }}>
          {icon}
        </div>
      </div>
    </BentoCard>
  );
};

export default StatCard;
