import React, { useState, useEffect, useReducer } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import CircularProgress from "@material-ui/core/CircularProgress";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";

import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import { ShieldCheck } from "lucide-react";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import RoleModal from "../../components/RoleModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD":
      return action.payload;
    case "DELETE":
      return state.filter((r) => r.id !== action.payload);
    default:
      return state;
  }
};

const useStyles = makeStyles((theme) => ({
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
}));

const chipBaseClass =
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

// Permissões dos perfis padrão (seed "Criar perfis padrão").
// Supervisor = Atendente + permissões extras de supervisão.
const ATENDENTE_PERMISSIONS = [
  "tickets.view",
  "tickets.create",
  "tickets.update",
  "tickets.transfer",
  "tickets.close",
  "quick-messages.view",
  "contacts.view",
  "contacts.create",
  "contacts.edit",
  "tags.view",
  "helps.view",
  "announcements.view",
  "internal-chat.view",
  "kanban.view",
  "schedules.view",
  "ai-chat-assistant.use",
];

const SUPERVISOR_EXTRA_PERMISSIONS = [
  "tickets.view-all",
  "tickets.view-all-users",
  "tickets.view-all-historic",
  "tickets.delete",
  "dashboard.view",
  "reports.view",
  "realtime.view",
  "contacts.edit-tags",
  "contacts.edit-wallets",
  "contacts.edit-representative",
  "contacts.import",
  "contacts.export",
  "contact-lists.view",
  "contact-lists.create",
  "contact-lists.edit",
];

