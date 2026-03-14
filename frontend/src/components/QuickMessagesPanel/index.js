import React, { useState, useEffect, useContext, useMemo } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import {
  Paper,
  InputBase,
  IconButton,
  Typography,
  Collapse,
  Button,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  Box
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import FilterListIcon from "@material-ui/icons/FilterList";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import EditIcon from "@material-ui/icons/Edit";
import FileCopyIcon from "@material-ui/icons/FileCopy";
import SendIcon from "@material-ui/icons/Send";
import VisibilityIcon from "@material-ui/icons/Visibility";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import ControlPointDuplicateIcon from "@material-ui/icons/ControlPointDuplicate";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import TextFieldsIcon from "@material-ui/icons/TextFields";
import SchemaIcon from "@material-ui/icons/AccountTree"; 
import AddIcon from "@material-ui/icons/Add";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import ConfirmationModal from "../ConfirmationModal";
import QuickMessageDialog from "../QuickMessageDialog";
import { expandPlaceholders } from "../../utils/expandPlaceholders";
import Avatar from "@material-ui/core/Avatar";
import { getBackendUrl } from "../../config";

const hexToAlpha = (hex, alpha) => {
  if (!hex || typeof hex !== "string" || !hex.startsWith('#')) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: theme.palette.background.default,
  },
  searchPaper: {
    padding: "2px 4px",
    display: "flex",
    alignItems: "center",
    margin: (props) => props.showHeader ? "0 8px 8px 8px" : "8px",
    borderRadius: "8px",
  },
  searchInput: {
    marginLeft: theme.spacing(1),
    flex: 1,
    fontSize: "14px",
  },
  filterIcon: {
    padding: "8px",
    color: theme.palette.text.secondary,
  },
  addButton: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.background.paper,
    padding: '3px',
    borderRadius: '20px',
    marginLeft: '4px',
    transition: 'all 0.2s ease-in-out',
    "&:hover": {
      backgroundColor: theme.palette.primary.main,
      color: "#fff",
      transform: 'scale(1.1)',
    },
    "& svg": {
      fontSize: '22px',
    },
  },
  filtersContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    padding: "0 8px 8px 8px",
  },
  filterChip: {
    fontSize: "11px",
    height: "24px",
  },
  listContainer: {
    flex: 1,
    overflowY: "auto",
    ...theme.scrollbarStyles,
    padding: "0 8px 8px 8px",
  },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 8px",
    cursor: "pointer",
    borderRadius: "4px",
    marginBottom: "4px",
    transition: "background-color 0.2s",
    borderLeft: "4px solid", // Cor dinâmica aplicada dinamicamente
    backgroundColor: theme.mode === 'light' ? "#f5f5f5" : "#2c2c2c",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  groupTitleArea: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  groupTitle: {
    fontSize: "12px",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  messageItem: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "4px",
    borderRadius: "4px",
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    transition: "background-color 0.2s",
  },
  messageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 8px",
  },
  messageTitleArea: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flex: 1,
    overflow: "hidden",
  },
  messageShortcode: {
    fontSize: "13px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  actionsArea: {
    display: "flex",
    alignItems: "center",
  },
  actionIcon: {
    padding: "4px",
    "& svg": {
      fontSize: "16px",
    },
  },
  previewArea: {
    padding: "8px",
    backgroundColor: theme.mode === 'light' ? "#f9f9f9" : "#1e1e1e",
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottomLeftRadius: "4px",
    borderBottomRightRadius: "4px",
  },
  previewText: {
    fontSize: "13px",
    marginBottom: "8px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  sendButton: {
    width: "100%",
    textTransform: "none",
    fontSize: "13px",
    padding: "4px 8px",
    backgroundColor: "#25D366",
    color: "#fff",
    "&:hover": {
      backgroundColor: "#1da851",
    },
  },
  emptyMessage: {
    textAlign: "center",
    padding: "20px",
    color: theme.palette.text.secondary,
    fontSize: "14px",
  }
}));

