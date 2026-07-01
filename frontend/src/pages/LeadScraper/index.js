import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box, Paper, Typography, Tabs, Tab, TextField, Button, Slider,
  Select, MenuItem, FormControl, InputLabel, LinearProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
  Chip, IconButton, Tooltip, CircularProgress, Divider, Grid
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
  Search as SearchIcon,
  GetApp as ImportIcon,
  Refresh as RefreshIcon,
  MapOutlined as MapsIcon,
  BusinessOutlined as CnpjIcon,
  FiberManualRecord as DotIcon,
  PersonAdd as LeadIcon,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";

const STATUS = {
  done:    { label: "Concluído", bg: "#e8f5e9", color: "#2e7d32" },
  running: { label: "Executando", bg: "#e3f2fd", color: "#1565c0" },
  error:   { label: "Erro",      bg: "#fce4ec", color: "#c62828" },
  pending: { label: "Aguardando",bg: "#f5f5f5", color: "#757575" },
};

const STATES = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const useStyles = makeStyles(theme => ({
  root: { padding: theme.spacing(3), maxWidth: 1200, margin: "0 auto" },

  hero: {
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    borderRadius: 16,
    padding: "24px 28px",
    color: "#fff",
    marginBottom: 24,
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  heroIcon: { fontSize: 40, opacity: 0.9 },
  heroTitle: { fontWeight: 700, fontSize: 20, color: "#fff" },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.72)", marginTop: 3 },

  paper: { borderRadius: 12, padding: theme.spacing(3), marginBottom: theme.spacing(2) },

  filterRow: { display: "flex", gap: theme.spacing(2), flexWrap: "wrap", alignItems: "flex-end", marginTop: 16 },
  sliderBox: { minWidth: 220, flex: 1, marginTop: 8 },

  runningPulse: {
    animation: "$pulse 1.5s ease-in-out infinite",
    color: "#1565c0",
  },
  "@keyframes pulse": {
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.4 },
  },

  jobCard: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    cursor: "pointer",
    border: "1.5px solid transparent",
    transition: "background 0.1s, border-color 0.15s",
    marginBottom: 6,
    "&:hover": { background: theme.palette.action.hover },
  },
  jobCardActive: {
    borderColor: theme.palette.primary.main,
    background: theme.palette.type === "dark" ? "rgba(25,118,210,0.1)" : "rgba(25,118,210,0.06)",
  },
  jobMeta: { fontSize: 12, color: theme.palette.text.secondary, flex: 1, minWidth: 0 },
  jobName: { fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  jobTime: { fontSize: 10, color: theme.palette.text.disabled, whiteSpace: "nowrap" },
  jobLeads: { fontSize: 11, fontWeight: 700, color: theme.palette.text.secondary, whiteSpace: "nowrap" },

  resultsHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 16,
  },
  progressBox: { marginBottom: 20 },
  progressLabel: { display: "flex", justifyContent: "space-between", marginBottom: 6 },

  tableContainer: { maxHeight: 440, overflow: "auto", borderRadius: 8, border: `1px solid ${theme.palette.divider}` },
  stickyHead: { position: "sticky", top: 0, background: theme.palette.background.paper, zIndex: 1 },

  importBar: {
    display: "flex", gap: theme.spacing(2), alignItems: "center",
    flexWrap: "wrap", padding: "16px 0 0",
  },

  rating: { color: "#f59e0b", fontWeight: 700, fontSize: 12 },

  emptyResults: {
    textAlign: "center", padding: "48px 24px",
    color: theme.palette.text.secondary,
  },
  emptyResultsIcon: { fontSize: 56, opacity: 0.18, marginBottom: 8 },

  sourceBadge: {
    display: "inline-flex", alignItems: "center", gap: 4,
    background: theme.palette.type === "dark" ? "#1e2a3a" : "#e8f4fd",
    color: theme.palette.primary.main,
    borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
  },
}));

