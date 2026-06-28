import React, { useRef, useState } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(3),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    maxWidth: 640,
  },
  helpText: {
    color: theme.mode === "light" ? "#666" : "#aaa",
    fontSize: 13,
  },
  fileRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
}));

// Importação de leads gerados externamente (CNPJ + Google Maps scraping —
// item 8 do plano). Aceita planilha XLSX/CSV com colunas como name/nome,
// phone/telefone, email, cnpj, cnae, porte, segmento, cidade, uf, website,
// googleMapsUrl. Cria/atualiza Contact + ContactCustomField tipado e, se
// um nome de lista for informado, agrupa em uma ContactList já pronta para
// disparo manual de campanha (WhatsApp ou e-mail).
const LeadsImport = () => {
  const classes = useStyles();
  const fileInputRef = useRef(null);

  const [fileName, setFileName] = useState("");
  const [contactListName, setContactListName] = useState("");
  const [tagName, setTagName] = useState("");
  const [validateNumber, setValidateNumber] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : "");
  };

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.warning("Selecione um arquivo XLSX ou CSV com os leads.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    if (contactListName.trim()) formData.append("contactListName", contactListName.trim());
    if (tagName.trim()) formData.append("tagName", tagName.trim());
    formData.append("validateNumber", validateNumber ? "true" : "false");

    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/leads/import", formData);
      setResult(data);
      toast.success(`Importação concluída: ${data.created} criados, ${data.updated} atualizados.`);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>Importar Leads (CNPJ / Google Maps)</Title>
        <MainHeaderButtonsWrapper />
      </MainHeader>
      <Paper className={classes.mainPaper} variant="outlined">
        <Typography className={classes.helpText}>
          Envie uma planilha XLSX ou CSV com os leads gerados (ex.: scraping de CNPJ + Google Maps).
          Colunas reconhecidas: nome/name, telefone/phone, email, cnpj, cnae, porte, segmento, cidade, uf,
          endereco, website, googleMapsUrl. Os contatos são criados ou atualizados sem sobrescrever dados
          já existentes; o envio de mensagens continua sendo manual, via campanha.
        </Typography>

        <div className={classes.fileRow}>
          <Button variant="outlined" component="label">
            Selecionar arquivo
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={handleFileChange}
            />
          </Button>
          {fileName && <Chip label={fileName} onDelete={() => {
            setFileName("");
            if (fileInputRef.current) fileInputRef.current.value = null;
          }} />}
        </div>

        <TextField
          label="Adicionar a uma Lista de Contatos (opcional)"
          placeholder="Ex.: Leads CNPJ - Padarias SP"
          value={contactListName}
          onChange={e => setContactListName(e.target.value)}
          fullWidth
        />

        <TextField
          label="Aplicar Tag (opcional)"
          placeholder="Ex.: Lead CNPJ"
          value={tagName}
          onChange={e => setTagName(e.target.value)}
          fullWidth
        />

        <FormControlLabel
          control={
            <Switch
              checked={validateNumber}
              onChange={e => setValidateNumber(e.target.checked)}
              color="primary"
            />
          }
          label="Validar números no WhatsApp antes de importar (mais lento)"
        />

        <Button
          variant="contained"
          color="primary"
          onClick={handleImport}
          disabled={loading}
        >
          {loading ? "Importando..." : "Importar Leads"}
        </Button>

        {result && (
          <Paper variant="outlined" style={{ padding: 16 }}>
            <Typography variant="subtitle2">Resultado</Typography>
            <Typography variant="body2">Total processado: {result.total}</Typography>
            <Typography variant="body2">Criados: {result.created}</Typography>
            <Typography variant="body2">Atualizados: {result.updated}</Typography>
            <Typography variant="body2">Ignorados: {result.skipped}</Typography>
            {result.errors?.length > 0 && (
              <Typography variant="body2" color="error">
                {result.errors.length} linha(s) com erro (ex.: telefone inválido).
              </Typography>
            )}
          </Paper>
        )}
      </Paper>
    </MainContainer>
  );
};

export default LeadsImport;
