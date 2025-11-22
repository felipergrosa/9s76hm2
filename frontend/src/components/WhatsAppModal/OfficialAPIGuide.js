import React, { useState } from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Link,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Paper
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
  ExpandMore,
  CheckCircle,
  Warning,
  Info,
  Launch,
  Code,
  Security,
  Phone,
  Business,
  Http,
  Settings,
  PlayArrow
} from "@material-ui/icons";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    marginTop: theme.spacing(2)
  },
  heading: {
    fontSize: theme.typography.pxToRem(15),
    fontWeight: theme.typography.fontWeightMedium,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  accordionDetails: {
    flexDirection: "column",
    gap: theme.spacing(2)
  },
  codeBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.mode === "dark" ? "#1e1e1e" : "#f5f5f5",
    borderRadius: theme.shape.borderRadius,
    fontFamily: "monospace",
    fontSize: "0.85rem",
    overflowX: "auto",
    border: "1px solid",
    borderColor: theme.palette.mode === "dark" ? "#333" : "#ddd"
  },
  warningBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.mode === "dark" ? "#4a3800" : "#fff3e0",
    borderRadius: theme.shape.borderRadius,
    display: "flex",
    gap: theme.spacing(1),
    border: "1px solid #ff9800"
  },
  infoBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.mode === "dark" ? "#1e3a5f" : "#e3f2fd",
    borderRadius: theme.shape.borderRadius,
    display: "flex",
    gap: theme.spacing(1),
    border: "1px solid #2196f3"
  },
  successBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.mode === "dark" ? "#1b5e20" : "#e8f5e9",
    borderRadius: theme.shape.borderRadius,
    display: "flex",
    gap: theme.spacing(1),
    border: "1px solid #4caf50"
  },
  stepNumber: {
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    borderRadius: "50%",
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.875rem",
    fontWeight: "bold",
    marginRight: theme.spacing(1)
  },
  listItem: {
    paddingLeft: 0
  }
}));