function timeAgo(d) {
  if (!d) return "";
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Stars({ value }) {
  if (!value) return <span>—</span>;
  const r = Math.round(parseFloat(value));
  return (
    <span title={value} style={{ letterSpacing: -1 }}>
      {"★".repeat(Math.min(r, 5))}
      <span style={{ opacity: 0.25 }}>{"★".repeat(Math.max(0, 5 - r))}</span>
      <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>{value}</span>
    </span>
  );
}

function TabPanel({ children, value, index }) {
  return value === index ? <Box>{children}</Box> : null;
}

export default function LeadScraper() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [contactListName, setContactListName] = useState("");
  const [tagName, setTagName] = useState("");
  const pollRef = useRef(null);

  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("SP");
  const [maxResults, setMaxResults] = useState(50);
  const [cnpjText, setCnpjText] = useState("");

  const loadJobs = useCallback(async () => {
    try {
      const { data } = await api.get("/lead-scraper/jobs");
      setJobs(data);
    } catch {}
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const startPoll = useCallback((jobId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/lead-scraper/jobs/${jobId}`);
        setActiveJob(data);
        setSelectedIndices([]);
        if (data.status === "done" || data.status === "error") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          loadJobs();
        }
      } catch {}
    }, 2500);
  }, [loadJobs]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startMapsJob = async () => {
    if (!keyword.trim() || !city.trim()) { toast.warning("Preencha a palavra-chave e a cidade."); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/lead-scraper/jobs", {
        source: "google_maps", filters: { keyword, city, state, maxResults }
      });
      setActiveJob(data);
      setSelectedIndices([]);
      toast.success("Busca iniciada! Acompanhe o progresso ao lado.");
      startPoll(data.id);
      loadJobs();
    } catch { toast.error("Erro ao iniciar busca."); }
    finally { setLoading(false); }
  };

  const startCnpjJob = async () => {
    const cnpjs = cnpjText.split(/[\n,;]+/).map(s => s.replace(/\D/g, "")).filter(s => s.length === 14);
    if (!cnpjs.length) { toast.warning("Insira ao menos um CNPJ válido (14 dígitos)."); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/lead-scraper/jobs", { source: "cnpj", filters: { cnpjs } });
      setActiveJob(data);
      setSelectedIndices([]);
      toast.success(`Enriquecendo ${cnpjs.length} CNPJs…`);
      startPoll(data.id);
      loadJobs();
    } catch { toast.error("Erro ao iniciar enriquecimento."); }
    finally { setLoading(false); }
  };

  const importSelected = async () => {
    if (!activeJob?.id) return;
    const indices = selectedIndices.length
      ? selectedIndices
      : (activeJob.results || []).map((_, i) => i);
    if (!indices.length) { toast.warning("Nenhum lead para importar."); return; }
    setLoading(true);
    try {
      const { data } = await api.post(`/lead-scraper/jobs/${activeJob.id}/import`, {
        indices, contactListName: contactListName || undefined, tagName: tagName || undefined,
      });
      toast.success(`✓ ${data.created} criados · ${data.updated} atualizados`);
    } catch { toast.error("Erro ao importar leads."); }
    finally { setLoading(false); }
  };

  const toggleSelect = (i) =>
    setSelectedIndices(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  const toggleAll = () => {
    const total = (activeJob?.results || []).length;
    setSelectedIndices(prev => prev.length === total ? [] : (activeJob.results || []).map((_, i) => i));
  };

  const selectJob = async (j) => {
    const { data } = await api.get(`/lead-scraper/jobs/${j.id}`);
    setActiveJob(data);
    setSelectedIndices([]);
    if (data.status === "running" || data.status === "pending") startPoll(data.id);
  };

  const results = activeJob?.results || [];
  const allSelected = results.length > 0 && selectedIndices.length === results.length;
  const someSelected = selectedIndices.length > 0;
  const isRunning = activeJob?.status === "running" || activeJob?.status === "pending";

  return (
    <Box className={classes.root}>
      {/* ── Hero ── */}
      <Box className={classes.hero}>
        <LeadIcon className={classes.heroIcon} />
        <Box>
          <Typography className={classes.heroTitle}>Captador de Leads</Typography>
          <Typography className={classes.heroSub}>
            Busque empresas via Google Maps ou enriqueça CNPJs pela Receita Federal (BrasilAPI)
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2}>
        {/* ── Left: form ── */}
        <Grid item xs={12} md={7}>
          <Paper className={classes.paper} elevation={0} variant="outlined">
            <Tabs value={tab} onChange={(_, v) => setTab(v)} indicatorColor="primary" textColor="primary">
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><MapsIcon fontSize="small" /> Google Maps</Box>} />
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><CnpjIcon fontSize="small" /> CNPJ / Receita Federal</Box>} />
            </Tabs>

            <TabPanel value={tab} index={0}>
              <Box className={classes.filterRow}>
                <TextField
                  label="Palavra-chave" placeholder="academias de ginástica"
                  value={keyword} onChange={e => setKeyword(e.target.value)}
                  variant="outlined" size="small" style={{ flex: 2, minWidth: 180 }}
                />
                <TextField
                  label="Cidade" placeholder="São Paulo"
                  value={city} onChange={e => setCity(e.target.value)}
                  variant="outlined" size="small" style={{ flex: 1, minWidth: 130 }}
                />
                <FormControl variant="outlined" size="small" style={{ minWidth: 80 }}>
                  <InputLabel>UF</InputLabel>
                  <Select value={state} onChange={e => setState(e.target.value)} label="UF">
                    {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
              <Box className={classes.sliderBox}>
                <Typography variant="body2" style={{ marginBottom: 6 }}>
                  Máximo de resultados: <strong>{maxResults}</strong>
                </Typography>
                <Slider
                  value={maxResults} onChange={(_, v) => setMaxResults(v)}
                  min={10} max={200} step={10}
                  marks={[{ value: 10, label: "10" }, { value: 100, label: "100" }, { value: 200, label: "200" }]}
                />
              </Box>
              <Box mt={2}>
                <Button
                  variant="contained" color="primary"
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
                  onClick={startMapsJob} disabled={loading}
                  style={{ textTransform: "none", fontWeight: 600 }}
                >
                  Iniciar Busca no Maps
                </Button>
              </Box>
            </TabPanel>

            <TabPanel value={tab} index={1}>
              <Box mt={2}>
                <Typography variant="body2" color="textSecondary" style={{ marginBottom: 10 }}>
                  Cole CNPJs (um por linha, vírgula ou ponto-e-vírgula).
                  O sistema consultará a Receita Federal via BrasilAPI.
                </Typography>
                <TextField
                  multiline rows={8} fullWidth variant="outlined"
                  placeholder={"00.000.000/0001-00\n11.111.111/0001-11"}
                  value={cnpjText} onChange={e => setCnpjText(e.target.value)}
                  helperText={
                    cnpjText
                      ? `${cnpjText.split(/[\n,;]+/).map(s => s.replace(/\D/g, "")).filter(s => s.length === 14).length} CNPJs válidos detectados`
                      : "Informe CNPJs para enriquecer com dados da RF"
                  }
                />
              </Box>
              <Box mt={2}>
                <Button
                  variant="contained" color="primary"
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CnpjIcon />}
                  onClick={startCnpjJob} disabled={loading}
                  style={{ textTransform: "none", fontWeight: 600 }}
                >
                  Enriquecer CNPJs
                </Button>
              </Box>
            </TabPanel>
          </Paper>
        </Grid>

        {/* ── Right: jobs history ── */}
        <Grid item xs={12} md={5}>
          <Paper className={classes.paper} elevation={0} variant="outlined" style={{ minHeight: 200 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" style={{ marginBottom: 12 }}>
              <Typography variant="subtitle1" style={{ fontWeight: 700 }}>Histórico de Buscas</Typography>
              <Tooltip title="Recarregar">
                <IconButton size="small" onClick={loadJobs}><RefreshIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Box>

            {jobs.length === 0 ? (
              <Box textAlign="center" py={4}>
                <LeadIcon style={{ fontSize: 40, opacity: 0.18, marginBottom: 8 }} />
                <Typography variant="body2" color="textSecondary">Nenhuma busca iniciada ainda.</Typography>
              </Box>
            ) : (
              jobs.map(j => {
                const st = STATUS[j.status] || STATUS.pending;
                const isActive = activeJob?.id === j.id;
                const jobName = j.source === "google_maps"
                  ? `${j.filters?.keyword || "?"} — ${j.filters?.city || "?"} ${j.filters?.state || ""}`
                  : `${j.filters?.cnpjs?.length || 0} CNPJs`;
                return (
                  <Box
                    key={j.id}
                    className={`${classes.jobCard} ${isActive ? classes.jobCardActive : ""}`}
                    onClick={() => selectJob(j)}
                  >
                    {j.status === "running" ? (
                      <DotIcon className={classes.runningPulse} style={{ fontSize: 12 }} />
                    ) : (
                      <Box style={{ width: 10, height: 10, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
                    )}
                    <Box className={classes.jobMeta} style={{ flex: 1, minWidth: 0 }}>
                      <Typography className={classes.jobName}>{jobName}</Typography>
                      <Typography className={classes.jobTime}>{timeAgo(j.createdAt)}</Typography>
                    </Box>
                    <Box textAlign="right" style={{ flexShrink: 0 }}>
                      <Chip
                        label={st.label}
                        size="small"
                        style={{ background: st.bg, color: st.color, fontWeight: 700, fontSize: 10, height: 20 }}
                      />
                      <Typography className={classes.jobLeads} style={{ marginTop: 2 }}>
                        {j.totalFound || 0} leads
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* ── Active job results ── */}
      {activeJob && (
        <Paper className={classes.paper} elevation={0} variant="outlined">
          <Box className={classes.resultsHeader}>
            <Box display="flex" alignItems="center" style={{ gap: 12 }}>
              <Typography variant="h6" style={{ fontWeight: 700 }}>Resultados</Typography>
              <Box className={classes.sourceBadge}>
                {activeJob.source === "google_maps" ? <MapsIcon style={{ fontSize: 12 }} /> : <CnpjIcon style={{ fontSize: 12 }} />}
                {activeJob.source === "google_maps" ? "Google Maps" : "Receita Federal"}
              </Box>
              <Chip
                label={STATUS[activeJob.status]?.label || activeJob.status}
                size="small"
                style={{
                  background: STATUS[activeJob.status]?.bg || "#f5f5f5",
                  color: STATUS[activeJob.status]?.color || "#757575",
                  fontWeight: 700, fontSize: 11,
                }}
              />
            </Box>
            <Typography variant="body2" color="textSecondary" style={{ fontWeight: 600 }}>
              {activeJob.totalFound || 0} leads encontrados
            </Typography>
          </Box>

          {isRunning && (
            <Box className={classes.progressBox}>
              <Box className={classes.progressLabel}>
                <Typography variant="caption" color="textSecondary">Buscando…</Typography>
                <Typography variant="caption" style={{ fontWeight: 700 }}>{activeJob.progress || 0}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={activeJob.progress || 0}
                style={{ borderRadius: 4, height: 6 }}
              />
            </Box>
          )}

          {activeJob.status === "error" && (
            <Box style={{ background: "#fce4ec", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
              <Typography style={{ color: "#c62828", fontSize: 13 }}>
                ⚠ {activeJob.errorMessage || "Erro desconhecido na busca"}
              </Typography>
            </Box>
          )}

          {results.length === 0 && !isRunning ? (
            <Box className={classes.emptyResults}>
              <SearchIcon className={classes.emptyResultsIcon} />
              <Typography variant="subtitle1">Nenhum resultado encontrado</Typography>
              <Typography variant="body2">Tente ajustar os filtros ou expandir a área de busca.</Typography>
            </Box>
          ) : results.length > 0 ? (
            <>
              <Box className={classes.tableContainer}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" className={classes.stickyHead}>
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected && !allSelected}
                          onChange={toggleAll}
                          size="small"
                        />
                      </TableCell>
                      <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>NOME</TableCell>
                      <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>TELEFONE</TableCell>
                      <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>ENDEREÇO</TableCell>
                      <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>CNPJ</TableCell>
                      <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>AVALIAÇÃO</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((r, i) => (
                      <TableRow key={i} hover selected={selectedIndices.includes(i)}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIndices.includes(i)}
                            onChange={() => toggleSelect(i)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" style={{ fontWeight: 600, fontSize: 12 }}>
                            {r.nomeFantasia || r.name || "—"}
                          </Typography>
                          {r.razaoSocial && r.razaoSocial !== r.name && (
                            <Typography variant="caption" color="textSecondary" style={{ display: "block" }}>
                              {r.razaoSocial}
                            </Typography>
                          )}
                          {r.email && (
                            <Typography variant="caption" color="textSecondary" style={{ display: "block" }}>
                              {r.email}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" style={{ fontSize: 12 }}>{r.phone || "—"}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" style={{ fontSize: 12 }}>
                            {r.address || (r.municipio ? `${r.municipio}/${r.uf}` : "—")}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" style={{ fontSize: 11, fontFamily: "monospace" }}>
                            {r.cnpj
                              ? r.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
                              : r.website
                                ? <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>site</a>
                                : "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <span className={classes.rating}><Stars value={r.rating} /></span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              <Divider style={{ margin: "16px 0" }} />

              <Box className={classes.importBar}>
                <TextField
                  label="Lista de contatos"
                  size="small" variant="outlined"
                  value={contactListName} onChange={e => setContactListName(e.target.value)}
                  placeholder="ex: Leads Google Maps Jun/26"
                  style={{ minWidth: 220 }}
                />
                <TextField
                  label="Tag"
                  size="small" variant="outlined"
                  value={tagName} onChange={e => setTagName(e.target.value)}
                  placeholder="ex: google-maps"
                  style={{ minWidth: 130 }}
                />
                <Button
                  variant="contained" color="primary"
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <ImportIcon />}
                  onClick={importSelected}
                  disabled={loading || activeJob.status !== "done"}
                  style={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  {someSelected
                    ? `Importar ${selectedIndices.length} lead${selectedIndices.length !== 1 ? "s" : ""}`
                    : `Importar todos (${results.length})`}
                </Button>
              </Box>
            </>
          ) : null}
        </Paper>
      )}
    </Box>
  );
}
