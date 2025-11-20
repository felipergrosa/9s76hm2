import React from "react";
import CookieConsent from "react-cookie-consent";
import { makeStyles } from "@material-ui/core/styles";
import { Button, Typography, Link } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
    container: {
        alignItems: "center",
        background: "#2C5364 !important",
        color: "#fff !important",
        padding: "16px 32px !important",
        boxShadow: "0 -4px 10px rgba(0,0,0,0.2)",
        zIndex: "9999 !important",
        [theme.breakpoints.down("sm")]: {
            flexDirection: "column !important",
            padding: "16px !important",
        },
    },
    content: {
        flex: "1 1 auto",
        marginRight: "16px",
        [theme.breakpoints.down("sm")]: {
            marginRight: 0,
            marginBottom: "16px",
            textAlign: "center",
        },
    },
    text: {
        fontSize: "0.9rem",
        lineHeight: 1.5,
    },
    link: {
        color: "#4fc3f7",
        textDecoration: "underline",
        cursor: "pointer",
        "&:hover": {
            color: "#81d4fa",
        },
    },
    buttonWrapper: {
        display: "flex",
        gap: "10px",
    },
    acceptButton: {
        background: "#4caf50 !important",
        color: "#fff !important",
        fontWeight: "bold !important",
        borderRadius: "8px !important",
        padding: "8px 24px !important",
        textTransform: "none !important",
        "&:hover": {
            background: "#43a047 !important",
        },
    },
    declineButton: {
        background: "transparent !important",
        border: "1px solid rgba(255,255,255,0.5) !important",
        color: "#fff !important",
        borderRadius: "8px !important",
        padding: "8px 16px !important",
        textTransform: "none !important",
        "&:hover": {
            background: "rgba(255,255,255,0.1) !important",
        },
    },
}));

const CookieBanner = () => {
    const classes = useStyles();

    return (
        <CookieConsent
            location="bottom"
            buttonText="Aceitar todos"
            declineButtonText="Recusar"
            enableDeclineButton
            cookieName="taktchat_cookie_consent"
            containerClasses={classes.container}
            contentClasses={classes.content}
            buttonClasses={classes.acceptButton}
            declineButtonClasses={classes.declineButton}
            expires={150}
            onAccept={() => {
                // Aqui você pode inicializar scripts de tracking se necessário
                console.log("Cookies aceitos");
            }}
        >
            <Typography variant="body2" className={classes.text}>
                Nós usamos cookies para melhorar sua experiência de navegação e analisar o tráfego do site.
                Ao clicar em "Aceitar todos", você concorda com o uso de cookies conforme nossa{" "}
                <Link href="/termos" className={classes.link}>
                    Política de Privacidade
                </Link>.
            </Typography>
        </CookieConsent>
    );
};

export default CookieBanner;
