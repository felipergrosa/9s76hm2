import React from "react";
import { Paper, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { motion, useReducedMotion } from "framer-motion";

import ContactImport from "../../components/ContactImport";
import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

// ===== Estilos no padrão SPEC-LAYOUT-PADRAO (referência: pages/ContactLists) =====
const useStyles = makeStyles((theme) => ({
    paper: {
        flex: 1,
        padding: 0,
        overflow: "hidden",
        borderRadius: 12,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing(2),
        flexWrap: "wrap",
        padding: theme.spacing(2, 2.5),
    },
    headerText: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
    },
    // Conteúdo do formulário — scroll natural da janela via useWindowScroll
    content: {
        padding: theme.spacing(0, 2.5, 2.5),
    },
}));

const ContactImportPage = () => {
    const classes = useStyles();

    // Respeita prefers-reduced-motion: troca o spring de entrada por fade simples
    const reducedMotion = useReducedMotion();
    const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

    return (
        <MainContainer useWindowScroll>
            <motion.div variants={bentoContainer} initial="hidden" animate="show">
                <motion.div variants={itemVariant}>
                    <Paper className={`${classes.paper} bento-panel`} variant="outlined">
                        {/* Cabeçalho do painel: título + instrução */}
                        <div className={classes.header}>
                            <div className={classes.headerText}>
                                <Title>Importar contatos de arquivo</Title>
                                <Typography variant="body2" color="textSecondary">
                                    Envie um arquivo xls, xlsx, csv ou txt e mapeie as colunas antes de importar.
                                </Typography>
                            </div>
                        </div>
                        <div className={classes.content}>
                            <ContactImport />
                        </div>
                    </Paper>
                </motion.div>
            </motion.div>
        </MainContainer>
    );
}

export default ContactImportPage;
