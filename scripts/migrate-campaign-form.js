const fs = require('fs');
const formPath = 'frontend/src/pages/CampaignsNew/CampaignForm.js';

let content = fs.readFileSync(formPath, 'utf8');

// 1. Correct Imports
content = content.replace(
  'import CircularProgress from "@material-ui/core/CircularProgress";',
  'import CircularProgress from "@material-ui/core/CircularProgress";\nimport { useHistory } from "react-router-dom";\nimport MainContainer from "../../components/MainContainer";\nimport MainHeader from "../../components/MainHeader";\nimport Title from "../../components/Title";\nimport { ArrowLeft as ArrowLeftIcon, Layout, Settings, Calendar, MessageSquare, CheckCircle, Rocket, ShieldAlert } from "lucide-react";\nimport Stepper from "@material-ui/core/Stepper";\nimport Step from "@material-ui/core/Step";\nimport StepLabel from "@material-ui/core/StepLabel";\nimport StepConnector from "@material-ui/core/StepConnector";\nimport { withStyles } from "@material-ui/core/styles";'
);

// 2. Fix Relative Imports
const relativeImports = [
  { old: 'from "../ConfirmationModal"', new: 'from "../../components/ConfirmationModal"' },
  { old: 'from "../UserModal/statusIcon"', new: 'from "../../components/UserModal/statusIcon"' },
  { old: 'from "../ChatAssistantPanel"', new: 'from "../../components/ChatAssistantPanel"' },
  { old: 'from "./WhatsAppPreview"', new: 'from "../../components/CampaignModal/WhatsAppPreview"' },
  { old: 'from "../TemplateVariableMapper"', new: 'from "../../components/TemplateVariableMapper"' },
  { old: 'from "./CampaignHowItWorks"', new: 'from "../../components/CampaignModal/CampaignHowItWorks"' },
  { old: 'from "../WhatsAppPopover"', new: 'from "../../components/WhatsAppPopover"' },
  { old: 'from "../FormattedTextField"', new: 'from "../../components/FormattedTextField"' }
];

relativeImports.forEach(imp => {
  content = content.replace(new RegExp(imp.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), imp.new);
});

// 3. Update Styles
const newStyles = `
  stepRoot: {
    width: '100%',
    padding: theme.spacing(3, 0),
    backgroundColor: 'transparent',
  },
  stepLabel: {
    '& .MuiStepLabel-label': {
      fontSize: '0.9rem',
      fontWeight: 500,
      color: '#666',
    },
    '& .MuiStepLabel-active': {
      color: '#005c53 !important',
      fontWeight: '700 !important',
    },
    '& .MuiStepLabel-completed': {
      color: '#005c53 !important',
    },
  },
  formContainerRect: {
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(4),
    padding: theme.spacing(2, 4, 4),
    minHeight: '60vh',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
  formContentPart: {
    flex: 7,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: theme.spacing(4),
    boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
    border: '1px solid #f0f0f0',
  },
  sidebarPart: {
    flex: 5,
    backgroundColor: '#f9fbfb',
    borderRadius: 20,
    padding: theme.spacing(4),
    border: '1px solid #eef2f2',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
  },
  footerFixed: {
    padding: theme.spacing(3, 6),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTop: '1px solid #eee',
    borderRadius: '0 0 20px 20px',
    position: 'sticky',
    bottom: 0,
    zIndex: 10,
  },
  primaryBtn: {
    backgroundColor: '#005c53',
    color: '#fff',
    '&:hover': {
      backgroundColor: '#004a43',
    },
    textTransform: 'none',
    fontWeight: 600,
    padding: '12px 32px',
    borderRadius: 12,
    fontSize: '1rem',
  },
  secondaryBtn: {
    color: '#666',
    borderColor: '#ddd',
    textTransform: 'none',
    fontWeight: 600,
    padding: '12px 24px',
    borderRadius: 12,
  },
  stepIcon: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    color: '#999',
    marginBottom: 8,
    transition: 'all 0.3s ease',
  },
  stepIconActive: {
    backgroundColor: '#005c53',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(0, 92, 83, 0.3)',
  },
  stepIconCompleted: {
    backgroundColor: '#e6f4f3',
    color: '#005c53',
  },
  stepTitle: {
    fontSize: '1.8rem',
    fontWeight: 700,
    color: '#1a1a1a',
    marginBottom: theme.spacing(1),
  },
  stepSubTitle: {
    color: '#666',
    marginBottom: theme.spacing(4),
  },
  inputCard: {
    background: '#fcfcfc',
    borderRadius: 12,
    padding: theme.spacing(2),
    border: '1px solid #f0f0f0',
    marginBottom: theme.spacing(2),
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': { border: '1px solid #005c53' }
  },
`;

