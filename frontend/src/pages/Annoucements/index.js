import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";

import {
  Search as SearchIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Plus as AddIcon,
  Megaphone as AnnouncementIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import AnnouncementModal from "../../components/AnnouncementModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { isArray } from "lodash";

import { AuthContext } from "../../context/Auth/AuthContext";
import usePermissions from "../../hooks/usePermissions";

const reducer = (state, action) => {
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

// ===== Estilos no padrão do SPEC-LAYOUT-PADRAO (referência: Connections) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    // overflowY auto no Paper preserva a paginação por scroll infinito (handleScroll)
    overflowY: "auto",
    ...theme.scrollbarStyles,
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
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    padding: theme.spacing(1.5, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
  },
  searchField: {
    minWidth: 220,
    flex: "1 1 280px",
    maxWidth: 380,
  },
  filterSelect: {
    minWidth: 150,
  },
  headCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    fontSize: "0.85rem",
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    borderBottom: `1px solid ${theme.palette.divider}`,
    verticalAlign: "middle",
  },
  rowHover: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    transition: "background-color 120ms ease",
  },
  announcementTitle: {
    fontWeight: 600,
    fontSize: "0.9rem",
    lineHeight: 1.35,
  },
  actionsCell: {
    whiteSpace: "nowrap",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(8, 2),
    color: theme.palette.text.secondary,
    textAlign: "center",
  },
  // Cards mobile
  mobileList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
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
    borderRadius: 12,
    padding: theme.spacing(1.75),
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
    gap: theme.spacing(1.25),
    minWidth: 0,
  },
  cardName: {
    fontWeight: 700,
    fontSize: "1rem",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 190,
  },
  cardMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: theme.spacing(1),
  },
  metaLabel: {
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },
  metaValue: {
    fontSize: "0.9rem",
    fontWeight: 600,
    wordBreak: "break-word",
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    flexWrap: "wrap",
  },
  actionButton: {
    minWidth: 44,
    minHeight: 44,
  },
}));

