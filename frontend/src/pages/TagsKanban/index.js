import React, {
  useState,
  useEffect,
  useReducer,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Button, IconButton, TextField, InputAdornment, Box, Grid, Tooltip, Chip, useMediaQuery } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import { Plus, ArrowLeft } from "lucide-react";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import TagModal from "../../components/TagModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { CheckCircle } from "@material-ui/icons";

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
}));

const CustomTooltipProps = {
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5000,
  enterDelay: 300,
  leaveDelay: 100,
};

const Tags = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
  const history = useHistory();
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
          toastError(err);
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
    // const socket = socketManager.GetSocket(user.companyId, user.id);

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
      toastError(err);
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

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
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
      <MainHeader>
            <Grid style={{ width: "99.6%" }} container>
              <Grid xs={12} sm={5} item>
                <Title>
                  {i18n.t("tagsKanban.title")} ({tags.length})
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
                    <Tooltip {...CustomTooltipProps} title={i18n.t("tagsKanban.buttons.add")}>
          <Button
                        onClick={handleOpenTagModal}
            variant="contained"
                        size="small"
                        style={{ 
                          backgroundColor: "#4ade80",
                          color: "#ffffff",
                          textTransform: "uppercase",
                          fontWeight: 600,
                          borderRadius: "8px",
                          marginRight: 8
                        }}
                        startIcon={<Plus className="w-4 h-4" />}
                        aria-label={i18n.t("tagsKanban.buttons.add")}
          >
            {i18n.t("tagsKanban.buttons.add")}
          </Button>
                    </Tooltip>
                  </Grid>
                  <Grid item>
                    <Tooltip {...CustomTooltipProps} title="Voltar para o Kanban">
          <Button
                        variant="outlined"
                        size="small"
            onClick={handleReturnToKanban}
                        style={{
                          textTransform: "uppercase",
                          fontWeight: 600,
                          borderRadius: "8px"
                        }}
                        startIcon={<ArrowLeft className="w-4 h-4" />}
                      >
                        Voltar para o Kanban
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
                        {i18n.t("tagsKanban.table.name").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        {i18n.t("tagsKanban.table.tickets").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        {i18n.t("tagsKanban.table.actions").toUpperCase()}
                      </th>
                    </tr>
                  </thead>
                  <tbody className={classes.tableBody}>
                    {!loading && tags.length === 0 && (
                      <tr>
                        <td colSpan={3} className={classes.emptyState}>
                          Nenhuma tag encontrada.
                        </td>
                      </tr>
                    )}
                    {tags.map((tag) => (
                      <tr key={tag.id}>
                        <td style={{ textAlign: "center" }}>
                          <Chip
        variant="outlined"
                            style={{
                              backgroundColor: tag.color,
                              textShadow: "1px 1px 1px #000",
                              color: "white",
                            }}
                            label={tag.name}
                            size="small"
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {tag?.ticketTags ? (<span>{tag?.ticketTags?.length}</span>) : <span>0</span>}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <Tooltip {...CustomTooltipProps} title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => handleEditTag(tag)}
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
                                setDeletingTag(tag);
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
                    {loading && (
                      <tr>
                        <td colSpan={3}>
                          <TableRowSkeleton columns={3} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Box>
            </Paper>
          ) : (
            /* Mobile View */
            <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
              {!loading && tags.length === 0 && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  Nenhuma tag encontrada.
                </div>
              )}
              {tags.map((tag) => (
                <div key={tag.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Chip
                      variant="outlined"
                      style={{
                        backgroundColor: tag.color,
                        textShadow: "1px 1px 1px #000",
                        color: "white",
                      }}
                      label={tag.name}
                      size="small"
                    />
                    <div className="flex gap-1">
                      <Tooltip {...CustomTooltipProps} title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => handleEditTag(tag)}
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
                        setDeletingTag(tag);
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
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Tickets: {tag?.ticketTags ? tag?.ticketTags?.length : 0}
                  </div>
                </div>
              ))}
              {loading && <TableRowSkeleton columns={3} />}
            </div>
          )}
        </Box>
    </MainContainer>
    </Box>
  );
};

export default Tags;
