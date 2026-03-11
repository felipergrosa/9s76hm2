import React, { useEffect } from "react";
import withWidth, { isWidthUp } from '@material-ui/core/withWidth';
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import Tickets from "../TicketsCustom"
import TicketAdvanced from "../TicketsAdvanced";

function TicketResponsiveContainer (props) {
    const location = useLocation();

    useEffect(() => {
        // Verifica se foi redirecionado por falta de permissão
        if (location.state?.error === "ERR_NO_PERMISSION") {
            toast.error(location.state.message || "Você não tem permissão para acessar este recurso.", {
                toastId: "ERR_NO_PERMISSION_REDIRECT",
                autoClose: 5000,
            });
            // Limpa o state para não mostrar o toast novamente
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    if (isWidthUp('md', props.width)) {
        return <Tickets />;    
    }
    return <TicketAdvanced />
}

export default withWidth()(TicketResponsiveContainer);