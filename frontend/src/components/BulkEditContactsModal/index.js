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
  Box,
  Chip,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Autocomplete from "@material-ui/lab/Autocomplete";
import {
  LocalOffer as TagIcon,
  PhoneAndroid as PhoneIcon,
  Person as PersonIcon,
  Assignment as StatusIcon,
} from "@material-ui/icons";
import { TagsFilter } from "../TagsFilter";
import api from "../../services/api";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

// Estilos modernos
const useStyles = makeStyles((theme) => ({
  sectionCard: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: "1px solid #e0e0e0",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    marginBottom: theme.spacing(1.5),
    gap: theme.spacing(1),
  },
  sectionIcon: {
    color: theme.palette.primary.main,
    fontSize: 20,
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: 14,
    color: "#333",
  },
  countBadge: {
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    padding: "6px 16px",
    borderRadius: 20,
    fontWeight: 600,
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    marginBottom: theme.spacing(2),
  },
  helperText: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  dialogTitle: {
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    borderRadius: "16px 16px 0 0",
    "& h2": {
      fontWeight: 600,
    },
  },
  dialogPaper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  actionButton: {
    borderRadius: 8,
    textTransform: "none",
    fontWeight: 500,
  },
}));

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
  const classes = useStyles();
  const [submitting, setSubmitting] = useState(false);
  const [whatsapps, setWhatsapps] = useState([]);
  const [users, setUsers] = useState([]);

  const initialValues = useMemo(
    () => ({
      tags: [],
      clearAllTags: false,
      situation: "__KEEP__",
      whatsapp: "__KEEP__",
      wallets: [], // Array de usuários selecionados
      clearWallets: false,
      disableBot: "__KEEP__", // __KEEP__, true, false
    }),
    []
  );

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        // Carregar WhatsApps
        const { data: whatsData } = await api.get("/whatsapp");
        const list = (whatsData || []).map((w) => ({ id: w.id, name: w.name, channel: w.channel }));
        setWhatsapps(list);

        // Carregar usuários para carteira
        const { data: usersData } = await api.get("/users");
        const usersList = Array.isArray(usersData?.users)
          ? usersData.users.map((u) => ({ id: u.id, name: u.name }))
          : [];
        setUsers(usersList);
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

      // Carteira: enviar se clearWallets = true (walletIds: []) OU se houver seleção
      if (values.clearWallets) {
        data.walletIds = [];
      } else if (Array.isArray(values.wallets) && values.wallets.length > 0) {
        data.walletIds = values.wallets.map((u) => u.id);
      }

      // Chatbot: enviar se diferente de __KEEP__
      if (values.disableBot !== "__KEEP__") {
        data.disableBot = values.disableBot === true || values.disableBot === "true";
      }

      if (Object.keys(data).length === 0) {
        toast.warn("Selecione ao menos um campo para atualizar.");
        return;
      }

      await api.put("/contacts/batch-update", {
        contactIds: selectedContactIds,
        data,
      });

      toast.success(`${selectedContactIds.length} contato(s) atualizado(s) com sucesso!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ className: classes.dialogPaper }}>
      <DialogTitle className={classes.dialogTitle}>
        ✏️ Editar Contatos em Massa
      </DialogTitle>
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
            <DialogContent dividers style={{ backgroundColor: "#f5f5f5" }}>
              {/* Contador de Selecionados */}
              <Box display="flex" justifyContent="center" mb={2}>
                <span className={classes.countBadge}>
                  📋 {selectedContactIds.length} contato(s) selecionado(s)
                </span>
              </Box>

              {/* Seção: Tags */}
              <div className={classes.sectionCard}>
                <div className={classes.sectionHeader}>
                  <TagIcon className={classes.sectionIcon} />
                  <Typography className={classes.sectionTitle}>Tags</Typography>
                  <Box flex={1} />
                  <FormControlLabel
                    control={
                      <Checkbox
                        color="primary"
                        size="small"
                        checked={values.clearAllTags}
                        onChange={(e) => setFieldValue("clearAllTags", e.target.checked)}
                      />
                    }
                    label={<Typography variant="caption">Limpar todas</Typography>}
                  />
                </div>
                <Typography className={classes.helperText}>
                  Selecione tags para substituir as existentes. Deixe em branco para manter.
                </Typography>
                <div style={{ opacity: values.clearAllTags ? 0.5 : 1, pointerEvents: values.clearAllTags ? "none" : "auto", marginTop: 8 }}>
                  <TagsFilter onFiltered={(arr) => setFieldValue("tags", arr)} />
                </div>
              </div>

              {/* Seção: Status e Conexão */}
              <div className={classes.sectionCard}>
                <Grid container spacing={2}>
                  {/* Situação */}
                  <Grid item xs={12} sm={6}>
                    <div className={classes.sectionHeader}>
                      <StatusIcon className={classes.sectionIcon} />
                      <Typography className={classes.sectionTitle}>Situação</Typography>
                    </div>
                    <TextField
                      value={values.situation}
                      onChange={(e) => setFieldValue("situation", e.target.value)}
                      variant="outlined"
                      size="small"
                      select
                      fullWidth
                      SelectProps={{ native: true }}
                    >
                      <option value="__KEEP__">🔄 Manter atual</option>
                      {SITUATION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </TextField>
                  </Grid>

                  {/* WhatsApp (conexão) */}
                  <Grid item xs={12} sm={6}>
                    <div className={classes.sectionHeader}>
                      <PhoneIcon className={classes.sectionIcon} />
                      <Typography className={classes.sectionTitle}>Conexão WhatsApp</Typography>
                    </div>
                    <Autocomplete
                      options={whatsapps}
                      value={typeof values.whatsapp === "string" ? null : values.whatsapp}
                      onChange={(e, v) => setFieldValue("whatsapp", v)}
                      getOptionLabel={(opt) => opt?.name || ""}
                      getOptionSelected={(opt, val) => opt?.id === val?.id}
                      size="small"
                      renderInput={(params) => (
                        <TextField {...params} variant="outlined" placeholder="Selecionar..." />
                      )}
                    />
                    <Box display="flex" gap={1} mt={1}>
                      <Chip
                        size="small"
                        label="Manter"
                        onClick={() => setFieldValue("whatsapp", "__KEEP__")}
                        color={values.whatsapp === "__KEEP__" ? "primary" : "default"}
                        variant={values.whatsapp === "__KEEP__" ? "default" : "outlined"}
                      />
                      <Chip
                        size="small"
                        label="Desvincular"
                        onClick={() => setFieldValue("whatsapp", null)}
                        color={values.whatsapp === null ? "secondary" : "default"}
                        variant={values.whatsapp === null ? "default" : "outlined"}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </div>

              {/* Seção: Carteira + Chatbot (mesma linha) */}
              <Grid container spacing={2}>
                {/* Carteira */}
                <Grid item xs={12} sm={6}>
                  <div className={classes.sectionCard} style={{ height: '100%' }}>
                    <div className={classes.sectionHeader}>
                      <PersonIcon className={classes.sectionIcon} />
                      <Typography className={classes.sectionTitle}>Carteira</Typography>
                      <Box flex={1} />
                      <FormControlLabel
                        control={
                          <Checkbox
                            color="primary"
                            size="small"
                            checked={values.clearWallets}
                            onChange={(e) => setFieldValue("clearWallets", e.target.checked)}
                          />
                        }
                        label={<Typography variant="caption">Limpar</Typography>}
                      />
                    </div>
                    <div style={{ opacity: values.clearWallets ? 0.5 : 1, pointerEvents: values.clearWallets ? "none" : "auto" }}>
                      <Autocomplete
                        multiple
                        options={users}
                        value={values.wallets}
                        onChange={(e, v) => setFieldValue("wallets", v)}
                        getOptionLabel={(opt) => opt?.name || ""}
                        getOptionSelected={(opt, val) => opt?.id === val?.id}
                        size="small"
                        renderInput={(params) => (
                          <TextField {...params} variant="outlined" placeholder="Selecionar..." />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              size="small"
                              label={option.name}
                              {...getTagProps({ index })}
                              style={{ margin: 2 }}
                            />
                          ))
                        }
                      />
                    </div>
                  </div>
                </Grid>

                {/* Chatbot */}
                <Grid item xs={12} sm={6}>
                  <div className={classes.sectionCard} style={{ height: '100%' }}>
                    <div className={classes.sectionHeader}>
                      <span style={{ fontSize: 20, marginRight: 8 }}>🤖</span>
                      <Typography className={classes.sectionTitle}>Chatbot</Typography>
                    </div>
                    <Typography className={classes.helperText} style={{ marginBottom: 8 }}>
                      Habilitar ou desabilitar o bot
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      <Chip
                        size="small"
                        label="🔄 Manter"
                        onClick={() => setFieldValue("disableBot", "__KEEP__")}
                        color={values.disableBot === "__KEEP__" ? "primary" : "default"}
                        variant={values.disableBot === "__KEEP__" ? "default" : "outlined"}
                      />
                      <Chip
                        size="small"
                        label="✅ Habilitar"
                        onClick={() => setFieldValue("disableBot", false)}
                        style={{ backgroundColor: values.disableBot === false ? '#4caf50' : undefined, color: values.disableBot === false ? '#fff' : undefined }}
                        variant={values.disableBot === false ? "default" : "outlined"}
                      />
                      <Chip
                        size="small"
                        label="🚫 Desabilitar"
                        onClick={() => setFieldValue("disableBot", true)}
                        style={{ backgroundColor: values.disableBot === true ? '#f44336' : undefined, color: values.disableBot === true ? '#fff' : undefined }}
                        variant={values.disableBot === true ? "default" : "outlined"}
                      />
                    </Box>
                  </div>
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions style={{ padding: "16px 24px" }}>
              <Button
                onClick={onClose}
                disabled={submitting || isSubmitting}
                className={classes.actionButton}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                color="primary"
                variant="contained"
                disabled={submitting || isSubmitting}
                className={classes.actionButton}
              >
                💾 Salvar Alterações
                {(submitting || isSubmitting) && (
                  <CircularProgress size={20} style={{ marginLeft: 8, color: "#fff" }} />
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
