import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import QuickMessagesPanel from "../../components/QuickMessagesPanel";
import { motion, useReducedMotion } from "framer-motion";
import { Zap, Paperclip, FolderOpen, Globe } from "lucide-react";
import StatCard from "../../components/bento/StatCard";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

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
  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  // KPIs reportados pelo painel compartilhado (dados que ele já carrega —
  // a página não faz fetch próprio, só recebe o resumo via callback)
  const [qmStats, setQmStats] = useState(null);

  return (
    <MainContainer>
      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
      >
        {/* Strip de KPIs bento — totais da lista carregada pelo painel */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Respostas rápidas" value={qmStats ? qmStats.total : 0} icon={<Zap size={20} />} accent="var(--primary-color)" loading={!qmStats} />
          <StatCard label="Com mídia" value={qmStats ? qmStats.withMedia : 0} icon={<Paperclip size={20} />} accent="#32c5d2" loading={!qmStats} />
          <StatCard label="Maior grupo" value={qmStats ? qmStats.topGroup : "—"} icon={<FolderOpen size={20} />} accent="#8e44ad" loading={!qmStats} />
          <StatCard label="Gerais" value={qmStats ? qmStats.gerais : 0} icon={<Globe size={20} />} accent="#26c281" loading={!qmStats} />
        </div>

      <motion.div variants={itemVariant} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Paper className={`${classes.paper} bento-panel`} variant="outlined">
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
            pois só ajusta a margem do campo de busca quando há cabeçalho acima.
            onStatsChange é opcional: reporta os KPIs para o strip acima. */}
        <QuickMessagesPanel showHeader={true} onStatsChange={setQmStats} />
      </Paper>
      </motion.div>
      </motion.div>
    </MainContainer>
  );
};

export default Quickemessages;
