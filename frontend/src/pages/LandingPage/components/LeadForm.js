import React, { useState, useRef } from "react";
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
  InputAdornment,
} from "@material-ui/core";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import EmailIcon from "@material-ui/icons/Email";
import PersonIcon from "@material-ui/icons/Person";
import BusinessIcon from "@material-ui/icons/Business";
import PhoneIcon from "@material-ui/icons/Phone";
import ReCAPTCHA from "react-google-recaptcha";
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
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderRadius: "16px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(2),
    },
  },
  submitButton: {
    padding: theme.spacing(1.5, 4),
    fontSize: "1.1rem",
    fontWeight: 700,
    textTransform: "none",
    marginTop: theme.spacing(2),
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(37, 211, 102, 0.3)",
    "&:hover": {
      boxShadow: "0 6px 16px rgba(37, 211, 102, 0.4)",
    },
  },
  inputField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: "8px",
      backgroundColor: "#f9f9f9",
      "&:hover": {
        backgroundColor: "#fff",
      },
      "&.Mui-focused": {
        backgroundColor: "#fff",
      },
    },
  },
  recaptchaContainer: {
    display: "flex",
    justifyContent: "center",
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
}));

const LeadSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Nome muito curto")
    .max(100, "Nome muito longo")
    .required("Por favor, informe seu nome"),
  email: Yup.string()
    .email("Digite um email válido")
    .required("O email é obrigatório"),
  phone: Yup.string()
    .matches(/^(\d{10,11})$/, "Digite um telefone válido com DDD (apenas números)")
    .required("O WhatsApp é obrigatório"),
  company: Yup.string().max(100, "Nome da empresa muito longo"),
  message: Yup.string().max(500, "Mensagem muito longa"),
});

const LeadForm = () => {
  const classes = useStyles();
  const [submitting, setSubmitting] = useState(false);
  const recaptchaRef = useRef(null);
  const supportNumber = getNumberSupport() || "5514981252988";

  const formatPhoneForWhatsApp = (phone) => {
    return phone.replace(/\D/g, "");
  };

  const formatPhoneDisplay = (phone) => {
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

    return encodeURIComponent(message);
  };

  const handleSubmit = async (values, { resetForm }) => {
    const recaptchaValue = recaptchaRef.current.getValue();
    if (!recaptchaValue) {
      toast.error("Por favor, verifique o reCAPTCHA.");
      return;
    }

    setSubmitting(true);
    try {
      try {
        const response = await api.post("/leads", {
          name: values.name,
          email: values.email,
          phone: formatPhoneForWhatsApp(values.phone),
          company: values.company || null,
          message: values.message || null,
          recaptchaToken: recaptchaValue, // Send token to backend if needed
        });

        if (response.data) {
          toast.success(response.data.isNew ? "Cadastro realizado com sucesso!" : "Dados atualizados com sucesso!");
        }
      } catch (apiError) {
        console.error("Erro ao salvar lead:", apiError);
        if (apiError.response?.status !== 400) {
          // Silently fail API but continue to WhatsApp
        } else {
          throw apiError;
        }
      }

      const whatsappMessage = createWhatsAppMessage(values);
      const whatsappNumber = formatPhoneForWhatsApp(supportNumber);
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

      window.open(whatsappUrl, "_blank");
      resetForm();
      recaptchaRef.current.reset();
    } catch (error) {
      console.error("Erro ao processar formulário:", error);
      const errorMessage = error.response?.data?.error || "Erro ao processar. Tente novamente.";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box id="lead-form" className={classes.formContainer}>
      <Typography variant="h2" className={classes.sectionTitle}>
        Comece sua Transformação
      </Typography>
      <Typography variant="h6" className={classes.sectionSubtitle}>
        Preencha o formulário e fale com um especialista agora mesmo
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
            {({ errors, touched, isSubmitting, setFieldValue }) => (
              <Form>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="name"
                      label="Nome Completo"
                      fullWidth
                      variant="outlined"
                      className={classes.inputField}
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="email"
                      label="Email Corporativo"
                      type="email"
                      fullWidth
                      variant="outlined"
                      className={classes.inputField}
                      error={touched.email && Boolean(errors.email)}
                      helperText={touched.email && errors.email}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="phone"
                      label="WhatsApp (com DDD)"
                      fullWidth
                      variant="outlined"
                      className={classes.inputField}
                      error={touched.phone && Boolean(errors.phone)}
                      helperText={touched.phone && errors.phone}
                      placeholder="11999999999"
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setFieldValue("phone", val);
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="company"
                      label="Nome da Empresa"
                      fullWidth
                      variant="outlined"
                      className={classes.inputField}
                      error={touched.company && Boolean(errors.company)}
                      helperText={touched.company && errors.company}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <BusinessIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      name="message"
                      label="Como podemos ajudar? (Opcional)"
                      fullWidth
                      multiline
                      minRows={4}
                      variant="outlined"
                      className={classes.inputField}
                      error={touched.message && Boolean(errors.message)}
                      helperText={touched.message && errors.message}
                    />
                  </Grid>

                  <Grid item xs={12} className={classes.recaptchaContainer}>
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" // Chave de teste do Google
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
                      {submitting ? "Enviando..." : "Falar com Especialista no WhatsApp"}
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

