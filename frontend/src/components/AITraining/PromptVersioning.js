import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import HistoryIcon from "@material-ui/icons/History";
import RestoreIcon from "@material-ui/icons/Restore";
import CompareArrowsIcon from "@material-ui/icons/CompareArrows";
import SaveIcon from "@material-ui/icons/Save";
import VisibilityIcon from "@material-ui/icons/Visibility";
import { toast } from "react-toastify";

import {
  createPromptVersion,
  listPromptVersions,
  rollbackToVersion,
  compareVersions
} from "../../services/aiTraining";

const useStyles = makeStyles((theme) => ({
  container: {
    height: "100%",
    display: "flex",
    flexDirection: "column"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(2)
  },
  versionList: {
    maxHeight: 500,
    overflow: "auto"
  },
  versionItem: {
    borderLeft: `3px solid ${theme.palette.grey[300]}`,
    marginBottom: theme.spacing(1),
    "&.active": {
      borderLeftColor: theme.palette.primary.main,
      backgroundColor: theme.mode === "light" ? "#e3f2fd" : "#1a237e"
    }
  },
  compareContainer: {
    display: "flex",
    gap: theme.spacing(2)
  },
  comparePane: {
    flex: 1,
    padding: theme.spacing(2),
    backgroundColor: theme.mode === "light" ? "#f5f5f5" : "#1a1a2e",
    borderRadius: 8,
    overflow: "auto",
    maxHeight: 400
  },
  diffLine: {
    fontFamily: "monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    padding: "2px 8px",
    margin: "1px 0",
    borderRadius: 2
  },
  addedLine: {
    backgroundColor: theme.mode === "light" ? "#e8f5e9" : "#1b5e20",
    color: theme.mode === "light" ? "#2e7d32" : "#a5d6a7"
  },
  removedLine: {
    backgroundColor: theme.mode === "light" ? "#ffebee" : "#b71c1c",
    color: theme.mode === "light" ? "#c62828" : "#ef9a9a"
  },
  unchangedLine: {
    color: theme.palette.text.secondary
  },
  promptPreview: {
    fontFamily: "monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    backgroundColor: theme.mode === "light" ? "#fafafa" : "#121225",
    padding: theme.spacing(2),
    borderRadius: 8,
    maxHeight: 400,
    overflow: "auto"
  },
  changeTypeChip: {
    marginLeft: theme.spacing(1)
  }
}));

