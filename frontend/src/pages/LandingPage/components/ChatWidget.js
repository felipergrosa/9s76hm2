import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Fab, Tooltip } from "@material-ui/core";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import { getNumberSupport } from "../../../config";

const useStyles = makeStyles((theme) => ({
    fab: {
        position: "fixed",
        bottom: theme.spacing(4),
        right: theme.spacing(4),
        zIndex: 1000,
        backgroundColor: "#25D366",
        color: "#ffffff",
        width: "60px",
        height: "60px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        "&:hover": {
            backgroundColor: "#20BA5A",
        },
        animation: "$pulse 2s infinite",
    },
    icon: {
        fontSize: "2rem",
    },
    "@keyframes pulse": {
        "0%": {
            boxShadow: "0 0 0 0 rgba(37, 211, 102, 0.7)",
        },
        "70%": {
            boxShadow: "0 0 0 15px rgba(37, 211, 102, 0)",
        },
        "100%": {
            boxShadow: "0 0 0 0 rgba(37, 211, 102, 0)",
        },
    },
}));

const ChatWidget = () => {
    const classes = useStyles();
    const supportNumber = getNumberSupport() || "5514981252988";

    const handleClick = () => {
        const link = `https://wa.me/${supportNumber.replace(/\D/g, "")}?text=Olá! Gostaria de saber mais sobre o TaktChat.`;
        window.open(link, "_blank");
    };

    return (
        <Tooltip title="Fale conosco no WhatsApp" placement="left" arrow>
            <Fab className={classes.fab} onClick={handleClick} aria-label="whatsapp-contact">
                <WhatsAppIcon className={classes.icon} />
            </Fab>
        </Tooltip>
    );
};

export default ChatWidget;
