import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  TextField,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  Collapse,
  Avatar,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import SearchIcon from "@material-ui/icons/Search";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import SelectAllIcon from "@material-ui/icons/DoneAll";
import DeselectAllIcon from "@material-ui/icons/ClearAll";
import GroupIcon from "@material-ui/icons/Group";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1),
  },
  indicator: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.grey[100],
    marginBottom: theme.spacing(2),
  },
  indicatorCount: {
    fontWeight: 700,
    color: theme.palette.primary.main,
  },
  searchField: {
    marginBottom: theme.spacing(2),
  },
  connectionSection: {
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(1),
    overflow: "hidden",
  },
  connectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1.5, 2),
    backgroundColor: theme.palette.grey[50],
    cursor: "pointer",
    "&:hover": {
      backgroundColor: theme.palette.grey[100],
    },
  },
  connectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    fontWeight: 600,
  },
  connectionActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  connectionCount: {
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
  },
  groupList: {
    padding: theme.spacing(1, 2),
    maxHeight: 300,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  groupItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:last-child": {
      borderBottom: "none",
    },
  },
  groupAvatar: {
    width: 28,
    height: 28,
    fontSize: "0.75rem",
    backgroundColor: theme.palette.primary.light,
  },
  groupName: {
    flex: 1,
    fontSize: "0.9rem",
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(4),
  },
  emptyState: {
    textAlign: "center",
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  selectAllButton: {
    padding: 4,
  },
}));

/**
 * Componente para seleção granular de grupos por conexão.
 * Exibe checkboxes agrupados por conexão com busca, selecionar todos e indicador visual.
 */
