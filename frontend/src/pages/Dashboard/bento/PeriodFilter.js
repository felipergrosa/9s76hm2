import React, { useState } from "react";
import { i18n } from "../../../translate/i18n";

// Filtro de período compacto do header: inputs nativos + botão aplicar.
// Substitui o Filters.js (MUI v4) que exigia prop `classes` nunca passada —
// estava inalcançável na UI antiga (showFilter sempre false).
const PeriodFilter = ({ dateStart, dateEnd, onApply, loading }) => {
  const [start, setStart] = useState(dateStart);
  const [end, setEnd] = useState(dateEnd);

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input
        type="date"
        className="bento-input"
        value={start}
        aria-label={i18n.t("dashboard.date.initialDate")}
        onChange={(e) => setStart(e.target.value)}
      />
      <input
        type="date"
        className="bento-input"
        value={end}
        aria-label={i18n.t("dashboard.date.finalDate")}
        onChange={(e) => setEnd(e.target.value)}
      />
      <button
        type="button"
        className="bento-btn-primary"
        disabled={loading}
        onClick={() => onApply(start, end)}
      >
        Filtrar
      </button>
    </div>
  );
};

export default PeriodFilter;
