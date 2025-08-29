import React, { useEffect, useMemo, useState } from "react";
import * as Yup from "yup";
import { Formik, Form } from "formik";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Typography,
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { TagsFilter } from "../TagsFilter";
import api from "../../services/api";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

// Conjunto de situações padronizadas (alinhado com backend)
const SITUATION_OPTIONS = [
  "Ativo",
  "Baixado",
  "Ex-Cliente",
  "Excluido",
  "Futuro",
  "Inativo",
];

const Schema = Yup.object().shape({
  // Nada obrigatório: usuário pode escolher atualizar apenas um campo
});

const BulkEditContactsModal = ({ open, onClose, selectedContactIds = [], onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [whatsapps, setWhatsapps] = useState([]);

  const initialValues = useMemo(
    () => ({
      // tags: array de objetos {id, name} vindos do TagsFilter
      tags: [],
      clearAllTags: false,
      // situation: "__KEEP__" | uma das opções
      situation: "__KEEP__",
      // whatsapp: { id, name } | null | "__KEEP__"
      whatsapp: "__KEEP__",
    }),
    []
  );

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data } = await api.get("/whatsapp");
        const list = (data || []).map((w) => ({ id: w.id, name: w.name, channel: w.channel }));
        setWhatsapps(list);
      } catch (err) {
        toastError(err);
      }
    })();
  }, [open]);

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      const data = {};

      // Tags: enviar se clearAllTags = true (tagIds: []) OU se houver seleção
      if (values.clearAllTags) {
        data.tagIds = [];
      } else if (Array.isArray(values.tags) && values.tags.length > 0) {
        data.tagIds = values.tags.map((t) => t.id);
      }

      // Situação: enviar se diferente de __KEEP__
      if (values.situation && values.situation !== "__KEEP__") {
        data.situation = values.situation;
      }

      // WhatsApp: enviar se diferente de __KEEP__. Se null => desvincular
      if (values.whatsapp !== "__KEEP__") {
        if (values.whatsapp === null) {
          data.whatsappId = null;
        } else if (typeof values.whatsapp?.id === "number") {
          data.whatsappId = values.whatsapp.id;
        }
      }

      if (Object.keys(data).length === 0) {
        toast.warn("Selecione ao menos um campo para atualizar.");
        return;
      }

      await api.put("/contacts/batch-update", {
        contactIds: selectedContactIds,
        data,
      });

      toast.success("Contatos atualizados com sucesso!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Editar contatos em massa</DialogTitle>
      <Formik
        initialValues={initialValues}
        enableReinitialize={true}
        validationSchema={Schema}
        onSubmit={async (values) => {
          await handleSubmit(values);
        }}
      >
        {({ values, setFieldValue, isSubmitting }) => (
          <Form>
            <DialogContent dividers>
              <Typography variant="body2" style={{ marginBottom: 12 }}>
                Selecionados: {selectedContactIds.length}
              </Typography>
              <Grid container spacing={2}>
                {/* Tags */}
                <Grid item xs={12}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="subtitle2">Tags</Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          color="primary"
                          checked={values.clearAllTags}
                          onChange={(e) => setFieldValue("clearAllTags", e.target.checked)}
                        />
                      }
                      label="Limpar todas as tags"
                    />
                  </div>
                  <Typography variant="caption" color="textSecondary">
                    Selecione tags para substituir as existentes. Deixe em branco para não alterar.
                  </Typography>
                  <div style={{ opacity: values.clearAllTags ? 0.5 : 1, pointerEvents: values.clearAllTags ? "none" : "auto" }}>
                    <TagsFilter onFiltered={(arr) => setFieldValue("tags", arr)} />
                  </div>
                </Grid>

                {/* Situação */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Situação"
                    value={values.situation}
                    onChange={(e) => setFieldValue("situation", e.target.value)}
                    variant="outlined"
                    margin="dense"
                    select
                    fullWidth
                    SelectProps={{ native: true }}
                  >
                    <option value="__KEEP__">Manter</option>
                    {SITUATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </TextField>
                </Grid>

                {/* WhatsApp (conexão) */}
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={whatsapps}
                    value={typeof values.whatsapp === "string" ? null : values.whatsapp}
                    onChange={(e, v) => setFieldValue("whatsapp", v)}
                    getOptionLabel={(opt) => opt?.name || ""}
                    getOptionSelected={(opt, val) => opt?.id === val?.id}
                    renderInput={(params) => (
                      <TextField {...params} variant="outlined" margin="dense" label="Conexão WhatsApp" />
                    )}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <Button size="small" onClick={() => setFieldValue("whatsapp", "__KEEP__")}>Manter</Button>
                    <Button size="small" onClick={() => setFieldValue("whatsapp", null)}>Nenhum (desvincular)</Button>
                  </div>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose} disabled={submitting || isSubmitting}>Cancelar</Button>
              <Button type="submit" color="primary" variant="contained" disabled={submitting || isSubmitting}>
                Salvar
                {(submitting || isSubmitting) && (
                  <CircularProgress size={20} style={{ marginLeft: 8 }} />
                )}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default BulkEditContactsModal;
