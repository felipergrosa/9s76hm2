import React, { useState, useEffect } from "react";
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Chip
} from "@material-ui/core";
import {
  Close as CloseIcon,
  PhoneAndroid as PhoneIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from "@material-ui/icons";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
  dialogContent: {
    minWidth: 600,
  },
  previewBox: {
    backgroundColor: theme.palette.grey[100],
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
    maxHeight: 400,
    overflow: "auto",
  },
  summaryBox: {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.contrastText,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
  contactItem: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
  },
  originalNumber: {
    color: theme.palette.error.main,
    textDecoration: "line-through",
  },
  normalizedNumber: {
    color: theme.palette.success.main,
    fontWeight: "bold",
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: theme.spacing(2),
    gap: theme.spacing(1),
  },
}));

const NormalizeNumbersModal = ({ open, onClose, companyId, contactId }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [preview, setPreview] = useState(null);
  const [completed, setCompleted] = useState(null);

  const handleClose = () => {
    onClose();
    setPreview(null);
    setCompleted(null);
    setDryRun(true);
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const response = await api.post("/contacts/normalization/process", {
        companyId,
        contactId,
        dryRun: true, // Sempre preview primeiro
      });

      setPreview(response.data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNormalize = async () => {
    setProcessing(true);
    try {
      const response = await api.post("/contacts/normalization/process", {
        companyId,
        contactId,
        dryRun: false, // Executar de verdade
      });

      setCompleted(response.data);
      toast.success(`${response.data.normalized} números normalizados com sucesso!`);
    } catch (err) {
      toastError(err);
    } finally {
      setProcessing(false);
    }
  };

  const renderPreview = () => {
    if (!preview) return null;

    return (
      <Box className={classes.previewBox}>
        <Box className={classes.summaryBox}>
          <Typography variant="h6">Resumo da Normalização</Typography>
          <Typography>
            📊 Contatos processados: {preview.processed}
          </Typography>
          <Typography>
            ✅ Serão normalizados: {preview.normalized}
          </Typography>
          <Typography>
            ❌ Erros encontrados: {preview.errors}
          </Typography>
        </Box>

        <Typography variant="h6" gutterBottom>
          Alterações Previstas:
        </Typography>

        <List>
          {preview.details
            ?.filter(detail => detail.action === "normalized")
            .slice(0, 10) // Mostrar apenas os primeiros 10
            .map((detail, index) => (
              <ListItem key={index} className={classes.contactItem}>
                <ListItemText
                  primary={detail.name || "Sem nome"}
                  secondary={
                    <Box>
                      <Typography
                        component="span"
                        className={classes.originalNumber}
                      >
                        De: {detail.originalNumber}
                      </Typography>
                      <br />
                      <Typography
                        component="span"
                        className={classes.normalizedNumber}
                      >
                        Para: {detail.normalizedNumber}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Chip
                    icon={<CheckIcon />}
                    label="Normalizar"
                    color="primary"
                    size="small"
                  />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
        </List>

        {preview.details?.filter(d => d.action === "normalized").length > 10 && (
          <Typography variant="body2" color="textSecondary" align="center">
            ... e mais {preview.details.filter(d => d.action === "normalized").length - 10} contatos
          </Typography>
        )}
      </Box>
    );
  };

  const renderCompleted = () => {
    if (!completed) return null;

    return (
      <Box className={classes.previewBox}>
        <Box className={classes.summaryBox}>
          <Typography variant="h6">✅ Normalização Concluída!</Typography>
          <Typography>
            📊 Contatos processados: {completed.processed}
          </Typography>
          <Typography>
            ✅ Números normalizados: {completed.normalized}
          </Typography>
          <Typography>
            ❌ Erros encontrados: {completed.errors}
          </Typography>
        </Box>

        {completed.errors > 0 && (
          <>
            <Typography variant="h6" color="error" gutterBottom>
              Erros Encontrados:
            </Typography>
            <List>
              {completed.details
                ?.filter(detail => detail.action === "error")
                .slice(0, 5)
                .map((detail, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={detail.name || "Sem nome"}
                      secondary={`Número: ${detail.originalNumber}`}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        icon={<WarningIcon />}
                        label="Erro"
                        color="secondary"
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
            </List>
          </>
        )}
      </Box>
    );
  };

  useEffect(() => {
    if (open && !preview && !completed) {
      handlePreview();
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <PhoneIcon style={{ marginRight: 8 }} />
            <Typography variant="h6">
              {contactId ? "Normalizar Número do Contato" : "Normalizar Números"}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <Typography variant="body1" paragraph>
          A normalização ajustará os números de telefone para o formato padrão brasileiro,
          incluindo DDI (55) e o 9º dígito em celulares quando necessário.
        </Typography>

        {loading && (
          <Box display="flex" alignItems="center" justifyContent="center" p={4}>
            <CircularProgress />
            <Typography style={{ marginLeft: 16 }}>
              Analisando números...
            </Typography>
          </Box>
        )}

        {!loading && !completed && renderPreview()}
        {completed && renderCompleted()}

        <Divider style={{ margin: "16px 0" }} />

        <div className={classes.buttonContainer}>
          <Button onClick={handleClose} color="secondary">
            {completed ? "Fechar" : "Cancelar"}
          </Button>
          
          {!completed && preview && preview.normalized > 0 && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleNormalize}
              disabled={processing}
              startIcon={processing ? <CircularProgress size={20} /> : <PhoneIcon />}
            >
              {processing ? "Normalizando..." : `Normalizar ${preview.normalized} Números`}
            </Button>
          )}

          {!completed && preview && preview.normalized === 0 && (
            <Typography variant="body2" color="textSecondary">
              Todos os números já estão normalizados! 🎉
            </Typography>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NormalizeNumbersModal;
