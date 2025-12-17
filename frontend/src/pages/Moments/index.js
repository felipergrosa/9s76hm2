import React, { useContext } from "react";
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
    overflowY: "hidden",
    overflowX: "auto",
    ...theme.scrollbarStyles,
    alignItems: "flex-start",
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
            >
              <MomentsUser />
            </Paper>
          </Grid>
        </Grid>
      </MainHeader>
  );
};

export default ChatMoments;