const PromptVersioning = ({ agentId, stageId, currentPrompt, onRestore }) => {
  const classes = useStyles();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [compareVersionA, setCompareVersionA] = useState(null);
  const [compareVersionB, setCompareVersionB] = useState(null);
  const [saveDescription, setSaveDescription] = useState("");

  useEffect(() => {
    if (agentId && stageId) {
      loadVersions();
    }
  }, [agentId, stageId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await listPromptVersions({ agentId, stageId });
      setVersions(data.versions || []);
    } catch (err) {
      toast.error("Erro ao carregar versões");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVersion = async () => {
    if (!currentPrompt?.trim()) {
      toast.warning("Prompt vazio não pode ser salvo");
      return;
    }

    setLoading(true);
    try {
      await createPromptVersion({
        agentId,
        stageId,
        systemPrompt: currentPrompt,
        changeDescription: saveDescription.trim() || null,
        changeType: "manual"
      });

      toast.success("Versão salva!");
      setShowSave(false);
      setSaveDescription("");
      loadVersions();
    } catch (err) {
      toast.error("Erro ao salvar versão");
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (version) => {
    if (!window.confirm(`Restaurar para versão ${version.version}? O prompt atual será substituído.`)) {
      return;
    }

    setLoading(true);
    try {
      const data = await rollbackToVersion(version.id);
      toast.success(`Restaurado para versão ${version.version}`);
      if (onRestore) {
        onRestore(data.appliedPrompt);
      }
      loadVersions();
    } catch (err) {
      toast.error("Erro ao restaurar versão");
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!compareVersionA || !compareVersionB) {
      toast.warning("Selecione duas versões para comparar");
      return;
    }

    setLoading(true);
    try {
      const data = await compareVersions(compareVersionA, compareVersionB);
      setCompareData(data);
    } catch (err) {
      toast.error("Erro ao comparar versões");
    } finally {
      setLoading(false);
    }
  };

  const getChangeTypeColor = (type) => {
    switch (type) {
      case "manual":
        return "primary";
      case "rollback":
        return "secondary";
      case "auto":
        return "default";
      case "training":
        return "primary";
      default:
        return "default";
    }
  };

  const getChangeTypeLabel = (type) => {
    switch (type) {
      case "manual":
        return "Manual";
      case "rollback":
        return "Rollback";
      case "auto":
        return "Automático";
      case "training":
        return "Training";
      default:
        return type;
    }
  };

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Typography variant="h6">
          <HistoryIcon style={{ verticalAlign: "middle", marginRight: 8 }} />
          Histórico de Versões
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            startIcon={<CompareArrowsIcon />}
            onClick={() => setShowCompare(true)}
            variant="outlined"
            size="small"
            disabled={versions.length < 2}
          >
            Comparar
          </Button>
          <Button
            startIcon={<SaveIcon />}
            onClick={() => setShowSave(true)}
            variant="contained"
            color="primary"
            size="small"
            disabled={!currentPrompt?.trim()}
          >
            Salvar Versão
          </Button>
        </Box>
      </Box>

      {loading && versions.length === 0 ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : versions.length === 0 ? (
        <Paper variant="outlined" style={{ padding: 32, textAlign: "center" }}>
          <Typography color="textSecondary">
            Nenhuma versão salva ainda. Salve o prompt atual para criar a primeira versão.
          </Typography>
        </Paper>
      ) : (
        <List className={classes.versionList}>
          {versions.map((version) => (
            <Card
              key={version.id}
              className={`${classes.versionItem} ${version.isActive ? "active" : ""}`}
              variant="outlined"
            >
              <CardContent style={{ padding: "12px 16px" }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2">
                      Versão {version.version}
                      {version.isActive && (
                        <Chip
                          size="small"
                          label="Ativa"
                          color="primary"
                          style={{ marginLeft: 8 }}
                        />
                      )}
                      <Chip
                        size="small"
                        label={getChangeTypeLabel(version.changeType)}
                        color={getChangeTypeColor(version.changeType)}
                        variant="outlined"
                        className={classes.changeTypeChip}
                      />
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(version.createdAt).toLocaleString()}
                    </Typography>
                    {version.changeDescription && (
                      <Typography variant="body2" style={{ marginTop: 4 }}>
                        {version.changeDescription}
                      </Typography>
                    )}
                    {version.testScore !== null && (
                      <Chip
                        size="small"
                        label={`Score: ${version.testScore}%`}
                        style={{ marginTop: 4 }}
                      />
                    )}
                  </Box>
                  <Box>
                    <Tooltip title="Visualizar">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedVersion(version);
                          setShowPreview(true);
                        }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Restaurar esta versão">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleRollback(version)}
                        disabled={version.isActive || loading}
                      >
                        <RestoreIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </List>
      )}

      {/* Dialog para salvar nova versão */}
      <Dialog open={showSave} onClose={() => setShowSave(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Salvar Nova Versão</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Descrição da alteração (opcional)"
            variant="outlined"
            margin="dense"
            value={saveDescription}
            onChange={(e) => setSaveDescription(e.target.value)}
            placeholder="Ex: Ajustado tom para ser mais amigável"
            multiline
            minRows={2}
          />
          <Typography variant="caption" color="textSecondary" style={{ marginTop: 8 }}>
            O prompt atual será salvo como uma nova versão. Você poderá restaurá-lo depois se necessário.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSave(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveVersion}
            disabled={loading}
          >
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para preview de versão */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Versão {selectedVersion?.version}
          {selectedVersion?.changeDescription && ` - ${selectedVersion.changeDescription}`}
        </DialogTitle>
        <DialogContent>
          <Box className={classes.promptPreview}>
            {selectedVersion?.systemPrompt}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Fechar</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              handleRollback(selectedVersion);
              setShowPreview(false);
            }}
            disabled={selectedVersion?.isActive}
          >
            Restaurar esta versão
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para comparar versões */}
      <Dialog open={showCompare} onClose={() => setShowCompare(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Comparar Versões</DialogTitle>
        <DialogContent>
          <Box display="flex" gap={2} mb={2}>
            <TextField
              select
              label="Versão A"
              variant="outlined"
              size="small"
              style={{ width: 200 }}
              value={compareVersionA || ""}
              onChange={(e) => setCompareVersionA(e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="">Selecione</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  Versão {v.version}
                </option>
              ))}
            </TextField>
            <TextField
              select
              label="Versão B"
              variant="outlined"
              size="small"
              style={{ width: 200 }}
              value={compareVersionB || ""}
              onChange={(e) => setCompareVersionB(e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="">Selecione</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  Versão {v.version}
                </option>
              ))}
            </TextField>
            <Button
              variant="contained"
              color="primary"
              onClick={handleCompare}
              disabled={!compareVersionA || !compareVersionB || loading}
            >
              Comparar
            </Button>
          </Box>

          {compareData && (
            <Box>
              <Box className={classes.compareContainer}>
                <Box className={classes.comparePane}>
                  <Typography variant="subtitle2" gutterBottom>
                    Versão {compareData.versionA?.version}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {new Date(compareData.versionA?.createdAt).toLocaleString()}
                  </Typography>
                </Box>
                <Box className={classes.comparePane}>
                  <Typography variant="subtitle2" gutterBottom>
                    Versão {compareData.versionB?.version}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {new Date(compareData.versionB?.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              <Divider style={{ margin: "16px 0" }} />

              <Typography variant="subtitle2" gutterBottom>
                Diferenças:
              </Typography>
              <Paper variant="outlined" style={{ padding: 16, maxHeight: 300, overflow: "auto" }}>
                {compareData.diff?.map((line, idx) => (
                  <div
                    key={idx}
                    className={`${classes.diffLine} ${
                      line.type === "added"
                        ? classes.addedLine
                        : line.type === "removed"
                        ? classes.removedLine
                        : classes.unchangedLine
                    }`}
                  >
                    {line.type === "added" && "+ "}
                    {line.type === "removed" && "- "}
                    {line.content}
                  </div>
                ))}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCompare(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PromptVersioning;
