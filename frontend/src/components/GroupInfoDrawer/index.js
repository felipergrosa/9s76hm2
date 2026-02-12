import React, { useState, useEffect, useContext, useCallback } from "react";
import clsx from "clsx";
import {
  Drawer,
  makeStyles,
  Typography,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Menu,
  MenuItem,
  Tooltip,
} from "@material-ui/core";
import {
  Close as CloseIcon,
  PersonAdd as PersonAddIcon,
  ExitToApp as ExitToAppIcon,
  Link as LinkIcon,
  MoreVert as MoreVertIcon,
  Star as StarIcon,
  Group as GroupIcon,
  Edit as EditIcon,
  CameraAlt as CameraAltIcon,
  Check as CheckIcon,
  Settings as SettingsIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  VolumeOff as VolumeOffIcon,
  VolumeUp as VolumeUpIcon,
} from "@material-ui/icons";
import { Switch, FormControlLabel } from "@material-ui/core";
import SharedMediaPanel from "../SharedMediaPanel";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import StartPrivateChatModal from "../StartPrivateChatModal";
import { useHistory } from "react-router-dom";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
    '&$drawerClosed': {
      visibility: 'hidden',
      width: 0,
    },
  },
  drawerClosed: {},
  drawerPaper: {
    width: drawerWidth,
    display: "flex",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
    borderRight: "1px solid rgba(0, 0, 0, 0.12)",
    borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1, 2),
    backgroundColor: "#008069",
    color: "#fff",
    minHeight: 56,
  },
  headerTitle: {
    marginLeft: theme.spacing(2),
    fontWeight: 600,
    fontSize: 16,
  },
  profileSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: theme.spacing(3, 2),
    backgroundColor: "#fff",
  },
  groupAvatar: {
    width: 200,
    height: 200,
    marginBottom: theme.spacing(2),
    fontSize: 64,
    backgroundColor: "#00a884",
  },
  groupName: {
    fontSize: 22,
    fontWeight: 500,
    textAlign: "center",
    wordBreak: "break-word",
  },
  groupDescription: {
    fontSize: 14,
    color: "#667781",
    textAlign: "center",
    marginTop: theme.spacing(1),
    wordBreak: "break-word",
    maxHeight: 80,
    overflow: "auto",
  },
  groupMeta: {
    fontSize: 12,
    color: "#8696a0",
    marginTop: theme.spacing(0.5),
  },
  sectionTitle: {
    padding: theme.spacing(1.5, 2),
    fontSize: 14,
    fontWeight: 500,
    color: "#008069",
    backgroundColor: "#f0f2f5",
  },
  participantsList: {
    maxHeight: "calc(100vh - 500px)",
    overflow: "auto",
    padding: 0,
  },
  participantItem: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(6),
    "&:hover": {
      backgroundColor: "#f5f6f6",
    },
  },
  participantAvatar: {
    width: 40,
    height: 40,
    backgroundColor: "#dfe5e7",
  },
  participantName: {
    fontSize: 15,
    fontWeight: 400,
    color: "#111b21",
  },
  participantNumber: {
    fontSize: 13,
    color: "#667781",
  },
  adminChip: {
    height: 20,
    fontSize: 11,
    marginLeft: theme.spacing(1),
    backgroundColor: "#e7f8e9",
    color: "#008069",
    fontWeight: 500,
  },
  superAdminChip: {
    height: 20,
    fontSize: 11,
    marginLeft: theme.spacing(1),
    backgroundColor: "#fef3cd",
    color: "#856404",
    fontWeight: 500,
  },
  actionButtons: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    backgroundColor: "#fff",
  },
  actionButton: {
    justifyContent: "flex-start",
    textTransform: "none",
    fontSize: 14,
    padding: theme.spacing(1.5, 2),
    borderRadius: 8,
  },
  dangerButton: {
    color: "#e13f3f",
    "&:hover": {
      backgroundColor: "#fde8e8",
    },
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing(4),
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: theme.spacing(4),
    color: "#667781",
  },
}));

