import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import QuickMessagesPanel from "../../components/QuickMessagesPanel";

// ===== Estilos no padrão de layout das páginas de listagem (SPEC-LAYOUT-PADRAO) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    // Garante que o painel interno (height: 100%) preencha o espaço restante
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    padding: theme.spacing(2, 2.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  headerText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
}));

const Quickemessages = () => {
  const classes = useStyles();

  return (
    <MainContainer>
      <Paper className={classes.paper} variant="outlined">
        {/* Cabeçalho no padrão das páginas de listagem */}
        <div className={classes.header}>
          <div className={classes.headerText}>
            <Title>{i18n.t("quickMessages.title")}</Title>
            <span className={classes.subtitle}>
              Crie e gerencie respostas rápidas para agilizar os atendimentos.
            </span>
          </div>
        </div>

        {/* Painel compartilhado (também usado dentro de tickets) — showHeader mantido
            pois só ajusta a margem do campo de busca quando há cabeçalho acima */}
        <QuickMessagesPanel showHeader={true} />
      </Paper>
    </MainContainer>
  );
};

export default Quickemessages;
