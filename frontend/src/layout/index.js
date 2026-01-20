import React, { useState, useContext, useEffect, useMemo } from "react";
import clsx from "clsx";
// import moment from "moment";

// import { isNill } from "lodash";
// import SoftPhone from "react-softphone";
// import { WebSocketInterface } from "jssip";

import {
  makeStyles,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  MenuItem,
  IconButton,
  Menu,
  useTheme,
  useMediaQuery,
  Avatar,
  // FormControl,
  Badge,
  withStyles,
  Chip,
} from "@material-ui/core";

import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
// import AccountCircle from "@material-ui/icons/AccountCircle";
import CachedIcon from "@material-ui/icons/Cached";
// import whatsappIcon from "../assets/nopicture.png";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
// import DarkMode from "../components/DarkMode";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import AnnouncementsPopover from "../components/AnnouncementsPopover";

import logo from "../assets/logo.png";
import logoDark from "../assets/logo-black.png";
import ChatPopover from "../pages/Chat/ChatPopover";

import { useDate } from "../hooks/useDate";
import UserLanguageSelector from "../components/UserLanguageSelector";

import ColorModeContext from "./themeContext";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import { getBackendUrl } from "../config";
import useSettings from "../hooks/useSettings";
import useVersion from "../hooks/useVersion";
import pkg from "../../package.json";
import ImportProgressBar from "../components/ImportProgressBar";

// import { SocketContext } from "../context/Socket/SocketContext";

const backendUrl = getBackendUrl();

const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  modernRoot: {
    backgroundColor: "var(--bg) !important",
    fontFamily: "'Plus Jakarta Sans', sans-serif !important",
  },
  modernAppBar: {
    background: "rgba(255, 255, 255, 0.45) !important",
    backdropFilter: "blur(12px) !important",
    borderBottom: "1px solid var(--border) !important",
    boxShadow: "none !important",
    color: "var(--text) !important",
    "& .MuiToolbar-root": {
      color: "var(--text) !important",
    }
  },
  modernAppBarDark: {
    background: "rgba(17, 24, 39, 0.45) !important",
    backdropFilter: "blur(12px) !important",
    borderBottom: "1px solid var(--border) !important",
    boxShadow: "none !important",
    color: "var(--text) !important",
    "& .MuiToolbar-root": {
      color: "var(--text) !important",
    }
  },
  modernDrawer: {
    background: "var(--sidebar-bg) !important",
    borderRight: "1px solid var(--border) !important",
    "& .MuiDrawer-paper": {
      background: "var(--sidebar-bg) !important",
      borderRight: "1px solid var(--border) !important",
    }
  },
  modernToolbar: {
    background: "transparent !important",
    color: "var(--text) !important",
  },
  root: {
    display: "flex",
    height: "100vh",
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
    backgroundColor: theme.palette.fancyBackground,
    [theme.breakpoints.down("sm")]: {
      overflowX: "hidden",
      position: "relative",
    },

    "& .MuiButton-outlinedPrimary": {
      color: theme.palette.primary,
      border:
        theme.mode === "light"
          ? "1px solid rgba(0 124 102)"
          : "1px solid rgba(255, 255, 255, 0.5)",
    },
    "& .MuiTab-textColorPrimary.Mui-selected": {
      color: theme.palette.primary,
    },
  },
  chip: {
    background: "red",
    color: "white",
  },
  avatar: {
    width: "100%",
  },
  toolbar: {
    paddingRight: 24, // keep right padding when drawer closed
    color: theme.palette.dark.main,
    background: theme.palette.barraSuperior,
    gap: theme.spacing(1),
    [theme.breakpoints.down("sm")]: {
      flexWrap: "nowrap",
      overflowX: "auto",
      overflowY: "hidden",
      paddingRight: 8,
      paddingLeft: 8,
      minHeight: 48,
      gap: theme.spacing(0.5),
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
      "&::-webkit-scrollbar": {
        display: "none",
      },
      "& > *": {
        flexShrink: 0,
      },
    },
  },
  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // backgroundColor: "#FFF",
    backgroundSize: "cover",
    padding: "0 8px",
    minHeight: "48px",
    [theme.breakpoints.down("sm")]: {
      height: "48px",
    },
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  // menuButton: {
  //   marginRight: 36,
  // },
  menuButtonHidden: {
    display: "none",
  },
  title: {
    flexGrow: 1,
    fontSize: 14,
    color: "white",
  },
  drawerPaper: {
    position: "fixed",
    top: 0,
    left: 0,
    height: "100vh",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: "hidden",
    overflowY: "auto",
    [theme.breakpoints.down("sm")]: {
      overflowY: "auto",
      height: "100vh",
    },
  },

  drawerPaperClose: {
    position: "fixed",
    top: 0,
    left: 0,
    height: "100vh",
    overflowX: "hidden",
    overflowY: "auto",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up("sm")]: {
      width: theme.spacing(9),
    },
    [theme.breakpoints.down("sm")]: {
      overflowY: "auto",
    },
  },

  appBarSpacer: {
    minHeight: "48px",
  },
  content: {
    flex: 1,
    overflow: "visible", position: "relative",
    width: "100%",
    maxWidth: "100%",
  },
  contentShift: {
    marginLeft: drawerWidth,
    [theme.breakpoints.down("sm")]: {
      marginLeft: 0,
    },
  },
  contentShiftClose: {
    marginLeft: theme.spacing(7),
    [theme.breakpoints.up("sm")]: {
      marginLeft: theme.spacing(9),
    },
    [theme.breakpoints.down("sm")]: {
      marginLeft: 0,
    },
  },
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  // paper: {
  //     padding: theme.spacing(2),
  //     display: "flex",
  //     overflow: "visible", position: "relative",
  //     flexDirection: "column",
  //   },
  containerWithScroll: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    ...theme.scrollbarStyles,
    borderRadius: "8px",
    border: "2px solid transparent",
    "&::-webkit-scrollbar": {
      width: "0px",
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "transparent",
      borderRadius: "0px",
    },
    [theme.breakpoints.down("sm")]: {
      overflowY: "auto",
      maxHeight: "calc(100vh - 120px)",
    },
  },
  NotificationsPopOver: {
    // color: theme.barraSuperior.secondary.main,
  },
  logo: {
    width: "100%",
    height: "45px",
    maxWidth: 180,
    [theme.breakpoints.down("sm")]: {
      width: "auto",
      height: "100%",
      maxWidth: 180,
    },
    logo: theme.logo,
    content: "url(" + (theme.mode === "light" ? theme.calculatedLogoLight() : theme.calculatedLogoDark()) + ")"
  },
  hideLogo: {
    display: "none",
  },
  avatar2: {
    width: theme.spacing(4),
    height: theme.spacing(4),
    cursor: "pointer",
    borderRadius: "50%",
    border: "2px solid #ccc",
  },
  updateDiv: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
}));