const GroupInfoDrawer = ({ open, handleDrawerClose, contact, ticket }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [groupInfo, setGroupInfo] = useState(null);
  const [error, setError] = useState(null);

  // Dialogs
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberNumber, setNewMemberNumber] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // Menu de contexto para participante
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // Handler para iniciar conversa privada
  const handleStartPrivateChat = (participant) => {
    setSelectedParticipantForChat(participant);
    setPrivateChatModalOpen(true);
  };

  // Callback quando o ticket privado é criado
  const handlePrivateChatCreated = (ticket) => {
    setPrivateChatModalOpen(false);
    setSelectedParticipantForChat(null);

    if (ticket) {
      // Navegar para o novo ticket
      history.push(`/tickets/${ticket.uuid}`);
      toast.success(`Conversa privada iniciada com ${selectedParticipantForChat.name}`);
    }
  };

  // Edição de nome do grupo
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Edição de descrição do grupo
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);

  // Upload de foto
  const fileInputRef = React.useRef(null);
  const [savingPicture, setSavingPicture] = useState(false);

  // Configurações do grupo
  const [savingSettings, setSavingSettings] = useState(false);

  // Modal de conversa privada
  const [privateChatModalOpen, setPrivateChatModalOpen] = useState(false);
  const [selectedParticipantForChat, setSelectedParticipantForChat] = useState(null);
  const history = useHistory();

  // Buscar dados do grupo quando abrir o drawer
  const fetchGroupInfo = useCallback(async () => {
    if (!contact?.id || !contact?.isGroup) return;

    setLoading(true);
    setError(null);

    try {
      const { data } = await api.get(`/groups/${contact.id}/participants`);
      setGroupInfo(data);
    } catch (err) {
      console.error("[GroupInfoDrawer] Erro ao buscar dados do grupo:", err);
      const errorMessage = err?.response?.data?.error || err?.message || "Erro ao carregar dados do grupo";

      // Tratamento específico para erros conhecidos
      if (errorMessage === "ERR_WAPP_NOT_INITIALIZED") {
        setError(i18n.t("backendErrors.ERR_WAPP_NOT_INITIALIZED"));
      } else if (errorMessage.includes("ERR_WAPP")) {
        setError(i18n.t("backendErrors.ERR_WAPP_CHECK_CONTACT"));
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [contact?.id, contact?.isGroup, api, setLoading, setError, setGroupInfo]);

  useEffect(() => {
    if (open && contact?.isGroup) {
      fetchGroupInfo();
    }
  }, [open, contact?.id, fetchGroupInfo]);

  // Ações de participantes
  const handleAddMember = async () => {
    if (!newMemberNumber.trim()) return;

    setAddingMember(true);
    try {
      await api.post(`/groups/${contact.id}/participants/add`, {
        numbers: [newMemberNumber.replace(/\D/g, "")],
      });
      toast.success("Participante adicionado com sucesso!");
      setAddMemberOpen(false);
      setNewMemberNumber("");
      fetchGroupInfo(); // Recarregar lista
    } catch (err) {
      toastError(err);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (participant) => {
    if (!window.confirm(`Remover ${participant.name} do grupo?`)) return;

    try {
      await api.post(`/groups/${contact.id}/participants/remove`, {
        numbers: [participant.number],
      });
      toast.success(`${participant.name} removido do grupo`);
      fetchGroupInfo();
    } catch (err) {
      toastError(err);
    }
    setMenuAnchor(null);
  };

  const handlePromoteMember = async (participant) => {
    try {
      await api.post(`/groups/${contact.id}/participants/promote`, {
        numbers: [participant.number],
      });
      toast.success(`${participant.name} promovido a admin`);
      fetchGroupInfo();
    } catch (err) {
      toastError(err);
    }
    setMenuAnchor(null);
  };

  const handleDemoteMember = async (participant) => {
    try {
      await api.post(`/groups/${contact.id}/participants/demote`, {
        numbers: [participant.number],
      });
      toast.success(`${participant.name} rebaixado de admin`);
      fetchGroupInfo();
    } catch (err) {
      toastError(err);
    }
    setMenuAnchor(null);
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm("Tem certeza que deseja sair do grupo?")) return;

    try {
      await api.post(`/groups/${contact.id}/leave`);
      toast.success("Você saiu do grupo");
      handleDrawerClose();
    } catch (err) {
      toastError(err);
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const { data } = await api.get(`/groups/${contact.id}/invite-link`);
      await navigator.clipboard.writeText(data.link);
      toast.success("Link de convite copiado!");
    } catch (err) {
      toastError(err);
    }
  };

  // Edição de nome do grupo
  const handleStartEditName = () => {
    setEditName(groupInfo?.subject || "");
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!editName.trim() || editName.trim() === groupInfo?.subject) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await api.put(`/groups/${contact.id}/subject`, { subject: editName.trim() });
      toast.success("Nome do grupo alterado!");
      setEditingName(false);
      fetchGroupInfo();
    } catch (err) {
      toastError(err);
    } finally {
      setSavingName(false);
    }
  };

  // Edição de descrição do grupo
  const handleStartEditDesc = () => {
    setEditDesc(groupInfo?.description || "");
    setEditingDesc(true);
  };

  const handleSaveDesc = async () => {
    setSavingDesc(true);
    try {
      await api.put(`/groups/${contact.id}/description`, { description: editDesc.trim() });
      toast.success("Descrição do grupo alterada!");
      setEditingDesc(false);
      fetchGroupInfo();
    } catch (err) {
      toastError(err);
    } finally {
      setSavingDesc(false);
    }
  };

  // Upload de foto do grupo
  const handlePictureChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    setSavingPicture(true);
    try {
      await api.put(`/groups/${contact.id}/picture`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Foto do grupo alterada!");
      fetchGroupInfo();
    } catch (err) {
      toastError(err);
    } finally {
      setSavingPicture(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Configurações do grupo
  const handleToggleAnnouncement = async () => {
    const currentlyAnnouncement = groupInfo?.announce === true;
    const newSetting = currentlyAnnouncement ? "not_announcement" : "announcement";

    setSavingSettings(true);
    try {
      await api.put(`/groups/${contact.id}/settings`, { setting: newSetting });
      toast.success(currentlyAnnouncement ? "Todos podem enviar mensagens" : "Apenas admins podem enviar mensagens");
      fetchGroupInfo();
    } catch (err) {
      toastError(err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleLocked = async () => {
    const currentlyLocked = groupInfo?.restrict === true;
    const newSetting = currentlyLocked ? "unlocked" : "locked";

    setSavingSettings(true);
    try {
      await api.put(`/groups/${contact.id}/settings`, { setting: newSetting });
      toast.success(currentlyLocked ? "Todos podem editar dados do grupo" : "Apenas admins podem editar dados do grupo");
      fetchGroupInfo();
    } catch (err) {
      toastError(err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleParticipantMenu = (event, participant) => {
    setMenuAnchor(event.currentTarget);
    setSelectedParticipant(participant);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
    setSelectedParticipant(null);
  };

  // Formatar data de criação
  const formatCreationDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatPhoneNumber = (number) => {
    if (!number) return "";
    const clean = ("" + number).replace(/\D/g, "");

    if (clean.length >= 10 && clean.startsWith("55")) {
      if (clean.length === 13) { // 55 11 91234 5678
        return `+${clean.substring(0, 2)} ${clean.substring(2, 4)} ${clean.substring(4, 9)}-${clean.substring(9)}`;
      }
      if (clean.length === 12) { // 55 11 1234 5678
        return `+${clean.substring(0, 2)} ${clean.substring(2, 4)} ${clean.substring(4, 8)}-${clean.substring(8)}`;
      }
    }
    return `+${clean}`;
  };

  return (
    <>
      <Drawer
        className={clsx(classes.drawer, !open && classes.drawerClosed)}
        variant="persistent"
        anchor="right"
        open={open}
        PaperProps={{ style: { position: "absolute" } }}
        BackdropProps={{ style: { position: "absolute" } }}
        ModalProps={{
          container: document.getElementById("drawer-container"),
          style: { position: "absolute" },
        }}
        classes={{
          paper: classes.drawerPaper,
        }}
      >
        {/* Cabeçalho */}
        <div className={classes.header}>
          <IconButton size="small" onClick={handleDrawerClose} style={{ color: "#fff" }}>
            <CloseIcon />
          </IconButton>
          <Typography className={classes.headerTitle}>Dados do grupo</Typography>
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div className={classes.loadingContainer}>
            <CircularProgress style={{ color: "#008069" }} />
          </div>
        ) : error ? (
          <div className={classes.errorContainer}>
            <GroupIcon style={{ fontSize: 48, marginBottom: 8, color: "#ccc" }} />
            <Typography variant="body2">{error}</Typography>
            <Button
              size="small"
              color="primary"
              onClick={fetchGroupInfo}
              style={{ marginTop: 8 }}
            >
              Tentar novamente
            </Button>
          </div>
        ) : groupInfo ? (
          <div style={{ overflow: "auto", flex: 1 }}>
            {/* Input oculto para upload de foto */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handlePictureChange}
            />

            {/* Seção do perfil do grupo */}
            <div className={classes.profileSection}>
              <div style={{ position: "relative", cursor: "pointer" }} onClick={() => fileInputRef.current?.click()}>
                <Avatar
                  src={groupInfo.profilePicUrl || contact?.urlPicture || ""}
                  className={classes.groupAvatar}
                >
                  <GroupIcon style={{ fontSize: 80 }} />
                </Avatar>
                <div style={{
                  position: "absolute", bottom: 8, right: 8,
                  backgroundColor: "#008069", borderRadius: "50%",
                  width: 40, height: 40, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                }}>
                  {savingPicture
                    ? <CircularProgress size={20} style={{ color: "#fff" }} />
                    : <CameraAltIcon style={{ color: "#fff", fontSize: 20 }} />
                  }
                </div>
              </div>

              {/* Nome do grupo - editável */}
              {editingName ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%", marginTop: 8 }}>
                  <TextField
                    autoFocus
                    fullWidth
                    size="small"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    inputProps={{ maxLength: 100 }}
                  />
                  <IconButton size="small" onClick={handleSaveName} disabled={savingName}>
                    {savingName ? <CircularProgress size={18} /> : <CheckIcon style={{ color: "#008069" }} />}
                  </IconButton>
                  <IconButton size="small" onClick={() => setEditingName(false)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }} onClick={handleStartEditName}>
                  <Typography className={classes.groupName}>
                    {groupInfo.subject || contact?.name || "Grupo"}
                  </Typography>
                  <EditIcon style={{ fontSize: 16, color: "#8696a0" }} />
                </div>
              )}

              {/* Descrição do grupo - editável */}
              {editingDesc ? (
                <div style={{ width: "100%", marginTop: 8 }}>
                  <TextField
                    autoFocus
                    fullWidth
                    multiline
                    rows={3}
                    size="small"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Descrição do grupo"
                    inputProps={{ maxLength: 512 }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginTop: 4 }}>
                    <Button size="small" onClick={() => setEditingDesc(false)}>Cancelar</Button>
                    <Button size="small" color="primary" onClick={handleSaveDesc} disabled={savingDesc}>
                      {savingDesc ? <CircularProgress size={16} /> : "Salvar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 4, cursor: "pointer", marginTop: 4 }} onClick={handleStartEditDesc}>
                  <Typography className={classes.groupDescription} style={{ color: groupInfo.description ? "#667781" : "#8696a0" }}>
                    {groupInfo.description || "Adicionar descrição do grupo"}
                  </Typography>
                  <EditIcon style={{ fontSize: 14, color: "#8696a0", marginTop: 2, flexShrink: 0 }} />
                </div>
              )}

              <Typography className={classes.groupMeta}>
                {groupInfo.size} membros
                {groupInfo.creation && ` · Criado em ${formatCreationDate(groupInfo.creation)}`}
              </Typography>
            </div>

            <Divider />

            {/* Configurações do grupo */}
            <Typography className={classes.sectionTitle}>
              <SettingsIcon style={{ fontSize: 16, marginRight: 6, verticalAlign: "text-bottom" }} />
              Configurações do grupo
            </Typography>
            <div style={{ padding: "8px 16px", backgroundColor: "#fff" }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={groupInfo.announce === true}
                    onChange={handleToggleAnnouncement}
                    disabled={savingSettings}
                    color="primary"
                    size="small"
                  />
                }
                label={
                  <span style={{ fontSize: 14 }}>
                    {groupInfo.announce ? <LockIcon style={{ fontSize: 14, marginRight: 4, verticalAlign: "text-bottom", color: "#008069" }} /> : <LockOpenIcon style={{ fontSize: 14, marginRight: 4, verticalAlign: "text-bottom" }} />}
                    Apenas admins enviam mensagens
                  </span>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={groupInfo.restrict === true}
                    onChange={handleToggleLocked}
                    disabled={savingSettings}
                    color="primary"
                    size="small"
                  />
                }
                label={
                  <span style={{ fontSize: 14 }}>
                    {groupInfo.restrict ? <LockIcon style={{ fontSize: 14, marginRight: 4, verticalAlign: "text-bottom", color: "#008069" }} /> : <LockOpenIcon style={{ fontSize: 14, marginRight: 4, verticalAlign: "text-bottom" }} />}
                    Apenas admins editam dados do grupo
                  </span>
                }
              />
            </div>

            <Divider />

            {/* Ações do grupo */}
            <div className={classes.actionButtons}>
              <Button
                className={classes.actionButton}
                startIcon={<PersonAddIcon style={{ color: "#008069" }} />}
                onClick={() => setAddMemberOpen(true)}
              >
                Adicionar membro
              </Button>
              <Button
                className={classes.actionButton}
                startIcon={<LinkIcon style={{ color: "#008069" }} />}
                onClick={handleCopyInviteLink}
              >
                Convidar via link
              </Button>
            </div>

            <Divider />

            {/* Lista de participantes */}
            <Typography className={classes.sectionTitle}>
              {groupInfo.size} participantes
            </Typography>

            <List className={classes.participantsList} dense>
              {groupInfo.participants.map((participant) => (
                <ListItem
                  key={participant.id}
                  className={classes.participantItem}
                  button
                  onClick={() => handleStartPrivateChat(participant)}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={participant.profilePicUrl || participant.imgUrlBaileys || ""}
                      className={classes.participantAvatar}
                    >
                      {(participant.name || "?")[0]?.toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <span style={{ display: "flex", alignItems: "center" }}>
                        <span className={classes.participantName}>
                          {participant.name !== "Participante" && participant.name !== participant.number
                            ? participant.name
                            : formatPhoneNumber(participant.number)}
                        </span>
                        {participant.isSuperAdmin && (
                          <Chip
                            size="small"
                            icon={<StarIcon style={{ fontSize: 12, color: "#856404" }} />}
                            label="Criador"
                            className={classes.superAdminChip}
                          />
                        )}
                        {participant.isAdmin && !participant.isSuperAdmin && (
                          <Chip
                            size="small"
                            label="Admin do grupo"
                            className={classes.adminChip}
                          />
                        )}
                      </span>
                    }
                    secondary={
                      participant.name !== "Participante" && participant.name !== participant.number ? (
                        <span className={classes.participantNumber}>
                          {formatPhoneNumber(participant.number)}
                        </span>
                      ) : null
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => handleParticipantMenu(e, participant)}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            <Divider />

            {/* Mídia compartilhada */}
            <Typography className={classes.sectionTitle}>
              Mídia, links e docs
            </Typography>
            <div style={{ height: 320, backgroundColor: "#fff" }}>
              <SharedMediaPanel ticketId={ticket?.id} />
            </div>

            <Divider />

            {/* Sair do grupo */}
            <div className={classes.actionButtons}>
              <Button
                className={`${classes.actionButton} ${classes.dangerButton}`}
                startIcon={<ExitToAppIcon />}
                onClick={handleLeaveGroup}
              >
                Sair do grupo
              </Button>
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Menu de contexto do participante */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleCloseMenu}
      >
        {selectedParticipant && !selectedParticipant.isSuperAdmin && (
          selectedParticipant.isAdmin ? (
            <MenuItem onClick={() => handleDemoteMember(selectedParticipant)}>
              Rebaixar de admin
            </MenuItem>
          ) : (
            <MenuItem onClick={() => handlePromoteMember(selectedParticipant)}>
              Promover a admin
            </MenuItem>
          )
        )}
        {selectedParticipant && !selectedParticipant.isSuperAdmin && (
          <MenuItem
            onClick={() => handleRemoveMember(selectedParticipant)}
            style={{ color: "#e13f3f" }}
          >
            Remover do grupo
          </MenuItem>
        )}
        {selectedParticipant?.isSuperAdmin && (
          <MenuItem disabled>
            Criador do grupo
          </MenuItem>
        )}
      </Menu>

      {/* Dialog para adicionar membro */}
      <Dialog
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Adicionar membro</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Número do WhatsApp"
            placeholder="Ex: 5511999999999"
            fullWidth
            value={newMemberNumber}
            onChange={(e) => setNewMemberNumber(e.target.value)}
            helperText="Digite o número completo com DDD e código do país"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberOpen(false)} color="default">
            Cancelar
          </Button>
          <Button
            onClick={handleAddMember}
            color="primary"
            disabled={addingMember || !newMemberNumber.trim()}
          >
            {addingMember ? <CircularProgress size={20} /> : "Adicionar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para iniciar conversa privada */}
      <StartPrivateChatModal
        open={privateChatModalOpen}
        onClose={handlePrivateChatCreated}
        participant={selectedParticipantForChat}
        companyId={contact?.companyId}
        whatsappId={ticket?.whatsappId}
        user={user}
      />
    </>
  );
};

export default GroupInfoDrawer;
