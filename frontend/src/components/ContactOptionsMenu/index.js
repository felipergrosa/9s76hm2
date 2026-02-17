import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Menu,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  ListItemIcon,
  ListItemText,
  Divider
} from "@material-ui/core";
import {
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  GetApp as ExportIcon,
  FindInPage as FindIcon,
  MergeType as MergeIcon,
  Edit as EditIcon,
  Assessment as StatsIcon,
  PhoneAndroid as NormalizeIcon
} from "@material-ui/icons";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
  menuButton: {
    padding: 4,
  },
  menuItem: {
    minWidth: 200,
  },
  icon: {
    minWidth: 32,
  },
  warningText: {
    color: theme.palette.error.main,
    fontWeight: "bold",
  },
}));

const ContactOptionsMenu = ({ 
  contact, 
  onEditContact, 
  onExportChat, 
  onViewContactInfo,
  anchorEl,
  open,
  onClose 
}) => {
  const classes = useStyles();
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, title: "", text: "" });
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    onClose();
  };

  const handleViewInfo = () => {
    handleClose();
    if (onViewContactInfo) {
      onViewContactInfo(contact);
    }
  };

  const handleExportChat = () => {
    handleClose();
    if (onExportChat) {
      onExportChat(contact);
    }
  };

  const handleEditContact = () => {
    handleClose();
    if (onEditContact) {
      onEditContact(contact);
    }
  };

  const handleFindDuplicates = () => {
    setConfirmDialog({
      open: true,
      action: "findDuplicates",
      title: "Buscar Contatos Duplicados",
      text: `Deseja buscar contatos duplicados baseado no número ${contact.number}?`
    });
    handleClose();
  };

  const handleMergeContact = () => {
    setConfirmDialog({
      open: true,
      action: "mergeContact", 
      title: "Mesclar Contatos",
      text: "Esta ação irá buscar contatos similares para mesclagem. Continuar?"
    });
    handleClose();
  };

  const handleNormalizeNumber = () => {
    setConfirmDialog({
      open: true,
      action: "normalizeNumber",
      title: "Normalizar Número",
      text: `Deseja normalizar o número ${contact.number}? Isso pode alterar o formato do número.`
    });
    handleClose();
  };

  const handleViewStats = () => {
    handleClose();
    toast.info("Estatísticas de mensagens em desenvolvimento");
    // TODO: Implementar modal de estatísticas
  };

  const handleConfirmAction = async () => {
    setLoading(true);
    try {
      switch (confirmDialog.action) {
        case "findDuplicates":
          const duplicatesResponse = await api.get(`/contacts/duplicates`, {
            params: { number: contact.number }
          });
          if (duplicatesResponse.data.length > 0) {
            toast.success(`Encontrados ${duplicatesResponse.data.length} contatos duplicados`);
            // TODO: Abrir modal com lista de duplicados
          } else {
            toast.info("Nenhum contato duplicado encontrado");
          }
          break;

        case "mergeContact":
          // TODO: Implementar modal de mesclagem
          toast.info("Modal de mesclagem em desenvolvimento");
          break;

        case "normalizeNumber":
          const normalizeResponse = await api.post(`/contacts/${contact.id}/normalize-number`);
          if (normalizeResponse.data.success) {
            toast.success("Número normalizado com sucesso!");
            // Recarregar dados do contato
          } else {
            toast.warning("Número já estava normalizado");
          }
          break;
      }
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
      setConfirmDialog({ open: false, action: null, title: "", text: "" });
    }
  };

  const handleCancelAction = () => {
    setConfirmDialog({ open: false, action: null, title: "", text: "" });
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        getContentAnchorEl={null}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <MenuItem onClick={handleViewInfo} className={classes.menuItem}>
          <ListItemIcon className={classes.icon}>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Ver Informações do Contato" />
        </MenuItem>

        <MenuItem onClick={handleExportChat} className={classes.menuItem}>
          <ListItemIcon className={classes.icon}>
            <ExportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Exportar Conversa" />
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleFindDuplicates} className={classes.menuItem}>
          <ListItemIcon className={classes.icon}>
            <FindIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Buscar Duplicados" />
        </MenuItem>

        <MenuItem onClick={handleMergeContact} className={classes.menuItem}>
          <ListItemIcon className={classes.icon}>
            <MergeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Mesclar Contatos" />
        </MenuItem>

        <MenuItem onClick={handleNormalizeNumber} className={classes.menuItem}>
          <ListItemIcon className={classes.icon}>
            <NormalizeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Normalizar Número" />
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleViewStats} className={classes.menuItem}>
          <ListItemIcon className={classes.icon}>
            <StatsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Estatísticas de Mensagens" />
        </MenuItem>

        <MenuItem onClick={handleEditContact} className={classes.menuItem}>
          <ListItemIcon className={classes.icon}>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Editar Contato" />
        </MenuItem>
      </Menu>

      {/* Dialog de Confirmação */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleCancelAction}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.text}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelAction} color="secondary">
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmAction} 
            color="primary" 
            variant="contained"
            disabled={loading}
          >
            {loading ? "Processando..." : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ContactOptionsMenu;
