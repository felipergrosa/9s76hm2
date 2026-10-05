import React, { useContext, useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Phone as CallIcon,
  Hourglass as HourglassEmptyIcon,
  CheckCircle2 as CheckCircleIcon,
  UserPlus as GroupAddIcon,
  Users as Groups,
  Download as SaveAlt,
  RefreshCw as RefreshIcon,
  SlidersHorizontal as FilterIcon,
} from "lucide-react";
import { toast } from "react-toastify";
import { isArray, isEmpty } from "lodash";
import moment from "moment";
import TableAttendantsStatus from "../../components/Dashboard/TableAttendantsStatus";
import { AuthContext } from "../../context/Auth/AuthContext";
import useDashboard from "../../hooks/useDashboard";
import { ChatsUser } from "./ChartsUser";
import { ChartsDate } from "./ChartsDate";
import ForbiddenPage from "../../components/ForbiddenPage";
import { i18n } from "../../translate/i18n";
import usePermissions from "../../hooks/usePermissions";
import BentoCard from "../../components/bento/BentoCard";
import StatCard from "../../components/bento/StatCard";
import HeroCard from "./bento/HeroCard";
import AgentsCard from "./bento/AgentsCard";
import NpsCard from "./bento/NpsCard";
import RatingsCard from "./bento/RatingsCard";
import PeriodFilter from "./bento/PeriodFilter";
import { bentoContainer } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

