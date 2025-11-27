import React, { useEffect, useState } from "react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import { makeStyles } from "@material-ui/core/styles";
import {
  Box,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Typography
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import TemplateVariableMapper from "../TemplateVariableMapper";  // NOVO

const useStyles = makeStyles(theme => ({
  fullWidth: {
    width: "100%"
  }
}));

const OfficialTemplateStartModal = ({
  open,
  onClose,
  whatsappId,
  contactId,
  queueId,
  onCompleted
}) => {
  const classes = useStyles();
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [sending, setSending] = useState(false);
  const [metaTemplateVariables, setMetaTemplateVariables] = useState(null);  // NOVO

  useEffect(() => {
    if (!open || !whatsappId) return;

    const load = async () => {
      setLoadingTemplates(true);
      try {
        const { data } = await api.get(`/whatsapp/${whatsappId}/templates`);
        setTemplates(data.templates || []);
      } catch (err) {
        toastError(err);
      } finally {
        setLoadingTemplates(false);
      }
    };

    load();
  }, [open, whatsappId]);

  const handleSend = async () => {
    if (!selectedTemplateId) {
      toast.error("Selecione um template para continuar.");
      return;
    }

    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) {
      toast.error("Template selecionado não encontrado.");
      return;
    }

    setSending(true);
    try {
      const payload = {
        contactId,
        queueId: queueId || null,
        templateName: template.name,
        languageCode: template.language || "pt_BR",
        // NOVO: enviar mapeamento de variáveis definido pelo usuário
        variablesConfig: metaTemplateVariables
      };

      const { data } = await api.post(
        `/whatsapp/${whatsappId}/send-template-to-contact`,
        payload
      );

      toast.success("Template enviado com sucesso.");

      if (onCompleted) {
        onCompleted(data.ticket);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;
    setSelectedTemplateId("");
    setMetaTemplateVariables(null);  // NOVO: limpar variáveis
    onClose && onClose();
  };

  // NOVO: Template selecionado
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Iniciar conversa com template oficial</DialogTitle>
      <DialogContent dividers>
        <Box mb={2}>
          <Alert severity="info">
            <Typography variant="body2">
              Para iniciar uma conversa fora da janela de 24h da API Oficial, é
              necessário enviar um <strong>template aprovado</strong> pela Meta.
            </Typography>
          </Alert>
        </Box>

        <FormControl
          variant="outlined"
          margin="dense"
          className={classes.fullWidth}
        >
          <InputLabel id="official-template-select-label">
            Template aprovado
          </InputLabel>
          <Select
            labelId="official-template-select-label"
            value={selectedTemplateId}
            onChange={e => setSelectedTemplateId(e.target.value)}
            label="Template aprovado"
            disabled={loadingTemplates || sending}
          >
            <MenuItem value="">
              <em>Selecione um template</em>
            </MenuItem>
            {loadingTemplates && (
              <MenuItem disabled>
                <CircularProgress size={20} style={{ marginRight: 8 }} />
                Carregando templates...
              </MenuItem>
            )}
            {!loadingTemplates &&
              templates.map(template => (
                <MenuItem key={template.id} value={template.id}>
                  <Box>
                    <Typography variant="body2">
                      <strong>{template.name}</strong> ({template.language})
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {template.category} • Status: {template.status}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
          </Select>

          {templates.length > 0 && !loadingTemplates && (
            <FormHelperText>
              {templates.length} template(s) disponível(is)
            </FormHelperText>
          )}

          {templates.length === 0 && !loadingTemplates && (
            <FormHelperText error>
              Nenhum template aprovado encontrado nesta conexão. Crie templates
              no Business Manager da Meta.
            </FormHelperText>
          )}
        </FormControl>

        {/* NOVO: Mapeador de variáveis do template */}
        {selectedTemplate && (
          <Box mt={2}>
            <TemplateVariableMapper
              whatsappId={whatsappId}
              templateName={selectedTemplate.name}
              languageCode={selectedTemplate.language || "pt_BR"}
              value={metaTemplateVariables}
              onChange={setMetaTemplateVariables}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={sending} color="secondary">
          Cancelar
        </Button>
        <Button
          onClick={handleSend}
          color="primary"
          variant="contained"
          disabled={sending || loadingTemplates || !templates.length}
        >
          {sending ? <CircularProgress size={18} /> : "Enviar template"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OfficialTemplateStartModal;
