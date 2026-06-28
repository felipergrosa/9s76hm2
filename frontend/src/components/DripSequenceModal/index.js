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

const DripSequenceSchema = Yup.object().shape({
  name: Yup.string().required("Obrigatório"),
  tagId: Yup.string().required("Obrigatório")
});

const initialState = {
  name: "",
  tagId: "",
  whatsappId: "",
  active: true
};

const emptyStep = { delayDays: 0, message: "" };

const DripSequenceModal = ({ open, onClose, dripSequenceId }) => {
  const classes = useStyles();
  const { whatsApps } = useWhatsApps();
  const [dripSequence, setDripSequence] = useState(initialState);
  const [tags, setTags] = useState([]);
  const [steps, setSteps] = useState([{ ...emptyStep }]);

  useEffect(() => {
    if (!open) return;
    api.get("/tags/", { params: { kanban: 0 } })
      .then(({ data }) => setTags(data.tags || []))
      .catch(toastError);
  }, [open]);

  useEffect(() => {
    const fetchDripSequence = async () => {
      if (!dripSequenceId) {
        setDripSequence(initialState);
        setSteps([{ ...emptyStep }]);
        return;
      }
      try {
        const { data } = await api.get(`/drip-sequences/${dripSequenceId}`);
        setDripSequence({
          name: data.name || "",
          tagId: data.tagId || "",
          whatsappId: data.whatsappId || "",
          active: data.active !== false
        });
        const loadedSteps = (data.steps || []).map(s => ({ delayDays: s.delayDays, message: s.message }));
        setSteps(loadedSteps.length > 0 ? loadedSteps : [{ ...emptyStep }]);
      } catch (err) {
        toastError(err);
      }
    };
    fetchDripSequence();
  }, [dripSequenceId, open]);

  const handleClose = () => {
    setDripSequence(initialState);
    setSteps([{ ...emptyStep }]);
    onClose();
  };

  const handleAddStep = () => setSteps(prev => [...prev, { ...emptyStep }]);
  const handleRemoveStep = index => setSteps(prev => prev.filter((_, i) => i !== index));
  const handleStepChange = (index, field, value) => {
    setSteps(prev => prev.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  };

  const handleSave = async values => {
    const validSteps = steps.filter(s => s.message && s.message.trim());
    if (validSteps.length === 0) {
      toast.warning("Adicione ao menos uma etapa com mensagem");
      return;
    }

    const payload = {
      ...values,
      whatsappId: values.whatsappId || null,
      steps: validSteps.map((step, index) => ({
        order: index,
        delayDays: Number(step.delayDays) || 0,
        message: step.message
      }))
    };

    try {
      if (dripSequenceId) {
        await api.put(`/drip-sequences/${dripSequenceId}`, payload);
      } else {
        await api.post("/drip-sequences", payload);
      }
      toast.success("Sequência de drip salva com sucesso!");
    } catch (err) {
      toastError(err);
    }
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{dripSequenceId ? "Editar Sequência de Drip" : "Nova Sequência de Drip"}</DialogTitle>
      <Formik
        initialValues={dripSequence}
        enableReinitialize
        validationSchema={DripSequenceSchema}
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
                    <InputLabel>Tag que dispara a inscrição</InputLabel>
                    <Select
                      value={values.tagId}
                      onChange={e => setFieldValue("tagId", e.target.value)}
                      label="Tag que dispara a inscrição"
                    >
                      {tags.map(tag => (
                        <MenuItem key={tag.id} value={tag.id}>{tag.name}</MenuItem>
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
                    Etapas (mensagens enviadas em sequência). Use {"{{name}}"} ou {"{{firstName}}"} para personalizar.
                  </Typography>
                </Grid>

                {steps.map((step, index) => (
                  <Grid item xs={12} key={index}>
                    <Paper variant="outlined" className={classes.stepCard}>
                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs={4} sm={3}>
                          <TextField
                            label={index === 0 ? "Enviar no dia" : "Dias após a etapa anterior"}
                            type="number"
                            value={step.delayDays}
                            onChange={e => handleStepChange(index, "delayDays", e.target.value)}
                            variant="outlined"
                            size="small"
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={7} sm={8}>
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
                {dripSequenceId ? "Salvar" : "Adicionar"}
                {isSubmitting && <CircularProgress size={24} className={classes.buttonProgress} />}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default DripSequenceModal;
