import React, { useEffect, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import BlockIcon from "@material-ui/icons/Block";
import { toast } from "react-toastify";

import api from "../../services/api";
import { listSkills } from "../../services/skills";

const useStyles = makeStyles((theme) => ({
  section: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  sectionTitle: {
    marginBottom: theme.spacing(1.5),
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  itemRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: 8,
    "&:hover": {
      backgroundColor: theme.palette.action.hover
    }
  },
  itemName: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: 600
  },
  chipAvailable: {
    backgroundColor: "#4caf50",
    color: "#fff"
  },
  empty: {
    padding: theme.spacing(3),
    textAlign: "center"
  }
}));

const AvailabilityChip = ({ available, classes }) => (
  <Chip
    size="small"
    icon={available ? <CheckCircleIcon style={{ color: "#fff" }} /> : <BlockIcon />}
    label={available ? "Disponível" : "Indisponível"}
    className={available ? classes.chipAvailable : undefined}
    variant={available ? "default" : "outlined"}
  />
);

const AgentCapabilities = ({ agentId, stageId }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [functions, setFunctions] = useState([]);
  const [defaultSkills, setDefaultSkills] = useState([]);
  const [stageInfo, setStageInfo] = useState(null);
  const [agentSkills, setAgentSkills] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (!agentId) {
        setFunctions([]);
        setDefaultSkills([]);
        setStageInfo(null);
        setAgentSkills([]);
        return;
      }
      setLoading(true);
      try {
        const { data } = await api.get("/ai/capabilities", {
          params: { agentId: Number(agentId), stageId: stageId ? Number(stageId) : undefined }
        });
        setFunctions(Array.isArray(data?.functions) ? data.functions : []);
        setDefaultSkills(Array.isArray(data?.defaultSkills) ? data.defaultSkills : []);
        setStageInfo(data?.stage || null);
      } catch (err) {
        toast.error(err.response?.data?.error || err.response?.data?.message || "Erro ao carregar capacidades do agente");
      }

      try {
        const data = await listSkills({ agentId: Number(agentId) });
        // Skills customizadas ativas do agente (exceto desabilitadas/deprecadas)
        const skills = Array.isArray(data?.skills) ? data.skills : [];
        setAgentSkills(skills.filter((s) => s.enabled !== false && s.status !== "deprecated"));
      } catch (err) {
        setAgentSkills([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [agentId, stageId]);

  // Marca disponibilidade da função para a etapa selecionada
  const isFunctionAvailable = (fnName) => {
    if (!stageInfo) return true;
    if (stageInfo.allAvailable) return true;
    if (Array.isArray(stageInfo.availableFunctions)) {
      return stageInfo.availableFunctions.includes(fnName);
    }
    if (Array.isArray(stageInfo.unavailableFunctions)) {
      return !stageInfo.unavailableFunctions.includes(fnName);
    }
    return true;
  };

  if (!agentId) {
    return (
      <Paper variant="outlined" className={classes.empty}>
        <Typography color="textSecondary">
          Selecione um agente para visualizar as capacidades e habilidades.
        </Typography>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Paper variant="outlined" className={classes.section}>
          <Typography variant="subtitle1" className={classes.sectionTitle}>
            Funções executáveis ({functions.length})
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
            Ações reais que o agente pode executar via function calling
            {stageInfo ? " — marcadas conforme a etapa selecionada" : " — selecione uma etapa para ver restrições"}.
          </Typography>
          {functions.length === 0 ? (
            <Typography variant="body2" color="textSecondary">Nenhuma função retornada.</Typography>
          ) : (
            functions.map((fn) => {
              const available = isFunctionAvailable(fn.name);
              return (
                <Box key={fn.name} className={classes.itemRow}>
                  <AvailabilityChip available={available} classes={classes} />
                  <Box flex={1}>
                    <span className={classes.itemName}>{fn.name}</span>
                    {fn.description && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        {fn.description}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper variant="outlined" className={classes.section}>
          <Typography variant="subtitle1" className={classes.sectionTitle}>
            Skills padrão do catálogo ({defaultSkills.length})
          </Typography>
          {defaultSkills.length === 0 ? (
            <Typography variant="body2" color="textSecondary">Nenhuma skill padrão.</Typography>
          ) : (
            defaultSkills.map((s, idx) => (
              <Box key={s.id || s.name || idx} className={classes.itemRow}>
                <Chip size="small" label="Padrão" color="primary" variant="outlined" />
                <Box flex={1}>
                  <Tooltip title={s.description || ""}>
                    <span className={classes.itemName}>{s.name || s.key}</span>
                  </Tooltip>
                  {s.description && (
                    <Typography variant="caption" color="textSecondary" display="block">
                      {s.description}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))
          )}
        </Paper>

        <Paper variant="outlined" className={classes.section}>
          <Typography variant="subtitle1" className={classes.sectionTitle}>
            Skills do agente ({agentSkills.length})
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
            Skills customizadas ativas vinculadas a este agente — incluindo as geradas ao aplicar melhorias do treinamento.
          </Typography>
          {agentSkills.length === 0 ? (
            <Typography variant="body2" color="textSecondary">Nenhuma skill customizada ativa.</Typography>
          ) : (
            agentSkills.map((s) => (
              <Box key={s.id || s.name} className={classes.itemRow}>
                <Chip
                  size="small"
                  label={s.category || "custom"}
                  className={classes.chipAvailable}
                />
                <Box flex={1}>
                  <span className={classes.itemName}>{s.name}</span>
                  {s.description && (
                    <Typography variant="caption" color="textSecondary" display="block">
                      {s.description}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))
          )}
        </Paper>
      </Grid>
    </Grid>
  );
};

export default AgentCapabilities;
