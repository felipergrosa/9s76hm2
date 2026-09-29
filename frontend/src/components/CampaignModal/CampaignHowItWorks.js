import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Box,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider,
  Chip,
} from "@material-ui/core";
import {
  Send as SendIcon,
  Inbox as InboxIcon,
  Person as PersonIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
} from "@material-ui/icons";
import { Bot as BotIcon } from "lucide-react";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    maxHeight: "calc(100vh - 200px)",
    overflowY: "auto",
  },
  section: {
    marginBottom: theme.spacing(3),
  },
  sectionTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  flowContainer: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(1),
  },
  flowBox: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    textAlign: "center",
    marginBottom: theme.spacing(1),
  },
  flowArrow: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    fontSize: "1.5rem",
    margin: theme.spacing(0.5, 0),
  },
  statusChip: {
    margin: theme.spacing(0.5),
  },
  infoBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.info.light + "20",
    borderLeft: `4px solid ${theme.palette.info.main}`,
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
  },
  warningBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.warning.light + "20",
    borderLeft: `4px solid ${theme.palette.warning.main}`,
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
  },
  stepIcon: {
    marginRight: theme.spacing(1),
  },
  diagramContainer: {
    fontFamily: "monospace",
    fontSize: "12px",
    backgroundColor: "#1e1e1e",
    color: "#d4d4d4",
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    overflowX: "auto",
    whiteSpace: "pre",
    lineHeight: 1.4,
  },
  tabBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 12px",
    borderRadius: "16px",
    fontSize: "0.85rem",
    fontWeight: 500,
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  },
  tabCampaign: {
    backgroundColor: "#e3f2fd",
    color: "#1565c0",
  },
  tabBot: {
    backgroundColor: "#fff3e0",
    color: "#e65100",
  },
  tabPending: {
    backgroundColor: "#fff8e1",
    color: "#f57f17",
  },
  tabOpen: {
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
  },
}));

