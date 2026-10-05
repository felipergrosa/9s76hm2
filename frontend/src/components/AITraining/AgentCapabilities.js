import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Grid,
  InputAdornment,
  Paper,
  Switch,
  TextField,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import BlockIcon from "@material-ui/icons/Block";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import SearchIcon from "@material-ui/icons/Search";
import AddIcon from "@material-ui/icons/Add";
import { toast } from "react-toastify";

import api from "../../services/api";
import { listSkills, createSkill, toggleSkill } from "../../services/skills";
import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles((theme) => ({
  section: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  sectionTitle: {
    marginBottom: theme.spacing(0.5),
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
  chipInactive: {
    borderColor: theme.palette.divider
  },
  searchField: {
    marginBottom: theme.spacing(2)
  },
  categoryHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%"
  },
  empty: {
    padding: theme.spacing(3),
    textAlign: "center"
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginBottom: theme.spacing(1.5)
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
  const { hasPermission } = usePermissions();
  const canEditAgents = hasPermission("ai-agents.edit");

  const [loading, setLoading] = useState(false);
  const [functions, setFunctions] = useState([]);
  const [defaultSkills, setDefaultSkills] = useState([]);
  const [skillCatalog, setSkillCatalog] = useState([]);
  const [skillCategories, setSkillCategories] = useState({});
  const [stageInfo, setStageInfo] = useState(null);
  const [agentSkills, setAgentSkills] = useState([]);
  const [search, setSearch] = useState("");
  const [togglingFn, setTogglingFn] = useState("");
  const [activatingKey, setActivatingKey] = useState("");

  const load = async () => {
    if (!agentId) {
      setFunctions([]);
      setDefaultSkills([]);
      setSkillCatalog([]);
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
      setSkillCatalog(Array.isArray(data?.skillCatalog) ? data.skillCatalog : []);
      setSkillCategories(data?.skillCategories || {});
      setStageInfo(data?.stage || null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao carregar capacidades do agente");
    }

    try {
      const data = await listSkills({ agentId: Number(agentId) });
      const skills = Array.isArray(data?.skills) ? data.skills : [];
      setAgentSkills(skills.filter((s) => s.status !== "deprecated"));
    } catch (err) {
      setAgentSkills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, stageId]);

  const isFunctionAvailable = (fnName) => {
    if (!stageInfo) return true;
    if (stageInfo.allAvailable) return true;
    return (stageInfo.availableFunctions || []).includes(fnName);
  };

  // Persiste a lista de funções da etapa — array vazio = todas
  const persistEnabledFunctions = async (names) => {
    if (!agentId || !stageId) return;
    try {
      const { data } = await api.put(
        `/ai-agents/${agentId}/funnel-stages/${stageId}/enabled-functions`,
        { enabledFunctions: names }
      );
      const enabled = Array.isArray(data?.enabledFunctions) ? data.enabledFunctions : [];
      const catalog = functions.map((f) => f.name);
      setStageInfo({
        id: Number(stageId),
        enabledFunctions: enabled,
        allAvailable: enabled.length === 0,
        availableFunctions: enabled.length === 0 ? catalog : enabled,
        unavailableFunctions: enabled.length === 0 ? [] : catalog.filter((n) => !enabled.includes(n))
      });
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao atualizar funções da etapa");
      throw err;
    }
  };

  const currentEnabled = () => {
    if (!stageInfo || stageInfo.allAvailable) return functions.map((f) => f.name);
    return stageInfo.enabledFunctions || [];
  };

  const handleToggleFunction = async (fnName, checked) => {
    if (!stageId) return toast.error("Selecione uma etapa do funil para restringir funções");
    if (!canEditAgents) return toast.error("Requer permissão ai-agents.edit");
    setTogglingFn(fnName);
    try {
      const enabled = currentEnabled();
      const next = checked ? [...new Set([...enabled, fnName])] : enabled.filter((n) => n !== fnName);
      // Se todas ficaram marcadas, salva [] (convenção: vazio = todas)
      await persistEnabledFunctions(next.length === functions.length ? [] : next);
    } catch (_) {
      // erro já tratado
    } finally {
      setTogglingFn("");
    }
  };

  const handleEnableAll = async () => {
    if (!canEditAgents) return toast.error("Requer permissão ai-agents.edit");
    await persistEnabledFunctions([]);
    toast.success("Todas as funções liberadas para esta etapa");
  };

  // Ativa uma skill do catálogo: cria Skill real do agente com
  // metadata.catalogKey para deduplicação
  const handleActivateSkill = async (entry) => {
    if (!agentId) return;
    if (!canEditAgents) return toast.error("Requer permissão ai-agents.edit");
    setActivatingKey(entry.key);
    try {
      await createSkill({
        name: entry.name,
        category: entry.category,
        description: entry.description,
        triggers: entry.triggers || [{ type: "intent", value: entry.name }],
        functions: entry.functions || [],
        priority: entry.priority || 5,
        agentId: Number(agentId),
        metadata: { catalogKey: entry.key, source: "catalog" }
      });
      toast.success(`Habilidade "${entry.name}" ativada no agente`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao ativar habilidade");
    } finally {
      setActivatingKey("");
    }
  };

  const handleToggleAgentSkill = async (skill) => {
    try {
      await toggleSkill(skill.id);
      setAgentSkills((prev) =>
        prev.map((s) => (s.id === skill.id ? { ...s, enabled: !s.enabled } : s))
      );
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao alterar habilidade");
    }
  };

  // Dedupe catálogo × skills do agente (por catalogKey ou nome)
  const catalogActiveKeys = useMemo(() => {
    const set = new Set();
    for (const s of agentSkills) {
      if (s?.metadata?.catalogKey) set.add(s.metadata.catalogKey);
      if (s?.name) set.add(`name:${s.name}`);
    }
    return set;
  }, [agentSkills]);

  const isCatalogActive = (entry) =>
    catalogActiveKeys.has(entry.key) || catalogActiveKeys.has(`name:${entry.name}`);

  // Filtro de busca em todas as seções
  const q = search.trim().toLowerCase();
  const matches = (text) => !q || String(text || "").toLowerCase().includes(q);
  const matchFn = (fn) => matches(fn.name) || matches(fn.description);
  const matchSkill = (s) => matches(s.name) || matches(s.description) || matches(s.category);

  const filteredFunctions = functions.filter(matchFn);
  const filteredCatalog = skillCatalog.filter(matchSkill);
  const filteredAgentSkills = agentSkills.filter(matchSkill);

  const catalogByCategory = useMemo(() => {
    const map = {};
    for (const entry of filteredCatalog) {
      const cat = entry.category || "outros";
      if (!map[cat]) map[cat] = [];
      map[cat].push(entry);
    }
    return map;
  }, [filteredCatalog]);

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
    <Box>
      <TextField
        className={classes.searchField}
        fullWidth
        variant="outlined"
        size="small"
        placeholder="Buscar habilidade ou função..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          )
        }}
      />

      <Grid container spacing={2}>
        {/* ===== Funções executáveis com toggles por etapa ===== */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" className={classes.section}>
            <Typography variant="subtitle1" className={classes.sectionTitle}>
              Funções executáveis ({filteredFunctions.length}/{functions.length})
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
              Ações reais via function calling.
              {stageInfo
                ? stageInfo.allAvailable
                  ? " Etapa sem restrição — todas disponíveis."
                  : " Etapa com restrição — ative/desative abaixo."
                : " Selecione uma etapa para restringir por etapa."}
            </Typography>

            {stageId && (
              <Box className={classes.toolbar}>
                <Tooltip title={canEditAgents ? "Define enabledFunctions como vazio (libera tudo)" : "Requer ai-agents.edit"}>
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      onClick={handleEnableAll}
                      disabled={!canEditAgents || !stageInfo || stageInfo.allAvailable}
                    >
                      Liberar todas nesta etapa
                    </Button>
                  </span>
                </Tooltip>
                {stageInfo && !stageInfo.allAvailable && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${(stageInfo.availableFunctions || []).length} de ${functions.length} habilitadas`}
                  />
                )}
              </Box>
            )}

            {filteredFunctions.map((fn) => {
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
                  {stageId && canEditAgents && (
                    <Switch
                      size="small"
                      checked={available}
                      disabled={togglingFn === fn.name}
                      onChange={(e) => handleToggleFunction(fn.name, e.target.checked)}
                      color="primary"
                    />
                  )}
                </Box>
              );
            })}
          </Paper>
        </Grid>

        {/* ===== Catálogo de skills + skills do agente ===== */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" className={classes.section}>
            <Typography variant="subtitle1" className={classes.sectionTitle}>
              Skills do agente ({filteredAgentSkills.length})
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
              Skills ativas vinculadas a este agente — incluindo as geradas pelo treinamento e as ativadas do catálogo.
            </Typography>
            {filteredAgentSkills.length === 0 ? (
              <Typography variant="body2" color="textSecondary">Nenhuma skill customizada ativa.</Typography>
            ) : (
              filteredAgentSkills.map((s) => (
                <Box key={s.id || s.name} className={classes.itemRow}>
                  <Chip size="small" label={s.category || "custom"} className={classes.chipAvailable} />
                  <Box flex={1}>
                    <span className={classes.itemName}>{s.name}</span>
                    {s.description && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        {s.description}
                      </Typography>
                    )}
                  </Box>
                  {canEditAgents && (
                    <Switch
                      size="small"
                      checked={s.enabled !== false}
                      onChange={() => handleToggleAgentSkill(s)}
                      color="primary"
                    />
                  )}
                </Box>
              ))
            )}
          </Paper>

          <Paper variant="outlined" className={classes.section}>
            <Typography variant="subtitle1" className={classes.sectionTitle}>
              Catálogo de habilidades ({filteredCatalog.length})
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
              Ative habilidades prontas neste agente — elas entram no prompt em tempo real.
            </Typography>

            {Object.keys(catalogByCategory).length === 0 ? (
              <Typography variant="body2" color="textSecondary">Nenhuma habilidade encontrada na busca.</Typography>
            ) : (
              Object.entries(catalogByCategory)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cat, entries]) => (
                  <Accordion key={cat} defaultExpanded={Boolean(q)} disableGutters elevation={0}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box className={classes.categoryHeader}>
                        <Typography variant="subtitle2">
                          {skillCategories[cat] || cat}
                        </Typography>
                        <Chip size="small" variant="outlined" label={entries.length} />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box width="100%">
                        {entries.map((entry) => {
                          const active = isCatalogActive(entry);
                          return (
                            <Box key={entry.key} className={classes.itemRow}>
                              <Chip
                                size="small"
                                label={active ? "Ativa" : "Catálogo"}
                                className={active ? classes.chipAvailable : classes.chipInactive}
                                variant={active ? "default" : "outlined"}
                              />
                              <Box flex={1}>
                                <span className={classes.itemName}>{entry.name}</span>
                                <Typography variant="caption" color="textSecondary" display="block">
                                  {entry.description}
                                </Typography>
                                {entry.functions?.length > 0 && (
                                  <Typography variant="caption" color="textSecondary" display="block" style={{ fontFamily: "monospace", fontSize: 10 }}>
                                    funções: {entry.functions.join(", ")}
                                  </Typography>
                                )}
                              </Box>
                              <Tooltip title={active ? "Já ativa neste agente" : canEditAgents ? "Criar skill deste agente a partir do catálogo" : "Requer ai-agents.edit"}>
                                <span>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                    startIcon={<AddIcon />}
                                    disabled={active || !canEditAgents || activatingKey === entry.key}
                                    onClick={() => handleActivateSkill(entry)}
                                  >
                                    {activatingKey === entry.key ? "Ativando..." : "Ativar"}
                                  </Button>
                                </span>
                              </Tooltip>
                            </Box>
                          );
                        })}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))
            )}
          </Paper>

          <Paper variant="outlined" className={classes.section}>
            <Typography variant="subtitle1" className={classes.sectionTitle}>
              Skills padrão do sistema ({defaultSkills.length})
            </Typography>
            {defaultSkills.map((s, idx) => (
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
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AgentCapabilities;
