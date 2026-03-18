import React from "react";
import { Tooltip, makeStyles } from "@material-ui/core";
import { green, amber, grey } from '@material-ui/core/colors';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import WarningIcon from '@material-ui/icons/Warning';
import ErrorIcon from '@material-ui/icons/Error';

const useStyles = makeStyles(theme => ({
    online: {
        color: green[600],
        fontSize: '20px'
    },
    ausente: {
        color: amber[600],
        fontSize: '20px'
    },
    offline: {
        color: grey[600],
        fontSize: '20px'
    }
}));

/**
 * Componente de ícone de status do usuário
 * 
 * Estados:
 * - Online (verde): usuário ativo nos últimos 2 minutos
 * - Ausente (amarelo): usuário inativo entre 2min e 3h
 * - Offline (cinza): usuário inativo por mais de 3h ou desconectado
 */
const UserStatusIcon = ({ user }) => {
    const classes = useStyles();
    
    // Determina o status baseado em user.status ou user.online
    const getStatus = () => {
        // Se tem status explícito (do backend)
        if (user.status === "ausente") {
            return "ausente";
        }
        
        // Se está online, verificar se é ausente por inatividade
        if (user.online) {
            // Verifica lastActivityAt para determinar se está ausente
            if (user.lastActivityAt) {
                const lastActivity = new Date(user.lastActivityAt);
                const now = new Date();
                const diffMs = now.getTime() - lastActivity.getTime();
                const diffHours = diffMs / (1000 * 60 * 60);
                
                if (diffHours >= 2 && diffHours < 3) {
                    return "ausente";
                }
            }
            return "online";
        }
        
        return "offline";
    };
    
    const status = getStatus();
    
    switch (status) {
        case "online":
            return (
                <Tooltip title="Online">
                    <CheckCircleIcon className={classes.online} />
                </Tooltip>
            );
        case "ausente":
            return (
                <Tooltip title="Ausente (inativo por 2-3h)">
                    <WarningIcon className={classes.ausente} />
                </Tooltip>
            );
        case "offline":
        default:
            return (
                <Tooltip title="Offline">
                    <ErrorIcon className={classes.offline} />
                </Tooltip>
            );
    }
};

export default UserStatusIcon;