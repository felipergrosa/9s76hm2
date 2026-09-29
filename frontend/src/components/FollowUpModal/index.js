import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import Grid from "@material-ui/core/Grid";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import Paper from "@material-ui/core/Paper";
import AddIcon from "@material-ui/icons/Add";
import DeleteIcon from "@material-ui/icons/Delete";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import useWhatsApps from "../../hooks/useWhatsApps";

const useStyles = makeStyles(theme => ({
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
  stepCard: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
}));

const FollowUpSchema = Yup.object().shape({
  name: Yup.string().required("Obrigatório"),
  tagId: Yup.string().required("Obrigatório")
});

const initialState = {
  name: "",
  tagId: "",
  whatsappId: "",
  active: true
};

const emptyStep = {
  delayDays: 0,
  delayMinutes: 0,
  delayUnit: "days",
  delayValue: 0,
  message: "",
  metaTemplateName: "",
  metaTemplateLanguage: "pt_BR"
};

// Converte valor+unidade do modal em delayDays/delayMinutes do backend
const stepToDelay = step => {
  const value = Number(step.delayValue) || 0;
  if (step.delayUnit === "minutes") return { delayDays: 0, delayMinutes: value };
  if (step.delayUnit === "hours") return { delayDays: 0, delayMinutes: value * 60 };
  return { delayDays: value, delayMinutes: 0 };
};

// Converte delayDays/delayMinutes do backend para valor+unidade do modal
const delayToStep = step => {
  const days = Number(step.delayDays) || 0;
  const minutes = Number(step.delayMinutes) || 0;
  if (minutes > 0 && minutes % 60 === 0 && days === 0)
    return { delayUnit: "hours", delayValue: minutes / 60 };
  if (minutes > 0 && days === 0)
    return { delayUnit: "minutes", delayValue: minutes };
  return { delayUnit: "days", delayValue: days };
};

