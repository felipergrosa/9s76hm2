import React, { useState, useEffect, useReducer } from "react";
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
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PeopleIcon from "@material-ui/icons/People";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import DripSequenceModal from "../../components/DripSequenceModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";

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
    padding: theme.spacing(1),
  },
}));

const DripSequences = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [records, dispatch] = useReducer(reducer, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const handleOpenModal = () => {
    setSelectedId(null);
    setModalOpen(true);
  };

  const handleEdit = record => {
    setSelectedId(record.id);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    // Recarrega a lista após salvar (não há evento de socket dedicado para este recurso)
    setSearchParam(prev => prev);
    api.get("/drip-sequences", { params: { searchParam } })
      .then(({ data }) => dispatch({ type: "LOAD", payload: data.records }))
      .catch(() => {});
  };

  const handleDelete = async id => {
    try {
      await api.delete(`/drip-sequences/${id}`);
      dispatch({ type: "DELETE", payload: id });
      toast.success("Sequência excluída");
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
      toast.info(`Inscritos: ${data.length} | Ativos: ${active} | Concluídos: ${completed} | Falharam: ${failed}`, { autoClose: 8000 });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={deleting && "Excluir sequência de drip?"}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleDelete(deleting.id)}
      >
        Etapas e inscrições associadas também serão removidas. Essa ação não pode ser desfeita.
      </ConfirmationModal>
      <DripSequenceModal
        open={modalOpen}
        onClose={handleModalClose}
        dripSequenceId={selectedId}
      />
      <MainHeader>
        <Title>Sequências de Drip ({records.length})</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder="Buscar..."
            type="search"
            value={searchParam}
            onChange={e => setSearchParam(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ color: "gray" }} />
                </InputAdornment>
              ),
            }}
          />
          <Button variant="contained" color="primary" onClick={handleOpenModal}>
            Adicionar
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">ID</TableCell>
              <TableCell align="left">Nome</TableCell>
              <TableCell align="left">Tag</TableCell>
              <TableCell align="left">Conexão</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map(record => (
              <TableRow key={record.id}>
                <TableCell align="center">{record.id}</TableCell>
                <TableCell align="left">{record.name}</TableCell>
                <TableCell align="left">
                  {record.tag && (
                    <Chip
                      size="small"
                      label={record.tag.name}
                      style={{ backgroundColor: record.tag.color, color: "white" }}
                    />
                  )}
                </TableCell>
                <TableCell align="left">{record.whatsapp?.name || "-"}</TableCell>
                <TableCell align="center">
                  <Chip size="small" label={record.active ? "Ativa" : "Inativa"} color={record.active ? "primary" : "default"} />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Ver inscritos">
                    <IconButton size="small" onClick={() => handleShowEnrollments(record.id)}>
                      <PeopleIcon />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" onClick={() => handleEdit(record)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setDeleting(record);
                      setConfirmOpen(true);
                    }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={6} />}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default DripSequences;
