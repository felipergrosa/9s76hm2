import React, { useRef, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";

import MomentsUser from "../../components/MomentsUser";
// import MomentsQueues from "../../components/MomentsQueues";

import { Paper, Typography } from "@material-ui/core";
import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";

// Bento — molde de página padrão (painel + entrada spring)
import { motion, useReducedMotion } from "framer-motion";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

const useStyles = makeStyles((theme) => ({
  // Painel externo no padrão canônico — cabeçalho vive dentro do Paper
  paper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    padding: theme.spacing(2, 2.5),
  },
  headerText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  mainPaper: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    padding: theme.spacing(1),
    ...theme.scrollbarStyles,
    overflowY: "hidden",
    overflowX: "auto",
    scrollbarWidth: "thin",
    alignItems: "stretch",
    minHeight: 0,
    // Altura 100% do wrapper pai (que já limita em calc(100vh - 180px)):
    // evita clipe do rodapé e do scroll horizontal no mobile
    height: "100%",
    backgroundColor: "transparent",
    border: "none",
    boxShadow: "none",
    width: "100%",
    // Garantir que o scroll funcione em mobile
    WebkitOverflowScrolling: "touch",
    // Permitir scroll suave
    scrollBehavior: "smooth",
    // Forçar scroll horizontal
    position: "relative",
  },
}));

const ChatMoments = () => {
  const classes = useStyles();
  const { hasPermission } = usePermissions();

  const momentsScrollRef = useRef(null);
  const panRef = useRef({ active: false, startX: 0, scrollLeft: 0 });

  const handlePanStart = (e) => {
    const evt = e?.nativeEvent || e;
    if (evt?.button != null && evt.button !== 0) return;
    const container = momentsScrollRef.current;
    if (!container) return;
    panRef.current.active = true;
    panRef.current.startX = evt.clientX;
    panRef.current.scrollLeft = container.scrollLeft;
    panRef.current.pointerId = evt.pointerId != null ? evt.pointerId : null;
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!panRef.current.active) return;
      if (panRef.current.pointerId != null && e.pointerId != null && panRef.current.pointerId !== e.pointerId) return;
      const container = momentsScrollRef.current;
      if (!container) return;
      const dx = e.clientX - panRef.current.startX;
      container.scrollLeft = panRef.current.scrollLeft - dx;
    };

    const onUp = (e) => {
      if (!panRef.current.active) return;
      if (panRef.current.pointerId != null && e?.pointerId != null && panRef.current.pointerId !== e.pointerId) return;
      panRef.current.active = false;
      panRef.current.pointerId = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // Respeita prefers-reduced-motion: fade simples no lugar do spring
  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  return (

    !hasPermission("realtime.view") ?
      <ForbiddenPage />
      :
      <MainContainer useWindowScroll>
        <motion.div variants={bentoContainer} initial="hidden" animate="show">
          <motion.div variants={itemVariant}>
            <Paper className={`${classes.paper} bento-panel`} variant="outlined">
              {/* Cabeçalho dentro do Paper — padrão canônico (sem MainHeader) */}
              <div className={classes.header}>
                <div className={classes.headerText}>
                  <Title>Painel de Atendimentos</Title>
                  <Typography variant="body2" color="textSecondary">
                    Visão geral em tempo real dos atendimentos organizados por categorias (Bot, Campanhas, Pendentes) e filas de usuários.
                  </Typography>
                </div>
              </div>
              {/* Feed de momentos — scroll horizontal com pan por pointer events.
                  Altura: viewport menos appbar (48px) + padding do container (32px) + cabeçalho do painel (~100px) */}
              <div style={{ width: "100%", height: "calc(100vh - 180px)", overflow: "hidden" }}>
                <Paper
                  className={classes.mainPaper}
                  variant="outlined"
                  ref={momentsScrollRef}
                  onPointerDown={handlePanStart}
                >
                  <MomentsUser onPanStart={handlePanStart} />
                </Paper>
              </div>
            </Paper>
          </motion.div>
        </motion.div>
      </MainContainer>
  );
};

export default ChatMoments;
