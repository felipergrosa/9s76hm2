import React, { useState, useEffect, useContext, useMemo } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import {
  Paper,
  Grid,
  TextField,
  Typography,
  Button,
  CircularProgress,
  AppBar,
  Tabs,
  Tab,
  Box,
  Chip,
  IconButton,
  Tooltip,
  MenuItem,
  ExpansionPanel,
  ExpansionPanelSummary,
  ExpansionPanelDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@material-ui/core";
import { Alert, AlertTitle } from "@material-ui/lab";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import FileCopyIcon from "@material-ui/icons/FileCopy";
import SendIcon from "@material-ui/icons/Send";
import WarningIcon from "@material-ui/icons/Warning";
import axios from "axios";
import { toast } from "react-toastify";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";

import MainContainer from "../../components/MainContainer";
import { motion, useReducedMotion } from "framer-motion";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

// Token padrão exibido na página (mesmo já exposto hoje). O acesso à tela
// continua protegido pela permissão "external-api.view" na rota/menu.
const DEFAULT_API_TOKEN = "qsFj2s8e2XY85oHcNMAvEw";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(3),
    // Segue a superfície do tema (bento-panel)
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius * 2,
  },
  title: {
    marginBottom: theme.spacing(1),
    fontWeight: "bold",
  },
  subtitle: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  alert: {
    marginBottom: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
  },
  tokenRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  tabPanel: {
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
  },
  endpointPanel: {
    marginBottom: theme.spacing(1),
    borderRadius: `${theme.shape.borderRadius}px !important`,
    "&:before": { display: "none" },
  },
  endpointSummary: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
  },
  methodChip: {
    fontWeight: "bold",
    minWidth: 64,
    justifyContent: "center",
  },
  mono: {
    fontFamily: '"Fira Code", "Courier New", Courier, monospace',
    fontSize: "13px",
  },
  endpointDescription: {
    width: "100%",
    color: theme.palette.text.secondary,
  },
  formContainer: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  codeBlock: {
    backgroundColor: "#2d2d2d",
    color: "#f8f8f2",
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    fontFamily: '"Fira Code", "Courier New", Courier, monospace',
    whiteSpace: "pre-wrap",
    fontSize: "13px",
    overflowX: "auto",
    margin: 0,
  },
  submitButton: {
    padding: theme.spacing(1, 4),
    fontWeight: "bold",
    alignSelf: "flex-start",
  },
  formField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: theme.shape.borderRadius * 2,
    },
    "& .MuiInputLabel-outlined": {
      transform: "translate(14px, 14px) scale(1)",
    },
    "& .MuiInputLabel-outlined.MuiInputLabel-shrink": {
      transform: "translate(14px, -6px) scale(0.75)",
    },
  },
  responseHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  groupHeader: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1),
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: theme.palette.text.secondary,
  },
}));

// Cores por método HTTP (mesma palette de accents do bento)
const METHOD_COLORS = {
  GET: "#3598dc",
  POST: "#26c281",
  PUT: "#f39c12",
  DELETE: "#e7505a",
};

const MethodChip = ({ method }) => (
  <Chip
    size="small"
    label={method}
    style={{ backgroundColor: METHOD_COLORS[method] || "#666", color: "#fff" }}
  />
);

