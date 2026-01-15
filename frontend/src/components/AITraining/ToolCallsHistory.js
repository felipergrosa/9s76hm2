import React, { useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import BuildIcon from "@material-ui/icons/Build";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import ErrorIcon from "@material-ui/icons/Error";
import ScheduleIcon from "@material-ui/icons/Schedule";
import CodeIcon from "@material-ui/icons/Code";
import SearchIcon from "@material-ui/icons/Search";
import SendIcon from "@material-ui/icons/Send";
import StorageIcon from "@material-ui/icons/Storage";
import SettingsIcon from "@material-ui/icons/Settings";

const useStyles = makeStyles((theme) => ({
  container: {
    height: "100%",
    display: "flex",
    flexDirection: "column"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(1),
    padding: theme.spacing(1, 2),
    backgroundColor: theme.mode === "light" ? "#f5f5f5" : "#1a1a2e",
    borderRadius: 8
  },
  toolCallsList: {
    flex: 1,
    overflow: "auto"
  },
  toolCallItem: {
    borderLeft: `3px solid ${theme.palette.grey[300]}`,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.mode === "light" ? "#fafafa" : "#242438",
    borderRadius: "0 8px 8px 0",
    "&.success": {
      borderLeftColor: theme.palette.success.main
    },
    "&.error": {
      borderLeftColor: theme.palette.error.main
    },
    "&.pending": {
      borderLeftColor: theme.palette.warning.main
    }
  },
  toolCallDetails: {
    padding: theme.spacing(2),
    backgroundColor: theme.mode === "light" ? "#f0f0f0" : "#1a1a2e",
    borderRadius: 4,
    marginTop: theme.spacing(1)
  },
  codeBlock: {
    fontFamily: "monospace",
    fontSize: 11,
    backgroundColor: theme.mode === "light" ? "#263238" : "#000",
    color: "#e0e0e0",
    padding: theme.spacing(1.5),
    borderRadius: 4,
    overflow: "auto",
    maxHeight: 200,
    whiteSpace: "pre-wrap"
  },
  paramKey: {
    color: "#82b1ff"
  },
  paramValue: {
    color: "#c3e88d"
  },
  durationChip: {
    marginLeft: theme.spacing(1)
  },
  emptyState: {
    textAlign: "center",
    padding: theme.spacing(4),
    color: theme.palette.text.secondary
  }
}));

const getToolIcon = (toolName) => {
  const name = toolName?.toLowerCase() || "";
  if (name.includes("search") || name.includes("busca")) return <SearchIcon />;
  if (name.includes("send") || name.includes("enviar")) return <SendIcon />;
  if (name.includes("database") || name.includes("db") || name.includes("query")) return <StorageIcon />;
  if (name.includes("code") || name.includes("execute")) return <CodeIcon />;
  return <SettingsIcon />;
};

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const ToolCallItem = ({ call, classes }) => {
  const [expanded, setExpanded] = useState(false);

  const statusClass = call.status === "success" ? "success" : call.status === "error" ? "error" : "pending";

  return (
    <Paper className={`${classes.toolCallItem} ${statusClass}`} variant="outlined">
      <ListItem button onClick={() => setExpanded(!expanded)}>
        <ListItemIcon>
          {getToolIcon(call.name)}
        </ListItemIcon>
        <ListItemText
          primary={
            <Box display="flex" alignItems="center">
              <Typography variant="subtitle2">{call.name}</Typography>
              {call.duration && (
                <Chip
                  size="small"
                  icon={<ScheduleIcon style={{ fontSize: 14 }} />}
                  label={formatDuration(call.duration)}
                  className={classes.durationChip}
                  variant="outlined"
                />
              )}
            </Box>
          }
          secondary={
            <Typography variant="caption" color="textSecondary">
              {new Date(call.timestamp).toLocaleTimeString()}
              {call.description && ` - ${call.description}`}
            </Typography>
          }
        />
        <ListItemSecondaryAction>
          <Box display="flex" alignItems="center">
            {call.status === "success" && (
              <Tooltip title="Sucesso">
                <CheckCircleIcon style={{ color: "#4caf50", marginRight: 8 }} />
              </Tooltip>
            )}
            {call.status === "error" && (
              <Tooltip title="Erro">
                <ErrorIcon style={{ color: "#f44336", marginRight: 8 }} />
              </Tooltip>
            )}
            {call.status === "pending" && (
              <Tooltip title="Pendente">
                <ScheduleIcon style={{ color: "#ff9800", marginRight: 8 }} />
              </Tooltip>
            )}
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </ListItemSecondaryAction>
      </ListItem>

      <Collapse in={expanded}>
        <Box className={classes.toolCallDetails}>
          {call.parameters && (
            <Box mb={2}>
              <Typography variant="caption" color="textSecondary" gutterBottom>
                Parâmetros:
              </Typography>
              <Box className={classes.codeBlock}>
                {JSON.stringify(call.parameters, null, 2)}
              </Box>
            </Box>
          )}

          {call.result && (
            <Box>
              <Typography variant="caption" color="textSecondary" gutterBottom>
                Resultado:
              </Typography>
              <Box className={classes.codeBlock}>
                {typeof call.result === "object"
                  ? JSON.stringify(call.result, null, 2)
                  : call.result}
              </Box>
            </Box>
          )}

          {call.error && (
            <Box>
              <Typography variant="caption" color="error" gutterBottom>
                Erro:
              </Typography>
              <Box className={classes.codeBlock} style={{ borderLeft: "3px solid #f44336" }}>
                {call.error}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

const ToolCallsHistory = ({ toolCalls = [] }) => {
  const classes = useStyles();

  const successCount = toolCalls.filter(c => c.status === "success").length;
  const errorCount = toolCalls.filter(c => c.status === "error").length;
  const totalDuration = toolCalls.reduce((acc, c) => acc + (c.duration || 0), 0);

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Box display="flex" alignItems="center">
          <BuildIcon style={{ marginRight: 8 }} />
          <Typography variant="subtitle2">
            Tool Calls ({toolCalls.length})
          </Typography>
        </Box>
        {toolCalls.length > 0 && (
          <Box display="flex" gap={1}>
            <Chip
              size="small"
              icon={<CheckCircleIcon style={{ fontSize: 14 }} />}
              label={successCount}
              style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}
            />
            <Chip
              size="small"
              icon={<ErrorIcon style={{ fontSize: 14 }} />}
              label={errorCount}
              style={{ backgroundColor: "#ffebee", color: "#c62828" }}
            />
            <Chip
              size="small"
              icon={<ScheduleIcon style={{ fontSize: 14 }} />}
              label={formatDuration(totalDuration)}
              variant="outlined"
            />
          </Box>
        )}
      </Box>

      {toolCalls.length === 0 ? (
        <Paper variant="outlined" className={classes.emptyState}>
          <BuildIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <Typography variant="body2" color="textSecondary">
            Nenhuma chamada de ferramenta registrada nesta conversa.
          </Typography>
          <Typography variant="caption" color="textSecondary">
            As tool calls aparecerão aqui quando o agente utilizar ferramentas.
          </Typography>
        </Paper>
      ) : (
        <List className={classes.toolCallsList} disablePadding>
          {toolCalls.map((call, idx) => (
            <ToolCallItem key={call.id || idx} call={call} classes={classes} />
          ))}
        </List>
      )}
    </Box>
  );
};

export default ToolCallsHistory;
