import React from "react";
import BentoCard from "./BentoCard";
import { i18n } from "../../../translate/i18n";

// Resumo de avaliações: total de atendimentos, avaliados e índice.
// Substitui o card-resumo da antiga tab "Avaliações".
const RatingsCard = ({ className = "", counters = {}, loading }) => {
  const minis = [
    { label: i18n.t("dashboard.assessments.totalCalls"), value: counters.tickets || 0 },
    { label: i18n.t("dashboard.assessments.ratedCalls"), value: counters.withRating || 0 },
    {
      label: i18n.t("dashboard.assessments.evaluationIndex"),
      value: Number(counters.percRating / 100 || 0).toLocaleString(undefined, { style: "percent" }),
    },
  ];

  return (
    <BentoCard className={className}>
      <div className="bento-card-header">
        <h3 className="bento-card-title">{i18n.t("dashboard.tabs.assessments")}</h3>
      </div>
      <div className="bento-minis" style={{ height: "calc(100% - 40px)", alignItems: "center" }}>
        {minis.map((m) => (
          <div className="bento-mini" key={m.label}>
            <strong>{loading ? <span className="bento-shimmer" style={{ minWidth: 28 }} /> : m.value}</strong>
            <span>{m.label}</span>
          </div>
        ))}
      </div>
    </BentoCard>
  );
};

export default RatingsCard;