const MessageItem = ({ 
  msg, index, classes, expanded, onToggle, onSend, onCopy, 
  onEdit, onClone, canEdit, onSendMessage, setDeletingMessage, 
  setConfirmModalOpen, contact, ticket, user 
}) => {
  const itemColor = msg.color || "#6B7280";
  const bgColor = hexToAlpha(itemColor, 0.08);
  const borderColor = hexToAlpha(itemColor, 0.2);

  return (
    <div className={classes.messageItem} style={{ backgroundColor: bgColor, borderColor: borderColor }}>
      <div className={classes.messageHeader}>
        <div className={classes.messageTitleArea}>
          <Tooltip title={msg.shortcode}>
            <Typography className={classes.messageShortcode}>
              {msg.shortcode}
            </Typography>
          </Tooltip>
          {msg.flow && (() => {
            try {
              const flow = JSON.parse(msg.flow);
              return flow.length > 1 ? (
                <Tooltip title="Fluxo de mensagens">
                   <SchemaIcon style={{ fontSize: 16, color: '#3B82F6' }} />
                </Tooltip>
              ) : (
                <Tooltip title="Mensagem simples">
                   <TextFieldsIcon style={{ fontSize: 16, color: '#888' }} />
                </Tooltip>
              );
            } catch (e) { return null; }
          })()}
          {(msg.mediaPath || (msg.flow && msg.flow.includes('"type":"media"'))) && (
            <Tooltip title="Possui anexos">
              <AttachFileIcon style={{ fontSize: 14, color: '#10B981', transform: 'rotate(45deg)' }} />
            </Tooltip>
          )}
        </div>
        <div className={classes.actionsArea}>
          {canEdit && (
            <>
              <Tooltip title="Editar">
                <IconButton className={classes.actionIcon} onClick={onEdit}>
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Excluir">
                <IconButton 
                  className={classes.actionIcon} 
                  onClick={() => {
                    setDeletingMessage(msg);
                    setConfirmModalOpen(true);
                  }}
                >
                  <DeleteOutlineIcon style={{ color: '#d33' }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="Clonar">
            <IconButton className={classes.actionIcon} onClick={onClone}>
              <ControlPointDuplicateIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Copiar">
            <IconButton className={classes.actionIcon} onClick={onCopy}>
              <FileCopyIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Visualizar">
            <IconButton className={classes.actionIcon} onClick={onToggle}>
              <VisibilityIcon color={expanded ? "primary" : "inherit"} />
            </IconButton>
          </Tooltip>
          {onSendMessage && (
            <Tooltip title="Enviar">
              <IconButton className={classes.actionIcon} onClick={onSend} style={{ backgroundColor: 'rgba(37, 211, 102, 0.1)' }}>
                <SendIcon style={{ color: '#25D366' }} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>
      
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <div className={classes.previewArea}>
          <Typography className={classes.previewText}>
            {expandPlaceholders(msg.message, contact, ticket, user)}
          </Typography>
          {(() => {
            let mediaCount = 0;
            let hasDelay = false;
            try {
              if (msg.flow) {
                const flow = JSON.parse(msg.flow);
                mediaCount = flow.filter(i => i.type === 'media').length;
                hasDelay = flow.some(i => i.type === 'delay');
              } else if (msg.mediaPath) {
                const p = JSON.parse(msg.mediaPath);
                mediaCount = Array.isArray(p) ? p.length : 1;
              }
            } catch (e) { }
            
            return (
              <Box mt={1} mb={1}>
                {mediaCount > 0 && (
                  <Typography variant="caption" color="textSecondary" style={{display: 'block'}}>
                    📎 {mediaCount} arquivo(s) anexo(s)
                  </Typography>
                )}
                {hasDelay && (
                  <Typography variant="caption" color="textSecondary" style={{display: 'block'}}>
                    ⏳ Contém intervalos (delays)
                  </Typography>
                )}
              </Box>
            );
          })()}
          {onSendMessage && (
            <Button 
              className={classes.sendButton}
              variant="contained"
              disableElevation
              endIcon={<SendIcon fontSize="small"/>}
              onClick={onSend}
            >
              Enviar
            </Button>
          )}
        </div>
      </Collapse>
    </div>
  );
};

const ITEMS_PER_PAGE = 200;

const QuickMessagesPanel = ({ onSendMessage, onEditMessage, showHeader = false, contact, ticket }) => {
  const classes = useStyles({ showHeader });
  const theme = useTheme();
  const [messages, setMessages] = useState([]);
  const [searchParam, setSearchParam] = useState("");
  const [activeFilter, setActiveFilter] = useState("Categoria"); // Tudo, Tipo, Sem Categoria, Categoria, Mais Usadas
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedPreview, setExpandedPreview] = useState({});
  const [quickMessageModalOpen, setQuickMessageModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { user } = useContext(AuthContext);

  const handleOpenFilterMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseFilterMenu = () => {
    setAnchorEl(null);
  };

  const handleFilterClick = (filter) => {
    setActiveFilter(filter);
    handleCloseFilterMenu();
  };

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, activeFilter]);

  const fetchMessages = async () => {
    try {
      const params = {
        searchParam,
        pageNumber: 1,
        // ListService usa 200 por padrão agora no limite
      };

      if (activeFilter === "Mais Usadas") {
        params.sortBy = "useCount";
      }

      const { data } = await api.get("/quick-messages", { params });
      
      let filteredRecords = data.records || [];

      // Filtro local adicional baseado no tipo
      if (activeFilter === "Sem Categoria") {
        filteredRecords = filteredRecords.filter(m => !m.groupName);
      } else if (activeFilter === "Tipo") {
        // Filtro por tipo de mídia se tivesse "isMedia" implementado como categoria, mas vamos apenas deixar Tudo para fallback aqui já que não temos um dropdowm real ainda
      }

      setMessages(filteredRecords);
    } catch (err) {
      toastError(err);
    }
  };

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const togglePreview = (msgId) => {
    setExpandedPreview(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const handleSend = async (message) => {
    try {
      // Incrementa uso em background
      api.post(`/quick-messages/${message.id}/increment-use`).catch(() => {});
      
      if (onSendMessage) {
        onSendMessage(message);
      }
    } catch (err) {
      toastError(err);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  const handleEdit = (message) => {
    setSelectedMessage(message);
    setQuickMessageModalOpen(true);
  };

  const handleClone = (message) => {
    const { id, userId, user, createdAt, updatedAt, useCount, ...cloneData } = message;
    setSelectedMessage(null); // ID deve ser nulo para criar novo
    setQuickMessageModalOpen(true);
    // Vamos usar um estado temporário para os dados da clonagem
    setCloneInitialData(cloneData);
  };

  const handleDelete = async (messageId) => {
    try {
      await api.delete(`/quick-messages/${messageId}`);
      toast.success(i18n.t("quickemessages.toasts.deleted"));
      fetchMessages();
    } catch (err) {
      toastError(err);
    }
    setDeletingMessage(null);
  };

  const [cloneInitialData, setCloneInitialData] = useState(null);

  const canEdit = (message) => {
    const isAdmin = user.profile === "admin" || user.super === true;
    return isAdmin || message.userId === user.id;
  };

  // Funções de Agrupamento
  const grouped = useMemo(() => {
    if (activeFilter === "Tudo" || activeFilter === "Mais Usadas" || activeFilter === "Sem Categoria") {
      return { "GERAL": messages }; // Array plano sob um grupo pai artificial
    }

    if (activeFilter === "Categoria") {
      const usersMap = {};
      messages.forEach(msg => {
        const userName = msg.user?.name || "SISTEMA";
        const userColor = msg.user?.color || msg.color || "#6B7280";
        const userProfileImage = msg.user?.profileImage;
        const groupName = msg.groupName || "SEM CATEGORIA";
        
        if (!usersMap[userName]) {
          usersMap[userName] = {
            color: userColor,
            profileImage: userProfileImage,
            groups: {}
          };
        }
        
        if (!usersMap[userName].groups[groupName]) {
          usersMap[userName].groups[groupName] = [];
        }
        
        if (usersMap[userName].groups[groupName]) {
           usersMap[userName].groups[groupName].push(msg);
        }
      });
      return usersMap;
    }

    // "Tipo" fallback (divide entre mídia e texto se quiser)
    if (activeFilter === "Tipo") {
      const groups = {
        "TEXTO": { color: "#3B82F6", groups: { "TEXTO": [] } },
        "MÍDIA": { color: "#10B981", groups: { "MÍDIA": [] } }
      };
      messages.forEach(msg => {
        if (msg.mediaPath) groups["MÍDIA"].groups["MÍDIA"].push(msg);
        else groups["TEXTO"].groups["TEXTO"].push(msg);
      });
      return groups;
    }

    return { "GERAL": messages };
  }, [messages, activeFilter]);

  const isFlatList = activeFilter === "Tudo" || activeFilter === "Mais Usadas" || activeFilter === "Sem Categoria";

  const handleOpenQuickMessageDialog = () => {
    setSelectedMessage(null);
    setQuickMessageModalOpen(true);
  };

  return (
    <div className={classes.root}>
      <Paper component="form" className={classes.searchPaper} elevation={0} variant="outlined">
        <IconButton type="button" style={{ padding: '10px' }} aria-label="search" size="small">
          <SearchIcon fontSize="small" />
        </IconButton>
        <InputBase
          className={classes.searchInput}
          placeholder="Pesquisar resposta rápida"
          value={searchParam}
          onChange={(e) => setSearchParam(e.target.value)}
        />
        <Divider orientation="vertical" style={{ margin: '4px 8px', height: '24px' }} />
        <Box display="flex" alignItems="center" gap="4px">
          <Tooltip title="Filtrar">
            <IconButton 
              className={classes.filterIcon} 
              onClick={handleOpenFilterMenu}
              size="small"
            >
              <FilterListIcon fontSize="small" color={activeFilter !== "Tudo" ? "primary" : "inherit"} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Adicionar Mensagem">
            <IconButton 
              className={classes.addButton}
              onClick={handleOpenQuickMessageDialog}
              size="small"
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseFilterMenu}
        keepMounted
      >
        {["Tudo", "Tipo", "Sem Categoria", "Categoria", "Mais Usadas"].map((f) => (
          <MenuItem 
            key={f} 
            onClick={() => handleFilterClick(f)}
            selected={activeFilter === f}
          >
            {f}
          </MenuItem>
        ))}
      </Menu>

      <div className={classes.listContainer}>
        {messages.length === 0 ? (
          <Typography className={classes.emptyMessage}>
            Nenhuma mensagem encontrada.
          </Typography>
        ) : isFlatList ? (
          // Renderiza lista plana ordenada
          grouped["GERAL"]?.sort((a,b) => a.shortcode.localeCompare(b.shortcode)).map((msg, index) => (
            <MessageItem 
              key={msg.id} 
              msg={msg} 
              index={index}
              classes={classes} 
              expanded={expandedPreview[msg.id]} 
              onToggle={() => togglePreview(msg.id)}
              onSend={() => handleSend(msg)}
              onCopy={() => handleCopy(msg.message)}
              onEdit={() => handleEdit(msg)}
              canEdit={canEdit(msg)}
              onSendMessage={onSendMessage}
              setDeletingMessage={setDeletingMessage}
              setConfirmModalOpen={setConfirmModalOpen}
              contact={contact}
              ticket={ticket}
              user={user}
            />
          ))
        ) : (
          // Renderiza hierarquia de 3 níveis: Usuário -> Categoria -> Mensagem
          Object.keys(grouped || {}).sort().map(userName => {
            const userGroup = grouped[userName];
            const isUserExpanded = expandedGroups[userName] !== false;

            if (!userGroup) return null;

            return (
              <div key={userName} style={{ marginBottom: 8 }}>
                {/* Nível 1: Usuário */}
                <div 
                  className={classes.groupHeader} 
                  style={{ borderLeftColor: userGroup.color || theme.palette.primary.main }}
                  onClick={() => toggleGroup(userName)}
                >
                  <div className={classes.groupTitleArea}>
                    {userGroup.profileImage ? (
                      <Avatar 
                        src={`${getBackendUrl()}/public/company${user?.companyId}/${userGroup.profileImage}`}
                        alt={userName}
                        style={{ 
                          width: 24, 
                          height: 24, 
                          border: `2px solid ${userGroup.color || theme.palette.primary.main}`
                        }}
                      />
                    ) : (
                      <Avatar 
                        style={{ 
                          width: 24, 
                          height: 24, 
                          backgroundColor: userGroup.color || theme.palette.primary.main,
                          fontSize: 12
                        }}
                      >
                        {userName.charAt(0).toUpperCase()}
                      </Avatar>
                    )}
                    <Typography 
                      className={classes.groupTitle} 
                      style={{ color: userGroup.color || theme.palette.primary.main }}
                    >
                      {userName}
                    </Typography>
                  </div>
                  {isUserExpanded ? (
                    <ExpandLessIcon fontSize="small" style={{ color: userGroup.color || theme.palette.primary.main }} />
                  ) : (
                    <ExpandMoreIcon fontSize="small" style={{ color: userGroup.color || theme.palette.primary.main }} />
                  )}
                </div>

                <Collapse in={isUserExpanded} timeout="auto" unmountOnExit>
                  <div style={{ marginLeft: 8 }}>
                    {Object.keys(userGroup.groups || {}).sort().map(categoryName => {
                      const categoryItems = userGroup.groups[categoryName];
                      const categoryKey = `${userName}-${categoryName}`;
                      const isCategoryExpanded = expandedGroups[categoryKey] !== false;

                      return (
                        <div key={categoryName} style={{ marginBottom: 0 }}>
                          {/* Nível 2: Categoria */}
                          <div 
                            className={classes.groupHeader} 
                            style={{ 
                              backgroundColor: hexToAlpha(categoryItems[0]?.color || "#6B7280", 0.08), 
                              borderBottom: `1px solid rgba(0,0,0,0.05)`,
                              borderLeft: `4px solid ${categoryItems[0]?.color || "#6B7280"}`,
                              padding: '4px 8px',
                              marginLeft: '4px'
                            }}
                            onClick={() => toggleGroup(categoryKey)}
                          >
                            <Typography style={{ fontSize: '11px', fontWeight: 600, color: categoryItems[0]?.color || "#6B7280" }}>
                              {categoryName}
                            </Typography>
                            {isCategoryExpanded ? (
                              <ExpandLessIcon style={{fontSize: 14, color: categoryItems[0]?.color || "#6B7280"}} />
                            ) : (
                              <ExpandMoreIcon style={{fontSize: 14, color: categoryItems[0]?.color || "#6B7280"}} />
                            )}
                          </div>

                          <Collapse in={isCategoryExpanded} timeout="auto" unmountOnExit>
                            {/* Nível 3: Mensagens */}
                            <div style={{ marginTop: 0 }}>
                              {[...categoryItems].sort((a,b) => a.shortcode.localeCompare(b.shortcode)).map((msg, index) => (
                                <MessageItem 
                                  key={msg.id} 
                                  msg={msg} 
                                  index={index}
                                  classes={classes} 
                                  expanded={expandedPreview[msg.id]} 
                                  onToggle={() => togglePreview(msg.id)}
                                  onSend={() => handleSend(msg)}
                                  onCopy={() => handleCopy(msg.message)}
                                  onEdit={() => handleEdit(msg)}
                                  onClone={() => handleClone(msg)}
                                  canEdit={canEdit(msg)}
                                  onSendMessage={onSendMessage}
                                  setDeletingMessage={setDeletingMessage}
                                  setConfirmModalOpen={setConfirmModalOpen}
                                  contact={contact}
                                  ticket={ticket}
                                  user={user}
                                />
                              ))}
                            </div>
                          </Collapse>
                        </div>
                      );
                    })}
                  </div>
                </Collapse>
              </div>
            );
          })
        )}
      </div>

      <QuickMessageDialog
        open={quickMessageModalOpen}
        onClose={() => {
          setQuickMessageModalOpen(false);
          setCloneInitialData(null);
        }}
        quickemessageId={selectedMessage?.id}
        initialData={cloneInitialData}
        reload={fetchMessages}
      />
      <ConfirmationModal
        title={deletingMessage && `${i18n.t("quickMessages.confirmationModal.deleteTitle")} ${deletingMessage.shortcode}?`}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDelete(deletingMessage.id)}
      >
        {i18n.t("quickMessages.confirmationModal.deleteMessage")}
      </ConfirmationModal>
    </div>
  );
};


export default QuickMessagesPanel;
