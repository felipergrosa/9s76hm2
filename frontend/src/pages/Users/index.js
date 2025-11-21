import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
import { toast } from "react-toastify";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, IconButton, Button, Tooltip, Avatar, CircularProgress } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import { AccountCircle } from "@material-ui/icons";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import whatsappIcon from '../../assets/nopicture.png'
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import UserModal from "../../components/UserModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import UserStatusIcon from "../../components/UserModal/statusIcon";
import { getBackendUrl } from "../../config";
import { AuthContext } from "../../context/Auth/AuthContext";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";

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
  root: {
    flex: 1,
    backgroundColor: theme.palette.background.default,
    minHeight: "100%",
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  container: {
    width: "100%",
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHead: {
    backgroundColor: theme.palette.grey[100],
    "& th": {
      padding: theme.spacing(1.5),
      textAlign: "left",
      fontSize: "0.75rem",
      fontWeight: 600,
      textTransform: "uppercase",
      color: theme.palette.text.secondary,
      borderBottom: `2px solid ${theme.palette.divider}`,
    },
  },
  sortButton: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
    "&:hover": {
      opacity: 0.8,
    },
  },
  sortIcon: {
    fontSize: "0.75rem",
    opacity: 0.6,
  },
  tableBody: {
    "& tr": {
      borderBottom: `1px solid ${theme.palette.divider}`,
      transition: "background-color 0.2s",
      "&:hover": {
        backgroundColor: theme.palette.action.hover,
      },
      "&:last-child": {
        borderBottom: "none",
      },
    },
    "& td": {
      padding: theme.spacing(1.5),
      fontSize: "0.875rem",
      color: theme.palette.text.primary,
    },
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[1],
    marginTop: theme.spacing(2),
  },
  paginationInfo: {
    fontSize: "0.875rem",
    color: theme.palette.text.secondary,
  },
  paginationControls: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  pageButton: {
    minWidth: 32,
    height: 32,
    padding: theme.spacing(0.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    cursor: "pointer",
    transition: "all 0.2s",
    "&:hover:not(:disabled)": {
      backgroundColor: theme.palette.action.hover,
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  },
  pageButtonActive: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderColor: theme.palette.primary.main,
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
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

const CustomTooltipProps = {
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5000,
  enterDelay: 300,
  leaveDelay: 100,
};

const Users = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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
  }, [socket]);

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
  const totalPages = useMemo(() => {
    return totalUsers === 0 ? 1 : Math.ceil(totalUsers / USERS_PER_PAGE);
  }, [totalUsers]);
  
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setPageNumber(page);
    }
  };
  
  const renderPageNumbers = useMemo(() => {
    const pages = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, Math.min(pageNumber - 1, totalPages - 2));
      const end = Math.min(totalPages, start + 2);
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  }, [pageNumber, totalPages]);

  const renderProfileImage = (user) => {
    if (user.id === loggedInUser.id) {
      return (
        <Avatar
          src={`${backendUrl}/public/company${user.companyId}/user/${profileImage ? profileImage : whatsappIcon}`}
          alt={user.name}
          className={classes.userAvatar}
        />
      )
    }
    if (user.id !== loggedInUser.id) {
      return (
        <Avatar
          src={user.profileImage ? `${backendUrl}/public/company${user.companyId}/user/${user.profileImage}` : whatsappIcon}
          alt={user.name}
          className={classes.userAvatar}
        />
      )
    }
    return (
      <AccountCircle />
    )
  };

  return (
    <Box className={classes.root}>
    <MainContainer useWindowScroll>
        <Box className={classes.container}>
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
                <Grid style={{ width: "99.6%" }} container>
                  <Grid xs={12} sm={5} item>
                    <Title>
                      {i18n.t("users.title")} ({totalUsers})
                    </Title>
                  </Grid>
                  <Grid xs={12} sm={7} item>
                    <Grid container alignItems="center" spacing={2}>
                      <Grid item xs>
              <TextField
                          fullWidth
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
                      <Grid item>
                        <Tooltip {...CustomTooltipProps} title={i18n.t("users.buttons.add")}>
              <Button
                            onClick={handleOpenUserModal}
                variant="contained"
                            size="small"
                            style={{ 
                              backgroundColor: "#4ade80",
                              color: "#ffffff",
                              textTransform: "uppercase",
                              fontWeight: 600,
                              borderRadius: "8px"
                            }}
                            startIcon={<Plus className="w-4 h-4" />}
                            aria-label={i18n.t("users.buttons.add")}
              >
                {i18n.t("users.buttons.add")}
              </Button>
                        </Tooltip>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
          </MainHeader>
              {isDesktop ? (
                <Paper className={classes.mainPaper} variant="outlined">
                  <Box style={{ overflowX: "auto" }}>
                    <table className={classes.table}>
                      <thead className={classes.tableHead}>
                        <tr>
                          <th scope="col" style={{ textAlign: "center", width: "80px" }}>
                            <button 
                              onClick={() => handleSort('id')} 
                              className={classes.sortButton}
                              style={{ width: "100%", justifyContent: "center" }}
                            >
                              {i18n.t("users.table.ID").toUpperCase()}
                              <span className={classes.sortIcon}>
                                {sortField === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={{ textAlign: "center", width: "100px" }}>
                            {i18n.t("users.table.status").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center", width: "100px" }}>
                            AVATAR
                          </th>
                          <th scope="col" style={{ textAlign: "center", width: "200px" }}>
                            <button 
                              onClick={() => handleSort('name')} 
                              className={classes.sortButton}
                              style={{ width: "100%", justifyContent: "center" }}
                            >
                              {i18n.t("users.table.name").toUpperCase()}
                              <span className={classes.sortIcon}>
                                {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={{ textAlign: "center", width: "250px" }}>
                            <button 
                              onClick={() => handleSort('email')} 
                              className={classes.sortButton}
                              style={{ width: "100%", justifyContent: "center" }}
                            >
                              {i18n.t("users.table.email").toUpperCase()}
                              <span className={classes.sortIcon}>
                                {sortField === 'email' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={{ textAlign: "center", width: "120px" }}>
                            <button 
                              onClick={() => handleSort('profile')} 
                              className={classes.sortButton}
                              style={{ width: "100%", justifyContent: "center" }}
                            >
                              {i18n.t("users.table.profile").toUpperCase()}
                              <span className={classes.sortIcon}>
                                {sortField === 'profile' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={{ textAlign: "center", width: "120px" }}>
                            {i18n.t("users.table.startWork").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center", width: "120px" }}>
                            {i18n.t("users.table.endWork").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center", width: "120px" }}>
                            {i18n.t("users.table.actions").toUpperCase()}
                          </th>
                        </tr>
                      </thead>
                      <tbody className={classes.tableBody}>
                        {!loading && users.length === 0 && (
                          <tr>
                            <td colSpan={9} className={classes.emptyState}>
                              Nenhum usuário encontrado.
                            </td>
                          </tr>
                        )}
                  {users.map((user) => (
                          <tr key={user.id}>
                            <td style={{ textAlign: "center" }}>{user.id}</td>
                            <td style={{ textAlign: "center" }}><UserStatusIcon user={user} /></td>
                            <td style={{ textAlign: "center" }}>
                        <div className={classes.avatarDiv}>
                          {renderProfileImage(user)}
                        </div>
                            </td>
                            <td style={{ textAlign: "center" }}>{user.name}</td>
                            <td style={{ textAlign: "center" }}>{user.email}</td>
                            <td style={{ textAlign: "center" }}>{user.profile}</td>
                            <td style={{ textAlign: "center" }}>{user.startWork}</td>
                            <td style={{ textAlign: "center" }}>{user.endWork}</td>
                            <td style={{ textAlign: "center" }}>
                              <Tooltip {...CustomTooltipProps} title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => handleEditUser(user)}
                                  style={{
                                    color: "#374151",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    marginRight: 4
                                  }}
                        >
                                  <EditIcon fontSize="small" />
                        </IconButton>
                              </Tooltip>
                              <Tooltip {...CustomTooltipProps} title="Deletar">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setConfirmModalOpen(true);
                            setDeletingUser(user);
                          }}
                                  style={{
                                    color: "#dc2626",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px"
                                  }}
                        >
                                  <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                              </Tooltip>
                            </td>
                          </tr>
                        ))}
                        {loading && <TableRowSkeleton columns={9} />}
                      </tbody>
                    </table>
                  </Box>
                  {/* Paginação Desktop */}
                  <Box className={classes.pagination} component="nav" aria-label="Table navigation">
                    <span className={classes.paginationInfo}>
                      Página <strong>{pageNumber}</strong> de <strong>{totalPages}</strong> • 
                      <strong>{totalUsers}</strong> usuários
                    </span>
                    <Box className={classes.paginationControls} component="ul" style={{ listStyle: "none", display: "flex", gap: 4, margin: 0, padding: 0 }}>
                      <li>
                        <button
                          onClick={() => handlePageChange(1)}
                          disabled={pageNumber === 1}
                          className={classes.pageButton}
                        >
                          <ChevronsLeft className="w-5 h-5" />
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => handlePageChange(pageNumber - 1)}
                          disabled={pageNumber === 1}
                          className={classes.pageButton}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      </li>
                      {renderPageNumbers.map((page, index) => (
                        <li key={index}>
                          <button
                            onClick={() => handlePageChange(page)}
                            className={`${classes.pageButton} ${page === pageNumber ? classes.pageButtonActive : ""}`}
                          >
                            {page}
                          </button>
                        </li>
                      ))}
                      <li>
                        <button
                          onClick={() => handlePageChange(pageNumber + 1)}
                          disabled={pageNumber === totalPages}
                          className={classes.pageButton}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => handlePageChange(totalPages)}
                          disabled={pageNumber === totalPages}
                          className={classes.pageButton}
                        >
                          <ChevronsRight className="w-5 h-5" />
                        </button>
                      </li>
                    </Box>
                  </Box>
                </Paper>
              ) : (
                /* Mobile View */
                <>
                  <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
                    {!loading && users.length === 0 && (
                      <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        Nenhum usuário encontrado.
              </div>
            )}
                    {users.map((user) => (
                      <div key={user.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={classes.avatarDiv}>
                              {renderProfileImage(user)}
                            </div>
                            <div>
                              <span className="font-semibold text-sm">{user.name}</span>
                              <div className="text-xs text-gray-600 dark:text-gray-400">{user.email}</div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Tooltip {...CustomTooltipProps} title="Editar">
                              <IconButton
                                size="small"
                                onClick={() => handleEditUser(user)}
                                style={{
                                  color: "#374151",
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "8px"
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip {...CustomTooltipProps} title="Deletar">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  setConfirmModalOpen(true);
                                  setDeletingUser(user);
                                }}
                                style={{
                                  color: "#dc2626",
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "8px"
                                }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <div>ID: {user.id}</div>
                          <div>Perfil: {user.profile}</div>
                          <div>Status: <UserStatusIcon user={user} /></div>
                          {user.startWork && <div>Início: {user.startWork}</div>}
                          {user.endWork && <div>Fim: {user.endWork}</div>}
                        </div>
                      </div>
                    ))}
                    {loading && <TableRowSkeleton columns={9} />}
                  </div>
                  {/* Paginação Mobile */}
                  <nav className="flex items-center justify-between p-3 mt-2 w-full max-w-[375px] mx-auto" aria-label="Mobile navigation">
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                      Página <span className="font-semibold text-gray-900 dark:text-white">{pageNumber}</span>
                      {" "} de {" "}
                      <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                      {" "} • {" "}
                      <span className="font-semibold text-gray-900 dark:text-white">{totalUsers}</span> usuários
                    </span>
                    <ul className="inline-flex items-center -space-x-px">
              <li>
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={pageNumber === 1}
                          className="flex items-center justify-center px-2 h-8 ml-0 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => handlePageChange(pageNumber - 1)}
                  disabled={pageNumber === 1}
                          className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </li>
                      {renderPageNumbers.map((page, index) => (
                        <li key={index}>
                          <button
                            onClick={() => handlePageChange(page)}
                            className={`flex items-center justify-center px-2 h-8 leading-tight border
                              ${page === pageNumber
                                  ? "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                      : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                  }`}
                >
                            {page}
                </button>
              </li>
                      ))}
              <li>
                <button
                  onClick={() => handlePageChange(pageNumber + 1)}
                  disabled={pageNumber === totalPages}
                          className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={pageNumber === totalPages}
                          className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronsRight className="w-4 h-4" />
                </button>
              </li>
            </ul>
          </nav>
                </>
              )}
        </>
      ) : <ForbiddenPage />}
        </Box>
    </MainContainer>
    </Box>
  );
};

export default Users;