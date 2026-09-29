import React, { useMemo, useRef, useState } from "react";
import * as Yup from "yup";
import { Formik, Form } from "formik";
import { toast } from "react-toastify";

import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
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
  DeleteOutline as DeleteOutlineIcon,
  FileCopy as FileCopyIcon,
  Link as LinkIcon,
  Phone as PhoneIcon,
  Reply as ReplyIcon
} from "@material-ui/icons";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

// Atalho para as chaves do namespace metaTemplates.modal.*
// (defaultValue mantém a UI legível até as traduções serem criadas)
const tt = (key, defaultValue) =>
  i18n.t(`metaTemplates.modal.${key}`, { defaultValue });

const CATEGORY_OPTIONS = ["MARKETING", "UTILITY", "AUTHENTICATION"];

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

const BUTTON_LIMITS = { URL: 2, PHONE_NUMBER: 1, COPY_CODE: 1 };
const MAX_BUTTONS = 10;

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
  field: {
    width: "100%"
  },
  sectionTitle: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
    fontWeight: 600
  },
  buttonRow: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  // Preview estilo balão do WhatsApp
  previewPane: {
    background: "#ece5dd",
    borderRadius: 8,
    padding: theme.spacing(2),
    minHeight: 280,
    position: "sticky",
    top: 0
  },
  bubble: {
    background: "#e7ffdb",
    borderRadius: 8,
    boxShadow: "0 1px 1px rgba(0,0,0,0.18)",
    padding: "8px 10px 6px",
    fontSize: 14,
    wordBreak: "break-word",
    overflow: "hidden"
  },
  previewMedia: {
    background: "#cfd8dc",
    borderRadius: 6,
    height: 110,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#546e7a",
    marginBottom: 6,
    overflow: "hidden"
  },
  previewHeaderText: {
    fontWeight: 700,
    marginBottom: 4
  },
  previewFooter: {
    color: "#8a8a8a",
    fontSize: 12,
    marginTop: 4
  },
  previewButton: {
    borderTop: "1px solid #d9d9d9",
    color: "#00a5f4",
    textAlign: "center",
    padding: "7px 4px",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
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
      <strong key={`v-${k++}`} style={{ color: "#075e54" }}>
        {examples[v] || m[0]}
      </strong>
    );
    last = m.index + m[0].length;
  }
  nodes.push(text.slice(last));
  return nodes;
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

  return (
    <div className={classes.previewPane}>
      <Typography
        variant="caption"
        color="textSecondary"
        style={{ display: "block", marginBottom: 8 }}
      >
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
              <Typography variant="caption">
                {headerFormat === "IMAGE" &&
                  tt("preview.imageHeader", "Imagem do cabeçalho")}
                {headerFormat === "VIDEO" &&
                  tt("preview.videoHeader", "Vídeo do cabeçalho")}
                {headerFormat === "DOCUMENT" &&
                  tt("preview.documentHeader", "Documento do cabeçalho")}
              </Typography>
            )}
          </div>
        )}
        {headerFormat === "TEXT" && headerText && (
          <div className={classes.previewHeaderText}>
            {renderWithVars(headerText, headerExamples)}
          </div>
        )}
        <div>{renderWithVars(bodyText, bodyExamples)}</div>
        {footerText && <div className={classes.previewFooter}>{footerText}</div>}
        {buttons.length > 0 && <div style={{ marginTop: 6 }} />}
        {buttons.map(btn => (
          <div key={btn.key} className={classes.previewButton}>
            {btn.type === "QUICK_REPLY" && <ReplyIcon fontSize="inherit" />}
            {btn.type === "URL" && <LinkIcon fontSize="inherit" />}
            {btn.type === "PHONE_NUMBER" && <PhoneIcon fontSize="inherit" />}
            {btn.type === "COPY_CODE" && <FileCopyIcon fontSize="inherit" />}
            <span>
              {btn.type === "COPY_CODE"
                ? tt("preview.copyCode", "Copiar código")
                : btn.text || btn.type}
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
  const [ttl, setTtl] = useState("");
  const [allowCategoryChange, setAllowCategoryChange] = useState(true);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef(null);
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

    if (ttl !== "" && (isNaN(Number(ttl)) || Number(ttl) < 0))
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
    const ttlNum = ttl !== "" ? Number(ttl) : undefined;

    setSaving(true);
    try {
      if (isEdit) {
        const payload = { components };
        // APPROVED: a Meta não permite mudar categoria — omite do payload
        if (!isApproved) payload.category = values.category;
        if (ttlNum !== undefined) payload.messageSendTtlSeconds = ttlNum;
        await api.put(`/meta-templates/${whatsappId}/${tplId}`, payload);
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

  const bodyVarsForRender = text => extractVars(text);

  const renderButtonEditor = (b, index) => (
    <Box key={b.key} className={classes.buttonRow}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="caption" color="textSecondary">
          {index + 1}. {tt(`buttons.types.${b.type}`, b.type)}
        </Typography>
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
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {isEdit
          ? tt("title.edit", "Editar template Meta")
          : tt("title.create", "Novo template Meta")}
      </DialogTitle>
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        enableReinitialize
        onSubmit={handleSubmit}
      >
        {({ values, errors, touched, setFieldValue, handleChange, handleBlur }) => (
          <Form>
            <DialogContent dividers>
              <Grid container spacing={3}>
                {/* ---- Coluna do formulário ---- */}
                <Grid item xs={12} md={7}>
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
                      tt("fields.nameHint", "minúsculas, números e _ (ex.: ola_cliente)")
                    }
                  />

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl variant="outlined" margin="dense" className={classes.field}>
                        <InputLabel>{tt("fields.category", "Categoria")}</InputLabel>
                        <Select
                          name="category"
                          value={values.category}
                          onChange={handleChange}
                          label={tt("fields.category", "Categoria")}
                          disabled={isApproved}
                        >
                          {CATEGORY_OPTIONS.map(c => (
                            <MenuItem key={c} value={c}>
                              <Box>
                                <Typography variant="body2">{c}</Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {tt(`categories.${c}`, c)}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                        {isApproved && (
                          <FormHelperText>
                            {tt(
                              "fields.categoryLocked",
                              "Categoria não pode ser alterada em templates aprovados."
                            )}
                          </FormHelperText>
                        )}
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
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
                      {tt("fields.parameterFormat", "Formato dos parâmetros")}
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

                  <Divider />

                  {/* ---- HEADER ---- */}
                  <Typography className={classes.sectionTitle} variant="subtitle2">
                    {tt("header.title", "Cabeçalho (opcional)")}
                  </Typography>
                  <FormControl variant="outlined" margin="dense" className={classes.field}>
                    <InputLabel>{tt("header.type", "Tipo de cabeçalho")}</InputLabel>
                    <Select
                      value={headerFormat}
                      onChange={e => {
                        setHeaderFormat(e.target.value);
                        setHeaderFile(null);
                      }}
                      label={tt("header.type", "Tipo de cabeçalho")}
                    >
                      <MenuItem value="NONE">{tt("header.none", "Nenhum")}</MenuItem>
                      <MenuItem value="TEXT">{tt("header.text", "Texto")}</MenuItem>
                      <MenuItem value="IMAGE">{tt("header.image", "Imagem")}</MenuItem>
                      <MenuItem value="VIDEO">{tt("header.video", "Vídeo")}</MenuItem>
                      <MenuItem value="DOCUMENT">{tt("header.document", "Documento")}</MenuItem>
                    </Select>
                  </FormControl>

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
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AttachFileIcon />}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {headerFile
                              ? headerFile.name
                              : tt("header.selectFile", "Selecionar arquivo")}
                          </Button>
                          <FormHelperText>
                            {tt("header.fileLimits", "Imagem ≤5MB (jpg/png) • Vídeo ≤16MB (mp4) • PDF ≤100MB")}
                          </FormHelperText>
                        </>
                      )}
                    </Box>
                  )}

                  {/* ---- BODY ---- */}
                  <Typography className={classes.sectionTitle} variant="subtitle2">
                    {tt("body.title", "Corpo da mensagem *")}
                  </Typography>
                  <TextField
                    name="bodyText"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    multiline
                    rows={4}
                    inputProps={{ maxLength: 1024 }}
                    placeholder={tt("body.placeholder", "Ex.: Olá {{1}}, seu pedido {{2}} foi enviado.")}
                    value={values.bodyText}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.bodyText && Boolean(errors.bodyText)}
                    helperText={
                      (touched.bodyText && errors.bodyText) ||
                      `${values.bodyText.length}/1024`
                    }
                  />
                  {bodyVarsForRender(values.bodyText).map(v => (
                    <TextField
                      key={v}
                      label={`${tt("fields.varExample", "Exemplo para")} {{${v}}}`}
                      variant="outlined"
                      margin="dense"
                      size="small"
                      fullWidth
                      required
                      value={bodyExamples[v] || ""}
                      onChange={e =>
                        setBodyExamples(prev => ({ ...prev, [v]: e.target.value }))
                      }
                    />
                  ))}

                  {/* ---- FOOTER ---- */}
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={footerEnabled}
                        onChange={e => setFooterEnabled(e.target.checked)}
                      />
                    }
                    label={tt("footer.enable", "Adicionar rodapé")}
                  />
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

                  {/* ---- BUTTONS ---- */}
                  <Typography className={classes.sectionTitle} variant="subtitle2">
                    {tt("buttons.title", "Botões (opcional, máx. 10)")}
                  </Typography>
                  {buttons.map((b, i) => renderButtonEditor(b, i))}
                  <Box display="flex" alignItems="center" mt={0.5}>
                    <FormControl variant="outlined" size="small" style={{ minWidth: 260 }}>
                      <Select
                        displayEmpty
                        value=""
                        onChange={e => addButton(e.target.value)}
                        disabled={buttons.length >= MAX_BUTTONS}
                        renderValue={() => tt("buttons.add", "+ Adicionar botão")}
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
                    <AddIcon color="disabled" style={{ marginLeft: 4 }} />
                  </Box>
                  <FormHelperText>
                    {tt(
                      "buttons.hint",
                      "Respostas rápidas devem ficar agrupadas no início ou no fim."
                    )}
                  </FormHelperText>

                  <Divider style={{ margin: "12px 0" }} />

                  <TextField
                    label={tt("fields.ttl", "TTL da mensagem (segundos, opcional)")}
                    variant="outlined"
                    margin="dense"
                    type="number"
                    size="small"
                    value={ttl}
                    onChange={e => setTtl(e.target.value)}
                    inputProps={{ min: 0 }}
                  />

                  {!isEdit && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={allowCategoryChange}
                          onChange={e => setAllowCategoryChange(e.target.checked)}
                        />
                      }
                      label={tt(
                        "fields.allowCategoryChange",
                        "Permitir que a Meta ajuste a categoria automaticamente"
                      )}
                    />
                  )}
                </Grid>

                {/* ---- Preview ---- */}
                <Grid item xs={12} md={5}>
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
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => onClose?.()} disabled={saving} color="secondary">
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
                      : tt("actions.create", "Criar template")}
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
