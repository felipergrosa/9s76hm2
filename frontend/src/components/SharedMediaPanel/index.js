import React, { useState, useEffect, useCallback } from "react";
import {
  makeStyles,
  Tabs,
  Tab,
  Typography,
  CircularProgress,
  GridList,
  GridListTile,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
} from "@material-ui/core";
import {
  Image as ImageIcon,
  Videocam as VideoIcon,
  InsertDriveFile as FileIcon,
  Audiotrack as AudioIcon,
  GetApp as DownloadIcon,
  PlayArrow as PlayIcon,
} from "@material-ui/icons";
import { format, parseISO } from "date-fns";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  tabs: {
    minHeight: 36,
    backgroundColor: "#f0f2f5",
    "& .MuiTab-root": {
      minHeight: 36,
      fontSize: 12,
      textTransform: "none",
      minWidth: 0,
      flex: 1,
    },
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: theme.spacing(1),
  },
  gridList: {
    margin: "0 !important",
  },
  gridTile: {
    cursor: "pointer",
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
    "&:hover": {
      opacity: 0.85,
    },
  },
  mediaImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  videoOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: "50%",
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fileItem: {
    padding: "8px 12px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    "&:hover": {
      backgroundColor: "#f5f6f6",
    },
  },
  fileIcon: {
    minWidth: 40,
  },
  fileName: {
    fontSize: 13,
    color: "#111b21",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileMeta: {
    fontSize: 11,
    color: "#8696a0",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(4),
    color: "#8696a0",
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(3),
  },
}));

// Extrair nome do arquivo da URL
const getFileName = (url = "", body = "") => {
  if (body && body.length < 100 && !body.startsWith("http")) return body;
  try {
    const u = new URL(url, window.location.href);
    return decodeURIComponent(u.pathname.split("/").pop() || "arquivo");
  } catch {
    return url?.split("/").pop() || "arquivo";
  }
};

const SharedMediaPanel = ({ ticketId }) => {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);

  const tabTypes = ["image", "video", "document", "audio"];
  const tabLabels = ["Fotos", "Vídeos", "Docs", "Áudios"];

  const fetchMedia = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/messages/${ticketId}/media`, {
        params: { type: tabTypes[tab] },
      });
      setMedia(data.messages || []);
      setCount(data.count || 0);
    } catch (err) {
      console.error("[SharedMediaPanel] Erro:", err);
      setMedia([]);
    } finally {
      setLoading(false);
    }
  }, [ticketId, tab]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleTabChange = (_, newValue) => {
    setTab(newValue);
  };

  const handleOpenMedia = (url) => {
    if (url) window.open(url, "_blank");
  };

  const handleDownload = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = getFileName(url);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Erro no download:", e);
    }
  };

  // Renderizar grid de imagens/vídeos
  const renderImageGrid = () => (
    <GridList cellHeight={110} cols={3} spacing={4} className={classes.gridList}>
      {media.map((msg) => (
        <GridListTile
          key={msg.id}
          className={classes.gridTile}
          onClick={() => handleOpenMedia(msg.mediaUrl)}
        >
          {tab === 0 ? (
            <img src={msg.mediaUrl} alt="" className={classes.mediaImage} />
          ) : (
            <>
              <video src={msg.mediaUrl} className={classes.mediaImage} />
              <div className={classes.videoOverlay}>
                <PlayIcon style={{ color: "#fff", fontSize: 24 }} />
              </div>
            </>
          )}
        </GridListTile>
      ))}
    </GridList>
  );

  // Renderizar lista de documentos/áudios
  const renderFileList = () => (
    <List dense disablePadding>
      {media.map((msg) => (
        <ListItem key={msg.id} className={classes.fileItem} button onClick={() => handleOpenMedia(msg.mediaUrl)}>
          <ListItemIcon className={classes.fileIcon}>
            {tab === 3 ? (
              <AudioIcon style={{ color: "#00a884" }} />
            ) : (
              <FileIcon style={{ color: "#667781" }} />
            )}
          </ListItemIcon>
          <ListItemText
            primary={<span className={classes.fileName}>{getFileName(msg.mediaUrl, msg.body)}</span>}
            secondary={
              <span className={classes.fileMeta}>
                {msg.contact?.name || (msg.fromMe ? "Você" : "")}
                {msg.createdAt && ` · ${format(parseISO(msg.createdAt), "dd/MM/yyyy")}`}
              </span>
            }
          />
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDownload(msg.mediaUrl); }}>
            <DownloadIcon fontSize="small" />
          </IconButton>
        </ListItem>
      ))}
    </List>
  );

  return (
    <div className={classes.root}>
      <Tabs
        value={tab}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        variant="fullWidth"
        className={classes.tabs}
      >
        {tabLabels.map((label, i) => (
          <Tab key={i} label={label} />
        ))}
      </Tabs>

      <div className={classes.content}>
        {loading ? (
          <div className={classes.loadingContainer}>
            <CircularProgress size={24} style={{ color: "#008069" }} />
          </div>
        ) : media.length === 0 ? (
          <div className={classes.emptyState}>
            {tab === 0 && <ImageIcon style={{ fontSize: 40, marginBottom: 8 }} />}
            {tab === 1 && <VideoIcon style={{ fontSize: 40, marginBottom: 8 }} />}
            {tab === 2 && <FileIcon style={{ fontSize: 40, marginBottom: 8 }} />}
            {tab === 3 && <AudioIcon style={{ fontSize: 40, marginBottom: 8 }} />}
            <Typography variant="body2">
              Nenhum{tab === 0 ? "a foto" : tab === 1 ? " vídeo" : tab === 2 ? " documento" : " áudio"} compartilhado
            </Typography>
          </div>
        ) : (
          <>
            {(tab === 0 || tab === 1) ? renderImageGrid() : renderFileList()}
            {count > media.length && (
              <Typography variant="caption" style={{ display: "block", textAlign: "center", padding: 8, color: "#8696a0" }}>
                Mostrando {media.length} de {count}
              </Typography>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SharedMediaPanel;