const FollowUpModal = ({ open, onClose, followUpId }) => {
  const classes = useStyles();
  const { whatsApps } = useWhatsApps();
  const [followUp, setFollowUp] = useState(initialState);
  const [tags, setTags] = useState([]);
  const [steps, setSteps] = useState([{ ...emptyStep }]);
  const [metaTemplates, setMetaTemplates] = useState([]);
  const [selectedWhatsapp, setSelectedWhatsapp] = useState(null);

  useEffect(() => {
    if (!open) return;
    // Tags normais (kanban=0) + lanes do Kanban (kanban=1) — ambas disparam follow-up
    Promise.all([
      api.get("/tags/", { params: { kanban: 0 } }),
      api.get("/tags/", { params: { kanban: 1 } })
    ])
      .then(([normal, lanes]) => {
        const normalTags = (normal.data.tags || normal.data || []).map(t => ({ ...t, isLane: false }));
        const laneTags = (lanes.data.tags || lanes.data || []).map(t => ({ ...t, isLane: true }));
        setTags([...laneTags, ...normalTags]);
      })
      .catch(toastError);
  }, [open]);

  // Carrega templates Meta quando a conexão selecionada é oficial
  useEffect(() => {
    const wa = whatsApps.find(w => w.id === Number(followUp.whatsappId));
    setSelectedWhatsapp(wa || null);
    if (wa && wa.channelType === "official") {
      api.get(`/meta-templates/${wa.id}`)
        .then(({ data }) => {
          const list = data.templates || [];
          setMetaTemplates(list.filter(t => t.status === "APPROVED"));
        })
        .catch(() => setMetaTemplates([]));
    } else {
      setMetaTemplates([]);
    }
  }, [followUp.whatsappId, whatsApps]);

  useEffect(() => {
    const fetchFollowUp = async () => {
      if (!followUpId) {
        setFollowUp(initialState);
        setSteps([{ ...emptyStep }]);
        return;
      }
      try {
        const { data } = await api.get(`/drip-sequences/${followUpId}`);
        setFollowUp({
          name: data.name || "",
          tagId: data.tagId || "",
          whatsappId: data.whatsappId || "",
          active: data.active !== false
        });
        const loadedSteps = (data.steps || []).map(s => ({
          ...emptyStep,
          ...delayToStep(s),
          message: s.message || "",
          metaTemplateName: s.metaTemplateName || "",
          metaTemplateLanguage: s.metaTemplateLanguage || "pt_BR",
          metaTemplateVariables: s.metaTemplateVariables || ""
        }));
        setSteps(loadedSteps.length > 0 ? loadedSteps : [{ ...emptyStep }]);
      } catch (err) {
        toastError(err);
      }
    };
    fetchFollowUp();
  }, [followUpId, open]);

  const handleClose = () => {
    setFollowUp(initialState);
    setSteps([{ ...emptyStep }]);
    onClose();
  };

  const handleAddStep = () => setSteps(prev => [...prev, { ...emptyStep }]);
  const handleRemoveStep = index => setSteps(prev => prev.filter((_, i) => i !== index));
  const handleStepChange = (index, field, value) => {
    setSteps(prev => prev.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  };

  const handleSave = async values => {
    const isOfficial = selectedWhatsapp?.channelType === "official";
    const validSteps = steps.filter(s =>
      (s.message && s.message.trim()) || (s.metaTemplateName && s.metaTemplateName.trim())
    );
    if (validSteps.length === 0) {
      toast.warning("Adicione ao menos uma etapa com mensagem ou template");
      return;
    }
    if (isOfficial && validSteps.some(s => !s.metaTemplateName)) {
      toast.warning(
        "Conexão oficial: etapas sem template Meta só entregam dentro da janela de 24h. " +
        "Fora dela o envio falha — considere usar template em todas as etapas."
      );
    }

    const payload = {
      ...values,
      whatsappId: values.whatsappId || null,
      steps: validSteps.map((step, index) => ({
        order: index,
        ...stepToDelay(step),
        message: step.message || "",
        metaTemplateName: step.metaTemplateName || null,
        metaTemplateLanguage: step.metaTemplateName
          ? step.metaTemplateLanguage || "pt_BR"
          : null
      }))
    };

    try {
      if (followUpId) {
        await api.put(`/drip-sequences/${followUpId}`, payload);
      } else {
        await api.post("/drip-sequences", payload);
      }
      toast.success("Follow-up salvo com sucesso!");
    } catch (err) {
      toastError(err);
    }
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{followUpId ? "Editar Follow-up" : "Novo Follow-up"}</DialogTitle>
      <Formik
        initialValues={followUp}
        enableReinitialize
        validationSchema={FollowUpSchema}
        onSubmit={(values, actions) => {
          setTimeout(() => {
            handleSave(values);
            actions.setSubmitting(false);
          }, 300);
        }}
      >
        {({ touched, errors, isSubmitting, values, setFieldValue }) => (
          <Form>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    label="Nome da sequência"
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl variant="outlined" margin="dense" fullWidth error={touched.tagId && Boolean(errors.tagId)}>
                    <InputLabel>Tag / Lane que dispara a inscrição</InputLabel>
                    <Select
                      value={values.tagId}
                      onChange={e => setFieldValue("tagId", e.target.value)}
                      label="Tag / Lane que dispara a inscrição"
                    >
                      {tags.map(tag => (
                        <MenuItem key={tag.id} value={tag.id}>
                          {tag.isLane ? `Lane: ${tag.name}` : tag.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl variant="outlined" margin="dense" fullWidth>
                    <InputLabel>Conexão WhatsApp</InputLabel>
                    <Select
                      value={values.whatsappId}
                      onChange={e => setFieldValue("whatsappId", e.target.value)}
                      label="Conexão WhatsApp"
                    >
                      <MenuItem value="">Nenhuma</MenuItem>
                      {whatsApps.map(w => (
                        <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={values.active}
                        onChange={e => setFieldValue("active", e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Sequência ativa"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Etapas — enviadas em sequência enquanto o contato estiver na lane/tag e não interagir.
                    Use {"{{name}}"} ou {"{{firstName}}"} para personalizar.
                  </Typography>
                  {selectedWhatsapp?.channelType === "official" && (
                    <Typography variant="caption" color="textSecondary">
                      Conexão oficial: mensagens livres só entregam dentro da janela de 24h.
                      Para follow-up fora da janela, selecione um template Meta na etapa.
                    </Typography>
                  )}
                </Grid>

                {steps.map((step, index) => (
                  <Grid item xs={12} key={index}>
                    <Paper variant="outlined" className={classes.stepCard}>
                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs={5} sm={4}>
                          <Grid container spacing={1}>
                            <Grid item xs={7}>
                              <TextField
                                label={index === 0 ? "Enviar após" : "Após etapa anterior"}
                                type="number"
                                inputProps={{ min: 0 }}
                                value={step.delayValue}
                                onChange={e => handleStepChange(index, "delayValue", e.target.value)}
                                variant="outlined"
                                size="small"
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={5}>
                              <FormControl variant="outlined" size="small" fullWidth>
                                <Select
                                  value={step.delayUnit}
                                  onChange={e => handleStepChange(index, "delayUnit", e.target.value)}
                                >
                                  <MenuItem value="minutes">min</MenuItem>
                                  <MenuItem value="hours">horas</MenuItem>
                                  <MenuItem value="days">dias</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                          </Grid>
                        </Grid>
                        <Grid item xs={6} sm={7}>
                          <TextField
                            label={`Mensagem da etapa ${index + 1}`}
                            value={step.message}
                            onChange={e => handleStepChange(index, "message", e.target.value)}
                            variant="outlined"
                            size="small"
                            multiline
                            rows={2}
                            fullWidth
                          />
                          {metaTemplates.length > 0 && (
                            <FormControl variant="outlined" size="small" fullWidth style={{ marginTop: 8 }}>
                              <InputLabel>Template Meta (opcional — substitui a mensagem)</InputLabel>
                              <Select
                                value={
                                  step.metaTemplateName
                                    ? `${step.metaTemplateName}|||${step.metaTemplateLanguage || "pt_BR"}`
                                    : ""
                                }
                                onChange={e => {
                                  const [name, lang] = String(e.target.value).split("|||");
                                  handleStepChange(index, "metaTemplateName", name || "");
                                  handleStepChange(index, "metaTemplateLanguage", lang || "pt_BR");
                                }}
                                label="Template Meta (opcional — substitui a mensagem)"
                              >
                                <MenuItem value="">Nenhum (mensagem livre)</MenuItem>
                                {metaTemplates.map(t => (
                                  <MenuItem
                                    key={t.id || `${t.name}-${t.language}`}
                                    value={`${t.name}|||${t.language}`}
                                  >
                                    {t.name} ({t.language})
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                        </Grid>
                        <Grid item xs={1}>
                          <IconButton size="small" onClick={() => handleRemoveStep(index)} disabled={steps.length === 1}>
                            <DeleteIcon />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                ))}
                <Grid item xs={12}>
                  <Button startIcon={<AddIcon />} onClick={handleAddStep} color="primary">
                    Adicionar etapa
                  </Button>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} color="secondary" disabled={isSubmitting} variant="outlined">
                Cancelar
              </Button>
              <Button type="submit" color="primary" disabled={isSubmitting} variant="contained" className={classes.btnWrapper}>
                {followUpId ? "Salvar" : "Adicionar"}
                {isSubmitting && <CircularProgress size={24} className={classes.buttonProgress} />}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default FollowUpModal;
