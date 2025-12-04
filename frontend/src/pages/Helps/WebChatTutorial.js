import React, { useState } from "react";
import {
  makeStyles,
  Paper,
  Typography,
  Tabs,
  Tab,
  Box,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import {
  Chat as WebChatIcon,
  CheckCircle,
  Error as ErrorIcon,
  Settings,
  Code,
  Palette,
  Web,
  FileCopy,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { Link } from "react-router-dom";

const useStyles = makeStyles((theme) => ({
  root: { display: "flex", flexDirection: "column" },
  content: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
  tabsContainer: { borderBottom: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper },
  tabContent: { flex: 1, overflow: "auto", padding: theme.spacing(3), backgroundColor: theme.palette.background.default },
  sectionCard: { marginBottom: theme.spacing(3), border: `1px solid ${theme.palette.divider}` },
  stepContent: { paddingLeft: theme.spacing(2) },
  codeBlock: {
    backgroundColor: "#1e1e1e",
    color: "#d4d4d4",
    padding: theme.spacing(2),
    borderRadius: 4,
    fontFamily: "'Fira Code', 'Consolas', monospace",
    fontSize: "0.85rem",
    overflowX: "auto",
    position: "relative",
  },
  copyButton: {
    position: "absolute",
    top: 8,
    right: 8,
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.1)",
    "&:hover": {
      backgroundColor: "rgba(255,255,255,0.2)",
    },
  },
  colorPreview: {
    display: "inline-block",
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 8,
    verticalAlign: "middle",
    border: "1px solid #ddd",
  },
}));

function TabPanel({ children, value, index, ...other }) {
  return <div role="tabpanel" hidden={value !== index} {...other}>{value === index && <Box>{children}</Box>}</div>;
}

const WebChatTutorial = () => {
  const classes = useStyles();
  const [tabValue, setTabValue] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const embedCode = `<script 
  src="https://seu-dominio.com/webchat/embed.js" 
  data-widget-id="SEU_WIDGET_ID"
  data-primary-color="#25D366"
  data-company-name="Sua Empresa"
  data-position="right"
  data-greeting="Olá! Como posso ajudar?"
  data-require-prechat="true">
</script>`;

  const configSteps = [
    {
      label: "Criar Conexão WebChat",
      description: (
        <>
          <Typography paragraph>
            1. No sistema, vá em <strong>Conexões</strong> → <strong>"Nova Conexão"</strong>
          </Typography>
          <Typography paragraph>
            2. Clique em <strong>"WebChat"</strong>
          </Typography>
          <Typography paragraph>
            3. Preencha os dados:
          </Typography>
          <List dense>
            <ListItem><ListItemText primary="• Nome: Nome identificador do widget" /></ListItem>
            <ListItem><ListItemText primary="• Mensagem de Boas-vindas: Primeira mensagem automática" /></ListItem>
            <ListItem><ListItemText primary="• Fila: Fila padrão para novos atendimentos" /></ListItem>
          </List>
          <Typography paragraph>
            4. Clique em <strong>"Salvar"</strong>
          </Typography>
        </>
      ),
    },
    {
      label: "Copiar o Widget ID",
      description: (
        <>
          <Typography paragraph>
            1. Após criar a conexão, ela aparecerá na lista
          </Typography>
          <Typography paragraph>
            2. Anote o <strong>ID</strong> ou <strong>Nome</strong> da conexão
          </Typography>
          <Typography paragraph>
            3. Este será o <strong>data-widget-id</strong> no código de incorporação
          </Typography>
          <Alert severity="info" style={{ marginTop: 8 }}>
            O Widget ID é único para cada conexão e identifica de qual site veio a mensagem.
          </Alert>
        </>
      ),
    },
    {
      label: "Adicionar ao Site",
      description: (
        <>
          <Typography paragraph>
            Copie o código abaixo e cole antes do fechamento da tag <code>&lt;/body&gt;</code> do seu site:
          </Typography>
          <Box className={classes.codeBlock} style={{ position: "relative" }}>
            <Button
              size="small"
              className={classes.copyButton}
              onClick={() => copyToClipboard(embedCode)}
              startIcon={<FileCopy />}
            >
              Copiar
            </Button>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{embedCode}</pre>
          </Box>
          <Typography paragraph style={{ marginTop: 16 }}>
            <strong>Substitua:</strong>
          </Typography>
          <List dense>
            <ListItem><ListItemText primary="• seu-dominio.com → URL do seu backend" /></ListItem>
            <ListItem><ListItemText primary="• SEU_WIDGET_ID → ID da conexão criada" /></ListItem>
            <ListItem><ListItemText primary="• Sua Empresa → Nome da sua empresa" /></ListItem>
          </List>
        </>
      ),
    },
    {
      label: "Testar o Widget",
      description: (
        <>
          <Typography paragraph>
            1. Acesse seu site onde adicionou o código
          </Typography>
          <Typography paragraph>
            2. Você verá um <strong>botão flutuante</strong> no canto da tela
          </Typography>
          <Typography paragraph>
            3. Clique para abrir o chat
          </Typography>
          <Typography paragraph>
            4. Preencha seu nome e envie uma mensagem de teste
          </Typography>
          <Typography paragraph>
            5. A mensagem deve aparecer no sistema como um novo ticket
          </Typography>
          <Alert severity="success" style={{ marginTop: 16 }}>
            <strong>Pronto!</strong> Seu WebChat está funcionando. Visitantes do site podem conversar com você!
          </Alert>
        </>
      ),
    },
  ];

  return (
    <div className={classes.root}>
      <MainContainer>
        <MainHeader>
          <Title>
            <span>
              <Link to="/helps" style={{ textDecoration: "none", color: "inherit", opacity: 0.8 }}>Central de Ajuda</Link>
              <span style={{ margin: "0 8px", opacity: 0.6 }}>{">"}</span>
              <strong>WebChat</strong>
            </span>
          </Title>
          <MainHeaderButtonsWrapper />
        </MainHeader>

        <div className={classes.content}>
          <Paper className={classes.tabsContainer}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto">
              <Tab label="Visão Geral" />
              <Tab label="Configuração" />
              <Tab label="Múltiplos Widgets" />
              <Tab label="Personalização" />
              <Tab label="Dicas de Uso" />
              <Tab label="Solução de Problemas" />
            </Tabs>
          </Paper>

          <div className={classes.tabContent}>
            {/* VISÃO GERAL */}
            <TabPanel value={tabValue} index={0}>
              <Card className={classes.sectionCard}>
                <CardContent>
                  <Typography variant="h4" gutterBottom>
                    <WebChatIcon style={{ marginRight: 8, verticalAlign: "middle", color: "#6B46C1" }} />
                    WebChat
                  </Typography>
                  <Typography variant="body1" paragraph>
                    Adicione um widget de chat ao seu site para que visitantes possam conversar com você em tempo real.
                    As mensagens chegam diretamente no sistema, integradas com IA e chatbot.
                  </Typography>
                  <Alert severity="success" style={{ marginBottom: 16 }}>
                    <strong>✨ Múltiplos Widgets:</strong> Você pode criar VÁRIOS widgets de WebChat! Ideal para diferentes sites ou departamentos.
                  </Alert>
                  <Alert severity="info">
                    <strong>Sem necessidade de apps externos!</strong> O visitante conversa direto pelo navegador.
                  </Alert>

                  <Typography variant="h6" style={{ marginTop: 24 }} gutterBottom>
                    Funcionalidades
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Chat em tempo real" secondary="Comunicação instantânea via WebSocket" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Formulário pré-chat" secondary="Colete nome e email antes de iniciar" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Totalmente personalizável" secondary="Cores, posição, textos e logo" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Integração com IA" secondary="Respostas automáticas inteligentes" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Envio de arquivos" secondary="Visitantes podem enviar imagens e documentos" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Responsivo" secondary="Funciona em desktop e mobile" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </TabPanel>

            {/* CONFIGURAÇÃO */}
            <TabPanel value={tabValue} index={1}>
              <Card className={classes.sectionCard}>
                <CardContent>
                  <Typography variant="h5" gutterBottom>
                    <Settings style={{ marginRight: 8, verticalAlign: "middle" }} />
                    Passo a Passo de Configuração
                  </Typography>
                  
                  <Stepper activeStep={activeStep} orientation="vertical">
                    {configSteps.map((step, index) => (
                      <Step key={step.label}>
                        <StepLabel>{step.label}</StepLabel>
                        <StepContent>
                          <div className={classes.stepContent}>
                            {step.description}
                          </div>
                          <Box mt={2}>
                            <Button
                              disabled={index === 0}
                              onClick={() => setActiveStep(index - 1)}
                            >
                              Voltar
                            </Button>
                            <Button
                              variant="contained"
                              color="primary"
                              onClick={() => setActiveStep(index + 1)}
                              style={{ marginLeft: 8 }}
                            >
                              {index === configSteps.length - 1 ? "Concluir" : "Próximo"}
                            </Button>
                          </Box>
                        </StepContent>
                      </Step>
                    ))}
                  </Stepper>
                  
                  {activeStep === configSteps.length && (
                    <Box mt={3}>
                      <Alert severity="success">
                        <strong>Configuração concluída!</strong> Seu WebChat está pronto para uso.
                      </Alert>
                      <Button onClick={() => setActiveStep(0)} style={{ marginTop: 16 }}>
                        Reiniciar Tutorial
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            {/* MÚLTIPLOS WIDGETS */}
            <TabPanel value={tabValue} index={2}>
              <Card className={classes.sectionCard}>
                <CardContent>
                  <Typography variant="h5" gutterBottom>
                    🔄 Criando Múltiplos Widgets de WebChat
                  </Typography>
                  
                  <Alert severity="success" style={{ marginBottom: 24 }}>
                    <strong>Sim, é possível!</strong> Você pode criar quantos widgets de WebChat quiser. Cada widget é uma conexão separada no sistema.
                  </Alert>

                  <Typography variant="h6" gutterBottom>Casos de uso para múltiplos widgets:</Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Sites diferentes" 
                        secondary="Um widget para cada site da sua empresa"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Departamentos" 
                        secondary="Widget de Vendas, Suporte, Financeiro, etc."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Marcas/Produtos" 
                        secondary="Widget personalizado para cada marca"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Landing Pages" 
                        secondary="Widget específico para campanhas"
                      />
                    </ListItem>
                  </List>

                  <Divider style={{ margin: "24px 0" }} />

                  <Typography variant="h6" gutterBottom>Como criar múltiplos widgets:</Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="1. Vá em Conexões → Nova Conexão → WebChat" 
                        secondary="Repita o processo para cada widget"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="2. Dê um nome descritivo" 
                        secondary="Ex: 'WebChat - Site Principal', 'WebChat - Loja Virtual'"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="3. Configure filas e atendentes" 
                        secondary="Cada widget pode ter configurações independentes"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="4. Copie o código de incorporação" 
                        secondary="Cada widget tem seu próprio Widget ID"
                      />
                    </ListItem>
                  </List>

                  <Alert severity="info" style={{ marginTop: 16 }}>
                    <strong>Dica:</strong> Personalize as cores de cada widget para combinar com a identidade visual de cada site.
                  </Alert>

                  <Divider style={{ margin: "24px 0" }} />

                  <Typography variant="h6" gutterBottom>Benefícios:</Typography>
                  <List dense>
                    <ListItem><ListItemText primary="✅ Atendentes diferentes por widget" /></ListItem>
                    <ListItem><ListItemText primary="✅ Filas separadas por departamento" /></ListItem>
                    <ListItem><ListItemText primary="✅ Chatbots personalizados para cada contexto" /></ListItem>
                    <ListItem><ListItemText primary="✅ Cores e branding diferentes" /></ListItem>
                    <ListItem><ListItemText primary="✅ Relatórios separados por widget" /></ListItem>
                  </List>
                </CardContent>
              </Card>
            </TabPanel>

            {/* PERSONALIZAÇÃO */}
            <TabPanel value={tabValue} index={3}>
              <Card className={classes.sectionCard}>
                <CardContent>
                  <Typography variant="h5" gutterBottom>
                    <Palette style={{ marginRight: 8, verticalAlign: "middle" }} />
                    Opções de Personalização
                  </Typography>
                  
                  <Typography variant="h6" style={{ marginTop: 16 }} gutterBottom>
                    Atributos Disponíveis
                  </Typography>

                  <List>
                    <ListItem>
                      <ListItemText 
                        primary={<code>data-widget-id</code>}
                        secondary="ID único do widget (obrigatório)"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary={<code>data-primary-color</code>}
                        secondary={
                          <>
                            Cor principal do widget. Exemplos:
                            <br />
                            <span className={classes.colorPreview} style={{ backgroundColor: "#25D366" }} /> #25D366 (Verde WhatsApp)
                            <br />
                            <span className={classes.colorPreview} style={{ backgroundColor: "#6B46C1" }} /> #6B46C1 (Roxo)
                            <br />
                            <span className={classes.colorPreview} style={{ backgroundColor: "#2563EB" }} /> #2563EB (Azul)
                          </>
                        }
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary={<code>data-position</code>}
                        secondary="Posição do botão: 'right' (direita) ou 'left' (esquerda)"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary={<code>data-company-name</code>}
                        secondary="Nome exibido no header do chat"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary={<code>data-company-logo</code>}
                        secondary="URL da logo da empresa (opcional)"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary={<code>data-greeting</code>}
                        secondary="Mensagem de boas-vindas automática"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary={<code>data-require-prechat</code>}
                        secondary="'true' para exigir nome/email antes de iniciar, 'false' para chat direto"
                      />
                    </ListItem>
                  </List>

                  <Typography variant="h6" style={{ marginTop: 24 }} gutterBottom>
                    Exemplo Completo
                  </Typography>
                  <Box className={classes.codeBlock}>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{`<script 
  src="https://api.suaempresa.com/webchat/embed.js" 
  data-widget-id="widget_vendas"
  data-primary-color="#2563EB"
  data-company-name="Loja Virtual"
  data-company-logo="https://suaempresa.com/logo.png"
  data-position="right"
  data-greeting="Olá! Bem-vindo à nossa loja. Como posso ajudar?"
  data-require-prechat="true">
</script>`}</pre>
                  </Box>
                </CardContent>
              </Card>
            </TabPanel>

            {/* DICAS DE USO */}
            <TabPanel value={tabValue} index={4}>
              <Card className={classes.sectionCard}>
                <CardContent>
                  <Typography variant="h5" gutterBottom>
                    💡 Dicas de Uso
                  </Typography>
                  
                  <Alert severity="info" style={{ marginBottom: 16 }}>
                    <strong>Conversão!</strong> Sites com chat ao vivo têm até 40% mais conversões.
                  </Alert>

                  <Typography variant="h6" gutterBottom>Boas Práticas</Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Configure a IA para responder fora do horário" 
                        secondary="Não deixe visitantes sem resposta"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Use o formulário pré-chat" 
                        secondary="Colete dados do visitante para follow-up"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Personalize a cor com sua marca" 
                        secondary="Mantenha consistência visual"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Crie respostas rápidas" 
                        secondary="Agilize o atendimento com atalhos"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Monitore o tempo de resposta" 
                        secondary="Visitantes esperam respostas em segundos"
                      />
                    </ListItem>
                  </List>

                  <Typography variant="h6" style={{ marginTop: 24 }} gutterBottom>
                    Onde Usar
                  </Typography>
                  <List dense>
                    <ListItem><ListItemText primary="• Página inicial do site" /></ListItem>
                    <ListItem><ListItemText primary="• Páginas de produto/serviço" /></ListItem>
                    <ListItem><ListItemText primary="• Página de contato" /></ListItem>
                    <ListItem><ListItemText primary="• Landing pages" /></ListItem>
                    <ListItem><ListItemText primary="• E-commerce (carrinho, checkout)" /></ListItem>
                  </List>
                </CardContent>
              </Card>
            </TabPanel>

            {/* SOLUÇÃO DE PROBLEMAS */}
            <TabPanel value={tabValue} index={5}>
              <Card className={classes.sectionCard}>
                <CardContent>
                  <Typography variant="h5" gutterBottom>
                    <ErrorIcon style={{ marginRight: 8, verticalAlign: "middle", color: "orange" }} />
                    Solução de Problemas
                  </Typography>

                  <Typography variant="h6" style={{ marginTop: 16 }} gutterBottom>
                    Widget não aparece no site
                  </Typography>
                  <Typography variant="body2" paragraph>
                    • Verifique se o script está antes do <code>&lt;/body&gt;</code><br />
                    • Confirme que a URL do backend está correta<br />
                    • Abra o Console do navegador (F12) e procure por erros<br />
                    • Verifique se o CORS está configurado no backend
                  </Typography>

                  <Divider style={{ margin: "16px 0" }} />

                  <Typography variant="h6" gutterBottom>
                    Mensagens não chegam no sistema
                  </Typography>
                  <Typography variant="body2" paragraph>
                    • Verifique se o Widget ID está correto<br />
                    • Confirme que a conexão WebChat está ativa<br />
                    • Verifique os logs do backend para erros de WebSocket<br />
                    • Teste a conexão Socket.IO no navegador
                  </Typography>

                  <Divider style={{ margin: "16px 0" }} />

                  <Typography variant="h6" gutterBottom>
                    Chat desconecta frequentemente
                  </Typography>
                  <Typography variant="body2" paragraph>
                    • Verifique a estabilidade do servidor<br />
                    • Confirme que o WebSocket está configurado corretamente<br />
                    • Verifique se há firewall bloqueando conexões
                  </Typography>

                  <Divider style={{ margin: "16px 0" }} />

                  <Typography variant="h6" gutterBottom>
                    Erro de CORS
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Adicione o domínio do seu site na configuração de CORS do backend:
                  </Typography>
                  <Box className={classes.codeBlock}>
                    <pre style={{ margin: 0 }}>{`// No backend, arquivo de configuração
CORS_ORIGIN=https://seusite.com`}</pre>
                  </Box>

                  <Alert severity="warning" style={{ marginTop: 16 }}>
                    <strong>Precisa de ajuda?</strong> Entre em contato com o suporte técnico.
                  </Alert>
                </CardContent>
              </Card>
            </TabPanel>
          </div>
        </div>
      </MainContainer>
    </div>
  );
};

export default WebChatTutorial;
