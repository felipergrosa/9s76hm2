import React, { useState, useEffect, useCallback } from "react";
import { makeStyles, Paper, Typography, Modal, IconButton, Button } from "@material-ui/core";
import { Link } from "react-router-dom";
import {
  EmojiObjects as AIIcon,
  Dashboard,
  Assignment,
  QuestionAnswer,
  ViewModule,
  Contacts,
  Event,
  Label,
  Forum,
  SpeakerPhone,
  AccountTree,
  People,
  Assessment,
  Code,
  Folder,
  Settings,
  PhoneAndroid,
  List,
  AttachMoney,
  Announcement,
  Psychology
} from "@material-ui/icons";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import useHelps from "../../hooks/useHelps";

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    width: '100%',
    alignItems: 'stretch',
    padding: '16px',
    background: theme.palette.background.default,
  },
  mainPaperContainer: {
    flex: 1,
    overflow: 'visible',
    padding: 0,
    background: 'transparent',
    boxSizing: 'border-box',
  },
  mainPaper: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(1.5),
    padding: 0,
    margin: 0,
  },
  helpPaper: {
    position: 'relative',
    width: '100%',
    minHeight: 220,
    aspectRatio: '1 / 1',
    padding: theme.spacing(1.25),
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    backgroundColor: '#fafafa',
    border: '1px solid rgba(0,0,0,0.05)',
    transition: 'all 0.2s ease',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardDescription: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: theme.spacing(2),
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    borderRadius: 12,
    opacity: 0,
    visibility: 'hidden',
    transition: 'opacity 0.2s ease',
    zIndex: 2,
  },
  helpPaperHover: {
    '&:hover $cardDescription': {
      opacity: 1,
      visibility: 'visible',
    }
  },
  paperHover: {
    transition: 'transform 0.3s, box-shadow 0.3s',
    '&:hover': {
      transform: 'scale(1.03)',
      boxShadow: `0 0 8px`,
      color: theme.palette.primary.main,
    },
  },
  videoThumbnail: {
    width: '100%',
    height: 'calc(100% - 56px)',
    objectFit: 'cover',
    borderRadius: `${theme.spacing(1)}px ${theme.spacing(1)}px 0 0`,
  },
  videoTitle: {
    marginTop: theme.spacing(1),
    flex: 1,
  },
  videoDescription: {
    maxHeight: '100px',
    overflow: 'hidden',
  },
  videoModal: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoModalContent: {
    outline: 'none',
    width: '90%',
    maxWidth: 1024,
    aspectRatio: '16/9',
    position: 'relative',
    backgroundColor: 'white',
    borderRadius: theme.spacing(1),
    overflow: 'hidden',
  },
  aiTutorialCard: {
    position: 'relative',
    width: '100%',
    minHeight: '340px',
    padding: theme.spacing(2),
    boxShadow: theme.shadows[3],
    borderRadius: theme.spacing(1),
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    maxWidth: '340px',
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.contrastText,
  },
  aiTutorialIcon: {
    fontSize: '4rem',
    marginBottom: theme.spacing(2),
  },
  aiTutorialButton: {
    marginTop: theme.spacing(2),
    backgroundColor: theme.palette.common.white,
    color: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.grey[100],
    },
  },
}));

