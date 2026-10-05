import React, { useState, useEffect, useRef } from "react";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

import { i18n } from "../../translate/i18n";

import { Checkbox, FormControlLabel, Stack } from "@mui/material";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexWrap: "wrap"
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1
  },

  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },

  btnWrapper: {
    position: "relative"
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12
  }
}));

const FlowBuilderEndModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [closeTicket, setCloseTicket] = useState(false);

  const [labels, setLabels] = useState({
    title: "Adicionar fim do fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar fim do fluxo",
        btn: "Salvar"
      });
      setCloseTicket(!!data.data.closeTicket);
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar fim do fluxo",
        btn: "Adicionar"
      });
      setCloseTicket(false);
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSaveContact = async () => {
    if (open === "edit") {
      handleClose();
      onUpdate({
        ...data,
        data: { closeTicket }
      });
      return;
    } else if (open === "create") {
      handleClose();
      onSave({
        closeTicket
      });
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={activeModal}
        onClose={handleClose}
        fullWidth="md"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">{labels.title}</DialogTitle>
        <Stack>
          <DialogContent dividers>
            <FormControlLabel
              control={
                <Checkbox
                  checked={closeTicket}
                  onChange={e => setCloseTicket(e.target.checked)}
                  color="primary"
                />
              }
              label="Encerrar o ticket ao final"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} color="secondary" variant="outlined">
              {i18n.t("contactModal.buttons.cancel")}
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              className={classes.btnWrapper}
              onClick={() => handleSaveContact()}
            >
              {`${labels.btn}`}
            </Button>
          </DialogActions>
        </Stack>
      </Dialog>
    </div>
  );
};

export default FlowBuilderEndModal;
