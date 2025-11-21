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
  Select,
  MenuItem,
  FormControl,
  LinearProgress,
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

// Lista de países com código e bandeira
const countries = [
  { code: "BR", dialCode: "+55", flag: "🇧🇷", name: "Brasil" },
  { code: "US", dialCode: "+1", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "AR", dialCode: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "CL", dialCode: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "CO", dialCode: "+57", flag: "🇨🇴", name: "Colômbia" },
  { code: "MX", dialCode: "+52", flag: "🇲🇽", name: "México" },
  { code: "PT", dialCode: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "ES", dialCode: "+34", flag: "🇪🇸", name: "Espanha" },
];

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
  phoneContainer: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "flex-start",
  },
  countrySelect: {
    minWidth: "120px",
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
  phoneInput: {
    flex: 1,
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
  progressContainer: {
    marginBottom: theme.spacing(3),
  },
  progressBar: {
    height: "6px",
    borderRadius: "3px",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(45deg, #25D366 30%, #20BA5A 90%)",
    transition: "width 0.3s ease",
    borderRadius: "3px",
  },
  progressText: {
    fontSize: "0.85rem",
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: theme.spacing(1),
    textAlign: "center",
  },
  fieldValid: {
    "& .MuiOutlinedInput-root": {
      "& fieldset": {
        borderColor: "#25D366 !important",
      },
    },
  },
  fieldInvalid: {
    "& .MuiOutlinedInput-root": {
      "& fieldset": {
        borderColor: "#f44336 !important",
      },
    },
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
    .required("O WhatsApp é obrigatório")
    .test("phone-format", "Digite um telefone válido", function(value) {
      const { countryCode } = this.parent;
      const country = countries.find(c => c.code === countryCode);
      if (!country || !value) return false;
      
      const cleaned = value.replace(/\D/g, "");
      const countryCodeDigits = country.dialCode.replace("+", "");
      
      // Remove código do país se presente
      let phoneDigits = cleaned;
      if (cleaned.startsWith(countryCodeDigits)) {
        phoneDigits = cleaned.substring(countryCodeDigits.length);
      }
      
      // Brasil: 10 ou 11 dígitos (DDD + número, sem código do país)
      if (country.code === "BR") {
        return phoneDigits.length >= 10 && phoneDigits.length <= 11;
      }
      // Outros países: pelo menos 7 dígitos
      return phoneDigits.length >= 7;
    }),
  countryCode: Yup.string().required(),
  company: Yup.string().max(100, "Nome da empresa muito longo"),
  message: Yup.string().max(500, "Mensagem muito longa"),
});

const LeadForm = () => {
  const classes = useStyles();
  const [submitting, setSubmitting] = useState(false);
  const recaptchaRef = useRef(null);
  const supportNumber = getNumberSupport() || "5514981252988";

  const formatPhoneForWhatsApp = (phone, countryCode = "BR") => {
    // Remove todos os caracteres não numéricos
    const cleaned = phone.replace(/\D/g, "");
    const country = countries.find(c => c.code === countryCode);
    if (!country) return cleaned;
    
    const countryCodeDigits = country.dialCode.replace("+", "");
    
    // Se já tem código do país, retorna como está
    if (cleaned.startsWith(countryCodeDigits)) {
      return cleaned; // Já tem código do país: 5514981252988
    }
    
    // Adiciona código do país: 55 + 14981252988 = 5514981252988
    return countryCodeDigits + cleaned;
  };

  const formatPhoneDisplay = (phone, countryCode = "BR") => {
    const cleaned = phone.replace(/\D/g, "");
    const country = countries.find(c => c.code === countryCode);
    if (!country) return phone;
    
    const countryCodeDigits = country.dialCode.replace("+", "");
    
    // Remove código do país se presente para formatação
    let phoneDigits = cleaned;
    if (cleaned.startsWith(countryCodeDigits)) {
      phoneDigits = cleaned.substring(countryCodeDigits.length);
    }
    
    // Brasil: +55 (14) 98125-2988
    if (country.code === "BR") {
      if (phoneDigits.length === 11) {
        // Celular: (14) 98125-2988
        return phoneDigits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
      } else if (phoneDigits.length === 10) {
        // Fixo: (14) 1234-5678
        return phoneDigits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
      }
    }
    
    // Outros países: retorna apenas os dígitos
    return phoneDigits;
  };

  const formatPhoneInput = (value, countryCode = "BR") => {
    const cleaned = value.replace(/\D/g, "");
    const country = countries.find(c => c.code === countryCode);
    if (!country) return value;
    
    // Remove código do país se já estiver presente
    const countryCodeDigits = country.dialCode.replace("+", "");
    let phoneDigits = cleaned;
    if (cleaned.startsWith(countryCodeDigits)) {
      phoneDigits = cleaned.substring(countryCodeDigits.length);
    }
    
    // Brasil: +55 (14) 98125-2988
    if (country.code === "BR") {
      if (phoneDigits.length === 0) {
        return "";
      } else if (phoneDigits.length <= 2) {
        return `+55 (${phoneDigits}`;
      } else if (phoneDigits.length <= 7) {
        return phoneDigits.replace(/(\d{2})(\d{0,5})/, "+55 ($1) $2");
      } else if (phoneDigits.length <= 10) {
        return phoneDigits.replace(/(\d{2})(\d{4})(\d{0,4})/, "+55 ($1) $2-$3");
      } else {
        return phoneDigits.replace(/(\d{2})(\d{5})(\d{4})/, "+55 ($1) $2-$3");
      }
    }
    
    // Outros países: apenas números
    return cleaned;
  };

  const createWhatsAppMessage = (values) => {
    const country = countries.find(c => c.code === values.countryCode) || countries[0];
    const formattedPhone = formatPhoneDisplay(values.phone, values.countryCode);
    const fullPhone = country.dialCode + " " + formattedPhone.replace(/[()-\s]/g, "");
    
    const message = `Olá! Meu nome é *${values.name}*${values.company ? `, da empresa *${values.company}*` : ""}.

Tenho interesse em conhecer o TaktChat.

Email: ${values.email}
Telefone: ${fullPhone}
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
        // Salva o número completo sem máscara (código do país + número)
        const fullPhoneNumber = formatPhoneForWhatsApp(values.phone, values.countryCode);
        
        const response = await api.post("/leads", {
          name: values.name,
          email: values.email,
          phone: fullPhoneNumber, // Número completo sem máscara: 5514981252988
          countryCode: values.countryCode,
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
              countryCode: "BR", // Brasil como padrão
              company: "",
              message: "",
            }}
            validationSchema={LeadSchema}
            onSubmit={handleSubmit}
          >
            {({ errors, touched, isSubmitting, setFieldValue, values }) => {
              // Calcular progresso do formulário
              const fields = ['name', 'email', 'phone', 'company'];
              const filledFields = fields.filter(field => {
                if (field === 'phone') {
                  const cleaned = (values.phone || '').replace(/\D/g, '');
                  const countryCodeDigits = countries.find(c => c.code === values.countryCode)?.dialCode.replace('+', '') || '55';
                  let phoneDigits = cleaned;
                  if (cleaned.startsWith(countryCodeDigits)) {
                    phoneDigits = cleaned.substring(countryCodeDigits.length);
                  }
                  return phoneDigits.length >= 10;
                }
                return values[field] && values[field].trim().length > 0;
              });
              const progress = (filledFields.length / fields.length) * 100;
              
              return (
              <Form>
                {progress > 0 && progress < 100 && (
                  <Box className={classes.progressContainer}>
                    <Box className={classes.progressBar}>
                      <Box 
                        className={classes.progressFill} 
                        style={{ width: `${progress}%` }}
                      />
                    </Box>
                    <Typography className={classes.progressText}>
                      {filledFields.length} de {fields.length} campos preenchidos
                    </Typography>
                  </Box>
                )}
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="name"
                      label="Nome Completo"
                      fullWidth
                      variant="outlined"
                      className={`${classes.inputField} ${
                        touched.name && values.name && !errors.name 
                          ? classes.fieldValid 
                          : touched.name && errors.name 
                          ? classes.fieldInvalid 
                          : ''
                      }`}
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name}
                      onBlur={(e) => {
                        setFieldValue('name', e.target.value);
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonIcon color={touched.name && values.name && !errors.name ? "primary" : "action"} />
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
                      className={`${classes.inputField} ${
                        touched.email && values.email && !errors.email 
                          ? classes.fieldValid 
                          : touched.email && errors.email 
                          ? classes.fieldInvalid 
                          : ''
                      }`}
                      error={touched.email && Boolean(errors.email)}
                      helperText={touched.email && errors.email}
                      onBlur={(e) => {
                        setFieldValue('email', e.target.value);
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon color={touched.email && values.email && !errors.email ? "primary" : "action"} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box className={classes.phoneContainer}>
                      <FormControl 
                        variant="outlined" 
                        className={classes.countrySelect}
                        error={touched.countryCode && Boolean(errors.countryCode)}
                      >
                        <Select
                          value={values.countryCode}
                          onChange={(e) => {
                            setFieldValue("countryCode", e.target.value);
                            setFieldValue("phone", ""); // Limpa o telefone ao mudar país
                          }}
                          displayEmpty
                          renderValue={(selected) => {
                            const country = countries.find(c => c.code === selected);
                            return country ? `${country.flag} ${country.dialCode}` : "";
                          }}
                        >
                          {countries.map((country) => (
                            <MenuItem key={country.code} value={country.code}>
                              {country.flag} {country.name} {country.dialCode}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        name="phone"
                        label="WhatsApp"
                        fullWidth
                        variant="outlined"
                        className={`${classes.phoneInput} ${
                          touched.phone && values.phone && !errors.phone 
                            ? classes.fieldValid 
                            : touched.phone && errors.phone 
                            ? classes.fieldInvalid 
                            : ''
                        }`}
                        error={touched.phone && Boolean(errors.phone)}
                        helperText={touched.phone && errors.phone}
                        placeholder={values.countryCode === "BR" ? "(11) 98765-43218" : "Número"}
                        value={values.phone}
                        onChange={(e) => {
                          const formatted = formatPhoneInput(e.target.value, values.countryCode);
                          setFieldValue("phone", formatted);
                        }}
                        onBlur={() => {
                          setFieldValue("phone", values.phone);
                        }}
                        aria-label="Número de WhatsApp com código do país"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PhoneIcon color={
                                touched.phone && values.phone && !errors.phone 
                                  ? "primary" 
                                  : "action"
                              } aria-hidden="true" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Box>
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
              );
            }}
          </Formik>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LeadForm;

