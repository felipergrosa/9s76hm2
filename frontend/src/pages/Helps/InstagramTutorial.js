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
  Instagram,
  CheckCircle,
  Error as ErrorIcon,
  Settings,
  Business,
  Warning,
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

const InstagramTutorial = () => {
  const classes = useStyles();
  const [tabValue, setTabValue] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const configSteps = [
    {
      label: "Converter para Conta Profissional",
      description: (
        <>
          <Typography paragraph>
            1. Abra o Instagram e vá em <strong>Configurações</strong>
          </Typography>
          <Typography paragraph>
            2. Toque em <strong>"Conta"</strong> → <strong>"Mudar para conta profissional"</strong>
          </Typography>
          <Typography paragraph>
            3. Escolha <strong>"Empresa"</strong> (não Criador de Conteúdo)
          </Typography>
          <Typography paragraph>
            4. Selecione a categoria do seu negócio
          </Typography>
          <Alert severity="warning" style={{ marginTop: 8 }}>
            <strong>Importante:</strong> Apenas contas Business podem receber mensagens via API.
          </Alert>
        </>
      ),
    },
    {
      label: "Vincular à Página do Facebook",
      description: (
        <>
          <Typography paragraph>
            1. No Instagram, vá em <strong>Configurações</strong> → <strong>"Conta"</strong>
          </Typography>
          <Typography paragraph>
            2. Toque em <strong>"Contas vinculadas"</strong> ou <strong>"Central de Contas"</strong>
          </Typography>
          <Typography paragraph>
            3. Conecte sua conta do Facebook
          </Typography>
          <Typography paragraph>
            4. Vincule a uma <strong>Página do Facebook</strong> (obrigatório para API)
          </Typography>
          <Alert severity="info" style={{ marginTop: 8 }}>
            A página do Facebook é necessária porque a API do Instagram funciona através do Meta Business.
          </Alert>
        </>
      ),
    },
    {
      label: "Habilitar Mensagens no Meta Business",
      description: (
        <>
          <Typography paragraph>
            1. Acesse <strong>business.facebook.com</strong>
          </Typography>
          <Typography paragraph>
            2. Vá em <strong>"Configurações"</strong> → <strong>"Contas do Instagram"</strong>
          </Typography>
          <Typography paragraph>
            3. Verifique se sua conta está listada e conectada
          </Typography>
          <Typography paragraph>
            4. No App do Meta for Developers, adicione o produto <strong>"Instagram"</strong>
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            className={classes.linkButton}
            href="https://business.facebook.com/settings"
            target="_blank"
          >
            Abrir Meta Business
          </Button>
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
            2. Selecione <strong>"Instagram Direct"</strong> no tipo de canal
          </Typography>
          <Typography paragraph>
            3. Preencha os campos de configuração:
          </Typography>
          <Box style={{ marginLeft: 16, marginBottom: 16 }}>
            <Typography variant="body2">• <strong>Meta App ID:</strong> ID do seu App no Meta for Developers</Typography>
            <Typography variant="body2">• <strong>Meta App Secret:</strong> Chave secreta do App</Typography>
            <Typography variant="body2">• <strong>Instagram Account ID:</strong> ID da sua conta Instagram Business</Typography>
            <Typography variant="body2">• <strong>Page Access Token:</strong> Token de acesso da página vinculada</Typography>
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
            <strong>Pronto!</strong> Sua conta do Instagram está conectada.
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
              <strong>Instagram Direct</strong>
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
                    <Instagram style={{ marginRight: 8, verticalAlign: "middle", color: "#e1306c" }} />
                    Instagram Direct
                  </Typography>
                  <Typography variant="body1" paragraph>
                    Conecte sua conta Business do Instagram para receber e responder mensagens do Direct diretamente no sistema.
                  </Typography>
                  <Alert severity="success" style={{ marginBottom: 16 }}>
                    <strong>✨ Múltiplas Contas:</strong> Você pode conectar VÁRIAS contas do Instagram! Basta repetir o processo de conexão para cada conta.
                  </Alert>
                  <Alert severity="warning">
                    <strong>Requisitos:</strong> Conta Instagram Business vinculada a uma Página do Facebook e App no Meta for Developers.
                  </Alert>

                  <Typography variant="h6" style={{ marginTop: 24 }} gutterBottom>
                    Funcionalidades Disponíveis
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Receber mensagens do Direct" secondary="Todas as DMs enviadas para sua conta" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Enviar mensagens de texto" secondary="Responda diretamente pelo sistema" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Enviar imagens e vídeos" secondary="Compartilhe mídia com seus seguidores" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle style={{ color: "green" }} /></ListItemIcon>
                      <ListItemText primary="Chatbot e IA" secondary="Automatize respostas inteligentes" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Warning style={{ color: "orange" }} /></ListItemIcon>
                      <ListItemText primary="Documentos (limitado)" secondary="Instagram não suporta PDFs - enviamos como link" />
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
                  
                  <Alert severity="info" style={{ marginBottom: 16 }}>
                    O Instagram usa a mesma infraestrutura do Facebook. Você precisa ter um App no Meta for Developers configurado.
                  </Alert>
                  
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
                        <strong>Configuração concluída!</strong> Sua conta do Instagram está pronta.
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
                    🔄 Conectando Múltiplas Contas do Instagram
                  </Typography>
                  
                  <Alert severity="success" style={{ marginBottom: 24 }}>
                    <strong>Sim, é possível!</strong> Você pode conectar quantas contas do Instagram quiser. Cada conta será uma conexão separada no sistema.
                  </Alert>

                  <Typography variant="h6" gutterBottom>Como adicionar mais contas:</Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="1. Vá em Conexões → Nova Conexão → Instagram" 
                        secondary="Repita o processo de conexão para cada conta"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="2. Faça login e selecione outra conta" 
                        secondary="Cada conta Instagram precisa estar vinculada a uma Página do Facebook"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="3. Configure filas e atendentes para cada conta" 
                        secondary="Cada conexão pode ter configurações independentes"
                      />
                    </ListItem>
                  </List>

                  <Divider style={{ margin: "24px 0" }} />

                  <Typography variant="h6" gutterBottom>Benefícios de múltiplas conexões:</Typography>
                  <List dense>
                    <ListItem><ListItemText primary="✅ Gerencie várias marcas/perfis em um único painel" /></ListItem>
                    <ListItem><ListItemText primary="✅ Configure filas diferentes para cada perfil" /></ListItem>
                    <ListItem><ListItemText primary="✅ Atribua atendentes específicos por conta" /></ListItem>
                    <ListItem><ListItemText primary="✅ Use chatbots diferentes para cada perfil" /></ListItem>
                    <ListItem><ListItemText primary="✅ Relatórios separados por conexão" /></ListItem>
                  </List>

                  <Alert severity="info" style={{ marginTop: 16 }}>
                    <strong>Dica:</strong> Dê nomes descritivos para cada conexão (ex: "Instagram - @loja_centro", "Instagram - @loja_shopping") para facilitar a identificação.
                  </Alert>

                  <Alert severity="warning" style={{ marginTop: 16 }}>
                    <strong>Lembre-se:</strong> Cada conta Instagram precisa ser do tipo Business e estar vinculada a uma Página do Facebook.
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
                    <ListItem><ListItemText primary="• Enviar imagens e vídeos" /></ListItem>
                    <ListItem><ListItemText primary="• Usar chatbot para respostas automáticas" /></ListItem>
                    <ListItem><ListItemText primary="• Usar IA para respostas inteligentes" /></ListItem>
                    <ListItem><ListItemText primary="• Receber reações e menções em stories" /></ListItem>
                  </List>

                  <Typography variant="h6" style={{ marginTop: 24 }} gutterBottom>
                    ⚠️ Limitações do Instagram
                  </Typography>
                  <List dense>
                    <ListItem><ListItemText primary="• Janela de 24h: Mesma regra do Facebook Messenger" /></ListItem>
                    <ListItem><ListItemText primary="• SEM suporte a documentos/PDFs (enviamos como link)" /></ListItem>
                    <ListItem><ListItemText primary="• SEM suporte a áudio/PTT via API" /></ListItem>
                    <ListItem><ListItemText primary="• Apenas contas Business podem usar a API" /></ListItem>
                    <ListItem><ListItemText primary="• Precisa estar vinculada a uma Página do Facebook" /></ListItem>
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
                    <strong>Engajamento é tudo!</strong> Responda rápido para aumentar seu alcance no Instagram.
                  </Alert>

                  <Typography variant="h6" gutterBottom>Boas Práticas</Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Responda em menos de 1 hora" 
                        secondary="O Instagram favorece contas com respostas rápidas"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Use a IA para horários de pico" 
                        secondary="Configure a IA para responder automaticamente"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Personalize as respostas" 
                        secondary="Use o nome do cliente nas mensagens"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Envie catálogos como imagem" 
                        secondary="Já que PDFs não são suportados, crie imagens do catálogo"
                      />
                    </ListItem>
                  </List>

                  <Typography variant="h6" style={{ marginTop: 24 }} gutterBottom>
                    Alternativa para Documentos
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Como o Instagram não suporta PDFs, o sistema envia automaticamente um <strong>link para download</strong>.
                    O cliente pode clicar e baixar o documento no navegador.
                  </Typography>
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
                    Não aparece a opção de conectar Instagram
                  </Typography>
                  <Typography variant="body2" paragraph>
                    • Verifique se sua conta é <strong>Business</strong> (não pessoal ou criador)<br />
                    • Confirme que está vinculada a uma <strong>Página do Facebook</strong><br />
                    • Verifique se o App tem as permissões de Instagram habilitadas
                  </Typography>

                  <Divider style={{ margin: "16px 0" }} />

                  <Typography variant="h6" gutterBottom>
                    Mensagens não estão chegando
                  </Typography>
                  <Typography variant="body2" paragraph>
                    • Verifique se o Webhook está configurado para Instagram<br />
                    • Confirme que as permissões <strong>instagram_basic</strong> e <strong>instagram_manage_messages</strong> estão ativas<br />
                    • Teste enviando uma mensagem para sua conta
                  </Typography>

                  <Divider style={{ margin: "16px 0" }} />

                  <Typography variant="h6" gutterBottom>
                    Erro "Conta não é Business"
                  </Typography>
                  <Typography variant="body2" paragraph>
                    • Vá nas configurações do Instagram<br />
                    • Converta para conta <strong>Profissional → Empresa</strong><br />
                    • Vincule novamente à Página do Facebook
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

export default InstagramTutorial;
