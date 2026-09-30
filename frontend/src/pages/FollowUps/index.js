import React, { useState, useEffect, useReducer } from "react";
import { useHistory } from "react-router-dom";
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
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";

import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PeopleIcon from "@material-ui/icons/People";
import RepeatIcon from "@material-ui/icons/Repeat";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD":
      return action.payload;
    case "UPDATE":
      const record = action.payload;
      const index = state.findIndex(s => s.id === record.id);
      if (index !== -1) {
        state[index] = record;
        return [...state];
      }
      return [record, ...state];
    case "DELETE":
      return state.filter(r => r.id !== action.payload);
    default:
      return state;
  }
};

const useStyles = makeStyles(theme => ({
  mainPaper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
  },
  subtitle: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexWrap: "wrap",
  },
  searchField: {
    minWidth: 220,
    flex: "1 1 220px",
    maxWidth: 320,
  },
  filterSelect: {
    minWidth: 150,
  },
  headCell: {
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: "0.03em",
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    borderBottom: `1px solid ${theme.palette.divider}`,
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
  },
  bodyCell: {
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
  },
  recordName: {
    fontWeight: 500,
    fontSize: 14,
    lineHeight: 1.35,
  },
  recordSnippet: {
    color: theme.palette.text.secondary,
    fontSize: 12.5,
    lineHeight: 1.4,
    maxWidth: 360,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
  emptyIcon: {
    fontSize: 44,
    opacity: 0.35,
  },
}));

const chipBaseClass =
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

const STATUS_CHIP_CLASSES = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

const END_ACTION_LABELS = {
  none: "—",
  move_tag: "Mover de lane",
  ticket_status: "Mudar status",
  assign_queue: "Carteira → fila",
  assign_user: "Carteira → atendente",
};

const StatusChip = ({ active }) => (
  <span
    className={`${chipBaseClass} ${
      active ? STATUS_CHIP_CLASSES.active : STATUS_CHIP_CLASSES.inactive
    }`}
  >
    {active ? "Ativa" : "Inativa"}
  </span>
);

const TriggerChip = ({ tag }) => {
  if (!tag) return <>—</>;
  const isLane = Number(tag.kanban) === 1;
  return (
    <span className={`${chipBaseClass} bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200`}>
      {isLane ? `Lane: ${tag.name}` : `Tag: ${tag.name}`}
    </span>
  );
};

