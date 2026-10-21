import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Autocomplete from "@material-ui/lab/Autocomplete";
import Skeleton from "@material-ui/lab/Skeleton";
import CNAES from "../../data/cnaeList";
import NJS from "../../data/naturezaJuridicaList";
import SEGMENT_PRESETS from "../../data/leadSegmentPresets";
import {
  Box, Paper, Typography, Tabs, Tab, TextField, Button, Slider,
  Select, Menu, MenuItem, FormControl, InputLabel, LinearProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
  Chip, IconButton, Tooltip, CircularProgress, Divider, Grid,
  FormControlLabel, Collapse, InputAdornment, Switch,
  Dialog, DialogTitle, DialogContent,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
// WhatsApp permanece em @material-ui/icons — não há equivalente no lucide-react
import { WhatsApp as WhatsAppIcon } from "@material-ui/icons";
import {
  Search as SearchIcon,
  Download as ImportIcon,
  RefreshCw as RefreshIcon,
  Map as MapsIcon,
  Building2 as CnpjIcon,
  Circle as DotIcon,
  UserPlus as LeadIcon,
  ListFilter as FilterIcon,
  Users as FollowersIcon,
  HelpCircle as HelpIcon,
  Instagram as InstagramIcon,
  Landmark as ConselhoIcon,
  Trash2 as DeleteIcon,
  Eraser as ClearIcon,
  ArrowUp as SortAscIcon,
  ArrowDown as SortDescIcon,
  ChevronsUpDown as SortNoneIcon,
  CircleStop as StopIcon,
  Globe as GlobalIcon,
  Settings as SettingsIcon,
  CheckCircle2 as CheckIcon,
  ChevronDown as ChevronDownIcon,
  Pencil as PencilIcon,
  PenTool as PenToolIcon,
  ShoppingBag as ShopIcon,
  SlidersHorizontal as SlidersIcon,
  Database as DatabaseIcon,
  Star as StarIcon,
  X as XIcon,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api";
import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import ConfirmationModal from "../../components/ConfirmationModal";
import ApifyTokenModal from "../../components/ApifyTokenModal";
import LeadMapPicker from "../../components/LeadMapPicker";
import useUsersList from "../../hooks/useUsersList";
import usePermissions from "../../hooks/usePermissions";
import { motion, useReducedMotion } from "framer-motion";
import StatCard from "../../components/bento/StatCard";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

const STATUS = {
  done:    { label: "Concluído",  bg: "#e8f5e9", color: "#2e7d32" },
  running: { label: "Executando", bg: "#e3f2fd", color: "#1565c0" },
  error:   { label: "Erro",       bg: "#fce4ec", color: "#c62828" },
  pending: { label: "Aguardando", bg: "#f5f5f5", color: "#757575" },
  cancelled: { label: "Cancelado", bg: "#efebe9", color: "#5d4037" },
};

const GLOBAL_SOURCE_META = {
  google_maps: { label: "Maps", color: "#1a73e8" },
  cnpj_search: { label: "RF", color: "#2e7d32" },
  conselho: { label: "CAU", color: "#6a1b9a" },
};

const SOCIAL_LINKS = {
  instagram: h => `https://instagram.com/${h}`,
  twitter:   h => `https://x.com/${h}`,
  linkedin:  h => `https://linkedin.com/company/${h}`,
  facebook:  h => `https://facebook.com/${h}`,
};
const SOCIAL_COLORS = { instagram: "#e1306c", twitter: "#000", linkedin: "#0a66c2", facebook: "#1877f2" };
const SOCIAL_LABELS = { instagram: "IG", twitter: "X", linkedin: "LI", facebook: "FB" };

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

// Presets de público-alvo da Busca Global: keywords[] alimentam a Receita
// (texto na razão social), mapQueries[] alimentam o Maps (1 run, várias
// queries), cnae[] alimenta a RF por CNAE (minhareceita). O usuário só
// troca cidade/UF — as queries ficam fixas por público.
// Lista real de municípios via IBGE — carrega por UF selecionada (leve,
// ~200-600 cidades/UF) com cache em memória para não refazer requests.
const ibgeCache = {};
const useCityOptions = (ufs) => {
  const [options, setOptions] = useState([]);
  const key = (ufs || []).join(",");
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!ufs?.length) { if (alive) setOptions([]); return; }
      const names = new Set();
      await Promise.all(ufs.map(async uf => {
        if (ibgeCache[uf]) { ibgeCache[uf].forEach(n => names.add(n)); return; }
        try {
          const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
          const rows = await res.json();
          const list = (rows || []).map(m => m.nome).filter(Boolean);
          ibgeCache[uf] = list;
          list.forEach(n => names.add(n));
        } catch { /* IBGE fora — autocomplete continua freeSolo */ }
      }));
      if (alive) setOptions([...names].sort());
    };
    load();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return options;
};

const GLOBAL_PRESETS = {
  arquitetos: {
    label: "Arquitetos / Light Design",
    keywords: ["luminotecnico", "projeto luminotecnico", "lighting design", "light design"],
    mapQueries: [
      "projeto luminotécnico", "lighting designer",
      "design de iluminação", "consultoria luminotécnica",
    ],
    cnae: ["7111100", "7490102"], // serviços de arquitetura + design de interiores
    conselhoTipo: "ambos",
    defaultSources: ["google_maps", "cnpj_search", "conselho"],
  },
  lojistas: {
    label: "Lojistas e Distribuidores",
    keywords: ["luminaria", "lustres", "material eletrico", "iluminacao"],
    mapQueries: [
      "loja de iluminação", "loja de material elétrico",
      "loja de lustres", "distribuidora de lustres", "materiais de construção",
    ],
    cnae: ["4742300", "4744001", "4744099"], // mat. elétrico + ferragens + mat. construção
    // MEI excluído: público-alvo são lojas com escala para comprar no atacado
    porte: ["MICRO EMPRESA", "PEQUENO PORTE", "DEMAIS"],
    conselhoTipo: "ambos",
    defaultSources: ["google_maps", "cnpj_search"],
  },
};

// Somente CAU habilitado por ora; demais conselhos entram como "em breve"
const CONSELHOS = [
  { value: "cau",    label: "CAU — Arquitetura e Urbanismo",        disabled: false },
  { value: "confea", label: "CONFEA/CREA — Engenharia (em breve)",  disabled: true },
  { value: "cfm",    label: "CFM/CRM — Medicina (em breve)",        disabled: true },
  { value: "cro",    label: "CRO — Odontologia (em breve)",         disabled: true },
  { value: "oab",    label: "OAB — Advocacia (em breve)",           disabled: true },
];

const useStyles = makeStyles(theme => ({
  // ===== Padrão de layout de página (referência: Connections) =====
  mainPaper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    padding: theme.spacing(2, 2.5),
  },
  headerText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  // Conteúdo da página dentro do Paper principal (grid de seções)
  pageContent: {
    padding: theme.spacing(0, 2.5, 2.5),
  },
  warnBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: theme.spacing(0, 2.5, 2),
    padding: theme.spacing(1.25, 2),
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 1.5,
    background: theme.palette.type === "dark" ? "#3a2f10" : "#fef3c7",
    border: `1px solid ${theme.palette.type === "dark" ? "#6b5518" : "#fcd34d"}`,
    color: theme.palette.type === "dark" ? "#fcd34d" : "#92400e",
  },
  // Barra de busca/filtros da seção de resultados (dentro de Paper interno)
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    padding: theme.spacing(1.25, 1.5),
    marginBottom: theme.spacing(1.5),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
  },
  searchField: {
    minWidth: 200,
    flex: "1 1 240px",
    maxWidth: 340,
  },
  // Barra de resumo de dedupe + filtro por status — topo da seção de resultados
  summaryBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    padding: theme.spacing(1, 1.5),
    marginBottom: theme.spacing(1),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
  },
  summaryStats: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
  },
  summaryStat: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
    "& i": { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  },
  headCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    borderBottom: `1px solid ${theme.palette.divider}`,
    whiteSpace: "nowrap",
  },
  bodyCell: {
    fontSize: "0.85rem",
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    borderBottom: `1px solid ${theme.palette.divider}`,
    verticalAlign: "middle",
  },
  rowHover: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    transition: "background-color 120ms ease",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(6, 2),
    color: theme.palette.text.secondary,
    textAlign: "center",
  },
  // Cards mobile / tabela desktop
  mobileList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 0),
    [theme.breakpoints.up("sm")]: {
      display: "none",
    },
  },
  desktopTableWrapper: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  card: {
    borderRadius: 12,
    padding: theme.spacing(1.75),
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.25),
    background: theme.palette.background.paper,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    minWidth: 0,
  },
  cardName: {
    fontWeight: 700,
    fontSize: "0.95rem",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: theme.spacing(1),
  },
  metaLabel: {
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },
  metaValue: {
    fontSize: "0.85rem",
    fontWeight: 600,
    wordBreak: "break-word",
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    flexWrap: "wrap",
  },

  // ===== Estilos específicos da página =====
  paper: { borderRadius: 12, padding: theme.spacing(2.5), marginBottom: theme.spacing(2) },

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
  // Cabeçalho fixo da tabela de resultados — fundo precisa ser opaco p/ o sticky
  stickyHead: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
  },

  importBar: {
    display: "flex", gap: theme.spacing(2), alignItems: "center",
    flexWrap: "wrap", padding: "16px 0 0",
  },

  rating: { color: "#f59e0b", fontWeight: 700, fontSize: 12 },

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

  searchGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(1.5),
    marginTop: 16,
    // Formulário vira 1 coluna no mobile (spec mobile)
    [theme.breakpoints.down("sm")]: { gridTemplateColumns: "1fr" },
  },
  // Alvo de toque de 44px nos botões de ação dos jobs no mobile
  jobActionBtn: {
    padding: 2,
    marginLeft: 4,
    [theme.breakpoints.down("sm")]: { minWidth: 44, minHeight: 44 },
  },
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

  // ===== Busca Global — seções numeradas e cards clicáveis =====
  gSectionHead: {
    display: "flex", alignItems: "center", gap: 8,
    margin: theme.spacing(2.25, 0, 1.25),
  },
  gSectionNum: {
    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
    background: "var(--primary-color)",
    color: "#fff", fontSize: 12, fontWeight: 800,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  },
  gSectionTitle: { fontWeight: 700, fontSize: 14 },
  presetRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: theme.spacing(1),
  },
  presetTile: {
    border: `1.5px solid ${theme.palette.divider}`,
    borderRadius: 10,
    padding: theme.spacing(1.25, 1.5),
    cursor: "pointer",
    display: "flex", flexDirection: "column", gap: 4,
    background: theme.palette.background.paper,
    transition: "border-color 120ms ease, box-shadow 120ms ease",
    "&:hover": { borderColor: theme.palette.primary.main },
  },
  presetTileOn: {
    borderColor: "var(--primary-color)",
    boxShadow: "0 0 0 1px var(--primary-color)",
  },
  sourceCard: {
    flex: "1 1 160px", minWidth: 150,
    border: `1.5px solid ${theme.palette.divider}`,
    borderRadius: 10,
    padding: theme.spacing(1.25, 1.5),
    cursor: "pointer", userSelect: "none",
    display: "flex", flexDirection: "column", gap: 4,
    transition: "opacity 120ms ease, border-color 120ms ease",
    "&:hover": { borderColor: theme.palette.primary.main },
  },
  sourceCardOn: { borderColor: "var(--primary-color)" },
  sourceCardOff: { opacity: 0.45 },
  costBadge: {
    alignSelf: "flex-start",
    borderRadius: 999, padding: "1px 8px",
    fontSize: 10, fontWeight: 700,
    background: theme.palette.type === "dark" ? "#263445" : "#eef2f7",
    color: theme.palette.text.secondary,
  },
  // Micro-badge que indica qual fonte o refinamento afeta
  srcTag: {
    display: "inline-block", marginLeft: 6,
    borderRadius: 3, padding: "0 5px",
    fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
    background: theme.palette.type === "dark" ? "#2a3a4d" : "#e3ecf5",
    color: theme.palette.type === "dark" ? "#9cc3e6" : "#3a6ea5",
    verticalAlign: "middle", whiteSpace: "nowrap",
  },
  advGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(1.5, 2),
    marginTop: theme.spacing(1.5),
    [theme.breakpoints.down("sm")]: { gridTemplateColumns: "1fr" },
  },
  advLabel: {
    display: "block", fontWeight: 600, fontSize: 12,
    color: theme.palette.text.secondary, marginBottom: 4,
  },
  // ===== Modal Raio-X do lead =====
  xrayTitle: {
    fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
    textTransform: "uppercase", color: theme.palette.text.secondary,
    marginBottom: 6, paddingBottom: 4,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  xrayGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: theme.spacing(1.25),
  },
  xrayValue: { fontSize: 13, fontWeight: 500, wordBreak: "break-word" },
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

