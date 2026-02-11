import React from "react";
import { makeStyles, alpha } from "@material-ui/core/styles";
import {
    Paper,
    Typography,
    LinearProgress,
    Box,
    IconButton,
    Collapse,
} from "@material-ui/core";
import {
    CloudDownload as ImportIcon,
    Close as CloseIcon,
} from "@material-ui/icons";

const useStyles = makeStyles((theme) => ({
    floatingBar: {
        position: "fixed",
        top: 64, // Abaixo do header principal
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1300,
        minWidth: 350,
        maxWidth: 500,
        padding: theme.spacing(2),
        // Glassmorphism Deep UI - Ajustado para maior visibilidade
        // Forçar cor escura sólida para garantir visibilidade
        backgroundColor: "#1f2937 !important", // Cinza escuro/Slate 800 - !important para vencer modern-ui.css
        background: "linear-gradient(135deg, #1f2937 0%, #111827 100%) !important", // Gradiente sutil
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.4) !important",
        color: "#ffffff !important",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.2)",
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(1),
    },
    headerRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    titleContainer: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
    },
    progressContainer: {
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(0.5),
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        backgroundColor: "rgba(255,255,255,0.3) !important",
        "& .MuiLinearProgress-bar": {
            backgroundColor: "#fff !important",
            borderRadius: 4,
        },
    },
    progressText: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: "0.75rem",
        opacity: 0.9,
        color: "#fff !important",
    },
    titleText: {
        fontWeight: 600,
        color: "#fff !important",
    },
    closeButton: {
        color: "#fff !important",
        padding: 4,
        marginRight: -8,
    },
    stateText: {
        fontSize: "0.7rem",
        opacity: 0.8,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: "#fff !important",
    },
}));

/**
 * Componente de barra de progresso flutuante para importação de mensagens
 * @param {Object} statusImport - Objeto com { this, all, state, date }
 * @param {Function} onClose - Callback para fechar/minimizar
 */
const ImportProgressBar = ({ statusImport, onClose }) => {
    const classes = useStyles();

    // Não exibir se não há importação ativa
    if (!statusImport) return null;
    // Permite PREPARING mesmo com all=0 (total ainda desconhecido)
    if ((!statusImport.all || statusImport.all <= 0) && statusImport.state !== "PREPARING") {
        return null;
    }

    const { this: current = 0, all: total = 0, state = "IMPORTING", date } = statusImport;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    // Textos baseados no estado
    const stateLabels = {
        PREPARING: "Preparando importação...",
        IMPORTING: "Importando mensagens...",
        COMPLETED: "Importação concluída!",
    };

    return (
        <Collapse in={true}>
            <Paper className={classes.floatingBar} elevation={8}>
                <Box className={classes.headerRow}>
                    <Box className={classes.titleContainer}>
                        <ImportIcon />
                        <Typography variant="subtitle2" className={classes.titleText}>
                            Importação de Mensagens
                        </Typography>
                    </Box>
                    {onClose && (
                        <IconButton
                            className={classes.closeButton}
                            size="small"
                            onClick={onClose}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>

                <Box className={classes.progressContainer}>
                    <LinearProgress
                        variant={state === "PREPARING" ? "indeterminate" : "determinate"}
                        value={percentage}
                        className={classes.progressBar}
                    />
                    <Box className={classes.progressText}>
                        <Typography variant="caption" color="inherit">
                            {stateLabels[state] || state}
                        </Typography>
                        {state !== "PREPARING" && (
                            <Typography variant="caption" color="inherit">
                                {current} / {total} ({percentage}%)
                            </Typography>
                        )}
                    </Box>
                    {date && (
                        <Typography className={classes.stateText}>
                            Processando: {date}
                        </Typography>
                    )}
                </Box>
            </Paper>
        </Collapse>
    );
};

export default ImportProgressBar;
