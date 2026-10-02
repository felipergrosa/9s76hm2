import React, { useState, useEffect, useReducer, useContext, useCallback, useRef } from "react";

import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import CircularProgress from "@material-ui/core/CircularProgress";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import AddIcon from "@material-ui/icons/Add";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import { ShieldCheck, Users as UsersIcon } from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import TabPanel from "../../components/TabPanel";
import api from "../../services/api";
import { i18n } from "../../translate/i18n"; // Já importado, ótimo!
import UserModal from "../../components/UserModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import UserStatusIcon from "../../components/UserModal/statusIcon";
import { getBackendUrl } from "../../config";
import { AuthContext } from "../../context/Auth/AuthContext";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";
import AvatarFallback from "../../components/AvatarFallback";
import RolesTab from "./RolesTab";

const backendUrl = getBackendUrl();

const reducer = (state, action) => {
  if (action.type === "SET_USERS") {
    // Substitui completamente a lista (paginação por página)
    return [...action.payload];
  }
  if (action.type === "LOAD_USERS") {
    const users = action.payload;
    const newUsers = [];

    users.forEach((user) => {
      const userIndex = state.findIndex((u) => u.id === user.id);
      if (userIndex !== -1) {
        state[userIndex] = user;
      } else {
        newUsers.push(user);
      }
    });

    return [...state, ...newUsers];
  }

  if (action.type === "UPDATE_USERS") {
    const user = action.payload;
    const userIndex = state.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      // Faz merge dos dados preservando campos existentes
      const merged = { ...state[userIndex], ...user };
      state[userIndex] = merged;
      return [...state];
    } else {
      return [user, ...state];
    }
  }

  if (action.type === "DELETE_USER") {
    const userId = action.payload;

    const userIndex = state.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      state.splice(userIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
  },
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    padding: theme.spacing(2, 2.5),
    flexWrap: "wrap",
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
    marginTop: theme.spacing(0.5),
  },
  tabs: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tabLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark" ? theme.palette.background.default : "#fafafa",
    flexWrap: "wrap",
  },
  searchField: {
    minWidth: 220,
    flex: "1 1 220px",
    maxWidth: 320,
  },
  toolbarButton: {
    marginLeft: "auto",
  },
  headCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark" ? theme.palette.background.default : "#fafafa",
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
  },
  bodyCell: {
    fontSize: "0.85rem",
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
  },
  rowHover: {
    transition: "background-color 120ms ease",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  emptyState: {
    padding: theme.spacing(8, 4),
    textAlign: "center",
    color: theme.palette.text.secondary,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  mobileList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    [theme.breakpoints.up("sm")]: {
      display: "none",
    },
  },
  desktopTableWrapper: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  card: {
    borderRadius: 14,
    padding: theme.spacing(2),
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.25),
    background: theme.palette.background.paper,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    fontWeight: 700,
    fontSize: "1.05rem",
    lineHeight: 1.2,
  },
  cardMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: theme.spacing(1),
  },
  metaLabel: {
    fontSize: "0.85rem",
    color: theme.palette.text.secondary,
  },
  metaValue: {
    fontSize: "0.95rem",
    fontWeight: 600,
    wordBreak: "break-word",
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  actionButton: {
    minWidth: 44,
    minHeight: 44,
  },
  userAvatar: {
    width: theme.spacing(6),
    height: theme.spacing(6),
  },

  avatarDiv: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing(3),
  },
  loadingText: {
    marginLeft: theme.spacing(2),
  },
}));

// Rótulo de aba com ícone lucide (size em px, não fontSize)
function TabLabel({ icon, label }) {
  const classes = useStyles();
  return (
    <span className={classes.tabLabel}>
      {React.cloneElement(icon, { size: 15 })}
      {label}
    </span>
  );
}

