import React, { useState, useEffect, useRef } from "react";

import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack
} from "@mui/material";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexWrap: "wrap"
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1
  },

  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },

  btnWrapper: {
    position: "relative"
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12
  }
}));

const selectFieldStyles = {
  ".MuiOutlinedInput-notchedOutline": {
    borderColor: "#909090"
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#000000",
    borderWidth: "thin"
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#0000FF",
    borderWidth: "thin"
  }
};

const FlowBuilderAssignUserModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState([]);

  const [labels, setLabels] = useState({
    title: "Adicionar atribuição de atendente ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // /users pode retornar array direto ou objeto paginado { users }
        const { data } = await api.get("/users");
        const list = Array.isArray(data)
          ? data
          : (data && Array.isArray(data.users) ? data.users : []);
        setUsers(list);
      } catch (err) {
        toastError(err);
      }
    };

    if (open === "edit") {
      setLabels({
        title: "Editar atribuição de atendente",
        btn: "Salvar"
      });
      setUserId(data.data.userId || "");
      fetchUsers();
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar atribuição de atendente ao fluxo",
        btn: "Adicionar"
      });
      setUserId("");
      fetchUsers();
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSaveContact = async () => {
    if (!userId) {
      return toast.error("Selecione um atendente");
    }
    // Guarda o nome do atendente para exibição no nó sem nova consulta
    const selectedUser = users.find(user => user.id === userId);
    const payload = {
      userId,
      userName: selectedUser ? selectedUser.name : ""
    };
    if (open === "edit") {
      handleClose();
      onUpdate({
        ...data,
        data: { ...payload }
      });
      return;
    } else if (open === "create") {
      handleClose();
      onSave(payload);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={activeModal}
        onClose={handleClose}
        fullWidth="md"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">{labels.title}</DialogTitle>
        <Stack>
          <DialogContent dividers>
            <Stack style={{ gap: "16px" }}>
              <FormControl sx={{ width: "95%" }} size="medium">
                <InputLabel sx={selectFieldStyles} id="assign-user-select-label">
                  Atendente
                </InputLabel>
                <Select
                  labelId="assign-user-select-label"
                  id="assign-user-select"
                  value={userId}
                  label="Atendente"
                  onChange={e => setUserId(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  {users.map(user => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} color="secondary" variant="outlined">
              {i18n.t("contactModal.buttons.cancel")}
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              className={classes.btnWrapper}
              onClick={() => handleSaveContact()}
            >
              {`${labels.btn}`}
            </Button>
          </DialogActions>
        </Stack>
      </Dialog>
    </div>
  );
};

export default FlowBuilderAssignUserModal;
