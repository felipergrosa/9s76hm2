import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  DialogActions,
  CircularProgress,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  Typography,
  InputAdornment,
  Checkbox,
  FormControlLabel
} from "@material-ui/core";

import Autocomplete from "@material-ui/lab/Autocomplete";

import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import useAuth from "../../hooks/useAuth.js";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: "100%",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
  },
  chip: {
    margin: 2,
  },
}));

const AddFilteredContactsModal = ({ open, onClose, contactListId, reload, savedFilter }) => {
  const classes = useStyles();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState([]);
  const [cities, setCities] = useState([]);
  const [segments, setSegments] = useState([]);
  const [situations, setSituations] = useState([]);
  const [representativeCodes, setRepresentativeCodes] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [saveFilterFlag, setSaveFilterFlag] = useState(false);
  const [cronTime, setCronTime] = useState("02:00"); // HH:mm
  const [cronTz, setCronTz] = useState("America/Sao_Paulo");
  const { user, getCurrentUserInfo } = useAuth();
  const timezones = [
    "America/Sao_Paulo",
    "America/Bahia",
    "America/Belem",
    "America/Recife",
    "America/Fortaleza",
    "America/Manaus",
    "America/Cuiaba",
    "America/Argentina/Buenos_Aires",
    "America/New_York",
    "UTC",
    "Europe/London"
  ];
  const monthsPT = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  // Situações padrão que devem sempre aparecer no filtro,
  // mesmo que ainda não existam contatos com esses valores no banco
  const defaultSituations = [
    "Ativo",
    "Baixado",
    "Ex-Cliente",
    "Excluido",
    "Futuro",
    "Inativo"
  ];

  useEffect(() => {
    if (open) {
      loadChannels();
      loadCities();
      loadSegments();
      loadSituations();
      loadRepresentativeCodes();
      loadTags();
      loadCronConfig();
    }
  }, [open]);

  // Quando abrir com savedFilter, pré-preencher selecionando as tags correspondentes
  useEffect(() => {
    if (open && savedFilter && Array.isArray(savedFilter.tags) && tags.length > 0) {
      const preSelected = tags.filter(t => savedFilter.tags.includes(t.id));
      setSelectedTags(preSelected);
    }
    if (open && savedFilter) {
      setSaveFilterFlag(true);
    } else {
      setSaveFilterFlag(false);
    }
  }, [open, savedFilter, tags]);

  // Garante que segmentos do savedFilter apareçam no Autocomplete mesmo que não existam na API
  useEffect(() => {
    if (open && savedFilter && Array.isArray(savedFilter.segment) && savedFilter.segment.length) {
      setSegments(prev => {
        const set = new Set(prev);
        savedFilter.segment.forEach(s => {
          const v = (s == null ? "" : String(s).trim());
          if (v) set.add(v);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
      });
    }
  }, [open, savedFilter]);

  const loadChannels = async () => {
    try {
      // Pagina por todos os contatos para coletar todos os canais
      let page = 1;
      let hasMore = true;
      const map = new Map(); // chave normalizada -> valor exibido

      while (hasMore) {
        const { data } = await api.get("/contacts", {
          params: {
            pageNumber: page,
            limit: 500,
            orderBy: "channel",
            order: "ASC",
          },
        });

        const list = Array.isArray(data?.contacts) ? data.contacts : [];
        for (const contact of list) {
          const raw = contact?.channel;
          if (!raw) continue;
          const value = String(raw).trim();
          if (!value) continue;
          const key = value.toLowerCase();
          if (!map.has(key)) map.set(key, value);
        }

        hasMore = Boolean(data?.hasMore);
        page += 1;
        if (list.length === 0) break;
      }

      const all = Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
      setChannels(all);
    } catch (err) {
      toastError(err);
    }
  };

  const loadSegments = async () => {
    try {
      let companyId = user?.companyId;
      if (!companyId) {
        const info = await getCurrentUserInfo?.();
        companyId = info?.user?.companyId || info?.companyId;
      }
      if (!companyId) return;

      const { data } = await api.get("/contacts/segments");
      const list = Array.isArray(data) ? data : (Array.isArray(data?.segments) ? data.segments : []);
      const normalized = list
        .map(s => (s == null ? "" : String(s).trim()))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
      setSegments(normalized);
    } catch (err) {
      toastError(err);
    }
  };

  const loadCities = async () => {
    try {
      // Pagina por todos os contatos para coletar todas as cidades
      let page = 1;
      let hasMore = true;
      const map = new Map(); // chave: cidade normalizada (lowercase), valor: cidade exibida

      while (hasMore) {
        const { data } = await api.get("/contacts", {
          params: {
            pageNumber: page,
            limit: 500,
            orderBy: "city",
            order: "ASC",
          },
        });

        const list = Array.isArray(data?.contacts) ? data.contacts : [];
        for (const contact of list) {
          const raw = contact?.city;
          if (!raw) continue;
          const value = String(raw).trim();
          if (!value) continue;
          const key = value.toLowerCase();
          if (!map.has(key)) map.set(key, value);
        }

        hasMore = Boolean(data?.hasMore);
        page += 1;

        // Segurança: se a API não informar hasMore corretamente e retornar vazio, interrompe
        if (list.length === 0) break;
      }

      const all = Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
      setCities(all);
    } catch (err) {
      toastError(err);
    }
  };

  const loadSituations = async () => {
    try {
      // Inicia o mapa com as situações padrão para garantir presença e capitalização correta
      const map = new Map();
      for (const s of defaultSituations) {
        map.set(String(s).toLowerCase(), s);
      }

      // Opcionalmente varre contatos para incluir situações existentes não previstas (por segurança)
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const { data } = await api.get("/contacts", {
          params: {
            pageNumber: page,
            limit: 500,
            orderBy: "situation",
            order: "ASC",
          },
        });

        const list = Array.isArray(data?.contacts) ? data.contacts : [];
        for (const contact of list) {
          const raw = contact?.situation;
          if (!raw) continue;
          const value = String(raw).trim();
          if (!value) continue;
          const key = value.toLowerCase();
          if (!map.has(key)) map.set(key, value);
        }

        hasMore = Boolean(data?.hasMore);
        page += 1;
        if (list.length === 0) break;
      }

      const all = Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
      setSituations(all);
    } catch (err) {
      // Fallback: garante opções padrão
      setSituations([...defaultSituations].sort((a, b) => a.localeCompare(b, "pt-BR")));
      toastError(err);
    }
  };

  const loadRepresentativeCodes = async () => {
    try {
      // Pagina por todos os contatos para coletar todos os códigos de representante
      let page = 1;
      let hasMore = true;
      const map = new Map(); // chave normalizada -> valor exibido

      while (hasMore) {
        const { data } = await api.get("/contacts", {
          params: {
            pageNumber: page,
            limit: 500,
            orderBy: "representativeCode",
            order: "ASC",
          },
        });

        const list = Array.isArray(data?.contacts) ? data.contacts : [];
        for (const contact of list) {
          const raw = contact?.representativeCode;
          if (!raw) continue;
          const value = String(raw).trim();
          if (!value) continue;
          const key = value.toLowerCase();
          if (!map.has(key)) map.set(key, value);
        }

        hasMore = Boolean(data?.hasMore);
        page += 1;
        if (list.length === 0) break;
      }

      const all = Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
      setRepresentativeCodes(all);
    } catch (err) {
      toastError(err);
    }
  };

  const loadTags = async () => {
    try {
      const { data } = await api.get("/tags");
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.tags) ? data.tags : []);
      const sorted = [...list].sort((a, b) => {
        const an = (a?.name || "").toString();
        const bn = (b?.name || "").toString();
        return an.localeCompare(bn, "pt-BR");
      });
      setTags(sorted);
    } catch (err) {
      toastError(err);
    }
  };

  const loadCronConfig = async () => {
    try {
      const { data } = await api.get("/settings/saved-filter-cron");
      if (data) {
        if (data.tz) setCronTz(data.tz);
        if (typeof data.expr === "string") {
          const parts = data.expr.trim().split(/\s+/);
          if (parts.length >= 2) {
            const min = parseInt(parts[0], 10);
            const hour = parseInt(parts[1], 10);
            if (!isNaN(min) && !isNaN(hour)) {
              const hh = String(hour).padStart(2, '0');
              const mm = String(min).padStart(2, '0');
              setCronTime(`${hh}:${mm}`);
            }
          }
        }
      }
    } catch (err) {
      // Silencia erro para não travar o modal
      console.warn("Falha ao carregar configuração do cron:", err);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedTags([]);
  };

  const handleAddFilteredContacts = async (values) => {
    setLoading(true);
    try {
      // Se usuário optar por salvar filtro e atualizar automaticamente, atualiza o cron antes
      if (saveFilterFlag) {
        try {
          const [hhStr, mmStr] = (cronTime || "02:00").split(":");
          const hNum = parseInt(hhStr, 10);
          const mNum = parseInt(mmStr, 10);
          if (!isNaN(hNum) && !isNaN(mNum)) {
            const expr = `${mNum} ${hNum} * * *`;
            await api.put("/settings/saved-filter-cron", { expr, tz: cronTz || "America/Sao_Paulo" });
          }
        } catch (e) {
          console.warn("Erro ao atualizar configuração do cron:", e);
          toast.warning("Não foi possível atualizar o horário de sincronização agora.");
        }
      }

      // Preparar os filtros para enviar ao backend
      const filters = {
        ...values,
        channel: values.channel ? values.channel : null,
        representativeCode: values.representativeCode ? values.representativeCode : null,
        city: values.city ? values.city : null,
        segment: values.segment ? values.segment : null,
        situation: values.situation ? values.situation : null,
        tags: selectedTags.map(tag => tag.id)
      };

      // Mapear meses selecionados (strings) para números (1-12)
      if (Array.isArray(values.foundationMonths) && values.foundationMonths.length > 0) {
        filters.foundationMonths = values.foundationMonths
          .map(m => monthsPT.indexOf(m) + 1)
          .filter(n => n > 0);
      }
      // Remover monthYear antigo, se existir
      delete filters.monthYear;

      // Tratar minCreditLimit e maxCreditLimit para garantir que sejam números ou strings numéricas
      if (filters.minCreditLimit) {
        filters.minCreditLimit = String(filters.minCreditLimit).replace(/R\$?\s?/gi, '').replace(/\./g, '').replace(/,/g, '.');
      }
      if (filters.maxCreditLimit) {
        filters.maxCreditLimit = String(filters.maxCreditLimit).replace(/R\$?\s?/gi, '').replace(/\./g, '').replace(/,/g, '.');
      }

      // Remover filtros vazios
      Object.keys(filters).forEach(key => {
        if (filters[key] === "" || filters[key] === null || filters[key] === undefined ||
          (Array.isArray(filters[key]) && filters[key].length === 0)) {
          delete filters[key];
        }
      });

      try {
        const { data } = await api.post(
          `/contact-list-items/${contactListId}/add-filtered-contacts`,
          { filters, saveFilter: saveFilterFlag }
        );

        toast.success(
          i18n.t("contactListItems.toasts.addedSuccess", {
            count: data.added,
          })
        );

        if (data.duplicated > 0) {
          toast.warning(
            i18n.t("contactListItems.toasts.duplicated", {
              count: data.duplicated,
            })
          );
        }

        if (data.errors > 0) {
          toast.error(
            i18n.t("contactListItems.toasts.addedError", {
              count: data.errors,
            })
          );
        }

        handleClose();
        reload();
      } catch (err) {
        console.error("Erro ao adicionar contatos filtrados:", err);
        
        // Mensagens de erro mais específicas
        if (err.response && err.response.data && err.response.data.error) {
          const errorMsg = err.response.data.error;
          
          if (errorMsg.includes("limite de crédito")) {
            toast.error(i18n.t("contactListItems.toasts.creditLimitError"));
          } else if (errorMsg.includes("mês/ano")) {
            toast.error(i18n.t("contactListItems.toasts.monthYearError"));
          } else if (errorMsg.includes("tags")) {
            toast.error(i18n.t("contactListItems.toasts.tagsError"));
          } else {
            toastError(err);
          }
        } else {
          toastError(err);
        }
      }
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      scroll="paper"
    >
      <DialogTitle>
        {i18n.t("contactListItems.dialog.filter")}
      </DialogTitle>
      <Formik
        initialValues={{
          channel: (savedFilter && savedFilter.channel) ? savedFilter.channel : [],
          representativeCode: (savedFilter && savedFilter.representativeCode) ? savedFilter.representativeCode : [],
          city: (savedFilter && savedFilter.city) ? savedFilter.city : [],
          segment: (savedFilter && savedFilter.segment) ? savedFilter.segment : [],
          situation: (savedFilter && savedFilter.situation) ? savedFilter.situation : [],
          foundationMonths: (savedFilter && Array.isArray(savedFilter.foundationMonths))
            ? savedFilter.foundationMonths.map(n => monthsPT[n - 1]).filter(Boolean)
            : [],
          minCreditLimit: (savedFilter && savedFilter.minCreditLimit) ? savedFilter.minCreditLimit : "",
          maxCreditLimit: (savedFilter && savedFilter.maxCreditLimit) ? savedFilter.maxCreditLimit : "",
        }}
        enableReinitialize={true}
        onSubmit={(values, actions) => {
          handleAddFilteredContacts(values);
          actions.setSubmitting(false);
        }}
      >
        {({ values, errors, touched, isSubmitting }) => (
          <Form>
            <DialogContent dividers>
              <Grid container spacing={2}>

                <Grid item xs={12} md={6}>
                  <Field name="channel">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={channels}
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label={i18n.t("contactListItems.filterDialog.channel")}
                            placeholder={i18n.t("contactListItems.filterDialog.channel")}
                            fullWidth
                            margin="dense"
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field name="representativeCode">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={representativeCodes}
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label={i18n.t("contactListItems.filterDialog.representativeCode")}
                            placeholder={i18n.t("contactListItems.filterDialog.representativeCode")}
                            fullWidth
                            margin="dense"
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field name="city">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={cities}
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label={i18n.t("contactListItems.filterDialog.city")}
                            placeholder={i18n.t("contactListItems.filterDialog.city")}
                            fullWidth
                            margin="dense"
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field name="segment">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={segments}
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label="Segmento de Mercado"
                            placeholder="Segmento de Mercado"
                            fullWidth
                            margin="dense"
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field name="situation">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={situations}
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label={i18n.t("contactListItems.filterDialog.situation")}
                            placeholder={i18n.t("contactListItems.filterDialog.situation")}
                            fullWidth
                            margin="dense"
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field name="foundationMonths">
                    {({ field, form }) => (
                      <Autocomplete
                        multiple
                        options={monthsPT}
                        getOptionLabel={(option) => option}
                        value={field.value || []}
                        onChange={(event, value) => form.setFieldValue(field.name, value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label={i18n.t("contactListItems.filterDialog.monthYear")}
                            placeholder={i18n.t("contactListItems.filterDialog.monthYear")}
                            fullWidth
                            margin="dense"
                          />
                        )}
                      />
                    )}
                  </Field>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("contactListItems.filterDialog.minCreditLimit")}
                    name="minCreditLimit"
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("contactListItems.filterDialog.maxCreditLimit")}
                    name="maxCreditLimit"
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    id="tags"
                    options={tags}
                    getOptionLabel={(option) => option.name}
                    value={selectedTags}
                    onChange={(e, newValue) => {
                      setSelectedTags(newValue);
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="outlined"
                          label={option.name}
                          {...getTagProps({ index })}
                          style={{ backgroundColor: option.color, color: "#fff" }}
                          className={classes.chip}
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="outlined"
                        label={i18n.t("contactListItems.filterDialog.tags")}
                        placeholder={i18n.t("contactListItems.filterDialog.tags")}
                        fullWidth
                        margin="dense"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        color="primary"
                        checked={saveFilterFlag}
                        onChange={(e) => setSaveFilterFlag(e.target.checked)}
                      />
                    }
                    label="Salvar este filtro e atualizar automaticamente (diariamente)"
                  />
                </Grid>

                {saveFilterFlag && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Horário diário da sincronização"
                        type="time"
                        value={cronTime}
                        onChange={(e) => setCronTime(e.target.value)}
                        fullWidth
                        variant="outlined"
                        margin="dense"
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ step: 300 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Autocomplete
                        freeSolo
                        options={timezones}
                        getOptionLabel={(option) => option}
                        value={cronTz}
                        onChange={(e, newValue) => setCronTz(newValue || "")}
                        onInputChange={(e, newInputValue) => setCronTz(newInputValue || "")}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label="Timezone (IANA)"
                            placeholder="Ex.: America/Sao_Paulo"
                            fullWidth
                            margin="dense"
                          />
                        )}
                      />
                    </Grid>
                  </>
                )}

              </Grid>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={handleClose}
                color="secondary"
                disabled={loading}
                variant="outlined"
              >
                {i18n.t("contactListItems.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                color="primary"
                disabled={loading}
                variant="contained"
                className={classes.btnWrapper}
              >
                {i18n.t("contactListItems.buttons.filter")}
                {loading && (
                  <CircularProgress
                    size={24}
                    className={classes.buttonProgress}
                  />
                )}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default AddFilteredContactsModal;