const StyledBadge = withStyles((theme) => ({
  badge: {
    backgroundColor: "#44b700",
    color: "#44b700",
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    "&::after": {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      animation: "$ripple 1.2s infinite ease-in-out",
      border: "1px solid currentColor",
      content: '""',
    },
  },
  "@keyframes ripple": {
    "0%": {
      transform: "scale(.8)",
      opacity: 1,
    },
    "100%": {
      transform: "scale(2.4)",
      opacity: 0,
    },
  },
}))(Badge);

const SmallAvatar = withStyles((theme) => ({
  root: {
    width: 22,
    height: 22,
    border: `2px solid ${theme.palette.background.paper}`,
  },
}))(Avatar);

const LoggedInLayout = ({ children, themeToggle }) => {
  const [userToken, setUserToken] = useState("disabled");
  const [loadingUserToken, setLoadingUserToken] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState("permanent");
  // const [dueDate, setDueDate] = useState("");
  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);

  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const { viewMode } = colorMode;
  const classes = useStyles({ viewMode });
  const greaterThenSm = useMediaQuery(theme.breakpoints.up("sm"));

  const [volume, setVolume] = useState(localStorage.getItem("volume") || 1);
  const [statusImport, setStatusImport] = useState(null);
  const [hideImport, setHideImport] = useState(false);

  const { dateToClient } = useDate();
  const [profileUrl, setProfileUrl] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mainListItems = useMemo(
    () => <MainListItems drawerOpen={drawerOpen} collapsed={!drawerOpen} />,
    [user, drawerOpen]
  );

  const settings = useSettings();
  const { setVersion } = useVersion();

  useEffect(() => {
    const getSetting = async () => {
      const response = await settings.get("wtV");


      if (response) {

        setUserToken("disabled");

      } else {
        setUserToken("disabled");
      }
    };

    getSetting();
  });



  useEffect(() => {
    // Envia a versão do frontend para o backend (/version)
    // Usa a versão injetada pelo CI (REACT_APP_FRONTEND_VERSION) com fallback para package.json
    // Envia somente se a versão atual for diferente da última registrada
    (async () => {
      try {
        const injected = process.env.REACT_APP_FRONTEND_VERSION;
        const current = injected && injected.length ? injected : (pkg?.version || "");
        const lastSent = localStorage.getItem("frontendVersionSent") || "";
        if (current && current !== lastSent) {
          await setVersion(current);
          localStorage.setItem("frontendVersionSent", current);
        }
      } catch (e) {
        // silencioso: não bloquear UI caso backend indisponível
      }
    })();

    // if (localStorage.getItem("public-token") === null) {
    //   handleLogout()
    // }

    if (document.body.offsetWidth > 600) {
      if (user.defaultMenu === "closed") {
        setDrawerOpen(false);
      } else {
        setDrawerOpen(true);
      }
    }
    if (user.defaultTheme === "dark" && theme.mode === "light") {
      colorMode.toggleColorMode();
    }
  }, [user.defaultMenu, document.body.offsetWidth]);

  useEffect(() => {
    if (document.body.offsetWidth < 600) {
      setDrawerVariant("temporary");
    } else {
      setDrawerVariant("permanent");
    }
  }, [drawerOpen]);

  useEffect(() => {

    const companyId = user.companyId;
    const userId = user.id;
    if (companyId) {
      //    const socket = socketManager.GetSocket();

      const ImageUrl = user.profileImage;
      if (ImageUrl !== undefined && ImageUrl !== null)
        setProfileUrl(`${backendUrl}/public/company${user.companyId}/${ImageUrl}`);
      else setProfileUrl(`${process.env.FRONTEND_URL}/nopicture.png`);

      const onCompanyAuthLayout = (data) => {
        if (data.user.id === +userId) {
          toastError("Sua conta foi acessada em outro computador.");
          setTimeout(() => {
            localStorage.clear();
            window.location.reload();
          }, 1000);
        }
      }

      socket.on(`company-${companyId}-auth`, onCompanyAuthLayout);

      socket.emit("userStatus");
      const interval = setInterval(() => {
        socket.emit("userStatus");
      }, 1000 * 60 * 5);

      return () => {
        socket.off(`company-${companyId}-auth`, onCompanyAuthLayout);
        clearInterval(interval);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Listener para progresso de importação de mensagens
  useEffect(() => {
    if (!socket || typeof socket.on !== 'function' || !user?.companyId) return;

    const handleImportMessages = (data) => {
      if (data.action === "refresh") {
        setStatusImport(null);
        setHideImport(false); // Reset para a próxima importação aparecer
      }
      if (data.action === "update") {
        setStatusImport(data.status);
        // Se for o início, garante que aparece
        if (data.status?.state === "PREPARING") {
          setHideImport(false);
        }
      }
    };

    socket.on(`importMessages-${user.companyId}`, handleImportMessages);

    return () => {
      socket.off(`importMessages-${user.companyId}`, handleImportMessages);
    };
  }, [socket, user?.companyId]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };

  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };

  const drawerClose = () => {
    if (document.body.offsetWidth < 600 || user.defaultMenu === "closed") {
      setDrawerOpen(false);
    }
  };

  const handleRefreshPage = () => {
    window.location.reload(false);
  };

  const handleMenuItemClick = () => {
    const { innerWidth: width } = window;
    if (width <= 600) {
      setDrawerOpen(false);
    }
  };

  if (loading) {
    return <BackdropLoading />;
  }

  return (
    <div className={clsx(classes.root, viewMode === "modern" && classes.modernRoot)}>
      <Drawer
        variant={drawerVariant}
        className={clsx(
          drawerOpen ? classes.drawerPaper : classes.drawerPaperClose,
          viewMode === "modern" && classes.modernDrawer
        )}
        classes={{
          paper: clsx(
            classes.drawerPaper,
            !drawerOpen && classes.drawerPaperClose,
            viewMode === "modern" && classes.modernDrawer
          ),
        }}
        open={drawerOpen}
      >
        <div className={classes.toolbarIcon}>
          <img className={drawerOpen ? classes.logo : classes.hideLogo}
            style={{
              display: "block",
              margin: "0 auto",
              height: "50px",
              width: "100%",
            }}
            alt="logo" />
          <IconButton onClick={() => setDrawerOpen(!drawerOpen)}>
            <ChevronLeftIcon />
          </IconButton>
        </div>
        <List className={classes.containerWithScroll}>
          {/* {mainListItems} */}
          <MainListItems collapsed={!drawerOpen} drawerClose={drawerClose} />
        </List>
        <Divider />
      </Drawer>

      <AppBar
        position="fixed"
        className={clsx(
          classes.appBar,
          drawerOpen && classes.appBarShift,
          viewMode === "modern" && (theme.palette.type === "light" ? classes.modernAppBar : classes.modernAppBarDark)
        )}
        color="primary"
      >
        <Toolbar variant="dense" className={clsx(classes.toolbar, viewMode === "modern" && classes.modernToolbar)}>
          <IconButton
            edge="start"
            variant="contained"
            aria-label="open drawer"
            style={{ color: viewMode === "modern" ? "var(--text)" : "white" }}
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={clsx(drawerOpen && classes.menuButtonHidden)}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            component="h2"
            variant="h6"
            color="inherit"
            noWrap
            className={classes.title}
            style={{ color: viewMode === "modern" ? "var(--text)" : "white" }}
          >
            {/* {greaterThenSm && user?.profile === "admin" && getDateAndDifDays(user?.company?.dueDate).difData < 7 ? ( */}
            {greaterThenSm &&
              user?.profile === "admin" &&
              user?.company?.dueDate ? (
              <>
                {i18n.t("mainDrawer.appBar.user.message")} <b>{user.name}</b>,{" "}
                {i18n.t("mainDrawer.appBar.user.messageEnd")}{" "}
                <b>{user?.company?.name}</b>! (
                {i18n.t("mainDrawer.appBar.user.active")}{" "}
                {dateToClient(user?.company?.dueDate)})
              </>
            ) : (
              <>
                {i18n.t("mainDrawer.appBar.user.message")} <b>{user.name}</b>,{" "}
                {i18n.t("mainDrawer.appBar.user.messageEnd")}{" "}
                <b>{user?.company?.name}</b>!
              </>
            )}
          </Typography>

          {userToken === "enabled" && user?.companyId === 1 && (
            <Chip
              className={classes.chip}
              label={i18n.t("mainDrawer.appBar.user.token")}
            />
          )}

          {/* DESABILITADO POIS TEM BUGS */}
          {<UserLanguageSelector />}
          {/* <SoftPhone
            callVolume={33} //Set Default callVolume
            ringVolume={44} //Set Default ringVolume
            connectOnStart={false} //Auto connect to sip
            notifications={false} //Show Browser Notification of an incoming call
            config={config} //Voip config
            setConnectOnStartToLocalStorage={setConnectOnStartToLocalStorage} // Callback function
            setNotifications={setNotifications} // Callback function
            setCallVolume={setCallVolume} // Callback function
            setRingVolume={setRingVolume} // Callback function
            timelocale={'UTC-3'} //Set time local for call history
          /> */}
          <IconButton
            edge="start"
            onClick={colorMode.toggleColorMode}
            style={{ padding: greaterThenSm ? 12 : 8, color: viewMode === "modern" ? "var(--text)" : "white" }}
          >
            {theme.mode === "dark" ? (
              <Brightness7Icon style={{ fontSize: greaterThenSm ? 24 : 20 }} />
            ) : (
              <Brightness4Icon style={{ fontSize: greaterThenSm ? 24 : 20 }} />
            )}
          </IconButton>

          <NotificationsVolume setVolume={setVolume} volume={volume} />

          <IconButton
            onClick={handleRefreshPage}
            aria-label={i18n.t("mainDrawer.appBar.refresh")}
            color="inherit"
            style={{ padding: greaterThenSm ? 12 : 8, color: viewMode === "modern" ? "var(--text)" : "white" }}
          >
            <CachedIcon style={{ fontSize: greaterThenSm ? 24 : 20 }} />
          </IconButton>

          {/* <DarkMode themeToggle={themeToggle} /> */}

          {user.id && <NotificationsPopOver volume={volume} />}

          <AnnouncementsPopover />

          <ChatPopover />

          <div>
            <StyledBadge
              overlap="circular"
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              variant="dot"
              onClick={handleMenu}
            >
              <Avatar
                alt="Multi100"
                className={classes.avatar2}
                src={profileUrl}
              />
            </StyledBadge>

            <UserModal
              open={userModalOpen}
              onClose={() => setUserModalOpen(false)}
              onImageUpdate={(newProfileUrl) => setProfileUrl(newProfileUrl)}
              userId={user?.id}
            />

            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              getContentAnchorEl={null}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={menuOpen}
              onClose={handleCloseMenu}
            >
              <MenuItem onClick={handleOpenUserModal}>
                {i18n.t("mainDrawer.appBar.user.profile")}
              </MenuItem>
              <MenuItem onClick={handleClickLogout}>
                {i18n.t("mainDrawer.appBar.user.logout")}
              </MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      {/* Barra de progresso flutuante para importação de mensagens */}
      {!hideImport && (
        <ImportProgressBar
          statusImport={statusImport}
          onClose={() => setHideImport(true)}
        />
      )}

      <main className={clsx(classes.content, drawerOpen ? classes.contentShift : classes.contentShiftClose)}>
        <div className={classes.appBarSpacer} />

        {children ? children : null}
      </main>
    </div>
  );
};

export default LoggedInLayout;
