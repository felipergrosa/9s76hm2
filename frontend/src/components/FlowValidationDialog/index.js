import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { AlertTriangle } from "lucide-react";

const useStyles = makeStyles((theme) => ({
  title: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    fontSize: "1rem",
    fontWeight: 700,
  },
  list: {
    margin: 0,
    paddingLeft: theme.spacing(2.5),
    "& li": {
      fontSize: "0.88rem",
      color: theme.palette.text.secondary,
      marginBottom: theme.spacing(0.75),
      lineHeight: 1.5,
    },
  },
  hint: {
    marginTop: theme.spacing(1.5),
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
  },
}));

const FlowValidationDialog = ({ issues, onClose, onPublishAnyway }) => {
  const classes = useStyles();
  const open = Array.isArray(issues) && issues.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle disableTypography>
        <div className={classes.title}>
          <AlertTriangle size={20} color="#F7953B" />
          Problemas encontrados no fluxo
        </div>
      </DialogTitle>
      <DialogContent dividers>
        <ul className={classes.list}>
          {(issues || []).map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
        <div className={classes.hint}>
          Blocos sem conexão nunca serão executados. Revise antes de publicar.
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" variant="outlined">
          Revisar fluxo
        </Button>
        <Button
          onClick={onPublishAnyway}
          color="primary"
          variant="contained"
        >
          Publicar mesmo assim
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FlowValidationDialog;
