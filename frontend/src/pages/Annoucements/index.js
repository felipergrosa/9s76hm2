import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, IconButton, Button, Tooltip } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import { Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import AnnouncementModal from "../../components/AnnouncementModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { isArray } from "lodash";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "SET_ANNOUNCEMENTS") {
    // Substitui completamente a lista (paginação por página)
    return [...action.payload];
  }
  if (action.type === "LOAD_ANNOUNCEMENTS") {
    const announcements = action.payload;
    const newAnnouncements = [];

    if (isArray(announcements)) {
      announcements.forEach((announcement) => {
        const announcementIndex = state.findIndex(
          (u) => u.id === announcement.id
        );
        if (announcementIndex !== -1) {
          state[announcementIndex] = announcement;
        } else {
          newAnnouncements.push(announcement);
        }
      });
    }

    return [...state, ...newAnnouncements];
  }

  if (action.type === "UPDATE_ANNOUNCEMENTS") {
    const announcement = action.payload;
    const announcementIndex = state.findIndex((u) => u.id === announcement.id);

    if (announcementIndex !== -1) {
      state[announcementIndex] = announcement;
      return [...state];
    } else {
      return [announcement, ...state];
    }
  }

  if (action.type === "DELETE_ANNOUNCEMENT") {
    const announcementId = action.payload;

    const announcementIndex = state.findIndex((u) => u.id === announcementId);
    if (announcementIndex !== -1) {
      state.splice(announcementIndex, 1);
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
}));

const CustomTooltipProps = {
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5000,
  enterDelay: 300,
  leaveDelay: 100,
};

const ANNOUNCEMENTS_PER_PAGE = 25;