function SortableHeader({ className, label, sortKey, sortConfig, onSort }) {
  const active = sortConfig.key === sortKey;
  const Icon = active ? (sortConfig.dir === "asc" ? SortAscIcon : SortDescIcon) : SortNoneIcon;
  return (
    <TableCell
      className={className}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      onClick={() => onSort(sortKey)}
    >
      <Box display="flex" alignItems="center" style={{ gap: 2 }}>
        {label}
        <Icon size={13} style={{ opacity: active ? 1 : 0.35 }} />
      </Box>
    </TableCell>
  );
}

// ===== Status de dedupe do lead (flags preenchidas pelo backend) =====
// Prioridade: importado > já nos contatos > em outra lista > capturado em
// busca anterior > novo. Leads sem nenhuma flag são tratados como "new".
const LEAD_STATUS_META = {
  imported: { label: "Importado",      color: "#26c281", tip: "Já importado para os contatos" },
  contact:  { label: "Nos contatos",   color: "#3598dc", tip: "Já existe nos seus contatos" },
  list:     { label: "Em outra lista", color: "#8e44ad", tip: "Já está em outra lista de contatos" },
  job:      { label: "Já capturado",   color: "#757575", tip: "Já capturado em uma busca anterior" },
  new:      { label: "Novo",           color: "#f39c12", tip: "Lead novo — não encontrado nos contatos" },
};

const leadDedupeCategory = (r) => {
  if (r?.imported) return "imported";
  if (r?.dedupeStatus === "seen_contact" || r?.existsInContacts) return "contact";
  if (r?.dedupeStatus === "seen_list") return "list";
  if (r?.dedupeStatus === "seen_job") return "job";
  return "new";
};

// Chip compacto de status do lead — mesmo padrão visual dos badges de fonte.
// showNew=false omite o badge "Novo" (para onde não houver espaço).
function LeadStatusBadges({ lead, showNew = true }) {
  const cat = leadDedupeCategory(lead);
  const meta = LEAD_STATUS_META[cat];
  return (
    <>
      {(cat !== "new" || showNew) && (
        <Tooltip title={meta.tip}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 2,
              background: meta.color + "22",
              color: meta.color,
              borderRadius: 3, padding: "0 5px",
              fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
              whiteSpace: "nowrap",
            }}
          >
            {cat === "imported" && <CheckIcon size={9} strokeWidth={3} />}
            {meta.label}
          </span>
        </Tooltip>
      )}
      {lead?.hasWhatsapp && (
        <Tooltip title="WhatsApp ativo">
          <span
            style={{
              background: "#25d36618",
              color: "#128c7e",
              borderRadius: 3, padding: "0 5px",
              fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
              whiteSpace: "nowrap",
            }}
          >
            WA ✓
          </span>
        </Tooltip>
      )}
    </>
  );
}

// ===== Tier de score do lead (leadTier/leadScore vêm do backend) =====
const LEAD_TIER_META = {
  gold:   { label: "Ouro",   icon: "🏆", color: "#f39c12" },
  silver: { label: "Prata",  icon: "🥈", color: "#8e9aab" },
  bronze: { label: "Bronze", icon: "🥉", color: "#cd7f32" },
};

// Badge ao lado do nome — retrocompat: lead sem leadTier não renderiza nada
function LeadTierBadge({ lead }) {
  const meta = LEAD_TIER_META[lead?.leadTier];
  if (!meta) return null;
  return (
    <Tooltip title={`Score ${lead.leadScore ?? "—"}/100`}>
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 2,
          background: meta.color + "26",
          color: meta.color,
          borderRadius: 3, padding: "0 5px",
          fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
          whiteSpace: "nowrap",
        }}
      >
        {meta.icon} {meta.label}
      </span>
    </Tooltip>
  );
}

// Badges das fontes de origem do lead (busca global) — "Maps", "RF", "CAU"…
function SourceBadges({ lead }) {
  return (lead?.sources || []).map(src => (
    <span
      key={src}
      style={{
        background: (GLOBAL_SOURCE_META[src]?.color || "#555") + "22",
        color: GLOBAL_SOURCE_META[src]?.color || "#555",
        borderRadius: 3, padding: "0 5px",
        fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
      }}
    >
      {GLOBAL_SOURCE_META[src]?.label || src}
    </span>
  ));
}

// Cards de fonte da Busca Global (seção 3) — custo é resolvido no render
// porque depende do engineStatus (Apify configurado ou fallback local)
const GLOBAL_SOURCE_CARDS = [
  { key: "google_maps", label: "Google Maps", hint: "Nome, telefone, site, endereço e avaliação", Icon: MapsIcon },
  { key: "cnpj_search", label: "Receita Federal", hint: "CNPJ, razão social, CNAE e situação", Icon: CnpjIcon },
  { key: "conselho", label: "CAU — Arquitetura", hint: "Registro profissional e empresarial", Icon: ConselhoIcon },
];

