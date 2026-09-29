import React, { useMemo, useRef, useState } from "react";
import * as Yup from "yup";
import { Formik, Form } from "formik";
import { toast } from "react-toastify";

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Alert, Autocomplete } from "@material-ui/lab";
import {
  Add as AddIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  Code as CodeIcon,
  DeleteOutline as DeleteOutlineIcon,
  Description as DescriptionIcon,
  EmojiEmotions as EmojiIcon,
  FileCopy as FileCopyIcon,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatStrikethrough as FormatStrikethroughIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Lock as LockIcon,
  Phone as PhoneIcon,
  PlayCircleOutline as PlayCircleIcon,
  Reply as ReplyIcon,
  Title as TitleIcon,
  Videocam as VideocamIcon
} from "@material-ui/icons";
import { Megaphone as CampaignIcon } from "lucide-react";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

// Atalho para as chaves do namespace metaTemplates.modal.*
// (defaultValue mantém a UI legível até as traduções serem criadas)
const tt = (key, defaultValue) =>
  i18n.t(`metaTemplates.modal.${key}`, { defaultValue });

const CATEGORY_OPTIONS = ["MARKETING", "UTILITY", "AUTHENTICATION"];

const CATEGORY_META = {
  MARKETING: {
    icon: CampaignIcon,
    desc: "Promoções, ofertas, novidades e reengajamento"
  },
  UTILITY: {
    icon: DescriptionIcon,
    desc: "Confirmações, atualizações de pedido e avisos de conta"
  },
  AUTHENTICATION: {
    icon: LockIcon,
    desc: "Códigos de verificação e recuperação de acesso"
  }
};

// Formata custo em Real brasileiro com precisão de centésimos de centavo
const formatBrlCost = value =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }).format(Number(value));

const LANGUAGE_OPTIONS = [
  "pt_BR",
  "pt_PT",
  "en_US",
  "en_GB",
  "es_ES",
  "es",
  "es_AR",
  "es_MX",
  "tr",
  "de",
  "fr",
  "it"
];

// Limites e mimetypes aceitos pela Meta para header de mídia
const MEDIA_HEADER_CONFIG = {
  IMAGE: { accept: "image/jpeg,image/jpg,image/png", maxMB: 5 },
  VIDEO: { accept: "video/mp4", maxMB: 16 },
  DOCUMENT: { accept: "application/pdf", maxMB: 100 }
};

const HEADER_TYPE_META = {
  TEXT: { icon: TitleIcon, label: "Texto" },
  IMAGE: { icon: ImageIcon, label: "Imagem" },
  VIDEO: { icon: VideocamIcon, label: "Vídeo" },
  DOCUMENT: { icon: DescriptionIcon, label: "Documento" }
};

const BUTTON_LIMITS = { URL: 2, PHONE_NUMBER: 1, COPY_CODE: 1 };
const MAX_BUTTONS = 10;

// Emojis comuns para inserção rápida no corpo da mensagem
const QUICK_EMOJIS = [
  "😀", "😊", "👍", "🙏", "🎉", "✅", "⭐", "❤️",
  "🔥", "💬", "📦", "🚚", "📅", "⏰", "💡", "📞"
];

const VAR_REGEX = /\{\{([^}]+)\}\}/g;
const NAME_REGEX = /^[a-z0-9_]+$/;

// Extrai variáveis {{x}} únicas preservando a ordem de aparição
const extractVars = text => {
  const vars = [];
  const re = new RegExp(VAR_REGEX.source, "g");
  let m;
  while ((m = re.exec(text || "")) !== null) {
    const v = m[1].trim();
    if (v && !vars.includes(v)) vars.push(v);
  }
  return vars;
};

const isMediaHeader = format =>
  format === "IMAGE" || format === "VIDEO" || format === "DOCUMENT";

const useStyles = makeStyles(theme => ({
  dialogPaper: {
    height: "92vh",
    maxHeight: 860
  },
  dialogTitleBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1.5, 2.5),
    borderBottom: `1px solid ${theme.palette.divider}`
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: "-0.01em"
  },
  dialogSubtitle: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    marginTop: 2
  },
  content: {
    padding: 0,
    display: "flex",
    overflow: "hidden"
  },
  formColumn: {
    flex: "1 1 58%",
    overflowY: "auto",
    padding: theme.spacing(2.5, 3)
  },
  previewColumn: {
    flex: "0 0 42%",
    borderLeft: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(2.5),
    display: "flex",
    flexDirection: "column",
    backgroundColor:
      theme.palette.type === "dark" ? theme.palette.grey[900] : "#f7f7f5",
    [theme.breakpoints.down("sm")]: {
      display: "none"
    }
  },
  section: {
    marginBottom: theme.spacing(3)
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: 14,
    marginBottom: theme.spacing(0.25),
    display: "flex",
    alignItems: "center",
    gap: 6
  },
  sectionHint: {
    color: theme.palette.text.secondary,
    fontSize: 12.5,
    marginBottom: theme.spacing(1.5)
  },
  field: {
    width: "100%"
  },
  // Cards de categoria (padrão do gerenciador da Meta)
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: theme.spacing(1.5)
  },
  categoryCard: {
    padding: theme.spacing(1.5),
    cursor: "pointer",
    border: `2px solid ${theme.palette.divider}`,
    borderRadius: 10,
    transition: "border-color 160ms ease-out, background-color 160ms ease-out, transform 160ms ease-out",
    "&:hover": {
      borderColor: theme.palette.primary.light,
      transform: "translateY(-1px)"
    },
    "&:active": {
      transform: "scale(0.98)"
    }
  },
  categoryCardSelected: {
    borderColor: theme.palette.primary.main,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(25,118,210,0.12)"
        : theme.palette.primary[50]
  },
  categoryCardDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
    "&:hover": {
      borderColor: theme.palette.divider,
      transform: "none"
    }
  },
  categoryIcon: {
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(0.5)
  },
  categoryLabel: {
    fontWeight: 600,
    fontSize: 13.5,
    lineHeight: 1.3
  },
  categoryDesc: {
    color: theme.palette.text.secondary,
    fontSize: 11.5,
    lineHeight: 1.4,
    marginTop: 2
  },
  categoryCost: {
    color: theme.palette.success?.main || "#059669",
    fontSize: 11,
    marginTop: 4
  },
  // Chips de tipo de cabeçalho
  headerTypeRow: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  headerChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 20,
    border: `1px solid ${theme.palette.divider}`,
    cursor: "pointer",
    fontSize: 13,
    backgroundColor: "transparent",
    color: theme.palette.text.primary,
    transition: "all 160ms ease-out",
    "&:hover": {
      borderColor: theme.palette.primary.light
    },
    "&:active": {
      transform: "scale(0.97)"
    }
  },
  headerChipActive: {
    borderColor: theme.palette.primary.main,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(25,118,210,0.15)"
        : theme.palette.primary[50],
    color: theme.palette.primary.main,
    fontWeight: 600
  },
  // Toolbar de formatação do corpo
  formatBar: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    padding: theme.spacing(0.25, 0.5),
    border: `1px solid ${theme.palette.divider}`,
    borderTop: "none",
    borderRadius: "0 0 8px 8px",
    backgroundColor:
      theme.palette.type === "dark" ? theme.palette.grey[800] : "#fafafa"
  },
  bodyFieldNoBottomRadius: {
    "& .MuiOutlinedInput-root": {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderBottomColor: "transparent"
    }
  },
  charCounter: {
    marginLeft: "auto",
    color: theme.palette.text.secondary,
    fontSize: 11.5,
    paddingRight: theme.spacing(0.5)
  },
  exampleField: {
    marginTop: theme.spacing(1)
  },
  buttonRow: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    padding: theme.spacing(1, 1.5),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.paper
  },
  buttonRowHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(0.5)
  },
  buttonTypeLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12.5,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    letterSpacing: "0.04em"
  },
  fileDrop: {
    border: `1.5px dashed ${theme.palette.divider}`,
    borderRadius: 10,
    padding: theme.spacing(2.5),
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 160ms ease-out, background-color 160ms ease-out",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(25,118,210,0.06)"
          : theme.palette.primary[50]
    }
  },
  optionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1, 0)
  },
  // Preview estilo balão do WhatsApp
  previewPane: {
    background:
      theme.palette.type === "dark"
        ? "#0b141a"
        : "#ece5dd",
    borderRadius: 12,
    padding: theme.spacing(2.5, 1.5),
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 320
  },
  previewPaneTitle: {
    alignSelf: "flex-start",
    marginBottom: theme.spacing(1.5),
    color: theme.palette.text.secondary,
    fontWeight: 600,
    fontSize: 11.5,
    textTransform: "uppercase",
    letterSpacing: "0.05em"
  },
  bubble: {
    background:
      theme.palette.type === "dark" ? "#202c33" : "#ffffff",
    color: theme.palette.type === "dark" ? "#e9edef" : "#111b21",
    borderRadius: "8px 8px 8px 0",
    boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)",
    padding: "6px 9px 8px",
    fontSize: 14.2,
    lineHeight: 1.42,
    wordBreak: "break-word",
    overflow: "hidden",
    width: "100%",
    maxWidth: 320,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  previewMedia: {
    background: theme.palette.type === "dark" ? "#2a3942" : "#d5d9dc",
    borderRadius: 6,
    height: 120,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 4,
    color: theme.palette.type === "dark" ? "#8696a0" : "#667781",
    marginBottom: 6,
    overflow: "hidden"
  },
  previewHeaderText: {
    fontWeight: 700,
    marginBottom: 4
  },
  previewBody: {
    whiteSpace: "pre-wrap"
  },
  previewMetaRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
    fontSize: 11,
    color: theme.palette.type === "dark" ? "#8696a0" : "#667781"
  },
  previewFooter: {
    color: theme.palette.type === "dark" ? "#8696a0" : "#8696a0",
    fontSize: 12.5,
    marginTop: 4
  },
  previewButton: {
    borderTop:
      theme.palette.type === "dark"
        ? "1px solid #2a3942"
        : "1px solid #e9edef",
    color: "#00a5f4",
    textAlign: "center",
    padding: "8px 4px",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    margin: "0 -9px",
    "&:first-of-type": {
      marginTop: 6
    }
  },
  actionsBar: {
    padding: theme.spacing(1.25, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  buttonProgress: {
    marginRight: theme.spacing(1)
  }
}));

