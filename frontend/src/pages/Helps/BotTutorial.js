import React, { useState } from "react";
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
    Alert,
    Button,
} from "@material-ui/core";

import {
    ExpandMore as ExpandMoreIcon,
    SmartToy as BotIcon,
    Build as ActionsIcon,
    Send as SendIcon,
    Person as PersonIcon,
    SwapHoriz as TransferIcon,
    Description as DocIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
    PlayArrow as FlowIcon,
    Settings as SettingsIcon,
    Label as TagIcon,
    CloudUpload as UploadIcon,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { Link } from "react-router-dom";

const useStyles = makeStyles(theme => ({
    root: {
        display: 'flex',
        flexDirection: 'column',
    },
    content: {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    tabsContainer: {
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
    },
    tabContent: {
        flex: 1,
        overflow: 'auto',
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
        fontFamily: 'monospace',
        fontSize: '0.875rem',
        overflow: 'auto',
        margin: theme.spacing(1, 0),
    },
    infoBox: {
        backgroundColor: theme.palette.info.light,
        color: theme.palette.info.contrastText,
        padding: theme.spacing(2),
        borderRadius: theme.shape.borderRadius,
        marginBottom: theme.spacing(2),
    },
    successBox: {
        backgroundColor: theme.palette.success.light,
        color: theme.palette.success.contrastText,
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
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        marginRight: theme.spacing(2),
    },
    flowDiagram: {
        backgroundColor: theme.palette.grey[100],
        padding: theme.spacing(3),
        borderRadius: theme.shape.borderRadius,
        textAlign: 'center',
        margin: theme.spacing(2, 0),
        border: `2px solid ${theme.palette.primary.light}`,
    },
}));

function TabPanel({ children, value, index, ...other }) {
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`bot-tutorial-tabpanel-${index}`}
            aria-labelledby={`bot-tutorial-tab-${index}`}
            {...other}
        >
            {value === index && <Box>{children}</Box>}
        </div>
    );
}

