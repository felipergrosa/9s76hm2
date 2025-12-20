import React, { useContext, useEffect, useReducer, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import useHelps from "../hooks/useHelps";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import Avatar from "@material-ui/core/Avatar";
import Badge from "@material-ui/core/Badge";
import Collapse from "@material-ui/core/Collapse";
import List from "@material-ui/core/List";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";

import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@material-ui/icons/ContactPhoneOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import CodeRoundedIcon from "@material-ui/icons/CodeRounded";
import ViewKanban from "@mui/icons-material/ViewKanban";
import Schedule from "@material-ui/icons/Schedule";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import PeopleIcon from "@material-ui/icons/People";
import ListIcon from "@material-ui/icons/ListAlt";
import AnnouncementIcon from "@material-ui/icons/Announcement";
import ForumIcon from "@material-ui/icons/Forum";
import LocalAtmIcon from "@material-ui/icons/LocalAtm";
import BusinessIcon from "@material-ui/icons/Business";
import {
  AllInclusive,
  AttachFile,
  Dashboard,
  Description,
  DeviceHubOutlined,
  GridOn,
  ListAlt,
  PhonelinkSetup,
  Memory,
} from "@material-ui/icons";

import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { useActiveMenu } from "../context/ActiveMenuContext";

import { Can } from "../components/Can";
import usePermissions from "../hooks/usePermissions";

import { isArray } from "lodash";
import api from "../services/api";
import toastError from "../errors/toastError";
import usePlans from "../hooks/usePlans";
import useVersion from "../hooks/useVersion";
import { i18n } from "../translate/i18n";
import { Campaign, ShapeLine, Webhook, SmartToy } from "@mui/icons-material";

const useStyles = makeStyles((theme) => ({
  listItem: {
    height: "44px",
    width: "auto",
    "&:hover $iconHoverActive": {
      backgroundColor: theme.palette.primary.main,
      color: "#fff",
    },
  },

  listItemText: {
    fontSize: "14px",
    color: theme.mode === "light" ? "#666" : "#FFF",
  },
  avatarActive: {
    backgroundColor: "transparent",
  },
  avatarHover: {
    backgroundColor: "transparent",
  },
  iconHoverActive: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "50%",
    height: 36,
    width: 36,
    backgroundColor: theme.mode === "light" ? "rgba(120,120,120,0.1)" : "rgba(120,120,120,0.5)",
    color: theme.mode === "light" ? "#666" : "#FFF",
    // color: theme.mode === "light" ? theme.palette.primary.main : "#FFF",
    "&:hover, &.active": {
      backgroundColor: theme.palette.primary.main,
      color: "#fff",
    },
    "& .MuiSvgIcon-root": {
      fontSize: "1.4rem",
    },
  },
}));

function ListItemLink(props) {
  const { icon, primary, to, tooltip, showBadge } = props;
  const classes = useStyles();
  const { activeMenu } = useActiveMenu();
  const location = useLocation();
  const isActive = activeMenu === to || location.pathname === to;

  const renderLink = React.useMemo(
    () => React.forwardRef((itemProps, ref) => <RouterLink to={to} ref={ref} {...itemProps} />),
    [to]
  );

  const ConditionalTooltip = ({ children, tooltipEnabled }) =>
    tooltipEnabled ? (
      <Tooltip title={primary} placement="right">
        {children}
      </Tooltip>
    ) : (
      children
    );

  return (
    <ConditionalTooltip tooltipEnabled={!!tooltip}>
      <li>
        <ListItem button component={renderLink} className={classes.listItem}>
          {icon ? (
            <ListItemIcon>
              {showBadge ? (
                <Badge badgeContent="!" color="error" overlap="circular" className={classes.badge}>
                  <Avatar className={`${classes.iconHoverActive} ${isActive ? "active" : ""}`}>{icon}</Avatar>
                </Badge>
              ) : (
                <Avatar className={`${classes.iconHoverActive} ${isActive ? "active" : ""}`}>{icon}</Avatar>
              )}
            </ListItemIcon>
          ) : null}
          <ListItemText primary={<Typography className={classes.listItemText}>{primary}</Typography>} />
        </ListItem>
      </li>
    </ConditionalTooltip>
  );
}

