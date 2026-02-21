import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    CircularProgress,
    makeStyles,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from "@material-ui/core";
import { RefreshCw, AlertTriangle } from "lucide-react";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { useTheme } from "@material-ui/core/styles";
import useAuth from "../../hooks/useAuth.js/index.js";

const useStyles = makeStyles((theme) => ({
    dialogPaper: {
        borderRadius: 16,
        minWidth: 400,
    },
    title: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: theme.palette.primary.main,
        "& svg": {
            color: theme.palette.primary.main,
        },
    },
    content: {
        padding: theme.spacing(2, 3),
    },
    warningText: {
        color: "#ff9800",
        fontWeight: 500,
        margin: theme.spacing(2, 0),
    },
    actions: {
        padding: theme.spacing(1, 3, 2),
        display: "flex",
        gap: theme.spacing(1),
        justifyContent: "flex-end",
    },
    progressBar: {
        width: '100%',
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#4caf50',
        transition: 'width 0.3s ease',
    },
}));

const ClearConversationDialog = ({ open, onClose, ticketId, onCleared }) => {
    const classes = useStyles();
    const theme = useTheme();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [periodMonths, setPeriodMonths] = useState(0);
    const [progress, setProgress] = useState({ current: 0, total: 0, state: "", date: "" });

    // Escutar eventos de progresso da ressincronização via Socket
    useEffect(() => {
        if (!open || !user?.companyId || !ticketId) return;

        import("../../services/SocketWorker").then(({ default: SocketWorker }) => {
            const socketWorker = SocketWorker(user.companyId, user.id);
            const eventName = `resync-${ticketId}`;

            const handleResyncUpdate = (data) => {
                console.log(`[ResyncDialog] Evento recebido:`, data);

                if (data.action === "update") {
                    setProgress({
                        current: data.status?.this || 0,
                        total: data.status?.all || 0,
                        state: data.status?.state || "",
                        date: data.status?.date || ""
                    });

                    if (data.status?.state === "COMPLETED") {
                        if (data.status?.this > 0) {
                            toast.success(`Ressincronização concluída! ${data.status.this} mensagens sincronizadas.`);
                            window.dispatchEvent(new CustomEvent("refreshMessages"));
                        } else {
                            toast.info("Nenhuma mensagem nova encontrada.");
                        }
                        setTimeout(() => {
                            onClose();
                            setProgress({ current: 0, total: 0, state: "", date: "" });
                        }, 2000);
                    }
                } else if (data.action === "refresh") {
                    window.dispatchEvent(new CustomEvent("refreshMessages"));
                }
            };

            if (socketWorker.socket) {
                socketWorker.socket.on(eventName, handleResyncUpdate);
            }

            return () => {
                if (socketWorker.socket) {
                    socketWorker.socket.off(eventName, handleResyncUpdate);
                }
            };
        }).catch(err => {
            console.error("[ResyncDialog] Erro ao importar SocketWorker:", err);
        });
    }, [open, user, ticketId, onClose]);

    const handleResync = async () => {
        setLoading(true);
        setProgress({ current: 0, total: 0, state: "PREPARING", date: "" });

        try {
            console.log(`[ResyncDialog] Ressincronizando histórico do ticket: ${ticketId}, período: ${periodMonths} meses`);

            // Usar endpoint de resync que usa SyncChatHistoryService com forceSync
            const response = await api.post(`/messages/${ticketId}/resync`, {
                periodMonths
            });

            console.log(`[ResyncDialog] Resposta do backend:`, response.data);

            if (response.data.started) {
                toast.success("Ressincronização iniciada! Acompanhe o progresso.");
            } else if (response.data.success) {
                toast.success(response.data.message);
                if (onCleared) {
                    onCleared(response.data.synced || 0);
                }
                onClose();
                window.dispatchEvent(new CustomEvent("refreshMessages"));
            } else {
                toast.error("Falha ao ressincronizar histórico.");
            }

        } catch (err) {
            console.error("[ResyncDialog] Erro:", err);
            toastError(err);
            setProgress({ current: 0, total: 0, state: "", date: "" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            classes={{ paper: classes.dialogPaper }}
            maxWidth="xs"
            fullWidth
        >
            <DialogTitle className={classes.title}>
                <RefreshCw size={24} />
                <span>Ressincronizar Histórico</span>
            </DialogTitle>

            <DialogContent className={classes.content}>
                <Typography variant="body1" gutterBottom>
                    Deseja ressincronizar as mensagens desta conversa com o WhatsApp?
                </Typography>

                <Typography variant="body2" color="textSecondary">
                    Esta ação irá:
                </Typography>

                <ul style={{ margin: 16, paddingLeft: 24 }}>
                    <li>Manter todas as mensagens existentes</li>
                    <li>Buscar mensagens que faltam do WhatsApp</li>
                    <li>Preservar o histórico completo</li>
                    <li>Não apagar nenhuma mensagem</li>
                </ul>

                <FormControl fullWidth style={{ marginTop: 16 }}>
                    <InputLabel id="period-months-label">Período do histórico</InputLabel>
                    <Select
                        labelId="period-months-label"
                        value={periodMonths}
                        onChange={(e) => setPeriodMonths(e.target.value)}
                        label="Período do histórico"
                    >
                        <MenuItem value={0}>Histórico completo</MenuItem>
                        <MenuItem value={1}>Último mês</MenuItem>
                        <MenuItem value={3}>Últimos 3 meses</MenuItem>
                        <MenuItem value={6}>Últimos 6 meses</MenuItem>
                    </Select>
                </FormControl>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: theme.spacing(2) }}>
                    <AlertTriangle size={20} color="#ff9800" />
                    <Typography variant="body2" style={{ color: '#ff9800' }}>
                        O histórico existente será preservado!
                    </Typography>
                </div>
            </DialogContent>

            {/* Progress Indicator */}
            {progress.state && (
                <DialogContent style={{ paddingTop: 0 }}>
                    <Typography variant="body2" gutterBottom>
                        Progresso da ressincronização:
                    </Typography>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 4
                        }}>
                            <span>{progress.state === 'FETCHING' ? 'Buscando' : progress.state}</span>
                            <span>
                                {progress.total > 0 ? (
                                    `${progress.current} / ${progress.total} (${Math.round((progress.current / progress.total) * 100)}%)`
                                ) : progress.total === -1 ? (
                                    `${progress.current} localizadas...`
                                ) : (
                                    progress.current
                                )}
                            </span>
                        </div>
                        <div className={classes.progressBar}>
                            <div className={classes.progressFill} style={{
                                width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : progress.total === -1 ? '100%' : '0%',
                                opacity: progress.total === -1 ? 0.6 : 1
                            }} />
                        </div>
                        {progress.date && (
                            <Typography variant="caption" color="textSecondary">
                                Data: {progress.date}
                            </Typography>
                        )}
                    </div>
                </DialogContent>
            )}

            <DialogActions className={classes.actions}>
                <Button onClick={onClose} disabled={loading}>
                    Cancelar
                </Button>
                <Button
                    onClick={handleResync}
                    color="primary"
                    variant="contained"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={18} /> : <RefreshCw size={18} />}
                >
                    {loading ? "Ressincronizando..." : "Ressincronizar"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ClearConversationDialog;
