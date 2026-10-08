import React, { useState } from "react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import { Box, CircularProgress, Divider, Grid, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Add as AddIcon, Close as CloseIcon } from "@material-ui/icons";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  formControl: {
    marginBottom: theme.spacing(2),
    minWidth: 200,
    width: "100%"
  },
  // Preview estilo "bolha" do WhatsApp
  previewPane: {
    backgroundColor: theme.palette.type === "dark" ? "#0b141a" : "#ece5dd",
    borderRadius: 8,
    padding: theme.spacing(2),
    minHeight: 260,
    height: "100%",
    boxSizing: "border-box"
  },
  previewBubble: {
    backgroundColor: theme.palette.type === "dark" ? "#005c4b" : "#dcf8c6",
    borderRadius: 8,
    padding: "8px 10px",
    maxWidth: "90%",
    boxShadow: "0 1px 1px rgba(0,0,0,0.15)",
    overflow: "hidden"
  },
  previewHeader: {
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 4
  },
  previewBody: {
    fontSize: 13,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  },
  previewFooter: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 4
  },
  previewButton: {
    borderTop: "1px solid rgba(0,0,0,0.12)",
    color: "#00a884",
    textAlign: "center",
    padding: "6px 4px",
    fontSize: 13,
    fontWeight: 500
  },
  previewLabel: {
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary
  }
}));

const EMPTY_ROW = { title: "", description: "" };

/**
 * Modal de envio de mensagem interativa — apenas conexões API Oficial (WABA).
 * Tipos: botões (max 3), lista (seções+itens), CTA URL e PIX (texto copia-e-cola).
 */