const BotTutorial = () => {
    const classes = useStyles();
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const renderOverviewTab = () => (
        <div className={classes.tabContent}>
            <Card className={classes.sectionCard}>
                <CardContent>
                    <Typography variant="h4" gutterBottom>
                        <BotIcon style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Bot Inteligente com Ações Reais
                    </Typography>
                    <Typography variant="body1" paragraph>
                        O Bot agora vai além de apenas conversar - ele <strong>EXECUTA AÇÕES REAIS</strong> usando
                        a tecnologia de <strong>Function Calling</strong> (OpenAI/Gemini). Ao invés de apenas prometer
                        "vou enviar o catálogo", o bot ENVIA o arquivo automaticamente!
                    </Typography>

                    <div className={classes.successBox}>
                        <Typography variant="h6" gutterBottom>
                            <CheckIcon style={{ marginRight: 8, verticalAlign: 'middle' }} />
                            Problema Resolvido!
                        </Typography>
                        <Typography variant="body2">
                            <strong>ANTES:</strong> "Vou te enviar o catálogo..." → Cliente: "Cadê?" → Loop infinito<br />
                            <strong>AGORA:</strong> "Vou te enviar o catálogo..." → [ENVIA PDF] → Cliente satisfeito ✅
                        </Typography>
                    </div>

                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Card className={classes.stepCard}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        <SendIcon style={{ marginRight: 8 }} />
                                        Envio Automático de Arquivos
                                    </Typography>
                                    <List dense>
                                        <ListItem>
                                            <ListItemIcon><CheckIcon /></ListItemIcon>
                                            <ListItemText primary="Catálogo de produtos (PDF)" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckIcon /></ListItemIcon>
                                            <ListItemText primary="Tabela de preços" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckIcon /></ListItemIcon>
                                            <ListItemText primary="Qualquer arquivo configurado" />
                                        </ListItem>
                                    </List>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card className={classes.stepCard}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        <TransferIcon style={{ marginRight: 8 }} />
                                        Transferência Inteligente
                                    </Typography>
                                    <List dense>
                                        <ListItem>
                                            <ListItemIcon><CheckIcon /></ListItemIcon>
                                            <ListItemText primary="Vendedor específico por TAG (#BRUNA)" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckIcon /></ListItemIcon>
                                            <ListItemText primary="Atendente humano genérico" />
                                        </ListItem>
                                        <ListItem>
                                            <ListItemIcon><CheckIcon /></ListItemIcon>
                                            <ListItemText primary="Baseado no histórico do cliente" />
                                        </ListItem>
                                    </List>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    <Box mt={3}>
                        <Alert severity="info">
                            <strong>5 Funções Disponíveis:</strong> enviar_catalogo, enviar_tabela_precos,
                            buscar_produto_detalhado, transferir_para_vendedor_responsavel, transferir_para_atendente
                        </Alert>
                    </Box>
                </CardContent>
            </Card>
        </div>
    );

    const renderHowItWorksTab = () => (
        <div className={classes.tabContent}>
            <Card className={classes.sectionCard}>
                <CardContent>
                    <Typography variant="h4" gutterBottom>
                        <FlowIcon style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Como Funciona - Fluxo Técnico
                    </Typography>

                    <div className={classes.flowDiagram}>
                        <Typography variant="h6" gutterBottom style={{ fontFamily: 'monospace' }}>
                            📱 Cliente → 🤖 Bot (IA) → ⚙️ Detecta Função → 🎬 Executa Ação → 📨 Confirma
                        </Typography>
                    </div>

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Card className={classes.exampleCard}>
                                <CardContent>
                                    <Typography variant="h6" color="primary" gutterBottom>
                                        Passo 1: Cliente faz pedido
                                    </Typography>
                                    <div className={classes.codeBlock}>
                                        {`📱 Cliente: "quero ver o catálogo de produtos"

🤖 Bot analisa a mensagem...`}</div>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card className={classes.exampleCard}>
                                <CardContent>
                                    <Typography variant="h6" color="primary" gutterBottom>
                                        Passo 2: IA decide chamar função
                                    </Typography>
                                    <div className={classes.codeBlock}>
                                        {`🧠 OpenAI/Gemini detecta intenção:
   "Cliente quer catálogo"

✅ Chama: enviar_catalogo("completo")`}</div>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card className={classes.exampleCard}>
                                <CardContent>
                                    <Typography variant="h6" color="primary" gutterBottom>
                                        Passo 3: Sistema executa ação
                                    </Typography>
                                    <div className={classes.codeBlock}>
                                        {`⚙️ ActionExecutor:
   1. Busca arquivo "catalogo.pdf" na fila
   2. Envia via WhatsApp
   3. Retorna: "✅ Catálogo enviado!"`}</div>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card className={classes.exampleCard}>
                                <CardContent>
                                    <Typography variant="h6" color="primary" gutterBottom>
                                        Passo 4: IA confirma ao cliente
                                    </Typography>
                                    <div className={classes.codeBlock}>
                                        {`🤖 Bot gera resposta final:
   "Acabei de enviar nosso catálogo 
    completo! Dê uma olhada e me 
    diga se tem interesse em algum 
    produto específico 😊"

📄 [ARQUIVO ENVIADO]`}</div>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </div>
    );

    const renderConfigurationTab = () => (
        <div className={classes.tabContent}>
            <Card className={classes.sectionCard}>
                <CardContent>
                    <Typography variant="h4" gutterBottom>
                        <SettingsIcon style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Configuração Passo a Passo
                    </Typography>

                    <Card className={classes.stepCard}>
                        <CardContent>
                            <Box display="flex" alignItems="center" marginBottom={2}>
                                <div className={classes.stepNumber}>1</div>
                                <Typography variant="h6">Vincular Arquivos às Filas</Typography>
                            </Box>
                            <Typography variant="body2" paragraph>
                                Configure os arquivos que o bot pode enviar (catálogo, tabelas, etc.)
                            </Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemIcon><UploadIcon /></ListItemIcon>
                                    <ListItemText
                                        primary="Upload do arquivo"
                                        secondary="Gerenciador de Arquivos → Upload PDF/DOC"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon><TagIcon /></ListItemIcon>
                                    <ListItemText
                                        primary="Adicionar palavras-chave"
                                        secondary='Ex: "catalogo", "produtos", "mostruario"'
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon><CheckIcon /></ListItemIcon>
                                    <ListItemText
                                        primary="Vincular à fila"
                                        secondary="Filas → Vendas → Lista de Arquivos"
                                    />
                                </ListItem>
                            </List>
                            <Alert severity="warning" style={{ marginTop: 16 }}>
                                <strong>Importante:</strong> As palavras-chave definem quando o arquivo é enviado.
                                Use "catalogo" para catálogos, "tabela,precos" para tabelas de preço.
                            </Alert>
                        </CardContent>
                    </Card>

                    <Card className={classes.stepCard}>
                        <CardContent>
                            <Box display="flex" alignItems="center" marginBottom={2}>
                                <div className={classes.stepNumber}>2</div>
                                <Typography variant="h6">Configurar Tags de Vendedores</Typography>
                            </Box>
                            <Typography variant="body2" paragraph>
                                Para transferência automática para vendedor específico
                            </Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemIcon><TagIcon /></ListItemIcon>
                                    <ListItemText
                                        primary="Criar tag pessoal"
                                        secondary='Tags → Nova tag → Nome: "#BRUNA" (com #)'
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon><PersonIcon /></ListItemIcon>
                                    <ListItemText
                                        primary="Dar permissão ao vendedor"
                                        secondary="Usuários → Bruna → Tags permitidas → #BRUNA"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon><CheckIcon /></ListItemIcon>
                                    <ListItemText
                                        primary="Aplicar aos clientes"
                                        secondary="Contatos → Cliente → Adicionar tag #BRUNA"
                                    />
                                </ListItem>
                            </List>
                            <div className={classes.codeBlock}>
                                {`Exemplo de match:
Cliente João → tem tag #BRUNA (id: 53)
Vendedora Bruna → allowedContactTags: [53]
→ Bot transfere automaticamente para Bruna!`}</div>
                        </CardContent>
                    </Card>

                    <Card className={classes.stepCard}>
                        <CardContent>
                            <Box display="flex" alignItems="center" marginBottom={2}>
                                <div className={classes.stepNumber}>3</div>
                                <Typography variant="h6">Testar as Funções</Typography>
                            </Box>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        <SendIcon style={{ marginRight: 8, fontSize: 16 }} />
                                        Teste 1: Envio de Catálogo
                                    </Typography>
                                    <div className={classes.codeBlock} style={{ fontSize: '0.75rem' }}>
                                        {`Envie: "quero ver o catálogo"
Esperado: Bot ENVIA PDF`}</div>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        <TransferIcon style={{ marginRight: 8, fontSize: 16 }} />
                                        Teste 2: Transferência por Tag
                                    </Typography>
                                    <div className={classes.codeBlock} style={{ fontSize: '0.75rem' }}>
                                        {`Cliente com #BRUNA
Envie: "quero falar com alguém"
Esperado: Transfere para Bruna`}</div>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

            <Box mt={2} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Button component={Link} to="/files" variant="contained" color="primary">
                    Gerenciador de Arquivos
                </Button>
                <Button component={Link} to="/tags" variant="outlined" color="primary">
                    Tags
                </Button>
                <Button component={Link} to="/users" variant="outlined" color="primary">
                    Usuários
                </Button>
                <Button component={Link} to="/queues" variant="outlined" color="primary">
                    Filas
                </Button>
            </Box>
        </div>
    );

    const renderUseCasesTab = () => (
        <div className={classes.tabContent}>
            <Card className={classes.sectionCard}>
                <CardContent>
                    <Typography variant="h4" gutterBottom>
                        <ActionsIcon style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Casos de Uso Práticos
                    </Typography>

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Card className={classes.exampleCard}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        📦 Caso 1: E-commerce de Produtos
                                    </Typography>
                                    <div className={classes.codeBlock}>
                                        {`Cliente: "me mostra os produtos"
Bot: 
1. Chama enviar_catalogo()
2. Envia catálogo.pdf
3. "Nosso catálogo completo!
   Veja todos os 150 produtos 
   disponíveis 📦"

Cliente: "qual tem 60W?"
Bot:
1. Chama buscar_produto_detalhado("60W")
2. Busca no RAG
3. "Encontrei 3 modelos com 60W:
   - Luminária Atenas: R$ 299
   - Pendente X: R$ 450
   - Spot Y: R$ 180"`}</div>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card className={classes.exampleCard}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        👔 Caso 2: Vendedores Específicos
                                    </Typography>
                                    <div className={classes.codeBlock}>
                                        {`Cliente João (tem tag #BRUNA):
"oi, preciso de ajuda"

Bot detecta:
1. Cliente tem tag #BRUNA
2. Chama transferir_para_vendedor()
3. Busca vendedora com allowedTags:[53]
4. Encontra Bruna (online)
5. Transfere automaticamente

Bot: "Vou te conectar com a 
Bruna, sua vendedora! 👤"

Bruna recebe notificação`}</div>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card className={classes.exampleCard}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        💰 Caso 3: Tabela de Preços
                                    </Typography>
                                    <div className={classes.codeBlock}>
                                        {`Cliente: "quanto custa?"

Bot:
1. Chama enviar_tabela_precos()
2. Busca arquivo com keywords 
   "tabela" ou "precos"
3. Envia tabela.pdf
4. "Tabela de preços atualizada!
   Temos condições especiais
   para pedidos acima de 10un"`}</div>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card className={classes.exampleCard}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        🔍 Caso 4: Busca Inteligente (RAG)
                                    </Typography>
                                    <div className={classes.codeBlock}>
                                        {`Cliente: "a luminária atenas 
é bivolt?"

Bot:
1. Chama buscar_produto_detalhado()
2. Busca no catálogo indexado (RAG)
3. "Sim! A Luminária Atenas G é 
   bivolt (110-220V) ⚡
   
   Outras especificações:
   - Potência: 60W
   - Base: E27
   - Garantia: 1 ano"`}</div>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </div>
    );

    const renderTroubleshootingTab = () => (
        <div className={classes.tabContent}>
            <Card className={classes.sectionCard}>
                <CardContent>
                    <Typography variant="h4" gutterBottom>
                        <ErrorIcon style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Solução de Problemas
Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="h6">❌ Bot não envia arquivo</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box>
                                <Typography variant="body2" paragraph><strong>Verificar:</strong></Typography>
                                <List dense>
                                    <ListItem>
                                        <ListItemIcon><CheckIcon /></ListItemIcon>
                                        <ListItemText primary="Arquivo vinculado à fila?" secondary="Filas → Lista de Arquivos" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon><CheckIcon /></ListItemIcon>
                                        <ListItemText primary="Palavras-chave corretas?" secondary='Use "catalogo", não "catologo"' />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon><CheckIcon /></ListItemIcon>
                                        <ListItemText primary="Arquivo existe no servidor?" secondary="Verificar caminho do arquivo" />
                                    </ListItem>
                                </List>
                                <Alert severity="info">
                                    <strong>Logs:</strong> Veja console do backend procurando por "[ActionExecutor]"
                                </Alert>
                            </Box>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="h6">❌ Transferência não funciona</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box>
                                <Typography variant="body2" paragraph><strong>Verificar:</strong></Typography>
                                <List dense>
                                    <ListItem>
                                        <ListItemIcon><CheckIcon /></ListItemIcon>
                                        <ListItemText primary="Cliente tem tag pessoal (#)?" secondary="Contatos → Tags" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon><CheckIcon /></ListItemIcon>
                                        <ListItemText primary="Vendedor tem permissão?" secondary="Usuários → allowedContactTags" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon><CheckIcon /></ListItemIcon>
                                        <ListItemText primary="IDs das tags coincidem?" secondary="Ver nos logs: [ActionExecutor]" />
                                    </ListItem>
                                </List>
                                <div className={classes.codeBlock}>
                                    {`SQL para verificar:
SELECT c.name, t.name as tag
FROM "Contacts" c
JOIN "ContactTags" ct ON ct."contactId" = c.id
JOIN "Tags" t ON t.id = ct."tagId"
WHERE t.name LIKE '#%';`}</div>
                            </Box>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="h6">❌ Bot não chama funções</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box>
                                <List dense>
                                    <ListItem>
                                        <ListItemIcon><CheckIcon /></ListItemIcon>
                                        <ListItemText
                                            primary="Modelo suporta function calling?"
                                            secondary="Use gpt-4o-mini, gpt-4o, gemini-2.0-pro"
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemIcon><CheckIcon /></ListItemIcon>
                                        <ListItemText
                                            primary="Function calling habilitado?"
                                            secondary="Checar OpenAiService.ts linha ~239"
                                        />
                                    </ListItem>
                                </List>
                                <Alert severity="warning">
                                    Modelos antigos (gpt-3.5-turbo) podem não suportar function calling adequadamente
                                </Alert>
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                </Accordion>

                <Box mt={3}>
                    <Typography variant="h6" gutterBottom>
                        <InfoIcon style={{ marginRight: 8 }} />
                        Monitoramento
                    </Typography>
                    <div className={classes.codeBlock}>
                        {`# Ver logs do backend em tempo real:
[ActionExecutor] Executando: enviar_catalogo
[ActionExecutor] Catálogo enviado - ticketId: 123
[IA][function-call] IA solicitou função: enviar_catalogo
[IA][function-call] Ação executada - result: ✅ Catálogo...
[IA][function-call] Resposta final gerada - totalLatency: 2340ms`}</div>
                </Box>
            </CardContent>
        </Card>
    </div >
  );

return (
    <div className={classes.root}>
        <MainContainer>
            <MainHeader>
                <Title>
                    <span>
                        <Link to="/helps" style={{ textDecoration: 'none', color: 'inherit', opacity: 0.8 }}>
                            Central de Ajuda
                        </Link>
                        <span style={{ margin: '0 8px', opacity: 0.6 }}>{'>'}</span>
                        <strong>Bot com Ações e Transferências</strong>
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
                        <Tab label="Visão Geral" icon={<BotIcon />} />
                        <Tab label="Como Funciona" icon={<FlowIcon />} />
                        <Tab label="Configuração" icon={<SettingsIcon />} />
                        <Tab label="Casos de Uso" icon={<ActionsIcon />} />
                        <Tab label="Solução de Problemas" icon={<ErrorIcon />} />
                    </Tabs>
                </Paper>

                <TabPanel value={tabValue} index={0}>{renderOverviewTab()}</TabPanel>
                <TabPanel value={tabValue} index={1}>{renderHowItWorksTab()}</TabPanel>
                <TabPanel value={tabValue} index={2}>{renderConfigurationTab()}</TabPanel>
                <TabPanel value={tabValue} index={3}>{renderUseCasesTab()}</TabPanel>
                <TabPanel value={tabValue} index={4}>{renderTroubleshootingTab()}</TabPanel>
            </div>
        </MainContainer>
    </div>
);
};

export default BotTutorial;
