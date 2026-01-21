import React, { useContext, useRef, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";

import MomentsUser from "../../components/MomentsUser";
// import MomentsQueues from "../../components/MomentsQueues";

import MainHeader from "../../components/MainHeader";
import { Grid, Paper, Typography } from "@material-ui/core";
import Title from "../../components/Title";
import ForbiddenPage from "../../components/ForbiddenPage";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    paddingLeft: "5px",
    maxWidth: "100%"
  },
  mainPaper: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    padding: theme.spacing(1),
    ...theme.scrollbarStyles,
    overflowY: "hidden",
    overflowX: "scroll",
    scrollbarWidth: "thin",
    alignItems: "stretch",
    minHeight: 0,
    height: "calc(100vh - 100px)",
    backgroundColor: "transparent",
    border: "none",
    boxShadow: "none",
    // Crítico para scroll horizontal
    maxWidth: "100%",
    width: "100%",
  },
  fixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    height: 100,
  },
  chatPapper: {
    display: "flex",
    height: "100%",
  },
  contactsHeader: {
    display: "flex",
    flexWrap: "wrap",
    padding: "0px 6px 6px 6px",
  }
}));

const ChatMoments = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext)

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

  return (

    user.profile === "user" && user.allowRealTime === "disabled" ?
      <ForbiddenPage />
      :
      <MainHeader>
        <Grid container className="moments-wrapper" style={{ width: "100%", padding: "0 10px" }} direction="column">
          <Grid item style={{ textAlign: "left" }}>
            <Title>Painel de Atendimentos</Title>
            <Typography
              variant="body1"
              color="textSecondary"
              style={{ marginBottom: 16, marginTop: -10, fontStyle: "italic", textAlign: "left" }}
            >
              Visão geral em tempo real dos atendimentos organizados por categorias (Bot, Campanhas, Pendentes) e filas de usuários.
            </Typography>
          </Grid>
          <Grid item style={{ width: "100%", height: "calc(100vh - 160px)" }}>
            <Paper
              className={classes.mainPaper}
              variant="outlined"
              ref={momentsScrollRef}
            >
              <MomentsUser onPanStart={handlePanStart} />
            </Paper>
          </Grid>
        </Grid>
      </MainHeader>
  );
};

export default ChatMoments;
