import React, { useContext, useEffect, useReducer, useState, useMemo } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, IconButton, Button, Tooltip } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import { DeleteOutline, Edit } from "@material-ui/icons";
import { Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles } from "lucide-react";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import PromptModal from "../../components/PromptModal";
import PromptEnhancements from "../../components/PromptEnhancements";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background.default,
    minHeight: "100%",
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  container: {
    width: "100%",
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHead: {
    backgroundColor: theme.palette.grey[100],
    "& th": {
      padding: theme.spacing(1.5),
      textAlign: "left",
      fontSize: "0.75rem",
      fontWeight: 600,
      textTransform: "uppercase",
      color: theme.palette.text.secondary,
      borderBottom: `2px solid ${theme.palette.divider}`,
    },
  },
  sortButton: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
    "&:hover": {
      opacity: 0.8,
    },
  },
  sortIcon: {
    fontSize: "0.75rem",
    opacity: 0.6,
  },
  tableBody: {
    "& tr": {
      borderBottom: `1px solid ${theme.palette.divider}`,
      transition: "background-color 0.2s",
      "&:hover": {
        backgroundColor: theme.palette.action.hover,
      },
      "&:last-child": {
        borderBottom: "none",
      },
    },
    "& td": {
      padding: theme.spacing(1.5),
      fontSize: "0.875rem",
      color: theme.palette.text.primary,
    },
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
}));

const CustomTooltipProps = {
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5000,
  enterDelay: 300,
  leaveDelay: 100,
};