function TabPanel(props) {
  const { children, value, index, classes, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`api-tabpanel-${index}`}
      aria-labelledby={`api-tab-${index}`}
      {...other}
    >
      {value === index && <Box className={classes.tabPanel}>{children}</Box>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catálogo de endpoints — derivado dos controllers/rotas reais do backend:
//  - routes/apiRoutes.ts        -> /api/messages/* (isAuthCompany)
//  - routes/api/apiContactRoutes.ts -> /api/contacts/* (isAuthCompany)
//  - routes/api/apiCompanyRoutes.ts -> /api/{plans,companies,helps,partners,invoices,users}
// Cada field: { name, in: "body"|"path"|"query", type, required, options, multiline }
// types: text | number | boolean | date | select | json | file | csv-number
// ---------------------------------------------------------------------------

const SITUATION_OPTIONS = ["Ativo", "Baixado", "Ex-Cliente", "Excluido", "Futuro", "Inativo"];

// Campos de contato aceitos no body do envio de mensagem (ApiController.index lê
// name/email/cpfCnpj/clientCode/representativeCode/extraInfo do próprio body)
const CONTACT_FIELDS = [
  { name: "name", label: "name (contato)" },
  { name: "email", label: "email (contato)" },
  { name: "cpfCnpj", label: "cpfCnpj (contato)" },
  { name: "clientCode", label: "clientCode (contato)" },
  { name: "representativeCode", label: "representativeCode (contato)" },
  { name: "verificationCode", label: "verificationCode (contato)" },
];

const MESSAGE_ENDPOINTS = [
  {
    id: "sendText",
    method: "POST",
    path: "/api/messages/send",
    contentType: "json",
    exampleBody: {
      number: "5511999999999",
      body: "Sua mensagem de texto aqui",
      userId: 1,
      queueId: 1,
      name: "Nome do Cliente",
      email: "cliente@email.com",
      clientCode: "COD123",
      cpfCnpj: "000.000.000-00",
    },
    fields: [
      { name: "number", required: true, placeholder: "5511999999999" },
      { name: "body", required: true, multiline: true },
      { name: "userId", type: "number" },
      { name: "queueId", type: "number" },
      { name: "whatsappId", type: "number" },
      { name: "msdelay", type: "number" },
      { name: "sendSignature", type: "boolean" },
      { name: "closeTicket", type: "boolean" },
      { name: "noRegister", type: "boolean" },
      ...CONTACT_FIELDS,
    ],
  },
  {
    id: "sendMedia",
    method: "POST",
    path: "/api/messages/send",
    contentType: "multipart",
    fields: [
      { name: "number", required: true, placeholder: "5511999999999" },
      { name: "medias", type: "file", required: true, label: "medias (arquivo)" },
      { name: "body", label: "body (legenda)" },
      { name: "userId", type: "number" },
      { name: "queueId", type: "number" },
      { name: "whatsappId", type: "number" },
      { name: "closeTicket", type: "boolean" },
      { name: "noRegister", type: "boolean" },
      ...CONTACT_FIELDS,
    ],
  },
  {
    id: "sendLinkImage",
    method: "POST",
    path: "/api/messages/send/linkImage",
    contentType: "json",
    exampleBody: {
      number: "5511999999999",
      url: "https://exemplo.com/imagem.png",
      caption: "Legenda da imagem",
      msdelay: 0,
    },
    fields: [
      { name: "number", required: true, placeholder: "5511999999999" },
      { name: "url", required: true, placeholder: "https://..." },
      { name: "caption" },
      { name: "whatsappId", type: "number" },
      { name: "msdelay", type: "number" },
      ...CONTACT_FIELDS,
    ],
  },
  {
    id: "checkNumber",
    method: "POST",
    path: "/api/messages/checkNumber",
    contentType: "json",
    exampleBody: { number: "5511999999999" },
    fields: [{ name: "number", required: true, placeholder: "5511999999999" }],
  },
  {
    id: "whatsapps",
    method: "GET",
    path: "/api/messages/getWhatsappsId",
    contentType: "none",
    fields: [],
  },
];

const CONTACT_ENDPOINTS = [
  {
    id: "syncContact",
    method: "POST",
    path: "/api/contacts/sync",
    contentType: "json",
    exampleBody: {
      companyId: 1,
      name: "Nome do Contato",
      number: "5511999999999",
      email: "email@exemplo.com",
      contactName: "Nome do Responsável",
      cpfCnpj: "123.456.789-00",
      verificationCode: "VERIF-001",
      clientCode: "COD123",
      representativeCode: "COD-007",
      city: "Cidade Exemplo",
      region: "Sudeste",
      instagram: "@username",
      situation: "Ativo",
      fantasyName: "Nome Fantasia",
      foundationDate: "2023-01-01",
      creditLimit: "5000.00",
      segment: "Varejo",
      bzEmpresa: "Empresa",
      dtUltCompra: "2025-09-09",
      tagIds: [1, 2, 3],
      tags: "VIP, Cliente Antigo",
      silentMode: false,
    },
    fields: [
      { name: "companyId", type: "number", required: true },
      { name: "name", required: true },
      { name: "number", required: true, placeholder: "5511999999999" },
      { name: "email" },
      { name: "contactName" },
      { name: "cpfCnpj" },
      { name: "verificationCode" },
      { name: "clientCode" },
      { name: "representativeCode" },
      { name: "city" },
      { name: "region" },
      { name: "instagram" },
      { name: "situation", type: "select", options: SITUATION_OPTIONS },
      { name: "fantasyName" },
      { name: "foundationDate", type: "date" },
      { name: "creditLimit" },
      { name: "segment" },
      { name: "bzEmpresa", label: "bzEmpresa (empresa)" },
      { name: "dtUltCompra", type: "date" },
      { name: "vlUltCompra", type: "number" },
      { name: "tagIds", type: "csv-number", placeholder: "1, 2, 3" },
      { name: "tags", type: "text", placeholder: "VIP, Cliente Antigo" },
      { name: "florder", type: "boolean" },
      { name: "disableBot", type: "boolean" },
      { name: "silentMode", type: "boolean" },
    ],
  },
  {
    id: "deleteContact",
    method: "DELETE",
    path: "/api/contacts/:id",
    contentType: "none",
    fields: [
      { name: "id", in: "path", required: true, type: "number" },
      { name: "companyId", in: "query", required: true, type: "number" },
    ],
  },
];

// Endpoints administrativos globais (mesmo COMPANY_TOKEN) — apiCompanyRoutes.ts.
// Escrita usa body JSON livre (rawBody) para não duplicar os schemas internos.
const ADMIN_RESOURCES = [
  { resource: "plans", base: "/api/plans" },
  {
    resource: "companies",
    base: "/api/companies",
    extra: [
      { method: "GET", path: "/api/companiesEmail/:email", action: "show", pathParams: ["email"] },
      { method: "PUT", path: "/api/companies/:id/schedules", action: "update", pathParams: ["id"], rawBody: true },
    ],
  },
  { resource: "helps", base: "/api/helps" },
  { resource: "partners", base: "/api/partners" },
  {
    resource: "invoices",
    base: "/api/invoices",
    extra: [
      { method: "GET", path: "/api/invoicesCompany/:companyId", action: "list", pathParams: ["companyId"] },
    ],
  },
  {
    resource: "users",
    base: "/api/users",
    only: [
      { method: "GET", path: "/api/users/:email", action: "show", pathParams: ["email"] },
    ],
  },
];

// Gera o CRUD padrão (list/show/create/update/delete) + extras declarados
const buildAdminEndpoints = () => {
  const endpoints = [];
  for (const group of ADMIN_RESOURCES) {
    if (group.only) {
      endpoints.push(
        ...group.only.map((e) => ({ ...e, resource: group.resource, id: `${group.resource}-${e.action}-${e.path}` }))
      );
      continue;
    }
    const { base, resource } = group;
    endpoints.push(
      { id: `${resource}-list`, method: "GET", path: base, action: "list", resource },
      { id: `${resource}-show`, method: "GET", path: `${base}/:id`, action: "show", resource, pathParams: ["id"] },
      { id: `${resource}-create`, method: "POST", path: base, action: "create", resource, rawBody: true },
      { id: `${resource}-update`, method: "PUT", path: `${base}/:id`, action: "update", resource, pathParams: ["id"], rawBody: true },
      { id: `${resource}-delete`, method: "DELETE", path: `${base}/:id`, action: "delete", resource, pathParams: ["id"] }
    );
    if (group.extra) {
      endpoints.push(
        ...group.extra.map((e) => ({ ...e, resource, id: `${resource}-x-${e.method}-${e.path}` }))
      );
    }
  }
  // Converte pathParams/rawBody em fields uniformes pro formulário dinâmico
  return endpoints.map((e) => ({
    ...e,
    contentType: e.rawBody ? "json" : "none",
    fields: [
      ...(e.pathParams || []).map((p) => ({ name: p, in: "path", required: true })),
      ...(e.rawBody ? [{ name: "__body", type: "json", label: i18n.t("apiDocs.labels.bodyJson") }] : []),
    ],
  }));
};

// ---------------------------------------------------------------------------
// Monta o texto de exemplo da requisição a partir do spec do endpoint
// ---------------------------------------------------------------------------
const buildExample = (endpoint, baseUrl, token) => {
  const lines = [
    `${endpoint.method} ${baseUrl}${endpoint.path}`,
    `Authorization: Bearer ${token}`,
  ];
  if (endpoint.contentType === "multipart") {
    lines.push("Content-Type: multipart/form-data", "");
    for (const f of endpoint.fields) {
      const suffix = f.type === "file" ? "[arquivo]" : f.type === "number" ? "0" : "...";
      lines.push(`${f.name}: ${f.required ? suffix + " (obrigatório)" : suffix}`);
    }
  } else if (endpoint.method !== "GET" && endpoint.method !== "DELETE") {
    lines.push("Content-Type: application/json", "");
    lines.push(JSON.stringify(endpoint.exampleBody || {}, null, 2));
  } else if (endpoint.fields?.length) {
    // GET/DELETE: documenta path params e query string no exemplo
    lines.push("");
    for (const f of endpoint.fields) {
      const where = f.in === "path" ? "path" : "query";
      lines.push(`// ${f.name} (${where}${f.required ? ", obrigatório" : ""})`);
    }
  }
  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// EndpointTester — formulário dinâmico + chamada real + painel de resposta
// ---------------------------------------------------------------------------
const EndpointTester = ({ endpoint, token, companyId, onResult, classes }) => {
  const defaultValues = useMemo(() => {
    const v = {};
    for (const f of endpoint.fields || []) {
      // companyId pré-preenchido com a empresa do usuário logado
      v[f.name] = f.name === "companyId" ? String(companyId ?? "") : "";
    }
    return v;
  }, [endpoint, companyId]);

  const [values, setValues] = useState(defaultValues);
  const [files, setFiles] = useState({});
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);

  useEffect(() => {
    setValues(defaultValues);
    setFiles({});
    setResponse(null);
  }, [defaultValues]);

  const setValue = (name) => (e) => {
    setValues((prev) => ({ ...prev, [name]: e.target.value }));
  };

  const handleTest = async () => {
    const baseUrl = process.env.REACT_APP_BACKEND_URL;
    let path = endpoint.path;
    const query = {};
    const payload = {};
    let formData = null;
    let rawBody;

    try {
      for (const f of endpoint.fields || []) {
        const v = values[f.name];

        if (f.in === "path") {
          if (!v) throw new Error(`${f.name}: ${i18n.t("apiDocs.labels.required")}`);
          path = path.replace(`:${f.name}`, encodeURIComponent(v));
          continue;
        }
        if (f.in === "query") {
          if (v !== "" && v !== undefined && v !== null) query[f.name] = v;
          continue;
        }
        if (f.type === "file") continue; // arquivos entram no FormData abaixo
        if (f.type === "json") {
          if (v && v.trim()) {
            try {
              rawBody = JSON.parse(v);
            } catch {
              toast.error(i18n.t("apiDocs.labels.invalidJson"));
              return;
            }
          }
          continue;
        }
        if (v === "" || v === undefined || v === null) continue;
        if (f.type === "number") {
          payload[f.name] = Number(v);
        } else if (f.type === "boolean") {
          payload[f.name] = v === "true" || v === true;
        } else if (f.type === "csv-number") {
          // CSV de inteiros -> array numérico (ex.: tagIds "1, 2, 3")
          const arr = String(v)
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n));
          if (arr.length) payload[f.name] = arr;
        } else {
          payload[f.name] = v;
        }
      }
    } catch (err) {
      toast.error(err.message);
      return;
    }

    let data;
    let headers = { Authorization: `Bearer ${token}` };
    if (endpoint.contentType === "multipart") {
      formData = new FormData();
      Object.entries(payload).forEach(([k, v]) => formData.append(k, v));
      Object.entries(files).forEach(([k, f]) => {
        if (f) formData.append(k, f);
      });
      data = formData;
    } else if (endpoint.rawBody) {
      data = rawBody || {};
      headers["Content-Type"] = "application/json";
    } else {
      data = payload;
      headers["Content-Type"] = "application/json";
    }

    setSending(true);
    setResponse(null);
    const startedAt = Date.now();
    try {
      const res = await axios({
        method: endpoint.method,
        url: `${baseUrl}${path}`,
        headers,
        params: query,
        data: endpoint.method === "GET" || endpoint.method === "DELETE" ? (Object.keys(payload).length ? payload : undefined) : data,
      });
      const duration = Date.now() - startedAt;
      setResponse({ status: res.status, data: res.data, duration });
      onResult?.({ method: endpoint.method, path, status: res.status, duration, time: new Date() });
      toast.success(i18n.t("apiDocs.toasts.success"));
    } catch (err) {
      const duration = Date.now() - startedAt;
      const status = err.response?.status ?? 0;
      const data = err.response?.data ?? { error: err.message };
      setResponse({ status, data, duration });
      onResult?.({ method: endpoint.method, path, status, duration, time: new Date() });
      toast.error(i18n.t("apiDocs.toasts.error"));
    } finally {
      setSending(false);
    }
  };

  const renderField = (f) => {
    const label = `${f.label || f.name}${f.required ? " *" : ""}`;
    if (f.type === "file") {
      return (
        <div key={f.name}>
          <Button variant="contained" component="label">
            {i18n.t("apiDocs.labels.chooseFile")} — {label}
            <input
              type="file"
              hidden
              onChange={(e) => setFiles((prev) => ({ ...prev, [f.name]: e.target.files[0] }))}
            />
          </Button>
          {files[f.name] && (
            <Typography variant="body2" style={{ marginTop: 4 }}>
              {files[f.name].name}
            </Typography>
          )}
        </div>
      );
    }
    if (f.type === "boolean") {
      return (
        <TextField
          key={f.name}
          select
          label={label}
          variant="outlined"
          className={classes.formField}
          value={values[f.name]}
          onChange={setValue(f.name)}
        >
          <MenuItem value="">—</MenuItem>
          <MenuItem value="true">true</MenuItem>
          <MenuItem value="false">false</MenuItem>
        </TextField>
      );
    }
    if (f.type === "select") {
      return (
        <TextField
          key={f.name}
          select
          label={label}
          variant="outlined"
          className={classes.formField}
          value={values[f.name]}
          onChange={setValue(f.name)}
        >
          <MenuItem value="">—</MenuItem>
          {(f.options || []).map((o) => (
            <MenuItem key={o} value={o}>{o}</MenuItem>
          ))}
        </TextField>
      );
    }
    return (
      <TextField
        key={f.name}
        label={label}
        variant="outlined"
        className={classes.formField}
        value={values[f.name]}
        onChange={setValue(f.name)}
        required={f.required}
        placeholder={f.placeholder}
        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
        multiline={f.multiline || f.type === "json"}
        minRows={f.type === "json" ? 4 : f.multiline ? 4 : undefined}
        InputLabelProps={f.type === "date" ? { shrink: true } : undefined}
      />
    );
  };

  const responseOk = response && response.status >= 200 && response.status < 300;

  return (
    <Grid container spacing={4}>
      <Grid item xs={12} md={5}>
        <Typography variant="subtitle2" gutterBottom>
          {i18n.t("apiDocs.labels.requestExample")}
        </Typography>
        <pre className={classes.codeBlock}>
          <code>{buildExample(endpoint, process.env.REACT_APP_BACKEND_URL, token)}</code>
        </pre>
      </Grid>
      <Grid item xs={12} md={7}>
        <div className={classes.formContainer}>
          {(endpoint.fields || []).map(renderField)}
          <Button
            color="primary"
            variant="contained"
            size="large"
            disabled={sending || !token}
            className={classes.submitButton}
            endIcon={<SendIcon />}
            onClick={handleTest}
          >
            {sending ? <CircularProgress size={24} /> : i18n.t("apiDocs.labels.testRequest")}
          </Button>
          {response && (
            <>
              <div className={classes.responseHeader}>
                <Chip
                  size="small"
                  label={`${i18n.t("apiDocs.labels.status")}: ${response.status || "ERR"}`}
                  style={{
                    backgroundColor: responseOk ? "#26c281" : "#e7505a",
                    color: "#fff",
                    fontWeight: "bold",
                  }}
                />
                <Chip size="small" variant="outlined" label={`${i18n.t("apiDocs.labels.duration")}: ${response.duration}ms`} />
              </div>
              <Typography variant="subtitle2">{i18n.t("apiDocs.labels.response")}</Typography>
              <pre className={classes.codeBlock}>
                <code>{JSON.stringify(response.data, null, 2)}</code>
              </pre>
            </>
          )}
        </div>
      </Grid>
    </Grid>
  );
};

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
const MessagesAPI = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { getPlanCompany } = usePlans();

  const [tab, setTab] = useState(0);
  const [token, setToken] = useState(DEFAULT_API_TOKEN);
  const [historyLog, setHistoryLog] = useState([]);

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  // Gate do plano: useExternalApi (complementa a permissão external-api.view da rota)
  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useExternalApi) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        history.push("/");
      }
    }
    fetchData();
  }, [user, getPlanCompany, history]);

  const adminEndpoints = useMemo(() => buildAdminEndpoints(), []);

  const handleTabChange = (event, newValue) => setTab(newValue);

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      toast.success(i18n.t("apiDocs.copied"));
    } catch {
      toast.error("Clipboard indisponível");
    }
  };

  const pushHistory = (entry) => {
    setHistoryLog((prev) => [entry, ...prev].slice(0, 30));
  };

  const endpointTitle = (e) =>
    e.action
      ? i18n.t(`apiDocs.actions.${e.action}`, { resource: i18n.t(`apiDocs.resources.${e.resource}`) })
      : i18n.t(`apiDocs.endpoints.${e.id}.title`);

  const endpointDescription = (e) =>
    e.action ? `${e.method} ${e.path}` : i18n.t(`apiDocs.endpoints.${e.id}.description`);

  const renderEndpoint = (endpoint) => (
    <ExpansionPanel key={endpoint.id} className={classes.endpointPanel} elevation={1}>
      <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />}>
        <div className={classes.endpointSummary}>
          <MethodChip method={endpoint.method} />
          <Typography className={classes.mono}>{endpoint.path}</Typography>
          <Typography variant="subtitle2" style={{ fontWeight: "bold" }}>
            {endpointTitle(endpoint)}
          </Typography>
          <Typography variant="caption" className={classes.endpointDescription}>
            {endpointDescription(endpoint)}
          </Typography>
        </div>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails>
        <EndpointTester
          endpoint={endpoint}
          token={token}
          companyId={user?.companyId}
          onResult={pushHistory}
          classes={classes}
        />
      </ExpansionPanelDetails>
    </ExpansionPanel>
  );

  // Agrupa endpoints admin por recurso para exibição com sub-cabeçalhos
  const adminByResource = useMemo(() => {
    const groups = {};
    for (const e of adminEndpoints) {
      (groups[e.resource] = groups[e.resource] || []).push(e);
    }
    return groups;
  }, [adminEndpoints]);

  return (
    <MainContainer useWindowScroll>
      {/* Página de documentação/playground — painel bento + entrada spring */}
      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
      >
        <motion.div variants={itemVariant} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Paper className={`${classes.mainPaper} bento-panel`} variant="elevation" elevation={0}>
            <Typography variant="h4" className={classes.title}>
              {i18n.t("apiDocs.title")}
            </Typography>
            <Typography variant="body2" className={classes.subtitle}>
              {i18n.t("apiDocs.subtitle")}
            </Typography>

            <Alert severity="warning" icon={<WarningIcon />} className={classes.alert}>
              <AlertTitle>{i18n.t("apiDocs.instructionsTitle")}</AlertTitle>
              {i18n.t("apiDocs.instructionsBody")}
            </Alert>

            <div className={classes.tokenRow}>
              <TextField
                label={i18n.t("apiDocs.tokenLabel")}
                variant="outlined"
                size="small"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className={classes.formField}
                style={{ flex: 1, maxWidth: 480 }}
              />
              <Tooltip title={i18n.t("apiDocs.copyToken")}>
                <IconButton onClick={copyToken} size="small">
                  <FileCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>

            <AppBar position="static" color="default" elevation={0}>
              {/* variant="scrollable": labels longas não esmagam as abas em telas <600px */}
              <Tabs value={tab} onChange={handleTabChange} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto">
                <Tab label={i18n.t("apiDocs.tabs.messages")} />
                <Tab label={i18n.t("apiDocs.tabs.contacts")} />
                <Tab label={i18n.t("apiDocs.tabs.admin")} />
                <Tab label={`${i18n.t("apiDocs.tabs.history")} (${historyLog.length})`} />
              </Tabs>
            </AppBar>

            <TabPanel value={tab} index={0} classes={classes}>
              <motion.div variants={itemVariant}>
                {MESSAGE_ENDPOINTS.map(renderEndpoint)}
              </motion.div>
            </TabPanel>

            <TabPanel value={tab} index={1} classes={classes}>
              <motion.div variants={itemVariant}>
                {CONTACT_ENDPOINTS.map(renderEndpoint)}
              </motion.div>
            </TabPanel>

            <TabPanel value={tab} index={2} classes={classes}>
              <motion.div variants={itemVariant}>
                <Alert severity="info" className={classes.alert}>
                  {i18n.t("apiDocs.labels.adminWarning")}
                </Alert>
                {Object.entries(adminByResource).map(([resource, endpoints]) => (
                  <div key={resource}>
                    <Typography variant="overline" className={classes.groupHeader}>
                      {i18n.t(`apiDocs.resources.${resource}`)}
                    </Typography>
                    {endpoints.map(renderEndpoint)}
                  </div>
                ))}
              </motion.div>
            </TabPanel>

            <TabPanel value={tab} index={3} classes={classes}>
              <motion.div variants={itemVariant}>
                {historyLog.length === 0 ? (
                  <Typography variant="body2">{i18n.t("apiDocs.labels.emptyHistory")}</Typography>
                ) : (
                  <>
                    <Button size="small" onClick={() => setHistoryLog([])} style={{ marginBottom: 8 }}>
                      {i18n.t("apiDocs.labels.clearHistory")}
                    </Button>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{i18n.t("apiDocs.history.time")}</TableCell>
                          <TableCell>{i18n.t("apiDocs.history.method")}</TableCell>
                          <TableCell>{i18n.t("apiDocs.history.path")}</TableCell>
                          <TableCell>{i18n.t("apiDocs.history.status")}</TableCell>
                          <TableCell>{i18n.t("apiDocs.history.duration")}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {historyLog.map((h, i) => (
                          <TableRow key={i}>
                            <TableCell>{h.time.toLocaleTimeString()}</TableCell>
                            <TableCell><MethodChip method={h.method} /></TableCell>
                            <TableCell className={classes.mono}>{h.path}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={h.status || "ERR"}
                                style={{
                                  backgroundColor: h.status >= 200 && h.status < 300 ? "#26c281" : "#e7505a",
                                  color: "#fff",
                                }}
                              />
                            </TableCell>
                            <TableCell>{h.duration}ms</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </motion.div>
            </TabPanel>
          </Paper>
        </motion.div>
      </motion.div>
    </MainContainer>
  );
};

export default MessagesAPI;
