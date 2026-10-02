import React, { useState, useEffect, useReducer, useMemo } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import {
    Button,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    InputAdornment,
    FormControl,
    Select,
    Box
} from "@material-ui/core";
import {
    Search as SearchIcon,
    Pencil as EditIcon,
    Trash2 as DeleteIcon,
    Plus as AddIcon,
    Bot as BotIcon,
    Mic as MicIcon,
    Image as ImageIcon,
    Smile as SmileIcon
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import ForbiddenPage from "../../components/ForbiddenPage";
import { toast } from "react-toastify";

import { getAIAgents, deleteAIAgent } from "../../services/aiAgents";
import AIAgentModal from "../../components/AIAgentModal";
import usePermissions from "../../hooks/usePermissions";

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
    return state;
};

// ===== Estilos no padrão de listagem (referência: pages/Connections) =====
const useStyles = makeStyles((theme) => ({
    paper: {
        flex: 1,
        padding: 0,
        overflow: "hidden",
        borderRadius: 12,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing(2),
        flexWrap: "wrap",
        padding: theme.spacing(2, 2.5),
    },
    headerText: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
    },
    subtitle: {
        color: theme.palette.text.secondary,
        fontSize: "0.85rem",
    },
    headerActions: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
        flexWrap: "wrap",
    },
    toolbar: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1.5),
        flexWrap: "wrap",
        padding: theme.spacing(1.5, 2.5),
        borderTop: `1px solid ${theme.palette.divider}`,
        borderBottom: `1px solid ${theme.palette.divider}`,
        background:
            theme.palette.type === "dark"
                ? theme.palette.background.default
                : "#fafafa",
    },
    searchField: {
        minWidth: 220,
        flex: "1 1 280px",
        maxWidth: 380,
    },
    filterSelect: {
        minWidth: 150,
    },
    headCell: {
        fontWeight: 600,
        fontSize: "0.72rem",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: theme.palette.text.secondary,
        borderBottom: `1px solid ${theme.palette.divider}`,
        background:
            theme.palette.type === "dark"
                ? theme.palette.background.default
                : "#fafafa",
        whiteSpace: "nowrap",
    },
    bodyCell: {
        fontSize: "0.85rem",
        paddingTop: theme.spacing(1.25),
        paddingBottom: theme.spacing(1.25),
        borderBottom: `1px solid ${theme.palette.divider}`,
        verticalAlign: "middle",
    },
    rowHover: {
        "&:hover": {
            backgroundColor: theme.palette.action.hover,
        },
        transition: "background-color 120ms ease",
    },
    agentName: {
        fontWeight: 600,
        fontSize: "0.9rem",
        lineHeight: 1.35,
    },
    mutedText: {
        color: theme.palette.text.secondary,
        fontSize: "0.78rem",
    },
    actionsCell: {
        whiteSpace: "nowrap",
    },
    emptyState: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing(1),
        padding: theme.spacing(8, 2),
        color: theme.palette.text.secondary,
        textAlign: "center",
    },
    // Cards mobile
    mobileList: {
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: theme.spacing(1.5),
        padding: theme.spacing(1.5),
        [theme.breakpoints.up("sm")]: {
            display: "none",
        },
    },
    desktopTableWrapper: {
        [theme.breakpoints.down("sm")]: {
            display: "none",
        },
    },
    card: {
        borderRadius: 12,
        padding: theme.spacing(1.75),
        border: `1px solid ${theme.palette.divider}`,
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(1.25),
        background: theme.palette.background.paper,
    },
    cardHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing(1),
    },
    cardTitle: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1.25),
        minWidth: 0,
    },
    cardName: {
        fontWeight: 700,
        fontSize: "1rem",
        lineHeight: 1.2,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 190,
    },
    cardMeta: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: theme.spacing(1),
    },
    metaLabel: {
        fontSize: "0.72rem",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: theme.palette.text.secondary,
    },
    metaValue: {
        fontSize: "0.9rem",
        fontWeight: 600,
        wordBreak: "break-word",
    },
    cardActions: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(0.5),
        flexWrap: "wrap",
    },
    actionButton: {
        minWidth: 44,
        minHeight: 44,
    },
}));

// Rótulo + classes tailwind do chip de perfil do agente
const profileChipInfo = (profile) => {
    switch (profile) {
        case "sales":
            return {
                label: "Vendas",
                cls: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
            };
        case "support":
            return {
                label: "Suporte",
                cls: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
            };
        case "service":
            return {
                label: "Atendimento",
                cls: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
            };
        case "hybrid":
            return {
                label: "Híbrido",
                cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
            };
        default:
            return {
                label: profile || "—",
                cls: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
            };
    }
};