const Dashboard = () => {
  const [counters, setCounters] = useState({});
  const [attendants, setAttendants] = useState([]);
  const [showFilter, setShowFilter] = useState(false);
  const [dateStartTicket, setDateStartTicket] = useState(moment().startOf('month').format("YYYY-MM-DD"));
  const [dateEndTicket, setDateEndTicket] = useState(moment().format("YYYY-MM-DD"));
  const [fetchDataFilter, setFetchDataFilter] = useState(false);
  const [loading, setLoading] = useState(false);

  const { find } = useDashboard();
  const { user: loggedInUser, socket } = useContext(AuthContext);
  const { hasPermission } = usePermissions();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Sem delay artificial: dispara o fetch direto ao montar/mudar o filtro
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchDataFilter]);

  useEffect(() => {
    if (loggedInUser && socket) {
      const companyId = loggedInUser.companyId;
      const onCompanyUser = (data) => {
        if (data.action === "update" && data.user) {
          // Atualizar lista de atendentes se o usuário estiver nela
          setAttendants(prevAttendants =>
            prevAttendants.map(attendant =>
              attendant.id === data.user.id
                ? { ...attendant, ...data.user }
                : attendant
            )
          );
        }
      };

      socket.on(`company-${companyId}-user`, onCompanyUser);

      return () => {
        socket.off(`company-${companyId}-user`, onCompanyUser);
      };
    }
  }, [socket, loggedInUser]);

  async function fetchData() {
    setLoading(true);
    try {
      let params = {};
      if (!isEmpty(dateStartTicket) && moment(dateStartTicket).isValid()) {
        params = { ...params, date_from: moment(dateStartTicket).format("YYYY-MM-DD") };
      }
      if (!isEmpty(dateEndTicket) && moment(dateEndTicket).isValid()) {
        params = { ...params, date_to: moment(dateEndTicket).format("YYYY-MM-DD") };
      }
      if (Object.keys(params).length === 0) {
        toast.error("Parametrize o filtro");
        return;
      }
      const data = await find(params);
      setCounters(data.counters);
      setAttendants(isArray(data.attendants) ? data.attendants : []);
    } finally {
      setLoading(false);
    }
  }

  const exportarGridParaExcel = async () => {
    // Import dinâmico: xlsx (~1MB) só é baixado quando o usuário exporta
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.table_to_sheet(document.getElementById('grid-attendants'));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RelatorioDeAtendentes');
    XLSX.writeFile(wb, 'relatorio-de-atendentes.xlsx');
  };

  const handleApplyPeriod = (start, end) => {
    setDateStartTicket(start);
    setDateEndTicket(end);
    setFetchDataFilter(prev => !prev);
  };

  if (!hasPermission("dashboard.view")) {
    return <ForbiddenPage />;
  }

  const onlineCount = attendants.filter(a => a.online === true).length;
  const periodLabel = `${moment(dateStartTicket).format("DD/MM")} → ${moment(dateEndTicket).format("DD/MM/YYYY")}`;

  return (
    <div className="dash-bento px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="dash-title">{i18n.t("dashboard.title") || "Dashboard"}</h1>
          <p className="dash-subtitle">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`bento-icon-btn${showFilter ? " is-active" : ""}`}
            onClick={() => setShowFilter(v => !v)}
            aria-label="Filtros"
          >
            <FilterIcon size={18} />
          </button>
          <button
            type="button"
            className="bento-icon-btn"
            onClick={fetchData}
            aria-label={i18n.t("dashboard.buttons.refresh") || "Atualizar"}
          >
            <motion.span
              style={{ display: "inline-flex" }}
              animate={loading && !reducedMotion ? { rotate: 360 } : { rotate: 0 }}
              transition={loading ? { repeat: Infinity, duration: 0.9, ease: "linear" } : { duration: 0.2 }}
            >
              <RefreshIcon size={18} />
            </motion.span>
          </button>
        </div>
      </div>

      {/* Filtro de período colapsável */}
      <AnimatePresence initial={false}>
        {showFilter && (
          <motion.div
            key="period-filter"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            style={{ overflow: "hidden" }}
          >
            <div className="bento-card mb-3" style={{ height: "auto" }}>
              <PeriodFilter
                dateStart={dateStartTicket}
                dateEnd={dateEndTicket}
                loading={loading}
                onApply={handleApplyPeriod}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid bento */}
      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-12 gap-3"
      >
        {/* Hero — Em atendimento + atendentes online */}
        <HeroCard
          className="col-span-2 md:col-span-4 xl:col-span-4 xl:row-span-2"
          label={i18n.t("dashboard.cards.inAttendance")}
          value={counters.supportHappening || 0}
          icon={<CallIcon size={24} />}
          accent="#3598dc"
          attendants={attendants}
          loading={loading}
        />

        <StatCard
          className="col-span-1 md:col-span-2 xl:col-span-2"
          label={i18n.t("dashboard.cards.waiting")}
          value={counters.supportPending || 0}
          icon={<HourglassEmptyIcon size={20} />}
          accent="#32c5d2"
          loading={loading}
        />
        <StatCard
          className="col-span-1 md:col-span-2 xl:col-span-2"
          label={i18n.t("dashboard.cards.finalized")}
          value={counters.supportFinished || 0}
          icon={<CheckCircleIcon size={20} />}
          accent="#26c281"
          loading={loading}
        />
        <StatCard
          className="col-span-1 md:col-span-2 xl:col-span-2"
          label={i18n.t("dashboard.cards.groups")}
          value={counters.supportGroups || 0}
          icon={<Groups size={20} />}
          accent="#8e44ad"
          loading={loading}
        />
        <StatCard
          className="col-span-1 md:col-span-2 xl:col-span-2"
          label={i18n.t("dashboard.cards.newContacts")}
          value={counters.leads || 0}
          icon={<GroupAddIcon size={20} />}
          accent="#f39c12"
          loading={loading}
        />

        <AgentsCard
          className="col-span-2 md:col-span-2 xl:col-span-4"
          online={onlineCount}
          total={attendants.length}
          loading={loading}
        />
        <RatingsCard
          className="col-span-2 md:col-span-2 xl:col-span-4"
          counters={counters}
          loading={loading}
        />

        {/* Performance — gráfico de atendimentos por período */}
        <BentoCard hover={false} className="bento-embed col-span-2 md:col-span-4 xl:col-span-8">
          <ChartsDate />
        </BentoCard>

        {/* NPS — donut + barras */}
        <NpsCard
          className="col-span-2 md:col-span-4 xl:col-span-4"
          counters={counters}
        />

        {/* Atendentes — tabela + export */}
        <BentoCard hover={false} className="bento-embed col-span-2 md:col-span-4 xl:col-span-7">
          <div className="bento-card-header">
            <h3 className="bento-card-title">{i18n.t("dashboard.tabs.attendants")}</h3>
            <button
              type="button"
              className="bento-icon-btn"
              onClick={exportarGridParaExcel}
              aria-label="Exportar Excel"
            >
              <SaveAlt size={18} />
            </button>
          </div>
          <div id="grid-attendants">
            {attendants.length > 0 && (
              <TableAttendantsStatus attendants={attendants} loading={loading} />
            )}
            {attendants.length === 0 && !loading && (
              <p className="bento-muted" style={{ padding: "12px 0" }}>
                {i18n.t("mainDrawer.appBar.notRegister")}
              </p>
            )}
          </div>
        </BentoCard>

        {/* Atendimentos por usuário */}
        <BentoCard hover={false} className="bento-embed col-span-2 md:col-span-4 xl:col-span-5">
          <ChatsUser />
        </BentoCard>
      </motion.div>
    </div>
  );
};

export default Dashboard;
