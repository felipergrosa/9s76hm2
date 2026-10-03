import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
} from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom"; // Importe o useHistory

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
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";

import {
  Search as SearchIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Plus as AddIcon,
  Tag as TagIcon,
  ArrowLeft as ArrowLeftIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import TagModal from "../../components/TagModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_TAGS") {
    const tags = action.payload;
    const newTags = [];

    tags.forEach((tag) => {
      const tagIndex = state.findIndex((s) => s.id === tag.id);
      if (tagIndex !== -1) {
        state[tagIndex] = tag;
      } else {
        newTags.push(tag);
      }
    });

    return [...state, ...newTags];
  }

  if (action.type === "UPDATE_TAGS") {
    const tag = action.payload;
    const tagIndex = state.findIndex((s) => s.id === tag.id);

    if (tagIndex !== -1) {
      state[tagIndex] = tag;
      return [...state];
    } else {
      return [tag, ...state];
    }
  }

  if (action.type === "DELETE_TAGS") {
    const tagId = action.payload;

    const tagIndex = state.findIndex((s) => s.id === tagId);
    if (tagIndex !== -1) {
      state.splice(tagIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

// ===== Estilos no padrão do gerenciador de Conexões/Tags =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
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
    // Em mobile a busca ocupa a largura total da toolbar
    [theme.breakpoints.down("sm")]: {
      minWidth: 0,
      maxWidth: "100%",
      flex: "1 1 100%",
    },
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
  // Área rolável do conteúdo — recebe o onScroll do carregamento infinito
  listScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    ...theme.scrollbarStyles,
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

const Tags = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory(); // Inicialize o useHistory

  const { user, socket } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [deletingTag, setDeletingTag] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [tags, dispatch] = useReducer(reducer, []);
  const [tagModalOpen, setTagModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTags = async () => {
        try {
          const { data } = await api.get("/tags/", {
            params: { searchParam, pageNumber, kanban: 1 },
          });
          dispatch({ type: "LOAD_TAGS", payload: data.tags });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          // 403 = sem permissão tags.view (admin)
          // Silencia o erro, lista de tags fica vazia
          if (err?.response?.status !== 403) {
            toastError(err);
          }
          setLoading(false);
        }
      };
      fetchTags();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    const onTagsEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_TAGS", payload: data.tag });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_TAGS", payload: +data.tagId });
      }
    };
    socket.on(`company${user.companyId}-tag`, onTagsEvent);

    return () => {
      socket.off(`company${user.companyId}-tag`, onTagsEvent);
    };
  }, [socket]);

  const handleOpenTagModal = () => {
    setSelectedTag(null);
    setTagModalOpen(true);
  };

  const handleCloseTagModal = () => {
    setSelectedTag(null);
    setTagModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditTag = (tag) => {
    setSelectedTag(tag);
    setTagModalOpen(true);
  };

  const handleDeleteTag = async (tagId) => {
    try {
      await api.delete(`/tags/${tagId}`);
      toast.success(i18n.t("tags.toasts.deleted"));
    } catch (err) {
      // 403 = sem permissão tags.delete (admin)
      // Silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
    setDeletingTag(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const handleReturnToKanban = () => {
    history.push("/kanban");
  };

  // Chip colorido com o nome da fase (cor salva no cadastro)
  const renderTagChip = (tag) => (
    <Chip
      variant="outlined"
      style={{
        backgroundColor: tag.color,
        textShadow: "1px 1px 1px #000",
        color: "white",
        maxWidth: "100%",
      }}
      label={tag.name}
      size="small"
    />
  );

  const renderActions = (tag, touchFriendly) => (
    <>
      <IconButton
        size="small"
        className={touchFriendly ? classes.actionButton : undefined}
        onClick={() => handleEditTag(tag)}
      >
        <EditIcon size={18} />
      </IconButton>
      <IconButton
        size="small"
        className={touchFriendly ? classes.actionButton : undefined}
        onClick={() => {
          setConfirmModalOpen(true);
          setDeletingTag(tag);
        }}
      >
        <DeleteIcon size={18} />
      </IconButton>
    </>
  );

  return (
    <MainContainer>
      <ConfirmationModal
        title={deletingTag && `${i18n.t("tagsKanban.confirmationModal.deleteTitle")}`}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteTag(deletingTag.id)}
      >
        {i18n.t("tagsKanban.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      {tagModalOpen && (
        <TagModal
          open={tagModalOpen}
          onClose={handleCloseTagModal}
          aria-labelledby="form-dialog-title"
          tagId={selectedTag && selectedTag.id}
          kanban={1}
        />
      )}
      <Paper className={classes.paper} variant="outlined">
        {/* Cabeçalho no padrão: título + subtítulo + ações */}
        <div className={classes.header}>
          <div className={classes.headerText}>
            <Title>{i18n.t("tagsKanban.title")} ({tags.length})</Title>
            <span className={classes.subtitle}>
              Gerencie as fases (colunas) do seu quadro Kanban.
            </span>
          </div>
          <div className={classes.headerActions}>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<ArrowLeftIcon size={16} />}
              style={{ minHeight: 36 }}
              onClick={handleReturnToKanban}
            >
              {'Voltar para o Kanban'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddIcon size={16} />}
              style={{ minHeight: 36 }}
              onClick={handleOpenTagModal}
            >
              {i18n.t("tagsKanban.buttons.add")}
            </Button>
          </div>
        </div>

        {/* Toolbar: busca server-side (mesmo handler original) */}
        <div className={classes.toolbar}>
          <TextField
            className={classes.searchField}
            size="small"
            variant="outlined"
            placeholder={i18n.t("contacts.searchPlaceholder")}
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

        {/* Conteúdo rolável — o onScroll mantém a paginação infinita */}
        <div className={classes.listScroll} onScroll={handleScroll}>
          {tags.length === 0 && loading ? (
            <Table size="small">
              <TableBody>
                <TableRowSkeleton columns={3} />
              </TableBody>
            </Table>
          ) : tags.length === 0 ? (
            <div className={classes.emptyState}>
              <TagIcon size={44} style={{ color: theme.palette.text.disabled }} />
              <div>Nenhuma fase encontrada.</div>
            </div>
          ) : (
            <>
              {/* Cards — mobile */}
              <div className={classes.mobileList}>
                {tags.map((tag) => (
                  <div key={tag.id} className={classes.card}>
                    <div className={classes.cardHeader}>
                      <div className={classes.cardTitle}>
                        {renderTagChip(tag)}
                      </div>
                      <Tooltip title={i18n.t("tagsKanban.table.tickets")}>
                        <Chip
                          label={tag?.ticketTags ? tag.ticketTags.length : 0}
                          size="small"
                          color={tag?.ticketTags?.length > 0 ? "primary" : "default"}
                          style={{ fontWeight: "bold" }}
                        />
                      </Tooltip>
                    </div>
                    <div className={classes.cardActions}>
                      {renderActions(tag, true)}
                    </div>
                  </div>
                ))}
                {loading && (
                  <Table size="small">
                    <TableBody>
                      <TableRowSkeleton columns={1} />
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
                        {i18n.t("tagsKanban.table.name")}
                      </TableCell>
                      <TableCell align="center" className={classes.headCell}>
                        {i18n.t("tagsKanban.table.tickets")}
                      </TableCell>
                      <TableCell align="center" className={classes.headCell}>
                        {i18n.t("tagsKanban.table.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <>
                      {tags.map((tag) => (
                        <TableRow key={tag.id} className={classes.rowHover}>
                          <TableCell align="center" className={classes.bodyCell}>
                            {renderTagChip(tag)}
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            {tag?.ticketTags ? (
                              <span>{tag?.ticketTags?.length}</span>
                            ) : (
                              <span>0</span>
                            )}
                          </TableCell>
                          <TableCell
                            align="center"
                            className={`${classes.bodyCell} ${classes.actionsCell}`}
                          >
                            {renderActions(tag, false)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {loading && <TableRowSkeleton columns={3} />}
                    </>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </Paper>
    </MainContainer>
  );
};

export default Tags;