const Users = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [users, dispatch] = useReducer(reducer, []);
  const { user: loggedInUser, socket } = useContext(AuthContext)
  const { hasPermission } = usePermissions();
  const { profileImage } = loggedInUser;
  const USERS_PER_PAGE = 20; // Mantém alinhado ao backend

  const canViewUsers = hasPermission("users.view");
  const canViewRoles = hasPermission("roles.view");
  const canCreateUser = hasPermission("users.create");
  const canEditUser = hasPermission("users.edit");
  const canDeleteUser = hasPermission("users.delete");
  const canViewPage = canViewUsers || canViewRoles;

  // Usuários é a primeira aba (o uso do dia a dia); quem só tem
  // roles.view cai direto na aba de perfis.
  const [tab, setTab] = useState(canViewUsers ? "users" : "roles");
  // Flag: usuário já trocou de aba manualmente (não sobrescrever a escolha dele)
  const tabTouched = useRef(false);

  // Corrige a aba ativa quando as permissões não cobrem a aba selecionada.
  // Se as permissões resolverem depois do mount e o usuário ainda não
  // interagiu, posiciona na primeira aba disponível (usuários primeiro).
  useEffect(() => {
    if (tabTouched.current) {
      if (tab === "users" && !canViewUsers && canViewRoles) setTab("roles");
      if (tab === "roles" && !canViewRoles && canViewUsers) setTab("users");
      return;
    }
    if (canViewUsers && tab !== "users") setTab("users");
    else if (!canViewUsers && canViewRoles && tab !== "roles") setTab("roles");
  }, [tab, canViewRoles, canViewUsers]);

  const handleTabChange = (_, newTab) => {
    tabTouched.current = true;
    setTab(newTab);
  };

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users/", {
        params: { searchParam, pageNumber },
      });
      // Substitui lista ao trocar de página/filtro
      dispatch({ type: "SET_USERS", payload: data.users });
      setTotalUsers(typeof data.count === "number" ? data.count : (data.total || data.users.length));
    } catch (err) {
      // 403 = sem permissão users.view (admin)
      // Silencia o erro, lista de usuários fica vazia
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [searchParam, pageNumber]);

  useEffect(() => {
    if (!canViewUsers) return;
    // Debounce de 500ms na busca/troca de página (padrão MainListItems)
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchUsers, canViewUsers]);

  useEffect(() => {
    if (loggedInUser) {
      const companyId = loggedInUser.companyId;
      const onCompanyUser = (data) => {
        console.log('[Users] Evento recebido:', data.action, data.user?.id, 'online=', data.user?.online, 'status=', data.user?.status);
        if (data.action === "update" || data.action === "create") {
          dispatch({ type: "UPDATE_USERS", payload: data.user });
        }
        if (data.action === "delete") {
          dispatch({ type: "DELETE_USER", payload: +data.userId });
        }
      };

      socket.on(`company-${companyId}-user`, onCompanyUser);
      console.log('[Users] Socket listener registrado para company-' + companyId + '-user');

      return () => {
        socket.off(`company-${companyId}-user`, onCompanyUser);
      };
    }
  }, [socket, loggedInUser]);

  const handleOpenUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setUserModalOpen(true);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/users/${userId}`);
      // Remove a linha otimisticamente (não depende do socket para sumir)
      dispatch({ type: "DELETE_USER", payload: userId });
      setTotalUsers((prev) => Math.max(0, prev - 1));
      toast.success(i18n.t("users.toasts.deleted"));
    } catch (err) {
      // 403 = sem permissão users.delete (admin)
      // Silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
    setDeletingUser(null);
    // Refetch garantido: se searchParam/pageNumber já estão nos defaults,
    // nenhum effect dispara — nesse caso chama o fetch diretamente
    if (searchParam === "" && pageNumber === 1) {
      fetchUsers();
    } else {
      setSearchParam("");
      setPageNumber(1);
    }
  };

  // Paginação numerada
  const totalPages = totalUsers === 0 ? 1 : Math.ceil(totalUsers / USERS_PER_PAGE);
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setPageNumber(page);
    }
  };
  const renderPageNumbers = () => {
    const pages = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1, 2, 3, "...");
    }
    return pages.map((page, index) => (
      <li key={index}>
        {page === "..." ? (
          <span className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-700">...</span>
        ) : (
          <button
            onClick={() => handlePageChange(page)}
            className={`flex items-center justify-center px-3 h-8 leading-tight border ${page === pageNumber
              ? "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
              : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              }`}
          >
            {page}
          </button>
        )}
      </li>
    ));
  };

  const renderProfileImage = (user) => {
    const imageUrl = user.id === loggedInUser.id
      ? (profileImage ? `${backendUrl}/public/company${user.companyId}/${profileImage}` : null)
      : (user.profileImage ? `${backendUrl}/public/company${user.companyId}/${user.profileImage}` : null);

    return (
      <AvatarFallback
        src={imageUrl}
        name={user.name}
        className={classes.userAvatar}
      />
    );
  };

  const usersEmptyState = (
    <Box className={classes.emptyState}>
      <UsersIcon size={44} style={{ opacity: 0.35 }} />
      <Typography variant="subtitle1">
        {searchParam
          ? "Nenhum usuário encontrado para essa busca"
          : "Nenhum usuário cadastrado"}
      </Typography>
    </Box>
  );

  return (
    <MainContainer useWindowScroll>
      <ConfirmationModal
        title={
          deletingUser &&
          `${i18n.t("users.confirmationModal.deleteTitle")} ${deletingUser.name
          }?`
        }
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => handleDeleteUser(deletingUser.id)}
      >
        {i18n.t("users.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <UserModal
        open={userModalOpen}
        onClose={handleCloseUserModal}
        aria-labelledby="form-dialog-title"
        userId={selectedUser && selectedUser.id}
        key={i18n.language}
      />
      {canViewPage ? (
        <Paper className={classes.mainPaper} variant="outlined">
          {/* Header interno (padrão novo) */}
          <Box className={classes.pageHeader}>
            <Box>
              <Title>Usuários e Permissões</Title>
              <Typography variant="body2" className={classes.subtitle}>
                Gerencie perfis de acesso e usuários — os perfis definem o que
                cada usuário pode ver e fazer.
              </Typography>
            </Box>
          </Box>

          <Tabs
            value={tab}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            onChange={handleTabChange}
            className={classes.tabs}
          >
            {canViewUsers && (
              <Tab
                value="users"
                label={<TabLabel icon={<UsersIcon />} label={i18n.t("users.title")} />}
              />
            )}
            {canViewRoles && (
              <Tab
                value="roles"
                label={<TabLabel icon={<ShieldCheck />} label="Perfis de Acesso" />}
              />
            )}
          </Tabs>

          {/* ── Aba: Usuários ── */}
          <TabPanel value={tab} name="users">
            {!canViewUsers ? (
              <Box className={classes.emptyState}>
                <UsersIcon size={44} style={{ opacity: 0.35 }} />
                <Typography variant="subtitle1">
                  Você não tem permissão para visualizar usuários.
                </Typography>
              </Box>
            ) : (
              <>
                {/* Barra de busca + ação primária (padrão novo) */}
                <Box className={classes.toolbar}>
                  <TextField
                    placeholder={i18n.t("contacts.searchPlaceholder")}
                    type="search"
                    variant="outlined"
                    size="small"
                    className={classes.searchField}
                    value={searchParam}
                    onChange={handleSearch}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon style={{ color: "gray" }} fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  {canCreateUser && (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<AddIcon />}
                      onClick={handleOpenUserModal}
                      className={classes.toolbarButton}
                      style={{ minHeight: 44 }}
                    >
                      {i18n.t("users.buttons.add")}
                    </Button>
                  )}
                </Box>

                {/* Mobile cards */}
                <div className={classes.mobileList}>
                  {users.map((user) => (
                    <div key={user.id} className={classes.card}>
                      <div className={classes.cardHeader}>
                        <div className={classes.cardTitle}>
                          {renderProfileImage(user)}
                          <span>{user.name}</span>
                          {user.super && (
                            <span title="Super Admin" style={{ fontSize: "1.2rem", marginLeft: "4px" }}>👑</span>
                          )}
                        </div>
                        <div className={classes.metaValue}>ID #{user.id}</div>
                      </div>
                      <div className={classes.cardMeta}>
                        <div>
                          <div className={classes.metaLabel}>{i18n.t("users.table.status")}</div>
                          <div className={classes.metaValue}><UserStatusIcon user={user} /></div>
                        </div>
                        <div>
                          <div className={classes.metaLabel}>{i18n.t("users.table.email")}</div>
                          <div className={classes.metaValue}>{user.email || "—"}</div>
                        </div>
                        <div>
                          <div className={classes.metaLabel}>{i18n.t("users.table.profile")}</div>
                          <div className={classes.metaValue}>
                            {user.super && <span title="Super Admin" style={{ marginRight: "4px" }}>👑</span>}
                            {user.profile}
                          </div>
                        </div>
                        <div>
                          <div className={classes.metaLabel}>{i18n.t("users.table.startWork")}</div>
                          <div className={classes.metaValue}>{user.startWork || "—"}</div>
                        </div>
                        <div>
                          <div className={classes.metaLabel}>{i18n.t("users.table.endWork")}</div>
                          <div className={classes.metaValue}>{user.endWork || "—"}</div>
                        </div>
                      </div>
                      {(canEditUser || canDeleteUser) && (
                        <div className={classes.cardActions}>
                          {canEditUser && (
                            <IconButton
                              size="small"
                              className={classes.actionButton}
                              onClick={() => handleEditUser(user)}
                            >
                              <EditIcon />
                            </IconButton>
                          )}

                          {canDeleteUser && (
                            <IconButton
                              size="small"
                              className={classes.actionButton}
                              onClick={() => {
                                setConfirmModalOpen(true);
                                setDeletingUser(user);
                              }}
                            >
                              <DeleteOutlineIcon />
                            </IconButton>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className={classes.loadingContainer}>
                      <CircularProgress />
                      <span className={classes.loadingText}>{i18n.t("loading")}</span>
                    </div>
                  )}
                  {!loading && users.length === 0 && usersEmptyState}
                </div>

                {/* Desktop table */}
                <div className={classes.desktopTableWrapper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell align="center" className={classes.headCell}>{i18n.t("users.table.ID")}</TableCell>
                        <TableCell align="center" className={classes.headCell}>{i18n.t("users.table.status")}</TableCell>

                        <TableCell align="center" className={classes.headCell}>
                          Avatar
                        </TableCell>
                        <TableCell align="center" className={classes.headCell}>{i18n.t("users.table.name")}</TableCell>
                        <TableCell align="center" className={classes.headCell}>{i18n.t("users.table.email")}</TableCell>
                        <TableCell align="center" className={classes.headCell}>{i18n.t("users.table.profile")}</TableCell>
                        <TableCell align="center" className={classes.headCell}>{i18n.t("users.table.startWork")}</TableCell>
                        <TableCell align="center" className={classes.headCell}>{i18n.t("users.table.endWork")}</TableCell>
                        <TableCell align="center" className={classes.headCell}>{i18n.t("users.table.actions")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <>
                        {users.map((user) => (
                          <TableRow key={user.id} className={classes.rowHover} hover={false}>
                            <TableCell align="center" className={classes.bodyCell}>{user.id}</TableCell>
                            <TableCell align="center" className={classes.bodyCell}><UserStatusIcon user={user} /></TableCell>
                            <TableCell align="center" className={classes.bodyCell}>
                              <div className={classes.avatarDiv}>
                                {renderProfileImage(user)}
                              </div>
                            </TableCell>
                            <TableCell align="center" className={classes.bodyCell}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                {user.name}
                              </div>
                            </TableCell>
                            <TableCell align="center" className={classes.bodyCell}>{user.email}</TableCell>
                            <TableCell align="center" className={classes.bodyCell}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                {user.super && <span title="Super Admin">👑</span>}
                                {user.profile}
                              </div>
                            </TableCell>
                            <TableCell align="center" className={classes.bodyCell}>{user.startWork}</TableCell>
                            <TableCell align="center" className={classes.bodyCell}>{user.endWork}</TableCell>
                            <TableCell align="center" className={classes.bodyCell}>
                              {canEditUser && (
                                <Tooltip title={i18n.t("users.table.actions")}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditUser(user)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}

                              {canDeleteUser && (
                                <Tooltip title="Excluir">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      setConfirmModalOpen(true);
                                      setDeletingUser(user);
                                    }}
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                      {!loading && users.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9}>
                            {usersEmptyState}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {loading && (
                    <div className={classes.loadingContainer}>
                      <CircularProgress />
                      <span className={classes.loadingText}>{i18n.t("loading")}</span>
                    </div>
                  )}
                </div>

                {/* Paginação numerada */}
                <nav className="flex justify-center mt-4 mb-4" aria-label="Page navigation">
                  <ul className="inline-flex -space-x-px text-sm">
                    <li>
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={pageNumber === 1}
                        className={`flex items-center justify-center px-3 h-8 leading-tight border rounded-l-lg ${pageNumber === 1
                          ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                          : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                          }`}
                      >
                        «
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => handlePageChange(pageNumber - 1)}
                        disabled={pageNumber === 1}
                        className={`flex items-center justify-center px-3 h-8 leading-tight border ${pageNumber === 1
                          ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                          : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                          }`}
                      >
                        ‹
                      </button>
                    </li>
                    {renderPageNumbers()}
                    <li>
                      <button
                        onClick={() => handlePageChange(pageNumber + 1)}
                        disabled={pageNumber === totalPages}
                        className={`flex items-center justify-center px-3 h-8 leading-tight border ${pageNumber === totalPages
                          ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                          : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                          }`}
                      >
                        ›
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        disabled={pageNumber === totalPages}
                        className={`flex items-center justify-center px-3 h-8 leading-tight border rounded-r-lg ${pageNumber === totalPages
                          ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                          : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                          }`}
                      >
                        »
                      </button>
                    </li>
                  </ul>
                </nav>
              </>
            )}
          </TabPanel>

          {/* ── Aba: Perfis de Acesso ── */}
          <TabPanel value={tab} name="roles">
            <RolesTab />
          </TabPanel>
        </Paper>
      ) : <ForbiddenPage />}
    </MainContainer>
  );
};

export default Users;
