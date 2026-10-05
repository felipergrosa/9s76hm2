import React from "react";
import { Headset } from "lucide-react";
import BentoCard from "./BentoCard";
import useCountUp from "./useCountUp";
import { i18n } from "../../../translate/i18n";

// Card de atendentes: online/total com count-up + dot pulsante ao vivo.
const AgentsCard = ({ className = "", online, total, loading }) => {
  const counted = useCountUp(online);
  const hasOnline = online > 0;

  return (
    <BentoCard className={className}>
      <div className="bento-stat">
        <div>
          <span className="bento-label">{i18n.t("dashboard.cards.activeAttendants")}</span>
          <div className="bento-value" style={{ marginTop: 6 }}>
            {loading ? (
              <span className="bento-shimmer" />
            ) : (
              <>
                {counted}
                <span className="bento-muted" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                  /{total}
                </span>
              </>
            )}
          </div>
          <div className="bento-muted" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span className={`bento-pulse${hasOnline ? "" : " bento-pulse--off"}`} />
            online
          </div>
        </div>
        <div className="bento-icon" style={{ background: "#e7505a" }}>
          <Headset size={20} />
        </div>
      </div>
    </BentoCard>
  );
};

export default AgentsCard;
