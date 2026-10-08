import React, { useState, useEffect } from "react";
import qs from "query-string";
import * as Yup from "yup";
import { useHistory } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import LockOutlinedIcon from "@material-ui/icons/LockOutlined";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import usePlans from "../../hooks/usePlans";
import { i18n } from "../../translate/i18n";
import { FormControl } from "@material-ui/core";
import { InputLabel, MenuItem, Select } from "@material-ui/core";
import { openApi } from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  paper: {
    marginTop: theme.spacing(6),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: theme.palette.background.paper,
    padding: theme.spacing(4),
    borderRadius: 16,
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
  },
  avatar: {
    margin: theme.spacing(1),
    backgroundColor: theme.palette.secondary.main,
    width: 56,
    height: 56,
  },
  form: {
    width: "100%",
    marginTop: theme.spacing(2),
  },
  submit: {
    margin: theme.spacing(4, 0, 2),
    fontWeight: "bold",
  },
}));

const UserSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Parâmetros incompletos!")
    .max(50, "Parâmetros acima do esperado!")
    .required("Obrigatório"),
  companyName: Yup.string()
    .min(2, "Parâmetros incompletos!")
    .max(50, "Parâmetros acima do esperado!")
    .required("Obrigatório"),
  password: Yup.string().min(5, "Parâmetros incompletos!").max(50, "Parâmetros acima do esperado!"),
  email: Yup.string().email("E-mail inválido").required("Obrigatório"),
  phone: Yup.string().required("Obrigatório"),
});