export default function LeadScraper() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobsLoaded, setJobsLoaded] = useState(false); // true após o 1º loadJobs — controla o skeleton do histórico
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
  const { hasPermission } = usePermissions();
  const canImport = hasPermission("contacts.import");
  const pollRef = useRef(null);

  // Respeita prefers-reduced-motion: troca o spring por um fade simples
  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

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

  // busca global — reutiliza keyword/city/state/maxResults da aba Maps;
  // state próprio só para as fontes habilitadas
  const [globalSources, setGlobalSources] = useState(["google_maps", "cnpj_search", "conselho"]);
  const [globalPreset, setGlobalPreset] = useState(""); // "" | "arquitetos" | "lojistas"
  const [consMaxResults, setConsMaxResults] = useState(100);

  // Refinamento avançado da Busca Global — viram filters do job "global"
  const [advOpen, setAdvOpen] = useState(false);
  const [gfSkipClosed, setGfSkipClosed] = useState(true);   // default do backend já é true — só enviamos quando desmarca
  const [gfMinRating, setGfMinRating] = useState("");       // "" | "3" | "3.5" | "4" | "4.5"
  const [gfMinReviews, setGfMinReviews] = useState("");     // "" | 5 | 10 | 25 | 50
  const [gfSite, setGfSite] = useState("any");              // "any" | "with" | "without"
  const [gfOnlyCell, setGfOnlyCell] = useState(false);
  const [gfOnlyActive, setGfOnlyActive] = useState(true);   // ON → situacao=["ATIVA"]
  const [gfExcludeMei, setGfExcludeMei] = useState(false);
  const [gfCapitalMin, setGfCapitalMin] = useState("");
  const [gfExcludeKw, setGfExcludeKw] = useState([]);       // string[] → excludeKeywords
  const [gfAberturaMin, setGfAberturaMin] = useState("");   // YYYY-MM-DD
  const [gfAberturaMax, setGfAberturaMax] = useState("");
  const [segGlobal, setSegGlobal] = useState(null);         // atalho de segmento — só preenche keyword
  const [xrayLead, setXrayLead] = useState(null);           // lead aberto no modal Raio-X

  // atalhos de segmento (Maps preenche keyword, RF preenche CNAE)
  const [segMaps, setSegMaps] = useState(null);
  const [segRf, setSegRf] = useState(null);

  // último job visto pelo poll — evita zerar seleção a cada tick
  const lastPollRef = useRef({ jobId: null, status: null });

  // CNPJ discovery mode
  const [cnpjMode, setCnpjMode] = useState("search"); // "enrich" | "search" — Pesquisa Avançada como padrão
  const [srKeyword, setSrKeyword] = useState("");
  const [srCnae, setSrCnae] = useState([]);   // { code, label }[]
  const [srNj, setSrNj] = useState([]);        // { code, label }[] — Natureza Jurídica
  const [srSituacao, setSrSituacao] = useState(["ATIVA"]);
  const [srUf, setSrUf] = useState([]);
  const [srMunicipio, setSrMunicipio] = useState([]);
  const [srPorte, setSrPorte] = useState([]);
  const [srCapitalMin, setSrCapitalMin] = useState("");
  const [srTemTelefone, setSrTemTelefone] = useState(false);
  const [srTemEmail, setSrTemEmail] = useState(false);
  const [srMaxResults, setSrMaxResults] = useState(200);

  // opções reais de município (IBGE) por UF — Maps/Global dividem `state`
  const cityOptions = useCityOptions(state);
  const srCityOptions = useCityOptions(srUf);
  const consCityOptions = useCityOptions(consUf);

  const loadJobs = useCallback(async () => {
    try {
      const { data } = await api.get("/lead-scraper/jobs");
      // backend pode responder { jobs, count } quando paginado — compat com array
      setJobs(Array.isArray(data) ? data : (data?.jobs || []));
    } catch {}
    finally { setJobsLoaded(true); }
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
        if (data.status === "done" || data.status === "error" || data.status === "cancelled") {
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
        porte: srPorte?.length ? srPorte : undefined,
        capitalSocialMin: srCapitalMin !== "" ? Number(srCapitalMin) : undefined,
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

  const startGlobalJob = async () => {
    const preset = GLOBAL_PRESETS[globalPreset];
    if (!preset && !keyword.trim()) { toast.warning("Preencha a palavra-chave."); return; }
    if (!globalSources.length) { toast.warning("Selecione ao menos uma fonte."); return; }
    setLoading(true);
    try {
      // Refinamento avançado — merge nos DOIS modos (preset e custom).
      // skipClosedPlaces: default do backend é true, só enviamos false.
      // onlyWith/onlyWithout são mutuamente exclusivos (seletor "Site próprio").
      const adv = {
        minRating: gfMinRating !== "" ? Number(gfMinRating) : undefined,
        minReviews: gfMinReviews !== "" ? Number(gfMinReviews) : undefined,
        ...(gfSkipClosed ? {} : { skipClosedPlaces: false }),
        ...(gfSite === "with" ? { onlyWithWebsite: true } : gfSite === "without" ? { onlyWithoutWebsite: true } : {}),
        onlyCellPhone: gfOnlyCell || undefined,
        excludeKeywords: gfExcludeKw.length ? gfExcludeKw : undefined,
        excludeMei: gfExcludeMei || undefined,
        situacao: gfOnlyActive ? ["ATIVA"] : undefined,
        capitalSocialMin: gfCapitalMin !== "" ? Number(gfCapitalMin) : undefined,
        dataAberturaMin: gfAberturaMin || undefined,
        dataAberturaMax: gfAberturaMax || undefined,
      };
      const filters = preset
        ? {
            preset: globalPreset,
            keyword: keyword.trim(),
            keywords: preset.keywords,
            mapQueries: preset.mapQueries,
            cnae: preset.cnae,
            porte: preset.porte,
            city, state, maxResults,
            sources: globalSources,
            conselho: "cau",
            conselhoTipo: preset.conselhoTipo,
            ...adv,
          }
        : {
            keyword: keyword.trim(),
            city, state, maxResults,
            sources: globalSources,
            conselho: "cau",
            conselhoTipo: "ambos",
            ...adv,
          };
      const { data } = await api.post("/lead-scraper/jobs", { source: "global", filters });
      setActiveJob(data);
      setSelectedIndices([]);
      toast.success("Busca global iniciada — todas as fontes em paralelo!");
      startPoll(data.id);
      loadJobs();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao iniciar busca global.");
    }
    finally { setLoading(false); }
  };

  // includeExisting=false (padrão): backend importa só leads novos e pula os que
  // já existem nos contatos; =true importa mesmo os já existentes (atualiza/mescla).
  const importSelected = async (includeExisting = false) => {
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
        includeExisting,
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
    const visibleIndices = displayRows.map(({ i }) => i);
    const allVisibleSelected = visibleIndices.length > 0 && visibleIndices.every(i => selectedIndices.includes(i));
    setSelectedIndices(allVisibleSelected ? [] : visibleIndices);
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

  const stopJob = async (j) => {
    try {
      await api.post(`/lead-scraper/jobs/${j.id}/stop`);
      setJobs(prev => prev.map(x => x.id === j.id ? { ...x, status: "cancelled" } : x));
      if (activeJob?.id === j.id) setActiveJob(prev => prev ? { ...prev, status: "cancelled" } : prev);
      toast.info("Busca cancelada. Leads já coletados permanecem disponíveis.");
      loadJobs();
    } catch (e) { toast.error(e?.response?.data?.error || "Erro ao cancelar busca."); }
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

  // Índices de results NUNCA mudam — indices/import/seleção dependem deles.
  // sort/filtro atuam só na ORDEM/VISIBILIDADE de exibição via displayRows.
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" }); // key: "name"|"phone"|"cnpj"|"rating"|"situacao"
  const [quickFilters, setQuickFilters] = useState({ hasPhone: false, hasCnpj: false, hasWhatsapp: false, hasReceita: false });
  // Busca textual da toolbar de resultados (client-side, só afeta exibição)
  const [resultsSearch, setResultsSearch] = useState("");
  // Filtro de exibição por status de dedupe: "all" | "new" | "existing" | "imported"
  const [dedupeFilter, setDedupeFilter] = useState("all");
  // Âncora do menu de opções do botão Importar (popover)
  const [importMenuAnchor, setImportMenuAnchor] = useState(null);

  // Ao trocar de job, volta o filtro de dedupe para "Todos"
  const activeJobId = activeJob?.id;
  useEffect(() => { setDedupeFilter("all"); }, [activeJobId]);

  const toggleQuickFilter = (key) => setQuickFilters(prev => ({ ...prev, [key]: !prev[key] }));

  const requestSort = (key) => {
    setSortConfig(prev => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" });
  };

  const sortValue = (r, key) => {
    switch (key) {
      case "name": return (r.nomeFantasia || r.name || "").toLowerCase();
      case "phone": return r.phone || "";
      case "cnpj": return r.cnpj || "";
      case "rating": return parseFloat(r.rating) || 0;
      case "situacao": return (r.situacao || "").toLowerCase();
      default: return "";
    }
  };

  const displayRows = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => {
      if (quickFilters.hasPhone && !r.phone) return false;
      if (quickFilters.hasCnpj && !r.cnpj) return false;
      if (quickFilters.hasWhatsapp && !(r.whatsappChecked && r.hasWhatsapp)) return false;
      if (quickFilters.hasReceita && !(r.enrichedFrom || []).includes("receita") && !r.cnaeDescricao) return false;
      // Filtro por status de dedupe (client-side): "Já tenho" agrupa contatos,
      // outra lista e capturado em busca anterior
      if (dedupeFilter !== "all") {
        const cat = leadDedupeCategory(r);
        if (dedupeFilter === "new" && cat !== "new") return false;
        if (dedupeFilter === "imported" && cat !== "imported") return false;
        if (dedupeFilter === "existing" && cat !== "contact" && cat !== "list" && cat !== "job") return false;
        // filtro por tier de score — independente do status de dedupe
        if (dedupeFilter === "gold" && r.leadTier !== "gold") return false;
      }
      // Busca livre: nome, razão social, contatos, CNPJ, endereço, registro e IG
      const q = resultsSearch.trim().toLowerCase();
      if (q) {
        const hay = `${r.nomeFantasia || ""} ${r.name || ""} ${r.razaoSocial || ""} ${r.phone || ""} ${r.instagramPhone || ""} ${r.cnpj || ""} ${r.email || ""} ${r.address || ""} ${r.municipio || ""} ${r.uf || ""} ${r.registro || ""} ${r.instagram || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      const va = sortValue(a.r, sortConfig.key);
      const vb = sortValue(b.r, sortConfig.key);
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortConfig.dir === "asc" ? cmp : -cmp;
    });

  // Contagens por status de dedupe — calculadas no cliente sobre results[]
  // ("existing" = já nos contatos + em outra lista + capturado em busca anterior)
  const leadStatusCounts = useMemo(() => {
    const c = { new: 0, contact: 0, list: 0, job: 0, imported: 0, existing: 0, gold: 0 };
    results.forEach(r => {
      c[leadDedupeCategory(r)] += 1;
      if (r.leadTier === "gold") c.gold += 1;
    });
    c.existing = c.contact + c.list + c.job;
    return c;
  }, [results]);

  // KPIs do strip bento — derivados do job ativo; zerados quando nenhum
  // job está selecionado (loading cobre o carregamento inicial do histórico)
  const kpi = useMemo(() => {
    const waChecked = results.filter(r => r.whatsappChecked).length;
    const waValid = results.filter(r => r.whatsappChecked && r.hasWhatsapp === true).length;
    return {
      leads: activeJob ? (activeJob.totalFound || results.length) : 0,
      novos: activeJob ? leadStatusCounts.new : 0,
      // "na base" = já nos contatos + em outra lista + já importados
      naBase: activeJob ? leadStatusCounts.contact + leadStatusCounts.list + leadStatusCounts.imported : 0,
      waPct: waChecked ? Math.round((waValid / waChecked) * 100) : 0,
    };
  }, [activeJob, results, leadStatusCounts]);

  // Helpers do modal Raio-X — seção e linha (o item some quando não há valor)
  const XraySection = ({ title, children }) => (
    <Box mb={2.5}>
      <div className={classes.xrayTitle}>{title}</div>
      <div className={classes.xrayGrid}>{children}</div>
    </Box>
  );
  const XrayItem = ({ label, children }) => (
    children === null || children === undefined || children === "" || children === false ? null : (
      <div>
        <div className={classes.metaLabel}>{label}</div>
        <div className={classes.xrayValue}>{children}</div>
      </div>
    )
  );

  return (
    <MainContainer useWindowScroll>
      {/* ── Modais ── */}
      <ApifyTokenModal
        open={apifyModalOpen}
        onClose={() => setApifyModalOpen(false)}
        onSaved={loadEngineStatus}
      />
      <ConfirmationModal
        title={confirmDelete?.type === "all" ? "Limpar histórico" : confirmDelete?.type === "stop" ? "Parar busca" : "Excluir busca"}
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target?.type === "all") clearHistory();
          else if (target?.type === "job") deleteJob(target.job);
          else if (target?.type === "stop") stopJob(target.job);
        }}
      >
        {confirmDelete?.type === "all"
          ? "Excluir todo o histórico de buscas? Leads já importados não serão afetados."
          : confirmDelete?.type === "stop"
            ? "Parar esta busca? Os leads já coletados serão mantidos."
            : "Excluir esta busca do histórico? Leads já importados não serão afetados."}
      </ConfirmationModal>

      {/* ── Raio-X do lead — aberto ao clicar na linha/card de resultado ── */}
      <Dialog open={!!xrayLead} onClose={() => setXrayLead(null)} maxWidth="sm" fullWidth>
        {xrayLead && (
          <>
            <DialogTitle disableTypography style={{ paddingBottom: 4 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box style={{ minWidth: 0 }}>
                  <Typography variant="h6" style={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {xrayLead.nomeFantasia || xrayLead.name || "Lead"}
                  </Typography>
                  <Box display="flex" style={{ gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    <LeadTierBadge lead={xrayLead} />
                    <LeadStatusBadges lead={xrayLead} />
                    <SourceBadges lead={xrayLead} />
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => setXrayLead(null)} aria-label="Fechar">
                  <XIcon size={18} />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <XraySection title="Empresa">
                <XrayItem label="Nome fantasia">{xrayLead.nomeFantasia || xrayLead.name}</XrayItem>
                <XrayItem label="Razão social">{xrayLead.razaoSocial}</XrayItem>
                <XrayItem label="CNPJ">
                  {xrayLead.cnpj
                    ? xrayLead.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
                    : null}
                </XrayItem>
                <XrayItem label="CNAE">{xrayLead.cnaeDescricao || xrayLead.cnae}</XrayItem>
                <XrayItem label="Situação">{xrayLead.situacao}</XrayItem>
                <XrayItem label="Porte">{xrayLead.porte}</XrayItem>
                <XrayItem label="Capital social">
                  {xrayLead.capitalSocial ? `R$ ${Number(xrayLead.capitalSocial).toLocaleString("pt-BR")}` : null}
                </XrayItem>
                <XrayItem label="Abertura">{xrayLead.dataAbertura}</XrayItem>
                <XrayItem label="Natureza jurídica">{xrayLead.naturezaJuridica}</XrayItem>
                <XrayItem label="Registro">{xrayLead.registro}</XrayItem>
              </XraySection>

              <XraySection title="Contato">
                <XrayItem label="Telefone">{xrayLead.phone ? formatPhoneBR(xrayLead.phone) : null}</XrayItem>
                <XrayItem label="Telefone (Instagram)">
                  {xrayLead.instagramPhone ? formatPhoneBR(xrayLead.instagramPhone) : null}
                </XrayItem>
                <XrayItem label="E-mail">{xrayLead.email}</XrayItem>
                <XrayItem label="WhatsApp">
                  {xrayLead.whatsappChecked
                    ? (xrayLead.hasWhatsapp ? "✓ ativo" : "✗ sem WhatsApp")
                    : "não verificado"}
                </XrayItem>
              </XraySection>

              <XraySection title="Digital">
                <XrayItem label="Site">
                  {xrayLead.website
                    ? <a href={xrayLead.website} target="_blank" rel="noopener noreferrer">{xrayLead.website}</a>
                    : null}
                </XrayItem>
                {["instagram", "twitter", "linkedin", "facebook"].map(p =>
                  xrayLead[p] ? (
                    <XrayItem key={p} label={p === "twitter" ? "X (Twitter)" : p.charAt(0).toUpperCase() + p.slice(1)}>
                      <a href={SOCIAL_LINKS[p](xrayLead[p])} target="_blank" rel="noopener noreferrer">
                        @{xrayLead[p]}
                      </a>
                    </XrayItem>
                  ) : null
                )}
                <XrayItem label="Google Maps">
                  {xrayLead.googleMapsUrl
                    ? <a href={xrayLead.googleMapsUrl} target="_blank" rel="noopener noreferrer">abrir no Maps</a>
                    : null}
                </XrayItem>
                <XrayItem label="Avaliação">
                  {xrayLead.rating
                    ? `${xrayLead.rating}${xrayLead.reviewsCount != null ? ` (${xrayLead.reviewsCount} avaliações)` : ""}`
                    : null}
                </XrayItem>
              </XraySection>

              <XraySection title="Localização">
                <XrayItem label="Endereço">{xrayLead.address}</XrayItem>
                <XrayItem label="Município">{xrayLead.municipio}</XrayItem>
                <XrayItem label="UF">{xrayLead.uf}</XrayItem>
                <XrayItem label="CEP">{xrayLead.cep}</XrayItem>
              </XraySection>

              <XraySection title="Origem">
                {xrayLead.sources?.length > 0 && (
                  <XrayItem label="Fontes">
                    <Box display="flex" style={{ gap: 3, flexWrap: "wrap" }}>
                      <SourceBadges lead={xrayLead} />
                    </Box>
                  </XrayItem>
                )}
                <XrayItem label="Status">
                  {LEAD_STATUS_META[leadDedupeCategory(xrayLead)].label}
                </XrayItem>
                <XrayItem label="Enriquecido por">
                  {(xrayLead.enrichedFrom || []).length ? xrayLead.enrichedFrom.join(", ") : null}
                </XrayItem>
                <XrayItem label="Busca">
                  {activeJob ? `#${activeJob.id} · ${activeJob.source}` : null}
                </XrayItem>
              </XraySection>

              {(xrayLead.leadScore != null || xrayLead.leadTier) && (
                <XraySection title="Score">
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                      <LeadTierBadge lead={xrayLead} />
                      <Typography variant="body2" style={{ fontWeight: 700 }}>
                        {xrayLead.leadScore ?? "—"}/100
                      </Typography>
                    </Box>
                    <div style={{ height: 6, borderRadius: 3, background: "rgba(127,127,127,0.15)", marginTop: 6, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, xrayLead.leadScore || 0))}%`,
                          height: "100%", borderRadius: 3,
                          background: LEAD_TIER_META[xrayLead.leadTier]?.color || "#3598dc",
                        }}
                      />
                    </div>
                  </div>
                </XraySection>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>

      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
      >
        {/* Strip de KPIs bento — espelha o job ativo (zerado sem job) */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Leads capturados" value={kpi.leads} icon={<LeadIcon size={20} />} accent="var(--primary-color)" loading={!jobsLoaded} />
          <StatCard label="Novos p/ importar" value={kpi.novos} icon={<StarIcon size={20} />} accent="#26c281" loading={!jobsLoaded} />
          <StatCard label="Já na base" value={kpi.naBase} icon={<DatabaseIcon size={20} />} accent="#8e44ad" loading={!jobsLoaded} />
          {/* StatCard sem sufixo: % vai como string pronta */}
          <StatCard label="WhatsApp válido" value={`${kpi.waPct}%`} icon={<WhatsAppIcon style={{ fontSize: 20, color: "#fff" }} />} accent="#f39c12" loading={!jobsLoaded} />
        </div>

      <motion.div variants={itemVariant} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Paper className={`${classes.mainPaper} bento-panel`} variant="outlined">
        {/* ── Cabeçalho padrão: título + subtítulo + ações ── */}
        <div className={classes.header}>
          <div className={classes.headerText}>
            <Title>Captador de Leads</Title>
            <span className={classes.subtitle}>
              Busque e enriqueça leads via Google Maps, Receita Federal, Instagram e conselhos de classe — ou em todas as fontes de uma vez.
            </span>
          </div>
          <div className={classes.headerActions}>
            {/* Status dos motores de busca (Apify/sidecar/Puppeteer) — clique abre o modal de token */}
            <Tooltip title={
              engineStatus?.apify?.configured
                ? "Apify configurado — usado para Maps (quando disponível), Seguidores IG e telefone de bio. Clique para gerenciar o token."
                : "APIFY_TOKEN não configurado — usando fallback local (Puppeteer/DDG). Clique para configurar o token."
            }>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setApifyModalOpen(true)}
                startIcon={<SettingsIcon size={16} />}
                style={{
                  minHeight: 36,
                  textTransform: "none",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  ...(engineStatus?.apify?.configured
                    ? { color: "#2e7d32", borderColor: "#a5d6a7", backgroundColor: "rgba(76,175,80,0.08)" }
                    : {}),
                }}
              >
                Apify {engineStatus?.apify?.configured ? "ativo" : "não configurado"}
              </Button>
            </Tooltip>
            {engineStatus?.googleMaps?.engine && (
              <Chip
                size="small"
                variant="outlined"
                label={`Maps: ${engineStatus.googleMaps.engine}`}
              />
            )}
          </div>
        </div>

        {/* Aviso quando o token Apify não está configurado */}
        {!engineStatus?.apify?.configured && (
          <div className={classes.warnBanner}>
            ⚠ Sem token Apify configurado: Seguidores IG fica indisponível e telefone/e-mail de bio do Instagram usa um fallback mais limitado (sem login). Busca no Maps continua funcionando via sidecar/Puppeteer. Clique no botão "Apify" acima para configurar.
          </div>
        )}

        <motion.div variants={itemVariant} className={classes.pageContent}>
      <Grid container spacing={2}>
        {/* ── Left: form ── */}
        <Grid item xs={12} md={7}>
          <motion.div variants={itemVariant}>
          <Paper className={`${classes.paper} bento-panel`} elevation={0} variant="outlined">
            {/* variant="scrollable": 5 abas com rótulo longo não cabem em 375px sem scroll */}
            <Tabs
              value={tab}
              onChange={(_, v) => { setTab(v); setHelpOpen(false); }}
              indicatorColor="primary"
              textColor="primary"
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><MapsIcon size={16} /> Google Maps</Box>} />
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><CnpjIcon size={16} /> CNPJ / Receita Federal</Box>} />
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><FollowersIcon size={16} /> Seguidores IG</Box>} />
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><ConselhoIcon size={16} /> Conselhos</Box>} />
              <Tab label={<Box display="flex" alignItems="center" style={{ gap: 6 }}><GlobalIcon size={16} /> Busca Global</Box>} />
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
                  options={cityOptions}
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
                  startIcon={<MapsIcon size={16} />}
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
                  min={0} max={1000} step={50}
                  marks={[{ value: 0, label: "∞" }, { value: 500, label: "500" }, { value: 1000, label: "1000" }]}
                />
              </Box>
              <Box mt={2}>
                {canImport && (
                  <Button
                    variant="contained" color="primary"
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon size={18} />}
                    onClick={startMapsJob} disabled={loading}
                    style={{ textTransform: "none", fontWeight: 600 }}
                  >
                    Iniciar Busca no Maps
                  </Button>
                )}
              </Box>
              <Box className={classes.helpToggle} onClick={() => setHelpOpen(o => !o)}>
                <HelpIcon size={15} />
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
                  className={`${classes.modeBtn} ${cnpjMode === "search" ? classes.modeBtnActive : ""}`}
                  onClick={() => setCnpjMode("search")}
                  startIcon={<FilterIcon size={16} />}
                >
                  Pesquisa Avançada
                </Button>
                <Button
                  className={`${classes.modeBtn} ${cnpjMode === "enrich" ? classes.modeBtnActive : ""}`}
                  onClick={() => setCnpjMode("enrich")}
                  startIcon={<CnpjIcon size={16} />}
                >
                  Enriquecer CNPJs
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
                    {canImport && (
                      <Button
                        variant="contained" color="primary"
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CnpjIcon size={18} />}
                        onClick={startCnpjJob} disabled={loading}
                        style={{ textTransform: "none", fontWeight: 600 }}
                      >
                        Enriquecer CNPJs
                      </Button>
                    )}
                  </Box>
                  <Box className={classes.helpToggle} onClick={() => setHelpOpen(o => !o)}>
                    <HelpIcon size={15} />
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
                    <InputLabel>Porte</InputLabel>
                    <Select
                      multiple
                      value={srPorte}
                      onChange={e => setSrPorte(e.target.value)}
                      label="Porte"
                      renderValue={sel => sel.join(", ") || "Todos"}
                    >
                      <MenuItem value="MEI">MEI</MenuItem>
                      <MenuItem value="MICRO EMPRESA">Micro Empresa</MenuItem>
                      <MenuItem value="PEQUENO PORTE">Empresa de Pequeno Porte</MenuItem>
                      <MenuItem value="DEMAIS">Demais (médio/grande)</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    label="Capital social mínimo (R$)"
                    type="number"
                    value={srCapitalMin}
                    onChange={e => setSrCapitalMin(e.target.value)}
                    variant="outlined" size="small"
                    placeholder="ex: 50000"
                    helperText="Filtra por escala — exclui negócios muito pequenos"
                    inputProps={{ min: 0 }}
                  />

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
                    options={srCityOptions}
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
                      Máximo de resultados: <strong>{srMaxResults === 0 ? "sem limite (até 1000)" : srMaxResults}</strong>
                      {srMaxResults > 0 && (
                        <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.6 }}>
                          (~{Math.ceil(srMaxResults * 0.6 / 60)}–{Math.ceil(srMaxResults / 60)} min)
                        </span>
                      )}
                    </Typography>
                    <Slider
                      value={srMaxResults} onChange={(_, v) => setSrMaxResults(v)}
                      min={0} max={1000} step={50}
                      marks={[{ value: 0, label: "∞" }, { value: 500, label: "500" }, { value: 1000, label: "1000" }]}
                    />
                  </Box>

                  <Box className={classes.fullRow}>
                    {canImport && (
                      <Button
                        variant="contained" color="primary"
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon size={18} />}
                        onClick={startCnpjSearchJob} disabled={loading}
                        style={{ textTransform: "none", fontWeight: 600 }}
                      >
                        Pesquisar CNPJs
                      </Button>
                    )}
                  </Box>

                  <Box className={`${classes.fullRow}`}>
                    <Box className={classes.helpToggle} onClick={() => setHelpOpen(o => !o)}>
                      <HelpIcon size={15} />
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
                  min={0} max={1000} step={50}
                  marks={[
                    { value: 0, label: "∞" },
                    { value: 500, label: "500" },
                    { value: 1000, label: "1000" },
                  ]}
                />
                <Box mt={2} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {canImport && (
                    <Button
                      variant="contained" color="primary"
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <FollowersIcon size={18} />}
                      onClick={startFollowersJob}
                      disabled={loading || !engineStatus?.apify?.configured}
                      style={{ textTransform: "none", fontWeight: 600 }}
                    >
                      Buscar Seguidores
                    </Button>
                  )}
                  <Typography variant="caption" color="textSecondary">
                    ~3s entre páginas · contas privadas são ignoradas
                  </Typography>
                </Box>
                <Box className={classes.helpToggle} onClick={() => setHelpOpen(o => !o)}>
                  <HelpIcon size={15} />
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
                  options={consCityOptions}
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
                    min={0} max={1000} step={50}
                    marks={[{ value: 0, label: "∞" }, { value: 500, label: "500" }, { value: 1000, label: "1000" }]}
                  />
                </Box>

                <Box className={classes.fullRow}>
                  {canImport && (
                    <Button
                      variant="contained" color="primary"
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <ConselhoIcon size={18} />}
                      onClick={startConselhoJob} disabled={loading}
                      style={{ textTransform: "none", fontWeight: 600 }}
                    >
                      Buscar no Conselho
                    </Button>
                  )}
                </Box>
              </Box>
            </TabPanel>

            {/* ── Busca Global: seções numeradas — todas as fontes em paralelo ── */}
            <TabPanel value={tab} index={4}>
              {/* 1 — Público: preset vira tile clicável; Personalizado libera keyword + segmento */}
              <div className={classes.gSectionHead}>
                <span className={classes.gSectionNum}>1</span>
                <span className={classes.gSectionTitle}>Público</span>
              </div>
              <div className={classes.presetRow}>
                {[
                  { key: "",           label: "Personalizado",            sub: "keyword livre + segmento",    Icon: PencilIcon },
                  { key: "arquitetos", label: "Arquitetos · Light Design", sub: "projetos luminotécnicos",     Icon: PenToolIcon },
                  { key: "lojistas",   label: "Lojistas · Distribuidores", sub: "iluminação e mat. elétrico",  Icon: ShopIcon },
                ].map(p => {
                  const on = globalPreset === p.key;
                  const IconCmp = p.Icon;
                  return (
                    <div
                      key={p.key || "custom"}
                      className={`${classes.presetTile} ${on ? classes.presetTileOn : ""}`}
                      onClick={() => {
                        setGlobalPreset(p.key);
                        if (p.key && GLOBAL_PRESETS[p.key]) setGlobalSources(GLOBAL_PRESETS[p.key].defaultSources);
                      }}
                    >
                      <Box display="flex" alignItems="center" style={{ gap: 6 }}>
                        <IconCmp size={15} />
                        <Typography style={{ fontSize: 12, fontWeight: 700 }}>{p.label}</Typography>
                      </Box>
                      <Typography variant="caption" color="textSecondary">{p.sub}</Typography>
                    </div>
                  );
                })}
              </div>
              {!globalPreset && (
                <Box className={classes.filterRow} style={{ marginTop: 10 }}>
                  <TextField
                    label="Palavra-chave" placeholder="ex: iluminação, arquitetura, academia"
                    value={keyword} onChange={e => setKeyword(e.target.value)}
                    variant="outlined" size="small" style={{ flex: 2, minWidth: 180 }}
                  />
                  <Autocomplete
                    options={SEGMENT_PRESETS}
                    getOptionLabel={opt => opt.label}
                    value={segGlobal}
                    onChange={(_, val) => { setSegGlobal(val); if (val) setKeyword(val.mapsKeyword); }}
                    renderInput={params => (
                      <TextField {...params} label="Segmento (atalho)" variant="outlined" size="small"
                        placeholder="ex: Odontologia" />
                    )}
                    noOptionsText="Nenhum segmento"
                    clearOnEscape
                    style={{ flex: 2, minWidth: 180 }}
                  />
                </Box>
              )}
              {globalPreset && GLOBAL_PRESETS[globalPreset] && (
                <Box mt={1.5} mb={0.5}>
                  <Typography variant="body2" style={{ fontWeight: 600, fontSize: 12 }}>
                    {GLOBAL_PRESETS[globalPreset].label} — busca:
                  </Typography>
                  <Box display="flex" style={{ gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                    {GLOBAL_PRESETS[globalPreset].mapQueries.map(q => (
                      <Chip key={q} size="small" label={q} variant="outlined" color="primary" />
                    ))}
                    {GLOBAL_PRESETS[globalPreset].keywords.map(q => (
                      <Chip key={q} size="small" label={`RF: ${q}`} variant="outlined" color="secondary" />
                    ))}
                    {GLOBAL_PRESETS[globalPreset].cnae.map(c => (
                      <Chip key={c} size="small" label={`CNAE ${c}`} variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}

              {/* 2 — Onde */}
              <div className={classes.gSectionHead}>
                <span className={classes.gSectionNum}>2</span>
                <span className={classes.gSectionTitle}>Onde</span>
              </div>
              <Box className={classes.filterRow} style={{ marginTop: 0 }}>
                <Autocomplete
                  multiple freeSolo
                  options={cityOptions}
                  value={city}
                  onChange={(_, val) => setCity(val)}
                  renderTags={(val, getTagProps) => val.map((opt, i) => (
                    <Chip variant="outlined" size="small" label={opt} {...getTagProps({ index: i })} key={opt} />
                  ))}
                  renderInput={params => (
                    <TextField {...params} label="Cidade" placeholder="São Paulo"
                      variant="outlined" size="small" />
                  )}
                  style={{ flex: 2, minWidth: 160 }}
                />
                <FormControl variant="outlined" size="small" style={{ minWidth: 100, flex: 1 }}>
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

              {/* 3 — Fontes: toggle-cards com badge de custo por fonte */}
              <div className={classes.gSectionHead}>
                <span className={classes.gSectionNum}>3</span>
                <span className={classes.gSectionTitle}>Fontes</span>
              </div>
              <Box display="flex" style={{ gap: 8, flexWrap: "wrap" }}>
                {GLOBAL_SOURCE_CARDS.map(s => {
                  const on = globalSources.includes(s.key);
                  const IconCmp = s.Icon;
                  const cost = s.key === "google_maps"
                    ? (engineStatus?.apify?.configured ? "créditos Apify" : "grátis local")
                    : "grátis";
                  return (
                    <div
                      key={s.key}
                      className={`${classes.sourceCard} ${on ? classes.sourceCardOn : classes.sourceCardOff}`}
                      onClick={() => setGlobalSources(prev =>
                        on ? prev.filter(x => x !== s.key) : [...prev, s.key]
                      )}
                    >
                      <Box display="flex" alignItems="center" style={{ gap: 6 }}>
                        <IconCmp size={15} />
                        <Typography style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{s.label}</Typography>
                        {on && <CheckIcon size={14} />}
                      </Box>
                      <Typography variant="caption" color="textSecondary">{s.hint}</Typography>
                      <span className={classes.costBadge}>{cost}</span>
                    </div>
                  );
                })}
              </Box>

              {/* 4 — Refinamento avançado: accordion com micro-badge da fonte afetada */}
              <div className={classes.gSectionHead}>
                <span className={classes.gSectionNum}>4</span>
                <span className={classes.gSectionTitle}>Refinamento avançado</span>
              </div>
              <Box className={classes.helpToggle} style={{ marginTop: 0 }} onClick={() => setAdvOpen(o => !o)}>
                <SlidersIcon size={15} />
                <span>{advOpen ? "Ocultar refinamentos" : "Ajustar filtros finos por fonte"}</span>
                <ChevronDownIcon
                  size={14}
                  style={{
                    transform: advOpen ? "rotate(180deg)" : "none",
                    transition: "transform 150ms ease",
                  }}
                />
              </Box>
              <Collapse in={advOpen}>
                <div className={classes.advGrid}>
                  <div>
                    <FormControlLabel
                      style={{ marginLeft: 0 }}
                      control={<Switch size="small" color="primary" checked={gfSkipClosed} onChange={e => setGfSkipClosed(e.target.checked)} />}
                      label={<Typography variant="body2">Pular estabelecimentos fechados<span className={classes.srcTag}>Maps</span></Typography>}
                    />
                  </div>
                  <div>
                    <span className={classes.advLabel}>Nota mínima<span className={classes.srcTag}>Maps</span></span>
                    <Select
                      variant="outlined" displayEmpty
                      value={gfMinRating} onChange={e => setGfMinRating(e.target.value)}
                      style={{ fontSize: 13, width: "100%" }}
                    >
                      <MenuItem value="">Qualquer</MenuItem>
                      <MenuItem value="3">3.0+</MenuItem>
                      <MenuItem value="3.5">3.5+</MenuItem>
                      <MenuItem value="4">4.0+</MenuItem>
                      <MenuItem value="4.5">4.5+</MenuItem>
                    </Select>
                  </div>
                  <div>
                    <span className={classes.advLabel}>Mín. de avaliações<span className={classes.srcTag}>Maps</span></span>
                    <Select
                      variant="outlined" displayEmpty
                      value={gfMinReviews} onChange={e => setGfMinReviews(e.target.value)}
                      style={{ fontSize: 13, width: "100%" }}
                    >
                      <MenuItem value="">Qualquer</MenuItem>
                      <MenuItem value="5">5+</MenuItem>
                      <MenuItem value="10">10+</MenuItem>
                      <MenuItem value="25">25+</MenuItem>
                      <MenuItem value="50">50+</MenuItem>
                    </Select>
                  </div>
                  <div>
                    <span className={classes.advLabel}>Site próprio<span className={classes.srcTag}>Todas</span></span>
                    <Select
                      variant="outlined"
                      value={gfSite} onChange={e => setGfSite(e.target.value)}
                      style={{ fontSize: 13, width: "100%" }}
                    >
                      <MenuItem value="any">Qualquer</MenuItem>
                      <MenuItem value="with">Só com site</MenuItem>
                      <MenuItem value="without">Só sem site</MenuItem>
                    </Select>
                  </div>
                  <div>
                    <FormControlLabel
                      style={{ marginLeft: 0 }}
                      control={<Switch size="small" color="primary" checked={gfOnlyCell} onChange={e => setGfOnlyCell(e.target.checked)} />}
                      label={<Typography variant="body2">Apenas celular (WhatsApp-ready)<span className={classes.srcTag}>Todas</span></Typography>}
                    />
                  </div>
                  <div>
                    <FormControlLabel
                      style={{ marginLeft: 0 }}
                      control={<Switch size="small" color="primary" checked={gfOnlyActive} onChange={e => setGfOnlyActive(e.target.checked)} />}
                      label={<Typography variant="body2">Apenas empresas ativas<span className={classes.srcTag}>Receita</span></Typography>}
                    />
                  </div>
                  <div>
                    <FormControlLabel
                      style={{ marginLeft: 0 }}
                      control={<Switch size="small" color="primary" checked={gfExcludeMei} onChange={e => setGfExcludeMei(e.target.checked)} />}
                      label={<Typography variant="body2">Excluir MEI<span className={classes.srcTag}>Receita</span></Typography>}
                    />
                  </div>
                  <div>
                    <span className={classes.advLabel}>Capital social mínimo (R$)<span className={classes.srcTag}>Receita</span></span>
                    <TextField
                      type="number" variant="outlined" size="small" fullWidth
                      placeholder="ex: 50000"
                      value={gfCapitalMin} onChange={e => setGfCapitalMin(e.target.value)}
                      inputProps={{ min: 0 }}
                    />
                  </div>
                  <div>
                    <span className={classes.advLabel}>Abertas a partir de<span className={classes.srcTag}>Receita</span></span>
                    <TextField
                      type="date" variant="outlined" size="small" fullWidth
                      value={gfAberturaMin} onChange={e => setGfAberturaMin(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </div>
                  <div>
                    <span className={classes.advLabel}>Abertas até<span className={classes.srcTag}>Receita</span></span>
                    <TextField
                      type="date" variant="outlined" size="small" fullWidth
                      value={gfAberturaMax} onChange={e => setGfAberturaMax(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </div>
                  <div className={classes.fullRow}>
                    <Autocomplete
                      multiple freeSolo
                      options={[]}
                      value={gfExcludeKw}
                      onChange={(_, val) => setGfExcludeKw(val)}
                      renderTags={(val, getTagProps) => val.map((opt, i) => (
                        <Chip variant="outlined" size="small" label={opt} {...getTagProps({ index: i })} key={opt} />
                      ))}
                      renderInput={params => (
                        <TextField
                          {...params} variant="outlined" size="small"
                          label={<>Excluir termos do nome<span className={classes.srcTag}>Todas</span></>}
                          placeholder="ex.: distribuidora"
                        />
                      )}
                    />
                  </div>
                </div>
              </Collapse>

              {/* 5 — Limite + CTA */}
              <div className={classes.gSectionHead}>
                <span className={classes.gSectionNum}>5</span>
                <span className={classes.gSectionTitle}>Limite e busca</span>
              </div>
              <Box className={classes.sliderBox} style={{ minWidth: 0 }}>
                <Typography variant="body2" style={{ marginBottom: 6 }}>
                  Máximo de resultados <em>por fonte</em>: <strong>{maxResults === 0 ? "sem limite" : maxResults}</strong>
                </Typography>
                <Slider
                  value={maxResults} onChange={(_, v) => setMaxResults(v)}
                  min={0} max={1000} step={50}
                  marks={[{ value: 0, label: "∞" }, { value: 500, label: "500" }, { value: 1000, label: "1000" }]}
                />
              </Box>
              {canImport && (
                <Button
                  variant="contained" color="primary" fullWidth size="large"
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <GlobalIcon size={18} />}
                  onClick={startGlobalJob} disabled={loading || !globalSources.length}
                  style={{ textTransform: "none", fontWeight: 700, marginTop: 4 }}
                >
                  Buscar em todas as fontes
                </Button>
              )}
              <Typography variant="caption" color="textSecondary" style={{ display: "block", textAlign: "center", marginTop: 6 }}>
                {globalSources.length} fonte{globalSources.length !== 1 ? "s" : ""} ativa{globalSources.length !== 1 ? "s" : ""} · dedup automático · enriquecimento só em leads novos
              </Typography>

              <Box className={classes.helpToggle} onClick={() => setHelpOpen(o => !o)}>
                <HelpIcon size={15} />
                <span>{helpOpen ? "Ocultar tutorial" : "Como funciona?"}</span>
              </Box>
              <Collapse in={helpOpen}>
                <Box className={classes.helpBox}>
                  <strong>Busca Global — uma busca, todas as fontes</strong>
                  <ol>
                    <li>Digite o <strong>segmento</strong> e a <strong>localização</strong>. As fontes selecionadas rodam <strong>em paralelo</strong>.</li>
                    <li>O sistema <strong>cruza os resultados</strong>: a mesma empresa encontrada no Maps e na Receita vira <strong>um único lead</strong> com os dados de todas as fontes (badge mostra as origens).</li>
                    <li>Matches por CNPJ, telefone ou Instagram são 100% precisos; por nome+UF são conservadores.</li>
                    <li>Se uma fonte falhar, as demais continuam e a falha aparece no log.</li>
                    <li>Depois do merge, o pipeline normal roda: dedupe global, enriquecimento Receita/social e validação WhatsApp.</li>
                  </ol>
                </Box>
              </Collapse>
            </TabPanel>
          </Paper>
          </motion.div>
        </Grid>

        {/* ── Right: jobs history ── */}
        <Grid item xs={12} md={5} style={{ display: "flex" }}>
          <motion.div variants={itemVariant} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Paper
            className={`${classes.paper} bento-panel`}
            elevation={0}
            variant="outlined"
            style={{ minHeight: 200, maxHeight: 560, display: "flex", flexDirection: "column", flex: 1 }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" style={{ marginBottom: 12, flexShrink: 0 }}>
              <Typography variant="subtitle1" style={{ fontWeight: 700 }}>Histórico de Buscas</Typography>
              <Box display="flex" alignItems="center">
                {canImport && (
                  <Tooltip title="Limpar histórico">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => setConfirmDelete({ type: "all" })}
                        disabled={!jobs.some(j => j.status === "done" || j.status === "error" || j.status === "cancelled")}
                      >
                        <ClearIcon size={16} />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
                <Tooltip title="Recarregar">
                  <IconButton size="small" onClick={loadJobs}><RefreshIcon size={16} /></IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Box style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {!jobsLoaded ? (
              /* Skeleton do histórico enquanto o primeiro carregamento não retorna */
              <>
                {[0, 1, 2].map(k => (
                  <Skeleton key={k} variant="rect" height={54} style={{ borderRadius: 8, marginBottom: 6 }} />
                ))}
              </>
            ) : jobs.length === 0 ? (
              <div className={classes.emptyState}>
                <LeadIcon size={40} style={{ opacity: 0.35 }} />
                <Typography variant="body2" color="textSecondary">Nenhuma busca iniciada ainda.</Typography>
              </div>
            ) : (
              jobs.map(j => {
                const st = STATUS[j.status] || STATUS.pending;
                const isActive = activeJob?.id === j.id;
                const asStr = v => Array.isArray(v) ? v.join(", ") : v;
                const jobName = j.source === "global"
                  ? `🌐 ${(j.filters?.preset && GLOBAL_PRESETS[j.filters.preset]?.label) || j.filters?.keyword || "?"} — ${asStr(j.filters?.city) || asStr(j.filters?.state) || "Brasil"}`
                  : j.source === "google_maps"
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
                      <DotIcon className={classes.runningPulse} size={12} fill="currentColor" />
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
                    {canImport && (j.status === "pending" || j.status === "running") && (
                      <Tooltip title="Parar busca">
                        <IconButton
                          size="small"
                          className={classes.jobActionBtn}
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "stop", job: j }); }}
                        >
                          <StopIcon size={15} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canImport && (j.status === "done" || j.status === "error" || j.status === "cancelled") && (
                      <Tooltip title="Excluir busca">
                        <IconButton
                          size="small"
                          className={classes.jobActionBtn}
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "job", job: j }); }}
                        >
                          <DeleteIcon size={15} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                );
              })
            )}
            </Box>
          </Paper>
          </motion.div>
        </Grid>
      </Grid>

      {/* ── Active job results ── */}
      {activeJob && (
        <motion.div variants={itemVariant}>
        <Paper className={`${classes.paper} bento-panel`} elevation={0} variant="outlined">
          <Box className={classes.resultsHeader}>
            <Box display="flex" alignItems="center" style={{ gap: 12 }}>
              <Typography variant="h6" style={{ fontWeight: 700 }}>Resultados</Typography>
              <Box className={classes.sourceBadge}>
                {activeJob.source === "global" ? <GlobalIcon size={12} />
                  : activeJob.source === "google_maps" ? <MapsIcon size={12} />
                  : activeJob.source === "ig_followers" ? <InstagramIcon size={12} />
                  : activeJob.source === "conselho" ? <ConselhoIcon size={12} />
                  : <CnpjIcon size={12} />}
                {activeJob.source === "global" ? "Busca Global"
                  : activeJob.source === "google_maps" ? "Google Maps"
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
              {canImport && isRunning && (
                <Tooltip title="Parar busca — leads já coletados serão mantidos">
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    startIcon={<StopIcon size={14} />}
                    onClick={() => setConfirmDelete({ type: "stop", job: activeJob })}
                    style={{ fontSize: 11, textTransform: "none", fontWeight: 700 }}
                  >
                    Parar
                  </Button>
                </Tooltip>
              )}
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
            <div className={classes.emptyState}>
              <SearchIcon size={44} style={{ opacity: 0.35 }} />
              <Typography variant="subtitle1">Nenhum resultado encontrado</Typography>
              <Typography variant="body2">Tente ajustar os filtros ou expandir a área de busca.</Typography>
            </div>
          ) : results.length > 0 ? (
            <>
              {/* Resumo de dedupe + filtro por status — topo da seção de resultados */}
              <div className={classes.summaryBar}>
                <div className={classes.summaryStats}>
                  <span className={classes.summaryStat}><i style={{ background: "#f39c12" }} />{leadStatusCounts.new} novos</span>
                  <span className={classes.summaryStat}><i style={{ background: "#3598dc" }} />{leadStatusCounts.contact} já nos contatos</span>
                  <span className={classes.summaryStat}><i style={{ background: "#8e44ad" }} />{leadStatusCounts.list} em outra lista</span>
                  <span className={classes.summaryStat}><i style={{ background: "#26c281" }} />{leadStatusCounts.imported} importados</span>
                  {leadStatusCounts.job > 0 && (
                    <span className={classes.summaryStat}><i style={{ background: "#757575" }} />{leadStatusCounts.job} já capturados</span>
                  )}
                </div>
                <Box display="flex" alignItems="center" style={{ gap: 6, flexWrap: "wrap" }}>
                  {[
                    { key: "all",      label: "Todos",      count: results.length },
                    { key: "new",      label: "Novos",      count: leadStatusCounts.new },
                    { key: "existing", label: "Já tenho",   count: leadStatusCounts.existing },
                    { key: "imported", label: "Importados", count: leadStatusCounts.imported },
                    { key: "gold",     label: "🏆 Ouro",    count: leadStatusCounts.gold },
                  ].map(f => (
                    <Chip
                      key={f.key}
                      label={`${f.label} (${f.count})`}
                      size="small"
                      clickable
                      onClick={() => setDedupeFilter(f.key)}
                      style={{
                        fontSize: 11, fontWeight: 600,
                        background: dedupeFilter === f.key ? "#c62828" : undefined,
                        color: dedupeFilter === f.key ? "#fff" : undefined,
                      }}
                    />
                  ))}
                </Box>
              </div>

              {/* Toolbar: busca livre + filtros rápidos (client-side, só exibição) */}
              <div className={classes.toolbar}>
                <TextField
                  className={classes.searchField}
                  size="small"
                  variant="outlined"
                  placeholder="Buscar por nome, telefone, CNPJ…"
                  value={resultsSearch}
                  onChange={e => setResultsSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon size={16} />
                      </InputAdornment>
                    ),
                  }}
                />
                {[
                  { key: "hasPhone", label: "Com telefone" },
                  { key: "hasWhatsapp", label: "Com WhatsApp" },
                  { key: "hasCnpj", label: "Com CNPJ" },
                  { key: "hasReceita", label: "Com dados da Receita" },
                ].map(f => (
                  <Chip
                    key={f.key}
                    label={f.label}
                    size="small"
                    clickable
                    onClick={() => toggleQuickFilter(f.key)}
                    style={{
                      fontSize: 11, fontWeight: 600,
                      background: quickFilters[f.key] ? "#c62828" : undefined,
                      color: quickFilters[f.key] ? "#fff" : undefined,
                    }}
                  />
                ))}
                {displayRows.length !== results.length && (
                  <Typography variant="caption" color="textSecondary" style={{ alignSelf: "center", marginLeft: 4 }}>
                    {displayRows.length} de {results.length} exibidos
                  </Typography>
                )}
              </div>

              {/* Cards — mobile */}
              <div className={classes.mobileList}>
                {displayRows.map(({ r, i }) => (
                  <div
                    key={i}
                    className={classes.card}
                    style={{ cursor: "pointer" }}
                    onClick={() => setXrayLead(r)}
                  >
                    <div className={classes.cardHeader}>
                      <div className={classes.cardTitle}>
                        <Checkbox
                          checked={selectedIndices.includes(i)}
                          onChange={() => toggleSelect(i)}
                          onClick={e => e.stopPropagation()}
                          size="small"
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div className={classes.cardName}>{r.nomeFantasia || r.name || "—"}</div>
                            <LeadTierBadge lead={r} />
                          </div>
                          {r.razaoSocial && r.razaoSocial !== r.name && (
                            <Typography variant="caption" color="textSecondary" style={{ display: "block" }}>
                              {r.razaoSocial}
                            </Typography>
                          )}
                        </div>
                      </div>
                      {/* Badges: status de dedupe + fontes (busca global) */}
                      <Box display="flex" style={{ gap: 3, flexWrap: "wrap", flexShrink: 0, justifyContent: "flex-end", maxWidth: "55%" }}>
                        <LeadStatusBadges lead={r} />
                        <SourceBadges lead={r} />
                      </Box>
                    </div>

                    <div className={classes.cardMeta}>
                      <div>
                        <div className={classes.metaLabel}>Telefone</div>
                        <div className={classes.metaValue}>
                          <Box display="flex" alignItems="center" style={{ gap: 4 }}>
                            {r.phone ? formatPhoneBR(r.phone) : "—"}
                            {r.whatsappChecked && r.hasWhatsapp && (
                              <Tooltip title="WhatsApp ativo (validado)">
                                <WhatsAppIcon style={{ fontSize: 15, color: "#25d366" }} />
                              </Tooltip>
                            )}
                            {r.whatsappChecked && r.hasWhatsapp === false && (
                              <span style={{ color: "#9e9e9e", fontSize: 11 }}>sem WA</span>
                            )}
                          </Box>
                          {r.instagramPhone && r.instagramPhone !== r.phone && (
                            <Typography variant="caption" style={{ display: "block", color: SOCIAL_COLORS.instagram, fontSize: 11 }}>
                              📸 {formatPhoneBR(r.instagramPhone)}
                            </Typography>
                          )}
                        </div>
                      </div>
                      {activeJob.source === "conselho" && (
                        <div>
                          <div className={classes.metaLabel}>Registro</div>
                          <div className={classes.metaValue} style={{ fontFamily: "monospace" }}>{r.registro || "—"}</div>
                        </div>
                      )}
                      <div>
                        <div className={classes.metaLabel}>CNPJ</div>
                        <div className={classes.metaValue} style={{ fontFamily: "monospace", fontWeight: 500 }}>
                          {r.cnpj
                            ? r.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
                            : r.website
                              ? <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }} onClick={e => e.stopPropagation()}>site</a>
                              : "—"}
                          {(r.enrichedFrom || []).includes("receita") && (
                            <Chip label="RF" size="small"
                              style={{ fontSize: 9, height: 16, fontWeight: 700, background: "#e8f5e9", color: "#2e7d32", marginLeft: 4 }} />
                          )}
                        </div>
                      </div>
                      <div>
                        <div className={classes.metaLabel}>Endereço</div>
                        <div className={classes.metaValue} style={{ fontWeight: 500 }}>
                          {r.address || (r.municipio ? `${r.municipio}/${r.uf}` : "—")}
                        </div>
                      </div>
                      <div>
                        <div className={classes.metaLabel}>Receita</div>
                        <div className={classes.metaValue}>
                          {(r.cnaeDescricao || r.porte || r.situacao || r.naturezaJuridica || r.capitalSocial) ? (
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
                          ) : "—"}
                        </div>
                      </div>
                      <div>
                        <div className={classes.metaLabel}>Avaliação</div>
                        <div className={classes.metaValue}>
                          <span className={classes.rating}>
                            <Stars value={r.rating} />
                            {r.reviewsCount != null && (
                              <span style={{ fontSize: 10, opacity: 0.7 }}> ({r.reviewsCount})</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Redes sociais — stopPropagation p/ não abrir o Raio-X ao clicar num link */}
                    <div className={classes.cardActions} onClick={e => e.stopPropagation()}>
                      {["instagram","twitter","linkedin","facebook"].map(p =>
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
                      {r.email && (
                        <Typography variant="caption" color="textSecondary" style={{ marginLeft: 4 }}>
                          {r.email}
                        </Typography>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tabela — desktop */}
              <div className={classes.desktopTableWrapper}>
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
                      <SortableHeader className={`${classes.stickyHead} ${classes.headCell}`} label="NOME" sortKey="name" sortConfig={sortConfig} onSort={requestSort} />
                      {activeJob.source === "conselho" && (
                        <TableCell className={`${classes.stickyHead} ${classes.headCell}`}>REGISTRO</TableCell>
                      )}
                      <SortableHeader className={`${classes.stickyHead} ${classes.headCell}`} label="TELEFONE" sortKey="phone" sortConfig={sortConfig} onSort={requestSort} />
                      <TableCell className={`${classes.stickyHead} ${classes.headCell}`}>REDES SOCIAIS</TableCell>
                      <TableCell className={`${classes.stickyHead} ${classes.headCell}`}>ENDEREÇO</TableCell>
                      <SortableHeader className={`${classes.stickyHead} ${classes.headCell}`} label="CNPJ" sortKey="cnpj" sortConfig={sortConfig} onSort={requestSort} />
                      <SortableHeader className={`${classes.stickyHead} ${classes.headCell}`} label="RECEITA" sortKey="situacao" sortConfig={sortConfig} onSort={requestSort} />
                      {activeJob.source === "conselho" && (
                        <TableCell className={`${classes.stickyHead} ${classes.headCell}`}>STATUS</TableCell>
                      )}
                      <SortableHeader className={`${classes.stickyHead} ${classes.headCell}`} label="AVALIAÇÃO" sortKey="rating" sortConfig={sortConfig} onSort={requestSort} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayRows.map(({ r, i }) => (
                      <TableRow
                        key={i} hover selected={selectedIndices.includes(i)}
                        className={classes.rowHover}
                        style={{ cursor: "pointer" }}
                        onClick={() => setXrayLead(r)}
                      >
                        <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIndices.includes(i)}
                            onChange={() => toggleSelect(i)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell className={classes.bodyCell}>
                          <Box display="flex" alignItems="center" style={{ gap: 6 }}>
                            <Typography variant="body2" style={{ fontWeight: 600, fontSize: 12 }}>
                              {r.nomeFantasia || r.name || "—"}
                            </Typography>
                            <LeadTierBadge lead={r} />
                          </Box>
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
                          {/* Badges: status de dedupe + fontes (busca global) */}
                          <Box display="flex" style={{ gap: 3, marginTop: 2, flexWrap: "wrap" }}>
                            <LeadStatusBadges lead={r} />
                            <SourceBadges lead={r} />
                          </Box>
                        </TableCell>
                        {activeJob.source === "conselho" && (
                          <TableCell className={classes.bodyCell}>
                            <Typography variant="body2" style={{ fontSize: 11, fontFamily: "monospace" }}>
                              {r.registro || "—"}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell className={classes.bodyCell} style={{ whiteSpace: "nowrap" }}>
                          <Box display="flex" alignItems="center" style={{ gap: 4 }}>
                            <Typography variant="body2" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                              {r.phone ? formatPhoneBR(r.phone) : "—"}
                            </Typography>
                            {r.whatsappChecked && r.hasWhatsapp && (
                              <Tooltip title="WhatsApp ativo (validado)">
                                <WhatsAppIcon style={{ fontSize: 15, color: "#25d366" }} />
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
                        <TableCell className={classes.bodyCell} onClick={e => e.stopPropagation()}>
                          <Box display="flex" style={{ gap: 4, flexWrap: "wrap" }}>
                            {["instagram","twitter","linkedin","facebook"].map(p =>
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
                            {!r.instagram && !r.twitter && !r.linkedin && !r.facebook && (
                              <Typography variant="caption" color="textSecondary">—</Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell className={classes.bodyCell}>
                          <Typography variant="body2" style={{ fontSize: 12 }}>
                            {r.address || (r.municipio ? `${r.municipio}/${r.uf}` : "—")}
                          </Typography>
                        </TableCell>
                        <TableCell className={classes.bodyCell} style={{ whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                          <Box display="flex" alignItems="center" style={{ gap: 4 }}>
                            <Typography variant="body2" style={{ fontSize: 11, fontFamily: "monospace", whiteSpace: "nowrap" }}>
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
                        <TableCell className={classes.bodyCell}>
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
                          <TableCell className={classes.bodyCell}>
                            <Chip
                              label={r.situacao || "—"}
                              size="small"
                              style={{ fontSize: 10, height: 20, fontWeight: 600 }}
                            />
                          </TableCell>
                        )}
                        <TableCell className={classes.bodyCell}>
                          <span className={classes.rating}>
                            <Stars value={r.rating} />
                            {r.reviewsCount != null && (
                              <span style={{ fontSize: 10, opacity: 0.7 }}> ({r.reviewsCount})</span>
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              </div>

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
                {canImport && (
                  <>
                    {/* Split button: ação padrão importa só leads novos; a seta abre
                        o menu com "importar incluindo já existentes" */}
                    <Box style={{ display: "flex", alignItems: "stretch" }}>
                      <Button
                        variant="contained" color="primary"
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <ImportIcon size={18} />}
                        onClick={() => importSelected(false)}
                        disabled={loading || (activeJob.status !== "done" && activeJob.status !== "cancelled")}
                        style={{
                          textTransform: "none", fontWeight: 600, whiteSpace: "nowrap",
                          borderTopRightRadius: 0, borderBottomRightRadius: 0,
                        }}
                      >
                        {someSelected
                          ? `Importar ${selectedIndices.length} lead${selectedIndices.length !== 1 ? "s" : ""}`
                          : `Importar apenas novos (${leadStatusCounts.new})`}
                      </Button>
                      <Button
                        variant="contained" color="primary"
                        onClick={e => setImportMenuAnchor(e.currentTarget)}
                        disabled={loading || (activeJob.status !== "done" && activeJob.status !== "cancelled")}
                        style={{
                          minWidth: 34, padding: "0 6px",
                          borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
                          borderLeft: "1px solid rgba(255,255,255,0.35)",
                          boxShadow: "none",
                        }}
                      >
                        <ChevronDownIcon size={16} />
                      </Button>
                    </Box>
                    <Menu
                      anchorEl={importMenuAnchor}
                      open={Boolean(importMenuAnchor)}
                      onClose={() => setImportMenuAnchor(null)}
                      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                      transformOrigin={{ vertical: "top", horizontal: "right" }}
                    >
                      <MenuItem onClick={() => { setImportMenuAnchor(null); importSelected(false); }}>
                        Importar apenas novos
                      </MenuItem>
                      <MenuItem onClick={() => { setImportMenuAnchor(null); importSelected(true); }}>
                        Importar incluindo já existentes
                      </MenuItem>
                    </Menu>
                  </>
                )}
              </Box>
            </>
          ) : null}
        </Paper>
        </motion.div>
      )}
        </motion.div>
      </Paper>
      </motion.div>
      </motion.div>
    </MainContainer>
  );
}