const FollowUps = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [records, dispatch] = useReducer(reducer, []);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("drip-sequences.create");
  const canEdit = hasPermission("drip-sequences.edit");
  const canDelete = hasPermission("drip-sequences.delete");

  useEffect(() => {
    setLoading(true);
    const fetch = async () => {
      try {
        const { data } = await api.get("/drip-sequences", { params: { searchParam } });
        dispatch({ type: "LOAD", payload: data.records });
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [searchParam]);

  const filteredRecords = records.filter(r => {
    if (statusFilter === "active" && !r.active) return false;
    if (statusFilter === "inactive" && r.active) return false;
    if (triggerFilter === "lane" && Number(r.tag?.kanban) !== 1) return false;
    if (triggerFilter === "tag" && Number(r.tag?.kanban) === 1) return false;
    return true;
  });

  const handleDelete = async id => {
    try {
      await api.delete(`/drip-sequences/${id}`);
      dispatch({ type: "DELETE", payload: id });
      toast.success("Follow-up excluído");
    } catch (err) {
      toastError(err);
    }
    setDeleting(null);
  };

  const handleShowEnrollments = async id => {
    try {
      const { data } = await api.get(`/drip-sequences/${id}/enrollments`);
      const active = data.filter(e => e.status === "active").length;
      const completed = data.filter(e => e.status === "completed").length;
      const failed = data.filter(e => e.status === "failed").length;
      toast.info(
        `Inscritos: ${data.length} | Ativos: ${active} | Concluídos: ${completed} | Falharam: ${failed}`,
        { autoClose: 8000 }
      );
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer useWindowScroll>
      <ConfirmationModal
        title={deleting && `Excluir follow-up "${deleting.name}"?`}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleDelete(deleting.id)}
      >
        Etapas e inscrições associadas também serão removidas. Essa ação não pode ser desfeita.
      </ConfirmationModal>

      <MainHeader>
        <Box>
          <Title>Follow-ups ({filteredRecords.length})</Title>
          <Typography variant="body2" className={classes.subtitle}>
            Sequências automáticas disparadas por tag ou lane do Kanban
          </Typography>
        </Box>
        <MainHeaderButtonsWrapper>
          {canCreate && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => history.push("/follow-ups/new")}
              startIcon={<AddIcon />}
            >
              Novo follow-up
            </Button>
          )}
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        {/* Barra de busca e filtros — mesmo padrão de /meta-templates */}
        <Box className={classes.toolbar}>
          <TextField
            placeholder="Buscar follow-up..."
            type="search"
            variant="outlined"
            size="small"
            className={classes.searchField}
            value={searchParam}
            onChange={e => setSearchParam(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ color: "gray" }} fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl variant="outlined" size="small" className={classes.filterSelect}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="active">Ativas</MenuItem>
              <MenuItem value="inactive">Inativas</MenuItem>
            </Select>
          </FormControl>
          <FormControl variant="outlined" size="small" className={classes.filterSelect}>
            <InputLabel>Gatilho</InputLabel>
            <Select
              value={triggerFilter}
              onChange={e => setTriggerFilter(e.target.value)}
              label="Gatilho"
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="lane">Lane do Kanban</MenuItem>
              <MenuItem value="tag">Tag de contato</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell className={classes.headCell}>Nome</TableCell>
              <TableCell className={classes.headCell}>Gatilho</TableCell>
              <TableCell className={classes.headCell}>Conexão</TableCell>
              <TableCell align="center" className={classes.headCell}>Ação final</TableCell>
              <TableCell align="center" className={classes.headCell}>Status</TableCell>
              <TableCell align="center" className={classes.headCell}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && <TableRowSkeleton columns={6} />}
            {!loading && filteredRecords.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Box className={classes.emptyState}>
                    <RepeatIcon className={classes.emptyIcon} />
                    <Typography variant="subtitle1">
                      {searchParam || statusFilter || triggerFilter
                        ? "Nenhum follow-up encontrado com esses filtros"
                        : "Nenhum follow-up criado ainda"}
                    </Typography>
                    <Typography variant="body2">
                      Crie uma sequência para engajar contatos que entram na lane automaticamente.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filteredRecords.map(record => (
                <TableRow key={record.id} className={classes.rowHover} hover={false}>
                  <TableCell className={classes.bodyCell}>
                    <Typography className={classes.recordName}>{record.name}</Typography>
                    <Typography className={classes.recordSnippet}>
                      {record.sendWindowStart && record.sendWindowEnd
                        ? `Janela ${record.sendWindowStart}–${record.sendWindowEnd}`
                        : "Envio em qualquer horário"}
                    </Typography>
                  </TableCell>
                  <TableCell className={classes.bodyCell}>
                    <TriggerChip tag={record.tag} />
                  </TableCell>
                  <TableCell className={classes.bodyCell}>
                    <Typography variant="body2">
                      {record.whatsapp?.name || "—"}
                    </Typography>
                    {record.whatsapp?.channelType === "official" && (
                      <Typography className={classes.recordSnippet}>API Oficial</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center" className={classes.bodyCell}>
                    <Typography variant="body2" color="textSecondary">
                      {END_ACTION_LABELS[record.endAction] || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" className={classes.bodyCell}>
                    <StatusChip active={record.active} />
                  </TableCell>
                  <TableCell align="center" className={classes.bodyCell}>
                    <Tooltip title="Ver inscritos">
                      <IconButton size="small" onClick={() => handleShowEnrollments(record.id)}>
                        <PeopleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canEdit && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => history.push(`/follow-ups/${record.id}`)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip title="Excluir">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setDeleting(record);
                            setConfirmOpen(true);
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default FollowUps;
