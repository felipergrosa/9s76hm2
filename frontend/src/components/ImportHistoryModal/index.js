import React, { useState } from "react";
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

    const handleImport = async () => {
        setLoading(true);
        try {
            await api.post(`/messages/${ticketId}/import-history`, {
                periodMonths: Number(periodMonths),
            });
            toast.success("Importação iniciada! Acompanhe o progresso na barra superior.");
            onClose();
        } catch (err) {
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
