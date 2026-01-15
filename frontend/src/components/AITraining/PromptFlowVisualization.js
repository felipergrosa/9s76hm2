import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import AccountTreeIcon from "@material-ui/icons/AccountTree";
import RefreshIcon from "@material-ui/icons/Refresh";
import ZoomInIcon from "@material-ui/icons/ZoomIn";
import ZoomOutIcon from "@material-ui/icons/ZoomOut";
import CenterFocusStrongIcon from "@material-ui/icons/CenterFocusStrong";

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
    marginBottom: theme.spacing(2)
  },
  flowContainer: {
    flex: 1,
    backgroundColor: theme.mode === "light" ? "#fafafa" : "#1a1a2e",
    borderRadius: 8,
    overflow: "auto",
    position: "relative",
    minHeight: 400
  },
  flowCanvas: {
    padding: theme.spacing(4),
    minWidth: "100%",
    minHeight: "100%"
  },
  node: {
    position: "relative",
    padding: theme.spacing(2),
    borderRadius: 8,
    marginBottom: theme.spacing(2),
    minWidth: 200,
    maxWidth: 300,
    cursor: "pointer",
    transition: "all 0.2s",
    "&:hover": {
      transform: "scale(1.02)",
      boxShadow: theme.shadows[4]
    }
  },
  startNode: {
    backgroundColor: "#4caf50",
    color: "#fff"
  },
  conditionNode: {
    backgroundColor: "#ff9800",
    color: "#fff",
    clipPath: "polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)",
    padding: theme.spacing(2, 4)
  },
  actionNode: {
    backgroundColor: "#2196f3",
    color: "#fff"
  },
  endNode: {
    backgroundColor: "#f44336",
    color: "#fff"
  },
  instructionNode: {
    backgroundColor: "#9c27b0",
    color: "#fff"
  },
  connector: {
    position: "absolute",
    width: 2,
    backgroundColor: theme.palette.grey[400],
    left: "50%",
    transform: "translateX(-50%)"
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderTop: `10px solid ${theme.palette.grey[400]}`,
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)"
  },
  branchContainer: {
    display: "flex",
    gap: theme.spacing(3),
    justifyContent: "center",
    position: "relative"
  },
  branch: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  branchLabel: {
    fontSize: 10,
    fontWeight: 600,
    marginBottom: theme.spacing(1),
    padding: "2px 8px",
    borderRadius: 4,
    backgroundColor: theme.mode === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"
  },
  legend: {
    display: "flex",
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
    flexWrap: "wrap"
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5)
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 4
  },
  zoomControls: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: theme.mode === "light" ? "#fff" : "#333",
    borderRadius: 4,
    boxShadow: theme.shadows[2]
  }
}));

const parsePromptToFlow = (prompt) => {
  if (!prompt) return { nodes: [], edges: [] };

  const nodes = [];
  const lines = prompt.split("\n").filter(l => l.trim());
  let nodeId = 0;

  nodes.push({
    id: nodeId++,
    type: "start",
    label: "Início",
    description: "Ponto de entrada da conversa"
  });

  const conditionalKeywords = ["se", "if", "quando", "when", "caso", "unless", "senão", "else", "otherwise"];
  const actionKeywords = ["responda", "envie", "pergunte", "informe", "solicite", "ask", "respond", "send", "tell"];
  const instructionKeywords = ["você é", "you are", "atue como", "act as", "sempre", "nunca", "always", "never"];

  let currentContext = null;
  let branchStack = [];

  lines.forEach((line, idx) => {
    const lowerLine = line.toLowerCase().trim();

    const isConditional = conditionalKeywords.some(k => lowerLine.startsWith(k) || lowerLine.includes(` ${k} `));
    const isAction = actionKeywords.some(k => lowerLine.includes(k));
    const isInstruction = instructionKeywords.some(k => lowerLine.includes(k));
    const isBullet = /^[-*•]\s/.test(line.trim());
    const isNumbered = /^\d+[.)]\s/.test(line.trim());

    if (isConditional) {
      nodes.push({
        id: nodeId++,
        type: "condition",
        label: line.trim().substring(0, 50) + (line.length > 50 ? "..." : ""),
        description: line.trim(),
        branches: []
      });
      currentContext = "condition";
    } else if (isInstruction && !isBullet && !isNumbered) {
      nodes.push({
        id: nodeId++,
        type: "instruction",
        label: line.trim().substring(0, 50) + (line.length > 50 ? "..." : ""),
        description: line.trim()
      });
    } else if (isAction || isBullet || isNumbered) {
      nodes.push({
        id: nodeId++,
        type: "action",
        label: line.trim().substring(0, 50) + (line.length > 50 ? "..." : ""),
        description: line.trim()
      });
    }
  });

  nodes.push({
    id: nodeId++,
    type: "end",
    label: "Fim",
    description: "Fim do fluxo"
  });

  return { nodes };
};

