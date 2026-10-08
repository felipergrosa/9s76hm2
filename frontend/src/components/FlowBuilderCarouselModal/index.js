import React, { useState, useEffect, useRef } from "react";

import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";

import { i18n } from "../../translate/i18n";

import { Stack } from "@mui/material";
import { AddCircle, Delete } from "@mui/icons-material";

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

const emptyCard = () => ({
  title: "",
  subtitle: "",
  imageUrl: "",
  buttonLabel: "",
  buttonUrl: ""
});

const FlowBuilderCarouselModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [cards, setCards] = useState([emptyCard()]);

  const [labels, setLabels] = useState({
    title: "Adicionar carrossel ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar carrossel",
        btn: "Salvar"
      });
      setCards(
        Array.isArray(data.data.cards) && data.data.cards.length > 0
          ? data.data.cards
          : [emptyCard()]
      );
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar carrossel ao fluxo",
        btn: "Adicionar"
      });
      setCards([emptyCard()]);
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

  const updateCard = (index, field, value) => {
    setCards(old =>
      old.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeCard = index => {
    setCards(old => old.filter((_, i) => i !== index));
  };

  const handleSaveContact = async () => {
    if (cards.length < 1) {
      return toast.error("Adicione ao menos um card");
    }
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card.title || !card.title.trim()) {
        return toast.error(`Informe o título do card ${i + 1}`);
      }
      if (card.title.trim().length > 80) {
        return toast.error(`O título do card ${i + 1} deve ter no máximo 80 caracteres`);
      }
    }
    const payload = {
      cards: cards.map(card => ({
        title: card.title.trim(),
        subtitle: (card.subtitle || "").trim(),
        imageUrl: (card.imageUrl || "").trim(),
        buttonLabel: (card.buttonLabel || "").trim(),
        buttonUrl: (card.buttonUrl || "").trim()
      }))
    };
    if (open === "edit") {
      handleClose();
      onUpdate({
        ...data,
        data: { ...payload }
      });
      return;
    } else if (open === "create") {
      handleClose();
      onSave(payload);
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
            <Stack style={{ gap: "16px" }}>
              <Stack direction={"row"} justifyContent={"space-between"} alignItems={"center"}>
                <Typography>Cards ({cards.length}/10)</Typography>
                <Button
                  onClick={() => setCards(old => [...old, emptyCard()])}
                  color="primary"
                  variant="contained"
                  disabled={cards.length >= 10}
                >
                  <AddCircle />
                </Button>
              </Stack>
              {cards.map((card, index) => (
                <Stack
                  key={`card-${index}`}
                  style={{
                    gap: "8px",
                    padding: "12px",
                    border: "1px solid #E4E7EC",
                    borderRadius: "8px"
                  }}
                >
                  <Stack direction={"row"} justifyContent={"space-between"} alignItems={"center"}>
                    <Typography variant="subtitle2">Card {index + 1}</Typography>
                    {cards.length > 1 && (
                      <IconButton size="small" onClick={() => removeCard(index)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                  <TextField
                    label={"Título"}
                    variant="outlined"
                    value={card.title}
                    inputProps={{ maxLength: 80 }}
                    style={{ width: "100%" }}
                    onChange={e => updateCard(index, "title", e.target.value)}
                    required
                  />
                  <TextField
                    label={"Subtítulo (opcional)"}
                    variant="outlined"
                    value={card.subtitle}
                    style={{ width: "100%" }}
                    onChange={e => updateCard(index, "subtitle", e.target.value)}
                  />
                  <TextField
                    label={"URL da imagem (opcional)"}
                    variant="outlined"
                    value={card.imageUrl}
                    style={{ width: "100%" }}
                    onChange={e => updateCard(index, "imageUrl", e.target.value)}
                  />
                  <Stack direction={"row"} style={{ gap: "8px" }}>
                    <TextField
                      label={"Texto do botão (opcional)"}
                      variant="outlined"
                      value={card.buttonLabel}
                      style={{ flex: 1 }}
                      onChange={e => updateCard(index, "buttonLabel", e.target.value)}
                    />
                    <TextField
                      label={"URL do botão (opcional)"}
                      variant="outlined"
                      value={card.buttonUrl}
                      style={{ flex: 1 }}
                      onChange={e => updateCard(index, "buttonUrl", e.target.value)}
                    />
                  </Stack>
                </Stack>
              ))}
              <Typography variant="caption" style={{ color: "#667085" }}>
                Os botões são do tipo link (web_url). No WhatsApp, o carrossel
                degrada para imagem + texto com os links listados.
              </Typography>
            </Stack>
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

export default FlowBuilderCarouselModal;