const Announcements = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ANNOUNCEMENTS_PER_PAGE);
  const [totalItems, setTotalItems] = useState(0);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState(null);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [announcements, dispatch] = useReducer(reducer, []);

  const totalPages = useMemo(() => {
    return totalItems === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  }, [totalItems, itemsPerPage]);

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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // trava para nao acessar pagina que não pode  
  useEffect(() => {
    async function fetchData() {
      if (!user.super) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`)
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchAnnouncements();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber, itemsPerPage, sortField, sortDirection]);

  useEffect(() => {
    if (user.companyId && socket && typeof socket.on === 'function') {
//    const socket = socketManager.GetSocket();

      const onCompanyAnnouncement = (data) => {
        if (data.action === "update" || data.action === "create") {
          dispatch({ type: "UPDATE_ANNOUNCEMENTS", payload: data.record });
        }
        if (data.action === "delete") {
          dispatch({ type: "DELETE_ANNOUNCEMENT", payload: +data.id });
        }
      }

      socket.on(`company-announcement`, onCompanyAnnouncement);
      return () => {
        if (socket && typeof socket.off === 'function') {
          socket.off(`company-announcement`, onCompanyAnnouncement);
        }
      }
    }
  }, [user]);

  const fetchAnnouncements = async () => {
    try {
      const { data } = await api.get("/announcements/", {
        params: { 
          searchParam, 
          pageNumber,
          limit: itemsPerPage,
          orderBy: sortField || 'title',
          order: sortDirection
        },
      });
      dispatch({ type: "SET_ANNOUNCEMENTS", payload: data.records || [] });
      setTotalItems(typeof data.count === "number" ? data.count : (data.total || data.records?.length || 0));
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleOpenAnnouncementModal = () => {
    setSelectedAnnouncement(null);
    setAnnouncementModalOpen(true);
  };

  const handleCloseAnnouncementModal = () => {
    setSelectedAnnouncement(null);
    setAnnouncementModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditAnnouncement = (announcement) => {
    setSelectedAnnouncement(announcement);
    setAnnouncementModalOpen(true);
  };

  const handleDeleteAnnouncement = async (announcement) => {
    try {
      if (announcement.mediaName)
        await api.delete(`/announcements/${announcement.id}/media-upload`);

      await api.delete(`/announcements/${announcement.id}`);

      toast.success(i18n.t("announcements.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingAnnouncement(null);
    setSearchParam("");
    setPageNumber(1);
    fetchAnnouncements();
  };

  const translatePriority = (val) => {
    if (val === 1) {
      return "Alta";
    }
    if (val === 2) {
      return "Média";
    }
    if (val === 3) {
      return "Baixa";
    }
  };

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
          <ConfirmationModal
            title={
              deletingAnnouncement &&
              `${i18n.t("announcements.confirmationModal.deleteTitle")} ${deletingAnnouncement.name
              }?`
            }
            open={confirmModalOpen}
            onClose={setConfirmModalOpen}
            onConfirm={() => handleDeleteAnnouncement(deletingAnnouncement)}
          >
            {i18n.t("announcements.confirmationModal.deleteMessage")}
          </ConfirmationModal>
          <AnnouncementModal
            resetPagination={() => {
              setPageNumber(1);
              fetchAnnouncements();
            }}
            open={announcementModalOpen}
            onClose={handleCloseAnnouncementModal}
            aria-labelledby="form-dialog-title"
            announcementId={selectedAnnouncement && selectedAnnouncement.id}
          />
          <MainHeader>
            <Grid style={{ width: "99.6%" }} container>
              <Grid xs={12} sm={5} item>
                <Title>
                  {i18n.t("announcements.title")} ({totalItems})
                </Title>
              </Grid>
              <Grid xs={12} sm={7} item>
                <Grid container alignItems="center" spacing={2}>
                  <Grid item xs>
                    <TextField
                      fullWidth
                      placeholder={i18n.t("announcements.searchPlaceholder")}
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
                    <Tooltip {...CustomTooltipProps} title={i18n.t("announcements.buttons.add")}>
                      <Button
                        onClick={handleOpenAnnouncementModal}
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
                        aria-label={i18n.t("announcements.buttons.add")}
                      >
                        {i18n.t("announcements.buttons.add")}
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
                      <th scope="col" style={{ textAlign: "center" }}>
                        <button 
                          onClick={() => handleSort('title')} 
                          className={classes.sortButton}
                          style={{ width: "100%", justifyContent: "center" }}
                        >
                          {i18n.t("announcements.table.title").toUpperCase()}
                          <span className={classes.sortIcon}>
                            {sortField === 'title' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        <button 
                          onClick={() => handleSort('priority')} 
                          className={classes.sortButton}
                          style={{ width: "100%", justifyContent: "center" }}
                        >
                          {i18n.t("announcements.table.priority").toUpperCase()}
                          <span className={classes.sortIcon}>
                            {sortField === 'priority' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        {i18n.t("announcements.table.mediaName").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        <button 
                          onClick={() => handleSort('status')} 
                          className={classes.sortButton}
                          style={{ width: "100%", justifyContent: "center" }}
                        >
                          {i18n.t("announcements.table.status").toUpperCase()}
                          <span className={classes.sortIcon}>
                            {sortField === 'status' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        {i18n.t("announcements.table.actions").toUpperCase()}
                      </th>
                    </tr>
                  </thead>
                  <tbody className={classes.tableBody}>
                    {!loading && announcements.length === 0 && (
                      <tr>
                        <td colSpan={5} className={classes.emptyState}>
                          Nenhum anúncio encontrado.
                        </td>
                      </tr>
                    )}
                    {announcements.map((announcement) => (
                      <tr key={announcement.id}>
                        <td style={{ textAlign: "center" }}>{announcement.title}</td>
                        <td style={{ textAlign: "center" }}>
                          {translatePriority(announcement.priority)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {announcement.mediaName ?? i18n.t("quickMessages.noAttachment")}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {announcement.status ? i18n.t("announcements.active") : i18n.t("announcements.inactive")}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <Tooltip {...CustomTooltipProps} title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => handleEditAnnouncement(announcement)}
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
                                setDeletingAnnouncement(announcement);
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
                    {loading && <TableRowSkeleton columns={5} />}
                  </tbody>
                </table>
              </Box>
              {/* Paginação Desktop */}
              <Box className={classes.pagination} component="nav" aria-label="Table navigation">
                <span className={classes.paginationInfo}>
                  Página <strong>{pageNumber}</strong> de <strong>{totalPages}</strong> • 
                  <strong>{totalItems}</strong> anúncios
                </span>
                <Box className={classes.paginationControls}>
                  <span style={{ fontSize: "0.875rem", marginRight: 8 }}>Itens por página:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setPageNumber(1);
                    }}
                    style={{ fontSize: "0.875rem", padding: "4px 8px", border: "1px solid #E5E7EB", borderRadius: "4px" }}
                  >
                    <option value={5}>5</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </Box>
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
                {!loading && announcements.length === 0 && (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    Nenhum anúncio encontrado.
                  </div>
                )}
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{announcement.title}</span>
                      <div className="flex gap-1">
                        <Tooltip {...CustomTooltipProps} title="Editar">
                          <IconButton
                            size="small"
                            onClick={() => handleEditAnnouncement(announcement)}
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
                              setDeletingAnnouncement(announcement);
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
                      <div>Prioridade: {translatePriority(announcement.priority)}</div>
                      <div>Mídia: {announcement.mediaName ?? i18n.t("quickMessages.noAttachment")}</div>
                      <div>Status: {announcement.status ? i18n.t("announcements.active") : i18n.t("announcements.inactive")}</div>
                    </div>
                  </div>
                ))}
                {loading && <TableRowSkeleton columns={5} />}
              </div>
              {/* Paginação Mobile */}
              <nav className="flex items-center justify-between p-3 mt-2 w-full max-w-[375px] mx-auto" aria-label="Mobile navigation">
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  Página <span className="font-semibold text-gray-900 dark:text-white">{pageNumber}</span>
                  {" "} de {" "}
                  <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                  {" "} • {" "}
                  <span className="font-semibold text-gray-900 dark:text-white">{totalItems}</span> anúncios
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setPageNumber(1);
                    }}
                    className="text-xs bg-gray-50 border border-gray-300 rounded-md p-1 dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value={5}>5</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
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
                </div>
              </nav>
            </>
          )}
        </Box>
      </MainContainer>
    </Box>
  )
};

export default Announcements;