// Substitui {{var}} pelo exemplo correspondente (negrito) no preview
const renderWithVars = (text, examples) => {
  if (!text) return null;
  const nodes = [];
  const re = new RegExp(VAR_REGEX.source, "g");
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const v = m[1].trim();
    nodes.push(
      <strong key={`v-${k++}`} style={{ color: "#00a884" }}>
        {examples[v] || m[0]}
      </strong>
    );
    last = m.index + m[0].length;
  }
  nodes.push(text.slice(last));
  return nodes;
};

// Aplica marcações *negrito*, _itálico_, ~tachado~ e ```mono``` do WhatsApp no preview
const renderWhatsAppMarkup = (text, examples) => {
  const raw = renderWithVars(text, examples);
  if (!raw) return null;
  const nodes = Array.isArray(raw) ? raw : [raw];
  const flat = [];
  nodes.forEach(n => {
    if (typeof n === "string") flat.push(n);
    else flat.push(n);
  });
  // Parsing simples de *b*, _i_, ~s~, ```mono``` sobre o texto já com exemplos
  return flat.map((node, i) => {
    if (typeof node !== "string") return node;
    const parts = node.split(
      /(\*[^*]+\*|_[^_]+_|~[^~]+~|```[^`]+```)/g
    );
    return parts.map((p, j) => {
      if (/^\*[^*]+\*$/.test(p))
        return <strong key={`${i}-${j}`}>{p.slice(1, -1)}</strong>;
      if (/^_[^_]+_$/.test(p))
        return <em key={`${i}-${j}`}>{p.slice(1, -1)}</em>;
      if (/^~[^~]+~$/.test(p))
        return <s key={`${i}-${j}`}>{p.slice(1, -1)}</s>;
      if (/^```[^`]+```$/.test(p))
        return (
          <code key={`${i}-${j}`} style={{ fontFamily: "monospace", fontSize: 13 }}>
            {p.slice(3, -3)}
          </code>
        );
      return <React.Fragment key={`${i}-${j}`}>{p}</React.Fragment>;
    });
  });
};

