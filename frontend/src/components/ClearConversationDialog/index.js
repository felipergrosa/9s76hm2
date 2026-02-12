import React, { useState } from "react";
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

const useStyles = makeStyles((theme) => ({
    dialogPaper: {
        borderRadius: 16,
        minWidth: 400,
    },
    title: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: theme.palette.error.main,
        "& svg": {
            color: theme.palette.error.main,
        },
    },
    content: {
        padding: theme.spacing(2, 3),
    },
    warningText: {
        color: theme.palette.error.main,
        fontWeight: 500,
        margin: theme.spacing(2, 0),
    },
    actions: {
        padding: theme.spacing(1, 3, 2),
        display: "flex",
        gap: theme.spacing(1),
        justifyContent: "flex-end",
    },
}));

const ClearConversationDialog = ({ open, onClose, ticketId, onCleared }) => {
    const classes = useStyles();
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [periodMonths, setPeriodMonths] = useState(0);

    const handleResync = async () => {
        setLoading(true);
        
        try {
            console.log(`[ResyncConversation] Ressincronizando conversa do ticket: ${ticketId}`);
            
            const response = await api.post(`/messages/${ticketId}/clear`, {
                periodMonths
            });
            
            if (response.data.success) {
                toast.success(response.data.message);
                
                // Notificar componente pai
                if (onCleared) {
                    onCleared(response.data.existing);
                }
                
                // Fechar modal
                onClose();
                
                // Emitir evento para atualizar UI do chat
                window.dispatchEvent(new CustomEvent("resyncConversation", {
                    detail: { ticketId, existing: response.data.existing }
                }));
                
            } else {
                toast.error("Falha ao ressincronizar conversa");
            }
            
        } catch (err) {
            console.error("[ResyncConversation] Erro:", err);
            toastError(err);
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
                <span>Ressincronizar Conversa</span>
            </DialogTitle>
            
            <DialogContent className={classes.content}>
                <Typography variant="body1" gutterBottom>
                    Deseja ressincronizar as mensagens desta conversa com o WhatsApp?
                </Typography>
                
                <Typography variant="body2" color="textSecondary">
                    Esta ação irá:
                </Typography>
                
                <ul style={{ margin: theme.spacing(2, 0), paddingLeft: theme.spacing(3) }}>
                    <li>Manter todas as mensagens existentes</li>
                    <li>Adicionar mensagens que faltam do WhatsApp</li>
                    <li>Preservar o histórico completo</li>
                    <li>Não apagar nenhuma mensagem</li>
                </ul>
                
                <FormControl fullWidth style={{ marginTop: theme.spacing(2) }}>
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
                
                <Typography variant="body2" color="textSecondary" style={{ marginTop: theme.spacing(1) }}>
                    A ressincronização ocorrerá em background e você verá as novas mensagens aparecendo automaticamente.
                </Typography>
            </DialogContent>
            
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
