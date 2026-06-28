import React, { useState, useEffect, useCallback } from "react";

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
import Typography from "@material-ui/core/Typography";

import api from "../../services/api";
import toastError from "../../errors/toastError";

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
}));

const EmailCampaignSchema = Yup.object().shape({
  name: Yup.string().required("Obrigatório"),
  subject: Yup.string().required("Obrigatório"),
  message: Yup.string().required("Obrigatório")
});

const initialState = {
  name: "",
  subject: "",
  message: "",
  contactListId: "",
  scheduledAt: ""
};

const EmailCampaignModal = ({ open, onClose, emailCampaignId }) => {
  const classes = useStyles();
  const [emailCampaign, setEmailCampaign] = useState(initialState);
  const [contactLists, setContactLists] = useState([]);

  const loadContactLists = useCallback(async () => {
    const allRecords = [];
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const { data } = await api.get("/contact-lists", { params: { pageNumber } });
      const records = Array.isArray(data?.records) ? data.records : [];
      allRecords.push(...records);
      hasMore = Boolean(data?.hasMore);
      pageNumber += 1;
    }

    return allRecords;
  }, []);

  useEffect(() => {
    if (!open) return;
    loadContactLists().then(setContactLists).catch(toastError);
  }, [open, loadContactLists]);

  useEffect(() => {
    const fetchEmailCampaign = async () => {
      if (!emailCampaignId) {
        setEmailCampaign(initialState);
        return;
      }
      try {
        const { data } = await api.get(`/email-campaigns/${emailCampaignId}`);
        setEmailCampaign({
          name: data.name || "",
          subject: data.subject || "",
          message: data.message || "",
          contactListId: data.contactListId || "",
          scheduledAt: data.scheduledAt ? data.scheduledAt.substring(0, 16) : ""
        });
      } catch (err) {
        toastError(err);
      }
    };
    fetchEmailCampaign();
  }, [emailCampaignId, open]);

  const handleClose = () => {
    setEmailCampaign(initialState);
    onClose();
  };

  const handleSave = async values => {
    const payload = {
      ...values,
      contactListId: values.contactListId || null,
      scheduledAt: values.scheduledAt || null
    };
    try {
      if (emailCampaignId) {
        await api.put(`/email-campaigns/${emailCampaignId}`, payload);
      } else {
        await api.post("/email-campaigns", payload);
      }
      toast.success("Campanha de e-mail salva com sucesso!");
    } catch (err) {
      toastError(err);
    }
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{emailCampaignId ? "Editar Campanha de E-mail" : "Nova Campanha de E-mail"}</DialogTitle>
      <Formik
        initialValues={emailCampaign}
        enableReinitialize
        validationSchema={EmailCampaignSchema}
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
                    label="Nome da campanha"
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    label="Assunto do e-mail"
                    name="subject"
                    error={touched.subject && Boolean(errors.subject)}
                    helperText={touched.subject && errors.subject}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    label="Mensagem (HTML ou texto)"
                    name="message"
                    multiline
                    rows={8}
                    error={touched.message && Boolean(errors.message)}
                    helperText={(touched.message && errors.message) || "Use {name} ou {email} para personalizar"}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl variant="outlined" margin="dense" fullWidth>
                    <InputLabel>Lista de contatos</InputLabel>
                    <Select
                      value={values.contactListId}
                      onChange={e => setFieldValue("contactListId", e.target.value)}
                      label="Lista de contatos"
                    >
                      <MenuItem value="">Nenhuma</MenuItem>
                      {contactLists.map(list => (
                        <MenuItem key={list.id} value={list.id}>{list.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    label="Agendar para (opcional)"
                    name="scheduledAt"
                    type="datetime-local"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">
                    Contatos sem e-mail cadastrado na lista são ignorados automaticamente no envio.
                  </Typography>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} color="secondary" disabled={isSubmitting} variant="outlined">
                Cancelar
              </Button>
              <Button type="submit" color="primary" disabled={isSubmitting} variant="contained" className={classes.btnWrapper}>
                {emailCampaignId ? "Salvar" : "Adicionar"}
                {isSubmitting && <CircularProgress size={24} className={classes.buttonProgress} />}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default EmailCampaignModal;
