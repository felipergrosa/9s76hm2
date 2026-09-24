import React, { useState, useEffect, useRef, useCallback } from "react";
import Autocomplete from "@material-ui/lab/Autocomplete";
import CNAES from "../../data/cnaeList";
import NJS from "../../data/naturezaJuridicaList";
import SEGMENT_PRESETS from "../../data/leadSegmentPresets";
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
  Instagram as InstagramIcon,
  AccountBalanceOutlined as ConselhoIcon,
  DeleteOutline as DeleteIcon,
  DeleteSweepOutlined as ClearIcon,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";
import MainContainer from "../../components/MainContainer";
import ConfirmationModal from "../../components/ConfirmationModal";
import ApifyTokenModal from "../../components/ApifyTokenModal";
import LeadMapPicker from "../../components/LeadMapPicker";
import useUsersList from "../../hooks/useUsersList";

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

// "5511987654321" → "(11) 98765-4321" | "(11) 3456-7890"; sem dígitos BR retorna como veio
const formatPhoneBR = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  const local = d.startsWith("55") && d.length > 10 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return v || "";
};

const STATES = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

// Somente CAU habilitado por ora; demais conselhos entram como "em breve"
const CONSELHOS = [
  { value: "cau",    label: "CAU — Arquitetura e Urbanismo",        disabled: false },
  { value: "confea", label: "CONFEA/CREA — Engenharia (em breve)",  disabled: true },
  { value: "cfm",    label: "CFM/CRM — Medicina (em breve)",        disabled: true },
  { value: "cro",    label: "CRO — Odontologia (em breve)",         disabled: true },
  { value: "oab",    label: "OAB — Advocacia (em breve)",           disabled: true },
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
  const [confirmDelete, setConfirmDelete] = useState(null); // {type:"job",job} | {type:"all"}
  const [loading, setLoading] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [contactListName, setContactListName] = useState("");
  const [tagName, setTagName] = useState("");
  const [walletUser, setWalletUser] = useState(null); // { id, name } | null
  const [engineStatus, setEngineStatus] = useState(null);
  const [apifyModalOpen, setApifyModalOpen] = useState(false);
  const { users: walletUsers, loadUsersForSelection } = useUsersList(false);
  const pollRef = useRef(null);

  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState([]); // string[] — multi-cidade
  const [state, setState] = useState(["SP"]); // string[] — multi-UF
  const [maxResults, setMaxResults] = useState(50);
  // geo: área escolhida direto no mapa (alternativa a cidade/UF)
  const [mapsMode, setMapsMode] = useState("city"); // "city" | "map"
  const [geo, setGeo] = useState(null);           // { lat, lng } | null
  const [radiusKm, setRadiusKm] = useState(5);
  // listas e tags existentes p/ o Autocomplete da barra de importação
  const [contactLists, setContactLists] = useState([]);
  const [existingTags, setExistingTags] = useState([]);
  const [cnpjText, setCnpjText] = useState("");

  // ig_followers state
  const [igTargetHandle, setIgTargetHandle] = useState("");
  const [igMaxFollowers, setIgMaxFollowers] = useState(500);

  // conselho state
  const [consConselho, setConsConselho] = useState("cau");
  const [consTipo, setConsTipo] = useState("profissional"); // "profissional" | "empresa" | "ambos"
  const [consUf, setConsUf] = useState([]); // string[]
  const [consMunicipio, setConsMunicipio] = useState([]); // string[]
  const [consRegional, setConsRegional] = useState([]); // string[]
  const [consSituacao, setConsSituacao] = useState([]); // string[]
  const [consKeyword, setConsKeyword] = useState("");
  const [consMaxResults, setConsMaxResults] = useState(100);

  // atalhos de segmento (Maps preenche keyword, RF preenche CNAE)
  const [segMaps, setSegMaps] = useState(null);
  const [segRf, setSegRf] = useState(null);

  // último job visto pelo poll — evita zerar seleção a cada tick
  const lastPollRef = useRef({ jobId: null, status: null });

  // CNPJ discovery mode
  const [cnpjMode, setCnpjMode] = useState("enrich"); // "enrich" | "search"
  const [srKeyword, setSrKeyword] = useState("");
  const [srCnae, setSrCnae] = useState([]);   // { code, label }[]
  const [srNj, setSrNj] = useState([]);        // { code, label }[] — Natureza Jurídica
  const [srSituacao, setSrSituacao] = useState(["ATIVA"]);
  const [srUf, setSrUf] = useState([]);
  const [srMunicipio, setSrMunicipio] = useState([]);
  const [srTemTelefone, setSrTemTelefone] = useState(false);
  const [srTemEmail, setSrTemEmail] = useState(false);
  const [srMaxResults, setSrMaxResults] = useState(200);

  const loadJobs = useCallback(async () => {
    try {
      const { data } = await api.get("/lead-scraper/jobs");
      // backend pode responder { jobs, count } quando paginado — compat com array
      setJobs(Array.isArray(data) ? data : (data?.jobs || []));
    } catch {}
  }, []);

  const loadEngineStatus = useCallback(async () => {
    try {
      const { data } = await api.get("/lead-scraper/engine-status");
      setEngineStatus(data);
    } catch {}
  }, []);

  // Listas de contatos e tags existentes p/ autocomplete da importação
  const loadListsAndTags = useCallback(async () => {
    try {
      const { data } = await api.get("/contact-lists/list");
      setContactLists((Array.isArray(data) ? data : []).map(l => l.name).filter(Boolean));
    } catch {}
    try {
      const { data } = await api.get("/tags/list");
      setExistingTags((Array.isArray(data) ? data : []).map(t => t.name).filter(Boolean));
    } catch {}
  }, []);

  useEffect(() => {
    loadJobs(); loadEngineStatus(); loadListsAndTags(); loadUsersForSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadJobs, loadEngineStatus, loadListsAndTags]);

  const startPoll = useCallback((jobId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/lead-scraper/jobs/${jobId}`);
        setActiveJob(data);
        const prev = lastPollRef.current;
        // zera a seleção apenas quando o job muda ou conclui pela 1ª vez — nunca a cada tick
        if (prev.jobId !== data.id || (prev.status !== "done" && data.status === "done")) {
          setSelectedIndices([]);
        }
        lastPollRef.current = { jobId: data.id, status: data.status };
        if (data.status === "done" || data.status === "error") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          loadJobs();
        }
      } catch {}
    }, 2500);
  }, [loadJobs]);

  useEffect(() => () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startMapsJob = async () => {
    if (!keyword.trim()) { toast.warning("Preencha a palavra-chave."); return; }
    if (mapsMode === "city" && !city.some(c => c.trim())) { toast.warning("Preencha a cidade."); return; }
    if (mapsMode === "map" && !geo) { toast.warning("Clique no mapa para escolher o ponto central da busca."); return; }
    setLoading(true);
    try {
      const filters = mapsMode === "map"
        ? { keyword: keyword.trim(), lat: geo.lat, lng: geo.lng, radiusKm, maxResults }
        : { keyword: keyword.trim(), city, state, maxResults };
      const { data } = await api.post("/lead-scraper/jobs", {
        source: "google_maps",
        filters
      });
      setActiveJob(data);
      setSelectedIndices([]);
      toast.success("Busca iniciada! Acompanhe o progresso ao lado.");
      startPoll(data.id);
      loadJobs();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao iniciar busca.");
    }
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
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao iniciar enriquecimento.");
    }
    finally { setLoading(false); }
  };

  const startFollowersJob = async () => {
    if (!igTargetHandle.trim()) { toast.warning("Informe o @ da conta alvo."); return; }
    if (!engineStatus?.apify?.configured) {
      toast.warning("Configure APIFY_TOKEN no ambiente para buscar seguidores do Instagram.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/lead-scraper/jobs", {
        source: "ig_followers",
        filters: { igTargetHandle: igTargetHandle.trim().replace(/^@+/, ""), maxResults: igMaxFollowers },
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
    if (!srKeyword.trim() && !srUf.length && !srMunicipio.some(m => m.trim())) {
      toast.warning("Informe ao menos: palavra-chave no nome, UF ou município.");
      return;
    }
    setLoading(true);
    try {
      const filters = {
        keyword: srKeyword.trim() || undefined,
        cnae: srCnae?.length ? srCnae.map(o => o.code) : undefined,
        naturezaJuridica: srNj?.length ? srNj.map(o => o.code) : undefined,
        situacao: srSituacao?.length ? srSituacao : undefined,
        uf: srUf?.length ? srUf : undefined,
        municipio: srMunicipio?.length ? srMunicipio : undefined,
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

  const startConselhoJob = async () => {
    if (!consUf.length && !consMunicipio.some(m => m.trim()) && !consKeyword.trim()) {
      toast.warning("Informe ao menos: UF, município ou nome.");
      return;
    }
    setLoading(true);
    try {
      const filters = {
        conselho: consConselho,
        conselhoTipo: consTipo,
        uf: consUf?.length ? consUf : undefined,
        municipio: consMunicipio?.length ? consMunicipio : undefined,
        regional: consRegional?.length ? consRegional : undefined,
        situacao: consSituacao?.length ? consSituacao : undefined,
        keyword: consKeyword.trim() || undefined,
        maxResults: consMaxResults,
      };
      const { data } = await api.post("/lead-scraper/jobs", { source: "conselho", filters });
      setActiveJob(data);
      setSelectedIndices([]);
      toast.success("Busca no conselho iniciada! Acompanhe o progresso ao lado.");
      startPoll(data.id);
      loadJobs();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao iniciar busca no conselho.");
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
        walletUserId: walletUser?.id || undefined,
      });
      const skipped = data.skipped || 0;
      const ignorados = [
        ...(Array.isArray(data.errors) ? data.errors : []),
        ...(Array.isArray(data.leadsSemTelefone) ? data.leadsSemTelefone : []),
      ];
      toast.success(
        `✓ ${data.created || 0} criados · ${data.updated || 0} atualizados${skipped ? ` · ${skipped} ignorados` : ""}`
      );
      if (ignorados.length) {
        console.warn("[LeadScraper] Leads ignorados na importação:", ignorados);
        toast.info(`${ignorados.length} lead(s) ignorados — motivos no console (F12)`);
      }
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
    lastPollRef.current = { jobId: data.id, status: data.status };
    if (data.status === "running" || data.status === "pending") {
      startPoll(data.id);
    } else if (pollRef.current) {
      // job finalizado selecionado: encerra poll antigo para não sobrescrever a view
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const deleteJob = async (j) => {
    try {
      await api.delete(`/lead-scraper/jobs/${j.id}`);
      setJobs(prev => prev.filter(x => x.id !== j.id));
      if (activeJob?.id === j.id) setActiveJob(null);
    } catch (e) { toast.error(e?.response?.data?.error || "Erro ao excluir busca."); }
  };

  const clearHistory = async () => {
    try {
      const { data } = await api.delete("/lead-scraper/jobs");
      setJobs(prev => prev.filter(j => j.status === "pending" || j.status === "running"));
      if (activeJob && activeJob.status !== "pending" && activeJob.status !== "running") setActiveJob(null);
      toast.success(`${data.deleted || 0} busca(s) removida(s) do histórico`);
    } catch (e) { toast.error(e?.response?.data?.error || "Erro ao limpar histórico."); }
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
        {/* Status dos motores de busca (Apify/sidecar/Puppeteer) */}
        <Tooltip title={
          engineStatus?.apify?.configured
            ? "Apify configurado — usado para Maps (quando disponível), Seguidores IG e telefone de bio. Clique para gerenciar o token."
            : "APIFY_TOKEN não configurado — usando fallback local (Puppeteer/DDG). Clique para configurar o token."
        }>
          <Box
            onClick={() => setApifyModalOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
              background: engineStatus?.apify?.configured ? "rgba(76,175,80,0.18)" : "rgba(255,255,255,0.08)",
              color: "#fff",
              border: `1px solid ${engineStatus?.apify?.configured ? "rgba(129,199,132,0.5)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 8, padding: "4px 12px", fontSize: 12, whiteSpace: "nowrap", flexShrink: 0,
            }}>
            ⚙ Apify {engineStatus?.apify?.configured ? "ativo" : "não configurado"}
            {engineStatus?.googleMaps?.engine && (
              <Chip
                size="small"
                label={`Maps: ${engineStatus.googleMaps.engine}`}
                style={{ height: 18, fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.2)", color: "#fff" }}
              />
            )}
          </Box>
        </Tooltip>
      </Box>

      <ApifyTokenModal
        open={apifyModalOpen}
        onClose={() => setApifyModalOpen(false)}
        onSaved={loadEngineStatus}
      />

      {!engineStatus?.apify?.configured && (
        <Box style={{
          background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8,
          padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#92400e",
        }}>
          ⚠ Sem token Apify configurado: Seguidores IG fica indisponível e telefone/e-mail de bio do Instagram usa um fallback mais limitado (sem login). Busca no Maps continua funcionando via sidecar/Puppeteer. Clique no badge "Apify" acima para configurar.
        </Box>
      )}

      <Grid container spacing={2}>
        {/* ── Left: form ── */}
        <Grid item xs={12} md={7}>
          <Paper className={classes.paper} elevation={0} variant="outlined">
            <Tabs value={tab} onChange={(_, v) => { setTab(v); setHelpOpen(false); }} indicatorColor="primary" textColor="primary">
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><MapsIcon fontSize="small" /> Google Maps</Box>} />
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><CnpjIcon fontSize="small" /> CNPJ / Receita Federal</Box>} />
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><FollowersIcon fontSize="small" /> Seguidores IG</Box>} />
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><ConselhoIcon fontSize="small" /> Conselhos</Box>} />
            </Tabs>

            <TabPanel value={tab} index={0}>
              <Box className={classes.filterRow}>
                <TextField
                  label="Palavra-chave" placeholder="academias de ginástica"
                  value={keyword} onChange={e => setKeyword(e.target.value)}
                  variant="outlined" size="small" style={{ flex: 2, minWidth: 180 }}
                />
                <Autocomplete
                  options={SEGMENT_PRESETS}
                  getOptionLabel={opt => opt.label}
                  value={segMaps}
                  onChange={(_, val) => { setSegMaps(val); if (val) setKeyword(val.mapsKeyword); }}
                  renderInput={params => (
                    <TextField {...params} label="Segmento (atalho)" variant="outlined" size="small"
                      placeholder="ex: Odontologia" />
                  )}
                  noOptionsText="Nenhum segmento"
                  clearOnEscape
                  style={{ flex: 2, minWidth: 180 }}
                />
                <Autocomplete
                  multiple freeSolo
                  options={[]}
                  value={city}
                  onChange={(_, val) => setCity(val)}
                  disabled={mapsMode === "map"}
                  renderTags={(val, getTagProps) => val.map((opt, i) => (
                    <Chip variant="outlined" size="small" label={opt} {...getTagProps({ index: i })} key={opt} />
                  ))}
                  renderInput={params => (
                    <TextField {...params} label="Cidade" placeholder="São Paulo"
                      variant="outlined" size="small" />
                  )}
                  style={{ flex: 1, minWidth: 180 }}
                />
                <FormControl variant="outlined" size="small" style={{ minWidth: 100 }} disabled={mapsMode === "map"}>
                  <InputLabel>UF</InputLabel>
                  <Select
                    multiple
                    value={state}
                    onChange={e => setState(e.target.value)}
                    label="UF"
                    renderValue={sel => sel.join(", ")}
                  >
                    {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
              {/* Modo de localização: cidade/UF ou área desenhada no mapa */}
              <Box className={classes.modeToggle} style={{ marginTop: 8 }}>
                <Button
                  className={`${classes.modeBtn} ${mapsMode === "city" ? classes.modeBtnActive : ""}`}
                  onClick={() => setMapsMode("city")}
                  size="small"
                >
                  Por cidade
                </Button>
                <Button
                  className={`${classes.modeBtn} ${mapsMode === "map" ? classes.modeBtnActive : ""}`}
                  onClick={() => setMapsMode("map")}
                  size="small"
                  startIcon={<MapsIcon fontSize="small" />}
                >
                  Escolher área no mapa
                </Button>
                {mapsMode === "map" && (
                  <Button
                    size="small" variant="outlined"
                    disabled={!city.some(c => c.trim())}
                    onClick={async () => {
                      // Geocode gratuito (Nominatim/OSM): centraliza o mapa na 1ª cidade digitada
                      try {
                        const q = encodeURIComponent(`${city[0]} ${state[0] || ""}, Brasil`);
                        const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
                        const [hit] = await r.json();
                        if (hit) setGeo({ lat: +hit.lat, lng: +hit.lon });
                        else toast.warning("Cidade não encontrada no mapa — navegue manualmente.");
                      } catch { toast.error("Falha ao localizar a cidade no mapa."); }
                    }}
                  >
                    Centralizar em {city[0] || "cidade"}
                  </Button>
                )}
              </Box>
              {mapsMode === "map" && (
                <Box mt={1.5}>
                  <LeadMapPicker
                    center={geo}
                    radiusKm={radiusKm}
                    onSelect={(lat, lng) => setGeo({ lat, lng })}
                  />
                  <Box className={classes.sliderBox} style={{ marginTop: 8 }}>
                    <Typography variant="body2" style={{ marginBottom: 6 }}>
                      Raio de busca: <strong>{radiusKm} km</strong>
                      {geo ? ` — centro em ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}` : " — clique no mapa para marcar o centro"}
                    </Typography>
                    <Slider
                      value={radiusKm} onChange={(_, v) => setRadiusKm(v)}
                      min={1} max={50} step={1}
                      marks={[{ value: 1, label: "1km" }, { value: 25, label: "25km" }, { value: 50, label: "50km" }]}
                    />
                  </Box>
                </Box>
              )}
              <Box className={classes.sliderBox}>
                <Typography variant="body2" style={{ marginBottom: 6 }}>
                  Máximo de resultados: <strong>{maxResults === 0 ? "sem limite" : maxResults}</strong>
                </Typography>
                <Slider
                  value={maxResults} onChange={(_, v) => setMaxResults(v)}
                  min={0} max={200} step={10}
                  marks={[{ value: 0, label: "∞" }, { value: 100, label: "100" }, { value: 200, label: "200" }]}
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
                    <li>Escolha a localização: <strong>Por cidade</strong> (cidade + UF) ou <strong>Escolher área no mapa</strong> — clique no mapa para marcar o centro e ajuste o raio de 1 a 50 km. Ideal para bairros, polos industriais e regiões metropolitanas.</li>
                    <li>Ajuste o <strong>máximo de resultados</strong> (10 a 200). Mais resultados = mais tempo de processamento.</li>
                    <li>Clique em <strong>Iniciar Busca no Maps</strong>. O sistema extrai nome, telefone, e-mail, endereço, site e avaliação de cada empresa.</li>
                    <li>Ao atingir <strong>90% do progresso</strong>, começa o enriquecimento automático de redes sociais (Instagram, X, LinkedIn) para cada lead encontrado.</li>
                    <li>Para capturar telefone/e-mail de bio do Instagram automaticamente, configure <strong>APIFY_TOKEN</strong> no ambiente do servidor.</li>
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

                  {/* Segmento — atalho que preenche o CNAE */}
                  <Autocomplete
                    options={SEGMENT_PRESETS}
                    getOptionLabel={opt => opt.label}
                    value={segRf}
                    onChange={(_, val) => {
                      setSegRf(val);
                      const digits = val?.cnae?.replace(/\D/g, "");
                      const found = digits ? CNAES.find(o => o.code === digits) : null;
                      setSrCnae(found ? [found] : []);
                    }}
                    renderInput={params => (
                      <TextField {...params} label="Segmento (atalho)" variant="outlined" size="small"
                        placeholder="ex: Restaurantes" helperText="Preenche o CNAE automaticamente" />
                    )}
                    noOptionsText="Nenhum segmento"
                    clearOnEscape
                  />

                  {/* CNAE Autocomplete */}
                  <Autocomplete
                    multiple
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
                    multiple
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
                    <Select
                      multiple
                      value={srSituacao}
                      onChange={e => setSrSituacao(e.target.value)}
                      label="Situação"
                      renderValue={sel => sel.join(", ") || "Todas"}
                    >
                      <MenuItem value="ATIVA">Ativa</MenuItem>
                      <MenuItem value="SUSPENSA">Suspensa</MenuItem>
                      <MenuItem value="INAPTA">Inapta</MenuItem>
                      <MenuItem value="BAIXADA">Baixada</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl variant="outlined" size="small">
                    <InputLabel>UF</InputLabel>
                    <Select
                      multiple
                      value={srUf}
                      onChange={e => setSrUf(e.target.value)}
                      label="UF"
                      renderValue={sel => sel.join(", ") || "Todas"}
                    >
                      {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>

                  <Autocomplete
                    multiple freeSolo
                    options={[]}
                    value={srMunicipio}
                    onChange={(_, val) => setSrMunicipio(val)}
                    renderTags={(val, getTagProps) => val.map((opt, i) => (
                      <Chip variant="outlined" size="small" label={opt} {...getTagProps({ index: i })} key={opt} />
                    ))}
                    renderInput={params => (
                      <TextField {...params} label="Município (pós-filtro)" placeholder="ex: São Paulo"
                        variant="outlined" size="small" helperText="Filtra pela cidade nos dados do cnpj.ws" />
                    )}
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
                      Máximo de resultados: <strong>{srMaxResults === 0 ? "sem limite (até 500)" : srMaxResults}</strong>
                      {srMaxResults > 0 && (
                        <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.6 }}>
                          (~{Math.ceil(srMaxResults * 0.6 / 60)}–{Math.ceil(srMaxResults / 60)} min)
                        </span>
                      )}
                    </Typography>
                    <Slider
                      value={srMaxResults} onChange={(_, v) => setSrMaxResults(v)}
                      min={0} max={200} step={10}
                      marks={[{ value: 0, label: "∞" }, { value: 100, label: "100" }, { value: 200, label: "200" }]}
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
                          <li>Informe ao menos um filtro: <strong>palavra-chave no nome</strong>, <strong>UF</strong> ou <strong>município</strong>. Combinar filtros reduz o resultado e melhora a qualidade dos leads.</li>
                          <li><strong>CNAE</strong>: código de 7 dígitos da atividade principal. Ex: <code>4711301</code> = supermercados. Consulte em <code>cnae.ibge.gov.br</code>.</li>
                          <li><strong>Situação</strong>: use "Ativa" para empresas em funcionamento. "Baixada" e "Inapta" geralmente não são leads qualificados.</li>
                          <li>Marque <strong>"Apenas com telefone"</strong> ou <strong>"Apenas com e-mail"</strong> para filtrar leads com dados de contato já cadastrados na Receita Federal.</li>
                          <li>Ajuste o <strong>máximo de resultados</strong> (10–500). Cada resultado consome uma chamada à API do brasil.io.</li>
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
                {!engineStatus?.apify?.configured && (
                  <Box style={{
                    background: "#fef3c7", border: "1px solid #fcd34d",
                    borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13,
                    color: "#92400e",
                  }}>
                    ⚠ Requer <strong>APIFY_TOKEN</strong> configurado no ambiente (Configurações → Integrações).
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
                  Máximo de seguidores: <strong>{igMaxFollowers === 0 ? "sem limite (até 5.000)" : igMaxFollowers.toLocaleString("pt-BR")}</strong>
                </Typography>
                <Slider
                  value={igMaxFollowers} onChange={(_, v) => setIgMaxFollowers(v)}
                  min={0} max={5000} step={50}
                  marks={[
                    { value: 0, label: "∞" },
                    { value: 1000, label: "1k" },
                    { value: 5000, label: "5k" },
                  ]}
                />
                <Box mt={2} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <Button
                    variant="contained" color="primary"
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <FollowersIcon />}
                    onClick={startFollowersJob}
                    disabled={loading || !engineStatus?.apify?.configured}
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
                      <li><strong>Pré-requisito:</strong> configure o token Apify no badge "Apify" no topo da página (Apify roda sem sessão pessoal — sem risco de ban).</li>
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

            <TabPanel value={tab} index={3}>
              <Box className={classes.searchGrid}>
                <Box className={classes.infoNote}>
                  Busca registros em <strong>conselhos de classe</strong>.
                  O <strong>CAU</strong> já está disponível; CONFEA, CFM, CRO e OAB chegam em breve.
                  Retorna nome, número de registro, situação e município/UF.
                </Box>

                <FormControl variant="outlined" size="small">
                  <InputLabel>Conselho</InputLabel>
                  <Select
                    value={consConselho}
                    onChange={e => setConsConselho(e.target.value)}
                    label="Conselho"
                  >
                    {CONSELHOS.map(c => (
                      <MenuItem key={c.value} value={c.value} disabled={c.disabled}>
                        {c.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box className={classes.modeToggle} style={{ marginTop: 0, alignSelf: "center" }}>
                  <Button
                    className={`${classes.modeBtn} ${consTipo === "profissional" ? classes.modeBtnActive : ""}`}
                    onClick={() => setConsTipo("profissional")}
                  >
                    Profissional
                  </Button>
                  <Button
                    className={`${classes.modeBtn} ${consTipo === "empresa" ? classes.modeBtnActive : ""}`}
                    onClick={() => setConsTipo("empresa")}
                  >
                    Empresa
                  </Button>
                  <Button
                    className={`${classes.modeBtn} ${consTipo === "ambos" ? classes.modeBtnActive : ""}`}
                    onClick={() => setConsTipo("ambos")}
                  >
                    Ambos
                  </Button>
                </Box>

                <FormControl variant="outlined" size="small">
                  <InputLabel>UF</InputLabel>
                  <Select
                    multiple
                    value={consUf}
                    onChange={e => setConsUf(e.target.value)}
                    label="UF"
                    renderValue={sel => sel.join(", ") || "Todas"}
                  >
                    {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>

                <Autocomplete
                  multiple freeSolo
                  options={[]}
                  value={consMunicipio}
                  onChange={(_, val) => setConsMunicipio(val)}
                  renderTags={(val, getTagProps) => val.map((opt, i) => (
                    <Chip variant="outlined" size="small" label={opt} {...getTagProps({ index: i })} key={opt} />
                  ))}
                  renderInput={params => (
                    <TextField {...params} label="Município" placeholder="ex: São Paulo"
                      variant="outlined" size="small" />
                  )}
                />

                <Autocomplete
                  multiple freeSolo
                  options={[]}
                  value={consRegional}
                  onChange={(_, val) => setConsRegional(val)}
                  renderTags={(val, getTagProps) => val.map((opt, i) => (
                    <Chip variant="outlined" size="small" label={opt} {...getTagProps({ index: i })} key={opt} />
                  ))}
                  renderInput={params => (
                    <TextField {...params} label="Regional (opcional)" placeholder="ex: SP1, RJ2"
                      variant="outlined" size="small" helperText="Filtra pela regional do conselho (ex: CAU/SP)" />
                  )}
                />

                <FormControl variant="outlined" size="small">
                  <InputLabel>Situação do registro</InputLabel>
                  <Select
                    multiple
                    value={consSituacao}
                    onChange={e => setConsSituacao(e.target.value)}
                    label="Situação do registro"
                    renderValue={sel => sel.join(", ") || "Todas"}
                  >
                    <MenuItem value="ATIVO">Ativo</MenuItem>
                    <MenuItem value="CANCELADO">Cancelado</MenuItem>
                    <MenuItem value="INTERROMPIDO">Interrompido</MenuItem>
                    <MenuItem value="SUSPENSO">Suspenso</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Nome (opcional)" placeholder="ex: Silva Arquitetura"
                  value={consKeyword} onChange={e => setConsKeyword(e.target.value)}
                  variant="outlined" size="small"
                  className={classes.fullRow}
                  helperText="Informe ao menos UF, município ou nome para pesquisar"
                />

                <Box className={classes.fullRow}>
                  <Typography variant="body2" style={{ marginBottom: 6 }}>
                    Máximo de resultados: <strong>{consMaxResults === 0 ? "sem limite (até 2000)" : consMaxResults}</strong>
                  </Typography>
                  <Slider
                    value={consMaxResults} onChange={(_, v) => setConsMaxResults(v)}
                    min={0} max={200} step={10}
                    marks={[{ value: 0, label: "∞" }, { value: 100, label: "100" }, { value: 200, label: "200" }]}
                  />
                </Box>

                <Box className={classes.fullRow}>
                  <Button
                    variant="contained" color="primary"
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <ConselhoIcon />}
                    onClick={startConselhoJob} disabled={loading}
                    style={{ textTransform: "none", fontWeight: 600 }}
                  >
                    Buscar no Conselho
                  </Button>
                </Box>
              </Box>
            </TabPanel>
          </Paper>
        </Grid>

        {/* ── Right: jobs history ── */}
        <Grid item xs={12} md={5} style={{ display: "flex" }}>
          <Paper
            className={classes.paper}
            elevation={0}
            variant="outlined"
            style={{ minHeight: 200, maxHeight: 560, display: "flex", flexDirection: "column", flex: 1 }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" style={{ marginBottom: 12, flexShrink: 0 }}>
              <Typography variant="subtitle1" style={{ fontWeight: 700 }}>Histórico de Buscas</Typography>
              <Box display="flex" alignItems="center">
                <Tooltip title="Limpar histórico">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => setConfirmDelete({ type: "all" })}
                      disabled={!jobs.some(j => j.status === "done" || j.status === "error")}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Recarregar">
                  <IconButton size="small" onClick={loadJobs}><RefreshIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Box style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {jobs.length === 0 ? (
              <Box textAlign="center" py={4}>
                <LeadIcon style={{ fontSize: 40, opacity: 0.18, marginBottom: 8 }} />
                <Typography variant="body2" color="textSecondary">Nenhuma busca iniciada ainda.</Typography>
              </Box>
            ) : (
              jobs.map(j => {
                const st = STATUS[j.status] || STATUS.pending;
                const isActive = activeJob?.id === j.id;
                const asStr = v => Array.isArray(v) ? v.join(", ") : v;
                const jobName = j.source === "google_maps"
                  ? `${j.filters?.keyword || "?"} — ${asStr(j.filters?.city) || "?"} ${asStr(j.filters?.state) || ""}`
                  : j.source === "cnpj_search"
                    ? `RF: ${[j.filters?.keyword, asStr(j.filters?.cnae), asStr(j.filters?.uf), asStr(j.filters?.municipio)].filter(Boolean).join(" ") || "?"}`
                    : j.source === "ig_followers"
                      ? `📸 @${j.filters?.igTargetHandle || "?"}`
                      : j.source === "conselho"
                        ? `${(j.filters?.conselho || "conselho").toUpperCase()} · ${j.filters?.conselhoTipo === "empresa" ? "Empresas" : j.filters?.conselhoTipo === "ambos" ? "Ambos" : "Profissionais"}${j.filters?.uf ? ` ${asStr(j.filters.uf)}` : ""}`
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
                    {(j.status === "done" || j.status === "error") && (
                      <Tooltip title="Excluir busca">
                        <IconButton
                          size="small"
                          style={{ marginLeft: 4, padding: 2 }}
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "job", job: j }); }}
                        >
                          <DeleteIcon style={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                );
              })
            )}
            </Box>
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
                {activeJob.source === "google_maps" ? <MapsIcon style={{ fontSize: 12 }} />
                  : activeJob.source === "ig_followers" ? <InstagramIcon style={{ fontSize: 12 }} />
                  : activeJob.source === "conselho" ? <ConselhoIcon style={{ fontSize: 12 }} />
                  : <CnpjIcon style={{ fontSize: 12 }} />}
                {activeJob.source === "google_maps" ? "Google Maps"
                  : activeJob.source === "cnpj_search" ? "RF Pesquisa Avançada"
                  : activeJob.source === "ig_followers" ? "Instagram"
                  : activeJob.source === "conselho" ? "Conselho de Classe"
                  : "Receita Federal"}
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
                      {activeJob.source === "conselho" && (
                        <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>REGISTRO</TableCell>
                      )}
                      <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>TELEFONE</TableCell>
                      <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>REDES SOCIAIS</TableCell>
                      <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>ENDEREÇO</TableCell>
                      <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>CNPJ</TableCell>
                      <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>RECEITA</TableCell>
                      {activeJob.source === "conselho" && (
                        <TableCell className={classes.stickyHead} style={{ fontWeight: 700, fontSize: 11 }}>STATUS</TableCell>
                      )}
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
                        {activeJob.source === "conselho" && (
                          <TableCell>
                            <Typography variant="body2" style={{ fontSize: 11, fontFamily: "monospace" }}>
                              {r.registro || "—"}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell>
                          <Box display="flex" alignItems="center" style={{ gap: 4 }}>
                            <Typography variant="body2" style={{ fontSize: 12 }}>
                              {r.phone ? formatPhoneBR(r.phone) : "—"}
                            </Typography>
                            {r.whatsappChecked && r.hasWhatsapp && (
                              <Tooltip title="WhatsApp ativo (validado)">
                                <span style={{ color: "#25d366", fontSize: 13, fontWeight: 700 }}>✓WA</span>
                              </Tooltip>
                            )}
                            {r.whatsappChecked && r.hasWhatsapp === false && (
                              <Tooltip title="Número sem WhatsApp">
                                <span style={{ color: "#9e9e9e", fontSize: 11 }}>sem WA</span>
                              </Tooltip>
                            )}
                          </Box>
                          {r.instagramPhone && r.instagramPhone !== r.phone && (
                            <Typography variant="caption" style={{ display: "block", color: SOCIAL_COLORS.instagram, fontSize: 11 }}>
                              📸 {formatPhoneBR(r.instagramPhone)}
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
                          <Box display="flex" alignItems="center" style={{ gap: 4 }}>
                            <Typography variant="body2" style={{ fontSize: 11, fontFamily: "monospace" }}>
                              {r.cnpj
                                ? r.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
                                : r.website
                                  ? <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>site</a>
                                  : "—"}
                            </Typography>
                            {(r.enrichedFrom || []).includes("receita") && (
                              <Tooltip title="Enriquecido com dados da Receita Federal (encontrado pelo nome)">
                                <Chip label="RF" size="small"
                                  style={{ fontSize: 9, height: 16, fontWeight: 700, background: "#e8f5e9", color: "#2e7d32" }} />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {(r.cnaeDescricao || r.porte || r.situacao || r.naturezaJuridica || r.capitalSocial) ? (
                            <Tooltip title={
                              <Box style={{ fontSize: 12, lineHeight: 1.6 }}>
                                {r.cnaeDescricao && <div>CNAE: {r.cnaeDescricao}</div>}
                                {r.naturezaJuridica && <div>Natureza: {r.naturezaJuridica}</div>}
                                {r.capitalSocial && <div>Capital social: R$ {Number(r.capitalSocial).toLocaleString("pt-BR")}</div>}
                                {r.dataAbertura && <div>Abertura: {r.dataAbertura}</div>}
                              </Box>
                            }>
                              <Box>
                                {r.porte && (
                                  <Chip label={r.porte} size="small"
                                    style={{ fontSize: 9, height: 16, fontWeight: 600, marginRight: 4 }} />
                                )}
                                {r.situacao && (
                                  <Chip
                                    label={r.situacao}
                                    size="small"
                                    style={{
                                      fontSize: 9, height: 16, fontWeight: 700,
                                      background: /ativ/i.test(r.situacao) ? "#e8f5e9" : "#fce4ec",
                                      color: /ativ/i.test(r.situacao) ? "#2e7d32" : "#c62828",
                                    }}
                                  />
                                )}
                              </Box>
                            </Tooltip>
                          ) : <Typography variant="caption" color="textSecondary">—</Typography>}
                        </TableCell>
                        {activeJob.source === "conselho" && (
                          <TableCell>
                            <Chip
                              label={r.situacao || "—"}
                              size="small"
                              style={{ fontSize: 10, height: 20, fontWeight: 600 }}
                            />
                          </TableCell>
                        )}
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
                <Autocomplete
                  freeSolo
                  options={contactLists}
                  value={contactListName || null}
                  onChange={(_, val) => setContactListName(typeof val === "string" ? val : (val || ""))}
                  onInputChange={(_, val, reason) => { if (reason !== "reset") setContactListName(val || ""); }}
                  renderInput={params => (
                    <TextField {...params} label="Lista de contatos" size="small" variant="outlined"
                      placeholder="escolha ou digite p/ criar" />
                  )}
                  noOptionsText="Digite para criar uma nova lista"
                  style={{ minWidth: 240 }}
                />
                <Autocomplete
                  freeSolo
                  options={existingTags}
                  value={tagName || null}
                  onChange={(_, val) => setTagName(typeof val === "string" ? val : (val || ""))}
                  onInputChange={(_, val, reason) => { if (reason !== "reset") setTagName(val || ""); }}
                  renderInput={params => (
                    <TextField {...params} label="Tag" size="small" variant="outlined"
                      placeholder="escolha ou digite p/ criar" />
                  )}
                  noOptionsText="Digite para criar uma nova tag"
                  style={{ minWidth: 170 }}
                />
                <Autocomplete
                  options={walletUsers || []}
                  getOptionLabel={opt => opt.name || ""}
                  value={walletUser}
                  onChange={(_, val) => setWalletUser(val)}
                  renderInput={params => (
                    <TextField {...params} label="Carteira (responsável)" size="small" variant="outlined"
                      placeholder="atribuir a um usuário" />
                  )}
                  noOptionsText="Nenhum usuário encontrado"
                  clearOnEscape
                  style={{ minWidth: 200 }}
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

      <ConfirmationModal
        title={confirmDelete?.type === "all" ? "Limpar histórico" : "Excluir busca"}
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target?.type === "all") clearHistory();
          else if (target?.type === "job") deleteJob(target.job);
        }}
      >
        {confirmDelete?.type === "all"
          ? "Excluir todo o histórico de buscas? Leads já importados não serão afetados."
          : "Excluir esta busca do histórico? Leads já importados não serão afetados."}
      </ConfirmationModal>
    </MainContainer>
  );
}