const Helps = () => {
  const classes = useStyles();
  const [records, setRecords] = useState([]);
  const { list } = useHelps();
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const helps = await list();
      setRecords(helps);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
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
              <Typography variant="subtitle1" align="center" style={{fontWeight:600,marginBottom:4}}>Dashboard</Typography>
              <Typography variant="caption" align="center" className={classes.cardDescription}>Visão geral do sistema e principais indicadores.</Typography>
              <Button variant="outlined" color="primary" size="small" style={{fontSize:'0.7rem',padding:'4px 12px'}}>Acessar Manual</Button>
            </div >
          </Paper >
          <Paper className={`${classes.helpPaper} ${classes.helpPaperHover}`}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:'12px'}}>
              <Assignment style={{fontSize:36,color:'#a5d6a7',marginBottom:8}} />
              <Typography variant="subtitle1" align="center" style={{fontWeight:600,marginBottom:4}}>Atendimentos</Typography>
              <Typography variant="caption" align="center" className={classes.cardDescription}>Gestão de tickets, conversas e histórico de atendimento.</Typography>
              <Button variant="outlined" color="primary" size="small" style={{fontSize:'0.7rem',padding:'4px 12px'}}>Acessar Manual</Button>
            </div>
          </Paper>
          <Paper className={`${classes.helpPaper} ${classes.helpPaperHover}`}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:'12px'}}>
              <QuestionAnswer style={{fontSize:36,color:'#ffd54f',marginBottom:8}} />
              <Typography variant="subtitle1" align="center" style={{fontWeight:600,marginBottom:4}}>Respostas Rápidas</Typography>
              <Typography variant="caption" align="center" className={classes.cardDescription}>Crie e utilize mensagens prontas para agilizar o atendimento.</Typography>
              <Button variant="outlined" color="primary" size="small" style={{fontSize:'0.7rem',padding:'4px 12px'}}>Acessar Manual</Button>
            </div>
          </Paper>
          <Paper className={`${classes.helpPaper} ${classes.helpPaperHover}`}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:'12px'}}>
              <ViewModule style={{fontSize:36,color:'#ce93d8',marginBottom:8}} />
              <Typography variant="subtitle1" align="center" style={{fontWeight:600,marginBottom:4}}>Kanban</Typography>
              <Typography variant="caption" align="center" className={classes.cardDescription}>Organize tickets por etapas e visualize o fluxo de trabalho.</Typography>
              <Button variant="outlined" color="primary" size="small" style={{fontSize:'0.7rem',padding:'4px 12px'}}>Acessar Manual</Button>
            </div>
          </Paper>
          <Paper className={`${classes.helpPaper} ${classes.helpPaperHover}`}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:'12px'}}>
              <Contacts style={{fontSize:36,color:'#ffab91',marginBottom:8}} />
              <Typography variant="subtitle1" align="center" style={{fontWeight:600,marginBottom:4}}>Contatos</Typography>
              <Typography variant="caption" align="center" className={classes.cardDescription}>Gerencie sua base de contatos e informações dos clientes.</Typography>
              <Button variant="outlined" color="primary" size="small" style={{fontSize:'0.7rem',padding:'4px 12px'}}>Acessar Manual</Button>
            </div>
          </Paper>
          <Paper className={`${classes.helpPaper} ${classes.helpPaperHover}`}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:'12px'}}>
              <Event style={{fontSize:36,color:'#ffe082',marginBottom:8}} />
              <Typography variant="subtitle1" align="center" style={{fontWeight:600,marginBottom:4}}>Agendamentos</Typography>
              <Typography variant="caption" align="center" className={classes.cardDescription}>Agende tarefas e compromissos relacionados aos atendimentos.</Typography>
              <Button variant="outlined" color="primary" size="small" style={{fontSize:'0.7rem',padding:'4px 12px'}}>Acessar Manual</Button>
            </div>
          </Paper>
          <Paper className={`${classes.helpPaper} ${classes.helpPaperHover}`}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:'12px'}}>
              <Label style={{fontSize:36,color:'#b0bec5',marginBottom:8}} />
              <Typography variant="subtitle1" align="center" style={{fontWeight:600,marginBottom:4}}>Tags</Typography>
              <Typography variant="caption" align="center" className={classes.cardDescription}>Classifique tickets e contatos com etiquetas personalizadas.</Typography>
              <Button variant="outlined" color="primary" size="small" style={{fontSize:'0.7rem',padding:'4px 12px'}}>Acessar Manual</Button>
            </div>
          </Paper>
          <Paper className={`${classes.helpPaper} ${classes.helpPaperHover}`}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:'12px'}}>
              <Forum style={{fontSize:36,color:'#b39ddb',marginBottom:8}} />
              <Typography variant="subtitle1" align="center" style={{fontWeight:600,marginBottom:4}}>Chat Interno</Typography>
              <Typography variant="caption" align="center" className={classes.cardDescription}>Comunique-se com sua equipe dentro do sistema.</Typography>
              <Button variant="outlined" color="primary" size="small" style={{fontSize:'0.7rem',padding:'4px 12px'}}>Acessar Manual</Button>
            </div>
          </Paper>
          <Paper className={`${classes.helpPaper} ${classes.helpPaperHover}`}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:'12px'}}>
              <SpeakerPhone style={{fontSize:36,color:'#ffcc80',marginBottom:8}} />
              <Typography variant="subtitle1" align="center" style={{fontWeight:600,marginBottom:4}}>Campanhas</Typography>
              <Typography variant="caption" align="center" className={classes.cardDescription}>Envie mensagens em massa e acompanhe resultados de campanhas.</Typography>
              <Button variant="outlined" color="primary" size="small" style={{fontSize:'0.7rem',padding:'4px 12px'}}>Acessar Manual</Button>
            </div>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Flowbuilder</Typography>
            <Typography variant="body2">Automatize fluxos de atendimento com regras e ações inteligentes.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Usuários</Typography>
            <Typography variant="body2">Gerencie permissões e informações dos usuários do sistema.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Relatórios</Typography>
            <Typography variant="body2">Acompanhe métricas e indicadores de desempenho do atendimento.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">API</Typography>
            <Typography variant="body2">Integre o Whaticket com outros sistemas via API.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Arquivos & Chatbot</Typography>
            <Typography variant="body2">Gerencie arquivos enviados e recebidos, e configure chatbots.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Integrações</Typography>
            <Typography variant="body2">Configure integrações com WhatsApp, OpenAI, Gemini e outros serviços.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Prompts de IA</Typography>
            <Typography variant="body2">Crie prompts personalizados para automação com IA.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Fila & Chatbot</Typography>
            <Typography variant="body2">Gerencie filas de atendimento e regras de chatbot.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Configurações</Typography>
            <Typography variant="body2">Personalize parâmetros do sistema e preferências gerais.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Conexões WhatsApp</Typography>
            <Typography variant="body2">Adicione, edite e monitore conexões do WhatsApp.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Listas de Contatos</Typography>
            <Typography variant="body2">Organize e segmente listas para campanhas e automações.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Financeiro</Typography>
            <Typography variant="body2">Gerencie cobranças, pagamentos e relatórios financeiros.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Informativos</Typography>
            <Typography variant="body2">Envie comunicados e mensagens informativas para usuários.</Typography>
          </Paper>
          <Paper className={classes.helpPaper}>
            <Typography variant="h6">Tolk.AI</Typography>
            <Typography variant="body2">Configure e utilize recursos avançados de IA conversacional.</Typography>
          </Paper>

{/* Cards de vídeos existentes, se houver */ }
{
  (records && records.length > 0) && records.map((record, key) => (
    <Paper key={key} className={`${classes.helpPaper} ${classes.paperHover}`} onClick={() => openVideoModal(record.video)}>
      <img
        src={`https://img.youtube.com/vi/${record.video}/mqdefault.jpg`}
        alt="Thumbnail"
        className={classes.videoThumbnail}
      />
      <Typography variant="button" className={classes.videoTitle}>
        {record.title}
      </Typography>
      <Typography variant="caption" className={classes.videoDescription}>
        {record.description}
      </Typography>
    </Paper>
  ))
}
        </div >
      </>
    );
  };

return (
  <div className={classes.root}>
    <MainHeader>
      <Title>{i18n.t("helps.title")} ({records.length})</Title>
      <MainHeaderButtonsWrapper></MainHeaderButtonsWrapper>
    </MainHeader>
    {renderHelps()}
    {renderVideoModal()}
  </div>
);
};

export default Helps;