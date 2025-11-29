import React, { useState, useEffect } from "react";
import {
  makeStyles,
  Paper,
  Typography,
  Tabs,
  Tab,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  Divider,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import {
  ExpandMore as ExpandMoreIcon,
  EmojiObjects as AIIcon,
  AccountTree as FlowIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  Description as DocIcon,
  VpnKey as KeyIcon,
  Security as SecurityIcon,
  MenuBook as BookIcon,
  BugReport as BugIcon,
  Build as TipsIcon,
  Link as LinkIcon,
  Forum,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { Link } from "react-router-dom";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
  },
  content: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  tabsContainer: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  tabContent: {
    flex: 1,
    overflow: "auto",
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.default,
  },
  sectionCard: {
    marginBottom: theme.spacing(3),
    border: `1px solid ${theme.palette.divider}`,
  },
  stepCard: {
    marginBottom: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.primary.light}`,
  },
  exampleCard: {
    backgroundColor: theme.palette.grey[50],
    border: `1px solid ${theme.palette.grey[300]}`,
    marginTop: theme.spacing(2),
  },
  codeBlock: {
    backgroundColor: theme.palette.grey[900],
    color: theme.palette.common.white,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    fontFamily: "monospace",
    fontSize: "0.875rem",
    overflow: "auto",
    margin: theme.spacing(1, 0),
  },
  infoBox: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.contrastText,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
  tagChip: {
    margin: theme.spacing(0.5),
    backgroundColor: theme.palette.secondary.light,
    color: theme.palette.secondary.contrastText,
  },
  stepNumber: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    width: 30,
    height: 30,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    marginRight: theme.spacing(2),
  },
  flowDiagram: {
    backgroundColor: theme.palette.grey[100],
    padding: theme.spacing(3),
    borderRadius: theme.shape.borderRadius,
    textAlign: "center",
    margin: theme.spacing(2, 0),
  },
}));

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ai-tutorial-tabpanel-${index}`}
      aria-labelledby={`ai-tutorial-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const AITutorial = () => {
  const classes = useStyles();
  const [tabValue, setTabValue] = useState(0);

  // RAG state
  const [embedModel, setEmbedModel] = useState("text-embedding-3-small");
  const [savingModel, setSavingModel] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [ragTitle, setRagTitle] = useState("");
  const [ragText, setRagText] = useState("");
  const [ragTags, setRagTags] = useState("");
  const [chunkSize, setChunkSize] = useState(1200);
  const [overlap, setOverlap] = useState(200);
  const [indexMsg, setIndexMsg] = useState("");

  const [searchQ, setSearchQ] = useState("");
  const [searchK, setSearchK] = useState(5);
  const [searchTags, setSearchTags] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [documents, setDocuments] = useState([]);
  const [docsMsg, setDocsMsg] = useState("");

  // Preferências RAG
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragTopK, setRagTopK] = useState(4);
  const [prefMsg, setPrefMsg] = useState("");

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSaveRagPrefs = async () => {
    try {
      await api.put("/companySettings/", {
        column: "ragEnabled",
        data: ragEnabled ? "enabled" : "disabled",
      });
      await api.put("/companySettings/", {
        column: "ragTopK",
        data: String(Math.min(20, Math.max(1, ragTopK || 4))),
      });
      setPrefMsg("Preferências RAG salvas.");
      setTimeout(() => setPrefMsg(""), 3000);
    } catch {
      setPrefMsg("Falha ao salvar preferências.");
      setTimeout(() => setPrefMsg(""), 3000);
    }
  };

  // Effects to load current embedding model and documents
  useEffect(() => {
    const loadEmbeddingModel = async () => {
      try {
        const res = await api.get("/companySettingOne/", {
          params: { column: "ragEmbeddingModel" },
        });
        const val = res?.data?.ragEmbeddingModel;
        if (typeof val === "string" && val) setEmbedModel(val);
      } catch { }
    };
    const loadRagPrefs = async () => {
      try {
        const se = await api.get("/companySettingOne/", {
          params: { column: "ragEnabled" },
        });
        const sv = (se?.data?.ragEnabled || "").toString().toLowerCase();
        setRagEnabled(sv === "enabled");
      } catch { }
      try {
        const sk = await api.get("/companySettingOne/", {
          params: { column: "ragTopK" },
        });
        const kv = Number(sk?.data?.ragTopK);
        if (!isNaN(kv) && kv > 0) setRagTopK(kv);
      } catch { }
    };
    const loadDocuments = async () => {
      try {
        const res = await api.get("/helps/rag/documents");
        setDocuments(res?.data?.documents || []);
      } catch { }
    };
    loadEmbeddingModel();
    loadRagPrefs();
    loadDocuments();
  }, []);

  const handleSaveEmbeddingModel = async () => {
    try {
      setSavingModel(true);
      await api.put("/companySettings/", {
        column: "ragEmbeddingModel",
        data: embedModel,
      });
      // Garante dimensão compatível com o modelo atual (small -> 1536)
      if (embedModel.includes("small")) {
        await api.put("/companySettings/", {
          column: "ragEmbeddingDims",
          data: String(1536),
        });
      }
      setSaveMsg("Configuração de embeddings salva com sucesso.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveMsg("Falha ao salvar configuração.");
      setTimeout(() => setSaveMsg(""), 3000);
    } finally {
      setSavingModel(false);
    }
  };

  const refreshDocuments = async () => {
    try {
      const res = await api.get("/rag/documents");
      setDocuments(res?.data?.documents || []);
    } catch { }
  };

  const handleIndexText = async () => {
    try {
      if (!ragTitle || !ragText) {
        setIndexMsg("Preencha título e conteúdo.");
        setTimeout(() => setIndexMsg(""), 3000);
        return;
      }
      const tags = ragTags
        ? ragTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
        : [];
      await api.post("/helps/rag/index-text", {
        title: ragTitle,
        text: ragText,
        tags,
        chunkSize,
        overlap,
      });
      setIndexMsg("Documento indexado com sucesso.");
      setRagTitle("");
      setRagText("");
      setRagTags("");
      setTimeout(() => setIndexMsg(""), 3000);
      refreshDocuments();
    } catch (e) {
      setIndexMsg("Falha ao indexar documento.");
      setTimeout(() => setIndexMsg(""), 3000);
    }
  };

  const handleSearchRag = async () => {
    try {
      const tags = searchTags
        ? searchTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
        : [];
      const res = await api.get("/helps/rag/search", {
        params: { q: searchQ, k: searchK, tags: tags.join(",") },
      });
      setSearchResults(res?.data?.results || []);
    } catch {
      setSearchResults([]);
    }
  };

  const handleDeleteDocument = async (id) => {
    try {
      await api.delete(`/helps/rag/documents/${id}`);
      setDocsMsg("Documento removido.");
      setTimeout(() => setDocsMsg(""), 3000);
      refreshDocuments();
    } catch {
      setDocsMsg("Falha ao remover documento.");
      setTimeout(() => setDocsMsg(""), 3000);
    }
  };

  const renderOverviewTab = () => (
    <div className={classes.tabContent}>
      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            <AIIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
            Visão Geral e Arquitetura de IA
          </Typography>
          <Typography variant="body1" paragraph>
            O Whaticket oferece uma camada unificada para usar IA em múltiplos
            pontos do sistema (Assistente no Ticket, WhatsApp, FlowBuilder e
            outros canais), resolvendo automaticamente qual{" "}
            <strong>projeto</strong> (OpenAI/Gemini) usar com base na{" "}
            <strong>Fila</strong>, na <strong>Conexão</strong> ou nas{" "}
            <strong>Configurações da Empresa</strong>.
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <KeyIcon />
              </ListItemIcon>
              <ListItemText
                primary="Projetos em /Queue Integration"
                secondary="Cadastre projetos OpenAI ou Gemini com API Key, Modelo e parâmetros (temperature, maxTokens...)."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText
                primary="Resolução Automática"
                secondary="O sistema escolhe o projeto por Fila → Conexão → Empresa → Variáveis de Ambiente (fallback)."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <SecurityIcon />
              </ListItemIcon>
              <ListItemText
                primary="Segurança"
                secondary="Chaves são armazenadas criptografadas e exibidas mascaradas nas telas."
              />
            </ListItem>
          </List>
          <Divider style={{ margin: "12px 0" }} />
          <Typography variant="body2">
            Para administradores e equipes técnicas, a arquitetura utiliza uma{" "}
            <strong>Factory de Provedores</strong> e um{" "}
            <strong>Resolver</strong> de credenciais, garantindo padronização e
            escalabilidade multiempresas.
          </Typography>
          <Box mt={2} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button
              component={Link}
              to="/queue-integration"
              variant="contained"
              color="primary"
            >
              Abrir Queue Integration
            </Button>
            <Button
              component={Link}
              to="/connections"
              variant="outlined"
              color="primary"
            >
              Conexões
            </Button>
            <Button
              component={Link}
              to="/prompts"
              variant="outlined"
              color="primary"
            >
              Prompts
            </Button>
            <Button
              component={Link}
              to="/flowbuilders"
              variant="outlined"
              color="primary"
            >
              FlowBuilder
            </Button>
          </Box>
        </CardContent>
      </Card>
      <Box mt={2} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button
          component={Link}
          to="/flowbuilders"
          variant="contained"
          color="primary"
        >
          Abrir FlowBuilder
        </Button>
        <Button
          component={Link}
          to="/flowbuilder"
          variant="outlined"
          color="primary"
        >
          Configurar Fluxo
        </Button>
        <Button
          component={Link}
          to="/prompts"
          variant="outlined"
          color="primary"
        >
          Prompts
        </Button>
      </Box>
    </div>
  );

  const renderProjectsTab = () => (
    <div className={classes.tabContent}>
      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            <SettingsIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
            Projetos de IA – Configuração em Queue Integration
          </Typography>
          <Typography variant="body1" paragraph>
            Cadastre e gerencie os projetos de IA em{" "}
            <strong>Integrações → Queue Integration</strong>. Um projeto define
            qual provedor (OpenAI/Gemini), modelo e parâmetros serão usados.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card className={classes.stepCard}>
                <CardContent>
                  <Box display="flex" alignItems="center" marginBottom={2}>
                    <div className={classes.stepNumber}>1</div>
                    <Typography variant="h6">Criar Projeto</Typography>
                  </Box>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <KeyIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="API Key (mascarada)"
                        secondary="Cole sua chave. Ao salvar, ela é criptografada."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <AIIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Modelo"
                        secondary="Ex: gpt-4o-mini, gemini-2.0-pro"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <SettingsIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Parâmetros"
                        secondary="temperature, maxTokens, presencePenalty, topP"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card className={classes.stepCard}>
                <CardContent>
                  <Box display="flex" alignItems="center" marginBottom={2}>
                    <div className={classes.stepNumber}>2</div>
                    <Typography variant="h6">
                      Vincular à Fila/Conexão
                    </Typography>
                  </Box>
                  <Typography variant="body2" paragraph>
                    Em <strong>Filas</strong> (Queue) e{" "}
                    <strong>Conexões WhatsApp</strong>, selecione o{" "}
                    <strong>Projeto</strong> no campo <em>Integração</em>.
                  </Typography>
                  <Alert severity="info">
                    A seleção em tempo de execução segue: Fila → Conexão →
                    Empresa → Ambiente.
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          <Box mt={2} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button
              component={Link}
              to="/queue-integration"
              variant="contained"
              color="primary"
            >
              Abrir Queue Integration
            </Button>
            <Button
              component={Link}
              to="/queues"
              variant="outlined"
              color="primary"
            >
              Filas
            </Button>
            <Button
              component={Link}
              to="/connections"
              variant="outlined"
              color="primary"
            >
              Conexões
            </Button>
          </Box>
        </CardContent>
      </Card>
      <Box mt={2} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button
          component={Link}
          to="/flowbuilders"
          variant="contained"
          color="primary"
        >
          Abrir FlowBuilder
        </Button>
        <Button
          component={Link}
          to="/flowbuilder"
          variant="outlined"
          color="primary"
        >
          Configurar Fluxo
        </Button>
        <Button
          component={Link}
          to="/prompts"
          variant="outlined"
          color="primary"
        >
          Prompts
        </Button>
      </Box>
    </div>
  );

  const renderAutomaticAITab = () => (
    <div className={classes.tabContent}>
      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            <AIIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
            IA Automática por Conexão
          </Typography>
          <Typography variant="body1" paragraph>
            A IA Automática é ativada automaticamente quando uma mensagem chega
            em uma conexão WhatsApp que possui um prompt configurado, antes de
            ser direcionada para qualquer fila ou atendente.
          </Typography>
          <div className={classes.infoBox}>
            <Typography variant="body2">
              <InfoIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
              <strong>Ideal para:</strong> Triagem inicial, respostas
              automáticas, qualificação de leads, atendimento 24/7 antes do
              horário comercial.
            </Typography>
          </div>
        </CardContent>
      </Card>

      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Como Funciona
          </Typography>
          <div className={classes.flowDiagram}>
            <Typography variant="body1">
              📱 <strong>Mensagem Chega</strong> → 🤖{" "}
              <strong>IA Responde</strong> → 👤{" "}
              <strong>Transfere para Fila</strong>
            </Typography>
          </div>
        </CardContent>
      </Card>

      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Configuração Passo a Passo
          </Typography>

          <Card className={classes.stepCard}>
            <CardContent>
              <Box display="flex" alignItems="center" marginBottom={2}>
                <div className={classes.stepNumber}>1</div>
                <Typography variant="h6">Configurar Integração IA</Typography>
              </Box>
              <Typography variant="body2" paragraph>
                Primeiro, configure uma integração OpenAI ou Gemini em{" "}
                <strong>Integrações → Queue Integration</strong>
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Acesse o menu Integrações"
                    secondary="Configure API Key, modelo, temperatura e tokens"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Teste a conexão"
                    secondary="Verifique se a API Key está funcionando"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card className={classes.stepCard}>
            <CardContent>
              <Box display="flex" alignItems="center" marginBottom={2}>
                <div className={classes.stepNumber}>2</div>
                <Typography variant="h6">Criar Prompt</Typography>
              </Box>
              <Typography variant="body2" paragraph>
                Vá em <strong>IA → Prompts</strong> e crie um novo prompt
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <DocIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Nome do Prompt"
                    secondary="Ex: 'Atendimento Inicial - Vendas'"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <AIIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Selecione a Integração"
                    secondary="Escolha a integração OpenAI/Gemini configurada"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card className={classes.stepCard}>
            <CardContent>
              <Box display="flex" alignItems="center" marginBottom={2}>
                <div className={classes.stepNumber}>3</div>
                <Typography variant="h6">Associar à Conexão</Typography>
              </Box>
              <Typography variant="body2" paragraph>
                Edite sua conexão WhatsApp e associe o prompt criado
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Conexões → Editar WhatsApp"
                    secondary="Selecione o prompt no campo 'Prompt IA'"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Exemplo Prático
          </Typography>
          <Card className={classes.exampleCard}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cenário: Loja de Roupas
              </Typography>
              <div className={classes.codeBlock}>
                {`Olá {{nome}}! 👋 Sou a assistente virtual da {{name_company}}.

Estou aqui para te ajudar com:
• Informações sobre produtos
• Consulta de preços
• Agendamento de atendimento

Como posso te ajudar hoje?

Se precisar de atendimento personalizado, digite "ATENDENTE".`}
              </div>
              <Box>
                <Chip
                  className={classes.tagChip}
                  label="{{nome}}"
                  size="small"
                />
                <Chip
                  className={classes.tagChip}
                  label="{{name_company}}"
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
          <Box mt={2} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button
              component={Link}
              to="/connections"
              variant="contained"
              color="primary"
            >
              Abrir Conexões
            </Button>
            <Button
              component={Link}
              to="/prompts"
              variant="outlined"
              color="primary"
            >
              Prompts
            </Button>
            <Button
              component={Link}
              to="/queue-integration"
              variant="outlined"
              color="primary"
            >
              Queue Integration
            </Button>
            <Button
              component={Link}
              to="/flowbuilders"
              variant="outlined"
              color="primary"
            >
              FlowBuilder
            </Button>
          </Box>
        </CardContent>
      </Card>
    </div>
  );

  const renderChatAssistantTab = () => (
    <div className={classes.tabContent}>
      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            <Forum style={{ marginRight: 8, verticalAlign: "middle" }} />
            Assistente de Chat no Ticket
          </Typography>
          <Typography variant="body1" paragraph>
            O Assistente ajuda a escrever mensagens com IA diretamente no
            ticket, sem enviar automaticamente para o cliente. Você revisa,
            ajusta e envia.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card className={classes.stepCard}>
                <CardContent>
                  <Box display="flex" alignItems="center" marginBottom={2}>
                    <div className={classes.stepNumber}>1</div>
                    <Typography variant="h6">Abrir o Assistente</Typography>
                  </Box>
                  <Typography variant="body2">
                    No campo de mensagem, clique no ícone do Assistente para
                    abrir o painel.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card className={classes.stepCard}>
                <CardContent>
                  <Box display="flex" alignItems="center" marginBottom={2}>
                    <div className={classes.stepNumber}>2</div>
                    <Typography variant="h6">Escolher Modo</Typography>
                  </Box>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <AIIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Aprimorar"
                        secondary="Deixa a mensagem natural, clara e alinhada ao tom da marca."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <AIIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Corretor"
                        secondary="Ajusta ortografia e gramática."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <AIIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Traduzir"
                        secondary="Traduz para o idioma desejado (ex.: pt-BR, en-US)."
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                O projeto é escolhido automaticamente pela Fila/Conexão do
                ticket. Você pode preferir OpenAI/Gemini no seletor, quando
                disponível.
              </Alert>
            </Grid>
          </Grid>
          <Card className={classes.exampleCard}>
            <CardContent>
              <Typography variant="h6">Exemplo</Typography>
              <div
                className={classes.codeBlock}
              >{`"Oi, tudo bem? Queria saber do prazo do meu pedido #1234" → Aprimorar (pt-BR)`}</div>
              <Typography variant="body2">
                O Assistente sugere um texto mais claro e cordial, pronto para
                você inserir e enviar.
              </Typography>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
      <Box mt={2} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button
          component={Link}
          to="/prompts"
          variant="contained"
          color="primary"
        >
          Abrir Prompts
        </Button>
        <Button
          component={Link}
          to="/queue-integration"
          variant="outlined"
          color="primary"
        >
          Queue Integration
        </Button>
      </Box>
    </div>
  );

  const renderFlowBuilderAITab = () => (
    <div className={classes.tabContent}>
      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            <FlowIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
            IA no FlowBuilder
          </Typography>
          <Typography variant="body1" paragraph>
            A IA no FlowBuilder permite inserir ações de inteligência artificial
            em pontos específicos do seu fluxo de atendimento, oferecendo
            controle granular sobre quando e como a IA é acionada.
          </Typography>
        </CardContent>
      </Card>

      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Casos de Uso Práticos
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card className={classes.exampleCard}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    1. Classificação de Intenção
                  </Typography>
                  <div className={classes.codeBlock}>
                    {`Analise a mensagem e classifique:

Mensagem: "{{ultima_mensagem}}"

Responda apenas:
- VENDAS
- SUPORTE  
- CANCELAMENTO

Classificação:`}
                  </div>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card className={classes.exampleCard}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    2. Análise de Sentimento
                  </Typography>
                  <div className={classes.codeBlock}>
                    {`Analise o sentimento:

"{{ultima_mensagem}}"

Responda apenas:
- POSITIVO
- NEUTRO  
- NEGATIVO
- URGENTE`}
                  </div>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Dicas Avançadas
          </Typography>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Fluxos Condicionais com IA</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Use a resposta da IA para criar ramificações no fluxo baseadas
                na análise inteligente.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Otimização de Prompts</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Seja específico nas instruções e formate a saída esperada para
                melhores resultados.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );

  const renderOtherChannelsTab = () => (
    <div className={classes.tabContent}>
      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            <LinkIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
            Outros Canais (Messenger, Instagram, Telegram, E-mail, Webchat)
          </Typography>
          <Typography variant="body1" paragraph>
            Nos demais canais, a IA funciona da mesma forma: o Whaticket escolhe
            o projeto pelo contexto do atendimento. Se o canal cria{" "}
            <strong>Ticket</strong> com <strong>Fila</strong>, nada muda – a
            seleção acontece por Fila.
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckIcon />
              </ListItemIcon>
              <ListItemText
                primary="Messenger/Instagram/Telegram/Webchat"
                secondary="Se o ticket vier com queueId, a IA resolve por Fila. Caso contrário, configure a integração na Conexão do canal."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon />
              </ListItemIcon>
              <ListItemText
                primary="E-mail"
                secondary="Respostas com IA podem ser geradas e coladas na réplica. Em breve: automação por regra."
              />
            </ListItem>
          </List>
          <Box mt={2} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button
              component={Link}
              to="/connections"
              variant="contained"
              color="primary"
            >
              Abrir Conexões
            </Button>
            <Button
              component={Link}
              to="/queues"
              variant="outlined"
              color="primary"
            >
              Filas
            </Button>
          </Box>
        </CardContent>
      </Card>
    </div>
  );

  const renderRagTab = () => (
    <div className={classes.tabContent}>
      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            <BookIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
            Base de Conhecimento (RAG)
          </Typography>
          <Alert severity="info" style={{ marginBottom: 12 }}>
            A configuração e o gerenciamento da RAG foram movidos para o menu{" "}
            <strong>Integrações → Queue Integration</strong>, criando a
            integração <strong>Base de Conhecimento</strong>.
          </Alert>
          <Typography variant="body1" paragraph>
            Nesta página permanecem apenas conteúdos de ajuda e tutoriais. Para
            configurar embeddings, ativar RAG, indexar textos/arquivos,
            pesquisar e gerenciar documentos, acesse Integrações.
          </Typography>
          <Box mt={2} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              component={Link}
              to="/queue-integration"
              variant="contained"
              color="primary"
            >
              Abrir Integrações
            </Button>
            <Button
              component={Link}
              to="/helps"
              variant="outlined"
              color="primary"
            >
              Ver Tutoriais
            </Button>
          </Box>
        </CardContent>
      </Card>
    </div>
  );

  // removidos blocos órfãos relacionados à antiga UI de RAG

  const renderTipsTab = () => (
    <div className={classes.tabContent}>
      <Card className={classes.sectionCard}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            <TipsIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
            Dicas de Uso e Troubleshooting
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <TipsIcon />
              </ListItemIcon>
              <ListItemText
                primary="Seja específico no prompt"
                secondary="Peça formato de saída e tom desejado."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <TipsIcon />
              </ListItemIcon>
              <ListItemText
                primary="Preserve variáveis"
                secondary="Use {{nome}}, {{pedido}}, etc. Não remova placeholders."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BugIcon />
              </ListItemIcon>
              <ListItemText
                primary="Sem resposta da IA"
                secondary="Verifique se a Fila/Conexão tem projeto vinculado ou se há API Key configurada na Empresa/ENV."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BugIcon />
              </ListItemIcon>
              <ListItemText
                primary="Transcrição vazia"
                secondary="Confirme o formato do áudio e tente novamente. Suportados: mp3, wav, ogg, aac, flac, aiff."
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={classes.root}>
      <MainContainer>
        <MainHeader>
          <Title>
            <span>
              <Link
                to="/helps"
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  opacity: 0.8,
                }}
              >
                Central de Ajuda
              </Link>
              <span style={{ margin: "0 8px", opacity: 0.6 }}>{">"}</span>
              <strong>Manual de IA</strong>
            </span>
          </Title>
          <MainHeaderButtonsWrapper />
        </MainHeader>
        <div className={classes.content}>
          <Paper className={classes.tabsContainer}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab label="Visão Geral" icon={<AIIcon />} />
              <Tab label="Projetos & Config" icon={<SettingsIcon />} />
              <Tab label="Assistente no Ticket" icon={<Forum />} />
              <Tab label="IA Automática" icon={<AIIcon />} />
              <Tab label="IA no FlowBuilder" icon={<FlowIcon />} />
              <Tab label="Outros Canais" icon={<LinkIcon />} />
              <Tab label="RAG & Conhecimento" icon={<BookIcon />} />
              <Tab label="Dicas & Suporte" icon={<TipsIcon />} />
            </Tabs>
          </Paper>

          <TabPanel value={tabValue} index={0}>
            {renderOverviewTab()}
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            {renderProjectsTab()}
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
            {renderChatAssistantTab()}
          </TabPanel>
          <TabPanel value={tabValue} index={3}>
            {renderAutomaticAITab()}
          </TabPanel>
          <TabPanel value={tabValue} index={4}>
            {renderFlowBuilderAITab()}
          </TabPanel>
          <TabPanel value={tabValue} index={5}>
            {renderOtherChannelsTab()}
          </TabPanel>
          <TabPanel value={tabValue} index={6}>
            {renderRagTab()}
          </TabPanel>
          <TabPanel value={tabValue} index={7}>
            {renderTipsTab()}
          </TabPanel>
        </div>
      </MainContainer>
    </div>
  );
};

export default AITutorial;
