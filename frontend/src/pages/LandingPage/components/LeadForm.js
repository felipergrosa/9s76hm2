import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  CircularProgress,
} from "@material-ui/core";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import api from "../../../services/api";
import { toast } from "react-toastify";
import { getNumberSupport } from "../../../config";

const useStyles = makeStyles((theme) => ({
  formContainer: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  sectionTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(1),
    textAlign: "center",
    color: "#ffffff",
  },
  sectionSubtitle: {
    textAlign: "center",
    marginBottom: theme.spacing(4),
    color: "rgba(255, 255, 255, 0.9)",
  },
  formCard: {
    padding: theme.spacing(4),
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: "12px",
    boxShadow: theme.shadows[10],
  },
  submitButton: {
    padding: theme.spacing(1.5, 4),
    fontSize: "1.1rem",
    fontWeight: 600,
    textTransform: "none",
    marginTop: theme.spacing(2),
  },
}));

const LeadSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Nome muito curto")
    .max(100, "Nome muito longo")
    .required("Nome é obrigatório"),
  email: Yup.string()
    .email("Email inválido")
    .required("Email é obrigatório"),
  phone: Yup.string()
    .min(10, "Telefone inválido")
    .required("Telefone é obrigatório"),
  company: Yup.string().max(100, "Nome da empresa muito longo"),
  message: Yup.string().max(500, "Mensagem muito longa"),
});

const LeadForm = () => {
  const classes = useStyles();
  const [submitting, setSubmitting] = useState(false);
  const supportNumber = getNumberSupport() || "5514981252988";

  const formatPhoneForWhatsApp = (phone) => {
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, "");
    return cleaned;
  };

  const formatPhoneDisplay = (phone) => {
    // Formata para exibição (opcional)
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return phone;
  };

  const createWhatsAppMessage = (values) => {
    const message = `Olá! Meu nome é *${values.name}*${values.company ? `, da empresa *${values.company}*` : ""}.

Tenho interesse em conhecer o TaktChat.

Email: ${values.email}
Telefone: ${formatPhoneDisplay(values.phone)}
${values.message ? `\nMensagem: ${values.message}` : ""}`;

    // Usar encodeURIComponent para garantir codificação correta
    return encodeURIComponent(message);
  };

  const handleSubmit = async (values, { resetForm }) => {
    setSubmitting(true);
    try {
      // Salvar o lead no backend
      try {
        const response = await api.post("/leads", {
          name: values.name,
          email: values.email,
          phone: formatPhoneForWhatsApp(values.phone),
          company: values.company || null,
          message: values.message || null,
        });
        
        if (response.data) {
          toast.success(response.data.isNew ? "Lead cadastrado com sucesso!" : "Lead atualizado com sucesso!");
        }
      } catch (apiError) {
        console.error("Erro ao salvar lead:", apiError);
        // Continuar mesmo se houver erro ao salvar, mas mostrar aviso
        if (apiError.response?.status !== 400) {
          toast.warning("Lead não pôde ser salvo, mas você ainda pode entrar em contato via WhatsApp");
        } else {
          throw apiError;
        }
      }

      // Criar mensagem para WhatsApp
      const whatsappMessage = createWhatsAppMessage(values);
      const whatsappNumber = formatPhoneForWhatsApp(supportNumber);
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

      // Redirecionar para WhatsApp
      window.open(whatsappUrl, "_blank");

      toast.success("Redirecionando para WhatsApp...");
      resetForm();
    } catch (error) {
      console.error("Erro ao processar formulário:", error);
      const errorMessage = error.response?.data?.error || error.message || "Erro ao processar formulário. Tente novamente.";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box id="lead-form" className={classes.formContainer}>
      <Typography variant="h2" className={classes.sectionTitle}>
        Comece Agora
      </Typography>
      <Typography variant="h6" className={classes.sectionSubtitle}>
        Preencha o formulário e fale com um especialista no WhatsApp
      </Typography>
      <Card className={classes.formCard}>
        <CardContent>
          <Formik
            initialValues={{
              name: "",
              email: "",
              phone: "",
              company: "",
              message: "",
            }}
            validationSchema={LeadSchema}
            onSubmit={handleSubmit}
          >
            {({ errors, touched, isSubmitting }) => (
              <Form>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="name"
                      label="Nome Completo *"
                      fullWidth
                      variant="outlined"
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="email"
                      label="Email *"
                      type="email"
                      fullWidth
                      variant="outlined"
                      error={touched.email && Boolean(errors.email)}
                      helperText={touched.email && errors.email}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="phone"
                      label="WhatsApp *"
                      fullWidth
                      variant="outlined"
                      error={touched.phone && Boolean(errors.phone)}
                      helperText={touched.phone && errors.phone}
                      placeholder="(11) 99999-9999"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="company"
                      label="Empresa"
                      fullWidth
                      variant="outlined"
                      error={touched.company && Boolean(errors.company)}
                      helperText={touched.company && errors.company}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      name="message"
                      label="Mensagem (opcional)"
                      fullWidth
                      multiline
                      minRows={4}
                      variant="outlined"
                      error={touched.message && Boolean(errors.message)}
                      helperText={touched.message && errors.message}
                      placeholder="Conte-nos sobre sua necessidade ou interesse..."
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      fullWidth
                      size="large"
                      className={classes.submitButton}
                      startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <WhatsAppIcon />}
                      disabled={submitting || isSubmitting}
                    >
                      {submitting ? "Processando..." : "Falar com Especialista no WhatsApp"}
                    </Button>
                  </Grid>
                </Grid>
              </Form>
            )}
          </Formik>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LeadForm;

