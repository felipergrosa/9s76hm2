import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useMemo,
} from "react";
import { toast } from "react-toastify";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import {
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip,
  Chip,
  Box,
  Typography,
  FormControl,
  Select,
} from "@material-ui/core";

import {
  Search as SearchIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Plus as AddIcon,
  Eye as ViewContactsIcon,
  Info as InfoIcon,
  Tag as TagIcon,
  User as UserIcon,
  Users as UsersIcon,
  Globe as RegionIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import ForbiddenPage from "../../components/ForbiddenPage";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import TagModal from "../../components/TagModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import ContactTagListModal from "../../components/ContactTagListModal";
import usePermissions from "../../hooks/usePermissions";

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

// Categoriza tags pela quantidade de '#' no início do nome (hierarquia de tags)
const categorizeTags = (tags) => {
  const personal = [];
  const group = [];
  const region = [];
  const transactional = [];

  tags.forEach((tag) => {
    const name = tag.name || "";
    if (name.startsWith("###")) {
      region.push(tag);
    } else if (name.startsWith("##")) {
      group.push(tag);
    } else if (name.startsWith("#")) {
      personal.push(tag);
    } else {
      transactional.push(tag);
    }
  });

  return { personal, group, region, transactional };
};

// Metadados de exibição de cada categoria (rótulo + dica + ícone)
const CATEGORIES = [
  {
    key: "personal",
    label: "Tags Pessoais",
    hint: "# (1x) — obrigatória por usuário",
    Icon: UserIcon,
  },
  {
    key: "group",
    label: "Tags de Grupo",
    hint: "## (2x) — complementar",
    Icon: UsersIcon,
  },
  {
    key: "region",
    label: "Tags de Região",
    hint: "### (3x) — complementar",
    Icon: RegionIcon,
  },
  {
    key: "transactional",
    label: "Tags Transacionais",
    hint: "Sem # — não afeta permissões",
    Icon: TagIcon,
  },
];

// ===== Estilos no padrão do gerenciador de Conexões/Campanhas =====
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
  },
  filterSelect: {
    minWidth: 170,
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
  // Área rolável do conteúdo — mantém header/toolbar fixos no topo do Paper
  listScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  // Caixa de ajuda explicando a hierarquia de tags
  helpBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.25),
    margin: theme.spacing(2, 2.5, 0),
    padding: theme.spacing(1.5, 2),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#f4f7e8",
    color: theme.palette.text.secondary,
  },
  // Cabeçalho de seção de cada categoria de tag
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2.5, 1),
    fontWeight: 600,
    fontSize: "0.85rem",
    color: theme.palette.text.primary,
  },
  sectionHint: {
    fontWeight: 400,
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
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

const Tags = () => {
  const classes = useStyles();
  const theme = useTheme();
  const { user, socket } = useContext(AuthContext);

  const [, setSelectedTagContacts] = useState([]);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTagName, setSelectedTagName] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [deletingTag, setDeletingTag] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tags, dispatch] = useReducer(reducer, []);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("tags.create");
  const canEdit = hasPermission("tags.edit");
  const canDelete = hasPermission("tags.delete");

  useEffect(() => {
    dispatch({ type: "RESET" });
    setLoading(true);
    const fetchTags = async () => {
      try {
        // NOTA: o backend pagina /tags em blocos de 20 (pageNumber/limit fixos em ListService).
        // A UI categoriza a lista completa sem paginação; se houver mais de 20 tags,
        // será necessário buscar todas as páginas via hasMore (limitação conhecida).
        const { data } = await api.get("/tags/", {
          params: { searchParam, kanban: 0 },
        });
        dispatch({ type: "LOAD_TAGS", payload: data.tags });
      } catch (err) {
        // 403 = sem permissão tags.view (admin)
        // Silencia o erro, lista de tags fica vazia
        if (err?.response?.status !== 403) {
          toastError(err);
        }
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

  // Agrupa as tags por categoria (hierarquia #) — recalcula só quando a lista muda
  const categorized = useMemo(() => categorizeTags(tags), [tags]);

  // Categorias visíveis na tela: respeita o filtro da toolbar e omite seções vazias
  const visibleCategories = useMemo(
    () =>
      CATEGORIES.filter(
        (cat) =>
          (!categoryFilter || cat.key === categoryFilter) &&
          categorized[cat.key].length > 0
      ),
    [categorized, categoryFilter]
  );

  const totalVisible = useMemo(
    () =>
      visibleCategories.reduce(
        (acc, cat) => acc + categorized[cat.key].length,
        0
      ),
    [visibleCategories, categorized]
  );

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
      // 403 = sem permissão tags.delete (admin)
      // Silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
    setDeletingTag(null);
  };

  // Chip colorido com o nome da tag (cor salva no cadastro)
  const renderTagChip = (tag) => (
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
  );

  // Chip de contagem de contatos + botão para abrir a lista de contatos da tag
  const renderContactCount = (tag) => (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      style={{ gap: 4 }}
    >
      <Tooltip title={`${tag?.contactCount || 0} contatos`}>
        <Chip
          label={tag?.contactCount || 0}
          size="small"
          color={tag?.contactCount > 0 ? "primary" : "default"}
          style={{ fontWeight: "bold" }}
        />
      </Tooltip>
      <Tooltip title="Ver contatos">
        <span>
          <IconButton
            size="small"
            onClick={() => handleShowContacts(tag?.contacts, tag)}
            disabled={!tag?.contactCount}
          >
            <ViewContactsIcon size={18} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );

  // Ações de editar/excluir respeitando as permissões do usuário
  const renderActions = (tag) => (
    <>
      {canEdit && (
        <IconButton size="small" onClick={() => handleEditTag(tag)}>
          <EditIcon size={18} />
        </IconButton>
      )}
      {canDelete && (
        <IconButton
          size="small"
          onClick={() => {
            setConfirmModalOpen(true);
            setDeletingTag(tag);
          }}
        >
          <DeleteIcon size={18} />
        </IconButton>
      )}
    </>
  );

  return (
    <MainContainer>
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
      {!hasPermission("tags.view") ? (
        <ForbiddenPage />
      ) : (
        <Paper className={classes.paper} variant="outlined">
          {/* Cabeçalho no padrão: título + subtítulo + ações */}
          <div className={classes.header}>
            <div className={classes.headerText}>
              <Title>
                {i18n.t("tags.title")} ({tags.length})
              </Title>
              <span className={classes.subtitle}>
                Organize contatos e tickets com tags hierárquicas — pessoais, de
                grupo, de região ou transacionais.
              </span>
            </div>
            <div className={classes.headerActions}>
              {canCreate && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon size={16} />}
                  style={{ minHeight: 36 }}
                  onClick={handleOpenTagModal}
                >
                  {i18n.t("tags.buttons.add")}
                </Button>
              )}
            </div>
          </div>

          {/* Toolbar: busca (server-side) + filtro de categoria (client-side) */}
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
            <FormControl
              size="small"
              variant="outlined"
              className={classes.filterSelect}
            >
              <Select
                native
                displayEmpty
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">Todas as categorias</option>
                <option value="personal">Pessoais (#)</option>
                <option value="group">Grupo (##)</option>
                <option value="region">Região (###)</option>
                <option value="transactional">Transacionais (sem #)</option>
              </Select>
            </FormControl>
          </div>

          {/* Conteúdo rolável: caixa de ajuda + categorias de tags */}
          <div className={classes.listScroll}>
          {/* Caixa de ajuda — explica a hierarquia de tags por quantidade de '#' */}
          <Box className={classes.helpBox}>
            <InfoIcon size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <Box>
              <Typography variant="subtitle2" style={{ fontWeight: "bold" }}>
                Como funcionam as Tags Hierárquicas:
              </Typography>
              <Typography variant="body2">
                <strong>#</strong> (1x) = Tag Pessoal (obrigatória) - Ex:
                #NOME-USUARIO
                <br />
                <strong>##</strong> (2x) = Grupo (complementar) - Ex: ##CLIENTES,
                ##REPRESENTANTES
                <br />
                <strong>###</strong> (3x) = Região (complementar) - Ex:
                ###REGIAO-NORTE
                <br />
                <strong>Sem #</strong> = Transacional (não afeta permissões) -
                Ex: VIP, ATIVO
              </Typography>
              <Typography
                variant="body2"
                style={{ marginTop: 8, fontStyle: "italic" }}
              >
                Usuários veem contatos que tenham sua tag pessoal + pelo menos
                uma tag complementar
              </Typography>
            </Box>
          </Box>

          {loading ? (
            <Table>
              <TableBody>
                <TableRowSkeleton columns={4} />
              </TableBody>
            </Table>
          ) : totalVisible === 0 ? (
            <div className={classes.emptyState}>
              <TagIcon
                size={44}
                style={{ color: theme.palette.text.disabled }}
              />
              <div>Nenhuma tag encontrada.</div>
            </div>
          ) : (
            visibleCategories.map((cat) => {
              const list = categorized[cat.key];
              return (
                <div key={cat.key}>
                  {/* Cabeçalho da categoria (nome + contagem + dica de prefixo) */}
                  <div className={classes.sectionHeader}>
                    <cat.Icon
                      size={16}
                      style={{ color: theme.palette.text.secondary }}
                    />
                    <span>
                      {cat.label} ({list.length})
                    </span>
                    <span className={classes.sectionHint}>{cat.hint}</span>
                  </div>

                  {/* Cards — mobile */}
                  <div className={classes.mobileList}>
                    {list.map((tag) => (
                      <div key={tag.id} className={classes.card}>
                        <div className={classes.cardHeader}>
                          <div className={classes.cardTitle}>
                            {renderTagChip(tag)}
                          </div>
                          <Tooltip
                            title={`${tag?.contactCount || 0} contatos`}
                          >
                            <Chip
                              label={tag?.contactCount || 0}
                              size="small"
                              color={
                                tag?.contactCount > 0 ? "primary" : "default"
                              }
                              style={{ fontWeight: "bold" }}
                            />
                          </Tooltip>
                        </div>
                        <div className={classes.cardMeta}>
                          <div>
                            <div className={classes.metaLabel}>
                              {i18n.t("tags.table.id")}
                            </div>
                            <div className={classes.metaValue}>#{tag.id}</div>
                          </div>
                          <div>
                            <div className={classes.metaLabel}>
                              {i18n.t("tags.table.contacts")}
                            </div>
                            <div className={classes.metaValue}>
                              {tag?.contactCount || 0}
                            </div>
                          </div>
                        </div>
                        <div className={classes.cardActions}>
                          <Tooltip title="Ver contatos">
                            <span>
                              <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={() =>
                                  handleShowContacts(tag?.contacts, tag)
                                }
                                disabled={!tag?.contactCount}
                              >
                                <ViewContactsIcon size={18} />
                              </IconButton>
                            </span>
                          </Tooltip>
                          {canEdit && (
                            <IconButton
                              size="small"
                              className={classes.actionButton}
                              onClick={() => handleEditTag(tag)}
                            >
                              <EditIcon size={18} />
                            </IconButton>
                          )}
                          {canDelete && (
                            <IconButton
                              size="small"
                              className={classes.actionButton}
                              onClick={() => {
                                setConfirmModalOpen(true);
                                setDeletingTag(tag);
                              }}
                            >
                              <DeleteIcon size={18} />
                            </IconButton>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tabela — desktop */}
                  <div className={classes.desktopTableWrapper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell align="center" className={classes.headCell}>
                            {i18n.t("tags.table.id")}
                          </TableCell>
                          <TableCell align="center" className={classes.headCell}>
                            {i18n.t("tags.table.name")}
                          </TableCell>
                          <TableCell align="center" className={classes.headCell}>
                            {i18n.t("tags.table.contacts")}
                          </TableCell>
                          <TableCell align="center" className={classes.headCell}>
                            {i18n.t("tags.table.actions")}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {list.map((tag) => (
                          <TableRow key={tag.id} className={classes.rowHover}>
                            <TableCell
                              align="center"
                              className={classes.bodyCell}
                            >
                              {tag.id}
                            </TableCell>
                            <TableCell
                              align="center"
                              className={classes.bodyCell}
                            >
                              {renderTagChip(tag)}
                            </TableCell>
                            <TableCell
                              align="center"
                              className={classes.bodyCell}
                            >
                              {renderContactCount(tag)}
                            </TableCell>
                            <TableCell
                              align="center"
                              className={`${classes.bodyCell} ${classes.actionsCell}`}
                            >
                              <Box
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                              >
                                {renderActions(tag)}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </Paper>
      )}
    </MainContainer>
  );
};

export default Tags;