const CampaignHowItWorks = () => {
  const classes = useStyles();

  const flowDiagram = `
┌─────────────────────────────────────────────────────────────────┐
│                    DISPARO DE CAMPANHA                          │
│                  (Baileys ou API Oficial)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ Já existe ticket ABERTO para  │
              │ este contato?                 │
              └───────────────────────────────┘
                    │               │
                   SIM             NÃO
                    │               │
                    ▼               ▼
        ┌─────────────────┐  ┌─────────────────────┐
        │ REUSAR ticket   │  │ CRIAR ticket com    │
        │ ABERTO existente│  │ status="campaign"   │
        │ (apenas registra│  │ (aba Campanha)      │
        │  a mensagem)    │  └─────────────────────┘
        └─────────────────┘              │
                    │                    │
                    └────────┬───────────┘
                             │
                             ▼
              ┌───────────────────────────────┐
              │ CLIENTE RESPONDE              │
              └───────────────────────────────┘
                             │
                             ▼
              ┌───────────────────────────────┐
              │ Fila tem BOT/RAG?             │
              └───────────────────────────────┘
                    │               │
                   SIM             NÃO
                    │               │
                    ▼               ▼
        ┌─────────────────┐  ┌─────────────────────┐
        │ status="bot"    │  │ status="pending"    │
        │ (aba Bot)       │  │ (aba Aguardando)    │
        └─────────────────┘  └─────────────────────┘
`;

  return (
    <Box className={classes.root}>
      {/* Título */}
      <Typography variant="h5" gutterBottom style={{ fontWeight: 600 }}>
        📚 Como Funciona o Disparo de Campanhas
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Entenda o fluxo completo desde o disparo até o atendimento do cliente.
      </Typography>

      <Divider style={{ margin: "16px 0" }} />

      {/* Seção 1: Visão Geral */}
      <Box className={classes.section}>
        <Typography variant="h6" className={classes.sectionTitle}>
          <InfoIcon color="primary" /> Visão Geral
        </Typography>
        <Typography variant="body2" paragraph>
          Quando uma campanha é disparada, o sistema cria automaticamente um <strong>"ticket sombra"</strong> com 
          status <Chip size="small" label="campaign" className={`${classes.tabBadge} ${classes.tabCampaign}`} /> 
          para cada contato. Este ticket fica visível apenas na aba <strong>Campanha</strong> e não aparece 
          nas abas de atendimento até que o cliente responda.
        </Typography>
      </Box>

      {/* Seção 2: Fluxograma */}
      <Box className={classes.section}>
        <Typography variant="h6" className={classes.sectionTitle}>
          🔄 Fluxograma do Disparo
        </Typography>
        <Paper elevation={0} className={classes.flowContainer}>
          <pre className={classes.diagramContainer}>{flowDiagram}</pre>
        </Paper>
      </Box>

      {/* Seção 3: Passo a Passo */}
      <Box className={classes.section}>
        <Typography variant="h6" className={classes.sectionTitle}>
          📋 Passo a Passo Detalhado
        </Typography>
        
        <Stepper orientation="vertical" style={{ backgroundColor: "transparent" }}>
          <Step active expanded>
            <StepLabel>
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                1. Disparo da Campanha
              </Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2">
                Ao iniciar a campanha, o sistema processa cada contato da lista selecionada.
                Para cada contato, verifica se já existe um ticket <strong>aberto</strong> (status "open").
              </Typography>
              <Box className={classes.infoBox} style={{ marginTop: 8 }}>
                <Typography variant="body2">
                  <strong>💡 Dica:</strong> Se o contato já tem um ticket aberto em atendimento, 
                  a mensagem da campanha é enviada nesse ticket existente, sem criar um novo.
                </Typography>
              </Box>
            </StepContent>
          </Step>

          <Step active expanded>
            <StepLabel>
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                2. Criação do Ticket "Campanha"
              </Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2">
                Se não existe ticket aberto, o sistema cria um novo ticket com:
              </Typography>
              <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                <li><strong>Status:</strong> <Chip size="small" label="campaign" className={`${classes.tabBadge} ${classes.tabCampaign}`} /></li>
                <li><strong>Fila:</strong> A fila configurada na campanha</li>
                <li><strong>Usuário (Carteira):</strong> Baseado nas tags do contato</li>
              </ul>
              <Typography variant="body2">
                O ticket aparece na aba <strong>"Campanha"</strong> do painel de tickets.
              </Typography>
            </StepContent>
          </Step>

          <Step active expanded>
            <StepLabel>
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                3. Cliente Responde
              </Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2">
                Quando o cliente responde à mensagem da campanha, o sistema verifica 
                se a fila tem um <strong>Bot/RAG</strong> configurado:
              </Typography>
              <Box style={{ marginTop: 12 }}>
                <Typography variant="body2" style={{ marginBottom: 8 }}>
                  <strong>Se a fila TEM Bot/RAG:</strong>
                </Typography>
                <Box style={{ paddingLeft: 16 }}>
                  <Chip size="small" label="campaign" className={`${classes.tabBadge} ${classes.tabCampaign}`} />
                  <span style={{ margin: "0 8px" }}>→</span>
                  <Chip size="small" label="bot" className={`${classes.tabBadge} ${classes.tabBot}`} />
                  <Typography variant="caption" display="block" style={{ marginTop: 4 }}>
                    O ticket vai para a aba <strong>Bot</strong> e o chatbot/IA assume o atendimento.
                  </Typography>
                </Box>
              </Box>
              <Box style={{ marginTop: 12 }}>
                <Typography variant="body2" style={{ marginBottom: 8 }}>
                  <strong>Se a fila NÃO tem Bot/RAG:</strong>
                </Typography>
                <Box style={{ paddingLeft: 16 }}>
                  <Chip size="small" label="campaign" className={`${classes.tabBadge} ${classes.tabCampaign}`} />
                  <span style={{ margin: "0 8px" }}>→</span>
                  <Chip size="small" label="pending" className={`${classes.tabBadge} ${classes.tabPending}`} />
                  <Typography variant="caption" display="block" style={{ marginTop: 4 }}>
                    O ticket vai para a aba <strong>Aguardando</strong> para atendimento humano.
                  </Typography>
                </Box>
              </Box>
            </StepContent>
          </Step>

          <Step active expanded>
            <StepLabel>
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                4. Atendimento
              </Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2">
                O atendente pode então aceitar o ticket da aba <strong>Aguardando</strong> ou 
                o Bot pode transferir para um humano quando necessário.
              </Typography>
              <Box style={{ marginTop: 8 }}>
                <Chip size="small" label="pending" className={`${classes.tabBadge} ${classes.tabPending}`} />
                <span style={{ margin: "0 8px" }}>→</span>
                <Chip size="small" label="open" className={`${classes.tabBadge} ${classes.tabOpen}`} />
                <Typography variant="caption" display="block" style={{ marginTop: 4 }}>
                  Ao aceitar, o ticket vai para a aba <strong>Atendendo</strong>.
                </Typography>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </Box>

      {/* Seção 4: Carteiras */}
      <Box className={classes.section}>
        <Typography variant="h6" className={classes.sectionTitle}>
          👥 Distribuição por Carteiras
        </Typography>
        <Typography variant="body2" paragraph>
          Se você configurar múltiplos usuários na campanha, o sistema distribui os tickets 
          automaticamente baseado nas <strong>tags dos contatos</strong>:
        </Typography>
        <ol style={{ margin: "8px 0", paddingLeft: 20 }}>
          <li>O sistema busca as tags associadas ao contato</li>
          <li>Compara com as tags dos usuários selecionados na campanha</li>
          <li>Atribui o ticket ao usuário que tem a tag correspondente</li>
          <li>Se não houver match, o ticket fica sem usuário específico (visível a todos)</li>
        </ol>
        <Box className={classes.infoBox}>
          <Typography variant="body2">
            <strong>💡 Exemplo:</strong> Se o contato tem a tag "Região Sul" e o usuário João 
            também tem essa tag, o ticket será atribuído automaticamente ao João.
          </Typography>
        </Box>
      </Box>

      {/* Seção 5: Abas do Sistema */}
      <Box className={classes.section}>
        <Typography variant="h6" className={classes.sectionTitle}>
          📑 Abas do Sistema de Tickets
        </Typography>
        <Box style={{ marginTop: 8 }}>
          <Box style={{ marginBottom: 12 }}>
            <Chip size="small" label="Campanha" className={`${classes.tabBadge} ${classes.tabCampaign}`} />
            <Typography variant="body2" component="span">
              Tickets criados por campanhas que ainda não receberam resposta do cliente.
            </Typography>
          </Box>
          <Box style={{ marginBottom: 12 }}>
            <Chip size="small" label="Bot" className={`${classes.tabBadge} ${classes.tabBot}`} />
            <Typography variant="body2" component="span">
              Tickets sendo atendidos pelo chatbot/IA (fila com Bot/RAG configurado).
            </Typography>
          </Box>
          <Box style={{ marginBottom: 12 }}>
            <Chip size="small" label="Aguardando" className={`${classes.tabBadge} ${classes.tabPending}`} />
            <Typography variant="body2" component="span">
              Tickets aguardando um atendente humano aceitar.
            </Typography>
          </Box>
          <Box style={{ marginBottom: 12 }}>
            <Chip size="small" label="Atendendo" className={`${classes.tabBadge} ${classes.tabOpen}`} />
            <Typography variant="body2" component="span">
              Tickets em atendimento ativo por um usuário.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Seção 6: Dicas Importantes */}
      <Box className={classes.section}>
        <Typography variant="h6" className={classes.sectionTitle}>
          ⚠️ Dicas Importantes
        </Typography>
        <Box className={classes.warningBox}>
          <Typography variant="body2" paragraph>
            <strong>1. Ticket Aberto Existente:</strong> Se o contato já tem um ticket aberto (em atendimento), 
            a campanha NÃO cria um novo ticket. A mensagem é enviada no ticket existente.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>2. Conexão Baileys vs API Oficial:</strong> O fluxo é idêntico para ambos os tipos de conexão. 
            A única diferença é que a API Oficial requer um template Meta aprovado.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>3. Fila com Bot:</strong> Se a fila da campanha tem um Bot/RAG configurado, 
            o cliente será atendido automaticamente pelo bot quando responder.
          </Typography>
          <Typography variant="body2">
            <strong>4. Carteiras:</strong> Para a distribuição por carteiras funcionar, 
            certifique-se de que os contatos e usuários tenham tags correspondentes.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default CampaignHowItWorks;
