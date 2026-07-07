import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Autocomplete from "@material-ui/lab/Autocomplete";
import CNAES from "../../data/cnaeList";
import NJS from "../../data/naturezaJuridicaList";
import {
  Box, Paper, Typography, Tabs, Tab, TextField, Button, Slider,
  Select, MenuItem, FormControl, InputLabel, LinearProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
  Chip, IconButton, Tooltip, CircularProgress, Divider, Grid,
  FormControlLabel, Collapse,
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
  FilterList as FilterIcon,
  PeopleOutlined as FollowersIcon,
  HelpOutline as HelpIcon,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";
import MainContainer from "../../components/MainContainer";
import InstagramSessionModal from "../../components/InstagramSessionModal";

const STATUS = {
  done:    { label: "Concluído",  bg: "#e8f5e9", color: "#2e7d32" },
  running: { label: "Executando", bg: "#e3f2fd", color: "#1565c0" },
  error:   { label: "Erro",       bg: "#fce4ec", color: "#c62828" },
  pending: { label: "Aguardando", bg: "#f5f5f5", color: "#757575" },
};

const SOCIAL_LINKS = {
  instagram: h => `https://instagram.com/${h}`,
  twitter:   h => `https://x.com/${h}`,
  linkedin:  h => `https://linkedin.com/company/${h}`,
};
const SOCIAL_COLORS = { instagram: "#e1306c", twitter: "#000", linkedin: "#0a66c2" };
const SOCIAL_LABELS = { instagram: "IG", twitter: "X", linkedin: "LI" };

const STATES = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const useStyles = makeStyles(theme => ({
  root: { padding: theme.spacing(3) },

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

  modeToggle: {
    display: "flex", gap: 0, marginTop: 16, marginBottom: 4,
    borderRadius: 8, overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    width: "fit-content",
  },
  modeBtn: {
    textTransform: "none", fontWeight: 500, fontSize: 13,
    borderRadius: 0, padding: "5px 16px",
    border: "none",
    "&:hover": { background: theme.palette.action.hover },
  },
  modeBtnActive: {
    background: theme.palette.primary.main,
    color: "#fff",
    "&:hover": { background: theme.palette.primary.dark },
  },

  searchGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: theme.spacing(1.5), marginTop: 16 },
  fullRow: { gridColumn: "1 / -1" },
  checkRow: {
    gridColumn: "1 / -1",
    display: "flex", flexWrap: "wrap", gap: theme.spacing(1), alignItems: "center",
  },

  infoNote: {
    background: theme.palette.type === "dark" ? "#1a2a1a" : "#f0fdf4",
    border: `1px solid ${theme.palette.type === "dark" ? "#2d4a2d" : "#bbf7d0"}`,
    borderRadius: 8, padding: "8px 12px",
    fontSize: 12, color: theme.palette.type === "dark" ? "#86efac" : "#166534",
    gridColumn: "1 / -1", lineHeight: 1.5,
  },
  helpToggle: {
    display: "flex", alignItems: "center", gap: 4,
    cursor: "pointer", userSelect: "none",
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 14,
    width: "fit-content",
    "&:hover": { color: theme.palette.primary.main },
  },
  helpBox: {
    background: theme.palette.type === "dark" ? "#1a2233" : "#f0f7ff",
    border: `1px solid ${theme.palette.type === "dark" ? "#2d3f5a" : "#bfdbfe"}`,
    borderRadius: 10, padding: "14px 16px",
    marginTop: 12,
    fontSize: 13,
    color: theme.palette.type === "dark" ? "#93c5fd" : "#1e3a5f",
    lineHeight: 1.7,
    "& ol": { margin: "6px 0 0 0", paddingLeft: 20 },
    "& li": { marginBottom: 4 },
    "& strong": { color: theme.palette.type === "dark" ? "#bfdbfe" : "#1d4ed8" },
    "& code": {
      background: theme.palette.type === "dark" ? "#0f1e33" : "#dbeafe",
      borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 12,
    },
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [contactListName, setContactListName] = useState("");
  const [tagName, setTagName] = useState("");
  const [igSession, setIgSession] = useState(null); // { username, status } or null
  const [igModalOpen, setIgModalOpen] = useState(false);
  const pollRef = useRef(null);

  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("SP");
  const [maxResults, setMaxResults] = useState(50);
  const [cnpjText, setCnpjText] = useState("");

  // ig_followers state
  const [igTargetHandle, setIgTargetHandle] = useState("");
  const [igMaxFollowers, setIgMaxFollowers] = useState(500);

  // CNPJ discovery mode
  const [cnpjMode, setCnpjMode] = useState("enrich"); // "enrich" | "search"
  const [srKeyword, setSrKeyword] = useState("");
  const [srCnae, setSrCnae] = useState(null);   // { code, label } | null
  const [srNj, setSrNj] = useState(null);        // { code, label } | null — Natureza Jurídica
  const [srSituacao, setSrSituacao] = useState("ATIVA");
  const [srUf, setSrUf] = useState("");
  const [srMunicipio, setSrMunicipio] = useState("");
  const [srTemTelefone, setSrTemTelefone] = useState(false);
  const [srTemEmail, setSrTemEmail] = useState(false);
  const [srMaxResults, setSrMaxResults] = useState(200);

  const loadJobs = useCallback(async () => {
    try {
      const { data } = await api.get("/lead-scraper/jobs");
      setJobs(data);
    } catch {}
  }, []);

  const loadIgStatus = useCallback(async () => {
    try {
      const { data } = await api.get("/instagram-session/status");
      setIgSession(data.status === "none" ? null : data);
    } catch {}
  }, []);

  useEffect(() => { loadJobs(); loadIgStatus(); }, [loadJobs, loadIgStatus]);

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

  const startFollowersJob = async () => {
    if (!igTargetHandle.trim()) { toast.warning("Informe o @ da conta alvo."); return; }
    if (!igSession || igSession.status !== "active") {
      toast.warning("Conecte uma conta Instagram primeiro (botão 📸 no topo).");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/lead-scraper/jobs", {
        source: "ig_followers",
        filters: { igTargetHandle: igTargetHandle.replace(/^@/, ""), maxResults: igMaxFollowers },
      });
      setActiveJob(data);
      setSelectedIndices([]);
      toast.success(`Buscando seguidores de @${igTargetHandle}…`);
      startPoll(data.id);
      loadJobs();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao iniciar busca.");
    } finally { setLoading(false); }
  };

  const startCnpjSearchJob = async () => {
    if (!srKeyword.trim() && !srUf && !srMunicipio.trim()) {
      toast.warning("Informe ao menos: palavra-chave no nome, UF ou município.");
      return;
    }
    setLoading(true);
    try {
      const filters = {
        keyword: srKeyword.trim() || undefined,
        cnae: srCnae?.code || undefined,
        naturezaJuridica: srNj?.code || undefined,
        situacao: srSituacao || undefined,
        uf: srUf || undefined,
        municipio: srMunicipio.trim() || undefined,
        temTelefone: srTemTelefone || undefined,
        temEmail: srTemEmail || undefined,
        maxResults: srMaxResults,
      };
      const { data } = await api.post("/lead-scraper/jobs", { source: "cnpj_search", filters });
      setActiveJob(data);
      setSelectedIndices([]);
      toast.success("Pesquisa iniciada! Acompanhe o progresso ao lado.");
      startPoll(data.id);
      loadJobs();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao iniciar pesquisa.");
    }
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
    <MainContainer useWindowScroll>
    <Box className={classes.root}>
      {/* ── Hero ── */}
      <Box className={classes.hero}>
        <LeadIcon className={classes.heroIcon} />
        <Box style={{ flex: 1 }}>
          <Typography className={classes.heroTitle}>Captador de Leads</Typography>
          <Typography className={classes.heroSub}>
            Busque empresas via Google Maps ou enriqueça CNPJs pela Receita Federal (BrasilAPI)
          </Typography>
        </Box>
        {/* Instagram session badge */}
        <Tooltip title={igSession?.status === "active" ? `Instagram conectado como @${igSession.username}` : "Conectar conta Instagram para capturar telefones e e-mails de perfis business"}>
          <Button
            size="small"
            onClick={() => setIgModalOpen(true)}
            style={{
              textTransform: "none",
              background: igSession?.status === "active" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
              color: "#fff",
              border: `1px solid ${igSession?.status === "active" ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 8,
              padding: "4px 12px",
              fontSize: 12,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            📸 {igSession?.status === "active" ? `@${igSession.username}` : "Conectar Instagram"}
          </Button>
        </Tooltip>
      </Box>

      {/* Instagram session expired warning */}
      {igSession?.status === "expired" && (
        <Box style={{
          background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8,
          padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12,
        }}>
          <Typography variant="body2" style={{ color: "#92400e", flex: 1 }}>
            ⚠ Sessão do Instagram expirou — telefones de bio não serão coletados até reconectar.
          </Typography>
          <Button size="small" onClick={() => setIgModalOpen(true)} style={{ textTransform: "none", color: "#92400e", fontWeight: 600 }}>
            Reconectar
          </Button>
        </Box>
      )}

      <InstagramSessionModal
        open={igModalOpen}
        onClose={() => { setIgModalOpen(false); loadIgStatus(); }}
      />

      <Grid container spacing={2}>
        {/* ── Left: form ── */}
        <Grid item xs={12} md={7}>
          <Paper className={classes.paper} elevation={0} variant="outlined">
            <Tabs value={tab} onChange={(_, v) => { setTab(v); setHelpOpen(false); }} indicatorColor="primary" textColor="primary">
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><MapsIcon fontSize="small" /> Google Maps</Box>} />
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><CnpjIcon fontSize="small" /> CNPJ / Receita Federal</Box>} />
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><FollowersIcon fontSize="small" /> Seguidores IG</Box>} />
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
              <Box className={classes.helpToggle} onClick={() => setHelpOpen(o => !o)}>
                <HelpIcon style={{ fontSize: 15 }} />
                <span>{helpOpen ? "Ocultar tutorial" : "Como usar esta aba?"}</span>
              </Box>
              <Collapse in={helpOpen}>
                <Box className={classes.helpBox}>
                  <strong>Como funciona — Busca no Google Maps</strong>
                  <ol>
                    <li>Digite a <strong>categoria de negócio</strong> que você quer prospectar. Exemplos: <em>"academias de ginástica"</em>, <em>"clínicas odontológicas"</em>, <em>"distribuidoras de alimentos"</em>.</li>
                    <li>Informe a <strong>cidade</strong> e selecione o <strong>estado (UF)</strong>. A busca combina os dois para focar geograficamente.</li>
                    <li>Ajuste o <strong>máximo de resultados</strong> (10 a 200). Mais resultados = mais tempo de processamento.</li>
                    <li>Clique em <strong>Iniciar Busca no Maps</strong>. O sistema extrai nome, telefone, e-mail, endereço, site e avaliação de cada empresa.</li>
                    <li>Ao atingir <strong>90% do progresso</strong>, começa o enriquecimento automático de redes sociais (Instagram, X, LinkedIn) para cada lead encontrado.</li>
                    <li>Para capturar telefones do botão "Contato" do Instagram, conecte uma conta via <strong>📸 Conectar Instagram</strong> no topo da página.</li>
                    <li>Após o status virar <strong>Concluído</strong>, selecione os leads na tabela e clique em <strong>Importar</strong> para salvá-los na sua lista de contatos.</li>
                  </ol>
                  <Box mt={1} style={{ fontSize: 12, opacity: 0.8 }}>
                    💡 Dica: use palavras em português e sem abreviações. "salão de beleza" funciona melhor que "beauty salon".
                  </Box>
                </Box>
              </Collapse>
            </TabPanel>

            <TabPanel value={tab} index={1}>
              {/* Mode toggle */}
              <Box className={classes.modeToggle}>
                <Button
                  className={`${classes.modeBtn} ${cnpjMode === "enrich" ? classes.modeBtnActive : ""}`}
                  onClick={() => setCnpjMode("enrich")}
                  startIcon={<CnpjIcon fontSize="small" />}
                >
                  Enriquecer CNPJs
                </Button>
                <Button
                  className={`${classes.modeBtn} ${cnpjMode === "search" ? classes.modeBtnActive : ""}`}
                  onClick={() => setCnpjMode("search")}
                  startIcon={<FilterIcon fontSize="small" />}
                >
                  Pesquisa Avançada
                </Button>
              </Box>

              {cnpjMode === "enrich" && (
                <Box mt={2}>
                  <Typography variant="body2" color="textSecondary" style={{ marginBottom: 10 }}>
                    Cole CNPJs (um por linha, vírgula ou ponto-e-vírgula).
                    O sistema consultará a Receita Federal via BrasilAPI.
                  </Typography>
                  <TextField
                    multiline minRows={6} fullWidth variant="outlined"
                    placeholder={"00.000.000/0001-00\n11.111.111/0001-11"}
                    value={cnpjText} onChange={e => setCnpjText(e.target.value)}
                    helperText={
                      cnpjText
                        ? `${cnpjText.split(/[\n,;]+/).map(s => s.replace(/\D/g, "")).filter(s => s.length === 14).length} CNPJs válidos detectados`
                        : "Informe CNPJs para enriquecer com dados da RF"
                    }
                  />
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
                  <Box className={classes.helpToggle} onClick={() => setHelpOpen(o => !o)}>
                    <HelpIcon style={{ fontSize: 15 }} />
                    <span>{helpOpen ? "Ocultar tutorial" : "Como usar esta aba?"}</span>
                  </Box>
                  <Collapse in={helpOpen}>
                    <Box className={classes.helpBox}>
                      <strong>Como funciona — Enriquecimento de CNPJs</strong>
                      <ol>
                        <li>Cole os CNPJs que você já possui no campo de texto — aceita um por linha, separados por vírgula ou ponto-e-vírgula. Formatação com pontos e traços é suportada.</li>
                        <li>O contador abaixo do campo mostra quantos CNPJs válidos foram detectados (14 dígitos). CNPJs inválidos são ignorados automaticamente.</li>
                        <li>Clique em <strong>Enriquecer CNPJs</strong>. Cada CNPJ é consultado na <strong>Receita Federal via BrasilAPI</strong> (sem custo, sem cadastro).</li>
                        <li>Dados obtidos: razão social, nome fantasia, CNAE, situação, porte, telefone, e-mail e endereço completo.</li>
                        <li>Após os dados da RF, o sistema enriquece automaticamente com <strong>Instagram, X e LinkedIn</strong> de cada empresa.</li>
                        <li>Selecione os leads na tabela e clique em <strong>Importar</strong> para adicioná-los à sua lista de contatos.</li>
                      </ol>
                      <Box mt={1} style={{ fontSize: 12, opacity: 0.8 }}>
                        💡 Dica: você pode obter listas de CNPJs em portais como <em>brasil.io</em>, <em>dados.gov.br</em> ou exportando de sistemas internos.
                      </Box>
                    </Box>
                  </Collapse>
                </Box>
              )}

              {cnpjMode === "search" && (
                <Box className={classes.searchGrid}>
                  <Box className={classes.infoNote}>
                    Busca empresas via <strong>brasil.io + cnpj.ws</strong> (gratuito).
                    Pesquisa por nome da empresa + UF → enriquece CNAE, telefone, e-mail via cnpj.ws.
                    Requer <strong>BRASILIO_TOKEN</strong> no .env.
                  </Box>

                  <TextField
                    label="Palavra-chave no nome da empresa *" placeholder="ex: academia, padaria, farmácia"
                    value={srKeyword} onChange={e => setSrKeyword(e.target.value)}
                    variant="outlined" size="small"
                    helperText="Busca no nome/razão social das empresas (obrigatório se sem UF/município)"
                    className={classes.fullRow}
                  />

                  {/* CNAE Autocomplete */}
                  <Autocomplete
                    options={CNAES}
                    getOptionLabel={opt => opt.label}
                    value={srCnae}
                    onChange={(_, val) => setSrCnae(val)}
                    filterOptions={(opts, { inputValue }) => {
                      const q = inputValue.toLowerCase();
                      return q.length < 2 ? opts.slice(0, 80) : opts.filter(o => o.label.toLowerCase().includes(q)).slice(0, 80);
                    }}
                    renderInput={params => (
                      <TextField {...params} label="CNAE (atividade)" variant="outlined" size="small"
                        placeholder="Digite código ou descrição..." helperText="Filtra pós-busca pelo CNAE principal" />
                    )}
                    noOptionsText="Nenhum CNAE encontrado"
                    clearOnEscape
                  />

                  {/* Natureza Jurídica Autocomplete */}
                  <Autocomplete
                    options={NJS}
                    getOptionLabel={opt => opt.label}
                    value={srNj}
                    onChange={(_, val) => setSrNj(val)}
                    filterOptions={(opts, { inputValue }) => {
                      const q = inputValue.toLowerCase();
                      return q.length < 2 ? opts : opts.filter(o => o.label.toLowerCase().includes(q));
                    }}
                    renderInput={params => (
                      <TextField {...params} label="Natureza Jurídica" variant="outlined" size="small"
                        placeholder="Ex: Limitada, SA, Individual..." helperText="Filtra pós-busca pelo tipo jurídico" />
                    )}
                    noOptionsText="Nenhuma natureza encontrada"
                    clearOnEscape
                  />

                  <FormControl variant="outlined" size="small">
                    <InputLabel>Situação</InputLabel>
                    <Select value={srSituacao} onChange={e => setSrSituacao(e.target.value)} label="Situação">
                      <MenuItem value="ATIVA">Ativa</MenuItem>
                      <MenuItem value="SUSPENSA">Suspensa</MenuItem>
                      <MenuItem value="INAPTA">Inapta</MenuItem>
                      <MenuItem value="BAIXADA">Baixada</MenuItem>
                      <MenuItem value="">Todas</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl variant="outlined" size="small">
                    <InputLabel>UF</InputLabel>
                    <Select value={srUf} onChange={e => setSrUf(e.target.value)} label="UF">
                      <MenuItem value="">Todas</MenuItem>
                      {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Município (pós-filtro)" placeholder="ex: São Paulo"
                    value={srMunicipio} onChange={e => setSrMunicipio(e.target.value)}
                    variant="outlined" size="small"
                    helperText="Filtra pela cidade nos dados do cnpj.ws"
                  />

                  <Box className={classes.checkRow}>
                    <FormControlLabel
                      control={<Checkbox size="small" checked={srTemTelefone} onChange={e => setSrTemTelefone(e.target.checked)} />}
                      label={<Typography variant="body2">Apenas com telefone</Typography>}
                    />
                    <FormControlLabel
                      control={<Checkbox size="small" checked={srTemEmail} onChange={e => setSrTemEmail(e.target.checked)} />}
                      label={<Typography variant="body2">Apenas com e-mail</Typography>}
                    />
                  </Box>

                  <Box className={classes.fullRow}>
                    <Typography variant="body2" style={{ marginBottom: 6 }}>
                      Máximo de resultados: <strong>{srMaxResults}</strong>
                      <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.6 }}>
                        (~{Math.ceil(srMaxResults * 0.6 / 60)}–{Math.ceil(srMaxResults / 60)} min)
                      </span>
                    </Typography>
                    <Slider
                      value={srMaxResults} onChange={(_, v) => setSrMaxResults(v)}
                      min={10} max={200} step={10}
                      marks={[{ value: 10, label: "10" }, { value: 100, label: "100" }, { value: 200, label: "200" }]}
                    />
                  </Box>

                  <Box className={classes.fullRow}>
                    <Button
                      variant="contained" color="primary"
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
                      onClick={startCnpjSearchJob} disabled={loading}
                      style={{ textTransform: "none", fontWeight: 600 }}
                    >
                      Pesquisar CNPJs
                    </Button>
                  </Box>

                  <Box className={`${classes.fullRow}`}>
                    <Box className={classes.helpToggle} onClick={() => setHelpOpen(o => !o)}>
                      <HelpIcon style={{ fontSize: 15 }} />
                      <span>{helpOpen ? "Ocultar tutorial" : "Como usar esta aba?"}</span>
                    </Box>
                    <Collapse in={helpOpen}>
                      <Box className={classes.helpBox}>
                        <strong>Como funciona — Pesquisa Avançada de CNPJs</strong>
                        <ol>
                          <li><strong>Pré-requisito:</strong> obtenha seu token gratuito em <code>brasil.io/auth/tokens/</code> (login com Google ou e-mail) e adicione no arquivo <code>.env</code> do servidor: <code>BRASILIO_TOKEN=seu_token_aqui</code></li>
                          <li>Informe ao menos um filtro: <strong>CNAE</strong>, <strong>UF</strong> ou <strong>Município</strong>. Combinar filtros reduz o resultado e melhora a qualidade dos leads.</li>
                          <li><strong>CNAE</strong>: código de 7 dígitos da atividade principal. Ex: <code>4711301</code> = supermercados. Consulte em <code>cnae.ibge.gov.br</code>.</li>
                          <li><strong>Situação</strong>: use "Ativa" para empresas em funcionamento. "Baixada" e "Inapta" geralmente não são leads qualificados.</li>
                          <li><strong>Tipo Matriz/Filial</strong>: "Apenas Matriz" evita duplicatas para redes com várias unidades.</li>
                          <li>Marque <strong>"Apenas com telefone"</strong> ou <strong>"Apenas com e-mail"</strong> para filtrar leads com dados de contato já cadastrados na Receita Federal.</li>
                          <li>Ajuste o <strong>máximo de resultados</strong> (50–1000). Cada resultado consome uma chamada à API do brasil.io.</li>
                          <li>Após a coleta, o sistema enriquece automaticamente com <strong>Instagram, X e LinkedIn</strong> de cada empresa.</li>
                        </ol>
                        <Box mt={1} style={{ fontSize: 12, opacity: 0.8 }}>
                          💡 Dica: o brasil.io permite 30.000 req/dia no plano gratuito. Uma pesquisa com 1000 resultados consome ~10 requisições (paginação de 100).
                        </Box>
                      </Box>
                    </Collapse>
                  </Box>
                </Box>
              )}
            </TabPanel>
            <TabPanel value={tab} index={2}>
              <Box mt={2}>
                {(!igSession || igSession.status !== "active") && (
                  <Box style={{
                    background: "#fef3c7", border: "1px solid #fcd34d",
                    borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13,
                    color: "#92400e",
                  }}>
                    ⚠ Conecte uma conta Instagram primeiro — clique em{" "}
                    <strong style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setIgModalOpen(true)}>
                      📸 Conectar Instagram
                    </strong>{" "}no topo.
                  </Box>
                )}
                <TextField
                  label="@ da conta alvo" placeholder="@concorrente ou @associacao"
                  value={igTargetHandle} onChange={e => setIgTargetHandle(e.target.value)}
                  variant="outlined" size="small" fullWidth
                  helperText="Seguidores desta conta serão coletados e enriquecidos com redes sociais e telefone"
                  style={{ marginBottom: 20 }}
                />
                <Typography variant="body2" style={{ marginBottom: 6 }}>
                  Máximo de seguidores: <strong>{igMaxFollowers.toLocaleString("pt-BR")}</strong>
                </Typography>
                <Slider
                  value={igMaxFollowers} onChange={(_, v) => setIgMaxFollowers(v)}
                  min={50} max={5000} step={50}
                  marks={[
                    { value: 50, label: "50" },
                    { value: 1000, label: "1k" },
                    { value: 5000, label: "5k" },
                  ]}
                />
                <Box mt={2} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <Button
                    variant="contained" color="primary"
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <FollowersIcon />}
                    onClick={startFollowersJob}
                    disabled={loading || !igSession || igSession.status !== "active"}
                    style={{ textTransform: "none", fontWeight: 600 }}
                  >
                    Buscar Seguidores
                  </Button>
                  <Typography variant="caption" color="textSecondary">
                    ~3s entre páginas · contas privadas são ignoradas
                  </Typography>
                </Box>
                <Box className={classes.helpToggle} onClick={() => setHelpOpen(o => !o)}>
                  <HelpIcon style={{ fontSize: 15 }} />
                  <span>{helpOpen ? "Ocultar tutorial" : "Como usar esta aba?"}</span>
                </Box>
                <Collapse in={helpOpen}>
                  <Box className={classes.helpBox}>
                    <strong>Como funciona — Seguidores do Instagram</strong>
                    <ol>
                      <li><strong>Pré-requisito:</strong> conecte uma conta Instagram dedicada clicando em <strong>📸 Conectar Instagram</strong> no topo da página. Use uma conta exclusiva para scraping — não a sua pessoal.</li>
                      <li>Informe o <strong>@ da conta alvo</strong> — pode ser uma associação comercial, concorrente, evento ou nicho de mercado. Ex: <code>@abrasel_sp</code>.</li>
                      <li>A conta alvo precisa ser <strong>pública</strong>. Contas privadas bloqueiam o acesso à lista de seguidores.</li>
                      <li>Ajuste o <strong>limite de seguidores</strong> (50 a 5.000). O sistema coleta em páginas de 50 com ~3s de intervalo para evitar bloqueio.</li>
                      <li>Clique em <strong>Buscar Seguidores</strong>. Para cada seguidor coletado são salvos: username, nome completo e website (se cadastrado no perfil).</li>
                      <li>Após a coleta, o sistema enriquece automaticamente cada perfil com <strong>Instagram, X, LinkedIn</strong> e tenta extrair o <strong>telefone do botão Contato</strong> (para perfis business).</li>
                      <li>Contas privadas aparecem na lista mas são puladas no enriquecimento.</li>
                      <li>Se aparecer o aviso amarelo de <strong>sessão expirada</strong>, reconecte a conta Instagram para retomar o enriquecimento.</li>
                    </ol>
                    <Box mt={1} style={{ fontSize: 12, opacity: 0.8 }}>
                      💡 Dica: use contas com histórico de uso real (pelo menos algumas semanas de idade) para reduzir chances de bloqueio temporário pelo Instagram.
                    </Box>
                  </Box>
                </Collapse>
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
                  : j.source === "cnpj_search"
                    ? `RF: ${j.filters?.cnae || ""} ${j.filters?.uf || ""} ${j.filters?.municipio || ""}`.trim()
                    : j.source === "ig_followers"
                      ? `📸 Seguidores de @${j.filters?.igTargetHandle || "?"}`
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
                {activeJob.source === "google_maps" ? "Google Maps" : activeJob.source === "cnpj_search" ? "RF Pesquisa Avançada" : "Receita Federal"}
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
                <Typography variant="caption" color="textSecondary">
                  {(activeJob.progress || 0) >= 90 ? "Buscando redes sociais (Instagram, X, LinkedIn)…" : "Buscando leads…"}
                </Typography>
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
                      <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>REDES SOCIAIS</TableCell>
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
                          {r.instagramPhone && r.instagramPhone !== r.phone && (
                            <Typography variant="caption" style={{ display: "block", color: SOCIAL_COLORS.instagram, fontSize: 11 }}>
                              📸 {r.instagramPhone}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box display="flex" style={{ gap: 4, flexWrap: "wrap" }}>
                            {["instagram","twitter","linkedin"].map(p =>
                              r[p] ? (
                                <a
                                  key={p}
                                  href={SOCIAL_LINKS[p](r[p])}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    background: SOCIAL_COLORS[p],
                                    color: "#fff",
                                    borderRadius: 4,
                                    padding: "2px 6px",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textDecoration: "none",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {SOCIAL_LABELS[p]}
                                </a>
                              ) : null
                            )}
                            {!r.instagram && !r.twitter && !r.linkedin && (
                              <Typography variant="caption" color="textSecondary">—</Typography>
                            )}
                          </Box>
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
    </MainContainer>
  );
}
