import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import { Paper, Grid, TextField, Typography, Button, CircularProgress, AppBar, Tabs, Tab, Box } from "@material-ui/core";
import { Alert, AlertTitle } from "@material-ui/lab";
import { Field, Form, Formik } from "formik";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import axios from "axios";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";

import WarningIcon from '@material-ui/icons/Warning';
import SendIcon from '@material-ui/icons/Send';

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(3),
    backgroundColor: '#f5f5f5',
    borderRadius: theme.shape.borderRadius * 2,
  },
  title: {
    marginBottom: theme.spacing(3),
    fontWeight: 'bold',
  },
  alert: {
    marginBottom: theme.spacing(3),
    borderRadius: theme.shape.borderRadius,
  },
  tabPanel: {
    padding: theme.spacing(3),
    backgroundColor: '#fff',
    borderRadius: theme.shape.borderRadius,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  codeBlock: {
    backgroundColor: '#2d2d2d',
    color: '#f8f8f2',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    fontFamily: '"Fira Code", "Courier New", Courier, monospace',
    whiteSpace: 'pre-wrap',
    fontSize: '14px',
    overflowX: 'auto',
  },
  submitButton: {
    padding: theme.spacing(1, 4),
    fontWeight: 'bold',
  },
  formField: {
    '& .MuiOutlinedInput-root': {
      borderRadius: theme.shape.borderRadius * 2,
    },
    '& .MuiInputLabel-outlined': {
      transform: 'translate(14px, 14px) scale(1)',
    },
    '& .MuiInputLabel-outlined.MuiInputLabel-shrink': {
      transform: 'translate(14px, -6px) scale(0.75)',
    },
  },
}));

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`api-tabpanel-${index}`}
      aria-labelledby={`api-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box className={props.classes.tabPanel}>
          {children}
        </Box>
      )}
    </div>
  );
}

const MessagesAPI = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { getPlanCompany } = usePlans();

  const [tab, setTab] = useState(0);
  const [file, setFile] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useExternalApi) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        history.push('/');
      }
    }
    fetchData();
  }, [user, getPlanCompany, history]);

  const getEndpoint = (path) => process.env.REACT_APP_BACKEND_URL + path;

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleSendTextMessage = async (values, actions) => {
    const { token, number, body, userId, queueId } = values;
    try {
      await axios.post(getEndpoint('/api/messages/send'), { number, body, userId, queueId }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Mensagem de texto enviada com sucesso!');
      actions.resetForm();
    } catch (err) {
      toastError(err);
    }
  };

  const handleSendMediaMessage = async (values, actions) => {
    const { token, number, body, userId, queueId } = values;
    const formData = new FormData();
    formData.append('number', number);
    formData.append('body', body || file.name);
    formData.append('medias', file);
    if (userId) formData.append('userId', userId);
    if (queueId) formData.append('queueId', queueId);

    try {
      await axios.post(getEndpoint('/api/messages/send'), formData, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Mensagem de mídia enviada com sucesso!');
      actions.resetForm();
      setFile(null);
    } catch (err) {
      toastError(err);
    }
  };

  const handleSyncContact = async (values, actions) => {
    const { token, tagIds, ...contactData } = values;

    // Sempre envia o companyId da empresa logada, exigido pelo backend em /api/contacts/sync
    const payload = {
      ...contactData,
      companyId: user?.companyId
    };

    // Converte tagIds (string com vírgulas) para array numérico, se informado
    if (typeof tagIds === "string" && tagIds.trim() !== "") {
      const arr = tagIds
        .split(",")
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n));
      if (arr.length > 0) {
        payload.tagIds = arr;
      }
    }

    // Evita enviar situation como string vazia, o que quebraria na validação Yup do backend
    if (
      Object.prototype.hasOwnProperty.call(payload, "situation") &&
      typeof payload.situation === "string"
    ) {
      const s = payload.situation.trim();
      if (!s) {
        delete payload.situation;
      } else {
        payload.situation = s;
      }
    }

    try {
      await axios.post(getEndpoint("/api/contacts/sync"), payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Contato sincronizado com sucesso!");
      actions.resetForm();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Paper className={classes.mainPaper} variant="elevation" elevation={0}>
      <Typography variant="h4" className={classes.title}>
        Envio de Mensagens
      </Typography>

      <Alert severity="warning" icon={<WarningIcon />} className={classes.alert}>
        <AlertTitle>Instruções</AlertTitle>
        Antes de enviar mensagens, é necessário o cadastro do token vinculado à conexão que enviará as mensagens. <br />Para realizar o cadastro acesse o menu 'Conexões', clique no botão editar da conexão e insira o token no devido campo.
        <br />O número para envio não deve ter mascara ou caracteres especiais e deve ser composto por: Código do País+DDD+Número 5511999999999
      </Alert>

      <AppBar position="static" color="default" elevation={0}>
        <Tabs value={tab} onChange={handleTabChange} indicatorColor="primary" textColor="primary" variant="fullWidth">
          <Tab label="Mensagens de Texto" />
          <Tab label="Mensagens de Mídia" />
          <Tab label="Sincronização de Contatos" />
        </Tabs>
      </AppBar>

      <TabPanel value={tab} index={0} classes={classes}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6">Exemplo de Requisição</Typography>
            <pre className={classes.codeBlock}>
              <code>
                {`POST ${getEndpoint('/api/messages/send')}
Host: ${window.location.host}
Authorization: Bearer <seu_token>
Content-Type: application/json

{
  "number": "5511999999999",
  "body": "Sua mensagem de texto aqui",
  "userId": "ID do usuário (opcional)",
  "queueId": "ID da fila (opcional)"
}`}
              </code>
            </pre>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h6">Teste de Envio</Typography>
            <Formik initialValues={{ token: '', number: '', body: '', userId: '', queueId: '' }} onSubmit={handleSendTextMessage}>
              {({ isSubmitting }) => (
                <Form className={classes.formContainer}>
                  <Field as={TextField} name="token" label="Token Cadastrado" variant="outlined" required className={classes.formField} />
                  <Field as={TextField} name="number" label="Número" variant="outlined" required className={classes.formField} />
                  <Field as={TextField} name="body" label="Mensagem" variant="outlined" required multiline rows={4} className={classes.formField} />
                  <Field as={TextField} name="userId" label="ID do Usuário (Opcional)" variant="outlined" className={classes.formField} />
                  <Field as={TextField} name="queueId" label="ID da Fila (Opcional)" variant="outlined" className={classes.formField} />
                  <Button type="submit" color="primary" variant="contained" size="large" disabled={isSubmitting} className={classes.submitButton} endIcon={<SendIcon />}>
                    {isSubmitting ? <CircularProgress size={24} /> : 'Enviar'}
                  </Button>
                </Form>
              )}
            </Formik>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} index={1} classes={classes}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6">Exemplo de Requisição</Typography>
            <pre className={classes.codeBlock}>
              <code>
                {`POST ${getEndpoint('/api/messages/send')}
Host: ${window.location.host}
Authorization: Bearer <seu_token>
Content-Type: multipart/form-data

// FormData com os campos:
// number: 5511999999999
// body: Descrição da mídia (opcional)
// medias: [Arquivo]`}
              </code>
            </pre>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h6">Teste de Envio</Typography>
            <Formik initialValues={{ token: '', number: '', body: '', userId: '', queueId: '' }} onSubmit={handleSendMediaMessage}>
              {({ isSubmitting }) => (
                <Form className={classes.formContainer}>
                  <Field as={TextField} name="token" label="Token Cadastrado" variant="outlined" required className={classes.formField} />
                  <Field as={TextField} name="number" label="Número" variant="outlined" required className={classes.formField} />
                  <Field as={TextField} name="body" label="Descrição (Opcional)" variant="outlined" className={classes.formField} />
                  <Button variant="contained" component="label">
                    Escolher Arquivo
                    <input type="file" hidden required onChange={(e) => setFile(e.target.files[0])} />
                  </Button>
                  {file && <Typography variant="body2">{file.name}</Typography>}
                  <Button type="submit" color="primary" variant="contained" size="large" disabled={isSubmitting || !file} className={classes.submitButton} endIcon={<SendIcon />}>
                    {isSubmitting ? <CircularProgress size={24} /> : 'Enviar'}
                  </Button>
                </Form>
              )}
            </Formik>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} index={2} classes={classes}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6">Exemplo de Requisição</Typography>
            <pre className={classes.codeBlock}>
              <code>
                {`POST ${getEndpoint('/api/contacts/sync')}
Host: ${window.location.host}
Authorization: Bearer <seu_token>
Content-Type: application/json

{
  "name": "Nome do Contato",
  "number": "5511999999999",
  "email": "email@exemplo.com",
  "contactName": "Nome do Responsável",
  "cpfCnpj": "123.456.789-00",
  "representativeCode": "COD-007",
  "city": "Cidade Exemplo",
  "region": "Sudeste",
  "instagram": "@username",
  "situation": "Ativo",
  "fantasyName": "Nome Fantasia Exemplo",
  "foundationDate": "2023-01-01",
  "creditLimit": "5000.00",
  "segment": "Varejo",
  "florder": true,
  "dtUltCompra": "2025-09-09",
  "disableBot": false,
  // Informe UMA das opções abaixo para tags:
  "tagIds": [1, 2, 3],
  // ou
  "tags": "VIP, Cliente Antigo"
}`}
              </code>
            </pre>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h6">Teste de Sincronização</Typography>
            <Formik 
              initialValues={{ 
                token: '', name: '', number: '', email: '', contactName: '', cpfCnpj: '', 
                representativeCode: '', city: '', region: '', instagram: '', situation: '', 
                fantasyName: '', foundationDate: '', creditLimit: '', segment: '', florder: false, dtUltCompra: '', disableBot: false, tagIds: '', tags: '' 
              }} 
              onSubmit={handleSyncContact}
            >
              {({ isSubmitting }) => (
                <Form className={classes.formContainer}>
                  <Field as={TextField} name="token" label="Token Cadastrado" variant="outlined" required className={classes.formField} />
                  <Field as={TextField} name="name" label="Nome" variant="outlined" required className={classes.formField} />
                  <Field as={TextField} name="number" label="Número" variant="outlined" required className={classes.formField} />
                  <Field as={TextField} name="email" label="Email" variant="outlined" className={classes.formField} />
                  <Field as={TextField} name="contactName" label="Nome do Contato (Responsável)" variant="outlined" className={classes.formField} />
                  <Field as={TextField} name="cpfCnpj" label="CPF/CNPJ" variant="outlined" className={classes.formField} />
                  <Field as={TextField} name="representativeCode" label="Código do Representante" variant="outlined" className={classes.formField} />
                  <Field as={TextField} name="city" label="Cidade" variant="outlined" className={classes.formField} />
                  <Field as={TextField} name="region" label="Região" variant="outlined" className={classes.formField} />
                  <Field as={TextField} name="instagram" label="Instagram" variant="outlined" className={classes.formField} />
                  <Field as={TextField} name="situation" label="Situação" variant="outlined" className={classes.formField} />
                  <Field as={TextField} name="fantasyName" label="Nome Fantasia" variant="outlined" className={classes.formField} />
                  <Field as={TextField} name="foundationDate" label="Data de Fundação" variant="outlined" className={classes.formField} type="date" InputLabelProps={{ shrink: true }} />
                  <Field as={TextField} name="creditLimit" label="Limite de Crédito" variant="outlined" className={classes.formField} />
                  <Field as={TextField} name="segment" label="Segmento" variant="outlined" className={classes.formField} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Encomenda (florder)"
                        variant="outlined"
                        className={classes.formField}
                        value={"Use true/false no JSON"}
                        InputProps={{ readOnly: true }}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Field as={TextField} name="dtUltCompra" label="Última Compra" variant="outlined" className={classes.formField} type="date" InputLabelProps={{ shrink: true }} />
                    </Grid>
                  </Grid>
                  <TextField
                    label="Desabilitar chatbot (disableBot)"
                    variant="outlined"
                    className={classes.formField}
                    value={"Use true/false no JSON"}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                  <Field as={TextField} name="tagIds" label="IDs das Tags (opcional, separados por vírgula)" variant="outlined" className={classes.formField} helperText="Se informar tagIds, o sistema vai ignorar o campo Tags por nome." />
                  <Field as={TextField} name="tags" label="Tags por Nome (opcional, separadas por vírgula)" variant="outlined" className={classes.formField} />
                  <Button type="submit" color="primary" variant="contained" size="large" disabled={isSubmitting} className={classes.submitButton} endIcon={<SendIcon />}>
                    {isSubmitting ? <CircularProgress size={24} /> : 'Sincronizar'}
                  </Button>
                </Form>
              )}
            </Formik>
          </Grid>
        </Grid>
      </TabPanel>
    </Paper>
  );
};

export default MessagesAPI;