const SignUp = () => {
  const classes = useStyles();
  const history = useHistory();
  const { getPlanList } = usePlans();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userCreationEnabled, setUserCreationEnabled] = useState(true);

  // Estado da etapa de verificação de e-mail (código de 6 dígitos, estilo Fluxoo).
  const [step, setStep] = useState("form"); // "form" | "code"
  const [pendingValues, setPendingValues] = useState(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  let companyId = null;
  const params = qs.parse(window.location.search);
  if (params.companyId !== undefined) {
    companyId = params.companyId;
  }

  const initialState = {
    name: "",
    email: "",
    password: "",
    phone: "",
    companyId,
    companyName: "",
    planId: "",
  };

  const [user] = useState(initialState);

  const backendUrl =
    process.env.REACT_APP_BACKEND_URL === "https://localhost:8090"
      ? "https://localhost:8090"
      : process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    const fetchUserCreationStatus = async () => {
      try {
        const response = await fetch(`${backendUrl}/settings/userCreation`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch user creation status");
        }

        const data = await response.json();
        const isEnabled = data.userCreation === "enabled";
        setUserCreationEnabled(isEnabled);

        if (!isEnabled) {
          toast.info("Cadastro de novos usuários está desabilitado.");
          history.push("/login");
        }
      } catch (err) {
        console.error("Erro ao verificar userCreation:", err);
        setUserCreationEnabled(false);
        toast.error("Erro ao verificar permissão de cadastro.");
        history.push("/login");
      }
    };

    fetchUserCreationStatus();
  }, [backendUrl, history]);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const planList = await getPlanList({ listPublic: "false" });
      setPlans(planList);
      setLoading(false);
    };
    fetchData();
  }, [getPlanList]);

  // Countdown do botão "Reenviar código" (cooldown de 60s imposto no backend).
  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Erros do fluxo de verificação usam códigos ERR_* do backend mapeados
  // em signup.verification.errors.*; demais erros caem no toastError padrão.
  const showVerificationError = (err) => {
    const errCode = err.response?.data?.error;
    if (errCode && i18n.exists(`signup.verification.errors.${errCode}`)) {
      toast.error(i18n.t(`signup.verification.errors.${errCode}`));
    } else {
      toastError(err);
    }
  };

  const finishSignUp = async (values, verificationToken) => {
    // O token de verificação é exigido pelo backend quando SMTP está ativo.
    const payload = verificationToken
      ? { ...values, emailVerificationToken: verificationToken }
      : values;
    await openApi.post("/auth/signup", payload);
    toast.success(i18n.t("signup.toasts.success"));
    history.push("/login");
  };

  const handleSignUp = async (values) => {
    setSendingCode(true);
    try {
      // Etapa 1: solicita o código de verificação antes de concluir o registro.
      const { data } = await openApi.post("/auth/verify-email/send", {
        email: values.email,
      });
      if (data && data.required === false) {
        // Fail-open: SMTP não configurado no backend — cadastro direto.
        await finishSignUp(values);
        return;
      }
      setPendingValues(values);
      setCode("");
      setCodeError("");
      setResendCooldown(data?.cooldownSeconds || 60);
      setStep("code");
      toast.success(i18n.t("signup.verification.codeSent"));
    } catch (err) {
      showVerificationError(err);
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6 || verifying || !pendingValues) return;
    setVerifying(true);
    setCodeError("");
    try {
      // Etapa 2: confere o código e recebe o token de uso único para o signup.
      const { data } = await openApi.post("/auth/verify-email/check", {
        email: pendingValues.email,
        code,
      });
      await finishSignUp(pendingValues, data.verificationToken);
    } catch (err) {
      const errCode = err.response?.data?.error;
      if (errCode && i18n.exists(`signup.verification.errors.${errCode}`)) {
        setCodeError(i18n.t(`signup.verification.errors.${errCode}`));
      } else {
        toastError(err);
      }
      // Expirado ou máx. de tentativas: limpa o campo e força novo envio.
      if (
        errCode === "ERR_VERIFICATION_CODE_EXPIRED" ||
        errCode === "ERR_VERIFICATION_MAX_ATTEMPTS"
      ) {
        setCode("");
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !pendingValues) return;
    try {
      const { data } = await openApi.post("/auth/verify-email/send", {
        email: pendingValues.email,
      });
      setResendCooldown(data?.cooldownSeconds || 60);
      setCode("");
      setCodeError("");
      toast.success(i18n.t("signup.verification.codeResent"));
    } catch (err) {
      showVerificationError(err);
    }
  };

  if (!userCreationEnabled) {
    return null;
  }

  return (
    <Container component="main" maxWidth="xs">
      <CssBaseline />
      <div className={classes.paper}>
        <Avatar className={classes.avatar}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5" style={{ marginBottom: 8 }}>
          {step === "code"
            ? i18n.t("signup.verification.title")
            : i18n.t("signup.title")}
        </Typography>
        {step === "code" ? (
          <Box width="100%" mt={2}>
            {/* Etapa de verificação: código de 6 dígitos enviado por e-mail.
                O código nunca é logado nem persistido em claro no backend. */}
            <Typography variant="body2" align="center">
              {i18n.t("signup.verification.subtitle")}
            </Typography>
            <Typography
              variant="body2"
              align="center"
              style={{ fontWeight: "bold", marginBottom: 8 }}
            >
              {pendingValues?.email}
            </Typography>
            <TextField
              variant="outlined"
              fullWidth
              id="verification-code"
              label={i18n.t("signup.verification.codeLabel")}
              placeholder={i18n.t("signup.verification.codePlaceholder")}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleVerifyCode();
                }
              }}
              error={Boolean(codeError)}
              helperText={codeError}
              autoFocus
              inputProps={{
                inputMode: "numeric",
                maxLength: 6,
                style: {
                  textAlign: "center",
                  letterSpacing: 10,
                  fontSize: 24,
                  fontWeight: "bold",
                },
              }}
            />
            <Button
              fullWidth
              variant="contained"
              color="primary"
              className={classes.submit}
              disabled={code.length !== 6 || verifying}
              onClick={handleVerifyCode}
            >
              {i18n.t("signup.verification.verify")}
            </Button>
            <Grid container justifyContent="center" spacing={2}>
              <Grid item>
                <Link
                  href="#"
                  variant="body2"
                  component="button"
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0}
                >
                  {resendCooldown > 0
                    ? i18n.t("signup.verification.resendIn", {
                        seconds: resendCooldown,
                      })
                    : i18n.t("signup.verification.resend")}
                </Link>
              </Grid>
              <Grid item>
                <Link
                  href="#"
                  variant="body2"
                  component="button"
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setCode("");
                    setCodeError("");
                  }}
                >
                  {i18n.t("signup.verification.back")}
                </Link>
              </Grid>
            </Grid>
          </Box>
        ) : (
        <Formik
          initialValues={user}
          enableReinitialize={true}
          validationSchema={UserSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSignUp(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting }) => (
            <Form className={classes.form}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    variant="outlined"
                    fullWidth
                    id="companyName"
                    label={i18n.t("signup.form.company")}
                    error={touched.companyName && Boolean(errors.companyName)}
                    helperText={touched.companyName && errors.companyName}
                    name="companyName"
                    autoComplete="companyName"
                    autoFocus
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    autoComplete="name"
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    fullWidth
                    id="name"
                    label={i18n.t("signup.form.name")}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    variant="outlined"
                    fullWidth
                    id="email"
                    label={i18n.t("signup.form.email")}
                    name="email"
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                    autoComplete="email"
                    inputProps={{ style: { textTransform: "lowercase" } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    variant="outlined"
                    fullWidth
                    name="password"
                    error={touched.password && Boolean(errors.password)}
                    helperText={touched.password && errors.password}
                    label={i18n.t("signup.form.password")}
                    type="password"
                    id="password"
                    autoComplete="current-password"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    variant="outlined"
                    fullWidth
                    id="phone"
                    label={i18n.t("signup.form.phone")}
                    name="phone"
                    autoComplete="phone"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel id="plan-selection-label">Plano</InputLabel>
                    <Field
                      as={Select}
                      labelId="plan-selection-label"
                      id="plan-selection"
                      name="planId"
                      label="Plano"
                      required
                    >
                      {plans.map((plan, key) => (
                        <MenuItem key={key} value={plan.id}>
                          {plan.name} - Atendentes: {plan.users} - WhatsApp: {plan.connections} - Filas: {plan.queues} - R$ {plan.amount}
                        </MenuItem>
                      ))}
                    </Field>
                  </FormControl>
                </Grid>
              </Grid>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                className={classes.submit}
                disabled={sendingCode}
              >
                {i18n.t("signup.buttons.submit")}
              </Button>
              <Grid container justifyContent="center">
                <Grid item>
                  <Link
                    href="#"
                    variant="body2"
                    component={RouterLink}
                    to="/login"
                  >
                    {i18n.t("signup.buttons.login")}
                  </Link>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
        )}
      </div>
      <Box mt={5}></Box>
    </Container>
  );
};

export default SignUp;
