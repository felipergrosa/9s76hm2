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
import Typography from "@material-ui/core/Typography";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import RoleModal from "../../components/RoleModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD":
      return action.payload;
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

const Roles = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [roles, dispatch] = useReducer(reducer, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/roles", { params: { searchParam } });
      dispatch({ type: "LOAD", payload: data });
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam]);

  const handleOpenModal = () => {
    setSelectedId(null);
    setModalOpen(true);
  };

  const handleEdit = role => {
    setSelectedId(role.id);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    fetchRoles();
  };

  const handleDelete = async id => {
    try {
      await api.delete(`/roles/${id}`);
      dispatch({ type: "DELETE", payload: id });
      toast.success("Perfil de acesso excluído");
    } catch (err) {
      toastError(err);
    }
    setDeleting(null);
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={deleting && "Excluir perfil de acesso?"}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleDelete(deleting.id)}
      >
        Usuários que tiverem este perfil atribuído perdem as permissões concedidas por ele. Essa ação não pode ser desfeita.
      </ConfirmationModal>
      <RoleModal open={modalOpen} onClose={handleModalClose} roleId={selectedId} />
      <MainHeader>
        <Title>Perfis de Acesso (Roles) ({roles.length})</Title>
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
      <Typography variant="body2" color="textSecondary" style={{ margin: "0 8px 8px" }}>
        Perfis concedem permissões adicionais a usuários, somando-se ao que eles já têm (não substituem nada).
      </Typography>
      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">ID</TableCell>
              <TableCell align="left">Nome</TableCell>
              <TableCell align="left">Descrição</TableCell>
              <TableCell align="center">Permissões</TableCell>
              <TableCell align="center">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map(role => (
              <TableRow key={role.id}>
                <TableCell align="center">{role.id}</TableCell>
                <TableCell align="left">{role.name}</TableCell>
                <TableCell align="left">{role.description || "-"}</TableCell>
                <TableCell align="center">
                  <Chip size="small" label={`${(role.permissions || []).length} permissões`} />
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => handleEdit(role)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setDeleting(role);
                      setConfirmOpen(true);
                    }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={5} />}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Roles;
