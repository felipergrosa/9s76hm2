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
    minHeight: 400,
    padding: theme.spacing(2)
  },
  flowCanvas: {
    padding: theme.spacing(4),
    minWidth: "100%",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  node: {
    position: "relative",
    padding: theme.spacing(2),
    borderRadius: 8,
    marginBottom: theme.spacing(2),
    minWidth: 240,
    maxWidth: 350,
    minHeight: 60,
    cursor: "pointer",
    transition: "all 0.2s ease",
    wordBreak: "break-word",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)",
    border: "2px solid transparent",
    "&:hover": {
      transform: "scale(1.02) translateY(-2px)",
      boxShadow: "0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)"
    }
  },
  startNode: {
    backgroundColor: "#4caf50 !important",
    color: "#fff !important",
    fontWeight: 600,
    border: "2px solid #2e7d32 !important",
    '& *': { color: "#fff !important" },
    '&.MuiPaper-root': { backgroundColor: "#4caf50 !important" }
  },
  conditionNode: {
    backgroundColor: "#ff9800 !important",
    color: "#fff !important",
    fontWeight: 500,
    border: "2px solid #e65100 !important",
    borderRadius: "16px !important",
    '& *': { color: "#fff !important" },
    '&.MuiPaper-root': { backgroundColor: "#ff9800 !important" }
  },
  actionNode: {
    backgroundColor: "#2196f3 !important",
    color: "#fff !important",
    fontWeight: 500,
    border: "2px solid #1565c0 !important",
    borderLeft: "4px solid #0d47a1 !important",
    '& *': { color: "#fff !important" },
    '&.MuiPaper-root': { backgroundColor: "#2196f3 !important" }
  },
  endNode: {
    backgroundColor: "#f44336 !important",
    color: "#fff !important",
    fontWeight: 600,
    border: "2px solid #c62828 !important",
    borderRadius: "50% !important",
    minWidth: 80,
    minHeight: 80,
    '& *': { color: "#fff !important" },
    '&.MuiPaper-root': { backgroundColor: "#f44336 !important", borderRadius: "50% !important" }
  },
  instructionNode: {
    backgroundColor: "#9c27b0 !important",
    color: "#fff !important",
    fontWeight: 500,
    border: "2px solid #6a1b9a !important",
    borderLeft: "6px solid #4a148c !important",
    textAlign: "left",
    alignItems: "flex-start",
    '& *': { color: "#fff !important" },
    '&.MuiPaper-root': { backgroundColor: "#9c27b0 !important" }
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
  if (!prompt || typeof prompt !== 'string') return { nodes: [], edges: [] };

  const nodes = [];
  let nodeId = 0;

  // Nó inicial
  nodes.push({
    id: nodeId++,
    type: "start",
    label: "Início da Conversa",
    description: "Ponto de entrada da conversa com o cliente"
  });

  // Extrair seções principais do prompt
  const sections = [
    { name: "objective", pattern: /#\s*(?:objetivo|Objetivo|PROPÓSITO|Papel e objetivo)[\s\S]*?(?=#|$)/i },
    { name: "persona", pattern: /#\s*(?:perfil|Persona|Tom e estilo|Voz da marca)[\s\S]*?(?=#|$)/i },
    { name: "rules", pattern: /#\s*(?:regras|Regras|Instruções|DIRETRIZES)[\s\S]*?(?=#|$)/i },
    { name: "instructions", pattern: /#\s*(?:instruções|Instruções de|Como responder)[\s\S]*?(?=#|$)/i },
    { name: "functions", pattern: /#\s*(?:funções|Ferramentas|Funções disponíveis)[\s\S]*?(?=#|$)/i },
    { name: "conditions", pattern: /(?:se\s+(?:o\s+)?cliente|quando\s+(?:o\s+)?|caso\s+|if\s+|when\s+)/i },
    { name: "actions", pattern: /(?:responda|envie|pergunte|solicite|transferir|aguarde)/i }
  ];

  // Processar linha por linha com contexto
  const lines = prompt.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  let currentSection = null;
  let sectionContent = [];

  lines.forEach((line, idx) => {
    const lowerLine = line.toLowerCase();
    
    // Detectar headers de seção
    if (line.startsWith('#') || line.startsWith('===') || line.startsWith('---')) {
      // Salvar seção anterior
      if (sectionContent.length > 0 && currentSection) {
        nodes.push({
          id: nodeId++,
          type: "instruction",
          label: currentSection.substring(0, 40) + (currentSection.length > 40 ? "..." : ""),
          description: sectionContent.join("\n"),
          section: true
        });
        sectionContent = [];
      }
      currentSection = line.replace(/[#=\-]/g, '').trim();
      return;
    }

    // Detectar bullets e numbered lists como ações
    if (/^[-*•]\s/.test(line) || /^\d+[.)]\s/.test(line)) {
      const cleanLine = line.replace(/^[-*•\d.)]\s*/, '').trim();
      if (cleanLine.length > 5) {
        const isConditional = /\b(se|quando|caso|if|when|senão|else)\b/i.test(cleanLine);
        const isTransfer = /\b(transferir|falar com|atendente|humano|vendedor)\b/i.test(cleanLine);
        const isQuestion = /\b(pergunte|perguntar|qual|quais|quando|como|por que)\b/i.test(cleanLine);
        
        nodes.push({
          id: nodeId++,
          type: isConditional ? "condition" : isTransfer ? "end" : "action",
          label: cleanLine.substring(0, 45) + (cleanLine.length > 45 ? "..." : ""),
          description: cleanLine,
          bullet: true
        });
      }
      return;
    }

    // Detectar condicionais em texto
    if (/\b(se\s+(?:o\s+)?cliente|quando\s+(?:o\s+)?|caso\s+|unless\s+|senão\s+|else\s+)/i.test(line)) {
      nodes.push({
        id: nodeId++,
        type: "condition",
        label: line.substring(0, 45) + (line.length > 45 ? "..." : ""),
        description: line
      });
      return;
    }

    // Detectar ações
    if (/\b(responda|envie|pergunte|informe|solicite|use|execute|transferir|aguarde)\b/i.test(line)) {
      nodes.push({
        id: nodeId++,
        type: "action",
        label: line.substring(0, 45) + (line.length > 45 ? "..." : ""),
        description: line
      });
      return;
    }

    // Linhas importantes (mínimo 20 caracteres)
    if (line.length > 20 && !line.startsWith('//')) {
      sectionContent.push(line);
    }
  });

  // Adicionar seção final se houver conteúdo
  if (sectionContent.length > 0) {
    const combined = sectionContent.slice(0, 3).join("; ");
    nodes.push({
      id: nodeId++,
      type: "instruction",
      label: combined.substring(0, 40) + (combined.length > 40 ? "..." : ""),
      description: sectionContent.join("\n")
    });
  }

  // Sempre adicionar nó de fim
  nodes.push({
    id: nodeId++,
    type: "end",
    label: "Encerramento",
    description: "Fim da interação ou transferência"
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

  const getNodeColors = (type) => {
    switch (type) {
      case "start":
        return { bg: "#4caf50", border: "#2e7d32", icon: "▶" };
      case "condition":
        return { bg: "#ff9800", border: "#e65100", icon: "◆" };
      case "action":
        return { bg: "#2196f3", border: "#1565c0", icon: "●" };
      case "instruction":
        return { bg: "#9c27b0", border: "#6a1b9a", icon: "📋" };
      case "end":
        return { bg: "#f44336", border: "#c62828", icon: "■" };
      default:
        return { bg: "#757575", border: "#424242", icon: "•" };
    }
  };

  const colors = getNodeColors(node.type);

  return (
    <Tooltip title={node.description} placement="right" arrow>
      <div
        className={`${classes.node} ${getNodeClass(node.type)}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: node.type === "instruction" ? "flex-start" : "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
          border: `2px solid ${colors.border}`,
          color: "#ffffff",
          boxShadow: "0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)"
        }}
      >
        <Typography
          variant="caption"
          style={{
            color: "#ffffff",
            opacity: 0.95,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.5px",
            marginBottom: 4,
            textTransform: "uppercase",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)"
          }}
        >
          {getNodeIcon(node.type)} {node.type}
        </Typography>
        <Typography
          variant="body2"
          style={{
            color: "#ffffff",
            fontWeight: 500,
            fontSize: 14,
            lineHeight: 1.4,
            textAlign: node.type === "instruction" ? "left" : "center",
            wordBreak: "break-word",
            width: "100%",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)"
          }}
        >
          {node.label}
        </Typography>
      </div>
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

  if (!prompt || prompt.trim().length === 0) {
    return (
      <Box className={classes.container}>
        <Box className={classes.header}>
          <Typography variant="h6">
            <AccountTreeIcon style={{ verticalAlign: "middle", marginRight: 8 }} />
            Visualização de Fluxo
          </Typography>
        </Box>
        <Paper 
          variant="outlined" 
          style={{ 
            padding: 48, 
            textAlign: "center",
            backgroundColor: "#f5f5f5",
            border: "2px dashed #ccc"
          }}
        >
          <AccountTreeIcon style={{ fontSize: 48, color: "#999", marginBottom: 16 }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>
            Nenhum prompt para visualizar
          </Typography>
          <Typography color="textSecondary">
            Selecione um agente e etapa, ou edite o prompt na aba "Editor de Prompt"
            para visualizar o fluxograma das diretrizes.
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
