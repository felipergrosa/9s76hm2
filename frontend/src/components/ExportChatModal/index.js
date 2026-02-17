import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Checkbox,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Divider
} from "@material-ui/core";
import { Close as CloseIcon, GetApp as DownloadIcon } from "@material-ui/icons";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  dialogContent: {
    minWidth: 400,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
    width: "100%",
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: theme.spacing(2),
    gap: theme.spacing(1),
  },
  exportButton: {
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  previewBox: {
    backgroundColor: theme.palette.grey[100],
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
  },
}));

const ExportChatModal = ({ open, onClose, ticketId }) => {
  const classes = useStyles();
  const history = useHistory();
  const [format, setFormat] = useState("json");
  const [includeMedia, setIncludeMedia] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState(null);

  const handleClose = () => {
    onClose();
    setFormat("json");
    setIncludeMedia(false);
    setExported(null);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/messages/${ticketId}/export`, {
        params: {
          format,
          includeMedia,
        },
      });

      if (response.data.success) {
        setExported(response.data);
        
        // Fazer download do arquivo
        const fileUrl = `${process.env.REACT_APP_BACKEND_URL}${response.data.url}`;
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = response.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Chat exportado com sucesso!");
      } else {
        toast.error(response.data.error || "Erro ao exportar chat");
      }
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const getFormatDescription = (fmt) => {
    switch (fmt) {
      case "json":
        return "Formato completo com todos os dados estruturados";
      case "csv":
        return "Planilha compatível com Excel e Google Sheets";
      case "txt":
        return "Texto simples fácil de ler e compartilhar";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Exportar Conversa</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <div className={classes.root}>
          <FormControl component="fieldset" className={classes.formControl}>
            <Typography variant="subtitle1" gutterBottom>
              Formato do Arquivo
            </Typography>
            <RadioGroup
              aria-label="format"
              name="format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <FormControlLabel
                value="json"
                control={<Radio />}
                label="JSON"
              />
              <Typography variant="body2" color="textSecondary" style={{ marginLeft: 32 }}>
                {getFormatDescription("json")}
              </Typography>
              
              <FormControlLabel
                value="csv"
                control={<Radio />}
                label="CSV"
              />
              <Typography variant="body2" color="textSecondary" style={{ marginLeft: 32 }}>
                {getFormatDescription("csv")}
              </Typography>
              
              <FormControlLabel
                value="txt"
                control={<Radio />}
                label="TXT"
              />
              <Typography variant="body2" color="textSecondary" style={{ marginLeft: 32 }}>
                {getFormatDescription("txt")}
              </Typography>
            </RadioGroup>
          </FormControl>

          <FormControl component="fieldset" className={classes.formControl}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeMedia}
                  onChange={(e) => setIncludeMedia(e.target.checked)}
                  color="primary"
                />
              }
              label="Incluir informações de mídia (videos, imagens, audios)"
            />
          </FormControl>

          {exported && (
            <Box className={classes.previewBox}>
              <Typography variant="subtitle2" gutterBottom>
                Exportado com sucesso!
              </Typography>
              <Typography variant="body2">
                Arquivo: {exported.filename}
              </Typography>
            </Box>
          )}

          <Divider style={{ margin: "16px 0" }} />

          <div className={classes.buttonContainer}>
            <Button onClick={handleClose} color="secondary">
              Cancelar
            </Button>
            <Button
              variant="contained"
              className={classes.exportButton}
              onClick={handleExport}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
            >
              {loading ? "Exportando..." : "Exportar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportChatModal;
