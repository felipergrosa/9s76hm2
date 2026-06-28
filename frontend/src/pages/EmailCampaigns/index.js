import React, { useState, useEffect, useReducer, useContext } from "react";
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
import SendIcon from "@material-ui/icons/Send";
import CancelIcon from "@material-ui/icons/Cancel";
import AssessmentIcon from "@material-ui/icons/Assessment";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import EmailCampaignModal from "../../components/EmailCampaignModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

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

const STATUS_LABEL = {
  INATIVA: "Inativa",
  PROGRAMADA: "Programada",
  EM_ANDAMENTO: "Em andamento",
  CANCELADA: "Cancelada",
  FINALIZADA: "Finalizada"
};

const STATUS_COLOR = {
  INATIVA: "default",
  PROGRAMADA: "primary",
  EM_ANDAMENTO: "secondary",
  CANCELADA: "default",
  FINALIZADA: "primary"
};

const useStyles = makeStyles(theme => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
  },
}));

const EmailCampaigns = () => {
  const classes = useStyles();
  const { socket, user } = useContext(AuthContext);

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
        const { data } = await api.get("/email-campaigns", { params: { searchParam } });
        dispatch({ type: "LOAD", payload: data.records });
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [searchParam]);

  useEffect(() => {
    const onEvent = data => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE", payload: data.record });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE", payload: +data.id });
      }
    };
    socket.on(`company-${user.companyId}-email-campaign`, onEvent);
    return () => socket.off(`company-${user.companyId}-email-campaign`, onEvent);
  }, [socket, user.companyId]);

  const handleOpenModal = () => {
    setSelectedId(null);
    setModalOpen(true);
  };

  const handleEdit = record => {
    setSelectedId(record.id);
    setModalOpen(true);
  };

  const handleDelete = async id => {
    try {
      await api.delete(`/email-campaigns/${id}`);
      toast.success("Campanha excluída");
    } catch (err) {
      toastError(err);
    }
    setDeleting(null);
  };

  const handleSendNow = async id => {
    try {
      await api.post(`/email-campaigns/${id}/send-now`);
      toast.success("Campanha enviada para a fila de disparo");
    } catch (err) {
      toastError(err);
    }
  };

  const handleCancel = async id => {
    try {
      await api.post(`/email-campaigns/${id}/cancel`);
      toast.success("Campanha cancelada");
    } catch (err) {
      toastError(err);
    }
  };

  const handleShowReport = async id => {
    try {
      const { data } = await api.get(`/email-campaigns/${id}/report`);
      toast.info(
        `Total: ${data.total} | Pendentes: ${data.pending} | Em processamento: ${data.processing} | Entregues: ${data.delivered} | Falharam: ${data.failed}`,
        { autoClose: 8000 }
      );
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={deleting && "Excluir campanha de e-mail?"}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleDelete(deleting.id)}
      >
        Essa ação não pode ser desfeita.
      </ConfirmationModal>
      <EmailCampaignModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        emailCampaignId={selectedId}
      />
      <MainHeader>
        <Title>Campanhas de E-mail ({records.length})</Title>
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
              <TableCell align="left">Assunto</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map(record => (
              <TableRow key={record.id}>
                <TableCell align="center">{record.id}</TableCell>
                <TableCell align="left">{record.name}</TableCell>
                <TableCell align="left">{record.subject}</TableCell>
                <TableCell align="center">
                  <Chip
                    size="small"
                    label={STATUS_LABEL[record.status] || record.status}
                    color={STATUS_COLOR[record.status] || "default"}
                  />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Ver relatório">
                    <IconButton size="small" onClick={() => handleShowReport(record.id)}>
                      <AssessmentIcon />
                    </IconButton>
                  </Tooltip>
                  {["INATIVA", "PROGRAMADA"].includes(record.status) && (
                    <Tooltip title="Enviar agora">
                      <IconButton size="small" onClick={() => handleSendNow(record.id)}>
                        <SendIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {["PROGRAMADA", "EM_ANDAMENTO"].includes(record.status) && (
                    <Tooltip title="Cancelar">
                      <IconButton size="small" onClick={() => handleCancel(record.id)}>
                        <CancelIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <IconButton size="small" onClick={() => handleEdit(record)} disabled={record.status === "EM_ANDAMENTO"}>
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setDeleting(record);
                      setConfirmOpen(true);
                    }}
                    disabled={record.status === "EM_ANDAMENTO"}
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

export default EmailCampaigns;