// Prioridade → chip tailwind (mesmo padrão de status das telas migradas)
const priorityInfo = (val) => {
  if (val === 1) {
    return {
      label: "Alta",
      cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
  }
  if (val === 2) {
    return {
      label: "Média",
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    };
  }
  if (val === 3) {
    return {
      label: "Baixa",
      cls: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    };
  }
  return null;
};

const PriorityChip = ({ priority }) => {
  const info = priorityInfo(priority);
  if (!info) return "—";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
};

// Status ativo/inativo → chip tailwind
const StatusChip = ({ status }) => {
  const info = status
    ? {
        label: i18n.t("announcements.active"),
        cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      }
    : {
        label: i18n.t("announcements.inactive"),
        cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
      };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
};

const Announcements = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();

  const { user, socket } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState(null);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [announcements, dispatch] = useReducer(reducer, []);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("announcements.create");
  const canEdit = hasPermission("announcements.edit");
  const canDelete = hasPermission("announcements.delete");

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

  // Busca server-side com debounce (mesmo comportamento original)
  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchAnnouncements();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

  useEffect(() => {
    if (user.companyId) {
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
        socket.off(`company-announcement`, onCompanyAnnouncement);
      }
    }
  }, [user, socket]);

  const fetchAnnouncements = async () => {
    try {
      const { data } = await api.get("/announcements/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_ANNOUNCEMENTS", payload: data.records });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
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
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  // Paginação por scroll infinito (mantida no Paper rolável)
  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  // Ações compartilhadas entre tabela (desktop) e cards (mobile)
  const renderActionButtons = (announcement) => (
    <>
      {canEdit && (
        <Tooltip title={i18n.t("announcements.dialog.edit")}>
          <IconButton
            size="small"
            onClick={() => handleEditAnnouncement(announcement)}
          >
            <EditIcon size={18} />
          </IconButton>
        </Tooltip>
      )}
      {canDelete && (
        <Tooltip title={i18n.t("announcements.confirmationModal.deleteTitle")}>
          <IconButton
            size="small"
            onClick={() => {
              setConfirmModalOpen(true);
              setDeletingAnnouncement(announcement);
            }}
          >
            <DeleteIcon size={18} />
          </IconButton>
        </Tooltip>
      )}
    </>
  );

  return (
    <MainContainer>
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
      <Paper
        className={classes.paper}
        variant="outlined"
        onScroll={handleScroll}
      >
        {/* Cabeçalho: título com contagem + subtítulo + ações */}
        <div className={classes.header}>
          <div className={classes.headerText}>
            <Title>{i18n.t("announcements.title")} ({announcements.length})</Title>
            <span className={classes.subtitle}>
              Crie e gerencie os informativos exibidos aos atendentes no painel.
            </span>
          </div>
          <div className={classes.headerActions}>
            {canCreate && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<AddIcon size={16} />}
                onClick={handleOpenAnnouncementModal}
                style={{ minHeight: 36 }}
              >
                {i18n.t("announcements.buttons.add")}
              </Button>
            )}
          </div>
        </div>

        {/* Toolbar: busca server-side (debounce no useEffect) */}
        <div className={classes.toolbar}>
          <TextField
            className={classes.searchField}
            size="small"
            variant="outlined"
            placeholder={i18n.t("announcements.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
            }}
          />
        </div>

        {loading && announcements.length === 0 ? (
          <Table size="small">
            <TableBody>
              <TableRowSkeleton columns={5} />
            </TableBody>
          </Table>
        ) : announcements.length === 0 ? (
          <div className={classes.emptyState}>
            <AnnouncementIcon size={44} style={{ color: theme.palette.text.disabled }} />
            <div>Nenhum informativo encontrado.</div>
          </div>
        ) : (
          <>
            {/* Cards — mobile */}
            <div className={classes.mobileList}>
              {announcements.map((announcement) => (
                <div key={announcement.id} className={classes.card}>
                  <div className={classes.cardHeader}>
                    <div className={classes.cardTitle}>
                      <div className={classes.cardName} title={announcement.title}>
                        {announcement.title}
                      </div>
                    </div>
                    <StatusChip status={announcement.status} />
                  </div>

                  <div className={classes.cardMeta}>
                    <div>
                      <div className={classes.metaLabel}>
                        {i18n.t("announcements.table.priority")}
                      </div>
                      <div className={classes.metaValue}>
                        <PriorityChip priority={announcement.priority} />
                      </div>
                    </div>
                    <div>
                      <div className={classes.metaLabel}>
                        {i18n.t("announcements.table.mediaName")}
                      </div>
                      <div className={classes.metaValue}>
                        {announcement.mediaName ?? i18n.t("quickMessages.noAttachment")}
                      </div>
                    </div>
                  </div>

                  {(canEdit || canDelete) && (
                    <div className={classes.cardActions}>
                      {renderActionButtons(announcement)}
                    </div>
                  )}
                </div>
              ))}
              {/* Skeleton extra durante "carregar mais" do scroll infinito */}
              {loading && (
                <Table size="small">
                  <TableBody>
                    <TableRowSkeleton columns={5} />
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Tabela — desktop */}
            <div className={classes.desktopTableWrapper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center" className={classes.headCell}>
                      {i18n.t("announcements.table.title")}
                    </TableCell>
                    <TableCell align="center" className={classes.headCell}>
                      {i18n.t("announcements.table.priority")}
                    </TableCell>
                    <TableCell align="center" className={classes.headCell}>
                      {i18n.t("announcements.table.mediaName")}
                    </TableCell>
                    <TableCell align="center" className={classes.headCell}>
                      {i18n.t("announcements.table.status")}
                    </TableCell>
                    <TableCell align="center" className={classes.headCell}>
                      {i18n.t("announcements.table.actions")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {announcements.map((announcement) => (
                    <TableRow key={announcement.id} className={classes.rowHover}>
                      <TableCell align="center" className={classes.bodyCell}>
                        <span className={classes.announcementTitle}>{announcement.title}</span>
                      </TableCell>
                      <TableCell align="center" className={classes.bodyCell}>
                        <PriorityChip priority={announcement.priority} />
                      </TableCell>
                      <TableCell align="center" className={classes.bodyCell}>
                        {announcement.mediaName ?? i18n.t("quickMessages.noAttachment")}
                      </TableCell>
                      <TableCell align="center" className={classes.bodyCell}>
                        <StatusChip status={announcement.status} />
                      </TableCell>
                      <TableCell align="center" className={`${classes.bodyCell} ${classes.actionsCell}`}>
                        {renderActionButtons(announcement)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Skeleton extra durante "carregar mais" do scroll infinito */}
                  {loading && <TableRowSkeleton columns={5} />}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Paper>
    </MainContainer>
  );
};

export default Announcements;