// Status → chip tailwind (padrão das telas de listagem)
const statusChipInfo = (agent) =>
    agent.status === "active"
        ? {
              label: "Ativo",
              cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
          }
        : {
              label: "Inativo",
              cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
          };

const ProfileChip = ({ profile }) => {
    const info = profileChipInfo(profile);
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.cls}`}>
            {info.label}
        </span>
    );
};

const StatusChip = ({ agent }) => {
    const info = statusChipInfo(agent);
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.cls}`}>
            {info.label}
        </span>
    );
};

// Chips tailwind dos recursos habilitados (voz, imagem, sentimento)
const FeatureChips = ({ agent }) => {
    const features = [];
    if (agent.voiceEnabled) {
        features.push({ key: "voice", icon: <MicIcon size={12} />, label: "Voz" });
    }
    if (agent.imageRecognitionEnabled) {
        features.push({ key: "image", icon: <ImageIcon size={12} />, label: "Imagem" });
    }
    if (agent.sentimentAnalysisEnabled) {
        features.push({ key: "sentiment", icon: <SmileIcon size={12} />, label: "Sentimento" });
    }
    if (features.length === 0) {
        return <span style={{ color: "inherit", opacity: 0.6 }}>—</span>;
    }
    return (
        <Box display="flex" alignItems="center" justifyContent="center" style={{ gap: 4, flexWrap: "wrap" }}>
            {features.map((f) => (
                <span
                    key={f.key}
                    className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 inline-flex items-center gap-1"
                >
                    {f.icon}
                    {f.label}
                </span>
            ))}
        </Box>
    );
};

