import React, { useContext, useRef } from "react";
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
    padding: theme.spacing(1),
    ...theme.scrollbarStyles,
    overflowY: "hidden",
    overflowX: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    "&::-webkit-scrollbar": {
      width: 0,
      height: 0,
      display: "none",
    },
    alignItems: "stretch",
    minHeight: 0,
    height: "calc(100vh - 100px)", // Ajuste para ocupar altura correta descontando header
    backgroundColor: "transparent",
    border: "none",
    boxShadow: "none"
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
    if (!momentsScrollRef.current) return;
    if (e && e.button != null && e.button !== 0) return;

    panRef.current.active = true;
    panRef.current.startX = e.clientX;
    panRef.current.scrollLeft = momentsScrollRef.current.scrollLeft;

    const onMove = (ev) => {
      if (!panRef.current.active || !momentsScrollRef.current) return;
      const dx = ev.clientX - panRef.current.startX;
      momentsScrollRef.current.scrollLeft = panRef.current.scrollLeft - dx;
    };

    const onUp = () => {
      panRef.current.active = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };

  return (

    user.profile === "user" && user.allowRealTime === "disabled" ?
      <ForbiddenPage />
      :
      <MainHeader>
        <Grid container style={{ width: "100%", padding: "0 10px" }} direction="column">
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
              style={{ maxWidth: "100%", height: "100%" }}
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