// Aba "Perfis de Acesso" da página /users — sem página/rota própria.
// Gate interno: só busca e renderiza se o usuário tiver roles.view.
const RolesTab = () => {
  const classes = useStyles();
  const { hasPermission } = usePermissions();

  const canView = hasPermission("roles.view");
  const canCreate = hasPermission("roles.create");
  const canEdit = hasPermission("roles.edit");
  const canDelete = hasPermission("roles.delete");
  // canCreate entra aqui para a coluna Ações exibir o botão "Duplicar"
  const canManage = canEdit || canDelete || canCreate;

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [roles, dispatch] = useReducer(reducer, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [duplicateData, setDuplicateData] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const colSpan = canManage ? 5 : 4;

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/roles", { params: { searchParam } });
      dispatch({ type: "LOAD", payload: data });
    } catch (err) {
      // 403 = sem permissão roles.view — silencia o erro (lista fica vazia)
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    // Debounce de 500ms na busca (padrão MainListItems)
    const delayDebounceFn = setTimeout(() => {
      fetchRoles();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, canView]);

  const handleOpenModal = () => {
    setSelectedId(null);
    setDuplicateData(null);
    setModalOpen(true);
  };

  const handleEdit = (role) => {
    setSelectedId(role.id);
    setDuplicateData(null);
    setModalOpen(true);
  };

  // Duplicar: abre o RoleModal pré-preenchido sem roleId → salva via POST /roles
  const handleDuplicate = (role) => {
    setSelectedId(null);
    setDuplicateData({
      name: `${role.name} (cópia)`,
      description: role.description || "",
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
    });
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setDuplicateData(null);
    fetchRoles();
  };

  // Seed: cria os 3 perfis padrão quando a empresa ainda não tem nenhuma role.
  // "Administrador" recebe TODAS as permissões do catálogo, exceto as de
  // gestão de empresas (companies.*) e visão global de conexões (all-connections.*).
  const handleSeedDefaults = async () => {
    try {
      setSeeding(true);
      const { data: catalog } = await api.get("/permissions/catalog");
      const adminPermissions = (Array.isArray(catalog) ? catalog : [])
        .flatMap((c) => (c.permissions || []).map((p) => p.key))
        .filter(
          (key) =>
            !key.startsWith("companies.") && !key.startsWith("all-connections.")
        );

      const defaults = [
        {
          name: "Atendente",
          description: "Atendimento de tickets, contatos e agenda do dia a dia.",
          permissions: ATENDENTE_PERMISSIONS,
        },
        {
          name: "Supervisor",
          description:
            "Atendente + visão de todos os tickets, relatórios e gestão de contatos.",
          permissions: [...ATENDENTE_PERMISSIONS, ...SUPERVISOR_EXTRA_PERMISSIONS],
        },
        {
          name: "Administrador",
          description:
            "Acesso completo às permissões da empresa (exceto empresas e conexões globais).",
          permissions: adminPermissions,
        },
      ];

      // Sequencial para manter a ordem de criação dos perfis
      for (const role of defaults) {
        await api.post("/roles", role);
      }
      toast.success("Perfis padrão criados com sucesso");
      fetchRoles();
    } catch (err) {
      toastError(err);
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/roles/${id}`);
      dispatch({ type: "DELETE", payload: id });
      toast.success("Perfil de acesso excluído");
    } catch (err) {
      // 403 = sem permissão roles.delete — silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
    setDeleting(null);
  };

  if (!canView) return null;

  return (
    <>
      <ConfirmationModal
        title={deleting && "Excluir perfil de acesso?"}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleDelete(deleting.id)}
      >
        Usuários que tiverem este perfil atribuído perdem as permissões concedidas
        por ele. Essa ação não pode ser desfeita.
      </ConfirmationModal>
      <RoleModal
        open={modalOpen}
        onClose={handleModalClose}
        roleId={selectedId}
        initialValues={duplicateData}
      />

      {/* Barra de busca + ação primária (padrão FollowUps/MetaTemplates) */}
      <Box className={classes.toolbar}>
        <TextField
          placeholder="Buscar perfil..."
          type="search"
          variant="outlined"
          size="small"
          className={classes.searchField}
          value={searchParam}
          onChange={(e) => setSearchParam(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon style={{ color: "gray" }} fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        {canCreate && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenModal}
            className={classes.toolbarButton}
          >
            Novo perfil
          </Button>
        )}
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell align="center" className={classes.headCell}>
              ID
            </TableCell>
            <TableCell className={classes.headCell}>Nome</TableCell>
            <TableCell className={classes.headCell}>Descrição</TableCell>
            <TableCell align="center" className={classes.headCell}>
              Permissões
            </TableCell>
            {canManage && (
              <TableCell align="center" className={classes.headCell}>
                Ações
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && <TableRowSkeleton columns={colSpan} />}
          {!loading && roles.length === 0 && (
            <TableRow>
              <TableCell colSpan={colSpan}>
                <Box className={classes.emptyState}>
                  <ShieldCheck size={44} style={{ opacity: 0.35 }} />
                  <Typography variant="subtitle1">
                    {searchParam
                      ? "Nenhum perfil encontrado para essa busca"
                      : "Nenhum perfil de acesso criado ainda"}
                  </Typography>
                  <Typography variant="body2">
                    Perfis concedem permissões adicionais a usuários, somando-se
                    ao que eles já têm.
                  </Typography>
                  {!searchParam && canCreate && (
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={handleSeedDefaults}
                      disabled={seeding}
                      startIcon={
                        seeding ? <CircularProgress size={16} /> : <AddIcon />
                      }
                    >
                      {seeding ? "Criando perfis..." : "Criar perfis padrão"}
                    </Button>
                  )}
                </Box>
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            roles.map((role) => (
              <TableRow key={role.id} className={classes.rowHover} hover={false}>
                <TableCell align="center" className={classes.bodyCell}>
                  {role.id}
                </TableCell>
                <TableCell className={classes.bodyCell}>{role.name}</TableCell>
                <TableCell className={classes.bodyCell}>
                  {role.description || "—"}
                </TableCell>
                <TableCell align="center" className={classes.bodyCell}>
                  <span
                    className={`${chipBaseClass} bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200`}
                  >
                    {(role.permissions || []).length} permissões
                  </span>
                </TableCell>
                {canManage && (
                  <TableCell align="center" className={classes.bodyCell}>
                    {canCreate && (
                      <Tooltip title="Duplicar">
                        <IconButton
                          size="small"
                          onClick={() => handleDuplicate(role)}
                        >
                          <FileCopyOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canEdit && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleEdit(role)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip title="Excluir">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setDeleting(role);
                            setConfirmOpen(true);
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </>
  );
};

export default RolesTab;
