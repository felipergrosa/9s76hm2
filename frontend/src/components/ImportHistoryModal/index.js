import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    RadioGroup,
    FormControlLabel,
    Radio,
    Typography,
    CircularProgress,
    makeStyles,
} from "@material-ui/core";
import { History } from "lucide-react";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { useAuth } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
    dialogPaper: {
        borderRadius: 16,
        minWidth: 380,
    },
    title: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        "& svg": {
            color: theme.palette.primary.main,
        },
    },
    radioGroup: {
        padding: theme.spacing(1, 0),
    },
    radioLabel: {
        marginBottom: theme.spacing(0.5),
        borderRadius: 8,
        padding: "2px 8px",
        transition: "background 0.2s",
        "&:hover": {
            background: theme.palette.action.hover,
        },
    },
    description: {
        color: theme.palette.text.secondary,
        marginBottom: theme.spacing(1),
    },
    actions: {
        padding: theme.spacing(1, 3, 2),
    },
}));

const ImportHistoryModal = ({ open, onClose, ticketId }) => {
    const classes = useStyles();
    const [periodMonths, setPeriodMonths] = useState("1");
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, state: "", date: "" });
    const { user } = useAuth();

    // Escutar eventos de progresso da importação usando SocketWorker
    useEffect(() => {
        if (!open || !user?.companyId || !ticketId) return;

        // Importar SocketWorker dinamicamente para evitar dependência circular
        import("../../services/SocketWorker").then(({ default: SocketWorker }) => {
            const socketWorker = SocketWorker(user.companyId, user.id);
            
            const eventName = `importHistory-${ticketId}`;
            
            console.log(`[ImportHistoryModal] Escutando eventos: ${eventName}`);
            console.log(`[ImportHistoryModal] SocketWorker conectado:`, socketWorker.connected);

            const handleImportUpdate = (data) => {
                console.log(`[ImportHistoryModal] Evento recebido:`, data);
                
                if (data.action === "update") {
                    setProgress({
                        current: data.status.this,
                        total: data.status.all,
                        state: data.status.state,
                        date: data.status.date
                    });
                    
                    // Se completou, mostrar mensagem de sucesso
                    if (data.status.state === "COMPLETED") {
                        if (data.status.this > 0) {
                            toast.success(`Importação concluída! ${data.status.this} mensagens importadas.`);
                            // Forçar refresh da lista de mensagens
                            window.dispatchEvent(new CustomEvent("refreshMessages"));
                        } else {
                            toast.info("Nenhuma mensagem nova encontrada no período selecionado.");
                        }
                        // Fechar modal após 2 segundos
                        setTimeout(() => {
                            onClose();
                            setProgress({ current: 0, total: 0, state: "", date: "" });
                        }, 2000);
                    }
                } else if (data.action === "refresh") {
                    // Forçar refresh da lista de mensagens
                    console.log("[ImportHistoryModal] Evento refresh recebido");
                    window.dispatchEvent(new CustomEvent("refreshMessages"));
                }
            };

            // Adicionar listener ao socket
            if (socketWorker.socket) {
                socketWorker.socket.on(eventName, handleImportUpdate);
            }

            return () => {
                if (socketWorker.socket) {
                    socketWorker.socket.off(eventName, handleImportUpdate);
                }
            };
        }).catch(err => {
            console.error("[ImportHistoryModal] Erro ao importar SocketWorker:", err);
        });
    }, [open, user, ticketId]);

    const handleImport = async () => {
        setLoading(true);
        setProgress({ current: 0, total: 0, state: "PREPARING", date: "" });
        
        try {
            console.log(`[ImportHistoryModal] Iniciando importação - ticketId: ${ticketId}, periodMonths: ${periodMonths}`);
            
            const response = await api.post(`/messages/${ticketId}/import-history`, {
                periodMonths: Number(periodMonths),
            });
            
            console.log(`[ImportHistoryModal] Resposta do backend:`, response.data);
            
            if (response.data.started) {
                toast.success("Importação iniciada! Acompanhe o progresso.");
            } else {
                toast.error("Falha ao iniciar importação.");
            }
            
            // Fechar modal após 2 segundos se não houver progresso
            setTimeout(() => {
                if (progress.state === "" || progress.state === "PREPARING") {
                    onClose();
                    setProgress({ current: 0, total: 0, state: "", date: "" });
                }
            }, 2000);
            
        } catch (err) {
            console.error("[ImportHistoryModal] Erro na importação:", err);
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
            <DialogTitle>
                <div className={classes.title}>
                    <History size={22} />
                    <span>Importar Histórico</span>
                </div>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" className={classes.description}>
                    Selecione o período de mensagens que deseja importar do WhatsApp para
                    este ticket.
                </Typography>
                <RadioGroup
                    value={periodMonths}
                    onChange={(e) => setPeriodMonths(e.target.value)}
                    className={classes.radioGroup}
                >
                    <FormControlLabel
                        value="1"
                        control={<Radio color="primary" />}
                        label="Último mês"
                        className={classes.radioLabel}
                    />
                    <FormControlLabel
                        value="3"
                        control={<Radio color="primary" />}
                        label="Últimos 3 meses"
                        className={classes.radioLabel}
                    />
                    <FormControlLabel
                        value="6"
                        control={<Radio color="primary" />}
                        label="Últimos 6 meses"
                        className={classes.radioLabel}
                    />
                    <FormControlLabel
                        value="0"
                        control={<Radio color="primary" />}
                        label="Histórico completo"
                        className={classes.radioLabel}
                    />
                </RadioGroup>
            </DialogContent>
            
            {/* Progress Indicator */}
            {progress.state && (
                <DialogContent style={{ paddingTop: 0 }}>
                    <Typography variant="body2" gutterBottom>
                        Progresso da importação:
                    </Typography>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            marginBottom: 4 
                        }}>
                            <span>{progress.state}</span>
                            <span>
                                {progress.current} / {progress.total}
                                {progress.total > 0 && ` (${Math.round((progress.current / progress.total) * 100)}%)`}
                            </span>
                        </div>
                        <div style={{ 
                            width: '100%', 
                            height: 8, 
                            backgroundColor: '#e0e0e0', 
                            borderRadius: 4, 
                            overflow: 'hidden' 
                        }}>
                            <div style={{
                                width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%',
                                height: '100%',
                                backgroundColor: '#4caf50',
                                transition: 'width 0.3s ease'
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
                    onClick={handleImport}
                    color="primary"
                    variant="contained"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={18} /> : null}
                >
                    {loading ? "Iniciando..." : "Importar"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ImportHistoryModal;
