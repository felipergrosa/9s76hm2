import React from "react";
import { motion } from "framer-motion";
import BentoCard from "../../../components/bento/BentoCard";
import ChartDonut from "../ChartDonut";
import { i18n } from "../../../translate/i18n";

// Card NPS consolidado: donut do score + barras por categoria.
// Substitui os 4 donuts + card-resumo da antiga tab "Avaliações".
const NpsCard = ({ className = "", counters = {} }) => {
  const promoters = parseInt(counters.npsPromotersPerc || 0, 10);
  const passives = parseInt(counters.npsPassivePerc || 0, 10);
  const detractors = parseInt(counters.npsDetractorsPerc || 0, 10);
  const hasData = promoters + passives + detractors > 0;

  const donutData = hasData
    ? [
        { name: "Promotores", value: promoters },
        { name: "Neutros", value: passives },
        { name: "Detratores", value: detractors },
      ]
    : [{ name: "Sem dados", value: 100 }];

  const donutColors = hasData ? ["#2EA85A", "#F7EC2C", "#F73A2C"] : ["#918F94"];

  const bars = [
    { label: i18n.t("dashboard.assessments.promoters"), value: promoters, color: "#2EA85A" },
    { label: i18n.t("dashboard.assessments.neutrals"), value: passives, color: "#F7EC2C" },
    { label: i18n.t("dashboard.assessments.detractors"), value: detractors, color: "#F73A2C" },
  ];

  return (
    <BentoCard className={className} hover={false}>
      <div className="bento-card-header">
        <h3 className="bento-card-title">NPS</h3>
        <span className="bento-muted">
          {counters.withRating || 0} {i18n.t("dashboard.assessments.ratedCalls").toLowerCase()}
        </span>
      </div>

      <ChartDonut
        data={donutData}
        value={counters.npsScore || 0}
        title="Score"
        color={donutColors}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {bars.map((bar) => (
          <div className="bento-bar-row" key={bar.label}>
            <span className="bento-bar-label">{bar.label}</span>
            <div className="bento-bar-track">
              <motion.div
                className="bento-bar-fill"
                style={{ background: bar.color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(bar.value, 100)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 22 }}
              />
            </div>
            <span className="bento-bar-value">{bar.value}%</span>
          </div>
        ))}
      </div>
    </BentoCard>
  );
};

export default NpsCard;