const OfficialAPIGuide = () => {
  const classes = useStyles();
  const [expanded, setExpanded] = useState(false);

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box className={classes.root}>
      <Typography variant="h6" gutterBottom>
        📚 Guia Completo de Configuração - WhatsApp Business API Oficial
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Siga este passo a passo para conectar números de produção do WhatsApp Business API (Meta).
        Este guia foi criado com base em problemas reais e suas soluções.
      </Typography>

      <Divider style={{ margin: "16px 0" }} />

      {/* ETAPA 1: Criar Conta no Meta */}
      <Accordion expanded={expanded === "panel1"} onChange={handleChange("panel1")}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography className={classes.heading}>
            <Business color="primary" />
            <span className={classes.stepNumber}>1</span>
            Criar Conta no Meta Business Manager
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={classes.accordionDetails}>
          <Typography variant="body2" paragraph>
            Primeiro, você precisa criar ou acessar sua conta no Meta Business Manager:
          </Typography>

          <List>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Acesse o Meta Business Manager"
                secondary={
                  <Link href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer">
                    https://business.facebook.com/ <Launch fontSize="small" />
                  </Link>
                }
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Crie uma conta Business ou use uma existente"
                secondary="Você precisará vincular uma conta pessoal do Facebook"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Adicione um método de pagamento"
                secondary="Obrigatório para números de produção (primeiras 1.000 conversas/mês são gratuitas)"
              />
            </ListItem>
          </List>

          <Box className={classes.infoBox}>
            <Info color="primary" />
            <Box>
              <Typography variant="body2">
                <strong>Dica:</strong> Certifique-se de que sua conta Business esteja verificada para evitar limitações.
              </Typography>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* ETAPA 2: Criar App e Configurar WhatsApp */}
      <Accordion expanded={expanded === "panel2"} onChange={handleChange("panel2")}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography className={classes.heading}>
            <Settings color="primary" />
            <span className={classes.stepNumber}>2</span>
            Criar App no Meta for Developers
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={classes.accordionDetails}>
          <Typography variant="body2" paragraph>
            Crie um aplicativo para acessar a WhatsApp Cloud API:
          </Typography>

          <List>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Acesse Meta for Developers"
                secondary={
                  <Link href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">
                    https://developers.facebook.com/apps <Launch fontSize="small" />
                  </Link>
                }
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary='Clique em "Criar App"'
                secondary='Escolha tipo: "Business" ou "Outros"'
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Adicione o produto WhatsApp"
                secondary="No painel do app, vá em Adicionar Produto → WhatsApp → Configurar"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Anote o App ID"
                secondary="Você vai precisar para vincular a WABA"
              />
            </ListItem>
          </List>

          <Box className={classes.successBox}>
            <CheckCircle style={{ color: "#4caf50" }} />
            <Box>
              <Typography variant="body2">
                <strong>Pronto!</strong> Seu app agora tem acesso à WhatsApp Cloud API.
              </Typography>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* ETAPA 3: Adicionar Número e Configurar 2FA */}
      <Accordion expanded={expanded === "panel3"} onChange={handleChange("panel3")}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography className={classes.heading}>
            <Phone color="primary" />
            <span className={classes.stepNumber}>3</span>
            Adicionar Número e Configurar 2FA (OBRIGATÓRIO)
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={classes.accordionDetails}>
          <Typography variant="body2" paragraph>
            Configure seu número de telefone na WhatsApp Business Account (WABA):
          </Typography>

          <List>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Acesse o Gestor do WhatsApp"
                secondary={
                  <Link href="https://business.facebook.com/wa/manage/phone-numbers/" target="_blank" rel="noopener noreferrer">
                    https://business.facebook.com/wa/manage/phone-numbers/ <Launch fontSize="small" />
                  </Link>
                }
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Adicione um número de telefone"
                secondary="Siga o processo de verificação via SMS ou chamada"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><Security color="error" /></ListItemIcon>
              <ListItemText
                primary="ATIVE a Verificação de Dois Passos (2FA)"
                secondary="CRÍTICO: Sem isso, o número NÃO vai enviar/receber mensagens em produção!"
              />
            </ListItem>
          </List>

          <Box className={classes.warningBox}>
            <Warning style={{ color: "#ff9800" }} />
            <Box flex={1}>
              <Typography variant="body2" gutterBottom>
                <strong>⚠️ MUITO IMPORTANTE - Configurar 2FA:</strong>
              </Typography>
              <Typography variant="body2">
                1. No Gestor do WhatsApp, clique no número<br />
                2. Vá em <strong>"Verificação de dois passos"</strong><br />
                3. Clique em <strong>"Ativar"</strong><br />
                4. Crie um PIN de <strong>6 dígitos</strong> (ex: 130420)<br />
                5. <strong>GUARDE ESTE PIN!</strong> Você vai precisar dele no Whaticket
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" paragraph style={{ marginTop: 16 }}>
            <strong>Onde encontrar as credenciais:</strong>
          </Typography>

          <Paper variant="outlined" style={{ padding: 16 }}>
            <List dense>
              <ListItem>
                <ListItemIcon><Code fontSize="small" /></ListItemIcon>
                <ListItemText
                  primary="Phone Number ID"
                  secondary="Gestor do WhatsApp → Números → Clique no número → Copie o ID (número longo)"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><Code fontSize="small" /></ListItemIcon>
                <ListItemText
                  primary="Business Account ID (WABA ID)"
                  secondary="Gestor do WhatsApp → Configurações → Procure por 'ID da conta WhatsApp Business'"
                />
              </ListItem>
            </List>
          </Paper>
        </AccordionDetails>
      </Accordion>

      {/* ETAPA 4: Gerar Token de Acesso Permanente */}
      <Accordion expanded={expanded === "panel4"} onChange={handleChange("panel4")}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography className={classes.heading}>
            <Security color="primary" />
            <span className={classes.stepNumber}>4</span>
            Gerar Token de Acesso Permanente (System User)
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={classes.accordionDetails}>
          <Typography variant="body2" paragraph>
            O token temporário expira em 60 dias. Crie um System User para token permanente:
          </Typography>

          <List>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Acesse Meta Business Manager → Configurações"
                secondary={
                  <Link href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer">
                    https://business.facebook.com/settings <Launch fontSize="small" />
                  </Link>
                }
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary='Vá em "Utilizadores" → "Utilizadores do sistema"'
                secondary='(Ou "Users" → "System Users" se estiver em inglês)'
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary='Clique em "Adicionar"'
                secondary='Crie um novo System User com permissão "Admin"'
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary='Clique em "Adicionar recursos"'
                secondary="Atribua o App criado anteriormente com permissão Admin"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary='Clique em "Gerar novo token"'
                secondary="Selecione o App, marque as permissões: whatsapp_business_management, whatsapp_business_messaging"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Atribua WABA ao System User"
                secondary="Volte em Utilizadores do sistema → Seu user → Adicionar recursos → WhatsApp Accounts → Selecione sua WABA"
              />
            </ListItem>
          </List>

          <Box className={classes.warningBox}>
            <Warning style={{ color: "#ff9800" }} />
            <Box>
              <Typography variant="body2">
                <strong>⚠️ Importante:</strong> Copie e salve o token em local seguro. Ele não será mostrado novamente!
              </Typography>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* ETAPA 5: Configurar Webhook */}
      <Accordion expanded={expanded === "panel5"} onChange={handleChange("panel5")}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography className={classes.heading}>
            <Http color="primary" />
            <span className={classes.stepNumber}>5</span>
            Configurar Webhook (CRÍTICO para receber mensagens)
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={classes.accordionDetails}>
          <Typography variant="body2" paragraph>
            Configure o webhook para que o Meta envie as mensagens para o Whaticket:
          </Typography>

          <List>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="No Meta for Developers, vá no seu App"
                secondary="WhatsApp → Configuration → Webhooks"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary='Clique em "Edit" na Callback URL'
                secondary="Cole a URL do Whaticket (será mostrada no modal abaixo)"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Cole o Verify Token"
                secondary="Use o mesmo token que você vai configurar no Whaticket"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary='Clique em "Verify and save"'
                secondary="O Meta vai testar a conexão com seu servidor"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Subscribe aos eventos"
                secondary="Marque: messages e message_status"
              />
            </ListItem>
          </List>

          <Box className={classes.infoBox}>
            <Info color="primary" />
            <Box>
              <Typography variant="body2">
                <strong>Dica:</strong> Se o webhook não verificar, confira se seu servidor está acessível publicamente (não localhost) e se o Verify Token está correto.
              </Typography>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* ETAPA 6: Configurar no Whaticket */}
      <Accordion expanded={expanded === "panel6"} onChange={handleChange("panel6")}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography className={classes.heading}>
            <PlayArrow color="primary" />
            <span className={classes.stepNumber}>6</span>
            Configurar no Whaticket (AUTOMATIZADO!)
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={classes.accordionDetails}>
          <Typography variant="body2" paragraph>
            Preencha os campos abaixo neste modal:
          </Typography>

          <List>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Nome da Conexão"
                secondary="Ex: WhatsApp Oficial - Atendimento"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Tipo de Canal: WhatsApp Business API Oficial"
                secondary="Selecione no dropdown"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Phone Number ID"
                secondary="Copie do Gestor do WhatsApp (número longo)"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Business Account ID"
                secondary="ID da WABA (também no Gestor)"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Access Token"
                secondary="Token permanente do System User"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><CheckCircle color="primary" /></ListItemIcon>
              <ListItemText
                primary="Webhook Verify Token"
                secondary="Crie um valor único (ex: meutoken12345)"
              />
            </ListItem>
            <ListItem className={classes.listItem}>
              <ListItemIcon><Security color="error" /></ListItemIcon>
              <ListItemText
                primary="PIN 2FA (6 dígitos)"
                secondary="O PIN que você configurou na Verificação de Dois Passos (OBRIGATÓRIO!)"
              />
            </ListItem>
          </List>

          <Box className={classes.successBox}>
            <CheckCircle style={{ color: "#4caf50" }} />
            <Box flex={1}>
              <Typography variant="body2" gutterBottom>
                <strong>🎉 Automação Ativada!</strong>
              </Typography>
              <Typography variant="body2">
                Quando você clicar em <strong>Salvar</strong>, o Whaticket vai automaticamente:<br />
                ✅ Buscar dados do número na Meta<br />
                ✅ Subscrever a WABA ao app (habilitar webhooks para produção)<br />
                ✅ Registrar o número com PIN 2FA (ativar envio/recebimento)<br />
                ✅ Atualizar todas as informações no banco de dados
              </Typography>
            </Box>
          </Box>

          <Box className={classes.warningBox} style={{ marginTop: 16 }}>
            <Warning style={{ color: "#ff9800" }} />
            <Box>
              <Typography variant="body2">
                <strong>⚠️ Sem o PIN 2FA:</strong> O número vai conectar, mas NÃO vai enviar nem receber mensagens em produção!
              </Typography>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* ETAPA 7: Troubleshooting */}
      <Accordion expanded={expanded === "panel7"} onChange={handleChange("panel7")}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography className={classes.heading}>
            <Warning color="secondary" />
            <span className={classes.stepNumber}>7</span>
            Resolução de Problemas Comuns
          </Typography>
        </AccordionSummary>
        <AccordionDetails className={classes.accordionDetails}>
          <Typography variant="body2" paragraph>
            <strong>Problema: Webhook não recebe mensagens do número live</strong>
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>Solução:</strong> Certifique-se de que:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="✅ A WABA está subscrita ao app (isso agora é automático!)" />
            </ListItem>
            <ListItem>
              <ListItemText primary="✅ O número tem 2FA ativado e o PIN está correto no Whaticket" />
            </ListItem>
            <ListItem>
              <ListItemText primary="✅ O webhook está configurado no Meta com os eventos 'messages' e 'message_status'" />
            </ListItem>
            <ListItem>
              <ListItemText primary="✅ O System User tem permissão Admin na WABA" />
            </ListItem>
          </List>

          <Divider style={{ margin: "16px 0" }} />

          <Typography variant="body2" paragraph>
            <strong>Problema: Erro 131000 ao enviar mensagens</strong>
          </Typography>
          <Typography variant="body2">
            <strong>Causa:</strong> Número não registrado com 2FA ou PIN incorreto<br />
            <strong>Solução:</strong> Verifique o PIN 2FA no Gestor do WhatsApp e atualize no Whaticket
          </Typography>

          <Divider style={{ margin: "16px 0" }} />

          <Typography variant="body2" paragraph>
            <strong>Problema: Token expira após 60 dias</strong>
          </Typography>
          <Typography variant="body2">
            <strong>Solução:</strong> Use um System User (etapa 4) em vez do token temporário
          </Typography>

          <Divider style={{ margin: "16px 0" }} />

          <Typography variant="body2" paragraph>
            <strong>Links Úteis:</strong>
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><Launch fontSize="small" /></ListItemIcon>
              <ListItemText>
                <Link href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank">
                  Documentação Oficial da Meta
                </Link>
              </ListItemText>
            </ListItem>
            <ListItem>
              <ListItemIcon><Launch fontSize="small" /></ListItemIcon>
              <ListItemText>
                <Link href="https://business.facebook.com/wa/manage/home" target="_blank">
                  Gestor do WhatsApp
                </Link>
              </ListItemText>
            </ListItem>
            <ListItem>
              <ListItemIcon><Launch fontSize="small" /></ListItemIcon>
              <ListItemText>
                <Link href="https://developers.facebook.com/docs/whatsapp/pricing" target="_blank">
                  Preços do WhatsApp Cloud API
                </Link>
              </ListItemText>
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>

      {/* Footer com dica */}
      <Box className={classes.infoBox} style={{ marginTop: 16 }}>
        <Info color="primary" />
        <Box>
          <Typography variant="body2">
            <strong>💡 Dica Final:</strong> Após salvar a conexão, verifique os logs do backend para confirmar que tudo foi configurado automaticamente. Procure por mensagens como:<br />
            <code>[OfficialAPI] WABA subscrita ao app com sucesso</code><br />
            <code>[OfficialAPI] Número registrado com PIN 2FA com sucesso</code>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default OfficialAPIGuide;
