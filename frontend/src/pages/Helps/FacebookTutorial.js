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
  Facebook,
  CheckCircle,
  Error as ErrorIcon,
  Info as InfoIcon,
  Settings,
  Security,
  Business,
  Link as LinkIcon,
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
    backgroundColor: "#f5f5f5",
    padding: theme.spacing(2),
    borderRadius: 4,
    fontFamily: "monospace",
    fontSize: "0.9rem",
    overflowX: "auto",
  },
  linkButton: {
    marginTop: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
}));

function TabPanel({ children, value, index, ...other }) {
  return <div role="tabpanel" hidden={value !== index} {...other}>{value === index && <Box>{children}</Box>}</div>;
}

const FacebookTutorial = () => {
  const classes = useStyles();
  const [tabValue, setTabValue] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const configSteps = [
    {
      label: "Criar App no Meta for Developers",
      description: (
        <>
          <Typography paragraph>
            1. Acesse <strong>developers.facebook.com</strong> e faça login com sua conta do Facebook
          </Typography>
          <Typography paragraph>
            2. Clique em <strong>"Meus Apps"</strong> → <strong>"Criar App"</strong>
          </Typography>
          <Typography paragraph>
            3. Selecione <strong>"Empresa"</strong> como tipo de app
          </Typography>
          <Typography paragraph>
            4. Preencha o nome do app e email de contato
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            className={classes.linkButton}
            href="https://developers.facebook.com/apps"
            target="_blank"
          >
            Abrir Meta for Developers
          </Button>
        </>
      ),
    },
    {
      label: "Configurar Messenger",
      description: (
        <>
          <Typography paragraph>
            1. No painel do seu app, clique em <strong>"Adicionar Produto"</strong>
          </Typography>
          <Typography paragraph>
            2. Encontre <strong>"Messenger"</strong> e clique em <strong>"Configurar"</strong>
          </Typography>
          <Typography paragraph>
            3. Na seção <strong>"Tokens de Acesso"</strong>, clique em <strong>"Adicionar ou Remover Páginas"</strong>
          </Typography>
          <Typography paragraph>
            4. Selecione a página do Facebook que deseja conectar
          </Typography>
          <Typography paragraph>
            5. Copie o <strong>Token de Acesso da Página</strong> gerado
          </Typography>
        </>
      ),
    },
    {
      label: "Configurar Webhooks",
      description: (
        <>
          <Typography paragraph>
            1. Na seção <strong>"Webhooks"</strong>, clique em <strong>"Adicionar URL de Callback"</strong>
          </Typography>
          <Typography paragraph>
            2. Use a URL do seu backend:
          </Typography>
          <Box className={classes.codeBlock}>
            https://seu-dominio.com/webhook/facebook
          </Box>
          <Typography paragraph style={{ marginTop: 16 }}>
            3. O <strong>Token de Verificação</strong> deve ser o mesmo configurado no seu .env
          </Typography>
          <Typography paragraph>
            4. Selecione os campos de assinatura: <strong>messages, messaging_postbacks, message_deliveries</strong>
          </Typography>
        </>
      ),
    },
    {
      label: "Conectar no Sistema",
      description: (
        <>
          <Typography paragraph>
            1. No sistema, vá em <strong>Conexões</strong> → <strong>"Nova Conexão"</strong>
          </Typography>
          <Typography paragraph>
            2. Selecione <strong>"Facebook Messenger"</strong> no tipo de canal
          </Typography>
          <Typography paragraph>
            3. Preencha os campos de configuração:
          </Typography>
          <Box style={{ marginLeft: 16, marginBottom: 16 }}>
            <Typography variant="body2">• <strong>Meta App ID:</strong> ID do seu App no Meta for Developers</Typography>
            <Typography variant="body2">• <strong>Meta App Secret:</strong> Chave secreta do App</Typography>
            <Typography variant="body2">• <strong>Facebook Page ID:</strong> ID da sua página</Typography>
            <Typography variant="body2">• <strong>Page Access Token:</strong> Token de acesso da página</Typography>
            <Typography variant="body2">• <strong>Webhook Verify Token:</strong> Token para validação do webhook</Typography>
          </Box>
          <Typography paragraph>
            4. Configure as filas e atendentes
          </Typography>
          <Typography paragraph>
            5. Clique em <strong>"Salvar"</strong>
          </Typography>
          <Alert severity="info" style={{ marginTop: 16 }}>
            <strong>Dica:</strong> Se deixar os campos em branco, o sistema usará as variáveis de ambiente (.env) como fallback.
          </Alert>
          <Alert severity="success" style={{ marginTop: 8 }}>
            <strong>Pronto!</strong> Sua página do Facebook está conectada e pronta para receber mensagens.
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
              <strong>Facebook Messenger</strong>
            </span>
          </Title>
          <MainHeaderButtonsWrapper />
        </MainHeader>

        <div className={classes.content}>
          <Paper className={classes.tabsContainer}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto">
              <Tab label="Visão Geral" />
              <Tab label="Configuração" />
              <Tab label="Múltiplas Contas" />
              <Tab label="Recursos" />
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
                    <Facebook style={{ marginRight: 8, verticalAlign: "middle", color: "#3b5998" }} />
                    Facebook Messenger
                  </Typography>
                  <Typography variant="body1" paragraph>
                    Conecte sua página do Facebook para receber e responder mensagens do Messenger diretamente no sistema.
                  </Typography>
                  <Alert severity="success" style={{ marginBottom: 16 }}>
                    <strong>✨ Múltiplas Contas:</strong> Você pode conectar VÁRIAS páginas do Facebook! Basta repetir o processo de conexão para cada página.
                  </Alert>
                  <Alert severity="info">
                    <strong>Requisitos:</strong> Você precisa ser administrador de uma Página do Facebook e ter um App no Meta for Developers.
                  </Alert>

                  <Typography variant="h6" style={{ marginTop: 24 }} gutterBottom>
                    Funcionalidades Disponíveis
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Receber mensagens de texto" secondary="Todas as mensagens enviadas para sua página" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Enviar mensagens de texto" secondary="Responda diretamente pelo sistema" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Receber e enviar imagens/vídeos" secondary="Suporte a mídia do Messenger" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Chatbot e FlowBuilder" secondary="Automatize respostas com fluxos" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="IA e RAG" secondary="Use inteligência artificial para responder" />
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
                        <strong>Configuração concluída!</strong> Sua página do Facebook está pronta para uso.
                      </Alert>
                      <Button onClick={() => setActiveStep(0)} style={{ marginTop: 16 }}>
                        Reiniciar Tutorial
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            {/* MÚLTIPLAS CONTAS */}
            <TabPanel value={tabValue} index={2}>
              <Card className={classes.sectionCard}>
                <CardContent>
                  <Typography variant="h5" gutterBottom>
                    🔄 Conectando Múltiplas Páginas do Facebook
                  </Typography>
                  
                  <Alert severity="success" style={{ marginBottom: 24 }}>
                    <strong>Sim, é possível!</strong> Você pode conectar quantas páginas do Facebook quiser. Cada página será uma conexão separada no sistema.
                  </Alert>

                  <Typography variant="h6" gutterBottom>Como adicionar mais páginas:</Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="1. Vá em Conexões → Nova Conexão → Facebook" 
                        secondary="Repita o processo de conexão para cada página"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="2. Faça login e selecione outra página" 
                        secondary="Você pode usar a mesma conta do Facebook para conectar várias páginas"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="3. Configure filas e atendentes para cada página" 
                        secondary="Cada conexão pode ter configurações independentes"
                      />
                    </ListItem>
                  </List>

                  <Divider style={{ margin: "24px 0" }} />

                  <Typography variant="h6" gutterBottom>Benefícios de múltiplas conexões:</Typography>
                  <List dense>
                    <ListItem><ListItemText primary="✅ Atenda várias páginas/marcas em um único painel" /></ListItem>
                    <ListItem><ListItemText primary="✅ Configure filas diferentes para cada página" /></ListItem>
                    <ListItem><ListItemText primary="✅ Atribua atendentes específicos por página" /></ListItem>
                    <ListItem><ListItemText primary="✅ Use chatbots diferentes para cada página" /></ListItem>
                    <ListItem><ListItemText primary="✅ Relatórios separados por conexão" /></ListItem>
                  </List>

                  <Alert severity="info" style={{ marginTop: 16 }}>
                    <strong>Dica:</strong> Dê nomes descritivos para cada conexão (ex: "Facebook - Loja Centro", "Facebook - Loja Shopping") para facilitar a identificação.
                  </Alert>
                </CardContent>
              </Card>
            </TabPanel>

            {/* RECURSOS */}
            <TabPanel value={tabValue} index={3}>
              <Card className={classes.sectionCard}>
                <CardContent>
                  <Typography variant="h5" gutterBottom>
                    <Business style={{ marginRight: 8, verticalAlign: "middle" }} />
                    Recursos e Limitações
                  </Typography>
                  
                  <Typography variant="h6" style={{ marginTop: 16 }} gutterBottom>
                    ✅ O que você PODE fazer
                  </Typography>
                  <List dense>
                    <ListItem><ListItemText primary="• Responder mensagens em até 24 horas" /></ListItem>
                    <ListItem><ListItemText primary="• Enviar imagens, vídeos e arquivos" /></ListItem>
                    <ListItem><ListItemText primary="• Usar chatbot para respostas automáticas" /></ListItem>
                    <ListItem><ListItemText primary="• Transferir para atendentes humanos" /></ListItem>
                    <ListItem><ListItemText primary="• Usar IA para respostas inteligentes" /></ListItem>
                  </List>

                  <Typography variant="h6" style={{ marginTop: 24 }} gutterBottom>
                    ⚠️ Limitações do Facebook
                  </Typography>
                  <List dense>
                    <ListItem><ListItemText primary="• Janela de 24h: Após 24h sem resposta do cliente, você só pode enviar mensagens com templates aprovados" /></ListItem>
                    <ListItem><ListItemText primary="• Sem envio de documentos PDF diretamente (use links)" /></ListItem>
                    <ListItem><ListItemText primary="• Mensagens promocionais têm restrições" /></ListItem>
                  </List>
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
                    <strong>Responda rápido!</strong> O Facebook prioriza páginas que respondem em menos de 15 minutos.
                  </Alert>

                  <Typography variant="h6" gutterBottom>Boas Práticas</Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Configure um chatbot de boas-vindas" 
                        secondary="Responda automaticamente quando o cliente iniciar conversa"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Use respostas rápidas" 
                        secondary="Crie atalhos para perguntas frequentes"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Ative a IA para horários de pico" 
                        secondary="Deixe a IA responder quando a equipe estiver ocupada"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Monitore o tempo de resposta" 
                        secondary="Mantenha abaixo de 5 minutos para melhor experiência"
                      />
                    </ListItem>
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
                    Não consigo conectar minha página
                  </Typography>
                  <Typography variant="body2" paragraph>
                    • Verifique se você é <strong>administrador</strong> da página<br />
                    • Certifique-se de que o App está em modo <strong>"Ao Vivo"</strong> no Meta for Developers<br />
                    • Verifique se as permissões foram concedidas corretamente
                  </Typography>

                  <Divider style={{ margin: "16px 0" }} />

                  <Typography variant="h6" gutterBottom>
                    Mensagens não estão chegando
                  </Typography>
                  <Typography variant="body2" paragraph>
                    • Verifique se o Webhook está configurado corretamente<br />
                    • Confirme que o Token de Verificação está correto no .env<br />
                    • Verifique os logs do backend para erros
                  </Typography>

                  <Divider style={{ margin: "16px 0" }} />

                  <Typography variant="h6" gutterBottom>
                    Erro ao enviar mensagens
                  </Typography>
                  <Typography variant="body2" paragraph>
                    • Verifique se a janela de 24h não expirou<br />
                    • Confirme que o Token de Acesso da Página está válido<br />
                    • Verifique se a página não está com restrições
                  </Typography>

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

export default FacebookTutorial;
