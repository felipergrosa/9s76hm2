import React from "react";
import Backdrop from "@material-ui/core/Backdrop";
import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 2, // abaixo de modal (1300), acima de drawer (1200)
    color: "#000000",
    backgroundColor: "rgba(17, 24, 39, 0.18)", // leve escurecido
    backdropFilter: "blur(2px)", // desfoque do fundo
    WebkitBackdropFilter: "blur(2px)",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  text: {
    fontSize: 14,
    opacity: 0.9,
  },
}));

const LoadingOverlay = ({ open = false, message = "Carregando..." }) => {
  const classes = useStyles();
  return (
    <Backdrop className={classes.backdrop} open={!!open}>
      <div className={classes.content} role="status" aria-live="polite">
        <CircularProgress color="inherit" size={32} thickness={4} />
        {message ? <span className={classes.text}>{message}</span> : null}
      </div>
    </Backdrop>
  );
};

export default LoadingOverlay;