const GroupPermissionSelector = ({ userId, disabled = false }) => {
  const classes = useStyles();
  const [availableGroups, setAvailableGroups] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedConnections, setExpandedConnections] = useState({});

  // Carregar grupos disponíveis e permissões do usuário
  const fetchData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const [groupsRes, permissionsRes] = await Promise.all([
        api.get("/group-permissions/available"),
        api.get(`/group-permissions/user/${userId}`),
      ]);

      setAvailableGroups(groupsRes.data);
      setSelectedContactIds(permissionsRes.data);

      // Expandir todas as conexões por padrão
      const expanded = {};
      groupsRes.data.forEach((conn) => {
        expanded[conn.whatsappId] = true;
      });
      setExpandedConnections(expanded);
    } catch (err) {
      console.error("[GroupPermissionSelector] Erro ao carregar dados:", err);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Salvar permissões no backend
  const savePermissions = useCallback(
    async (newContactIds) => {
      if (!userId) return;

      setSaving(true);
      try {
        await api.put(`/group-permissions/user/${userId}`, {
          contactIds: newContactIds,
        });
      } catch (err) {
        console.error("[GroupPermissionSelector] Erro ao salvar:", err);
        toastError(err);
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  // Toggle de um grupo individual
  const handleToggleGroup = (contactId) => {
    const newSelected = selectedContactIds.includes(contactId)
      ? selectedContactIds.filter((id) => id !== contactId)
      : [...selectedContactIds, contactId];

    setSelectedContactIds(newSelected);
    savePermissions(newSelected);
  };

  // Selecionar todos os grupos de uma conexão
  const handleSelectAllConnection = (connection) => {
    const connectionContactIds = connection.groups.map((g) => g.contactId);
    const newSelected = [
      ...new Set([...selectedContactIds, ...connectionContactIds]),
    ];

    setSelectedContactIds(newSelected);
    savePermissions(newSelected);
  };

  // Desselecionar todos os grupos de uma conexão
  const handleDeselectAllConnection = (connection) => {
    const connectionContactIds = new Set(
      connection.groups.map((g) => g.contactId)
    );
    const newSelected = selectedContactIds.filter(
      (id) => !connectionContactIds.has(id)
    );

    setSelectedContactIds(newSelected);
    savePermissions(newSelected);
  };

  // Toggle expandir/colapsar conexão
  const handleToggleExpand = (whatsappId) => {
    setExpandedConnections((prev) => ({
      ...prev,
      [whatsappId]: !prev[whatsappId],
    }));
  };

  // Calcular totais
  const totalGroups = availableGroups.reduce(
    (sum, conn) => sum + conn.groups.length,
    0
  );
  const totalSelected = selectedContactIds.length;

  // Filtrar grupos por busca
  const getFilteredGroups = (groups) => {
    if (!search) return groups;
    const searchLower = search.toLowerCase();
    return groups.filter(
      (g) =>
        (g.name || "").toLowerCase().includes(searchLower) ||
        (g.number || "").toLowerCase().includes(searchLower)
    );
  };

  // Verificar quantos grupos de uma conexão estão selecionados
  const getConnectionSelectedCount = (connection) => {
    return connection.groups.filter((g) =>
      selectedContactIds.includes(g.contactId)
    ).length;
  };

  if (loading) {
    return (
      <Box className={classes.loading}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (availableGroups.length === 0) {
    return (
      <Box className={classes.emptyState}>
        <GroupIcon style={{ fontSize: 48, opacity: 0.3 }} />
        <Typography variant="body2" style={{ marginTop: 8 }}>
          Nenhum grupo encontrado na empresa.
        </Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      {/* Indicador visual */}
      <Box className={classes.indicator}>
        <GroupIcon color="primary" />
        <Typography variant="body2">
          <span className={classes.indicatorCount}>{totalSelected}</span> de{" "}
          <span className={classes.indicatorCount}>{totalGroups}</span> grupos
          liberados
          {saving && (
            <CircularProgress
              size={14}
              style={{ marginLeft: 8, verticalAlign: "middle" }}
            />
          )}
        </Typography>
      </Box>

      {/* Campo de busca */}
      <TextField
        className={classes.searchField}
        placeholder="Buscar grupo por nome..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        size="small"
        variant="outlined"
        InputProps={{
          startAdornment: (
            <SearchIcon style={{ marginRight: 8, color: "#999" }} />
          ),
        }}
      />

      {/* Lista de conexões com grupos */}
      {availableGroups.map((connection) => {
        const filteredGroups = getFilteredGroups(connection.groups);
        if (filteredGroups.length === 0 && search) return null;

        const selectedCount = getConnectionSelectedCount(connection);
        const isExpanded = expandedConnections[connection.whatsappId];
        const allSelected = selectedCount === connection.groups.length;

        return (
          <Box
            key={connection.whatsappId}
            className={classes.connectionSection}
          >
            {/* Cabeçalho da conexão */}
            <Box
              className={classes.connectionHeader}
              onClick={() => handleToggleExpand(connection.whatsappId)}
            >
              <Box className={classes.connectionTitle}>
                <WhatsAppIcon style={{ color: "#25D366", fontSize: 20 }} />
                <Typography variant="subtitle2">
                  {connection.whatsappName}
                </Typography>
                <Chip
                  size="small"
                  label={`${selectedCount}/${connection.groups.length}`}
                  color={selectedCount > 0 ? "primary" : "default"}
                  variant={allSelected ? "default" : "outlined"}
                  style={{ height: 22, fontSize: "0.75rem" }}
                />
              </Box>

              <Box className={classes.connectionActions}>
                {/* Botão Selecionar Todos */}
                <Tooltip title="Selecionar todos desta conexão">
                  <span>
                    <IconButton
                      size="small"
                      className={classes.selectAllButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectAllConnection(connection);
                      }}
                      disabled={disabled || allSelected}
                    >
                      <SelectAllIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                {/* Botão Desselecionar Todos */}
                <Tooltip title="Desselecionar todos desta conexão">
                  <span>
                    <IconButton
                      size="small"
                      className={classes.selectAllButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeselectAllConnection(connection);
                      }}
                      disabled={disabled || selectedCount === 0}
                    >
                      <DeselectAllIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
            </Box>

            {/* Lista de grupos */}
            <Collapse in={isExpanded}>
              <Box className={classes.groupList}>
                {(search ? filteredGroups : connection.groups).map((group) => (
                  <Box key={group.contactId} className={classes.groupItem}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedContactIds.includes(group.contactId)}
                          onChange={() => handleToggleGroup(group.contactId)}
                          disabled={disabled}
                          size="small"
                          color="primary"
                        />
                      }
                      label={
                        <Box
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Avatar
                            className={classes.groupAvatar}
                            src={group.profilePicUrl}
                          >
                            {(group.name || "G").charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography className={classes.groupName}>
                            {group.name || group.number}
                          </Typography>
                        </Box>
                      }
                      style={{ flex: 1, margin: 0 }}
                    />
                  </Box>
                ))}

                {search && filteredGroups.length === 0 && (
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    style={{ padding: 8, textAlign: "center" }}
                  >
                    Nenhum grupo encontrado para "{search}"
                  </Typography>
                )}
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
};

export default GroupPermissionSelector;