const InteractiveMessageModal = ({ modalOpen, onClose, ticketId }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("buttons");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [header, setHeader] = useState("");
  const [buttons, setButtons] = useState([{ title: "" }]);
  const [listButtonText, setListButtonText] = useState("");
  const [sections, setSections] = useState([
    { title: "", rows: [{ ...EMPTY_ROW }] }
  ]);
  const [urlButtonText, setUrlButtonText] = useState("");
  const [urlButtonUrl, setUrlButtonUrl] = useState("");
  const [pixKey, setPixKey] = useState("");

  const handleButtonChange = (index, value) => {
    setButtons(prev =>
      prev.map((btn, i) => (i === index ? { title: value } : btn))
    );
  };

  const handleAddButton = () => {
    if (buttons.length >= 3) return; // Meta: máximo de 3 botões de resposta
    setButtons(prev => [...prev, { title: "" }]);
  };

  const handleRemoveButton = index => {
    setButtons(prev => prev.filter((_, i) => i !== index));
  };

  const handleSectionChange = (sIndex, field, value) => {
    setSections(prev =>
      prev.map((s, i) => (i === sIndex ? { ...s, [field]: value } : s))
    );
  };

  const handleRowChange = (sIndex, rIndex, field, value) => {
    setSections(prev =>
      prev.map((s, i) =>
        i === sIndex
          ? {
              ...s,
              rows: s.rows.map((r, j) =>
                j === rIndex ? { ...r, [field]: value } : r
              )
            }
          : s
      )
    );
  };

  const handleAddSection = () => {
    if (sections.length >= 10) return; // Meta: máximo de 10 seções
    setSections(prev => [...prev, { title: "", rows: [{ ...EMPTY_ROW }] }]);
  };

  const handleRemoveSection = index => {
    setSections(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddRow = sIndex => {
    setSections(prev =>
      prev.map((s, i) =>
        i === sIndex && s.rows.length < 10
          ? { ...s, rows: [...s.rows, { ...EMPTY_ROW }] }
          : s
      )
    );
  };

  const handleRemoveRow = (sIndex, rIndex) => {
    setSections(prev =>
      prev.map((s, i) =>
        i === sIndex
          ? { ...s, rows: s.rows.filter((_, j) => j !== rIndex) }
          : s
      )
    );
  };

  const buildPayload = () => {
    const base = { type, body: body.trim(), footer: footer.trim() || undefined };

    if (type === "buttons") {
      return {
        ...base,
        buttons: buttons
          .filter(b => b.title.trim())
          .map(b => ({ title: b.title.trim() }))
      };
    }

    if (type === "list") {
      return {
        ...base,
        header: header.trim() || undefined,
        listButtonText: listButtonText.trim() || undefined,
        sections: sections
          .map(s => ({
            title: s.title.trim() || undefined,
            rows: s.rows
              .filter(r => r.title.trim())
              .map(r => ({
                title: r.title.trim(),
                description: r.description?.trim() || undefined
              }))
          }))
          .filter(s => s.rows.length > 0)
      };
    }

    if (type === "cta_url") {
      return {
        ...base,
        urlButton: {
          displayText: urlButtonText.trim(),
          url: urlButtonUrl.trim()
        }
      };
    }

    // pix: Cloud API não suporta botão "copiar" — backend envia texto com a chave
    return { ...base, pixKey: pixKey.trim() };
  };

  const validate = payload => {
    if (!payload.body) {
      toast.error(i18n.t("messages.interactive.errors.bodyRequired"));
      return false;
    }
    if (type === "buttons" && (!payload.buttons || !payload.buttons.length)) {
      toast.error(i18n.t("messages.interactive.errors.buttonsRequired"));
      return false;
    }
    if (type === "list" && (!payload.sections || !payload.sections.length)) {
      toast.error(i18n.t("messages.interactive.errors.sectionsRequired"));
      return false;
    }
    if (
      type === "cta_url" &&
      (!payload.urlButton.displayText || !/^https?:\/\//i.test(payload.urlButton.url))
    ) {
      toast.error(i18n.t("messages.interactive.errors.urlInvalid"));
      return false;
    }
    if (type === "pix" && !payload.pixKey) {
      toast.error(i18n.t("messages.interactive.errors.pixKeyRequired"));
      return false;
    }
    return true;
  };

  const handleSend = async () => {
    const payload = buildPayload();
    if (!validate(payload)) return;

    setLoading(true);
    try {
      await api.post(`/messages/${ticketId}/interactive`, payload);
      toast.success(i18n.t("messages.interactive.success"));
      handleClose();
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose && onClose();
  };

  // Preview lateral (simulação visual do balão)
  const previewButtons =
    type === "buttons"
      ? buttons.filter(b => b.title.trim()).map(b => b.title)
      : type === "cta_url" && urlButtonText.trim()
        ? [`🔗 ${urlButtonText}`]
        : type === "list"
          ? [listButtonText.trim() || i18n.t("messages.interactive.listButtonDefault")]
          : [];

  const previewRows =
    type === "list"
      ? sections.flatMap(s =>
          s.rows.filter(r => r.title.trim()).map(r => r.title.trim())
        )
      : [];

  return (
    <Dialog open={modalOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{i18n.t("messages.interactive.title")}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <FormControl variant="outlined" className={classes.formControl} size="small">
              <InputLabel>{i18n.t("messages.interactive.typeLabel")}</InputLabel>
              <Select
                value={type}
                onChange={e => setType(e.target.value)}
                label={i18n.t("messages.interactive.typeLabel")}
                disabled={loading}
              >
                <MenuItem value="buttons">
                  {i18n.t("messages.interactive.types.buttons")}
                </MenuItem>
                <MenuItem value="list">
                  {i18n.t("messages.interactive.types.list")}
                </MenuItem>
                <MenuItem value="cta_url">
                  {i18n.t("messages.interactive.types.ctaUrl")}
                </MenuItem>
                <MenuItem value="pix">
                  {i18n.t("messages.interactive.types.pix")}
                </MenuItem>
              </Select>
            </FormControl>

            {type === "list" && (
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                margin="dense"
                label={i18n.t("messages.interactive.headerLabel")}
                value={header}
                inputProps={{ maxLength: 60 }}
                onChange={e => setHeader(e.target.value)}
              />
            )}

            <TextField
              fullWidth
              size="small"
              variant="outlined"
              margin="dense"
              multiline
              rows={4}
              required
              label={i18n.t("messages.interactive.bodyLabel")}
              placeholder={i18n.t("messages.interactive.bodyPlaceholder")}
              value={body}
              inputProps={{ maxLength: 1024 }}
              onChange={e => setBody(e.target.value)}
            />

            {type !== "pix" && (
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                margin="dense"
                label={i18n.t("messages.interactive.footerLabel")}
                value={footer}
                inputProps={{ maxLength: 60 }}
                onChange={e => setFooter(e.target.value)}
              />
            )}

            {type === "buttons" && (
              <Box mt={1}>
                <Typography variant="subtitle2">
                  {i18n.t("messages.interactive.buttonsTitle")}
                </Typography>
                {buttons.map((btn, index) => (
                  <Box key={index} display="flex" alignItems="center" mt={1}>
                    <TextField
                      fullWidth
                      size="small"
                      variant="outlined"
                      label={`${i18n.t("messages.interactive.buttonLabel")} ${index + 1}`}
                      value={btn.title}
                      inputProps={{ maxLength: 20 }}
                      onChange={e => handleButtonChange(index, e.target.value)}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveButton(index)}
                      disabled={buttons.length <= 1 || loading}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddButton}
                  disabled={buttons.length >= 3 || loading}
                >
                  {i18n.t("messages.interactive.addButton")}
                </Button>
              </Box>
            )}

            {type === "list" && (
              <Box mt={1}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  margin="dense"
                  label={i18n.t("messages.interactive.listButtonLabel")}
                  value={listButtonText}
                  inputProps={{ maxLength: 20 }}
                  onChange={e => setListButtonText(e.target.value)}
                />
                {sections.map((section, sIndex) => (
                  <Box key={sIndex} mt={1}>
                    <Box display="flex" alignItems="center">
                      <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        label={`${i18n.t("messages.interactive.sectionLabel")} ${sIndex + 1}`}
                        value={section.title}
                        inputProps={{ maxLength: 24 }}
                        onChange={e =>
                          handleSectionChange(sIndex, "title", e.target.value)
                        }
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveSection(sIndex)}
                        disabled={sections.length <= 1 || loading}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    {section.rows.map((row, rIndex) => (
                      <Box key={rIndex} display="flex" alignItems="center" mt={1} ml={2}>
                        <TextField
                          size="small"
                          variant="outlined"
                          style={{ flex: 2, marginRight: 8 }}
                          label={`${i18n.t("messages.interactive.rowLabel")} ${rIndex + 1}`}
                          value={row.title}
                          inputProps={{ maxLength: 24 }}
                          onChange={e =>
                            handleRowChange(sIndex, rIndex, "title", e.target.value)
                          }
                        />
                        <TextField
                          size="small"
                          variant="outlined"
                          style={{ flex: 3 }}
                          label={i18n.t("messages.interactive.rowDescriptionLabel")}
                          value={row.description}
                          inputProps={{ maxLength: 72 }}
                          onChange={e =>
                            handleRowChange(sIndex, rIndex, "description", e.target.value)
                          }
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveRow(sIndex, rIndex)}
                          disabled={section.rows.length <= 1 || loading}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => handleAddRow(sIndex)}
                      disabled={section.rows.length >= 10 || loading}
                    >
                      {i18n.t("messages.interactive.addRow")}
                    </Button>
                  </Box>
                ))}
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddSection}
                  disabled={sections.length >= 10 || loading}
                >
                  {i18n.t("messages.interactive.addSection")}
                </Button>
              </Box>
            )}

            {type === "cta_url" && (
              <Box mt={1}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  margin="dense"
                  label={i18n.t("messages.interactive.urlButtonText")}
                  value={urlButtonText}
                  inputProps={{ maxLength: 20 }}
                  onChange={e => setUrlButtonText(e.target.value)}
                />
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  margin="dense"
                  label={i18n.t("messages.interactive.urlLabel")}
                  placeholder="https://"
                  value={urlButtonUrl}
                  onChange={e => setUrlButtonUrl(e.target.value)}
                />
              </Box>
            )}

            {type === "pix" && (
              <Box mt={1}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  margin="dense"
                  label={i18n.t("messages.interactive.pixKeyLabel")}
                  value={pixKey}
                  inputProps={{ maxLength: 200 }}
                  onChange={e => setPixKey(e.target.value)}
                />
                <Typography variant="caption" color="textSecondary">
                  {i18n.t("messages.interactive.pixHint")}
                </Typography>
              </Box>
            )}
          </Grid>

          {/* Preview lateral */}
          <Grid item xs={12} md={5}>
            <Typography variant="subtitle2" className={classes.previewLabel}>
              {i18n.t("messages.interactive.preview")}
            </Typography>
            <div className={classes.previewPane}>
              <div className={classes.previewBubble}>
                {type === "list" && header.trim() && (
                  <div className={classes.previewHeader}>{header}</div>
                )}
                <div className={classes.previewBody}>
                  {body || i18n.t("messages.interactive.bodyPlaceholder")}
                  {type === "pix" && pixKey.trim() ? `\n\n${pixKey.trim()}` : ""}
                </div>
                {type !== "pix" && footer.trim() && (
                  <div className={classes.previewFooter}>{footer}</div>
                )}
              </div>
              {previewRows.map((row, idx) => (
                <div
                  key={`row-${idx}`}
                  className={classes.previewBubble}
                  style={{ marginTop: 4, maxWidth: "90%" }}
                >
                  <div className={classes.previewBody}>{row}</div>
                </div>
              ))}
              {previewButtons.map((btn, idx) => (
                <div
                  key={`btn-${idx}`}
                  className={classes.previewBubble}
                  style={{ marginTop: idx === 0 ? 2 : 0, maxWidth: "90%", padding: 0 }}
                >
                  <div className={classes.previewButton}>{btn}</div>
                </div>
              ))}
            </div>
          </Grid>
        </Grid>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={handleClose} disabled={loading} color="secondary">
          {i18n.t("messages.interactive.cancel")}
        </Button>
        <Button
          onClick={handleSend}
          color="primary"
          variant="contained"
          disabled={loading}
        >
          {loading ? <CircularProgress size={18} /> : i18n.t("messages.interactive.send")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InteractiveMessageModal;
