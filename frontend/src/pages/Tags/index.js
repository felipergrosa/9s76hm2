import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useRef,
} from "react";
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

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

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
import { Chip, Tooltip, Typography, Box, Divider, Accordion, AccordionSummary, AccordionDetails } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import { MoreHoriz, ExpandMore, Info } from "@material-ui/icons";
import ContactTagListModal from "../../components/ContactTagListModal";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD_TAGS":
      console.log("LOAD_TAGS", action.payload);
      return [...state, ...action.payload];
    case "UPDATE_TAGS":
      console.log("UPDATE_TAGS", action.payload);
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
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
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

const Tags = () => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);

  const [selectedTagContacts, setSelectedTagContacts] = useState([]);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTagName, setSelectedTagName] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [deletingTag, setDeletingTag] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [tags, dispatch] = useReducer(reducer, []);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const pageNumberRef = useRef(0);

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
    const fetchMoreTags = async () => {
      if (pageNumberRef.current === pageNumber) {
        return;
      }
      pageNumberRef.current = pageNumber;
      try {
        const { data } = await api.get("/tags/", {
          params: { searchParam, pageNumber, kanban: 0 },
        });
        console.log("fetchMoreTags", data.tags);
        dispatch({ type: "LOAD_TAGS", payload: data.tags });
        setHasMore(data.hasMore);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };

    if (pageNumber > 0) {
      setLoading(true);
      fetchMoreTags();
    }
  }, [searchParam, pageNumber]);

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
    setPageNumber(1);
    dispatch({ type: "RESET" });
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
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <MainContainer className={classes.mainContainer}>
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
        <Title>{i18n.t("tags.title")} ({tags.length})</Title>
        <MainHeaderButtonsWrapper>
          <TextField
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
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenTagModal}
          >
            {i18n.t("tags.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
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
            console.log("renderTagTable", categoryTags, title);
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
                          <IconButton
                            size="small"
                            onClick={() => handleShowContacts(tag?.contacts, tag)}
                            disabled={tag?.contacts?.length === 0}
                          >
                            <MoreHoriz />
                          </IconButton>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={() => handleEditTag(tag)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setConfirmModalOpen(true);
                              setDeletingTag(tag);
                            }}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
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
              {loading && <TableRowSkeleton key="skeleton" columns={4} />}
            </>
          );
        })()}
      </Paper>
    </MainContainer>
  );
};

export default Tags;
