import React, { useState, useEffect, useRef } from "react";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";

import { i18n } from "../../translate/i18n";

import { Stack, Typography } from "@mui/material";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexWrap: "wrap"
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1
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

// Config do nó "asaasCharge" (2ª via de boleto Asaas):
// - campoDocumento: nome da variável do fluxo com o CPF/CNPJ (answerKey do
//   bloco Pergunta/Aguardar resposta). Vazio → usa contact.cpfCnpj.
// - Toggles de conteúdo enviado por fatura: link do boleto, PDF, linha
//   digitável, PIX copia-e-cola e imagem do QR.
// - mensagem: intro enviada antes das cobranças (aceita {{variáveis}}).
// - mensagemNaoEncontrado: enviada quando o doc é inválido, o cliente não
//   existe no Asaas ou não há cobranças — e o fluxo segue pela saída "b".
const FlowBuilderAsaasChargeModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);
  const t = key => i18n.t(`flowbuilderNodes.asaasCharge.${key}`);

  const [activeModal, setActiveModal] = useState(false);

  const [campoDocumento, setCampoDocumento] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [mensagemNaoEncontrado, setMensagemNaoEncontrado] = useState("");
  const [incluirBoletoUrl, setIncluirBoletoUrl] = useState(true);
  const [incluirBoletoPdf, setIncluirBoletoPdf] = useState(false);
  const [incluirLinhaDigitavel, setIncluirLinhaDigitavel] = useState(false);
  const [incluirPix, setIncluirPix] = useState(true);
  const [incluirPixQr, setIncluirPixQr] = useState(false);

  const [labels, setLabels] = useState({
    title: t("modalAdd"),
    btn: t("btnAdd")
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({ title: t("modalEdit"), btn: t("btnEdit") });
      const d = data?.data || {};
      setCampoDocumento(d.campoDocumento || "");
      setMensagem(d.mensagem || "");
      setMensagemNaoEncontrado(d.mensagemNaoEncontrado || "");
      setIncluirBoletoUrl(d.incluirBoletoUrl !== false);
      setIncluirBoletoPdf(Boolean(d.incluirBoletoPdf));
      setIncluirLinhaDigitavel(Boolean(d.incluirLinhaDigitavel));
      setIncluirPix(Boolean(d.incluirPix));
      setIncluirPixQr(Boolean(d.incluirPixQr));
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({ title: t("modalAdd"), btn: t("btnAdd") });
      setCampoDocumento("");
      setMensagem("");
      setMensagemNaoEncontrado("");
      setIncluirBoletoUrl(true);
      setIncluirBoletoPdf(false);
      setIncluirLinhaDigitavel(false);
      setIncluirPix(true);
      setIncluirPixQr(false);
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
    const payload = {
      campoDocumento: campoDocumento.trim(),
      mensagem,
      mensagemNaoEncontrado,
      incluirBoletoUrl,
      incluirBoletoPdf,
      incluirLinhaDigitavel,
      incluirPix,
      incluirPixQr
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
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">{labels.title}</DialogTitle>
        <Stack>
          <DialogContent dividers>
            <Stack style={{ gap: "16px" }}>
              <TextField
                label={t("campoDocumento")}
                name="campoDocumento"
                variant="outlined"
                value={campoDocumento}
                onChange={e => setCampoDocumento(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText={t("campoDocumentoHint")}
              />
              <TextField
                label={t("mensagem")}
                name="mensagem"
                variant="outlined"
                multiline
                rows={3}
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText={t("mensagemHint")}
              />
              <TextField
                label={t("mensagemNaoEncontrado")}
                name="mensagemNaoEncontrado"
                variant="outlined"
                multiline
                rows={2}
                value={mensagemNaoEncontrado}
                onChange={e => setMensagemNaoEncontrado(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText={t("mensagemNaoEncontradoHint")}
              />
              <Typography variant="subtitle2" color="textSecondary">
                {t("sectionEnvio")}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={incluirBoletoUrl}
                    onChange={e => setIncluirBoletoUrl(e.target.checked)}
                    color="primary"
                  />
                }
                label={t("incluirBoletoUrl")}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={incluirBoletoPdf}
                    onChange={e => setIncluirBoletoPdf(e.target.checked)}
                    color="primary"
                  />
                }
                label={t("incluirBoletoPdf")}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={incluirLinhaDigitavel}
                    onChange={e => setIncluirLinhaDigitavel(e.target.checked)}
                    color="primary"
                  />
                }
                label={t("incluirLinhaDigitavel")}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={incluirPix}
                    onChange={e => setIncluirPix(e.target.checked)}
                    color="primary"
                  />
                }
                label={t("incluirPix")}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={incluirPixQr}
                    onChange={e => setIncluirPixQr(e.target.checked)}
                    color="primary"
                  />
                }
                label={t("incluirPixQr")}
              />
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

export default FlowBuilderAsaasChargeModal;
