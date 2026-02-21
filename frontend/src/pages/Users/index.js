import React, { useState, useEffect, useReducer, useContext } from "react";

import { toast } from "react-toastify";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import Grid from "@material-ui/core/Grid";
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
import { AccountCircle } from "@material-ui/icons";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
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
      state[userIndex] = user;
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
    padding: theme.spacing(2),
    // Removido overflowY e scrollbar interna para usar scroll da janela
  },
  mobileList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(2),
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

const Users = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const fetchUsers = async () => {
      try {
        const { data } = await api.get("/users/", {
          params: { searchParam, pageNumber },
        });
        // Substitui lista ao trocar de página/filtro
        dispatch({ type: "SET_USERS", payload: data.users });
        setTotalUsers(typeof data.count === "number" ? data.count : (data.total || data.users.length));
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [searchParam, pageNumber]);

  useEffect(() => {
    if (loggedInUser) {
      const companyId = loggedInUser.companyId;
      const onCompanyUser = (data) => {
        if (data.action === "update" || data.action === "create") {
          dispatch({ type: "UPDATE_USERS", payload: data.user });
        }
        if (data.action === "delete") {
          dispatch({ type: "DELETE_USER", payload: +data.userId });
        }
      };
      socket.on(`company-${companyId}-user`, onCompanyUser);
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
      toast.success(i18n.t("users.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingUser(null);
    setSearchParam("");
    setPageNumber(1);
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
      ? (profileImage ? `${backendUrl}/public/company${user.companyId}/user/${profileImage}` : null)
      : (user.profileImage ? `${backendUrl}/public/company${user.companyId}/user/${user.profileImage}` : null);
    
    return (
      <AvatarFallback
        src={imageUrl}
        name={user.name}
        className={classes.userAvatar}
      />
    );
  };

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
      {hasPermission("users.view") ? (
        <>
          <MainHeader>
            <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <Title>{i18n.t("users.title")} ({users.length})</Title>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Grid container spacing={1} alignItems="center" justifyContent="flex-end">
                  <Grid item xs={12} sm>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder={i18n.t("contacts.searchPlaceholder")}
                      type="search"
                      value={searchParam}
                      onChange={handleSearch}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon style={{ color: "gray" }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm="auto">
                    <Button
                      fullWidth={isMobile}
                      variant="contained"
                      color="primary"
                      onClick={handleOpenUserModal}
                      style={{ minHeight: 44 }}
                    >
                      {i18n.t("users.buttons.add")}
                    </Button>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </MainHeader>
          <Paper
            className={classes.mainPaper}
            variant="outlined"
          >
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
                  <div className={classes.cardActions}>
                    <IconButton
                      size="small"
                      className={classes.actionButton}
                      onClick={() => handleEditUser(user)}
                    >
                      <EditIcon />
                    </IconButton>

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
                  </div>
                </div>
              ))}
              {loading && (
                <div className={classes.loadingContainer}>
                  <CircularProgress />
                  <span className={classes.loadingText}>{i18n.t("loading")}</span>
                </div>
              )}
            </div>

            {/* Desktop table */}
            <div className={classes.desktopTableWrapper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center">{i18n.t("users.table.ID")}</TableCell>
                    <TableCell align="center">{i18n.t("users.table.status")}</TableCell>

                    <TableCell align="center">
                      Avatar
                    </TableCell>
                    <TableCell align="center">{i18n.t("users.table.name")}</TableCell>
                    <TableCell align="center">{i18n.t("users.table.email")}</TableCell>
                    <TableCell align="center">{i18n.t("users.table.profile")}</TableCell>
                    <TableCell align="center">{i18n.t("users.table.startWork")}</TableCell>
                    <TableCell align="center">{i18n.t("users.table.endWork")}</TableCell>
                    <TableCell align="center">{i18n.t("users.table.actions")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell align="center">{user.id}</TableCell>
                        <TableCell align="center"><UserStatusIcon user={user} /></TableCell>
                        <TableCell align="center" >
                          <div className={classes.avatarDiv}>
                            {renderProfileImage(user)}
                          </div>
                        </TableCell>
                        <TableCell align="center">
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                            {user.name}
                          </div>
                        </TableCell>
                        <TableCell align="center">{user.email}</TableCell>
                        <TableCell align="center">
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                            {user.super && <span title="Super Admin">👑</span>}
                            {user.profile}
                          </div>
                        </TableCell>
                        <TableCell align="center">{user.startWork}</TableCell>
                        <TableCell align="center">{user.endWork}</TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleEditUser(user)}
                          >
                            <EditIcon />
                          </IconButton>

                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setConfirmModalOpen(true);
                              setDeletingUser(user);
                            }}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                </TableBody>
              </Table>
              {loading && (
                <div className={classes.loadingContainer}>
                  <CircularProgress />
                  <span className={classes.loadingText}>{i18n.t("loading")}</span>
                </div>
              )}
            </div>
          </Paper>
          {/* Paginação numerada */}
          <nav className="flex justify-center mt-4" aria-label="Page navigation">
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
      ) : <ForbiddenPage />}
    </MainContainer>
  );
};

export default Users;