const AIAgents = () => {
    const classes = useStyles();
    const theme = useTheme();

    const [loading, setLoading] = useState(false);
    const [agents, dispatch] = useReducer(reducer, []);
    const [agentModalOpen, setAgentModalOpen] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [deletingAgent, setDeletingAgent] = useState(null);
    const { hasPermission } = usePermissions();
    const canCreate = hasPermission("ai-agents.create");
    const canEdit = hasPermission("ai-agents.edit");
    const canDelete = hasPermission("ai-agents.delete");

    // Busca + filtros da toolbar (client-side, padrão Connections)
    const [searchParam, setSearchParam] = useState("");
    const [profileFilter, setProfileFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const filteredAgents = useMemo(() => {
        const search = searchParam.trim().toLowerCase();
        return (agents || []).filter((a) => {
            if (search) {
                const hay = `${a.id} ${a.name || ""} ${profileChipInfo(a.profile).label}`.toLowerCase();
                if (!hay.includes(search)) return false;
            }
            if (profileFilter && a.profile !== profileFilter) return false;
            if (statusFilter && (a.status || "") !== statusFilter) return false;
            return true;
        });
    }, [agents, searchParam, profileFilter, statusFilter]);

    useEffect(() => {
        loadAgents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Ações compartilhadas entre tabela (desktop) e cards (mobile)
    const renderActionButtons = (agent) => (
        <>
            {canEdit && (
                <IconButton
                    size="small"
                    className={classes.actionButton}
                    onClick={() => handleEditAgent(agent)}
                >
                    <EditIcon size={18} />
                </IconButton>
            )}
            {canDelete && (
                <IconButton
                    size="small"
                    className={classes.actionButton}
                    onClick={() => {
                        setDeletingAgent(agent);
                        setConfirmModalOpen(true);
                    }}
                >
                    <DeleteIcon size={18} />
                </IconButton>
            )}
        </>
    );

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

            {!hasPermission("ai-agents.view") ? (
                <ForbiddenPage />
            ) : (
                <Paper className={classes.paper} variant="outlined">
                    {/* Cabeçalho: título + contagem + subtítulo + ação primária */}
                    <div className={classes.header}>
                        <div className={classes.headerText}>
                            <Title>Agentes de IA ({filteredAgents.length})</Title>
                            <span className={classes.subtitle}>
                                Configure os agentes de inteligência artificial que atendem e qualificam contatos nas filas.
                            </span>
                        </div>
                        <div className={classes.headerActions}>
                            {canCreate && (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="small"
                                    onClick={handleOpenAgentModal}
                                    startIcon={<AddIcon size={16} />}
                                    style={{ minHeight: 36 }}
                                >
                                    Novo Agente
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Toolbar: busca + filtro de perfil + filtro de status */}
                    <div className={classes.toolbar}>
                        <TextField
                            className={classes.searchField}
                            size="small"
                            variant="outlined"
                            placeholder="Buscar por nome, perfil ou ID…"
                            value={searchParam}
                            onChange={(e) => setSearchParam(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon size={16} />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <FormControl size="small" variant="outlined" className={classes.filterSelect}>
                            <Select
                                native
                                value={profileFilter}
                                onChange={(e) => setProfileFilter(e.target.value)}
                                displayEmpty
                            >
                                <option value="">Todos os perfis</option>
                                <option value="sales">Vendas</option>
                                <option value="support">Suporte</option>
                                <option value="service">Atendimento</option>
                                <option value="hybrid">Híbrido</option>
                            </Select>
                        </FormControl>
                        <FormControl size="small" variant="outlined" className={classes.filterSelect}>
                            <Select
                                native
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                displayEmpty
                            >
                                <option value="">Todos os status</option>
                                <option value="active">Ativo</option>
                                <option value="inactive">Inativo</option>
                            </Select>
                        </FormControl>
                    </div>

                    {loading ? (
                        <Table size="small">
                            <TableBody>
                                <TableRowSkeleton columns={6} />
                            </TableBody>
                        </Table>
                    ) : filteredAgents.length === 0 ? (
                        <div className={classes.emptyState}>
                            <BotIcon size={44} style={{ color: theme.palette.text.disabled }} />
                            <div>Nenhum agente de IA encontrado.</div>
                        </div>
                    ) : (
                        <>
                            {/* Cards — mobile */}
                            <div className={classes.mobileList}>
                                {filteredAgents.map((agent) => (
                                    <div key={agent.id} className={classes.card}>
                                        <div className={classes.cardHeader}>
                                            <div className={classes.cardTitle}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className={classes.cardName} title={agent.name}>
                                                        {agent.name}
                                                    </div>
                                                </div>
                                            </div>
                                            <StatusChip agent={agent} />
                                        </div>

                                        <div className={classes.cardMeta}>
                                            <div>
                                                <div className={classes.metaLabel}>Perfil</div>
                                                <div className={classes.metaValue}>
                                                    <ProfileChip profile={agent.profile} />
                                                </div>
                                            </div>
                                            <div>
                                                <div className={classes.metaLabel}>Filas</div>
                                                <div className={classes.metaValue}>
                                                    {agent.queueIds?.length || 0}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <div className={classes.metaLabel}>Recursos</div>
                                            <div style={{ marginTop: 4 }}>
                                                <FeatureChips agent={agent} />
                                            </div>
                                        </div>

                                        <div className={classes.cardActions}>
                                            {renderActionButtons(agent)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Tabela — desktop */}
                            <div className={classes.desktopTableWrapper}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell align="left" className={classes.headCell}>Nome</TableCell>
                                            <TableCell align="center" className={classes.headCell}>Perfil</TableCell>
                                            <TableCell align="center" className={classes.headCell}>Filas</TableCell>
                                            <TableCell align="center" className={classes.headCell}>Recursos</TableCell>
                                            <TableCell align="center" className={classes.headCell}>Status</TableCell>
                                            <TableCell align="center" className={classes.headCell}>Ações</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredAgents.map((agent) => (
                                            <TableRow key={agent.id} className={classes.rowHover}>
                                                <TableCell align="left" className={classes.bodyCell}>
                                                    <span className={classes.agentName}>{agent.name}</span>
                                                </TableCell>
                                                <TableCell align="center" className={classes.bodyCell}>
                                                    <ProfileChip profile={agent.profile} />
                                                </TableCell>
                                                <TableCell align="center" className={classes.bodyCell}>
                                                    {agent.queueIds?.length || 0}
                                                </TableCell>
                                                <TableCell align="center" className={classes.bodyCell}>
                                                    <FeatureChips agent={agent} />
                                                </TableCell>
                                                <TableCell align="center" className={classes.bodyCell}>
                                                    <StatusChip agent={agent} />
                                                </TableCell>
                                                <TableCell align="center" className={`${classes.bodyCell} ${classes.actionsCell}`}>
                                                    <Box display="flex" alignItems="center" justifyContent="center">
                                                        {renderActionButtons(agent)}
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </Paper>
            )}
        </MainContainer>
    );
};

export default AIAgents;