const FlowNode = ({ node, classes }) => {
  const getNodeClass = (type) => {
    switch (type) {
      case "start":
        return classes.startNode;
      case "condition":
        return classes.conditionNode;
      case "action":
        return classes.actionNode;
      case "instruction":
        return classes.instructionNode;
      case "end":
        return classes.endNode;
      default:
        return "";
    }
  };

  const getNodeIcon = (type) => {
    switch (type) {
      case "start":
        return "▶";
      case "condition":
        return "◆";
      case "action":
        return "●";
      case "instruction":
        return "📋";
      case "end":
        return "■";
      default:
        return "";
    }
  };

  return (
    <Tooltip title={node.description} placement="right">
      <Paper
        className={`${classes.node} ${getNodeClass(node.type)}`}
        elevation={2}
      >
        <Typography variant="caption" style={{ opacity: 0.7 }}>
          {getNodeIcon(node.type)} {node.type.toUpperCase()}
        </Typography>
        <Typography variant="body2" style={{ fontWeight: 500 }}>
          {node.label}
        </Typography>
      </Paper>
    </Tooltip>
  );
};

const PromptFlowVisualization = ({ prompt, onNodeClick }) => {
  const classes = useStyles();
  const [zoom, setZoom] = useState(1);

  const flowData = useMemo(() => parsePromptToFlow(prompt), [prompt]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoom(1);

  if (!prompt) {
    return (
      <Box className={classes.container}>
        <Box className={classes.header}>
          <Typography variant="h6">
            <AccountTreeIcon style={{ verticalAlign: "middle", marginRight: 8 }} />
            Visualização de Fluxo
          </Typography>
        </Box>
        <Paper variant="outlined" style={{ padding: 32, textAlign: "center" }}>
          <Typography color="textSecondary">
            Insira um prompt para visualizar o fluxo de regras de negócio.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Typography variant="h6">
          <AccountTreeIcon style={{ verticalAlign: "middle", marginRight: 8 }} />
          Visualização de Fluxo
        </Typography>
        <Chip
          size="small"
          label={`${flowData.nodes.length} nós detectados`}
          color="primary"
        />
      </Box>

      <Paper className={classes.flowContainer} variant="outlined">
        <Box className={classes.zoomControls}>
          <Tooltip title="Zoom in">
            <IconButton size="small" onClick={handleZoomIn}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom out">
            <IconButton size="small" onClick={handleZoomOut}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset zoom">
            <IconButton size="small" onClick={handleResetZoom}>
              <CenterFocusStrongIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Box
          className={classes.flowCanvas}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}
        >
          {flowData.nodes.map((node, idx) => (
            <React.Fragment key={node.id}>
              <FlowNode
                node={node}
                classes={classes}
              />
              {idx < flowData.nodes.length - 1 && (
                <Box style={{ height: 30, position: "relative" }}>
                  <Box
                    style={{
                      width: 2,
                      height: 20,
                      backgroundColor: "#9e9e9e",
                      margin: "0 auto"
                    }}
                  />
                  <Box
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "6px solid transparent",
                      borderRight: "6px solid transparent",
                      borderTop: "8px solid #9e9e9e",
                      margin: "0 auto"
                    }}
                  />
                </Box>
              )}
            </React.Fragment>
          ))}
        </Box>
      </Paper>

      <Box className={classes.legend}>
        <div className={classes.legendItem}>
          <div className={classes.legendDot} style={{ backgroundColor: "#4caf50" }} />
          <Typography variant="caption">Início</Typography>
        </div>
        <div className={classes.legendItem}>
          <div className={classes.legendDot} style={{ backgroundColor: "#ff9800" }} />
          <Typography variant="caption">Condição</Typography>
        </div>
        <div className={classes.legendItem}>
          <div className={classes.legendDot} style={{ backgroundColor: "#2196f3" }} />
          <Typography variant="caption">Ação</Typography>
        </div>
        <div className={classes.legendItem}>
          <div className={classes.legendDot} style={{ backgroundColor: "#9c27b0" }} />
          <Typography variant="caption">Instrução</Typography>
        </div>
        <div className={classes.legendItem}>
          <div className={classes.legendDot} style={{ backgroundColor: "#f44336" }} />
          <Typography variant="caption">Fim</Typography>
        </div>
      </Box>
    </Box>
  );
};

export default PromptFlowVisualization;
