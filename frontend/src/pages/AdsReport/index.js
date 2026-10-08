import React, { useState, useEffect, useCallback } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import {
  Grid,
  TextField,
  Typography,
} from "@material-ui/core";
import {
  Megaphone as AdsIcon,
  Users as LeadsIcon,
  CheckCircle2 as ConvertedIcon,
  TrendingUp as RateIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import moment from "moment";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import { i18n } from "../../translate/i18n";
import Title from "../../components/Title";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import StatCard from "../../components/bento/StatCard";
import {
  bentoContainer,
  bentoItem,
  bentoItemReduced,
} from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

// ===== Estilos no padrão SPEC-LAYOUT-PADRAO (referência: pages/ClosingReport) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
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
  },
  headerText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  mainPaperTable: {
    flex: 1,
  },
  // Tabela tabular: scroll horizontal contido no wrapper
  tableWrapper: {
    overflowX: "auto",
    maxWidth: "100%",
    WebkitOverflowScrolling: "touch",
  },
  mainPaperFilter: {
    padding: theme.spacing(0, 2.5, 2),
  },
  headlineCell: {
    maxWidth: 320,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  adIdCell: {
    fontFamily: "monospace",
    fontSize: 12,
  },
}));

const formatDateTime = (value) =>
  value ? moment(value).format("DD/MM/YYYY HH:mm") : "-";

const formatRate = (value) => `${Number(value || 0).toFixed(1)}%`;

const AdsReport = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState([]);
  const [totals, setTotals] = useState({
    leads: 0,
    closed: 0,
    conversionRate: 0,
    ads: 0,
  });

  // Filtro de período (padrão: mês corrente até hoje)
  const [startDate, setStartDate] = useState(
    moment().startOf("month").format("YYYY-MM-DD")
  );
  const [endDate, setEndDate] = useState(moment().format("YYYY-MM-DD"));

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/ads-report", {
        params: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      setAds(Array.isArray(data?.ads) ? data.ads : []);
      setTotals(
        data?.totals || { leads: 0, closed: 0, conversionRate: 0, ads: 0 }
      );
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // Carga inicial
  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MainContainer useWindowScroll>
      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          gap: 12,
        }}
      >
        {/* Strip de KPIs — funil CTWA do período filtrado */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard
            label={i18n.t("adsReport.cards.leads")}
            value={totals.leads}
            icon={<LeadsIcon size={20} />}
            accent="var(--primary-color)"
            loading={loading}
          />
          <StatCard
            label={i18n.t("adsReport.cards.converted")}
            value={totals.closed}
            icon={<ConvertedIcon size={20} />}
            accent="#26c281"
            loading={loading}
          />
          <StatCard
            label={i18n.t("adsReport.cards.conversionRate")}
            value={formatRate(totals.conversionRate)}
            icon={<RateIcon size={20} />}
            accent="#8e44ad"
            loading={loading}
          />
          <StatCard
            label={i18n.t("adsReport.cards.ads")}
            value={totals.ads}
            icon={<AdsIcon size={20} />}
            accent="#3598dc"
            loading={loading}
          />
        </div>

        <motion.div variants={itemVariant}>
          <Paper className={`${classes.paper} bento-panel`} variant="outlined">
            {/* Cabeçalho: título + contador + ações */}
            <div className={classes.header}>
              <div className={classes.headerText}>
                <Title>{i18n.t("adsReport.title")}</Title>
                <Typography variant="body2" color="textSecondary">
                  {totals.ads > 0
                    ? `${totals.ads} ${i18n.t("adsReport.foundSuffix")}`
                    : i18n.t("adsReport.subtitle")}
                </Typography>
              </div>
              <div className={classes.headerActions}>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={fetchReport}
                  style={{ minHeight: 44 }}
                >
                  {i18n.t("adsReport.buttons.filter")}
                </Button>
              </div>
            </div>

            {/* Filtro de período */}
            <div className={classes.mainPaperFilter}>
              <div style={{ paddingTop: "15px" }} />
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    label={i18n.t("adsReport.filters.startDate")}
                    type="date"
                    value={startDate}
                    variant="outlined"
                    fullWidth
                    size="small"
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    label={i18n.t("adsReport.filters.endDate")}
                    type="date"
                    value={endDate}
                    variant="outlined"
                    fullWidth
                    size="small"
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </div>
          </Paper>
        </motion.div>

        <motion.div
          variants={itemVariant}
          style={{ display: "flex", flexDirection: "column" }}
        >
          <Paper
            className={`${classes.mainPaperTable} bento-panel`}
            variant="outlined"
          >
            <div className={classes.tableWrapper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="left">
                      {i18n.t("adsReport.table.ad")}
                    </TableCell>
                    <TableCell align="left">
                      {i18n.t("adsReport.table.adId")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("adsReport.table.leads")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("adsReport.table.converted")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("adsReport.table.conversionRate")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("adsReport.table.firstContact")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRowSkeleton columns={6} />
                  ) : (
                    <>
                      {ads.map((ad, index) => (
                        <TableRow key={ad.adId || `sem-ad-${index}`}>
                          <TableCell
                            align="left"
                            className={classes.headlineCell}
                            title={ad.headline || ""}
                          >
                            {ad.headline || "-"}
                          </TableCell>
                          <TableCell align="left" className={classes.adIdCell}>
                            {ad.adId || i18n.t("adsReport.table.noAdId")}
                          </TableCell>
                          <TableCell align="center">{ad.leads}</TableCell>
                          <TableCell align="center">{ad.closed}</TableCell>
                          <TableCell align="center">
                            {formatRate(ad.conversionRate)}
                          </TableCell>
                          <TableCell align="center">
                            {formatDateTime(ad.firstContactAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!loading && ads.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            {i18n.t("adsReport.empty")}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </Paper>
        </motion.div>
      </motion.div>
    </MainContainer>
  );
};

export default AdsReport;
