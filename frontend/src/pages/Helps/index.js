import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  makeStyles,
  Paper,
  Typography,
  Modal,
  Tooltip,
  Divider,
  Box,
} from "@material-ui/core";
import {
  Assignment,
  QuestionAnswer,
  ViewModule,
  Contacts,
  Event,
  Label,
  Forum,
  SpeakerPhone,
  Memory as AIIcon,
  Dashboard,
  Settings,
  PhoneAndroid,
  Extension,
  Code,
  Folder,
  List as ListIcon,
  Assessment,
  AttachMoney,
  RecordVoiceOver,
  Facebook,
  Instagram,
  Chat as WebChatIcon,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import useHelps from "../../hooks/useHelps";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { LifeBuoy, Youtube, Link2, BookOpen } from "lucide-react";
import StatCard from "../../components/bento/StatCard";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(3),
  },
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
    fontWeight: 600,
    color: theme.palette.primary.main,
  },
  videoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(4),
  },
  videoCard: {
    cursor: "pointer",
    transition: "transform 0.2s, box-shadow 0.2s",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: theme.shadows[4],
    },
  },
  videoThumbnail: {
    width: "100%",
    height: "180px",
    objectFit: "cover",
  },
  tutorialGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: theme.spacing(1.5),
  },
  tutorialButton: {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    textDecoration: "none",
    color: "inherit",
    border: `2px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(1),
    transition: "all 0.2s",
    cursor: "pointer",
    backgroundColor: theme.palette.background.paper,
    "&:hover": {
      borderColor: theme.palette.primary.main,
      backgroundColor: theme.palette.action.hover,
      transform: "translateY(-2px)",
      boxShadow: theme.shadows[2],
    },
  },
  tutorialIcon: {
    "& svg": {
      fontSize: 40,
    },
  },
  tutorialLabel: {
    fontSize: "0.75rem",
    fontWeight: 500,
    textAlign: "center",
  },
  videoModal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  videoModalContent: {
    outline: "none",
    width: "90%",
    maxWidth: 1024,
    aspectRatio: "16/9",
    position: "relative",
    backgroundColor: "white",
    borderRadius: theme.spacing(1),
    overflow: "hidden",
  },
}));

// Lista estática de tutoriais interativos — fora do componente para servir de
// base estável aos KPIs do strip bento (useMemo depende só de `records`)
const TUTORIALS = [
  { icon: <AIIcon />, label: "Manual de IA", path: "/helps/ai-tutorial", tooltip: "Guia completo de IA, RAG, Skills e configurações de prompts" },
  { icon: <AIIcon />, label: "Bot Avançado", path: "/helps/bot-tutorial", tooltip: "Automação avançada com ações e function calling" },
  { icon: <AIIcon />, label: "Skills IA", path: "/helps/ai-tutorial", tooltip: "Sistema de skills padronizadas para AI Agents" },
  { icon: <Dashboard />, label: "Dashboard", path: "/helps/dashboard", tooltip: "Visão geral e principais indicadores do sistema" },
  { icon: <Assignment />, label: "Atendimentos", path: "/helps/atendimentos", tooltip: "Gestão de tickets e conversas" },
  { icon: <QuestionAnswer />, label: "Respostas Rápidas", path: "/helps/respostas-rapidas", tooltip: "Mensagens prontas para agilizar atendimento" },
  { icon: <ViewModule />, label: "Kanban", path: "/helps/kanban", tooltip: "Organize tickets por etapas visuais" },
  { icon: <Contacts />, label: "Contatos", path: "/helps/contatos", tooltip: "Gerencie sua base de contatos" },
  { icon: <Event />, label: "Agendamentos", path: "/helps/agendamentos", tooltip: "Agende mensagens e tarefas" },
  { icon: <Label />, label: "Tags", path: "/helps/tags", tooltip: "Organize e categorize com etiquetas" },
  { icon: <Forum />, label: "Chat Interno", path: "/helps/chat-interno", tooltip: "Comunicação entre a equipe" },
  { icon: <SpeakerPhone />, label: "Campanhas", path: "/helps/campanhas", tooltip: "Envio de mensagens em massa" },
  { icon: <Extension />, label: "FlowBuilder", path: "/helps/flowbuilder", tooltip: "Construtor visual de fluxos" },
  { icon: <Folder />, label: "Arquivos Chatbot", path: "/helps/arquivos-chatbot", tooltip: "Gerencie arquivos do  bot" },
  { icon: <ListIcon />, label: "Fila Chatbot", path: "/helps/fila-chatbot", tooltip: "Configure filas de atendimento" },
  { icon: <PhoneAndroid />, label: "Conexões WhatsApp", path: "/helps/conexoes-whatsapp", tooltip: "Conecte contas do WhatsApp" },
  { icon: <Facebook style={{ color: "#3b5998" }} />, label: "Facebook Messenger", path: "/helps/facebook", tooltip: "Conecte páginas do Facebook" },
  { icon: <Instagram style={{ color: "#e1306c" }} />, label: "Instagram Direct", path: "/helps/instagram", tooltip: "Conecte contas do Instagram" },
  { icon: <WebChatIcon style={{ color: "#6B46C1" }} />, label: "WebChat", path: "/helps/webchat", tooltip: "Widget de chat para seu site" },
  { icon: <Extension />, label: "Integrações", path: "/helps/integracoes", tooltip: "Integre com sistemas externos" },
  { icon: <Code />, label: "API", path: "/helps/api", tooltip: "Documentação da API REST" },
  { icon: <AIIcon />, label: "Prompts de IA", path: "/helps/prompts-ia", tooltip: "Configure prompts personalizados" },
  { icon: <Settings />, label: "Configurações", path: "/helps/configuracoes", tooltip: "Ajustes gerais do sistema" },
  { icon: <RecordVoiceOver />, label: "Usuários", path: "/helps/usuarios", tooltip: "Gerencie equipe e permissões" },
  { icon: <Assessment />, label: "Relatórios", path: "/helps/relatorios", tooltip: "Análises e métricas detalhadas" },
  { icon: <ListIcon />, label: "Listas de Contatos", path: "/helps/listas-contatos", tooltip: "Listas segmentadas para campanhas" },
  { icon: <AttachMoney />, label: "Financeiro", path: "/helps/financeiro", tooltip: "Gestão de cobranças e pagamentos" },
];

const Helps = () => {
  const classes = useStyles();
  const [records, setRecords] = useState([]);
  const { list } = useHelps();
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  useEffect(() => {
    async function fetchData() {
      try {
        const helps = await list();
        setRecords(helps);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // KPIs do strip bento — derivados dos registros já carregados + tutoriais estáticos
  const helpStats = useMemo(() => ({
    total: records.length + TUTORIALS.length,
    videos: records.length,
    withLink: records.filter((r) => r.link).length,
    tutorialsCount: TUTORIALS.length,
  }), [records]);

  const openVideoModal = (video) => {
    setSelectedVideo(video);
  };

  const closeVideoModal = () => {
    setSelectedVideo(null);
  };

  const handleModalClose = useCallback((event) => {
    if (event.key === "Escape") {
      closeVideoModal();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleModalClose);
    return () => {
      document.removeEventListener("keydown", handleModalClose);
    };
  }, [handleModalClose]);

  const renderVideoModal = () => {
    return (
      <Modal
        open={Boolean(selectedVideo)}
        onClose={closeVideoModal}
        className={classes.videoModal}
      >
        <div className={classes.videoModalContent}>
          {selectedVideo && (
            <iframe
              style={{
                width: "100%",
                height: "100%",
                position: "absolute",
                top: 0,
                left: 0,
              }}
              src={`https://www.youtube.com/embed/${selectedVideo}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </Modal>
    );
  };

  return (
    <MainContainer useWindowScroll>
      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
      >
        {/* Strip de KPIs bento — vídeos, links e tutoriais disponíveis */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Materiais de ajuda" value={helpStats.total} icon={<LifeBuoy size={20} />} accent="var(--primary-color)" loading={loading} />
          <StatCard label="Tutoriais em vídeo" value={helpStats.videos} icon={<Youtube size={20} />} accent="#e7505a" loading={loading} />
          <StatCard label="Com link externo" value={helpStats.withLink} icon={<Link2 size={20} />} accent="#3598dc" loading={loading} />
          <StatCard label="Tutoriais interativos" value={helpStats.tutorialsCount} icon={<BookOpen size={20} />} accent="#8e44ad" loading={loading} />
        </div>

      <motion.div variants={itemVariant} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Paper className={`${classes.mainPaper} bento-panel`} variant="outlined">
        <Box>
          <Typography variant="h5" gutterBottom>
            Bem-vindo à Central de Ajuda! 📚
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Explore nossos tutoriais e vídeos para dominar todas as funcionalidades do sistema.
          </Typography>
        </Box>

        {/* Seção de Vídeos */}
        {records && records.length > 0 && (
          <>
            <Divider style={{ margin: "24px 0" }} />
            <Typography variant="h6" className={classes.sectionTitle}>
              🎥 Tutoriais em Vídeo
            </Typography>
            <div className={classes.videoGrid}>
              {records.map((record, key) => (
                <Paper
                  key={key}
                  component={motion.div}
                  variants={itemVariant}
                  className={classes.videoCard}
                  onClick={() => openVideoModal(record.video)}
                  elevation={2}
                >
                  <img
                    src={`https://img.youtube.com/vi/${record.video}/mqdefault.jpg`}
                    alt={record.title}
                    className={classes.videoThumbnail}
                  />
                  <Box p={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      {record.title}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {record.description}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </div>
          </>
        )}

        {/* Seção de Tutoriais Interativos */}
        <Divider style={{ margin: "24px 0" }} />
        <Typography variant="h6" className={classes.sectionTitle}>
          📖 Tutoriais Interativos
        </Typography>
        <div className={classes.tutorialGrid}>
          {TUTORIALS.map((tutorial, index) => (
            <Tooltip key={index} title={tutorial.tooltip} arrow placement="top">
              <Paper
                component={Link}
                to={tutorial.path}
                className={classes.tutorialButton}
                elevation={0}
              >
                <div className={classes.tutorialIcon} style={{ color: "#3f51b5" }}>
                  {tutorial.icon}
                </div>
                <Typography className={classes.tutorialLabel}>
                  {tutorial.label}
                </Typography>
              </Paper>
            </Tooltip>
          ))}
        </div>
      </Paper>
      </motion.div>
      </motion.div>

      {renderVideoModal()}
    </MainContainer>
  );
};

export default Helps;
