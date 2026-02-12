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
} from "@material-ui/core";
import { DeleteSweep, AlertTriangle } from "lucide-react";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

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
    const [loading, setLoading] = useState(false);

    const handleClear = async () => {
        setLoading(true);
        
        try {
            console.log(`[ClearConversation] Limpando conversa do ticket: ${ticketId}`);
            
            const response = await api.delete(`/messages/${ticketId}/clear`);
            
            if (response.data.success) {
                toast.success(`${response.data.deleted} mensagens removidas com sucesso!`);
                
                // Notificar componente pai
                if (onCleared) {
                    onCleared(response.data.deleted);
                }
                
                // Fechar modal
                onClose();
                
                // Emitir evento para limpar UI do chat
                window.dispatchEvent(new CustomEvent("clearConversation", {
                    detail: { ticketId, deleted: response.data.deleted }
                }));
                
            } else {
                toast.error("Falha ao limpar conversa");
            }
            
        } catch (err) {
            console.error("[ClearConversation] Erro:", err);
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
                <DeleteSweep size={24} />
                <span>Limpar Conversa</span>
            </DialogTitle>
            
            <DialogContent className={classes.content}>
                <Typography variant="body1" gutterBottom>
                    Tem certeza que deseja remover todas as mensagens desta conversa?
                </Typography>
                
                <Typography variant="body2" color="textSecondary">
                    Esta ação irá:
                </Typography>
                
                <ul style={{ margin: theme.spacing(2, 0), paddingLeft: theme.spacing(3) }}>
                    <li>Remover todas as mensagens do sistema</li>
                    <li>Manter o ticket e o contato</li>
                    <li>Permitir sincronização completa do WhatsApp</li>
                </ul>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: theme.spacing(2) }}>
                    <AlertTriangle size={20} color="#f44336" />
                    <Typography variant="body2" className={classes.warningText}>
                        Esta ação não pode ser desfeita!
                    </Typography>
                </div>
                
                <Typography variant="body2" color="textSecondary" style={{ marginTop: theme.spacing(1) }}>
                    Após limpar, você poderá usar "Importar Histórico" para baixar novamente todas as mensagens do WhatsApp.
                </Typography>
            </DialogContent>
            
            <DialogActions className={classes.actions}>
                <Button onClick={onClose} disabled={loading}>
                    Cancelar
                </Button>
                <Button
                    onClick={handleClear}
                    color="secondary"
                    variant="contained"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={18} /> : <DeleteSweep size={18} />}
                >
                    {loading ? "Limpando..." : "Limpar Conversa"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ClearConversationDialog;
