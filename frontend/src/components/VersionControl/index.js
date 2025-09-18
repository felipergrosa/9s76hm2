import React, { useEffect, useState } from "react";
import { Chip, Tooltip } from "@material-ui/core";
import api from "../../services/api";

// Componente responsável por exibir informações de versão do backend:
// - Commit atual
// - Data/Hora do build
// - Versão de backend (db/env)
// Também mostra a versão do frontend no tooltip.
const VersionControl = () => {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetch = async () => {
      try {
        const { data } = await api.get("/version");
        if (!isMounted) return;

        const backendVersion = data?.backend?.version || "N/A";
        const commit = data?.backend?.commit || "N/A";
        const buildDateRaw = data?.backend?.buildDate || "N/A";
        const frontendVersion = data?.version || "N/A";

        // Formata a data localmente, quando possível
        let buildDateLabel = buildDateRaw;
        try {
          const d = new Date(buildDateRaw);
          if (!isNaN(d.getTime())) {
            buildDateLabel = d.toLocaleString();
          }
        } catch {
          // mantém string original
        }

        setInfo({
          backendVersion,
          commit,
          buildDate: buildDateLabel,
          frontendVersion
        });
      } catch (e) {
        // Em caso de erro, não trava a UI; exibe nada
        setInfo(null);
      }
    };

    fetch();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!info) return null;

  const label = `BACKEND BUILD: ${info.buildDate} | Commit: ${info.commit} | Version: ${info.backendVersion}`;

  return (
    <Tooltip title={`Frontend: ${info.frontendVersion}`}>
      <Chip size="small" label={label} />
    </Tooltip>
  );
};

export default VersionControl;
