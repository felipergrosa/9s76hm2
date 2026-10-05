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

const FlowBuilderTagModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [action, setAction] = useState("add");
  const [tagId, setTagId] = useState("");
  const [tags, setTags] = useState([]);

  const [labels, setLabels] = useState({
    title: "Adicionar tag ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    const fetchTags = async () => {
      try {
        // /tags pode retornar array direto ou objeto paginado { tags }
        const { data } = await api.get("/tags");
        const list = Array.isArray(data)
          ? data
          : (data && Array.isArray(data.tags) ? data.tags : []);
        setTags(list);
      } catch (err) {
        toastError(err);
      }
    };

    if (open === "edit") {
      setLabels({
        title: "Editar tag",
        btn: "Salvar"
      });
      setAction(data.data.action || "add");
      setTagId(data.data.tagId || "");
      fetchTags();
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar tag ao fluxo",
        btn: "Adicionar"
      });
      setAction("add");
      setTagId("");
      fetchTags();
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
    if (!tagId) {
      return toast.error("Selecione uma tag");
    }
    // Guarda o nome da tag para exibição no nó sem nova consulta
    const selectedTag = tags.find(tag => tag.id === tagId);
    const payload = {
      tagId,
      tagName: selectedTag ? selectedTag.name : "",
      action
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
                <InputLabel sx={selectFieldStyles} id="tag-action-select-label">
                  Ação
                </InputLabel>
                <Select
                  labelId="tag-action-select-label"
                  id="tag-action-select"
                  value={action}
                  label="Ação"
                  onChange={e => setAction(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  <MenuItem value="add">Adicionar</MenuItem>
                  <MenuItem value="remove">Remover</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ width: "95%" }} size="medium">
                <InputLabel sx={selectFieldStyles} id="tag-select-label">
                  Tag
                </InputLabel>
                <Select
                  labelId="tag-select-label"
                  id="tag-select"
                  value={tagId}
                  label="Tag"
                  onChange={e => setTagId(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  {tags.map(tag => (
                    <MenuItem key={tag.id} value={tag.id}>
                      {tag.name}
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

export default FlowBuilderTagModal;