content = content.replace(
  'const useStyles = makeStyles((theme) => ({',
  'const useStyles = makeStyles((theme) => ({\n' + newStyles
);

content = content.replace(
  'const CampaignSchema = Yup.object().shape({',
  `const ColorlibConnector = withStyles({
  alternativeLabel: { top: 22 },
  active: { '& $line': { backgroundColor: '#005c53' } },
  completed: { '& $line': { backgroundColor: '#005c53' } },
  line: { height: 3, border: 0, backgroundColor: '#eaeaf0', borderRadius: 1 },
})(StepConnector);

const CampaignSchema = Yup.object().shape({`
);

// 4. Update Component Signature and State
content = content.replace(
  /const CampaignModal = \(\{[\s\S]*?\}\) => \{/,
  `const CampaignForm = ({
  campaignId,
  initialValues,
  onSave,
  resetPagination,
  defaultWhatsappId
}) => {
  const history = useHistory();
  const classes = useStyles();
  const isMounted = useRef(true);
  const { user, socket } = useContext(AuthContext);
  const { companyId } = user;

  const [activeStep, setActiveStep] = useState(0);
  const steps = [
    { label: 'Configuração', icon: <Settings size={20} /> },
    { label: 'Regras', icon: <Layout size={20} /> },
    { label: 'Agendamento', icon: <Calendar size={20} /> },
    { label: 'Mensagem', icon: <MessageSquare size={20} /> }
  ];`
);

content = content.replace('  const classes = useStyles();\n  const isMounted = useRef(true);\n  const { user, socket } = useContext(AuthContext);\n  const { companyId } = user;', '');

content = content.replace(
  /const handleClose = \(\) => \{[\s\S]*?onClose\(\);[\s\S]*?setCampaign\(initialState\);[\s\S]*?\};/,
  `const handleClose = () => { history.push("/campaigns"); };`
);

const stepHelpers = `
  const handleNext = async (validateForm) => {
    const errors = await validateForm();
    if (Object.keys(errors).length === 0) {
      if (activeStep < steps.length - 1) {
        setActiveStep((prev) => prev + 1);
      }
    } else {
      toast.error("Por favor, preencha os campos obrigatórios.");
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };
`;

content = content.replace(
  '  const { findAllForSelection } = useQueues();',
  '  const { findAllForSelection } = useQueues();\n' + stepHelpers
);

// RENDER LOGIC
const stepUI = `
                <Form style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '80vh' }}>
                  <Box className={classes.stepRoot}>
                    <Stepper activeStep={activeStep} alternativeLabel connector={<ColorlibConnector />}>
                      {steps.map((step, index) => (
                        <Step key={step.label}>
                          <StepLabel
                            StepIconComponent={() => {
                              const isActive = activeStep === index;
                              const isCompleted = activeStep > index;
                              return (
                                <div className={classes.stepIcon + (isActive ? ' ' + classes.stepIconActive : '') + (isCompleted ? ' ' + classes.stepIconCompleted : '')}>
                                  {isCompleted ? <CheckCircle size={20} /> : step.icon}
                                </div>
                              );
                            }}
                            className={classes.stepLabel}
                          >
                            {step.label}
                          </StepLabel>
                        </Step>
                      ))}
                    </Stepper>
                  </Box>

                  <Box className={classes.formContainerRect}>
                    <Box className={classes.formContentPart}>
                      {activeStep === 0 && (
                        <Box>
                          <Typography className={classes.stepTitle}>Detalhes da Campanha</Typography>
                          <Typography className={classes.stepSubTitle}>Defina os parâmetros básicos para sua campanha de automação.</Typography>
                          
                          <Grid container spacing={3}>
                            <Grid item xs={12}>
                              <Field
                                as={TextField}
                                label="Nome da Campanha"
                                name="name"
                                placeholder="Ex: Promoção Q4"
                                error={touched.name && Boolean(errors.name)}
                                helperText={touched.name && errors.name}
                                variant="outlined"
                                fullWidth
                                disabled={!campaignEditable}
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <FormControl variant="outlined" fullWidth>
                                <InputLabel>Lista de Contatos</InputLabel>
                                <Field as={Select} name="contactListId" label="Lista de Contatos" disabled={!campaignEditable}>
                                  <MenuItem value="">Nenhuma</MenuItem>
                                  {contactLists && contactLists.map(cl => <MenuItem key={cl.id} value={cl.id}>{cl.name}</MenuItem>)}
                                </Field>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <FormControl variant="outlined" fullWidth margin="dense">
                                <InputLabel>Conexão (WhatsApp)</InputLabel>
                                <Select 
                                  name="whatsappIds" 
                                  label="Conexão (WhatsApp)" 
                                  value={whatsappId} 
                                  onChange={(e) => setWhatsappId(e.target.value)}
                                  disabled={!campaignEditable}
                                >
                                  {whatsapps && whatsapps.map(w => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                               <FormControl variant="outlined" fullWidth>
                                <InputLabel>Tags (Filtrar Contatos)</InputLabel>
                                <Field as={Select} name="tagListId" label="Tags (Filtrar Contatos)" disabled={!campaignEditable}>
                                  <MenuItem value="Nenhuma">Nenhuma</MenuItem>
                                  {tagLists && tagLists.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                                </Field>
                              </FormControl>
                            </Grid>
                          </Grid>
                        </Box>
                      )}

                      {activeStep === 1 && (
                        <Box>
                          <Typography className={classes.stepTitle}>Regras de Atendimento</Typography>
                          <Typography className={classes.stepSubTitle}>Defina como as respostas dos clientes serão gerenciadas.</Typography>
                          
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                              <FormControl variant="outlined" fullWidth>
                                <InputLabel>Fila de Destino</InputLabel>
                                <Select
                                  value={selectedQueue}
                                  onChange={(e) => setSelectedQueue(e.target.value)}
                                  label="Fila de Destino"
                                  disabled={!campaignEditable}
                                >
                                  <MenuItem value="">Nenhuma</MenuItem>
                                  {queues && queues.map(q => <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>)}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <FormControl variant="outlined" fullWidth>
                                <InputLabel>Status do Ticket</InputLabel>
                                <Field as={Select} name="statusTicket" label="Status do Ticket" disabled={!campaignEditable}>
                                  <MenuItem value="closed">Fechado (Finalizar)</MenuItem>
                                  <MenuItem value="open">Aberto (Aguardando Atendimento)</MenuItem>
                                </Field>
                              </FormControl>
                            </Grid>
                             <Grid item xs={12}>
                              <Autocomplete
                                multiple
                                options={options || []}
                                getOptionLabel={(u) => u.name}
                                value={selectedUsers}
                                onChange={(_, val) => setSelectedUsers(val)}
                                onOpen={ensureUsersLoaded}
                                renderInput={(params) => (
                                  <TextField {...params} variant="outlined" label="Usuários (Distribuição)" placeholder="Adicionar atendente..." />
                                )}
                                renderTags={(value, getTagProps) =>
                                  value.map((option, index) => (
                                    <Chip label={option.name} {...getTagProps({ index })} size="small" color="primary" variant="outlined" />
                                  ))
                                }
                                disabled={!campaignEditable}
                              />
                            </Grid>
                          </Grid>
                        </Box>
                      )}

                      {activeStep === 2 && (
                        <Box>
                          <Typography className={classes.stepTitle}>Estratégia de Envio</Typography>
                          <Typography className={classes.stepSubTitle}>Defina o momento ideal para o disparo das suas mensagens.</Typography>
                          
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                               <Paper 
                                 className={classes.inputCard} 
                                 style={{ border: values.scheduledAt ? '1px solid #eee' : '2px solid #005c53' }}
                                 onClick={() => setFieldValue('scheduledAt', '')}
                               >
                                 <Box display="flex" alignItems="center">
                                   <Rocket size={24} color={!values.scheduledAt ? '#005c53' : '#999'} style={{ marginRight: 12 }} />
                                   <Box>
                                     <Typography variant="subtitle1" style={{ fontWeight: 600 }}>Envio Imediato</Typography>
                                     <Typography variant="caption">Dispara a campanha assim que salvar.</Typography>
                                   </Box>
                                 </Box>
                               </Paper>
                            </Grid>
                            <Grid item xs={12} md={6}>
                               <Paper 
                                 className={classes.inputCard}
                                 style={{ border: values.scheduledAt ? '2px solid #005c53' : '1px solid #eee' }}
                                 onClick={() => setFieldValue('scheduledAt', moment().add(1, 'hour').format("YYYY-MM-DDTHH:mm"))}
                               >
                                 <Box display="flex" alignItems="center">
                                   <Calendar size={24} color={values.scheduledAt ? '#005c53' : '#999'} style={{ marginRight: 12 }} />
                                   <Box>
                                     <Typography variant="subtitle1" style={{ fontWeight: 600 }}>Agendamento</Typography>
                                     <Typography variant="caption">Escolha data e hora no futuro.</Typography>
                                   </Box>
                                 </Box>
                               </Paper>
                            </Grid>

                            {values.scheduledAt && (
                              <Grid item xs={12}>
                                <Field
                                  as={TextField}
                                  label="Data e Hora de Início"
                                  name="scheduledAt"
                                  type="datetime-local"
                                  fullWidth
                                  variant="outlined"
                                  InputLabelProps={{ shrink: true }}
                                />
                              </Grid>
                            )}
                            
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" gutterBottom>Intervalo entre Mensagens</Typography>
                              <Box display="flex" alignItems="center" gap={2}>
                                <Chip label="45 Segundos" color="primary" />
                                <Typography variant="caption" color="textSecondary">Recomendado para evitar banimentos.</Typography>
                              </Box>
                            </Grid>
                          </Grid>
                        </Box>
                      )}

                      {activeStep === 3 && (
                        <Box>
                           <Typography className={classes.stepTitle}>Compor Mensagem</Typography>
                           <Typography className={classes.stepSubTitle}>Defina o conteúdo que será enviado aos seus clientes.</Typography>
                           
                           <Tabs
                              value={messageTab}
                              onChange={(_, v) => setMessageTab(v)}
                              indicatorColor="primary"
                              textColor="primary"
                              style={{ marginBottom: 16 }}
                            >
                              <Tab label="Msg 1" />
                              <Tab label="Msg 2" />
                              <Tab label="Msg 3" />
                              <Tab label="Msg 4" />
                              <Tab label="Msg 5" />
                            </Tabs>

                            <Box>
                              {renderMessageField(getMessageFieldByTab(messageTab), setFieldValue, values)}
                              <Box mt={2}>
                                {renderTabAttachment(messageTab, values, !campaignEditable)}
                              </Box>
                            </Box>
                        </Box>
                      )}
                    </Box>

                    <Box className={classes.sidebarPart}>
                      {activeStep === 0 && (
                        <Box>
                           <Settings size={48} color="#005c53" />
                           <Typography variant="h6" style={{ marginTop: 16, fontWeight: 700 }}>Primeira Etapa</Typography>
                           <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
                             Esta base define quem receberá suas mensagens e qual canal será utilizado para o envio.
                           </Typography>
                        </Box>
                      )}
                      {activeStep === 1 && (
                        <Box width="100%">
                           <Box display="flex" justifyContent="space-between" mb={2}>
                             <Typography variant="subtitle2">IA e Automação</Typography>
                             <Checkbox color="primary" />
                           </Box>
                           <Alert severity="info" style={{ borderRadius: 12 }}>
                             O motor RAG utilizará sua base de conhecimento para responder dúvidas.
                           </Alert>
                           <Button fullWidth variant="outlined" style={{ marginTop: 16, borderRadius: 10 }}>Ajustar IA</Button>
                        </Box>
                      )}
                      {activeStep === 2 && (
                         <Box width="100%" textAlign="left">
                           <Typography variant="h6" style={{ fontWeight: 700, marginBottom: 16 }}>Resumo da Estratégia</Typography>
                           <Box display="flex" gap={2} mb={3}>
                              <Box style={{ backgroundColor: "#e6f4f3", padding: "12px", borderRadius: "12px" }}><Rocket color="#005c53" /></Box>
                              <Box>
                                <Typography variant="caption">FREQUÊNCIA</Typography>
                                <Typography variant="body2" style={{ fontWeight: 600 }}>80 mensagens / hora</Typography>
                              </Box>
                           </Box>
                           <Alert severity="warning" icon={<ShieldAlert />} style={{ borderRadius: 12 }}>
                             Proteção Anti-Spam ativa.
                           </Alert>
                         </Box>
                      )}
                      {activeStep === 3 && (
                        <Box style={{ transform: 'scale(0.85)', transformOrigin: 'top' }}>
                          <WhatsAppPreview 
                            whatsapp={whatsapps && whatsapps.find(w => w.id === whatsappId)}
                            message={values[getMessageFieldByTab(messageTab)]}
                            mediaUrl={values[getMediaUrlFieldByTab(messageTab)]}
                          />
                        </Box>
                      )}
                    </Box>
                  </Box>

                  <Box className={classes.footerFixed}>
                    <Button
                      startIcon={<ArrowLeftIcon size={18} />}
                      onClick={activeStep === 0 ? handleClose : handleBack}
                      className={classes.secondaryBtn}
                    >
                      {activeStep === 0 ? 'Cancelar' : 'Voltar'}
                    </Button>
                    
                    <Box display="flex" gap={2}>
                      <Button onClick={() => handleSaveRascunho(values, setSubmitting)} className={classes.secondaryBtn}>
                        Salvar Rascunho
                      </Button>
                      
                      {activeStep < steps.length - 1 ? (
                        <Button
                          variant="contained"
                          className={classes.primaryBtn}
                          onClick={() => handleNext(validateForm)}
                        >
                          Próximo Passo
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={isSubmitting}
                          className={classes.primaryBtn}
                        >
                          Finalizar e Lançar
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Form>
`;

content = content.replace(
    /\{(\{ values, errors, touched, isSubmitting, setFieldValue, setSubmitting \}\) => \{[\s\S]*?return \([\s\S]*?<\/Form>\s*\)\s*;\s*\}\}/,
    `{({ values, errors, touched, isSubmitting, setFieldValue, setSubmitting, validateForm }) => (\n${stepUI}\n)}`
);

content = content.replace(
    /      <MainHeader>[\s\S]*?<\/MainHeader>/,
    '      <MainHeader><Title>Criar Campanha Inteligente</Title></MainHeader>'
);

content = content.replace(
    /      <Paper style=\{\{ flex: 1, overflowY: "auto", margin: 16, display: 'flex', flexDirection: 'column' \}\}>[\s\S]*?<Formik/,
    '      <Paper style={{ flex: 1, overflowY: "auto", margin: 16, display: "flex", flexDirection: "column", borderRadius: 20 }}>\n        <Formik'
);

content = content.replace(/if \(!isMounted\.current\) return;/g, 'if (!isMounted.current) return;');
content = content.replace(/if \(user\?\.companyId\) \{/g, 'if (user?.companyId) {');
content = content.replace('  onClose,', '');
content = content.replace(/onClose\(\);/g, 'handleClose();');

fs.writeFileSync(formPath, content);
console.log("Full redesign migration complete.");
