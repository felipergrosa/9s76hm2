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
 * Estados definidos pelo backend:
 * - online: true e status não definido = Online (verde)
 * - online: true e status: "ausente" = Ausente (amarelo)  
 * - online: false = Offline (cinza)
 */
const UserStatusIcon = ({ user }) => {
    const classes = useStyles();
    
    // Lógica simplificada - backend define o status
    if (user.online === true) {
        if (user.status === "ausente") {
            return (
                <Tooltip title="Ausente">
                    <WarningIcon className={classes.ausente} />
                </Tooltip>
            );
        }
        
        return (
            <Tooltip title="Online">
                <CheckCircleIcon className={classes.online} />
            </Tooltip>
        );
    }
    
    // online === false
    return (
        <Tooltip title="Offline">
            <ErrorIcon className={classes.offline} />
        </Tooltip>
    );
};

export default UserStatusIcon;