const reducer = (state, action) => {
  if (action.type === "LOAD_CHATS") {
    const chats = action.payload;
    const newChats = [];

    if (isArray(chats)) {
      chats.forEach((chat) => {
        const chatIndex = state.findIndex((u) => u.id === chat.id);
        if (chatIndex !== -1) {
          state[chatIndex] = chat;
        } else {
          newChats.push(chat);
        }
      });
    }

    return [...state, ...newChats];
  }

  if (action.type === "UPDATE_CHATS") {
    const chat = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chat.id);

    if (chatIndex !== -1) {
      state[chatIndex] = chat;
      return [...state];
    } else {
      return [chat, ...state];
    }
  }

  if (action.type === "DELETE_CHAT") {
    const chatId = action.payload;

    const chatIndex = state.findIndex((u) => u.id === chatId);
    if (chatIndex !== -1) {
      state.splice(chatIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "CHANGE_CHAT") {
    const changedChats = state.map((chat) => {
      if (chat.id === action.payload.chat.id) {
        return action.payload.chat;
      }
      return chat;
    });
    return changedChats;
  }
};

const MainListItems = ({ collapsed, drawerClose }) => {
  const theme = useTheme();
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user, socket } = useContext(AuthContext);
  const { setActiveMenu } = useActiveMenu();
  const location = useLocation();
  const { hasPermission, hasAnyPermission, isAdmin } = usePermissions();

  const [connectionWarning, setConnectionWarning] = useState(false);
  const [openCampaignSubmenu, setOpenCampaignSubmenu] = useState(false);
  const [openFlowSubmenu, setOpenFlowSubmenu] = useState(false);
  const [openDashboardSubmenu, setOpenDashboardSubmenu] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

  // novas features
  const [showSchedules, setShowSchedules] = useState(false);
  const [showInternalChat, setShowInternalChat] = useState(false);
  const [showExternalApi, setShowExternalApi] = useState(false);

  const [invisible, setInvisible] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const [versionInfo, setVersionInfo] = useState({ frontend: "", backend: "", commit: "", commitShort: "", buildDate: "" });
  const [managementHover, setManagementHover] = useState(false);
  const [campaignHover, setCampaignHover] = useState(false);
  const [flowHover, setFlowHover] = useState(false);
  const [openIASubmenu, setOpenIASubmenu] = useState(false);
  const [iaHover, setIaHover] = useState(false);
  const { list } = useHelps();
  const [hasHelps, setHasHelps] = useState(false);


  useEffect(() => {
    async function checkHelps() {
      const helps = await list();
      setHasHelps(helps.length > 0);
    }
    checkHelps();
  }, []);

  const isManagementActive =
    location.pathname === "/" || location.pathname.startsWith("/reports") || location.pathname.startsWith("/moments");

  const isCampaignRouteActive =
    location.pathname === "/campaigns" ||
    location.pathname.startsWith("/contact-lists") ||
    location.pathname.startsWith("/campaigns-config");

  const isFlowbuilderRouteActive =
    location.pathname.startsWith("/phrase-lists") ||
    location.pathname.startsWith("/flowbuilders");

  const isIARouteActive =
    location.pathname === "/ai-agents" ||
    location.pathname === "/prompts" ||
    location.pathname === "/ai-settings" ||
    location.pathname === "/ai-training" ||
    location.pathname === "/files";

  useEffect(() => {
    if (location.pathname.startsWith("/tickets")) {
      setActiveMenu("/tickets");
    } else {
      setActiveMenu("");
    }
  }, [location, setActiveMenu]);

  const { getPlanCompany } = usePlans();

  const { getVersion } = useVersion();

  useEffect(() => {
    async function fetchVersion() {
      const data = await getVersion();
      const frontendVersion = data?.version || "N/A";
      const backendVersion = data?.backend?.version || "N/A";
      // backendLabel não será usado na UI (exibiremos apenas a versão pura do backend)
      const commit = data?.backend?.commit || "N/A";
      const commitShort = data?.backend?.commitShort || (commit && commit.length >= 6 ? commit.substring(0, 6) : commit);
      const buildDateRaw = data?.backend?.buildDate || "N/A";
      let buildDate = buildDateRaw;
      try {
        const d = new Date(buildDateRaw);
        if (!isNaN(d.getTime())) {
          buildDate = d.toLocaleString();
        }
      } catch (e) {
        // ignore parse errors, keep raw string
      }
      setVersionInfo({ frontend: frontendVersion, backend: backendVersion, commit, commitShort, buildDate });
    }
    fetchVersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);

      setShowCampaigns(planConfigs.plan.useCampaigns);
      setShowKanban(planConfigs.plan.useKanban);
      setShowOpenAi(planConfigs.plan.useOpenAi);
      setShowIntegrations(planConfigs.plan.useIntegrations);
      setShowSchedules(planConfigs.plan.useSchedules);
      setShowInternalChat(planConfigs.plan.useInternalChat);
      setShowExternalApi(planConfigs.plan.useExternalApi);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

  useEffect(() => {
    if (user.id) {
      const companyId = user.companyId;
      //    const socket = socketManager.GetSocket();
      // console.log('socket nListItems')
      const onCompanyChatMainListItems = (data) => {
        if (data.action === "new-message") {
          dispatch({ type: "CHANGE_CHAT", payload: data });
        }
        if (data.action === "update") {
          dispatch({ type: "CHANGE_CHAT", payload: data });
        }
      };

      socket.on(`company-${companyId}-chat`, onCompanyChatMainListItems);
      return () => {
        socket.off(`company-${companyId}-chat`, onCompanyChatMainListItems);
      };
    }
  }, [socket]);

  useEffect(() => {
    let unreadsCount = 0;
    if (chats.length > 0) {
      for (let chat of chats) {
        for (let chatUser of chat.users) {
          if (chatUser.userId === user.id) {
            unreadsCount += chatUser.unreads;
          }
        }
      }
    }
    if (unreadsCount > 0) {
      setInvisible(false);
    } else {
      setInvisible(true);
    }
  }, [chats, user.id]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_CHATS", payload: data.records });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div onClick={drawerClose}>
      {/* BLOCO LEGADO - Apenas itens diretos (Dashboard antigo e Tempo Real) */}
      {((user.profile === "admin" || user.profile === "super") ||
        (user.profile === "user" && user.showDashboard === "enabled")) && (
          <ListItemLink
            to="/"
            primary="Dashboard"
            icon={<DashboardOutlinedIcon />}
            tooltip={collapsed}
          />
        )}
      {((user.profile === "admin" || user.profile === "super") ||
        (user.profile === "user" && user.allowRealTime === "enabled")) && (
          <ListItemLink
            to="/moments"
            primary={i18n.t("mainDrawer.listItems.chatsTempoReal")}
            icon={<GridOn />}
            tooltip={collapsed}
          />
        )}

      {/* MENU PRINCIPAL */}
      {hasPermission("tickets.view") && (
        <ListItemLink
          to="/tickets"
          primary={i18n.t("mainDrawer.listItems.tickets")}
          icon={<WhatsAppIcon />}
          tooltip={collapsed}
        />
      )}

      {hasPermission("quick-messages.view") && (
        <ListItemLink
          to="/quick-messages"
          primary={i18n.t("mainDrawer.listItems.quickMessages")}
          icon={<FlashOnIcon />}
          tooltip={collapsed}
        />
      )}

      {showKanban && hasPermission("kanban.view") && (
        <ListItemLink
          to="/kanban"
          primary={i18n.t("mainDrawer.listItems.kanban")}
          icon={<ViewKanban />}
          tooltip={collapsed}
        />
      )}

      {hasPermission("contacts.view") && (
        <ListItemLink
          to="/contacts"
          primary={i18n.t("mainDrawer.listItems.contacts")}
          icon={<ContactPhoneOutlinedIcon />}
          tooltip={collapsed}
        />
      )}

      {showSchedules && hasPermission("schedules.view") && (
        <ListItemLink
          to="/schedules"
          primary={i18n.t("mainDrawer.listItems.schedules")}
          icon={<Schedule />}
          tooltip={collapsed}
        />
      )}

      {hasPermission("tags.view") && (
        <ListItemLink
          to="/tags"
          primary={i18n.t("mainDrawer.listItems.tags")}
          icon={<LocalOfferIcon />}
          tooltip={collapsed}
        />
      )}

      {showInternalChat && hasPermission("internal-chat.view") && (
        <ListItemLink
          to="/chats"
          primary={i18n.t("mainDrawer.listItems.chats")}
          icon={
            <Badge color="secondary" variant="dot" invisible={invisible}>
              <ForumIcon />
            </Badge>
          }
          tooltip={collapsed}
        />
      )}

      {/* <ListItemLink
        to="/todolist"
        primary={i18n.t("ToDoList")}
        icon={<EventAvailableIcon />}
      /> */}

      {hasPermission("helps.view") && (
        <ListItemLink
          to="/helps"
          primary={i18n.t("mainDrawer.listItems.helps")}
          icon={<HelpOutlineIcon />}
          tooltip={collapsed}
        />
      )}

      {/* SEÇÃO ADMINISTRAÇÃO */}
      <Divider />
      <ListSubheader inset>{i18n.t("mainDrawer.listItems.administration")}</ListSubheader>

      {/* CAMPANHAS */}
      {showCampaigns && hasPermission("campaigns.view") && (
        <>
          <Tooltip title={collapsed ? i18n.t("mainDrawer.listItems.campaigns") : ""} placement="right">
            <ListItem
              dense
              button
              onClick={(e) => {
                e.stopPropagation();
                setOpenCampaignSubmenu((prev) => !prev);
              }}
              onMouseEnter={() => setCampaignHover(true)}
              onMouseLeave={() => setCampaignHover(false)}
            >
              <ListItemIcon>
                <Avatar
                  className={`${classes.iconHoverActive} ${isCampaignRouteActive || campaignHover ? "active" : ""
                    }`}
                >
                  <EventAvailableIcon />
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography className={classes.listItemText}>
                    {i18n.t("mainDrawer.listItems.campaigns")}
                  </Typography>
                }
              />
              {openCampaignSubmenu ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </ListItem>
          </Tooltip>
          <Collapse
            in={openCampaignSubmenu}
            timeout="auto"
            unmountOnExit
            style={{
              backgroundColor: theme.mode === "light" ? "rgba(120,120,120,0.1)" : "rgba(120,120,120,0.5)",
            }}
          >
            <List dense component="div" disablePadding>
              <ListItemLink
                to="/campaigns"
                primary={i18n.t("campaigns.subMenus.list")}
                icon={<ListIcon />}
                tooltip={collapsed}
              />
              <ListItemLink
                to="/contact-lists"
                primary={i18n.t("campaigns.subMenus.listContacts")}
                icon={<PeopleIcon />}
                tooltip={collapsed}
              />
              <ListItemLink
                to="/campaigns-config"
                primary={i18n.t("campaigns.subMenus.settings")}
                icon={<SettingsOutlinedIcon />}
                tooltip={collapsed}
              />
            </List>
          </Collapse>
        </>
      )}

      {/* FLOWBUILDER */}
      {hasPermission("flowbuilder.view") && (
        <>
          <Tooltip title={collapsed ? i18n.t("mainDrawer.listItems.flowbuilder") : ""} placement="right">
            <ListItem
              dense
              button
              onClick={(e) => {
                e.stopPropagation();
                setOpenFlowSubmenu((prev) => !prev);
              }}
              onMouseEnter={() => setFlowHover(true)}
              onMouseLeave={() => setFlowHover(false)}
            >
              <ListItemIcon>
                <Avatar
                  className={`${classes.iconHoverActive} ${isFlowbuilderRouteActive || flowHover ? "active" : ""
                    }`}
                >
                  <Webhook />
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography className={classes.listItemText}>
                    {i18n.t("mainDrawer.listItems.flowbuilder")}
                  </Typography>
                }
              />
              {openFlowSubmenu ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </ListItem>
          </Tooltip>

          <Collapse
            in={openFlowSubmenu}
            timeout="auto"
            unmountOnExit
            style={{
              backgroundColor: theme.mode === "light" ? "rgba(120,120,120,0.1)" : "rgba(120,120,120,0.5)",
            }}
          >
            <List dense component="div" disablePadding>
              <ListItemLink
                to="/phrase-lists"
                primary={i18n.t("flowbuilder.subMenus.campaign")}
                icon={<EventAvailableIcon />}
                tooltip={collapsed}
              />

              <ListItemLink
                to="/flowbuilders"
                primary={i18n.t("flowbuilder.subMenus.conversation")}
                icon={<ShapeLine />}
                tooltip={collapsed}
              />
            </List>
          </Collapse>
        </>
      )}

      {/* ANÚNCIOS */}
      {user.super && (
        <ListItemLink
          to="/announcements"
          primary={i18n.t("mainDrawer.listItems.annoucements")}
          icon={<AnnouncementIcon />}
          tooltip={collapsed}
        />
      )}

      {/* API EXTERNA */}
      {showExternalApi && hasPermission("external-api.view") && (
        <ListItemLink
          to="/messages-api"
          primary={i18n.t("mainDrawer.listItems.messagesAPI")}
          icon={<CodeRoundedIcon />}
          tooltip={collapsed}
        />
      )}

      {/* USUÁRIOS */}
      {hasPermission("users.view") && (
        <ListItemLink
          to="/users"
          primary={i18n.t("mainDrawer.listItems.users")}
          icon={<PeopleAltOutlinedIcon />}
          tooltip={collapsed}
        />
      )}

      {/* FILAS */}
      {hasPermission("queues.view") && (
        <ListItemLink
          to="/queues"
          primary={i18n.t("mainDrawer.listItems.queues")}
          icon={<AccountTreeOutlinedIcon />}
          tooltip={collapsed}
        />
      )}

      {/* INTEGRAÇÕES */}
      {showIntegrations && hasPermission("integrations.view") && (
        <ListItemLink
          to="/queue-integration"
          primary={i18n.t("mainDrawer.listItems.queueIntegration")}
          icon={<DeviceHubOutlined />}
          tooltip={collapsed}
        />
      )}

      {/* CONEXÕES (Sistema Legado) */}
      {((user.profile === "admin" || user.profile === "super") ||
        (user.profile === "user" && user.allowConnections === "enabled")) && (
          <ListItemLink
            to="/connections"
            primary={i18n.t("mainDrawer.listItems.connections")}
            icon={<SyncAltIcon />}
            showBadge={connectionWarning}
            tooltip={collapsed}
          />
        )}

      {/* TODAS AS CONEXÕES (Super) */}
      {user.super && (
        <ListItemLink
          to="/allConnections"
          primary={i18n.t("mainDrawer.listItems.allConnections")}
          icon={<PhonelinkSetup />}
          tooltip={collapsed}
        />
      )}

      {/* FINANCEIRO */}
      {hasPermission("financeiro.view") && (
        <ListItemLink
          to="/financeiro"
          primary={i18n.t("mainDrawer.listItems.financeiro")}
          icon={<LocalAtmIcon />}
          tooltip={collapsed}
        />
      )}

      {/* CONFIGURAÇÕES */}
      {hasPermission("settings.view") && (
        <ListItemLink
          to="/settings"
          primary={i18n.t("mainDrawer.listItems.settings")}
          icon={<SettingsOutlinedIcon />}
          tooltip={collapsed}
        />
      )}

      {/* INTELIGÊNCIA ARTIFICIAL */}
      {showOpenAi && (
        <>
          <Tooltip title={collapsed ? "Inteligência Artificial" : ""} placement="right">
            <ListItem
              dense
              button
              onClick={(e) => {
                e.stopPropagation();
                setOpenIASubmenu((prev) => !prev);
              }}
              onMouseEnter={() => setIaHover(true)}
              onMouseLeave={() => setIaHover(false)}
            >
              <ListItemIcon>
                <Avatar
                  className={`${classes.iconHoverActive} ${isIARouteActive || iaHover ? "active" : ""
                    }`}
                >
                  <SmartToy />
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography className={classes.listItemText}>
                    Inteligência Artificial
                  </Typography>
                }
              />
              {openIASubmenu ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </ListItem>
          </Tooltip>

          <Collapse
            in={openIASubmenu}
            timeout="auto"
            unmountOnExit
            style={{
              backgroundColor: theme.mode === "light" ? "rgba(120,120,120,0.1)" : "rgba(120,120,120,0.5)",
            }}
          >
            <List dense component="div" disablePadding>
              <ListItemLink
                to="/ai-agents"
                primary="⭐ Agentes de IA"
                icon={<SmartToy />}
                tooltip={collapsed}
              />
              {hasPermission("ai-training.view") && (
                <ListItemLink
                  to="/ai-training"
                  primary="🧪 Training / Sandbox"
                  icon={<SmartToy />}
                  tooltip={collapsed}
                />
              )}
              {hasPermission("prompts.view") && (
                <ListItemLink
                  to="/prompts"
                  primary="Prompts (Legado)"
                  icon={<AllInclusive />}
                  tooltip={collapsed}
                />
              )}
              {hasPermission("ai-settings.view") && (
                <ListItemLink
                  to="/ai-settings"
                  primary="Configurações IA"
                  icon={<Memory />}
                  tooltip={collapsed}
                />
              )}
              {hasPermission("files.view") && (
                <ListItemLink
                  to="/files"
                  primary="Base de Conhecimento"
                  icon={<AttachFile />}
                  tooltip={collapsed}
                />
              )}
            </List>
          </Collapse>
        </>
      )}

      {/* EMPRESAS (Super) */}
      {user.super && (
        <ListItemLink
          to="/companies"
          primary={i18n.t("mainDrawer.listItems.companies")}
          icon={<BusinessIcon />}
          tooltip={collapsed}
        />
      )}
      {!collapsed && (
        <React.Fragment>
          <Divider />
          {/* // IMAGEM NO MENU
              <Hidden only={['sm', 'xs']}>
                <img style={{ width: "100%", padding: "10px" }} src={logo} alt="image" />            
              </Hidden> 
              */}
          <Tooltip title={`BACKEND BUILD: ${versionInfo.buildDate} | Commit: ${versionInfo.commitShort || versionInfo.commit} | Frontend: ${versionInfo.frontend}`}>
            <Typography
              style={{
                fontSize: "12px",
                padding: "10px",
                textAlign: "center",
                fontWeight: "bold",
                cursor: "default",
              }}
            >
              {`Versão ${versionInfo.backend}`}
            </Typography>
          </Tooltip>
        </React.Fragment>
      )}
    </div>
  );
};

export default MainListItems;
