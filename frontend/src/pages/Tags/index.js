import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
} from "react";
import { toast } from "react-toastify";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, IconButton, Button, Tooltip, Chip, Typography, Divider, Table, TableBody, TableCell, TableHead, TableRow } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import { MoreHoriz, Info } from "@material-ui/icons";
import { Plus } from "lucide-react";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import TagModal from "../../components/TagModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import ContactTagListModal from "../../components/ContactTagListModal";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD_TAGS":
      return action.payload;
    case "UPDATE_TAGS":
      const tag = action.payload;
      const tagIndex = state.findIndex((s) => s.id === tag.id);

      if (tagIndex !== -1) {
        state[tagIndex] = tag;
        return [...state];
      } else {
        return [tag, ...state];
      }
    case "DELETE_TAGS":
      const tagId = action.payload;
      return state.filter((tag) => tag.id !== tagId);
    case "RESET":
      return [];
    default:
      return state;
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
  categoryHeader: {
    backgroundColor: theme.palette.grey[100],
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    borderRadius: 4,
  },
  helpBox: {
    backgroundColor: theme.palette.info.light,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderRadius: 4,
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1),
  },
  categoryDivider: {
    margin: theme.spacing(2, 0),
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
  const { user, socket } = useContext(AuthContext);

  const [selectedTagContacts, setSelectedTagContacts] = useState([]);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTagName, setSelectedTagName] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [deletingTag, setDeletingTag] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [tags, dispatch] = useReducer(reducer, []);
  const [tagModalOpen, setTagModalOpen] = useState(false);

  // Função para categorizar tags baseado na quantidade de #
  const categorizeTags = (tags) => {
    const personal = [];
    const group = [];
    const region = [];
    const transactional = [];

    tags.forEach(tag => {
      const name = tag.name || '';
      if (name.startsWith('###')) {
        region.push(tag);
      } else if (name.startsWith('##')) {
        group.push(tag);
      } else if (name.startsWith('#')) {
        personal.push(tag);
      } else {
        transactional.push(tag);
      }
    });

    return { personal, group, region, transactional };
  };

  useEffect(() => {
    dispatch({ type: "RESET" });
    setLoading(true);
    const fetchTags = async () => {
      try {
        const { data } = await api.get("/tags/", {
          params: { searchParam, kanban: 0 },
        });
        dispatch({ type: "LOAD_TAGS", payload: data.tags });
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTags();
  }, [searchParam]);

  useEffect(() => {
    const onCompanyTags = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_TAGS", payload: data.tag });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_TAGS", payload: +data.tagId });
      }
    };
    socket.on(`company${user.companyId}-tag`, onCompanyTags);

    return () => {
      socket.off(`company${user.companyId}-tag`, onCompanyTags);
    };
  }, [socket, user.companyId]);

  const handleOpenTagModal = () => {
    setSelectedTag(null);
    setTagModalOpen(true);
  };

  const handleCloseTagModal = () => {
    setSelectedTag(null);
    setTagModalOpen(false);
  };

  const handleSearch = (event) => {
    const newSearchParam = event.target.value.toLowerCase();
    setSearchParam(newSearchParam);
  };

  const handleEditTag = (tag) => {
    setSelectedTag(tag);
    setTagModalOpen(true);
  };

  const handleShowContacts = (contacts, tag) => {
    setSelectedTagContacts(contacts);
    setContactModalOpen(true);
    setSelectedTagName(tag);
  };

  const handleCloseContactModal = () => {
    setContactModalOpen(false);
    setSelectedTagContacts([]);
    setSelectedTagName("");
  };

  const handleDeleteTag = async (tagId) => {
    try {
      await api.delete(`/tags/${tagId}`);
      toast.success(i18n.t("tags.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingTag(null);
  };

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
          {contactModalOpen && (
            <ContactTagListModal
              open={contactModalOpen}
              onClose={handleCloseContactModal}
              tag={selectedTagName}
            />
          )}
          <ConfirmationModal
            title={deletingTag && `${i18n.t("tags.confirmationModal.deleteTitle")}`}
            open={confirmModalOpen}
            onClose={() => setConfirmModalOpen(false)}
            onConfirm={() => handleDeleteTag(deletingTag.id)}
          >
            {i18n.t("tags.confirmationModal.deleteMessage")}
          </ConfirmationModal>
          <TagModal
            open={tagModalOpen}
            onClose={handleCloseTagModal}
            aria-labelledby="form-dialog-title"
            tagId={selectedTag && selectedTag.id}
            kanban={0}
          />
          <MainHeader>
            <Grid style={{ width: "99.6%" }} container>
              <Grid xs={12} sm={5} item>
                <Title>
                  {i18n.t("tags.title")} ({tags.length})
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
                    <Tooltip {...CustomTooltipProps} title={i18n.t("tags.buttons.add")}>
                      <Button
                        onClick={handleOpenTagModal}
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
                        aria-label={i18n.t("tags.buttons.add")}
                      >
                        {i18n.t("tags.buttons.add")}
                      </Button>
                    </Tooltip>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
      >
        {/* Caixa de Ajuda */}
        <Box className={classes.helpBox}>
          <Info color="primary" />
          <Box>
            <Typography variant="subtitle2" style={{ fontWeight: 'bold' }}>
              Como funcionam as Tags Hierárquicas:
            </Typography>
            <Typography variant="body2">
              <strong>#</strong> (1x) = Tag Pessoal (obrigatória) - Ex: #NOME-USUARIO<br />
              <strong>##</strong> (2x) = Grupo (complementar) - Ex: ##CLIENTES, ##REPRESENTANTES<br />
              <strong>###</strong> (3x) = Região (complementar) - Ex: ###REGIAO-NORTE<br />
              <strong>Sem #</strong> = Transacional (não afeta permissões) - Ex: VIP, ATIVO
            </Typography>
            <Typography variant="body2" style={{ marginTop: 8, fontStyle: 'italic' }}>
              💡 Usuários veem contatos que tenham sua tag pessoal + pelo menos uma tag complementar
            </Typography>
          </Box>
        </Box>

        {(() => {
          const categorized = categorizeTags(tags);
          
          const renderTagTable = (categoryTags, title) => {
            if (categoryTags.length === 0) return null;
            
            return (
              <>
                <Box className={classes.categoryHeader}>
                  <Typography variant="h6" style={{ fontWeight: 'bold' }}>
                    {title} ({categoryTags.length})
                  </Typography>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell align="center">ID</TableCell>
                      <TableCell align="center">Nome</TableCell>
                      <TableCell align="center">Contatos</TableCell>
                      <TableCell align="center">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categoryTags.map((tag) => (
                      <TableRow key={tag.id}>
                        <TableCell align="center">{tag.id}</TableCell>
                        <TableCell align="center">
                          <Chip
                            variant="outlined"
                            style={{
                              backgroundColor: tag.color,
                              textShadow: "0px 0.3px #000",
                              color: "white",
                            }}
                            label={tag.name}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          {tag?.contacts?.length}
                          <Tooltip {...CustomTooltipProps} title="Ver Contatos">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleShowContacts(tag?.contacts, tag)}
                                disabled={tag?.contacts?.length === 0}
                                style={{
                                  color: tag?.contacts?.length === 0 ? "#9ca3af" : "#374151",
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "8px"
                                }}
                              >
                                <MoreHoriz fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center">
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
                              onClick={() => {
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Divider className={classes.categoryDivider} />
              </>
            );
          };

          return (
            <>
              {renderTagTable(categorized.personal, "📋 Tags Pessoais")}
              {renderTagTable(categorized.group, "👥 Tags de Grupo")}
              {renderTagTable(categorized.region, "🌎 Tags de Região")}
              {renderTagTable(categorized.transactional, "🔖 Tags Transacionais")}
              {loading && (
                <Table size="small">
                  <TableBody>
                    <TableRowSkeleton key="skeleton" columns={4} />
                  </TableBody>
                </Table>
              )}
            </>
          );
        })()}
        </Paper>
        </Box>
      </MainContainer>
    </Box>
  );
};

export default Tags;
