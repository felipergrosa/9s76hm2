import React, { useContext, useEffect, useReducer, useState } from "react";

// import openSocket from "socket.io-client"; // Não utilizado

import {
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from "@material-ui/core";

import { makeStyles } from "@material-ui/core/styles";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { DeleteOutline, Edit } from "@material-ui/icons";
import PromptModal from "../../components/PromptModal";
import PromptEnhancements from "../../components/PromptEnhancements";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";
// import { SocketContext } from "../../context/Socket/SocketContext";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
}));

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

  const [prompts, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [enhancementsOpen, setEnhancementsOpen] = useState(false);
  const [templateData, setTemplateData] = useState(null);
  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);

  const { getPlanCompany } = usePlans();
  const history = useHistory();
  const companyId = user.companyId;
  const { hasPermission } = usePermissions();

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
    <MainContainer>
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
            <Title>{i18n.t("prompts.title")}</Title>
            <MainHeaderButtonsWrapper>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setEnhancementsOpen(true)}
                style={{ marginRight: 8 }}
              >
                🚀 Melhorias
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenPromptModal}
              >
                {i18n.t("prompts.buttons.add")}
              </Button>
            </MainHeaderButtonsWrapper>
          </MainHeader>
          <Paper className={classes.mainPaper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="left">
                    {i18n.t("prompts.table.name")}
                  </TableCell>
                  <TableCell align="left">
                    {i18n.t("prompts.table.queue")}
                  </TableCell>
                  <TableCell align="left">
                    {i18n.t("prompts.table.max_tokens")}
                  </TableCell>
                  <TableCell align="center">
                    {i18n.t("prompts.table.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <>
                  {prompts.map((prompt) => (
                    <TableRow key={prompt.id}>
                      <TableCell align="left">{prompt.name}</TableCell>
                      <TableCell align="left">{prompt.queue.name}</TableCell>
                      <TableCell align="left">{prompt.maxTokens}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleEditPrompt(prompt)}
                        >
                          <Edit />
                        </IconButton>

                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedPrompt(prompt);
                            setConfirmModalOpen(true);
                          }}
                        >
                          <DeleteOutline />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {loading && <TableRowSkeleton columns={4} />}
                </>
              </TableBody>
            </Table>
          </Paper>
        </>
      ) : <ForbiddenPage />}
    </MainContainer>
  );
};

export default Prompts;