const reducer = (state, action) => {
  if (action.type === "LOAD_PROMPTS") {
    const prompts = action.payload;
    const newPrompts = [];

    prompts.forEach((prompt) => {
      const promptIndex = state.findIndex((p) => p.id === prompt.id);
      if (promptIndex !== -1) {
        state[promptIndex] = prompt;
      } else {
        newPrompts.push(prompt);
      }
    });

    return [...state, ...newPrompts];
  }

  if (action.type === "UPDATE_PROMPTS") {
    const prompt = action.payload;
    const promptIndex = state.findIndex((p) => p.id === prompt.id);

    if (promptIndex !== -1) {
      state[promptIndex] = prompt;
      return [...state];
    } else {
      return [prompt, ...state];
    }
  }

  if (action.type === "DELETE_PROMPT") {
    const promptId = action.payload;
    const promptIndex = state.findIndex((p) => p.id === promptId);
    if (promptIndex !== -1) {
      state.splice(promptIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const Prompts = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));

  const [prompts, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [enhancementsOpen, setEnhancementsOpen] = useState(false);
  const [templateData, setTemplateData] = useState(null);
  const { user, socket } = useContext(AuthContext);

  const { getPlanCompany } = usePlans();
  const history = useHistory();
  const companyId = user.companyId;
  const { hasPermission } = usePermissions();

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    async function fetchData() {
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useOpenAi) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`)
        }, 1000);
      }
    }
    fetchData();
  }, [companyId, history]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/prompt");
        dispatch({ type: "LOAD_PROMPTS", payload: data.prompts });

        setLoading(false);
      } catch (err) {
        toastError(err);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    // const socket = socketManager.GetSocket();

    const onPromptEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_PROMPTS", payload: data.prompt });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_PROMPT", payload: data.promptId });
      }
    };

    socket.on(`company-${companyId}-prompt`, onPromptEvent);
    return () => {
      socket.off(`company-${companyId}-prompt`, onPromptEvent);
    };
  }, [socket]);

  const handleOpenPromptModal = () => {
    setPromptModalOpen(true);
    setSelectedPrompt(null);
    setTemplateData(null);
  };

  const handleClosePromptModal = () => {
    setPromptModalOpen(false);
    setSelectedPrompt(null);
    setTemplateData(null);
  };

  const handleEditPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setPromptModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedPrompt(null);
  };

  const handleDeletePrompt = async (promptId) => {
    try {
      const { data } = await api.delete(`/prompt/${promptId}`);
      toast.info(i18n.t(data.message));
    } catch (err) {
      toastError(err);
    }
    setSelectedPrompt(null);
  };

  const handleSelectTemplate = (template) => {
    setTemplateData({
      name: template.name,
      prompt: template.prompt,
      integrationId: null,
      queueId: null,
      maxMessages: 10,
      // Aplicar primeira voz sugerida se disponível
      voice: template.suggestedVoices && template.suggestedVoices.length > 0 
        ? template.suggestedVoices[0] 
        : "texto",
      voiceKey: "",
      voiceRegion: "",
      // Aplicar configurações de IA do template
      temperature: template.temperature || 0.9,
      maxTokens: template.maxTokens || 300,
      // Passar dados adicionais do template
      suggestedVoices: template.suggestedVoices,
      ragSuggestions: template.ragSuggestions,
      integrationType: template.integrationType,
      difficulty: template.difficulty,
      score: template.score,
      variables: template.variables
    });

    const voiceMessage = template.suggestedVoices && template.suggestedVoices.length > 0 
      ? ` Voz "${template.suggestedVoices[0].replace('pt-BR-', '').replace('Neural', '')}" aplicada automaticamente.`
      : "";
    
    const tempMessage = template.temperature 
      ? ` Temperatura: ${template.temperature}`
      : "";

    toast.success(`Template "${template.name}" aplicado!${voiceMessage}${tempMessage} Ajuste os detalhes e salve.`);

    setSelectedPrompt(null);
    setPromptModalOpen(true);
  };

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
      <ConfirmationModal
        title={
          selectedPrompt &&
          `${i18n.t("prompts.confirmationModal.deleteTitle")} ${selectedPrompt.name
          }?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeletePrompt(selectedPrompt.id)}
      >
        {i18n.t("prompts.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <PromptModal
        open={promptModalOpen}
        onClose={handleClosePromptModal}
        promptId={selectedPrompt?.id}
        templateData={templateData}
      />
      <PromptEnhancements
        open={enhancementsOpen}
        onClose={() => setEnhancementsOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />
      {hasPermission("prompts.view") ? (
        <>
          <MainHeader>
                <Grid style={{ width: "99.6%" }} container>
                  <Grid xs={12} sm={5} item>
                    <Title>
                      {i18n.t("prompts.title")} ({prompts.length})
                    </Title>
                  </Grid>
                  <Grid xs={12} sm={7} item>
                    <Grid container alignItems="center" spacing={2}>
                      <Grid item>
                        <Tooltip {...CustomTooltipProps} title="Melhorias">
              <Button
                variant="outlined"
                            size="small"
                onClick={() => setEnhancementsOpen(true)}
                            style={{ 
                              color: "#6366f1",
                              backgroundColor: "#ffffff",
                              border: "1px solid #6366f1",
                              borderRadius: "8px",
                              marginRight: 8
                            }}
                            startIcon={<Sparkles className="w-4 h-4" />}
                          >
                            Melhorias
              </Button>
                        </Tooltip>
                      </Grid>
                      <Grid item>
                        <Tooltip {...CustomTooltipProps} title={i18n.t("prompts.buttons.add")}>
              <Button
                            onClick={handleOpenPromptModal}
                variant="contained"
                            size="small"
                            style={{ 
                              backgroundColor: "#4ade80",
                              color: "#ffffff",
                              textTransform: "uppercase",
                              fontWeight: 600,
                              borderRadius: "8px"
                            }}
                            startIcon={<Plus className="w-4 h-4" />}
                            aria-label={i18n.t("prompts.buttons.add")}
              >
                {i18n.t("prompts.buttons.add")}
              </Button>
                        </Tooltip>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
          </MainHeader>
              {isDesktop ? (
          <Paper className={classes.mainPaper} variant="outlined">
                  <Box style={{ overflowX: "auto" }}>
                    <table className={classes.table}>
                      <thead className={classes.tableHead}>
                        <tr>
                          <th scope="col" style={{ textAlign: "left" }}>
                            <button 
                              onClick={() => handleSort('name')} 
                              className={classes.sortButton}
                            >
                              {i18n.t("prompts.table.name").toUpperCase()}
                              <span className={classes.sortIcon}>
                                {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={{ textAlign: "left" }}>
                            <button 
                              onClick={() => handleSort('queue')} 
                              className={classes.sortButton}
                            >
                              {i18n.t("prompts.table.queue").toUpperCase()}
                              <span className={classes.sortIcon}>
                                {sortField === 'queue' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={{ textAlign: "left" }}>
                            <button 
                              onClick={() => handleSort('maxTokens')} 
                              className={classes.sortButton}
                            >
                              {i18n.t("prompts.table.max_tokens").toUpperCase()}
                              <span className={classes.sortIcon}>
                                {sortField === 'maxTokens' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("prompts.table.actions").toUpperCase()}
                          </th>
                        </tr>
                      </thead>
                      <tbody className={classes.tableBody}>
                        {!loading && prompts.length === 0 && (
                          <tr>
                            <td colSpan={4} className={classes.emptyState}>
                              Nenhum prompt encontrado.
                            </td>
                          </tr>
                        )}
                        {prompts.map((prompt) => (
                          <tr key={prompt.id}>
                            <td style={{ textAlign: "left" }}>{prompt.name}</td>
                            <td style={{ textAlign: "left" }}>{prompt.queue?.name || '-'}</td>
                            <td style={{ textAlign: "left" }}>{prompt.maxTokens}</td>
                            <td style={{ textAlign: "center" }}>
                              <Tooltip {...CustomTooltipProps} title="Editar">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditPrompt(prompt)}
                                  style={{
                                    color: "#374151",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    marginRight: 4
                                  }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip {...CustomTooltipProps} title="Deletar">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setSelectedPrompt(prompt);
                                    setConfirmModalOpen(true);
                                  }}
                                  style={{
                                    color: "#dc2626",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px"
                                  }}
                                >
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </td>
                          </tr>
                        ))}
                        {loading && <TableRowSkeleton columns={4} />}
                      </tbody>
                    </table>
                  </Box>
                </Paper>
              ) : (
                /* Mobile View */
                <>
                  <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
                    {!loading && prompts.length === 0 && (
                      <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        Nenhum prompt encontrado.
                      </div>
                    )}
                  {prompts.map((prompt) => (
                      <div key={prompt.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm">{prompt.name}</span>
                          <div className="flex gap-1">
                            <Tooltip {...CustomTooltipProps} title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => handleEditPrompt(prompt)}
                                style={{
                                  color: "#374151",
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "8px"
                                }}
                        >
                                <Edit fontSize="small" />
                        </IconButton>
                            </Tooltip>
                            <Tooltip {...CustomTooltipProps} title="Deletar">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedPrompt(prompt);
                            setConfirmModalOpen(true);
                          }}
                                style={{
                                  color: "#dc2626",
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "8px"
                                }}
                        >
                                <DeleteOutline fontSize="small" />
                        </IconButton>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <div>Fila: {prompt.queue?.name || '-'}</div>
                          <div>Max Tokens: {prompt.maxTokens}</div>
                        </div>
                      </div>
                  ))}
                  {loading && <TableRowSkeleton columns={4} />}
                  </div>
                </>
              )}
        </>
      ) : <ForbiddenPage />}
        </Box>
    </MainContainer>
    </Box>
  );
};

export default Prompts;