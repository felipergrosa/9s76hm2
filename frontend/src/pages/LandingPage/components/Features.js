import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography, Grid, Box, Card, CardContent } from "@material-ui/core";
import ChatIcon from "@material-ui/icons/Chat";
import SettingsIcon from "@material-ui/icons/Settings";
import SendIcon from "@material-ui/icons/Send";
import MemoryIcon from "@material-ui/icons/Memory";
import AssessmentIcon from "@material-ui/icons/Assessment";
import DeviceHubIcon from "@material-ui/icons/DeviceHub";

const useStyles = makeStyles((theme) => ({
  sectionTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(1),
    textAlign: "center",
  },
  sectionSubtitle: {
    textAlign: "center",
    marginBottom: theme.spacing(6),
    color: theme.palette.text.secondary,
  },
  featureCard: {
    height: "100%",
    padding: theme.spacing(3),
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    "&:hover": {
      transform: "translateY(-5px)",
      boxShadow: theme.shadows[8],
    },
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(2),
    },
  },
  featureIcon: {
    fontSize: "3rem",
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down("xs")]: {
      fontSize: "2.5rem",
    },
  },
  featureTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
    [theme.breakpoints.down("xs")]: {
      fontSize: "1.1rem",
    },
  },
  featureDescription: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.9rem",
    },
  },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  featureListItem: {
    padding: theme.spacing(0.5, 0),
    color: theme.palette.text.secondary,
    "&:before": {
      content: '"✓ "',
      color: theme.palette.primary.main,
      fontWeight: "bold",
      marginRight: theme.spacing(1),
    },
  },
}));

const features = [
  {
    icon: <ChatIcon />,
    title: "Atendimento Omnichannel",
    description: "Centralize todas as conversas em uma única plataforma",
    items: [
      "Tickets em tempo real com múltiplas filas",
      "Chat unificado com histórico completo",
      "Transferências e roteamento inteligente",
      "Organização Kanban para gestão visual",
    ],
  },
  {
    icon: <SettingsIcon />,
    title: "Conexões WhatsApp",
    description: "Dual Channel Support - Baileys e API Oficial",
    items: [
      "Múltiplas conexões simultâneas",
      "Monitoramento de status em tempo real",
      "Sistema anti-ban inteligente",
      "Uptime 99.9% com API Oficial",
    ],
  },
  {
    icon: <SendIcon />,
    title: "Campanhas e Automação",
    description: "Crie e gerencie campanhas segmentadas",
    items: [
      "Campanhas segmentadas por perfil",
      "Flow Builder visual para jornadas",
      "Controle de cadência inteligente",
      "Agendamento de mensagens",
    ],
  },
  {
    icon: <MemoryIcon />,
    title: "Inteligência Artificial",
    description: "Automação inteligente com IA integrada",
    items: [
      "Assistentes virtuais com IA",
      "RAG (Retrieval Augmented Generation)",
      "Automação de respostas",
      "Transcrição de áudio",
    ],
  },
  {
    icon: <AssessmentIcon />,
    title: "Gestão e Relatórios",
    description: "Dashboards e métricas completas",
    items: [
      "Dashboards executivos",
      "Relatórios detalhados",
      "Métricas operacionais",
      "Multi-empresa nativo",
    ],
  },
  {
    icon: <DeviceHubIcon />,
    title: "Integrações",
    description: "Conecte com seus sistemas existentes",
    items: [
      "APIs REST completas",
      "Webhooks em tempo real",
      "Integração com Typebot",
      "Integração com sistemas externos",
    ],
  },
];

const Features = () => {
  const classes = useStyles();

  return (
    <Box>
      <Typography variant="h2" className={classes.sectionTitle}>
        Funcionalidades Completas
      </Typography>
      <Typography variant="h6" className={classes.sectionSubtitle}>
        Tudo que você precisa para transformar seu atendimento
      </Typography>
      <Grid container spacing={4}>
        {features.map((feature, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card className={classes.featureCard} variant="outlined">
              <CardContent>
                <Box className={classes.featureIcon}>{feature.icon}</Box>
                <Typography variant="h5" className={classes.featureTitle}>
                  {feature.title}
                </Typography>
                <Typography variant="body1" className={classes.featureDescription}>
                  {feature.description}
                </Typography>
                <ul className={classes.featureList}>
                  {feature.items.map((item, itemIndex) => (
                    <li key={itemIndex} className={classes.featureListItem}>
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Features;

