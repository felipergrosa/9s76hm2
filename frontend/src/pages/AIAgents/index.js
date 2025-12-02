import React, { useState, useEffect, useReducer } from "react";
import {
    Button,
    IconButton,
    makeStyles,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
    Chip
} from "@material-ui/core";
import {
    Edit as EditIcon,
    DeleteOutline as DeleteIcon,
    Add as AddIcon
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";

import { getAIAgents, deleteAIAgent } from "../../services/aiAgents";
import AIAgentModal from "../../components/AIAgentModal";

const reducer = (state, action) => {
    if (action.type === "LOAD_AGENTS") {
        return [...action.payload];
    }
    if (action.type === "UPDATE_AGENT") {
        const agentIndex = state.findIndex(a => a.id === action.payload.id);
        if (agentIndex !== -1) {
            state[agentIndex] = action.payload;
            return [...state];
        } else {
            return [action.payload, ...state];
        }
    }
    if (action.type === "DELETE_AGENT") {
        return state.filter(a => a.id !== action.payload);
    }
    if (action.type === "RESET") {
        return [];
    }
};

const useStyles = makeStyles(theme => ({
    mainPaper: {
        flex: 1,
        padding: theme.spacing(1),
        overflowY: "scroll",
        ...theme.scrollbarStyles
    },
    customTableCell: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    }
}));

const AIAgents = () => {
    const classes = useStyles();

    const [loading, setLoading] = useState(false);
    const [agents, dispatch] = useReducer(reducer, []);
    const [agentModalOpen, setAgentModalOpen] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [deletingAgent, setDeletingAgent] = useState(null);

    useEffect(() => {
        loadAgents();
    }, []);

    const loadAgents = async () => {
        setLoading(true);
        try {
            const { agents } = await getAIAgents();
            dispatch({ type: "LOAD_AGENTS", payload: agents });
        } catch (err) {
            toast.error("Erro ao carregar agentes");
        }
        setLoading(false);
    };

    const handleOpenAgentModal = () => {
        setSelectedAgent(null);
        setAgentModalOpen(true);
    };

    const handleCloseAgentModal = () => {
        setSelectedAgent(null);
        setAgentModalOpen(false);
    };

    const handleEditAgent = (agent) => {
        setSelectedAgent(agent);
        setAgentModalOpen(true);
    };

    const handleCloseConfirmationModal = () => {
        setConfirmModalOpen(false);
        setDeletingAgent(null);
    };

    const handleDeleteAgent = async (agentId) => {
        try {
            await deleteAIAgent(agentId);
            toast.success("Agente deletado com sucesso");
            dispatch({ type: "DELETE_AGENT", payload: agentId });
        } catch (err) {
            toast.error("Erro ao deletar agente");
        }
        setDeletingAgent(null);
    };

    const getProfileLabel = (profile) => {
        const labels = {
            sales: "Vendas",
            support: "Suporte",
            service: "Atendimento",
            hybrid: "Híbrido"
        };
        return labels[profile] || profile;
    };

    const getProfileColor = (profile) => {
        const colors = {
            sales: "primary",
            support: "secondary",
            service: "default",
            hybrid: "default"
        };
        return colors[profile] || "default";
    };

    return (
        <MainContainer>
            <ConfirmationModal
                title="Deletar Agente"
                open={confirmModalOpen}
                onClose={handleCloseConfirmationModal}
                onConfirm={() => handleDeleteAgent(deletingAgent.id)}
            >
                Tem certeza que deseja deletar o agente "{deletingAgent?.name}"?
            </ConfirmationModal>

            <AIAgentModal
                open={agentModalOpen}
                onClose={handleCloseAgentModal}
                agentId={selectedAgent?.id}
                onSave={(agent) => {
                    dispatch({ type: "UPDATE_AGENT", payload: agent });
                    loadAgents();
                }}
            />

            <MainHeader>
                <Title>Agentes de IA</Title>
                <MainHeaderButtonsWrapper>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleOpenAgentModal}
                        startIcon={<AddIcon />}
                    >
                        Novo Agente
                    </Button>
                </MainHeaderButtonsWrapper>
            </MainHeader>

            <Paper className={classes.mainPaper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell align="left">Nome</TableCell>
                            <TableCell align="center">Perfil</TableCell>
                            <TableCell align="center">Filas</TableCell>
                            <TableCell align="center">Recursos</TableCell>
                            <TableCell align="center">Status</TableCell>
                            <TableCell align="center">Ações</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <>
                            {agents.map(agent => (
                                <TableRow key={agent.id}>
                                    <TableCell align="left">
                                        <Typography variant="body2">
                                            <strong>{agent.name}</strong>
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={getProfileLabel(agent.profile)}
                                            color={getProfileColor(agent.profile)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        {agent.queueIds?.length || 0}
                                    </TableCell>
                                    <TableCell align="center">
                                        {agent.voiceEnabled && <Chip label="🎤 Voz" size="small" style={{ margin: 2 }} />}
                                        {agent.imageRecognitionEnabled && <Chip label="🖼️ Imagem" size="small" style={{ margin: 2 }} />}
                                        {agent.sentimentAnalysisEnabled && <Chip label="😊 Sentimento" size="small" style={{ margin: 2 }} />}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={agent.status === "active" ? "Ativo" : "Inativo"}
                                            color={agent.status === "active" ? "primary" : "default"}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleEditAgent(agent)}
                                        >
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                setDeletingAgent(agent);
                                                setConfirmModalOpen(true);
                                            }}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {loading && <TableRowSkeleton columns={6} />}
                        </>
                    </TableBody>
                </Table>
            </Paper>
        </MainContainer>
    );
};

export default AIAgents;
