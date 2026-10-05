import React from "react";
import BentoCard from "./BentoCard";
import useCountUp from "./useCountUp";
import { i18n } from "../../../translate/i18n";

// Card hero do bento: KPI principal em destaque + lista viva de
// atendentes online (ocupa a segunda linha do row-span).
const HeroCard = ({ className = "", label, value, icon, accent, attendants = [], loading }) => {
  const counted = useCountUp(value);
  const online = attendants.filter((a) => a.online).slice(0, 5);
  const extra = attendants.filter((a) => a.online).length - online.length;

  return (
    <BentoCard className={className}>
      <div className="bento-hero">
        <div className="bento-hero-top">
          <div>
            <span className="bento-label">{label}</span>
            <div className="bento-value bento-value--hero" style={{ marginTop: 8 }}>
              {loading ? <span className="bento-shimmer" /> : counted}
            </div>
          </div>
          <div className="bento-icon" style={{ background: accent, width: 52, height: 52 }}>
            {icon}
          </div>
        </div>

        <hr className="bento-hero-divider" />

        <div style={{ flex: 1 }}>
          <span
            className="bento-muted"
            style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}
          >
            <span className={`bento-pulse${online.length ? "" : " bento-pulse--off"}`} />
            {i18n.t("dashboard.cards.activeAttendants")}
          </span>
          {online.length === 0 && !loading && (
            <span className="bento-muted">—</span>
          )}
          {online.map((a) => (
            <div className="bento-agent-row" key={a.id}>
              <span className="bento-avatar-dot">
                {(a.name || "?").trim().charAt(0).toUpperCase()}
              </span>
              <span>{a.name}</span>
            </div>
          ))}
          {extra > 0 && <div className="bento-muted" style={{ padding: "5px 0" }}>+{extra}</div>}
        </div>
      </div>
    </BentoCard>
  );
};

export default HeroCard;