// Painel lateral com renderização aproximada da mensagem
const TemplatePreview = ({
  headerFormat,
  headerText,
  headerExamples,
  headerFile,
  bodyText,
  bodyExamples,
  footerText,
  buttons
}) => {
  const classes = useStyles();

  // Memoiza a object URL para não vazar URLs a cada re-render
  const imageUrl = useMemo(
    () =>
      headerFormat === "IMAGE" && headerFile
        ? URL.createObjectURL(headerFile)
        : null,
    [headerFormat, headerFile]
  );

  const now = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <div className={classes.previewPane}>
      <Typography className={classes.previewPaneTitle}>
        {tt("preview.title", "Pré-visualização")}
      </Typography>
      <div className={classes.bubble}>
        {isMediaHeader(headerFormat) && (
          <div className={classes.previewMedia}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="header"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <>
                {headerFormat === "IMAGE" && <ImageIcon fontSize="large" />}
                {headerFormat === "VIDEO" && <PlayCircleIcon fontSize="large" />}
                {headerFormat === "DOCUMENT" && <DescriptionIcon fontSize="large" />}
                <Typography variant="caption">
                  {headerFormat === "IMAGE" &&
                    tt("preview.imageHeader", "Imagem do cabeçalho")}
                  {headerFormat === "VIDEO" &&
                    tt("preview.videoHeader", "Vídeo do cabeçalho")}
                  {headerFormat === "DOCUMENT" &&
                    tt("preview.documentHeader", "Documento do cabeçalho")}
                </Typography>
              </>
            )}
          </div>
        )}
        {headerFormat === "TEXT" && headerText && (
          <div className={classes.previewHeaderText}>
            {renderWhatsAppMarkup(headerText, headerExamples)}
          </div>
        )}
        <div className={classes.previewBody}>
          {renderWhatsAppMarkup(bodyText, bodyExamples) || (
            <span style={{ opacity: 0.45 }}>
              {tt("preview.emptyBody", "Comece a digitar o corpo da mensagem…")}
            </span>
          )}
        </div>
        {footerText && <div className={classes.previewFooter}>{footerText}</div>}
        <div className={classes.previewMetaRow}>
          <span>{now}</span>
          <span style={{ letterSpacing: -2 }}>✓✓</span>
        </div>
        {buttons.map(btn => (
          <div key={btn.key} className={classes.previewButton}>
            {btn.type === "QUICK_REPLY" && <ReplyIcon fontSize="inherit" />}
            {btn.type === "URL" && <LinkIcon fontSize="inherit" />}
            {btn.type === "PHONE_NUMBER" && <PhoneIcon fontSize="inherit" />}
            {btn.type === "COPY_CODE" && <FileCopyIcon fontSize="inherit" />}
            <span>
              {btn.type === "COPY_CODE"
                ? tt("preview.copyCode", "Copiar código")
                : btn.text || tt("preview.buttonPlaceholder", "Botão")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MetaTemplateModal = ({ open, onClose, whatsappId, template, onSaved }) => {
  const classes = useStyles();
  const isEdit = Boolean(template);
  const isApproved = template?.status === "APPROVED";
  const tplId = template?.id || template?.metaTemplateId;

  // ---- Estado controlado (fora do Formik) ----
  const [headerFormat, setHeaderFormat] = useState("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerExamples, setHeaderExamples] = useState({});
  const [headerFile, setHeaderFile] = useState(null);
  // Em edição, guarda o example original do header de mídia (header_handle da Meta)
  const [existingHeaderExample, setExistingHeaderExample] = useState(null);
  const [originalHeaderFormat, setOriginalHeaderFormat] = useState(null);

  const [bodyExamples, setBodyExamples] = useState({});
  const [footerEnabled, setFooterEnabled] = useState(false);
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState([]);
  const [ttlEnabled, setTtlEnabled] = useState(false);
  const [ttl, setTtl] = useState("");
  const [allowCategoryChange, setAllowCategoryChange] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  // Custo estimado por envio (R$) indexado por categoria — vem de /pricing
  const [costByCategory, setCostByCategory] = useState({});

  const fileInputRef = useRef(null);
  const bodyInputRef = useRef(null);
  const btnSeq = useRef(0);
  const nextBtnKey = () => `btn-${++btnSeq.current}`;

  // Parseia os components retornados pela Meta/GET para o estado do form
  const parseComponents = tpl => {
    const comps = Array.isArray(tpl?.components) ? tpl.components : [];
    const header = comps.find(c => c.type === "HEADER");
    const body = comps.find(c => c.type === "BODY");
    const footer = comps.find(c => c.type === "FOOTER");
    const buttonsComp = comps.find(c => c.type === "BUTTONS");

    if (header) {
      const format = header.format || "TEXT";
      if (format === "TEXT") {
        setHeaderFormat("TEXT");
        setHeaderText(header.text || "");
        const ex = {};
        if (Array.isArray(header.example?.header_text)) {
          extractVars(header.text).forEach((v, i) => {
            ex[v] = header.example.header_text[i] || "";
          });
        } else if (Array.isArray(header.example?.header_text_named_params)) {
          header.example.header_text_named_params.forEach(p => {
            ex[p.param_name] = p.example || "";
          });
        }
        setHeaderExamples(ex);
      } else if (isMediaHeader(format)) {
        setHeaderFormat(format);
        setOriginalHeaderFormat(format);
        // Preserva example.header_handle retornado pelo GET — sem ele a Meta
        // rejeita o update de header de mídia (PUT é JSON, não aceita arquivo)
        setExistingHeaderExample(header.example || null);
      }
    }

    if (body) {
      const ex = {};
      if (Array.isArray(body.example?.body_text?.[0])) {
        // Posicional: array de strings alinhado aos índices {{1}}, {{2}}...
        body.example.body_text[0].forEach((val, i) => {
          ex[String(i + 1)] = val || "";
        });
      } else if (Array.isArray(body.example?.body_text_named_params)) {
        body.example.body_text_named_params.forEach(p => {
          ex[p.param_name] = p.example || "";
        });
      }
      setBodyExamples(ex);
    }

    if (footer) {
      setFooterEnabled(true);
      setFooterText(footer.text || "");
    }

    if (buttonsComp && Array.isArray(buttonsComp.buttons)) {
      setButtons(
        buttonsComp.buttons.map(b => ({
          key: nextBtnKey(),
          type: b.type,
          text: b.text || "",
          url: b.url || "",
          urlExample: Array.isArray(b.example)
            ? b.example[0] || ""
            : b.type === "URL"
            ? b.example || ""
            : "",
          phoneNumber: b.phone_number || "",
          copyCode:
            b.type === "COPY_CODE"
              ? Array.isArray(b.example)
                ? b.example[0] || ""
                : b.example || ""
              : "",
          // Tipos desconhecidos (OTP etc.) são reenviados como vieram
          raw: b
        }))
      );
    }
  };

  const initialValues = useMemo(
    () => ({
      name: template?.name || "",
      category: template?.category || "UTILITY",
      language: template?.language || "pt_BR",
      parameterFormat: String(
        // A listagem da Meta traz snake_case; o cache local traz camelCase
        template?.parameter_format || template?.parameterFormat || "positional"
      ).toLowerCase(),
      bodyText: (() => {
        const comps = Array.isArray(template?.components)
          ? template.components
          : [];
        return comps.find(c => c.type === "BODY")?.text || "";
      })()
    }),
    [template]
  );

  const validationSchema = useMemo(
    () =>
      Yup.object().shape({
        name: Yup.string()
          .matches(NAME_REGEX, tt("errors.nameInvalid", "Use apenas letras minúsculas, números e _"))
          .max(512, tt("errors.nameTooLong", "Máximo de 512 caracteres"))
          .required(tt("errors.required", "Obrigatório")),
        category: Yup.string()
          .oneOf(CATEGORY_OPTIONS)
          .required(tt("errors.required", "Obrigatório")),
        language: Yup.string().required(tt("errors.required", "Obrigatório")),
        parameterFormat: Yup.string().oneOf(["positional", "named"]),
        bodyText: Yup.string()
          .max(1024, tt("errors.bodyTooLong", "Máximo de 1024 caracteres"))
          .required(tt("errors.required", "Obrigatório"))
      }),
    []
  );

  // Reidrata o estado ao abrir em modo edição (Dialog desmonta o conteúdo ao fechar)
  React.useEffect(() => {
    if (open && template) parseComponents(template);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template]);

  // Carrega tarifas por categoria (custo estimado por envio em R$)
  React.useEffect(() => {
    if (!open || !whatsappId) return;
    let cancelled = false;
    api
      .get(`/meta-templates/${whatsappId}/pricing`)
      .then(({ data }) => {
        if (cancelled) return;
        const map = {};
        (data?.rates || []).forEach(r => {
          if (r.rateBrl !== null && r.rateBrl !== undefined) {
            map[r.category] = Number(r.rateBrl);
          }
        });
        setCostByCategory(map);
      })
      .catch(() => {
        // Sem tarifas disponíveis ainda (sync diário ou WABA sem histórico)
        if (!cancelled) setCostByCategory({});
      });
    return () => { cancelled = true; };
  }, [open, whatsappId]);

  // ---- Botões: add/remove/reorder ----
  const countType = type => buttons.filter(b => b.type === type).length;

  const addButton = type => {
    if (!type || buttons.length >= MAX_BUTTONS) return;
    setButtons(prev => [
      ...prev,
      {
        key: nextBtnKey(),
        type,
        text: "",
        url: "",
        urlExample: "",
        phoneNumber: "",
        copyCode: ""
      }
    ]);
  };

  const updateButton = (key, patch) =>
    setButtons(prev => prev.map(b => (b.key === key ? { ...b, ...patch } : b)));

  const removeButton = key =>
    setButtons(prev => prev.filter(b => b.key !== key));

  const moveButton = (index, dir) =>
    setButtons(prev => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const onSelectHeaderFile = e => {
    const file = e.target.files?.[0] || null;
    e.target.value = "";
    if (!file) return;
    const cfg = MEDIA_HEADER_CONFIG[headerFormat];
    if (!cfg) return;
    if (cfg.accept.split(",").indexOf(file.type) === -1) {
      toast.error(tt("errors.invalidFileType", "Tipo de arquivo não suportado para este cabeçalho."));
      return;
    }
    if (file.size > cfg.maxMB * 1024 * 1024) {
      toast.error(
        tt("errors.fileTooLarge", `Arquivo excede o limite de ${cfg.maxMB}MB.`)
      );
      return;
    }
    setHeaderFile(file);
  };

  // Validações fora do Formik (header/footer/botões/exemplos). Retorna lista de erros.
  const validateControlled = values => {
    const errors = [];

    if (headerFormat === "TEXT") {
      const hVars = extractVars(headerText);
      if (!headerText.trim())
        errors.push(tt("errors.headerTextRequired", "Texto do cabeçalho é obrigatório."));
      if (headerText.length > 60)
        errors.push(tt("errors.headerTooLong", "Cabeçalho deve ter no máximo 60 caracteres."));
      if (hVars.length > 1)
        errors.push(tt("errors.headerMaxOneVar", "Cabeçalho aceita no máximo 1 variável."));
      hVars.forEach(v => {
        if (!headerExamples[v]?.trim())
          errors.push(
            `${tt("errors.exampleRequired", "Informe o exemplo para")} {{${v}}}`
          );
      });
    }

    if (isMediaHeader(headerFormat)) {
      if (!isEdit && !headerFile) {
        errors.push(tt("errors.headerFileRequired", "Selecione o arquivo do cabeçalho de mídia."));
      }
      if (isEdit) {
        // PUT é JSON-only: não é possível enviar novo arquivo na edição.
        // Só é permitido manter o formato original preservando header_handle.
        if (headerFormat !== originalHeaderFormat) {
          errors.push(
            tt(
              "errors.cannotChangeMediaOnEdit",
              "Não é possível trocar o tipo de mídia do cabeçalho na edição. Remova o cabeçalho ou recrie o template."
            )
          );
        } else if (!existingHeaderExample?.header_handle) {
          errors.push(
            tt(
              "errors.missingHeaderHandle",
              "O header de mídia deste template não possui header_handle no retorno da Meta; não é possível salvá-lo sem reenviar o arquivo."
            )
          );
        }
      }
    }

    extractVars(values.bodyText).forEach(v => {
      if (!bodyExamples[v]?.trim())
        errors.push(`${tt("errors.exampleRequired", "Informe o exemplo para")} {{${v}}}`);
    });

    if (footerEnabled) {
      if (!footerText.trim())
        errors.push(tt("errors.footerRequired", "Texto do rodapé é obrigatório."));
      if (footerText.length > 60)
        errors.push(tt("errors.footerTooLong", "Rodapé deve ter no máximo 60 caracteres."));
      if (extractVars(footerText).length > 0)
        errors.push(tt("errors.footerNoVars", "Rodapé não aceita variáveis."));
    }

    if (buttons.length > MAX_BUTTONS)
      errors.push(tt("errors.tooManyButtons", "Máximo de 10 botões."));
    if (countType("URL") > BUTTON_LIMITS.URL)
      errors.push(tt("errors.tooManyUrl", "Máximo de 2 botões de URL."));
    if (countType("PHONE_NUMBER") > BUTTON_LIMITS.PHONE_NUMBER)
      errors.push(tt("errors.tooManyPhone", "Máximo de 1 botão de telefone."));
    if (countType("COPY_CODE") > BUTTON_LIMITS.COPY_CODE)
      errors.push(tt("errors.tooManyCopy", "Máximo de 1 botão de copiar código."));

    // Quick replies devem ser contíguos e agrupados no início ou no fim
    const qrIdx = buttons
      .map((b, i) => (b.type === "QUICK_REPLY" ? i : -1))
      .filter(i => i >= 0);
    if (qrIdx.length) {
      const contiguous = qrIdx.every((v, i) => v === qrIdx[0] + i);
      const atStart = qrIdx[0] === 0;
      const atEnd = qrIdx[qrIdx.length - 1] === buttons.length - 1;
      if (!contiguous || (!atStart && !atEnd))
        errors.push(
          tt(
            "errors.quickReplyGrouping",
            "Botões de resposta rápida devem estar agrupados no início ou no fim da lista."
          )
        );
    }

    buttons.forEach((b, i) => {
      const label = `${tt("errors.button", "Botão")} ${i + 1}`;
      if (b.type === "QUICK_REPLY" || b.type === "URL" || b.type === "PHONE_NUMBER") {
        if (!b.text.trim()) errors.push(`${label}: ${tt("errors.buttonTextRequired", "texto é obrigatório.")}`);
        if (b.text.length > 25) errors.push(`${label}: ${tt("errors.buttonTextTooLong", "texto deve ter no máximo 25 caracteres.")}`);
      }
      if (b.type === "URL") {
        const urlVars = extractVars(b.url);
        if (!b.url.trim()) errors.push(`${label}: ${tt("errors.urlRequired", "URL é obrigatória.")}`);
        if (b.url.length > 2000) errors.push(`${label}: ${tt("errors.urlTooLong", "URL deve ter no máximo 2000 caracteres.")}`);
        if (urlVars.length > 1 || (urlVars.length === 1 && !new RegExp(VAR_REGEX.source + "\\s*$").test(b.url)))
          errors.push(`${label}: ${tt("errors.urlVarEnd", "a variável da URL deve ser única e estar no final (ex.: {{1}}).")}`);
        if (urlVars.length === 1 && !b.urlExample.trim())
          errors.push(`${label}: ${tt("errors.urlExampleRequired", "exemplo da URL dinâmica é obrigatório.")}`);
      }
      if (b.type === "PHONE_NUMBER") {
        if (!b.phoneNumber.trim()) errors.push(`${label}: ${tt("errors.phoneRequired", "número de telefone é obrigatório.")}`);
        if (b.phoneNumber.length > 20) errors.push(`${label}: ${tt("errors.phoneTooLong", "telefone deve ter no máximo 20 caracteres.")}`);
      }
      if (b.type === "COPY_CODE" && !b.copyCode.trim())
        errors.push(`${label}: ${tt("errors.copyCodeRequired", "código de exemplo é obrigatório.")}`);
      if (b.type === "COPY_CODE" && b.copyCode.length > 20)
        errors.push(`${label}: ${tt("errors.copyCodeTooLong", "código deve ter no máximo 20 caracteres.")}`);
    });

    if (ttlEnabled && ttl !== "" && (isNaN(Number(ttl)) || Number(ttl) < 0))
      errors.push(tt("errors.ttlInvalid", "TTL deve ser um número válido."));

    return errors;
  };

  // Monta o array de components no formato da Meta (type/format uppercase)
  const buildComponents = values => {
    const named = values.parameterFormat === "named";
    const components = [];

    if (headerFormat !== "NONE") {
      if (headerFormat === "TEXT") {
        const comp = { type: "HEADER", format: "TEXT", text: headerText };
        const hVars = extractVars(headerText);
        if (hVars.length) {
          comp.example = named
            ? {
                header_text_named_params: hVars.map(v => ({
                  param_name: v,
                  example: headerExamples[v]
                }))
              }
            : { header_text: hVars.map(v => headerExamples[v]) };
        }
        components.push(comp);
      } else {
        const comp = { type: "HEADER", format: headerFormat };
        // Edição: preserva o header_handle original (backend injeta um novo
        // apenas quando headerFile é enviado no POST multipart)
        if (isEdit && existingHeaderExample) comp.example = existingHeaderExample;
        components.push(comp);
      }
    }

    const bodyComp = { type: "BODY", text: values.bodyText };
    const bodyVars = extractVars(values.bodyText);
    if (bodyVars.length) {
      if (named) {
        bodyComp.example = {
          body_text_named_params: bodyVars.map(v => ({
            param_name: v,
            example: bodyExamples[v]
          }))
        };
      } else {
        // Posicional: exemplos ordenados pelo índice numérico da variável
        const sorted = [...bodyVars].sort((a, b) => Number(a) - Number(b));
        bodyComp.example = { body_text: [sorted.map(v => bodyExamples[v])] };
      }
    }
    components.push(bodyComp);

    if (footerEnabled && footerText.trim())
      components.push({ type: "FOOTER", text: footerText });

    if (buttons.length) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map(b => {
          if (b.raw && !["QUICK_REPLY", "URL", "PHONE_NUMBER", "COPY_CODE"].includes(b.type))
            return b.raw; // tipos desconhecidos voltam intactos
          if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text };
          if (b.type === "URL") {
            const btn = { type: "URL", text: b.text, url: b.url };
            if (extractVars(b.url).length) btn.example = [b.urlExample];
            return btn;
          }
          if (b.type === "PHONE_NUMBER")
            return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phoneNumber };
          if (b.type === "COPY_CODE") return { type: "COPY_CODE", example: b.copyCode };
          return b.raw || { type: b.type, text: b.text };
        })
      });
    }

    return components;
  };

  const handleSubmit = async values => {
    const errors = validateControlled(values);
    if (errors.length) {
      errors.forEach(e => toast.error(e));
      return;
    }

    const components = buildComponents(values);
    const ttlNum = ttlEnabled && ttl !== "" ? Number(ttl) : undefined;

    setSaving(true);
    try {
      if (isEdit) {
        const payload = { components };
        // APPROVED: a Meta não permite mudar categoria — omite do payload
        if (!isApproved) payload.category = values.category;
        if (ttlNum !== undefined) payload.messageSendTtlSeconds = ttlNum;
        if (headerFile) {
          // Nova mídia de header na edição → multipart com headerFile
          const fd = new FormData();
          fd.append("components", JSON.stringify(payload.components));
          if (payload.category) fd.append("category", payload.category);
          if (payload.messageSendTtlSeconds !== undefined)
            fd.append("messageSendTtlSeconds", String(payload.messageSendTtlSeconds));
          fd.append("headerFile", headerFile);
          await api.put(`/meta-templates/${whatsappId}/${tplId}`, fd);
        } else {
          await api.put(`/meta-templates/${whatsappId}/${tplId}`, payload);
        }
      } else if (headerFile) {
        // Multipart somente quando há arquivo de header — components vai como string JSON
        const fd = new FormData();
        fd.append("name", values.name);
        fd.append("category", values.category);
        fd.append("language", values.language);
        fd.append("parameterFormat", values.parameterFormat);
        fd.append("components", JSON.stringify(components));
        fd.append("allowCategoryChange", String(allowCategoryChange));
        if (ttlNum !== undefined)
          fd.append("messageSendTtlSeconds", String(ttlNum));
        fd.append("headerFile", headerFile);
        await api.post(`/meta-templates/${whatsappId}`, fd);
      } else {
        await api.post(`/meta-templates/${whatsappId}`, {
          name: values.name,
          category: values.category,
          language: values.language,
          parameterFormat: values.parameterFormat,
          components,
          allowCategoryChange,
          ...(ttlNum !== undefined ? { messageSendTtlSeconds: ttlNum } : {})
        });
      }
      toast.success(
        isEdit
          ? tt("success.updated", "Template atualizado com sucesso.")
          : tt("success.created", "Template criado e enviado para revisão da Meta.")
      );
      onSaved?.();
      onClose?.();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  // Insere marcação na posição do cursor do textarea do corpo
  const wrapBodySelection = (setFieldValue, values, marker) => {
    const el = bodyInputRef.current;
    const text = values.bodyText || "";
    if (!el || el.selectionStart === undefined) {
      setFieldValue("bodyText", `${text}${marker}${marker}`);
      return;
    }
    const { selectionStart, selectionEnd } = el;
    const selected = text.slice(selectionStart, selectionEnd);
    const next =
      text.slice(0, selectionStart) +
      marker +
      selected +
      marker +
      text.slice(selectionEnd);
    setFieldValue("bodyText", next);
    // Restaura foco e seleção após o re-render
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        selectionStart + marker.length,
        selectionEnd + marker.length
      );
    });
  };

  const insertBodyVariable = (setFieldValue, values) => {
    const vars = extractVars(values.bodyText);
    const nextVar =
      values.parameterFormat === "named"
        ? `{{nome_${vars.length + 1}}}`
        : `{{${vars.length + 1}}}`;
    const el = bodyInputRef.current;
    const text = values.bodyText || "";
    if (!el || el.selectionStart === undefined) {
      setFieldValue("bodyText", text + nextVar);
      return;
    }
    const { selectionStart, selectionEnd } = el;
    setFieldValue(
      "bodyText",
      text.slice(0, selectionStart) + nextVar + text.slice(selectionEnd)
    );
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        selectionStart + nextVar.length,
        selectionStart + nextVar.length
      );
    });
  };

  const insertEmoji = (setFieldValue, values, emoji) => {
    setEmojiAnchor(null);
    const el = bodyInputRef.current;
    const text = values.bodyText || "";
    if (!el || el.selectionStart === undefined) {
      setFieldValue("bodyText", text + emoji);
      return;
    }
    const { selectionStart, selectionEnd } = el;
    setFieldValue(
      "bodyText",
      text.slice(0, selectionStart) + emoji + text.slice(selectionEnd)
    );
    requestAnimationFrame(() => {
      el.focus();
      const pos = selectionStart + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const renderButtonEditor = (b, index) => (
    <Box key={b.key} className={classes.buttonRow}>
      <Box className={classes.buttonRowHeader}>
        <span className={classes.buttonTypeLabel}>
          {b.type === "QUICK_REPLY" && <ReplyIcon fontSize="small" />}
          {b.type === "URL" && <LinkIcon fontSize="small" />}
          {b.type === "PHONE_NUMBER" && <PhoneIcon fontSize="small" />}
          {b.type === "COPY_CODE" && <FileCopyIcon fontSize="small" />}
          {index + 1}. {tt(`buttons.types.${b.type}`, b.type)}
        </span>
        <Box>
          <IconButton size="small" onClick={() => moveButton(index, -1)} disabled={index === 0}>
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => moveButton(index, 1)}
            disabled={index === buttons.length - 1}
          >
            <ArrowDownwardIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => removeButton(b.key)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {(b.type === "QUICK_REPLY" || b.type === "URL" || b.type === "PHONE_NUMBER") && (
        <TextField
          label={tt("buttons.text", "Texto do botão")}
          variant="outlined"
          margin="dense"
          size="small"
          fullWidth
          inputProps={{ maxLength: 25 }}
          value={b.text}
          onChange={e => updateButton(b.key, { text: e.target.value })}
        />
      )}
      {b.type === "URL" && (
        <>
          <TextField
            label={tt("buttons.url", "URL (use {{1}} no final para sufixo dinâmico)")}
            variant="outlined"
            margin="dense"
            size="small"
            fullWidth
            inputProps={{ maxLength: 2000 }}
            value={b.url}
            onChange={e => updateButton(b.key, { url: e.target.value })}
          />
          {extractVars(b.url).length > 0 && (
            <TextField
              label={tt("buttons.urlExample", "Exemplo do sufixo da URL")}
              variant="outlined"
              margin="dense"
              size="small"
              fullWidth
              value={b.urlExample}
              onChange={e => updateButton(b.key, { urlExample: e.target.value })}
            />
          )}
        </>
      )}
      {b.type === "PHONE_NUMBER" && (
        <TextField
          label={tt("buttons.phoneNumber", "Número de telefone (com DDI)")}
          variant="outlined"
          margin="dense"
          size="small"
          fullWidth
          inputProps={{ maxLength: 20 }}
          value={b.phoneNumber}
          onChange={e => updateButton(b.key, { phoneNumber: e.target.value })}
        />
      )}
      {b.type === "COPY_CODE" && (
        <TextField
          label={tt("buttons.copyCode", "Código de exemplo")}
          variant="outlined"
          margin="dense"
          size="small"
          fullWidth
          inputProps={{ maxLength: 20 }}
          value={b.copyCode}
          onChange={e => updateButton(b.key, { copyCode: e.target.value })}
        />
      )}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose?.()}
      scroll="paper"
      maxWidth="lg"
      fullWidth
      PaperProps={{ className: classes.dialogPaper }}
    >
      {/* Barra de título customizada */}
      <Box className={classes.dialogTitleBar}>
        <Box>
          <Typography className={classes.dialogTitle}>
            {isEdit
              ? `${tt("title.edit", "Editar template Meta")} — ${template?.name}`
              : tt("title.create", "Novo template Meta")}
          </Typography>
          <Typography className={classes.dialogSubtitle}>
            {isEdit
              ? tt(
                  "subtitle.edit",
                  "Edite os componentes e envie para revisão automática da Meta."
                )
              : tt(
                  "subtitle.create",
                  "Configure categoria, conteúdo e botões. A Meta revisa antes de liberar o uso."
                )}
          </Typography>
        </Box>
        <IconButton onClick={() => !saving && onClose?.()} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        enableReinitialize
        onSubmit={handleSubmit}
      >
        {({ values, errors, touched, setFieldValue, handleChange, handleBlur }) => (
          <Form style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <DialogContent className={classes.content} dividers={false}>
              {/* ---- Coluna do formulário ---- */}
              <Box className={classes.formColumn}>
                {/* SEÇÃO 1 — Categoria */}
                <Box className={classes.section}>
                  <Typography className={classes.sectionTitle}>
                    {tt("fields.category", "Categoria")}
                  </Typography>
                  <Typography className={classes.sectionHint}>
                    {tt(
                      "fields.categoryHint",
                      "Escolha a categoria que melhor descreve o objetivo da mensagem."
                    )}
                  </Typography>
                  <Box className={classes.categoryGrid}>
                    {CATEGORY_OPTIONS.map(c => {
                      const Icon = CATEGORY_META[c].icon;
                      const selected = values.category === c;
                      const disabled = isApproved && !selected;
                      return (
                        <Paper
                          key={c}
                          variant="outlined"
                          className={`${classes.categoryCard} ${
                            selected ? classes.categoryCardSelected : ""
                          } ${disabled ? classes.categoryCardDisabled : ""}`}
                          onClick={() => {
                            if (!disabled) setFieldValue("category", c);
                          }}
                          elevation={0}
                        >
                          <Icon className={classes.categoryIcon} />
                          <div className={classes.categoryLabel}>
                            {tt(`categories.${c}`, c)}
                          </div>
                          <div className={classes.categoryDesc}>
                            {tt(`categoriesDesc.${c}`, CATEGORY_META[c].desc)}
                          </div>
                          {costByCategory[c] !== undefined && (
                            <div className={classes.categoryCost}>
                              {tt(
                                "fields.costPerSend",
                                "Custo estimado"
                              )}:{" "}
                              <strong>{formatBrlCost(costByCategory[c])}/envio</strong>
                            </div>
                          )}
                        </Paper>
                      );
                    })}
                  </Box>
                  {costByCategory[values.category] !== undefined && (
                    <FormHelperText>
                      {tt(
                        "fields.costEstimated",
                        `Custo estimado por envio: ${formatBrlCost(
                          costByCategory[values.category]
                        )} — tarifa efetiva Meta (pode variar por volume/tier e país do destinatário).`
                      )}
                    </FormHelperText>
                  )}
                  {isApproved && (
                    <FormHelperText>
                      {tt(
                        "fields.categoryLocked",
                        "Categoria não pode ser alterada em templates aprovados."
                      )}
                    </FormHelperText>
                  )}
                </Box>

                {/* SEÇÃO 2 — Nome e idioma */}
                <Box className={classes.section}>
                  <Typography className={classes.sectionTitle}>
                    {tt("sections.identity", "Nome e idioma")}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={7}>
                      <TextField
                        label={tt("fields.name", "Nome do template")}
                        name="name"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        disabled={isEdit}
                        value={values.name}
                        onChange={e =>
                          setFieldValue(
                            "name",
                            e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                          )
                        }
                        onBlur={handleBlur}
                        error={touched.name && Boolean(errors.name)}
                        helperText={
                          (touched.name && errors.name) ||
                          `${values.name.length}/512 — ${tt("fields.nameHint", "minúsculas, números e _")}`
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <Autocomplete
                        freeSolo
                        options={LANGUAGE_OPTIONS}
                        value={values.language}
                        onChange={(e, v) => setFieldValue("language", v || "")}
                        onInputChange={(e, v) => {
                          if (e) setFieldValue("language", v);
                        }}
                        disabled={isEdit}
                        renderInput={params => (
                          <TextField
                            {...params}
                            label={tt("fields.language", "Idioma")}
                            variant="outlined"
                            margin="dense"
                            error={touched.language && Boolean(errors.language)}
                            helperText={touched.language && errors.language}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                  <FormControl component="fieldset" margin="dense">
                    <Typography variant="caption" color="textSecondary">
                      {tt("fields.parameterFormat", "Tipo de variável")}
                    </Typography>
                    <RadioGroup
                      row
                      name="parameterFormat"
                      value={values.parameterFormat}
                      onChange={handleChange}
                    >
                      <FormControlLabel
                        value="positional"
                        control={<Radio size="small" />}
                        label={tt("fields.positional", "Posicional ({{1}}, {{2}})")}
                      />
                      <FormControlLabel
                        value="named"
                        control={<Radio size="small" />}
                        label={tt("fields.named", "Nomeado ({{nome}})")}
                      />
                    </RadioGroup>
                  </FormControl>
                </Box>

                <Divider />

                {/* SEÇÃO 3 — Conteúdo */}
                <Box className={classes.section} mt={2}>
                  <Typography className={classes.sectionTitle}>
                    {tt("sections.content", "Conteúdo")}
                  </Typography>
                  <Typography className={classes.sectionHint}>
                    {tt(
                      "sections.contentHint",
                      "Cabeçalho, corpo e rodapé do template. Variáveis exigem exemplos."
                    )}
                  </Typography>

                  {/* Cabeçalho */}
                  <Typography variant="caption" color="textSecondary">
                    {tt("header.title", "Cabeçalho (opcional)")}
                  </Typography>
                  <Box className={classes.headerTypeRow} mt={0.5} mb={1.5}>
                    <button
                      type="button"
                      className={`${classes.headerChip} ${
                        headerFormat === "NONE" ? classes.headerChipActive : ""
                      }`}
                      onClick={() => {
                        setHeaderFormat("NONE");
                        setHeaderFile(null);
                      }}
                    >
                      {tt("header.none", "Nenhum")}
                    </button>
                    {Object.entries(HEADER_TYPE_META).map(([fmt, meta]) => {
                      const Icon = meta.icon;
                      return (
                        <button
                          key={fmt}
                          type="button"
                          className={`${classes.headerChip} ${
                            headerFormat === fmt ? classes.headerChipActive : ""
                          }`}
                          onClick={() => {
                            setHeaderFormat(fmt);
                            setHeaderFile(null);
                          }}
                        >
                          <Icon fontSize="small" />
                          {tt(`header.${fmt.toLowerCase()}`, meta.label)}
                        </button>
                      );
                    })}
                  </Box>

                  {headerFormat === "TEXT" && (
                    <>
                      <TextField
                        label={tt("header.textLabel", "Texto do cabeçalho (máx. 60, até 1 variável)")}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        inputProps={{ maxLength: 60 }}
                        value={headerText}
                        onChange={e => setHeaderText(e.target.value)}
                      />
                      {extractVars(headerText).map(v => (
                        <TextField
                          key={v}
                          label={`${tt("fields.varExample", "Exemplo para")} {{${v}}}`}
                          variant="outlined"
                          margin="dense"
                          size="small"
                          fullWidth
                          className={classes.exampleField}
                          value={headerExamples[v] || ""}
                          onChange={e =>
                            setHeaderExamples(prev => ({ ...prev, [v]: e.target.value }))
                          }
                        />
                      ))}
                    </>
                  )}

                  {isMediaHeader(headerFormat) && (
                    <Box mt={1}>
                      {isEdit ? (
                        // PUT aceita apenas JSON — não é possível reenviar mídia
                        // na edição; o header_handle original é preservado.
                        <Alert severity="info">
                          {tt(
                            "header.mediaEditNotice",
                            "Cabeçalho de mídia não pode ser substituído na edição — a mídia existente será mantida."
                          )}
                        </Alert>
                      ) : (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            hidden
                            accept={MEDIA_HEADER_CONFIG[headerFormat]?.accept}
                            onChange={onSelectHeaderFile}
                          />
                          <Box
                            className={classes.fileDrop}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <AttachFileIcon color="action" />
                            <Typography variant="body2" style={{ marginTop: 4 }}>
                              {headerFile
                                ? headerFile.name
                                : tt("header.selectFile", "Clique para selecionar o arquivo")}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {tt("header.fileLimits", "Imagem ≤5MB (jpg/png) • Vídeo ≤16MB (mp4) • PDF ≤100MB")}
                            </Typography>
                          </Box>
                        </>
                      )}
                    </Box>
                  )}

                  {/* Corpo da mensagem */}
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    style={{ display: "block", marginTop: 12 }}
                  >
                    {tt("body.title", "Corpo da mensagem")} *
                  </Typography>
                  <TextField
                    name="bodyText"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    multiline
                    rows={5}
                    inputProps={{ maxLength: 1024 }}
                    inputRef={bodyInputRef}
                    className={classes.bodyFieldNoBottomRadius}
                    placeholder={tt("body.placeholder", "Ex.: Olá {{1}}, seu pedido {{2}} foi enviado.")}
                    value={values.bodyText}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.bodyText && Boolean(errors.bodyText)}
                  />
                  {/* Toolbar de formatação WhatsApp */}
                  <Box className={classes.formatBar}>
                    <Tooltip title={tt("toolbar.emoji", "Emoji")}>
                      <IconButton
                        size="small"
                        onClick={e => setEmojiAnchor(e.currentTarget)}
                      >
                        <EmojiIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={tt("toolbar.bold", "Negrito (*texto*)")}>
                      <IconButton
                        size="small"
                        onClick={() => wrapBodySelection(setFieldValue, values, "*")}
                      >
                        <FormatBoldIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={tt("toolbar.italic", "Itálico (_texto_)")}>
                      <IconButton
                        size="small"
                        onClick={() => wrapBodySelection(setFieldValue, values, "_")}
                      >
                        <FormatItalicIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={tt("toolbar.strike", "Tachado (~texto~)")}>
                      <IconButton
                        size="small"
                        onClick={() => wrapBodySelection(setFieldValue, values, "~")}
                      >
                        <FormatStrikethroughIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={tt("toolbar.code", "Monoespaçado (```texto```)")}>
                      <IconButton
                        size="small"
                        onClick={() => wrapBodySelection(setFieldValue, values, "```")}
                      >
                        <CodeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => insertBodyVariable(setFieldValue, values)}
                    >
                      {tt("toolbar.addVariable", "Adicionar variável")}
                    </Button>
                    <span className={classes.charCounter}>
                      {(touched.bodyText && errors.bodyText) || `${values.bodyText.length}/1024`}
                    </span>
                  </Box>
                  <Menu
                    anchorEl={emojiAnchor}
                    open={Boolean(emojiAnchor)}
                    onClose={() => setEmojiAnchor(null)}
                  >
                    <Box
                      display="grid"
                      gridTemplateColumns="repeat(8, 1fr)"
                      p={0.5}
                    >
                      {QUICK_EMOJIS.map(e => (
                        <IconButton
                          key={e}
                          size="small"
                          onClick={() => insertEmoji(setFieldValue, values, e)}
                        >
                          <span style={{ fontSize: 18 }}>{e}</span>
                        </IconButton>
                      ))}
                    </Box>
                  </Menu>

                  {extractVars(values.bodyText).map(v => (
                    <TextField
                      key={v}
                      label={`${tt("fields.varExample", "Exemplo para")} {{${v}}}`}
                      variant="outlined"
                      margin="dense"
                      size="small"
                      fullWidth
                      required
                      className={classes.exampleField}
                      value={bodyExamples[v] || ""}
                      onChange={e =>
                        setBodyExamples(prev => ({ ...prev, [v]: e.target.value }))
                      }
                    />
                  ))}

                  {/* Rodapé */}
                  <Box className={classes.optionRow} mt={1}>
                    <Typography variant="body2">
                      {tt("footer.enable", "Adicionar rodapé")}
                    </Typography>
                    <Switch
                      size="small"
                      checked={footerEnabled}
                      onChange={e => setFooterEnabled(e.target.checked)}
                      color="primary"
                    />
                  </Box>
                  {footerEnabled && (
                    <TextField
                      label={tt("footer.text", "Texto do rodapé (máx. 60, sem variáveis)")}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      inputProps={{ maxLength: 60 }}
                      value={footerText}
                      onChange={e => setFooterText(e.target.value)}
                    />
                  )}
                </Box>

                <Divider />

                {/* SEÇÃO 4 — Botões */}
                <Box className={classes.section} mt={2}>
                  <Typography className={classes.sectionTitle}>
                    {tt("buttons.title", "Botões (opcional, máx. 10)")}
                  </Typography>
                  <Typography className={classes.sectionHint}>
                    {tt(
                      "buttons.subtitle",
                      "Permitem ao cliente responder ou executar uma ação com um toque."
                    )}
                  </Typography>
                  {buttons.map((b, i) => renderButtonEditor(b, i))}
                  <Box display="flex" alignItems="center" mt={0.5}>
                    <FormControl variant="outlined" size="small" style={{ minWidth: 240 }}>
                      <Select
                        displayEmpty
                        value=""
                        onChange={e => addButton(e.target.value)}
                        disabled={buttons.length >= MAX_BUTTONS}
                        renderValue={() => `+ ${tt("buttons.add", "Adicionar botão")}`}
                      >
                        <MenuItem value="QUICK_REPLY">
                          {tt("buttons.types.QUICK_REPLY", "Resposta rápida")}
                        </MenuItem>
                        <MenuItem value="URL" disabled={countType("URL") >= BUTTON_LIMITS.URL}>
                          {tt("buttons.types.URL", "URL")} ({countType("URL")}/2)
                        </MenuItem>
                        <MenuItem
                          value="PHONE_NUMBER"
                          disabled={countType("PHONE_NUMBER") >= BUTTON_LIMITS.PHONE_NUMBER}
                        >
                          {tt("buttons.types.PHONE_NUMBER", "Telefone")}
                        </MenuItem>
                        <MenuItem
                          value="COPY_CODE"
                          disabled={countType("COPY_CODE") >= BUTTON_LIMITS.COPY_CODE}
                        >
                          {tt("buttons.types.COPY_CODE", "Copiar código")}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <FormHelperText>
                    {tt(
                      "buttons.hint",
                      "Respostas rápidas devem ficar agrupadas no início ou no fim."
                    )}
                  </FormHelperText>
                </Box>

                <Divider />

                {/* SEÇÃO 5 — Opções avançadas */}
                <Box className={classes.section} mt={2} mb={0}>
                  <Typography className={classes.sectionTitle}>
                    {tt("sections.options", "Opções")}
                  </Typography>
                  <Box className={classes.optionRow}>
                    <Box>
                      <Typography variant="body2">
                        {tt("fields.ttlToggle", "Validade da mensagem (TTL)")}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {tt(
                          "fields.ttlHint",
                          "Se não entregue nesse período, a mensagem expira (padrão Meta: 10 min)."
                        )}
                      </Typography>
                    </Box>
                    <Switch
                      size="small"
                      checked={ttlEnabled}
                      onChange={e => {
                        setTtlEnabled(e.target.checked);
                        if (!e.target.checked) setTtl("");
                      }}
                      color="primary"
                    />
                  </Box>
                  {ttlEnabled && (
                    <TextField
                      label={tt("fields.ttl", "TTL em segundos")}
                      variant="outlined"
                      margin="dense"
                      type="number"
                      size="small"
                      value={ttl}
                      onChange={e => setTtl(e.target.value)}
                      inputProps={{ min: 0 }}
                    />
                  )}
                  {!isEdit && (
                    <Box className={classes.optionRow}>
                      <Box>
                        <Typography variant="body2">
                          {tt(
                            "fields.allowCategoryChange",
                            "Permitir que a Meta ajuste a categoria automaticamente"
                          )}
                        </Typography>
                      </Box>
                      <Switch
                        size="small"
                        checked={allowCategoryChange}
                        onChange={e => setAllowCategoryChange(e.target.checked)}
                        color="primary"
                      />
                    </Box>
                  )}
                </Box>
              </Box>

              {/* ---- Preview ---- */}
              <Box className={classes.previewColumn}>
                <TemplatePreview
                  headerFormat={headerFormat}
                  headerText={headerText}
                  headerExamples={headerExamples}
                  headerFile={headerFile}
                  bodyText={values.bodyText}
                  bodyExamples={bodyExamples}
                  footerText={footerEnabled ? footerText : ""}
                  buttons={buttons}
                />
              </Box>
            </DialogContent>
            <DialogActions className={classes.actionsBar} disableSpacing={false}>
              <Button onClick={() => onClose?.()} disabled={saving} color="inherit">
                {tt("actions.cancel", "Cancelar")}
              </Button>
              <Tooltip title={isEdit && !tplId ? tt("errors.missingId", "Template sem ID") : ""}>
                <span>
                  <Button
                    type="submit"
                    color="primary"
                    variant="contained"
                    disabled={saving || (isEdit && !tplId)}
                  >
                    {saving && (
                      <CircularProgress size={18} className={classes.buttonProgress} />
                    )}
                    {isEdit
                      ? tt("actions.save", "Salvar alterações")
                      : tt("actions.create", "Enviar para revisão")}
                  </Button>
                </span>
              </Tooltip>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default MetaTemplateModal;
